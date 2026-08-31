#!/usr/bin/env bash
# Prvotní příprava serveru jede.online (Hetzner CX23, 178.104.231.220).
# Idempotentní — dá se pustit opakovaně.
#
# ⛔ Tenhle skript patří VÝHRADNĚ na 178.104.231.220. Nikam jinam.
set -euo pipefail

log() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Spusť jako root."; exit 1; }

log "0/6  Kontrola stroje"
ip -4 addr show | grep -q '178\.104\.231\.220' \
  || { echo "STOP: tohle není server jede.online. Nepokračuji."; exit 1; }
. /etc/os-release && echo "OS: $PRETTY_NAME"

log "1/6  Swap 4 GB"
# Bez swapu spadne `next build` na 4 GB RAM na OOM.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
free -h

log "2/6  Firewall (ven jen 22, 80, 443)"
# POZOR: ufw bere PRVNÍ shodu. Default deny se nastavuje politikou,
# ne pravidlem pod ALLOW — takové pravidlo je mrtvé.
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status verbose

log "3/6  Docker + Compose"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  # Docker nemusí mít repo pro čerstvé vydání Ubuntu (server jede na 26.04 LTS).
  # Bez téhle kontroly `apt-get update` spadne na 404 a instalace umře uprostřed.
  CODENAME=$VERSION_CODENAME
  if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release" >/dev/null; then
    echo "Docker repo pro '${CODENAME}' neexistuje, padám zpět na 'noble' (24.04 LTS)."
    CODENAME=noble
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
docker --version && docker compose version

log "4/6  nginx + certbot (na hostu, ne v kontejneru)"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx certbot python3-certbot-nginx
mkdir -p /var/www/certbot /var/www/kasinovsetin
systemctl enable --now nginx

log "5/6  Adresáře projektu"
mkdir -p /opt/jede/{landing,backups,initdb}
chmod 700 /opt/jede/backups

log "6/6  Hotovo"
cat <<'NEXT'
Zbývá ručně:
  1) Hetzner konzole → Backups → Enable (a za pár dní OVĚŘIT, že záloha vznikla)
  2) /opt/jede/.env   — vyplnit podle deploy/.env.example
  3) git clone https://github.com/Skladovac/jede-online.git /opt/jede/landing
  4) cp deploy/nginx/*.conf /etc/nginx/sites-available/ && ln -s do sites-enabled
  5) certbot --nginx -d jede.online -d www.jede.online   (až po přepnutí DNS)
NEXT
