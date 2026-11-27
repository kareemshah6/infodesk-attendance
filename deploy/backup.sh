#!/bin/sh
# Daily backup of the attendance database, keeps the last 30 days.
# Add to crontab (sudo crontab -e):  30 23 * * * /opt/infodesk-attendance/deploy/backup.sh
set -e
DB=${DB_PATH:-/var/lib/infodesk/attendance.db}
DIR=${BACKUP_DIR:-/var/backups/infodesk}
mkdir -p "$DIR"
node --disable-warning=ExperimentalWarning -e "new (require('node:sqlite').DatabaseSync)(process.argv[1]).exec(\"VACUUM INTO '\" + process.argv[2] + \"'\")" "$DB" "$DIR/attendance-$(date +%F).db"
find "$DIR" -name 'attendance-*.db' -mtime +30 -delete
