#!/usr/bin/env bash
# Redeploys Mulakai when origin/main has moved and every CI check on that commit
# succeeded. Run by mulakai-update.timer as root; `update.sh --force` skips both
# checks (first install, or a manual redeploy). A failed build rolls back to the
# running commit, and that commit is not tried again.
set -euo pipefail

REPO=/opt/mulakai
GH_REPO=Dvrkstvr/Mulakai
STATE=/var/lib/mulakai-update
FORCE=${1:-}
mkdir -p "$STATE"
as_app() { runuser -u mulakai -- "$@"; }
log() { echo "mulakai-update: $*"; }

cd "$REPO"
as_app git fetch -q origin main
cur=$(git rev-parse HEAD)
new=$(git rev-parse origin/main)

if [ "$FORCE" != --force ]; then
  [ "$new" = "$cur" ] && exit 0
  [ "$(cat "$STATE/failed" 2>/dev/null)" = "$new" ] && exit 0
  # Every check run on the commit must be completed and green; anything pending waits.
  ci=$(curl -fsS -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$GH_REPO/commits/$new/check-runs?per_page=100" |
    jq -r 'if .total_count == 0 then "pending"
      elif any(.check_runs[]; .status != "completed") then "pending"
      elif all(.check_runs[]; .conclusion == "success" or .conclusion == "skipped" or .conclusion == "neutral") then "green"
      else "red" end')
  case "$ci" in
    pending) log "${new:0:7}: CI still running"; exit 0 ;;
    red) log "${new:0:7}: CI not green, skipping"; echo "$new" > "$STATE/failed"; exit 0 ;;
  esac
fi

deploy() {
  local from=$1 to=$2
  as_app git reset -q --hard "$to"
  for dir in server client; do
    if [ ! -d "$dir/node_modules" ] || ! git diff --quiet "$from" "$to" -- "$dir/package-lock.json"; then
      (cd "$dir" && as_app npm ci --no-audit --no-fund)
    fi
  done
  # Build beside the live dist, then swap, so a failed build never serves a half-written one.
  (cd client && as_app npx tsc -b && as_app npx vite build --outDir dist.next --emptyOutDir --logLevel warn)
  rm -rf client/dist.prev
  [ -d client/dist ] && mv client/dist client/dist.prev
  mv client/dist.next client/dist
}

log "deploying ${cur:0:7} -> ${new:0:7}"
if ! deploy "$cur" "$new"; then
  log "${new:0:7}: build failed, rolling back to ${cur:0:7}"
  echo "$new" > "$STATE/failed"
  deploy "$new" "$cur" || log "rollback build failed too"
  exit 1
fi
# A restart drops jobs still running: they live only in memory.
systemctl restart mulakai
for _ in $(seq 30); do
  curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3001}/" && { log "live at ${new:0:7}"; exit 0; }
  sleep 1
done
log "server did not answer after restart"; exit 1
