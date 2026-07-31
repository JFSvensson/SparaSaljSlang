#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

backup_dir=${1:-"$project_dir/backups/$(date +%Y%m%d-%H%M%S)"}
project_name=${COMPOSE_PROJECT_NAME:-sparasaljslang}

mkdir -p "$backup_dir"
backup_dir=$(CDPATH= cd -- "$backup_dir" && pwd)

restart_app() {
  docker compose start app >/dev/null
}

trap restart_app EXIT
trap 'restart_app; exit 1' INT TERM

docker compose stop app

for volume in "${project_name}_app-data" "${project_name}_app-uploads"; do
  docker volume inspect "$volume" >/dev/null
  docker run --rm \
    -v "${volume}:/source:ro" \
    -v "${backup_dir}:/backup" \
    alpine \
    tar czf "/backup/${volume}.tar.gz" -C /source .
done

trap - EXIT INT TERM
restart_app
printf 'Backup created in %s\n' "$backup_dir"
