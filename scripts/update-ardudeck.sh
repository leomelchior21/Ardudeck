#!/usr/bin/env bash
#
# Updates an existing ArduDeck installation (in /opt/ardudeck by default).
#
# Steps:
#   1. git pull (if this is a git checkout)
#   2. npm ci && npm run build       (rebuilds the touch UI)
#   3. pip install -r requirements   (updates backend dependencies)
#   4. systemctl restart ardudeck-api
#
# Usage:
#   sudo ./scripts/update-ardudeck.sh [--install-dir /opt/ardudeck] [--no-pull]
#
set -euo pipefail

INSTALL_DIR="${ARDUDECK_INSTALL_DIR:-/opt/ardudeck}"
APP_USER="${ARDUDECK_APP_USER:-ardudeck}"
PULL=1

while [ $# -gt 0 ]; do
  case "$1" in
    --install-dir) shift; INSTALL_DIR="${1:-$INSTALL_DIR}" ;;
    --no-pull) PULL=0 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift || true
done

log() { printf '\033[36m[ardudeck]\033[0m %s\n' "$*"; }

if [ ! -d "$INSTALL_DIR" ]; then
  printf 'Install directory %s does not exist.\n' "$INSTALL_DIR" >&2
  exit 1
fi

if [ "$PULL" -eq 1 ] && [ -d "$INSTALL_DIR/.git" ]; then
  log "Pulling the latest source"
  sudo -u "$APP_USER" -H git -C "$INSTALL_DIR" pull --ff-only
fi

log "Updating Python dependencies"
sudo -u "$APP_USER" "$INSTALL_DIR/services/hardware-api/.venv/bin/python" -m pip install \
  --disable-pip-version-check -q -r "$INSTALL_DIR/services/hardware-api/requirements.txt"

log "Rebuilding the UI"
sudo -u "$APP_USER" env NODE_OPTIONS=--max-old-space-size=768 bash -c \
  "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund && npm run build"

log "Restarting the service"
systemctl restart ardudeck-api
sleep 1
systemctl --no-pager --lines=5 status ardudeck-api || true

log "Update finished."
