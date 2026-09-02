#!/bin/sh
set -e

mkdir -p storage

# Idempotent — brings an existing database's schema up to date with whatever
# columns the current models expect. Safe on a brand-new volume too (it just
# skips tables that don't exist yet; create_all builds those fresh below).
python scripts/migrate_answer_schema.py

# Seed the question bank and build the RAG index once — subsequent
# container restarts skip this as long as the storage volume persists.
if [ ! -f storage/.seeded ]; then
  echo "First run: seeding question bank and building the RAG index..."
  python scripts/seed_questions.py
  python scripts/build_index.py
  touch storage/.seeded
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
