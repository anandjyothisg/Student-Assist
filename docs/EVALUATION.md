# Assistant evaluation

`python manage.py rag_eval [--llm]` scores the assistant against `server/src/apps/chat/eval/dataset.jsonl`. The command exits non-zero when a gated metric misses its threshold. Each run writes a JSON and Markdown report to `server/eval_reports/` (git-ignored).

## Dataset (52 items)

| Type | Count | What is checked |
|---|---|---|
| In-scope | 36, six per course across all six demo courses | The expected source document(s) and key facts were confirmed against `server/demo_content` before the first run |
| Negative | 10 | Off-syllabus questions that must be declined. Two are deliberate near misses: red-black tree recolouring and transformer self-attention, which each course mentions only in passing |
| Permission | 6 | The demo student asks about Operating Systems, a course they aren't enrolled in. No passage from that course may be returned |

## Method

**Retrieval (deterministic, no LLM).** Uses the production `retrieve()` and `covers_question()` path.
- *Hit*: an expected document is among the passages the answer would be built from. Measured scoped to the course and across all courses.
- *Declined*: retrieval or the coverage guard returns nothing.
- *Leak*: the student receives a passage from a course they can't read.

**Answers (`--llm`).** Uses the production prompt (`_system_prompt`, `user_turn`) and post-processing (`classify`, `finalize_citations`). It records:
- refusals and answers
- citations that point at a passage, before and after server clean-up
- whether the answer was cited by the model or matched by wording
- whether a cited passage comes from an expected document
- a key-fact coverage heuristic
- latency

**Thresholds, fixed in code before the first run:**

| Metric | Threshold |
|---|---|
| Retrieval hit rate, course-scoped | ≥ 0.90 |
| Retrieval hit rate, all courses | ≥ 0.85 |
| Negatives declined at retrieval | ≥ 0.80 |
| Permission leaks | 0 |
| Negatives refused in the final answer | 1.00 |
| In-scope questions answered | ≥ 0.85 |
| Out-of-range citations after clean-up | 0 |
| Answers citing an expected source | ≥ 0.80 |

Key-fact coverage is a substring heuristic, so it is reported but not gated. Every answer it flags is read by a person.

## Results, 2026-10-09

Setup: llama3.2 (3B) via Ollama with BAAI/bge-small-en-v1.5 embeddings, on a CPU-only Windows laptop with the model warm.

| Metric | Run 1 | Run 2 (after fix) | Threshold |
|---|---|---|---|
| Retrieval hit rate, scoped | 1.00 (36/36) | 1.00 | 0.90 |
| Retrieval hit rate, all courses | 1.00 | 1.00 | 0.85 |
| Negatives declined at retrieval | 0.90 (9/10) | 0.90 | 0.80 |
| Permission leaks | 0 | 0 | 0 |
| Negatives refused in the final answer | 1.00 (10/10) | 1.00 | 1.00 |
| In-scope answered | 1.00 | 1.00 | 0.85 |
| Out-of-range citations (raw → after clean-up) | 0 → 0 | 2 → 0 | 0 |
| Answers with no citation at all | 11/36 | 0/36 | reported |
| Answers cited by the model itself | 25/36 | 35/36 | reported |
| Answers using wording-matched sources | n/a | 1/36 | reported |
| **Answers citing an expected source** | **0.69 (fail)** | **0.97** | 0.80 |
| Key-fact coverage (mean) | 0.91 | 0.87 | reported |
| Retrieval latency p50 / p95 | 181 / 375 ms | similar | reported |
| Model latency p50 / p95 | 7.1 / 18.7 s | 7.2 / 11.2 s | reported |

**What changed between runs:**
1. The citation rule is now repeated in the user turn, which small models follow more reliably.
2. A labelled fallback was added. When an answer arrives with no citations, a sentence gets a source only when it shares substantial, distinctive wording with one passage. Those sources are flagged `attributed` and shown in the UI as "matched to the answer's wording (the AI didn't cite them itself)". They are never presented as the model's own citations.

**The near-miss negative** (neg-10, red-black tree recolouring) passed retrieval. The model then declined it correctly.

## Human review of flagged answers (run 2)

Six answers were flagged by the heuristic. All six were read against the cited passages.

| Item | Verdict |
|---|---|
| os-1 process vs thread | Correct. It says "memory image" rather than "address space". |
| db-5 why B+ trees | Correct. |
| ml-1 linear regression cost | Correct. It gives the squared-error formula, not the word "squared". |
| os-5 semaphores | Mostly correct. One weak sentence about starvation. |
| **os-3 four deadlock conditions** | **Incomplete.** It lists 2 of 4 conditions without saying so. |
| **ml-2 learning rate too large** | **Incorrect.** It says the model "overfits", where the notes say training diverges or oscillates. It also cited the wrong passage. |

The other 30 answers passed the automated checks but were not individually reviewed.

**Conclusion.** Retrieval, scoping, refusals and citation integrity meet their gates. Answer *correctness* is limited by the 3B model: at least 2 of 36 answers were wrong or incomplete despite good retrieval. A larger model, or a verification pass, is the main lever.

Do not present the assistant as always correct. The UI already tells students to check the cited sources.

## Reproducing

```bash
cd server/src
python manage.py rag_eval          # about 15 s, no model needed
python manage.py rag_eval --llm    # about 6-10 min on CPU with llama3.2
```
