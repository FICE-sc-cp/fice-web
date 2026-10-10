#!/usr/bin/env bash
# Backups for fice-sc.kpi.ua (run by cron on the server).
#   bash ops/backup.sh db [label]   database dump, kept 30 days
#   bash ops/backup.sh uploads      archive of uploaded files, kept 4 weeks
set -euo pipefail

APP_DIR=/home/ubuntu/fice-web
BACKUP_DIR=/home/ubuntu/backups

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
find "$BACKUP_DIR" -name '*.part' -mmin +60 -delete
stamp=$(date +%F-%H%M)

case "${1:-}" in
  db)
    name="fice-$stamp"
    if [ -n "${2:-}" ]; then name="$name-$2"; fi
    file="$BACKUP_DIR/$name.dump"
    docker compose exec -T postgres pg_dump -U postgres -Fc fice > "$file.part"
    mv "$file.part" "$file"
    find "$BACKUP_DIR" -name 'fice-*.dump' -mtime +30 -delete
    ;;
  uploads)
    file="$BACKUP_DIR/uploads-$stamp.tar.gz"
    docker run --rm -v fice-web_fice_uploads:/data:ro -v "$BACKUP_DIR":/backup alpine \
      tar czf "/backup/uploads-$stamp.tar.gz.part" -C /data .
    mv "$file.part" "$file"
    find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +28 -delete
    ;;
  *)
    echo "usage: bash ops/backup.sh db [label] | uploads" >&2
    exit 2
    ;;
esac

echo "$(date '+%F %T') saved $file ($(du -h "$file" | cut -f1))"
