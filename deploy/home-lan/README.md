# Mulakai on the home server (`mulakai.lan`)

PLAN.md "Studio Network", PR 1. The server, the library and the built client
run in their own Proxmox LXC. Caddy on the proxy CT answers `mulakai.lan`, and
the engines stay on the GPU PC. It is **LAN only**: the API has no auth, so
never port-forward it.

| Piece | Where |
|---|---|
| LXC `mulakai` (CT 108) | `192.168.2.13`, Debian 13, repo at `/opt/mulakai` |
| Database and audio | `/var/lib/mulakai` (`DATA_DIR`), on the LXC's own disk |
| Service | `mulakai.service`, port 3001, config in `/etc/mulakai.env` |
| Name | AdGuard rewrites `*.lan` to the proxy CT, and Caddy has a `mulakai.lan` block |
| Engines | the GPU PC, by URL (`mulakai.env.example`) |

## Auto-deploy

`mulakai-update.timer` runs `update.sh` every 2 minutes. When `origin/main`
has moved and **every CI check on that commit succeeded**, it:

1. checks out the new commit, and runs `npm ci` where a lockfile changed;
2. builds the client beside the live one and swaps it in;
3. restarts `mulakai`, then waits until the server answers.

It only moves forward (main must contain the running commit). A pending CI run is retried on the next tick. A red one is skipped. A failed
build rolls back to the running commit, and that commit is never retried. A
restart drops jobs that are still running, because jobs live only in memory.

```bash
journalctl -u mulakai-update -n 50       # what the updater did
journalctl -u mulakai -f                 # server log
/opt/mulakai/deploy/home-lan/update.sh --force   # redeploy now, CI or not
```

## Setup (once)

On the Proxmox host:

```bash
pct create 108 local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst \
  --hostname mulakai --cores 2 --memory 2048 --swap 512 \
  --rootfs local-lvm:32 --unprivileged 1 --features nesting=1 --onboot 1 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.2.13/24,gw=192.168.2.1
pct start 108
pct exec 108 -- bash -c "apt-get update && apt-get install -y curl git"
pct exec 108 -- bash -c "curl -fsSL https://raw.githubusercontent.com/Dvrkstvr/Mulakai/main/deploy/home-lan/install.sh | bash"
```

Then add this to `/etc/caddy/Caddyfile` on the proxy CT (106), above the
catch-all block, and run `systemctl reload caddy`:

```
http://mulakai.lan {
	reverse_proxy 192.168.2.13:3001
}
```

## Engines

The website and the library work without the GPU PC. Generating needs the
engines in `/etc/mulakai.env` to be reachable from `192.168.2.13`. Each one
must listen on the LAN rather than only on `127.0.0.1`, and Windows Firewall
must let that port in from `192.168.2.13` only. After changing the env file,
run `systemctl restart mulakai`. Waking the GPU PC on demand is PLAN.md
"Studio Network", PRs 2–5.
