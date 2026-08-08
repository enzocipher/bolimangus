#!/bin/sh
set -eu

backup_root=/var/backups/bolimangus
source_root=/var/lib/bolimangus
timestamp=$(date -u +%Y%m%dT%H%M%SZ)

umask 077
mkdir -p "$backup_root"
tar --create --gzip \
  --file="$backup_root/bolimangus-$timestamp.tar.gz" \
  --directory="$source_root" \
  data uploads

find "$backup_root" -type f -name 'bolimangus-*.tar.gz' -mtime +14 -delete
