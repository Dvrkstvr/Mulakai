#!/usr/bin/env bash
# One-time setup inside a fresh Debian 13 LXC, as root. See README.md.
set -euo pipefail

apt-get update -q
apt-get install -y -q ca-certificates curl git jq ffmpeg build-essential python3
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

id mulakai >/dev/null 2>&1 || useradd --system --home /opt/mulakai --shell /usr/sbin/nologin mulakai
install -d -o mulakai -g mulakai /var/lib/mulakai
[ -d /opt/mulakai/.git ] || { install -d -o mulakai -g mulakai /opt/mulakai;
  runuser -u mulakai -- git clone -q https://github.com/Dvrkstvr/Mulakai.git /opt/mulakai; }
[ -f /etc/mulakai.env ] || install -m 640 -g mulakai /opt/mulakai/deploy/home-lan/mulakai.env.example /etc/mulakai.env

cp /opt/mulakai/deploy/home-lan/mulakai{,-update}.service /opt/mulakai/deploy/home-lan/mulakai-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable mulakai mulakai-update.timer
/opt/mulakai/deploy/home-lan/update.sh --force
systemctl start mulakai-update.timer
