#!/usr/bin/env bash
#
# Configures the Chromium kiosk so the Raspberry Pi boots straight into
# ArduDeck and never shows a desktop, a URL bar or a screensaver.
#
# Changes made (for one desktop user only):
#   ~/.config/autostart/ardudeck-kiosk.desktop   starts the kiosk at login
#   ~/.config/ardudeck/kiosk-url                 the URL to open (editable)
#
# Screen blanking is disabled inside the kiosk launch script with xset, so no
# system file is modified.
#
# SSH is untouched. To leave the kiosk temporarily: Alt+F4 closes Chromium,
# or SSH in and run: pkill chromium
#
# Usage:
#   ./scripts/setup-kiosk.sh [--user pi] [--url http://localhost:8080]
#
set -euo pipefail

INSTALL_DIR="${ARDUDECK_INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
KIOSK_USER="${ARDUDECK_KIOSK_USER:-${SUDO_USER:-$USER}}"
KIOSK_URL="${ARDUDECK_URL:-http://localhost:8080}"

while [ $# -gt 0 ]; do
  case "$1" in
    --user) shift; KIOSK_USER="${1:-$KIOSK_USER}" ;;
    --url) shift; KIOSK_URL="${1:-$KIOSK_URL}" ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift || true
done

log()  { printf '\033[36m[ardudeck]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[ardudeck]\033[0m %s\n' "$*" >&2; exit 1; }

if ! id -u "$KIOSK_USER" >/dev/null 2>&1; then
  fail "User $KIOSK_USER does not exist. Use --user <desktop user>."
fi

USER_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
  fail "Could not find the home directory of $KIOSK_USER"
fi

as_user() {
  if [ "$(id -u)" -eq 0 ]; then
    sudo -u "$KIOSK_USER" -H "$@"
  else
    "$@"
  fi
}

AUTOSTART_DIR="$USER_HOME/.config/autostart"
CONFIG_DIR="$USER_HOME/.config/ardudeck"

log "Writing kiosk configuration for $KIOSK_USER"
as_user install -d "$AUTOSTART_DIR" "$CONFIG_DIR"
printf '%s\n' "$KIOSK_URL" | as_user tee "$CONFIG_DIR/kiosk-url" >/dev/null

as_user tee "$AUTOSTART_DIR/ardudeck-kiosk.desktop" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=ArduDeck Kiosk
Comment=Starts the ArduDeck console fullscreen on the touchscreen
Exec=$INSTALL_DIR/scripts/kiosk-launch.sh
X-GNOME-Autostart-enabled=true
Terminal=false
EOF

as_user chmod 0755 "$INSTALL_DIR/scripts/kiosk-launch.sh" 2>/dev/null || true

cat <<EOF

Kiosk configured.

  URL            : $KIOSK_URL
  Autostart file : $AUTOSTART_DIR/ardudeck-kiosk.desktop
  Launch script  : $INSTALL_DIR/scripts/kiosk-launch.sh

Reboot (or log out and back in) to see ArduDeck start by itself.

Verify the backend is running first:
  systemctl status ardudeck-api
  curl -s http://localhost:8080/api/health

If the desktop shows up instead, make sure desktop autologin is enabled
(raspi-config -> System Options -> Boot / Auto Login -> Desktop Autologin)
and that ssdm/lxsession is the session in use.

EOF
