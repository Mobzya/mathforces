#!/usr/bin/env bash
set -euo pipefail

backup_root="${BACKUP_DIR:-./backups}"
storage_root="${SUBMISSION_STORAGE_DIR:-./storage/submissions}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_root}/${timestamp}"

mkdir -p "${target}"
pg_dump "${DATABASE_URL:?DATABASE_URL is required}" \
  --format=custom \
  --file="${target}/database.dump"

if [[ -d "${storage_root}" ]]; then
  tar -C "${storage_root}" -czf "${target}/submissions.tar.gz" .
fi

find "${backup_root}" -mindepth 1 -maxdepth 1 -type d \
  -mtime "+${BACKUP_RETENTION_DAYS:-14}" -exec rm -rf -- {} +

echo "Backup created: ${target}"
