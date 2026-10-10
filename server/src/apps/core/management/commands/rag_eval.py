"""
Evaluate the assistant against apps/chat/eval/dataset.jsonl.

    python manage.py rag_eval              # retrieval layer only (deterministic, no LLM)
    python manage.py rag_eval --llm        # also generate answers with the configured model

Layers
  retrieval  in-scope: is an expected document among the passages the answer
             would be built from (hit@k), scoped to the course and across all
             courses; negatives: is the question declined before the model is
             asked; permission: does a student ever receive passages from a
             course they can't read.
  answers    (--llm) refusal correctness, citations that point at a passage
             (before and after the server's own clean-up), whether a cited
             passage comes from an expected document, a key-fact coverage
             heuristic, and latency.

Thresholds are fixed here, before any run, and the command exits non-zero
when a gated metric misses its threshold. Key-fact coverage is a heuristic
and is reported, not gated; answers it flags need human review.
"""

import json
import statistics
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from rest_framework.exceptions import PermissionDenied

THRESHOLDS = {
    "retrieval_hit_rate_scoped": 0.90,
    "retrieval_hit_rate_all_courses": 0.85,
    "negative_refusal_rate_retrieval": 0.80,
    "permission_leaks": 0,
    "answer_refusal_rate_negatives": 1.00,
    "answer_rate_in_scope": 0.85,
    "out_of_range_citations_after_cleanup": 0,
    "cited_expected_source_rate": 0.80,
}

DATASET = Path(__file__).resolve().parents[3] / "chat" / "eval" / "dataset.jsonl"


def _hit(chunks, expected):
    titles = [c["document_title"] for c in chunks]
    return any(e.lower() in t.lower() for e in expected for t in titles)


def _pct(values, q):
    if not values:
        return None
    values = sorted(values)
    return round(values[min(len(values) - 1, int(round(q * (len(values) - 1))))], 2)


class Command(BaseCommand):
    help = "Evaluate retrieval (and optionally answers) against the evaluation dataset."

    def add_arguments(self, parser):
        parser.add_argument("--llm", action="store_true", help="Also generate answers with the configured model.")
        parser.add_argument("--out", default=str(Path(settings.BASE_DIR).parent / "eval_reports"))
        parser.add_argument("--student", default="student@aurastudy.demo", help="Account used for permission checks.")

    def handle(self, *args, **opts):
        from apps.academic.models import Course
        from apps.accounts.models import User
        from apps.chat import services as S

        items = [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]
        course_ids = {c.code: str(c.id) for c in Course.objects.all()}
        all_ids = list(course_ids.values())
        student = User.objects.get(email=opts["student"])
        admin = User.objects.filter(role="admin").first() or student

        rows = []
        for it in items:
            row = {"id": it["id"], "type": it["type"], "question": it["question"], "course": it.get("course")}
            t0 = time.perf_counter()
            if it["type"] == "in_scope":
                scoped = S.retrieve(it["question"], [course_ids[it["course"]]])
                scoped_ok = bool(scoped) and S.covers_question(it["question"], scoped)
                everywhere = S.retrieve(it["question"], all_ids)
                row.update(
                    hit_scoped=scoped_ok and _hit(scoped, it["expected_docs"]),
                    hit_all=bool(everywhere) and S.covers_question(it["question"], everywhere) and _hit(everywhere, it["expected_docs"]),
                    retrieved=[f'{c["course_code"]} | {c["document_title"]} p{c["page_number"]} ({c["score"]:.3f})' for c in scoped],
                )
                context = scoped if scoped_ok else []
            elif it["type"] == "negative":
                ids = [course_ids[it["course"]]] if it.get("course") else all_ids
                chunks = S.retrieve(it["question"], ids)
                context = chunks if chunks and S.covers_question(it["question"], chunks) else []
                row.update(declined_by_retrieval=not context, retrieved=[c["document_title"] for c in chunks][:3])
            else:  # permission
                try:
                    ids = S.resolve_course_ids(student, course_ids.get(it["course"]) if it.get("course") else None)
                    chunks = S.retrieve(it["question"], ids)
                    blocked = False
                except PermissionDenied:
                    chunks, blocked = [], True
                leaked = [c for c in chunks if c["course_code"] == it["forbidden_course"]]
                row.update(blocked=blocked, leaked=len(leaked))
                context = []
            row["retrieval_ms"] = round((time.perf_counter() - t0) * 1000)

            if opts["llm"] and it["type"] in ("in_scope", "negative"):
                row.update(self._answer(S, admin, it, context))
            rows.append(row)
            self.stdout.write(f"  {it['id']:8} {self._mark(row)}")

        summary = self._summarise(rows, opts["llm"])
        out = Path(opts["out"])
        out.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        (out / f"rag_eval-{stamp}.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=1, ensure_ascii=False), encoding="utf-8")
        (out / f"rag_eval-{stamp}.md").write_text(self._markdown(summary, rows), encoding="utf-8")

        self.stdout.write("\n" + json.dumps(summary, indent=1))
        failed = [k for k, v in summary["gates"].items() if not v["pass"]]
        if failed:
            self.stdout.write(self.style.ERROR(f"\nBelow threshold: {', '.join(failed)}"))
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS("\nAll gated metrics meet their thresholds."))

    # ------------------------------------------------------------------
    def _answer(self, S, user, it, context):
        from apps.chat.models import AnswerStatus
        from apps.core.ai import chat_options, get_ollama_client

        if not context:
            return {"status": AnswerStatus.NOT_FOUND, "llm_ms": 0}
        msgs = [{"role": "system", "content": S._system_prompt(user)},
                {"role": "user", "content": S.user_turn(it["question"], context)}]
        t0 = time.perf_counter()
        try:
            raw = (get_ollama_client().chat(messages=msgs, **chat_options())["message"]["content"] or "").strip()
        except Exception as exc:
            return {"status": "error", "error": str(exc)[:200], "llm_ms": round((time.perf_counter() - t0) * 1000)}
        llm_ms = round((time.perf_counter() - t0) * 1000)
        status = S.classify(raw)
        raw_refs = [int(x) for x in S._CITE_RE.findall(raw)]
        out_of_range_raw = sum(1 for n in raw_refs if not 1 <= n <= len(context))
        answer, citations = S.finalize_citations(raw, context) if status == AnswerStatus.ANSWERED else (raw, [])
        after = sum(1 for n in S._CITE_RE.findall(answer) if not 1 <= int(n) <= len(context))
        cited = [c for c in citations if c["cited"]]
        res = {"status": status, "llm_ms": llm_ms, "answer": answer, "out_of_range_raw": out_of_range_raw,
               "out_of_range_after": after, "n_cited": len(cited),
               "model_cited": any(1 <= n <= len(context) for n in raw_refs),
               "attributed": any(c.get("attributed") for c in cited)}
        if it["type"] == "in_scope":
            res["cited_expected"] = any(e.lower() in c["document_title"].lower() for e in it["expected_docs"] for c in cited)
            facts = it.get("key_facts", [])
            low = answer.lower()
            res["key_fact_coverage"] = round(sum(1 for f in facts if f in low) / len(facts), 2) if facts else None
        return res

    def _mark(self, r):
        if r["type"] == "in_scope":
            m = f"hit(scoped)={'Y' if r['hit_scoped'] else 'N'} hit(all)={'Y' if r['hit_all'] else 'N'}"
        elif r["type"] == "negative":
            m = f"declined={'Y' if r['declined_by_retrieval'] else 'N'}"
        else:
            m = f"leaked={r['leaked']} blocked={r['blocked']}"
        if "status" in r:
            m += f" answer={r['status']} cited={r.get('n_cited', 0)} {r.get('llm_ms', 0)}ms"
        return m

    def _summarise(self, rows, llm):
        ins = [r for r in rows if r["type"] == "in_scope"]
        neg = [r for r in rows if r["type"] == "negative"]
        perm = [r for r in rows if r["type"] == "permission"]
        s = {
            "dataset": str(DATASET.name), "items": len(rows), "in_scope": len(ins), "negatives": len(neg), "permission": len(perm),
            "model": settings.OLLAMA_LLM_MODEL if llm else None, "embedding_model": settings.EMBEDDING_MODEL_NAME,
            "retrieval_hit_rate_scoped": round(sum(r["hit_scoped"] for r in ins) / len(ins), 3),
            "retrieval_hit_rate_all_courses": round(sum(r["hit_all"] for r in ins) / len(ins), 3),
            "negative_refusal_rate_retrieval": round(sum(r["declined_by_retrieval"] for r in neg) / len(neg), 3),
            "permission_leaks": sum(r["leaked"] for r in perm),
            "retrieval_ms_p50": _pct([r["retrieval_ms"] for r in rows], 0.5),
            "retrieval_ms_p95": _pct([r["retrieval_ms"] for r in rows], 0.95),
            "misses": [r["id"] for r in ins if not r["hit_scoped"]] + [r["id"] for r in neg if not r["declined_by_retrieval"]],
        }
        if llm:
            answered = [r for r in ins if r.get("status") == "answered"]
            s.update(
                answer_rate_in_scope=round(len(answered) / len(ins), 3),
                answer_refusal_rate_negatives=round(sum(r.get("status") == "not_found" for r in neg) / len(neg), 3),
                out_of_range_citations_raw=sum(r.get("out_of_range_raw", 0) for r in rows),
                out_of_range_citations_after_cleanup=sum(r.get("out_of_range_after", 0) for r in rows),
                answers_without_citations=sum(1 for r in answered if not r.get("n_cited")),
                answers_cited_by_model=sum(1 for r in answered if r.get("model_cited")),
                answers_with_wording_matched_sources=sum(1 for r in answered if r.get("attributed")),
                cited_expected_source_rate=round(sum(bool(r.get("cited_expected")) for r in answered) / max(1, len(answered)), 3),
                key_fact_coverage_mean=round(statistics.mean([r["key_fact_coverage"] for r in answered if r.get("key_fact_coverage") is not None] or [0]), 3),
                llm_ms_p50=_pct([r["llm_ms"] for r in rows if r.get("llm_ms")], 0.5),
                llm_ms_p95=_pct([r["llm_ms"] for r in rows if r.get("llm_ms")], 0.95),
                needs_review=[r["id"] for r in answered if (r.get("key_fact_coverage") or 0) < 1 or not r.get("cited_expected")],
            )
        gates = {}
        for key, threshold in THRESHOLDS.items():
            if key not in s:
                continue
            value = s[key]
            ok = value <= threshold if key in ("permission_leaks", "out_of_range_citations_after_cleanup") else value >= threshold
            gates[key] = {"value": value, "threshold": threshold, "pass": ok}
        s["gates"] = gates
        return s

    def _markdown(self, s, rows):
        lines = ["# RAG evaluation", "", f"Dataset: {s['dataset']} · {s['items']} items "
                 f"({s['in_scope']} in-scope, {s['negatives']} negative, {s['permission']} permission)", "",
                 "| Metric | Value | Threshold | Pass |", "|---|---|---|---|"]
        for k, g in s["gates"].items():
            lines.append(f"| {k} | {g['value']} | {g['threshold']} | {'yes' if g['pass'] else 'NO'} |")
        lines += ["", "## Items", ""]
        for r in rows:
            lines.append(f"- **{r['id']}** ({r['type']}) {r['question']} → {self._mark(r)}")
            if r.get("answer"):
                lines.append(f"  > {r['answer'][:400].replace(chr(10), ' ')}")
        return "\n".join(lines) + "\n"
