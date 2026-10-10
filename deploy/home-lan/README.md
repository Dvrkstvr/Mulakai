# Mulakai on the home server (`mulakai.lan`)

PLAN.md "Studio Network", PR 1. The server, the library and the built client
run in their own Proxmox LXC. Caddy on the proxy CT answers `mulakai.lan`, and
the engines stay on the GPU PC. It is **LAN only**: the API has no auth, so
never port-forward it.

| Piece | Where |
|---|---|
| LXC `mulakai` (CT 108) | `192.168.2.13`, Debian 13, repo at `/opt/mulakai` |
| Database | `/var/lib/mulakai` (`DATA_DIR`), on the LXC's own disk; SQLite never goes on a share |
| Audio | host `/mnt/pve/disk-storage/mulakai/audio`, bind-mounted at `/srv/mulakai-audio` (`AUDIO_DIR`) |
| Service | `mulakai.service`, port 3001, config in `/etc/mulakai.env` |
| Name | AdGuard rewrites `*.lan` to the proxy CT, and Caddy has a `mulakai.lan` block |
| Engines | the GPU PC, by URL (`mulakai.env.example`) |

## Auto-deploy

`mulakai-update.timer` runs `update.sh` every 2 minutes. When `origin/main`
has moved and **every CI check on that commit succeeded**, it:

1. checks out the new commit, and runs `npm ci` where a lockfile changed;
2. builds the client beside the live one and swaps it in;
3. restarts `mulakai`, then waits until the server answers.

It never restarts while a job runs or is queued, because jobs live only in
the server's memory and a restart would lose them. It starts a deploy only
when the queue is empty, and after the build it waits for the queue to empty
again. It only moves forward: `main` must contain the running commit. A
pending CI run is retried on the next tick, and a red one is skipped. A failed
build rolls back to the running commit, and that commit is never retried.

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

Give the audio its own folder on the data disk. CT 108 is unprivileged, so
its `mulakai` user (uid 999, gid 991) is 100999:100991 on the host:

```bash
mkdir -p /mnt/pve/disk-storage/mulakai/audio
chown -R 100999:100991 /mnt/pve/disk-storage/mulakai
pct set 108 -mp0 /mnt/pve/disk-storage/mulakai/audio,mp=/srv/mulakai-audio
pct reboot 108
```

Then set `AUDIO_DIR=/srv/mulakai-audio` in `/etc/mulakai.env`.

Then add this to `/etc/caddy/Caddyfile` on the proxy CT (106), above the
catch-all block, and run `systemctl reload caddy`:

```
http://mulakai.lan {
	reverse_proxy 192.168.2.13:3001
}
```

## Engines

The website and the library work without the GPU PC. Generating needs the
engines in `/etc/mulakai.env` to be reachable from `192.168.2.13`. The GPU PC
serves this server and its own local stack at the same time.

On the GPU PC, run this once in an elevated PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\home-lan\gpu-pc-lan.ps1
```

It sets three things:
- **Windows Firewall** lets TCP 8001, 8002, 8004, 8005 and 11434 in from
  `192.168.2.13` only. Ollama, Demucs and lyrics-server have no key, so this
  rule is what keeps the rest of the LAN out.
- **WSL** switches to mirrored networking, so YuE2 answers on the PC's LAN
  address. A Hyper-V firewall rule lets port 8004 in from the server only.
- **`ENGINE_HOST=0.0.0.0`** for your user. `start-all.bat` then binds every
  engine to `0.0.0.0`, which answers on `127.0.0.1` as well. Without the
  variable, the engines stay on `127.0.0.1` as before.

Then run `wsl --shutdown`, quit Ollama from the tray, close the engine
windows, and run `start-all.bat` again. Give the PC a DHCP reservation in the
router so it keeps `192.168.2.42`.

Waking the GPU PC on demand is PLAN.md "Studio Network", PRs 2–5.
