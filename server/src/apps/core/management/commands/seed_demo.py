"""
Build the AuraStudy demonstration environment.

    python manage.py seed_demo --reset          # back up, wipe, rebuild everything
    python manage.py seed_demo                  # create anything missing (idempotent)
    python manage.py seed_demo --reset --no-history --no-flashcards   # fast rebuild, no LLM needed

Everything is created through the real models and pipelines: documents are
rendered from the authored library in `server/demo_content/`, indexed by the
same task uploads use, and conversation history is produced by running real
questions through the grounded RAG service.
"""

import json
import random
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.academic.models import Course, Enrollment, Subject, Topic, Unit
from apps.accounts.models import User
from apps.core.demo.render import RENDERERS
from apps.core.utils import compute_file_hash
from apps.documents.models import Document, DocumentStatus
from apps.documents.services.dispatch import dispatch_processing

DEMO_ACCOUNTS = {
    "admin": {"email": "admin@aurastudy.demo", "password": "AuraAdmin#2026"},
    "teacher": {"email": "teacher@aurastudy.demo", "password": "AuraTeach#2026"},
    "student": {"email": "student@aurastudy.demo", "password": "AuraStudy#2026"},
}
STAFF_PASSWORD = "AuraFaculty#2026"
STUDENT_PASSWORD = "AuraLearner#2026"

SUBJECTS = {
    "ai-ds": ("AI-DS", "Artificial Intelligence & Data Science",
              "Machine intelligence, learning from data and reasoning under uncertainty."),
    "core-cs": ("CORE-CS", "Core Computer Science",
                "Algorithms, systems and data foundations every computer scientist needs."),
}

TEACHERS = {
    "daniel.reyes": dict(email=DEMO_ACCOUNTS["teacher"]["email"], first_name="Daniel", last_name="Reyes",
                         designation="Associate Professor", department="Artificial Intelligence & Data Science",
                         bio="Teaches machine learning and AI; research in probabilistic models."),
    "ananya.rao": dict(email="ananya.rao@aurastudy.demo", first_name="Ananya", last_name="Rao",
                       designation="Assistant Professor", department="Computer Science & Engineering",
                       bio="Algorithms and data structures; competitive programming coach."),
    "ravi.menon": dict(email="ravi.menon@aurastudy.demo", first_name="Ravi", last_name="Menon",
                       designation="Professor", department="Computer Science & Engineering",
                       bio="Systems: operating systems and database internals."),
    "elena.fischer": dict(email="elena.fischer@aurastudy.demo", first_name="Elena", last_name="Fischer",
                          designation="Assistant Professor", department="Computer Science & Engineering",
                          bio="Computer networks and distributed systems."),
}

PROGRAM = "B.Tech Computer Science & Engineering (AI & ML)"
STUDENTS = [
    ("Maya", "Okafor", 3), ("Arjun", "Nair", 3), ("Sofia", "Marquez", 3), ("Kenji", "Watanabe", 3),
    ("Aisha", "Rahman", 2), ("Lucas", "Bennett", 3), ("Priyanka", "Iyer", 4), ("Tomás", "Herrera", 2),
    ("Hannah", "Kowalski", 3), ("Daniel", "Mensah", 4), ("Meera", "Krishnan", 2), ("Oliver", "Grant", 3),
    ("Zainab", "Yusuf", 3), ("Ethan", "Park", 2), ("Lena", "Schmidt", 4), ("Rohan", "Gupta", 3),
    ("Amara", "Nwosu", 2), ("Sebastian", "Cruz", 3), ("Isha", "Banerjee", 4), ("Noah", "Lindqvist", 2),
    ("Fatima", "Al-Sayed", 3), ("Vikram", "Joshi", 4), ("Chloe", "Dubois", 2), ("Samuel", "Osei", 3),
]
DEMO_STUDENT_COURSES = ["AI-301", "ML-302", "CS-201", "CS-305", "CS-308"]  # not CS-304 → shows "available"

# Conversation history: (student index, course code or None for "all my courses", days ago, [questions])
HISTORY = [
    (0, "ML-302", 2, ["How does gradient descent update the weights in linear regression?",
                      "What happens if the learning rate is too large?"]),
    (0, "CS-305", 5, ["Explain the difference between 3NF and BCNF with an example."]),
    (0, None, 9, ["How do I calculate the number of usable hosts in a /26 subnet?"]),
    (0, "AI-301", 13, ["Why is A* search optimal when the heuristic is admissible?"]),
    (1, "ML-302", 1, ["What is the difference between precision and recall?", "When would I prefer F1 score?"]),
    (1, "CS-201", 4, ["Why does quicksort have O(n^2) worst-case time?"]),
    (2, "AI-301", 2, ["What does PEAS stand for in agent design?"]),
    (2, "ML-302", 6, ["How does a random forest reduce variance compared to a single decision tree?"]),
    (3, "CS-308", 3, ["Explain the TCP three-way handshake.", "How does slow start change the congestion window?"]),
    (4, "CS-201", 1, ["How is a binary heap stored in an array?"]),
    (4, None, 8, ["Who won the 2018 FIFA World Cup?"]),
    (5, "CS-304", 3, ["What are the four necessary conditions for deadlock?"]),
    (5, "CS-304", 10, ["How does the Banker's algorithm decide whether a state is safe?"]),
    (6, "CS-305", 2, ["What are the ACID properties of a transaction?"]),
    (6, "CS-305", 12, ["How does a B+ tree index differ from a hash index?"]),
    (7, "ML-302", 4, ["What is k-means clustering and how do you choose k?"]),
    (8, "AI-301", 6, ["Explain Bayes' rule with an example."]),
    (8, None, 15, ["Can you explain how blockchain consensus algorithms work?"]),
    (9, "CS-308", 5, ["What is the difference between distance-vector and link-state routing?"]),
    (10, "CS-201", 7, ["Compare Prim's and Kruskal's algorithms for minimum spanning trees."]),
    (11, "ML-302", 9, ["What is the bias-variance trade-off?"]),
    (12, "CS-305", 6, ["What is the difference between an inner join and a left join?"]),
    (13, "AI-301", 11, ["How does alpha-beta pruning improve minimax?"]),
    (14, "CS-304", 4, ["How does round robin scheduling work and what is the effect of the time quantum?"]),
    (15, "ML-302", 3, ["Why do we use ReLU instead of sigmoid in deep networks?"]),
    (16, "CS-308", 14, ["What DNS record types are there and what does an MX record do?"]),
    (17, "CS-201", 16, ["How does open addressing handle collisions in a hash table?"]),
    (18, "AI-301", 18, ["What is the difference between forward and backward chaining?"]),
    (19, "CS-305", 19, ["What is the syllabus for the quantum computing elective?"]),
    (20, "ML-302", 20, ["How does k-fold cross-validation work?"]),
    (21, "CS-304", 7, ["What is a TLB and how does it affect effective memory access time?"]),
    (22, "CS-308", 12, ["What are the seven layers of the OSI model?"]),
    (23, "ML-302", 17, ["What does PCA do and how is explained variance used?"]),
]

FLASHCARD_DOCS = ["Linear and Logistic Regression", "Functional Dependencies"]


class Command(BaseCommand):
    help = "Create (or with --reset, rebuild) the AuraStudy demonstration environment."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Back up and wipe the database, vectors and uploaded files first.")
        parser.add_argument("--no-history", action="store_true", help="Skip generating conversation history (needs Ollama).")
        parser.add_argument("--no-flashcards", action="store_true", help="Skip generating flashcards (needs Ollama).")
        parser.add_argument("--yes", action="store_true", help="Don't ask for confirmation before --reset.")
        parser.add_argument("--refresh-history", action="store_true", help="Delete and regenerate conversation history, saved answers and flashcards.")

    # ------------------------------------------------------------------
    def handle(self, *args, **opts):
        self.rng = random.Random(2026)
        content_dir = Path(settings.DEMO_CONTENT_DIR)
        manifests = sorted(content_dir.glob("*/manifest.json"))
        if not manifests:
            raise CommandError(f"No course manifests found in {content_dir}")

        if opts["reset"]:
            if not opts["yes"]:
                answer = input("This backs up and then ERASES all data in the dev database. Continue? [y/N] ")
                if answer.strip().lower() not in ("y", "yes"):
                    raise CommandError("Aborted.")
            self.reset()

        self.step("Accounts")
        admin, teachers, students = self.create_people()
        self.step("Subjects & courses")
        courses = self.create_courses(manifests, teachers)
        self.step("Enrollments")
        self.create_enrollments(students, courses)
        self.step("Course library (render + index)")
        self.create_documents(manifests, courses, teachers)

        from apps.core.ai import ollama_status, warm_up_model
        llm_ready = ollama_status(force=True)
        llm_ok = llm_ready["reachable"] and llm_ready["model_available"]
        if (not opts["no_history"] or not opts["no_flashcards"]) and not llm_ok:
            self.stdout.write(self.style.WARNING(f"  ! {llm_ready['error']} — skipping history and flashcards."))
        if llm_ok:
            self.stdout.write("  warming up the language model…")
            warm_up_model()
        from apps.assistant.models import GeneratedContent
        from apps.chat.models import ChatSession, SavedAnswer
        if opts["refresh_history"]:
            ChatSession.objects.all().delete()
            SavedAnswer.objects.all().delete()
            GeneratedContent.objects.all().delete()
            self.stdout.write("  cleared previous conversations, saved answers and generated content")
        if llm_ok and not opts["no_history"]:
            self.step("Conversation history (real RAG answers)")
            if ChatSession.objects.exists():
                self.stdout.write("  history already present — use --refresh-history to regenerate")
            else:
                self.create_history(students, courses)
        if llm_ok and not opts["no_flashcards"]:
            self.step("Flashcards")
            self.create_flashcards(students[0])

        self.summary()

    # ------------------------------------------------------------------
    def step(self, label):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n▸ {label}"))

    def reset(self):
        server_dir = Path(settings.BASE_DIR).parent
        stamp = timezone.now().strftime("%Y%m%d-%H%M%S")
        backup = server_dir / "backups" / f"seed-{stamp}"
        backup.mkdir(parents=True, exist_ok=True)
        self.step(f"Backing up to {backup}")

        db_path = Path(settings.DATABASES["default"]["NAME"])
        if db_path.exists():
            shutil.copy2(db_path, backup / db_path.name)
        chroma = Path(settings.CHROMA_DB_PATH)
        if chroma.exists():
            shutil.copytree(chroma, backup / "chroma_db", dirs_exist_ok=True)
        docs_media = Path(settings.MEDIA_ROOT) / "documents"
        if docs_media.exists():
            shutil.copytree(docs_media, backup / "media_documents", dirs_exist_ok=True)

        self.step("Resetting data")
        call_command("flush", interactive=False, verbosity=0)
        # Remove vectors through the client (safe even if a server process has the store open).
        from apps.documents.services.vector_store import get_chroma_client
        client = get_chroma_client()
        for col in client.list_collections():
            name = getattr(col, "name", str(col))
            if name.startswith(settings.CHROMA_COLLECTION_PREFIX):
                client.delete_collection(name)
        shutil.rmtree(docs_media, ignore_errors=True)
        self.stdout.write("  database flushed, vectors and uploaded files removed")

    # ------------------------------------------------------------------
    def _user(self, email, password, **fields):
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(email=email, password=password, **fields)
            created = True
        else:
            for k, v in fields.items():
                setattr(user, k, v)
            user.set_password(password)
            user.is_active = True
            user.save()
            created = False
        return user, created

    def create_people(self):
        admin, _ = self._user(
            DEMO_ACCOUNTS["admin"]["email"], DEMO_ACCOUNTS["admin"]["password"],
            first_name="Priya", last_name="Nair", role="admin", is_staff=True, is_superuser=True,
            designation="Academic Systems Administrator", department="Office of Academic Technology",
        )
        teachers = {}
        for key, t in TEACHERS.items():
            pw = DEMO_ACCOUNTS["teacher"]["password"] if t["email"] == DEMO_ACCOUNTS["teacher"]["email"] else STAFF_PASSWORD
            fields = {k: v for k, v in t.items() if k != "email"}
            teachers[key], _ = self._user(t["email"], pw, role="teacher", **fields)

        students = []
        for i, (first, last, year) in enumerate(STUDENTS):
            email = DEMO_ACCOUNTS["student"]["email"] if i == 0 else (
                f"{first}.{last}".lower().replace(" ", "").replace("á", "a").replace("ó", "o").replace("-", "") + "@student.aurastudy.demo"
            )
            pw = DEMO_ACCOUNTS["student"]["password"] if i == 0 else STUDENT_PASSWORD
            user, _ = self._user(
                email, pw, first_name=first, last_name=last, role="student",
                program=PROGRAM, year_of_study=year, department="Computer Science & Engineering",
                student_number=f"AU{26 - year}CSA{101 + i:03d}",
            )
            students.append(user)
        # Spread join dates so the directory looks lived-in.
        for n, u in enumerate([admin, *teachers.values(), *students]):
            User.objects.filter(pk=u.pk).update(date_joined=timezone.now() - timedelta(days=200 - n * 3))
        self.stdout.write(f"  1 admin, {len(teachers)} teachers, {len(students)} students")
        return admin, teachers, students

    def create_courses(self, manifests, teachers):
        subjects = {}
        admin = User.objects.get(email=DEMO_ACCOUNTS["admin"]["email"])
        for key, (code, name, desc) in SUBJECTS.items():
            subjects[key], _ = Subject.objects.update_or_create(
                code=code, defaults={"name": name, "description": desc, "is_active": True, "created_by": admin}
            )
        courses = {}
        for path in manifests:
            m = json.loads(path.read_text(encoding="utf-8"))
            course, _ = Course.objects.update_or_create(
                code=m["code"],
                defaults={
                    "title": m["title"], "description": m["description"], "subject": subjects[m["subject"]],
                    "teacher": teachers[m["teacher"]], "is_published": True, "enrollment_open": True,
                },
            )
            courses[m["code"]] = course
            for u_order, u in enumerate(m["units"], start=1):
                unit, _ = Unit.objects.update_or_create(
                    course=course, order=u_order, defaults={"title": u["title"], "description": u.get("description", "")}
                )
                for t_order, t in enumerate(u["topics"], start=1):
                    Topic.objects.update_or_create(
                        unit=unit, order=t_order, defaults={"title": t["title"], "description": t.get("description", "")}
                    )
            self.stdout.write(f"  {course.code:8} {course.title}  ({len(m['units'])} units) — {course.teacher.get_full_name()}")
        return courses

    def create_enrollments(self, students, courses):
        codes = sorted(courses)
        for i, s in enumerate(students):
            chosen = DEMO_STUDENT_COURSES if i == 0 else self.rng.sample(codes, self.rng.randint(3, 5))
            for code in chosen:
                e, _ = Enrollment.objects.get_or_create(student=s, course=courses[code])
                if not e.is_active:
                    e.is_active = True
                    e.save(update_fields=["is_active"])
                Enrollment.objects.filter(pk=e.pk).update(enrolled_at=timezone.now() - timedelta(days=self.rng.randint(40, 90)))
        self.stdout.write(f"  {Enrollment.objects.filter(is_active=True).count()} active enrollments")

    def create_documents(self, manifests, courses, teachers):
        tmp = Path(tempfile.mkdtemp(prefix="aurastudy-render-"))
        total = indexed = 0
        try:
            for path in manifests:
                m = json.loads(path.read_text(encoding="utf-8"))
                course = courses[m["code"]]
                teacher = teachers[m["teacher"]]
                for u_order, u in enumerate(m["units"], start=1):
                    unit = Unit.objects.get(course=course, order=u_order)
                    for t_order, t in enumerate(u["topics"], start=1):
                        topic = Topic.objects.get(unit=unit, order=t_order)
                        for d in t.get("documents", []):
                            total += 1
                            if Document.objects.filter(course=course, title=d["title"], is_latest=True).exists():
                                continue
                            src = path.parent / u["slug"] / t["slug"] / d["file"]
                            md = src.read_text(encoding="utf-8")
                            fmt = d.get("format", "pdf")
                            out = tmp / (src.stem + f".{fmt}")
                            meta = f"{teacher.get_full_name()} · {course.code} {course.title}"
                            RENDERERS[fmt](md, out, meta_line=meta, title=d["title"])
                            with open(out, "rb") as fh:
                                f = File(fh, name=out.name)
                                doc = Document(
                                    title=d["title"], description=d.get("description", ""), category=d.get("category", ""),
                                    course=course, topic=topic, uploaded_by=teacher, file_type=fmt,
                                    file_size=out.stat().st_size, file_hash=compute_file_hash(f),
                                )
                                doc.file.save(out.name, f, save=True)
                            Document.objects.filter(pk=doc.pk).update(
                                created_at=timezone.now() - timedelta(days=self.rng.randint(21, 70), hours=self.rng.randint(0, 9))
                            )
                            dispatch_processing(doc.id, wait=True)
                            doc.refresh_from_db()
                            ok = doc.processing_status == DocumentStatus.COMPLETED
                            indexed += ok
                            mark = self.style.SUCCESS("✓") if ok else self.style.ERROR("✗")
                            self.stdout.write(f"  {mark} {course.code:7} {d['title'][:62]:62} {doc.page_count:>2}p {doc.chunk_count:>3} chunks")
                            if not ok:
                                self.stdout.write(self.style.ERROR(f"      {doc.error_message}"))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        self.stdout.write(f"  {total} documents in the library")

    def create_history(self, students, courses):
        from apps.chat.services import ask

        now = timezone.now()
        for idx, code, days, questions in HISTORY:
            user = students[idx]
            course = courses.get(code) if code else None
            if course and not Enrollment.objects.filter(student=user, course=course, is_active=True).exists():
                Enrollment.objects.get_or_create(student=user, course=course)
            when = now - timedelta(days=days, hours=self.rng.randint(1, 9), minutes=self.rng.randint(0, 59))
            session = None
            for q in questions:
                session, msg = ask(user, q, course_id=course.id if course else None,
                                   session_id=session.id if session else None, created_at=when)
                ChatSessionModel = type(session)
                ChatSessionModel.objects.filter(pk=session.pk).update(created_at=when - timedelta(minutes=1))
                cited = ", ".join(sorted({c["course_code"] for c in msg.citations})) or "—"
                self.stdout.write(f"  [{msg.status:17}] {user.first_name:9} {q[:58]:58} → {cited}")
                when += timedelta(minutes=self.rng.randint(2, 6))

        # Keep a few of the demo student's best answers in her Notebook.
        from apps.chat.models import ChatMessage, SavedAnswer
        maya = students[0]
        for msg in ChatMessage.objects.filter(session__student=maya, role="assistant", status="answered").order_by("created_at")[:3]:
            q = msg.session.messages.filter(role="user", created_at__lte=msg.created_at).order_by("-created_at").first()
            SavedAnswer.objects.get_or_create(
                user=maya, message=msg,
                defaults=dict(course=msg.session.course, question=q.content if q else msg.session.title,
                              content=msg.content, citations=msg.citations),
            )

    def create_flashcards(self, student):
        from rest_framework.test import APIRequestFactory, force_authenticate

        from apps.assistant.models import GeneratedContent
        from apps.assistant.views import FlashcardGenerateView

        factory = APIRequestFactory()
        view = FlashcardGenerateView.as_view()
        for title_part in FLASHCARD_DOCS:
            doc = Document.objects.filter(title__icontains=title_part, is_latest=True).first()
            if not doc:
                continue
            if GeneratedContent.objects.filter(created_by=student, content_type="flashcard", source_documents=doc).exists():
                continue
            req = factory.post("/api/assistant/flashcard/generate/", {"document_id": str(doc.id), "count": 6}, format="json")
            force_authenticate(req, user=student)
            res = view(req)
            n = len(res.data.get("cards", [])) if res.status_code == 200 else 0
            self.stdout.write(f"  {doc.title[:60]:60} → {n} cards" + ("" if n else f"  ({res.data})"))

    def summary(self):
        from apps.chat.models import ChatMessage

        docs = Document.objects.filter(is_latest=True)
        self.stdout.write(self.style.SUCCESS("\n✔ Demo environment ready"))
        self.stdout.write(
            f"  {Course.objects.count()} courses · {Unit.objects.count()} units · {Topic.objects.count()} topics · "
            f"{docs.filter(processing_status='completed').count()}/{docs.count()} documents indexed · "
            f"{ChatMessage.objects.filter(role='user').count()} questions in history"
        )
        self.stdout.write("\n  Sign in with:")
        for role, acc in DEMO_ACCOUNTS.items():
            self.stdout.write(f"    {role:8} {acc['email']:28} {acc['password']}")
