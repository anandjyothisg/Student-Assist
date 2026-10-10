# Backup and restore

AuraStudy keeps state in three places. A usable backup needs the first two. The third can be rebuilt.

| What | Where | If lost |
|---|---|---|
| Database: users, courses, document records, chats, notebooks | SQLite file (dev) or PostgreSQL (production) | Everything is lost. **Back up.** |
| Uploaded files | `MEDIA_ROOT` (`server/media/`) | Documents can't be downloaded or re-indexed. **Back up.** |
| Vector store | `CHROMA_DB_PATH` (`server/chroma_db/`) | Search stops until it's rebuilt with `index_documents --rebuild` (about a minute per 50 documents on CPU) |

## Taking a backup

```bash
cd server/src
python manage.py backup_data --out /var/backups/aurastudy
```

This writes `/var/backups/aurastudy/<timestamp>/` containing:
- `db.sqlite3` (SQLite only: an online, consistent copy, safe while the app runs)
- `media/`
- `chroma_db/` (pass `--skip-vectors` to leave it out)
- `manifest.json`, with record counts and the embedding model, used to verify a restore

**PostgreSQL.** The command does not copy the database. Run `pg_dump` alongside it:

```bash
pg_dump -Fc -h $DB_HOST -U $DB_USER -f /var/backups/aurastudy/<timestamp>/db.dump $DB_NAME
```

**Vector store consistency.** It is copied as files. For a guaranteed-consistent copy, take it while no document is being indexed, or rebuild it after restoring.

**Schedule and retention.** Back up at least daily, plus before every upgrade. Keep copies off the server and test a restore regularly. Backups contain student data: store them encrypted, with the same access restrictions as production.

**Windows paths.** Keep the backup directory short (for example `D:\backups\aurastudy`). Course folders and file names can exceed the 260-character path limit under deep folders.

## Restoring

1. Stop gunicorn and any Celery worker.
2. Restore the database:
   - **SQLite:** copy `db.sqlite3` over the configured database file.
   - **PostgreSQL:** run `pg_restore --clean -d $DB_NAME db.dump`.
3. Replace `MEDIA_ROOT` with the backup's `media/`.
4. Restore the vectors: replace `CHROMA_DB_PATH` with `chroma_db/`. Alternatively, skip this step and run `python manage.py index_documents --rebuild`.
5. Run `python manage.py migrate` (a no-op when the backup came from the same version).
6. Verify:
   - `python manage.py index_documents --reconcile` should report no drift.
   - `python manage.py rag_eval` should pass its gates.
   - `/readyz` should be `ok`.
7. Start the services.

### Verifying a backup without touching production

Development settings accept overrides, so a backup can be opened in place:

```bash
SQLITE_PATH=/path/backup/db.sqlite3 MEDIA_ROOT=/path/backup/media CHROMA_DB_PATH=/path/backup/chroma_db \
  python manage.py index_documents --reconcile
```

This exact round trip was run on 2026-10-09 against the demo data:
- The counts matched the manifest: 29 users, 6 courses, 52 documents, 483 chunks and 100 chat messages.
- Every sampled file was present.
- Retrieval from the restored vectors returned the expected source.

## Demo data is not backup

`seed_demo --reset` backs up and then **erases** the SQLite dev database. It refuses to run in production or against PostgreSQL. Never use it as a restore mechanism.
