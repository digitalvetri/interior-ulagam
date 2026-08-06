#!/bin/sh
# Sleeps until the next scheduled hour, runs the backup, repeats.
# A plain loop rather than cron: one process, logs to stdout like every other
# container, and no second supervisor to configure.
set -eu

HOUR="${BACKUP_HOUR_UTC:-19}"   # 19:00 UTC = 00:30 IST
echo "[backup] scheduler up — nightly at ${HOUR}:00 UTC"

while true; do
  NOW_H=$(date -u +%H)
  NOW_M=$(date -u +%M)
  # Seconds until the next occurrence of HOUR:00 UTC
  SECS=$(( ( (10#$HOUR - 10#$NOW_H + 24) % 24 ) * 3600 - 10#$NOW_M * 60 ))
  [ "$SECS" -le 0 ] && SECS=$(( SECS + 86400 ))
  echo "[backup] sleeping ${SECS}s"
  sleep "$SECS"
  /usr/local/bin/run-backup.sh || echo "[backup] run failed — will retry tomorrow"
done
