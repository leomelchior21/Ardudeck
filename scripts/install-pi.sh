#!/usr/bin/env bash
#
# ArduDeck installer for Raspberry Pi OS
# =====================================
#
# What this script changes on your Raspberry Pi (nothing is hidden):
#
#   1. Installs apt packages: python3-venv, python3-pip, git, curl, rsync,
#      chromium, unclutter (cursor hiding), nodejs, npm.
#   2. Installs the Arduino CLI into /usr/local/bin and the Arduino AVR core
#      (see scripts/setup-arduino-cli.sh). Requires internet the first time.
#   3. Creates a system user "ardudeck" (no login shell) in the dialout group
#      so it can use the Arduino USB serial port.
#   4. Copies this repository to /opt/ardudeck (unless it is already there).
#   5. Creates a Python virtual environment and installs the backend
#      dependencies from requirements.txt / requirements-dev.txt.
#   6. Builds the touch UI (npm ci && npm run build) into apps/ui/dist.
#   7. Installs the systemd service ardudeck-api (port 8080, serves UI + API).
#   8. Adds a sudoers rule that lets the service restart itself - the only
#      privileged action ArduDeck performs (used by Teacher Mode).
#   9. Configures the Chromium kiosk autostart for the desktop user
#      (scripts/setup-kiosk.sh). Skip with --no-kiosk.
#
# SSH is never touched: you can always log in for maintenance.
#
# Usage:
#   sudo ./scripts/install-pi.sh [--no-kiosk] [--skip-build] [--dry-run]
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="${ARDUDECK_INSTALL_DIR:-/opt/ardudeck}"
APP_USER="ardudeck"
DATA_DIR="/var/lib/ardudeck"
LOG_DIR="/var/log/ardudeck"
SERVICE_NAME="ardudeck-api"
KIOSK=1
SKIP_BUILD=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --no-kiosk) KIOSK=0 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[36m[ardudeck]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[ardudeck]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[ardudeck]\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  would run: %s\n' "$*"
  else
    "$@"
  fi
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "Run this script with sudo: sudo ./scripts/install-pi.sh"
  fi
}

require_pi() {
  if ! grep -qi 'raspberry\|bcm2\|aarch64\|armv7' /proc/cpuinfo 2>/dev/null; then
    warn "This does not look like a Raspberry Pi. Continuing anyway."
  fi
}

desktop_user() {
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    printf '%s' "$SUDO_USER"
  elif id -u pi >/dev/null 2>&1; then
    printf 'pi'
  else
    printf ''
  fi
}

install_packages() {
  log "Installing system packages"
  run apt-get update -qq
  run apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip python3-dev \
    git curl rsync ca-certificates \
    unclutter \
    nodejs npm
  # The browser package is "chromium" on Bookworm and "chromium-browser" before that.
  if ! run apt-get install -y --no-install-recommends chromium; then
    warn "package 'chromium' not available, trying 'chromium-browser'"
    run apt-get install -y --no-install-recommends chromium-browser
  fi
}

normalize_scripts() {
  # Cloning on Windows can leave CRLF endings behind; bash needs LF.
  if [ "$DRY_RUN" -eq 0 ]; then
    find "$REPO_DIR/scripts" -name '*.sh' -type f -exec sed -i 's/\r$//' {} + 2>/dev/null || true
  fi
}

install_arduino_cli() {
  log "Installing Arduino CLI"
  run bash "$REPO_DIR/scripts/setup-arduino-cli.sh"
}

create_user() {
  if id -u "$APP_USER" >/dev/null 2>&1; then
    log "System user $APP_USER already exists"
  else
    log "Creating system user $APP_USER"
    run useradd --system --create-home --home-dir "$DATA_DIR/home" --shell /usr/sbin/nologin "$APP_USER"
  fi
  run usermod -aG dialout "$APP_USER" || true
  run install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$DATA_DIR"
  run install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$LOG_DIR"
  run install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$DATA_DIR/home"
}

copy_repo() {
  if [ "$REPO_DIR" = "$INSTALL_DIR" ]; then
    log "Repository already installed in $INSTALL_DIR"
  else
    log "Copying repository to $INSTALL_DIR"
    run install -d "$INSTALL_DIR"
    # apps/ui/dist is kept on purpose: a UI built on a development machine means
    # the Pi does not have to run npm at all (set ARDUDECK_FORCE_BUILD=1 to rebuild).
    run rsync -a --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.venv' \
      --exclude 'data' \
      --exclude 'logs' \
      "$REPO_DIR/" "$INSTALL_DIR/"
  fi
  run chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
}

install_python_deps() {
  log "Creating the Python environment"
  run sudo -u "$APP_USER" python3 -m venv "$INSTALL_DIR/services/hardware-api/.venv"
  run sudo -u "$APP_USER" "$INSTALL_DIR/services/hardware-api/.venv/bin/python" -m pip install --disable-pip-version-check -q --upgrade pip
  run sudo -u "$APP_USER" "$INSTALL_DIR/services/hardware-api/.venv/bin/python" -m pip install --disable-pip-version-check -q -r "$INSTALL_DIR/services/hardware-api/requirements.txt"
}

build_ui() {
  if [ "$SKIP_BUILD" -eq 1 ]; then
    warn "Skipping the UI build (--skip-build)"
    return
  fi
  if [ -f "$INSTALL_DIR/apps/ui/dist/index.html" ] && [ "${ARDUDECK_FORCE_BUILD:-0}" != "1" ]; then
    log "UI is already built (set ARDUDECK_FORCE_BUILD=1 to rebuild)"
    return
  fi
  log "Building the touch UI (this can take a few minutes on a Pi 3)"
  run sudo -u "$APP_USER" env NODE_OPTIONS=--max-old-space-size=768 bash -c \
    "cd '$INSTALL_DIR' && npm ci --no-audit --no-fund && npm run build"
}

install_service() {
  log "Installing the $SERVICE_NAME systemd service"
  local unit_source="$INSTALL_DIR/systemd/$SERVICE_NAME.service"
  local unit_target="/etc/systemd/system/$SERVICE_NAME.service"
  run sed \
    -e "s|@INSTALL_DIR@|$INSTALL_DIR|g" \
    -e "s|@APP_USER@|$APP_USER|g" \
    -e "s|@DATA_DIR@|$DATA_DIR|g" \
    -e "s|@LOG_DIR@|$LOG_DIR|g" \
    "$unit_source" > "/tmp/$SERVICE_NAME.service"
  run install -m 0644 "/tmp/$SERVICE_NAME.service" "$unit_target"
  run systemctl daemon-reload
  run systemctl enable "$SERVICE_NAME"
  run systemctl restart "$SERVICE_NAME"
}

install_sudoers() {
  log "Allowing the service to restart itself (Teacher Mode button)"
  local rule="$APP_USER ALL=(root) NOPASSWD: /bin/systemctl restart $SERVICE_NAME.service, /bin/systemctl restart $SERVICE_NAME"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  would write /etc/sudoers.d/ardudeck:\n  %s\n' "$rule"
    return
  fi
  printf '%s\n' "$rule" > /etc/sudoers.d/ardudeck
  chmod 0440 /etc/sudoers.d/ardudeck
  visudo -c >/dev/null
}

setup_kiosk() {
  if [ "$KIOSK" -eq 0 ]; then
    warn "Skipping kiosk setup (--no-kiosk)"
    return
  fi
  local user
  user="$(desktop_user)"
  if [ -z "$user" ]; then
    warn "No desktop user found; run scripts/setup-kiosk.sh manually later."
    return
  fi
  log "Configuring the kiosk autostart for user $user"
  run env ARDUDECK_INSTALL_DIR="$INSTALL_DIR" ARDUDECK_KIOSK_USER="$user" \
    bash "$INSTALL_DIR/scripts/setup-kiosk.sh"
}

summary() {
  cat <<EOF

ArduDeck installation finished.

  Backend service : systemctl status $SERVICE_NAME
  Live logs       : journalctl -u $SERVICE_NAME -f
  UI + API        : http://localhost:8080  (health: /api/health)
  Install dir     : $INSTALL_DIR
  Data / logs     : $DATA_DIR, $LOG_DIR
  Kiosk           : $([ "$KIOSK" -eq 1 ] && echo "configured for the next desktop login" || echo "not configured")

Teacher Mode (hold the ArduDeck mark on the Home screen for 5 seconds) shows
the raw serial log, upload logs and lets you restart the backend.

SSH access is unchanged.

EOF
}

require_root
require_pi
install_packages
normalize_scripts
install_arduino_cli
create_user
copy_repo
install_python_deps
build_ui
install_service
install_sudoers
setup_kiosk
summary
