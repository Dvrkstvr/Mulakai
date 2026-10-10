#!/usr/bin/env bash
# Redeploys Mulakai when origin/main has moved and every CI check on that commit
# succeeded. Run by mulakai-update.timer as root; `update.sh --force` skips both
# checks (first install, or a manual redeploy). A failed build rolls back to the
# running commit, and that commit is not tried again.
#
# Everything sits in main(): bash reads a script as it runs, and the git reset
# below rewrites this file.
set -uo pipefail

REPO=/opt/mulakai
GH_REPO=Dvrkstvr/Mulakai
STATE=/var/lib/mulakai-update
PORT=$(sed -n 's/^PORT=//p' /etc/mulakai.env 2>/dev/null); PORT=${PORT:-3001}

as_app() { runuser -u mulakai -- "$@"; }
log() { echo "mulakai-update: $*"; }

ci_state() {
  curl -fsS -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$GH_REPO/commits/$1/check-runs?per_page=100" |
    jq -r 'if .total_count == 0 then "pending"
      elif any(.check_runs[]; .status != "completed") then "pending"
      elif all(.check_runs[]; .conclusion == "success" or .conclusion == "skipped" or .conclusion == "neutral") then "green"
      else "red" end'
}

# Checks out $2 and builds it. Each step returns on failure (set -e does not apply
# to a function called from an if).
deploy() {
  local from=$1 to=$2 dir
  as_app git reset -q --hard "$to" || return 1
  for dir in server client; do
    if [ ! -d "$dir/node_modules" ] || ! as_app git diff --quiet "$from" "$to" -- "$dir/package-lock.json"; then
      (cd "$dir" && as_app npm ci --no-audit --no-fund) || return 1
    fi
  done
  # Build beside the live dist, then swap, so a failed build never serves a half-written one.
  (cd client && as_app npx tsc -b && as_app npx vite build --outDir dist.next --emptyOutDir --logLevel warn) || return 1
  rm -rf client/dist.prev
  if [ -d client/dist ]; then mv client/dist client/dist.prev || return 1; fi
  mv client/dist.next client/dist
}

main() {
  local force=${1:-} cur new ci
  mkdir -p "$STATE"
  cd "$REPO" || exit 1
  as_app git fetch -q origin main || { log "fetch failed"; exit 1; }
  cur=$(as_app git rev-parse HEAD)
  new=$(as_app git rev-parse origin/main)

  if [ "$force" != --force ]; then
    [ "$new" = "$cur" ] && exit 0
    [ "$(cat "$STATE/failed" 2>/dev/null)" = "$new" ] && exit 0
    # Only move forward: a running commit that main does not contain (a branch, a
    # force-push) is left alone until main catches up with it.
    as_app git merge-base --is-ancestor "$cur" "$new" || exit 0
    ci=$(ci_state "$new") || { log "could not read CI for ${new:0:7}"; exit 0; }
    case "$ci" in
      green) ;;
      pending) log "${new:0:7}: CI still running"; exit 0 ;;
      *) log "${new:0:7}: CI not green, skipping"; echo "$new" > "$STATE/failed"; exit 0 ;;
    esac
  fi

  log "deploying ${cur:0:7} -> ${new:0:7}"
  if ! deploy "$cur" "$new"; then
    log "${new:0:7}: build failed, rolling back to ${cur:0:7}"
    echo "$new" > "$STATE/failed"
    deploy "$new" "$cur" || log "rollback build failed too"
    exit 1
  fi
  # A restart drops jobs still running: they live only in memory.
  systemctl restart mulakai
  for _ in $(seq 60); do
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && { log "live at ${new:0:7}"; exit 0; }
    sleep 1
  done
  log "server did not answer after restart"; exit 1
}

main "$@"
exit
