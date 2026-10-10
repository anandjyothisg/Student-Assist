"""
Back up everything AuraStudy needs to be restored.

    python manage.py backup_data --out /backups/aurastudy

Creates <out>/<timestamp>/ containing:
  db.sqlite3          online, consistent copy (SQLite only; Postgres: use pg_dump, see below)
  media/              uploaded documents, avatars and thumbnails
  chroma_db/          the vector store (can also be rebuilt: index_documents --rebuild)
  manifest.json       counts, embedding model and versions, for verifying a restore

The vector store is copied as files, so for a guaranteed-consistent copy run it
while no document is being indexed (or simply rebuild vectors after restore).
"""

import json
import shutil
import sqlite3
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = "Back up the database (SQLite), uploaded files and the vector store."

    def add_arguments(self, parser):
        parser.add_argument("--out", required=True, help="Directory that receives a timestamped backup folder.")
        parser.add_argument("--skip-vectors", action="store_true", help="Don't copy the vector store (it can be rebuilt).")

    def handle(self, *args, **opts):
        from apps.academic.models import Course
        from apps.accounts.models import User
        from apps.chat.models import ChatMessage
        from apps.documents.models import Document, DocumentChunk

        dest = Path(opts["out"]).resolve() / timezone.now().strftime("%Y%m%d-%H%M%S")
        dest.mkdir(parents=True, exist_ok=False)
        db = settings.DATABASES["default"]

        if db["ENGINE"].endswith("sqlite3"):
            src = sqlite3.connect(str(db["NAME"]))
            out = sqlite3.connect(str(dest / "db.sqlite3"))
            with out:
                src.backup(out)  # consistent even while the app is running
            out.close()
            src.close()
            self.stdout.write(f"  database  → {dest / 'db.sqlite3'}")
        else:
            self.stdout.write(self.style.WARNING(
                "  database  → not copied: run pg_dump -Fc -f db.dump $DB_NAME (see docs/BACKUP_RESTORE.md)"
            ))

        media = Path(settings.MEDIA_ROOT)
        if media.exists():
            shutil.copytree(media, dest / "media")
            self.stdout.write(f"  files     → {dest / 'media'}")

        chroma = Path(settings.CHROMA_DB_PATH)
        if not opts["skip_vectors"] and chroma.exists():
            shutil.copytree(chroma, dest / "chroma_db")
            self.stdout.write(f"  vectors   → {dest / 'chroma_db'}")

        manifest = {
            "created_at": timezone.now().isoformat(),
            "engine": db["ENGINE"],
            "embedding_model": settings.EMBEDDING_MODEL_NAME,
            "counts": {
                "users": User.objects.count(),
                "courses": Course.objects.count(),
                "documents": Document.objects.count(),
                "chunks": DocumentChunk.objects.count(),
                "chat_messages": ChatMessage.objects.count(),
            },
        }
        (dest / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
        if not any(dest.iterdir()):
            raise CommandError("Nothing was backed up.")
        self.stdout.write(self.style.SUCCESS(f"Backup complete: {dest}"))
