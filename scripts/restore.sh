#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

project_name=${COMPOSE_PROJECT_NAME:-sparasaljslang}

if [ "$#" -ne 1 ]; then
  printf 'Usage: CONFIRM_RESTORE=%s %s <backup-directory>\n' "$project_name" "$0" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "$project_name" ]; then
  printf 'Refusing to restore. Set CONFIRM_RESTORE=%s to replace persistent data.\n' "$project_name" >&2
  exit 1
fi

backup_dir=$(CDPATH= cd -- "$1" && pwd)

for volume in "${project_name}_app-data" "${project_name}_app-uploads"; do
  archive="$backup_dir/${volume}.tar.gz"
  if [ ! -f "$archive" ]; then
    printf 'Missing backup archive: %s\n' "$archive" >&2
    exit 1
  fi
  docker volume inspect "$volume" >/dev/null
done

restart_app() {
  docker compose start app >/dev/null
}

trap restart_app EXIT
trap 'restart_app; exit 1' INT TERM

docker compose stop app

for volume in "${project_name}_app-data" "${project_name}_app-uploads"; do
  archive="${volume}.tar.gz"
  docker run --rm \
    -v "${volume}:/target" \
    -v "${backup_dir}:/backup:ro" \
    alpine \
    sh -ec 'rm -rf /target/* /target/.[!.]* /target/..?* && tar xzf "/backup/$1" -C /target' sh "$archive"
done

trap - EXIT INT TERM
restart_app
printf 'Restore completed from %s\n' "$backup_dir"
