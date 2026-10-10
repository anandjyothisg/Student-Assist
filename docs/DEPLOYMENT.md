# Deploying AuraStudy

This guide covers a **single-server** deployment. It is what the current architecture supports. The last section lists what has to change before running more than one application server.

## What runs where

```
browser ── https ──► nginx ─┬─ /            → client/dist (static files)
                            ├─ /api/, /admin/, /healthz, /readyz → gunicorn (Django)
                            └─ /media/avatars/, /media/course_thumbnails/ → disk (public)
gunicorn ─► PostgreSQL
         ─► Chroma (embedded, on local disk: CHROMA_DB_PATH)
         ─► Ollama (http://localhost:11434, llama3.2)
         ─► sentence-transformers model (local cache)
optional: Redis + celery worker (document indexing off the web process)
```

- **Course documents** live under `MEDIA_ROOT/documents/`. They are private and must **never** be served by nginx. Django serves them only through `/api/v1/documents/{id}/download/`, after a permission check. Expose only `media/avatars/` and `media/course_thumbnails/`, or let Django's `/media/` view serve those two folders.
- **The web app** calls the API on the same origin: `client/.env.production` leaves `VITE_API_URL` empty. To host it elsewhere, set `VITE_API_URL=https://api.example.edu` at build time and add that origin to `CORS_ALLOWED_ORIGINS`.

### Variant: web app on Cloudflare Pages, API on its own host

`client/public/_headers` already sets the basic security headers for Pages. To deploy:

1. **API location.** Set `VITE_API_URL=https://api.<your domain>` in Pages → Settings → Environment variables, then rebuild.
2. **API host settings:**
   - `CORS_ALLOWED_ORIGINS=https://<your pages domain>`
   - `CSRF_TRUSTED_ORIGINS`, the same value
   - `DJANGO_ALLOWED_HOSTS=api.<your domain>`
3. **Auth.** Tokens are sent in the `Authorization` header, not cookies, so cross-origin sessions need no cookie settings.
4. **Content-Security-Policy.** Add one to `_headers` once the API origin is known. It needs:
   - `connect-src 'self' https://api.<your domain>`
   - `font-src https://fonts.gstatic.com`
   - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
   - `img-src 'self' data:`
   - a `script-src 'self' 'sha256-…'` hash for the small inline theme script in `index.html`. Compute it from the built file.

   Test in report-only mode (`Content-Security-Policy-Report-Only`) before enforcing.

## Prerequisites

- Python 3.12, Node 20+, PostgreSQL 15+
- Ollama, with the model pulled: `ollama pull llama3.2`
- Optional: Redis 7, if indexing runs on a Celery worker

## Environment

Copy `server/.env.example` to `server/.env` and set at least:

| Variable | Production value |
|---|---|
| `DJANGO_ENV` | `production` (the development settings refuse to start with a public host) |
| `DJANGO_SECRET_KEY` | a fresh random key, kept out of version control |
| `DJANGO_ALLOWED_HOSTS` | the public host name(s) |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | `https://<your host>` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` | the PostgreSQL connection |
| `SECURE_SSL_REDIRECT` | `True` |
| `TRUST_X_FORWARDED_PROTO` | `true` behind nginx, which must set `X-Forwarded-Proto` |
| `EMAIL_*` | SMTP credentials; password-reset codes are sent by email |
| `CHROMA_DB_PATH` | an absolute path on persistent storage |
| `ENABLE_API_DOCS`, `ENABLE_LEGACY_ASSISTANT_API` | leave `false` |

`wsgi.py`, `asgi.py`, `manage.py` and `celery.py` all select their settings from `DJANGO_ENV`. Check that the configuration loads with:

```
DJANGO_ENV=production python manage.py check --deploy
```

## First deployment

```bash
cd server
python -m venv .venv && .venv/bin/pip install -r requirements/prod.txt
cd src
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser             # your real administrator
python -c "from sentence_transformers import SentenceTransformer as S; S('BAAI/bge-small-en-v1.5')"  # cache the embedding model
# then set HF_HUB_OFFLINE=1 so the server never reaches out to the model hub
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 300

cd ../../client && npm ci && npm run build   # outputs client/dist
```

**Do not run `seed_demo` in production.** It refuses to run outside a development or demo environment, because it creates accounts with published passwords.

### Worker timeouts and streaming

Answers stream over server-sent events and can take a minute on a CPU-only model. Make sure these settings allow for that:
- gunicorn: `--timeout`
- nginx: `proxy_read_timeout`
- nginx: `proxy_buffering off` for `/api/chat/ask/stream/`

Each answer is capped by `OLLAMA_ANSWER_DEADLINE` (default 240 s).

### Document indexing

`DOCUMENT_PROCESSING_MODE=auto` uses Celery only when a worker answers a ping. Otherwise it indexes in a background thread inside the web process.
- **Thread mode:** jobs interrupted by a restart are marked *Failed (interrupted)* after `DOCUMENT_STALE_MINUTES`, and teachers can retry them.
- **Celery:** for steady use, run a worker:

  ```
  celery -A config worker -l info --concurrency 1
  ```

  One worker per server: the embedder is CPU-heavy.

## Health checks

- `GET /healthz` checks that the process answers. Use it for liveness.
- `GET /readyz` returns 503 only when the database is down. It reports the vector store and the language model as `ok` or `degraded`. Without the model, the assistant still shows the matching passages.
- The admin **Status** page shows live counts, model state and index signatures.

Each response carries an `X-Request-ID` header, and the same id appears on every log line written for that request.

## Upgrades

1. Back up (see `BACKUP_RESTORE.md`).
2. Install the requirements, `migrate`, `collectstatic`, then restart gunicorn and the worker.
3. **If `EMBEDDING_MODEL_NAME` changed**, run `python manage.py index_documents --rebuild`. Searches refuse collections built with another model rather than returning wrong passages.
4. Check retrieval quality with `python manage.py rag_eval`. It exits non-zero below the thresholds.

## Known limits of this architecture

| Concern | Today | Needed for multiple app servers |
|---|---|---|
| Uploaded files | local disk (`MEDIA_ROOT`) | shared or object storage (S3-compatible) through `STORAGES["default"]` |
| Vector store | embedded Chroma on local disk, one writer | a Chroma server or pgvector |
| Rate limits | the Django cache; in-memory in development | Redis cache (`REDIS_URL`), shared by all workers |
| Indexing | one process or worker | a Celery worker pool with a shared broker |
| Language model | one local Ollama | a sized GPU host or a hosted model, plus capacity planning |
| Sessions | JWT in browser `localStorage` | consider httpOnly cookies plus CSRF if your threat model requires it |

The vector store is also a **dependency risk**. chromadb 1.0.20 has published advisories with no fixed release. They concern Chroma's HTTP server and auth modes, which this deployment does not use: it is embedded and never network-exposed. Keep it that way, and recheck with `pip-audit`.
