#!/usr/bin/env bash
#
# Installs the Arduino CLI and the Arduino AVR core (Arduino Uno support).
#
# Changes made:
#   - downloads the official arduino-cli release into /usr/local/bin
#   - initialises arduino-cli configuration (in $HOME/.arduino15)
#   - installs the "arduino:avr" core (Arduino Uno compiler + uploader)
#
# Requires internet. After this, ArduDeck works completely offline.
# Safe to run again: existing pieces are left alone.
#
# Usage:
#   sudo ./scripts/setup-arduino-cli.sh [--user ardudeck] [--core-only]
#
set -euo pipefail

CLI_PATH="/usr/local/bin/arduino-cli"
TARGET_USER="${ARDUDECK_APP_USER:-ardudeck}"
CORE_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --core-only) CORE_ONLY=1 ;;
    --user) shift; TARGET_USER="${1:-ardudeck}" ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

log()  { printf '\033[36m[ardudeck]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[ardudeck]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[ardudeck]\033[0m %s\n' "$*" >&2; exit 1; }

as_target() {
  if [ "$(id -u)" -eq 0 ] && id -u "$TARGET_USER" >/dev/null 2>&1; then
    sudo -u "$TARGET_USER" -H "$@"
  else
    "$@"
  fi
}

install_cli() {
  if command -v arduino-cli >/dev/null 2>&1; then
    log "arduino-cli already installed: $(arduino-cli version 2>/dev/null | head -n1)"
    return
  fi

  local machine archive url tmp
  machine="$(uname -m)"
  case "$machine" in
    aarch64|arm64) archive="arduino-cli_latest_Linux_ARM64.tar.gz" ;;
    armv7l|armv6l) archive="arduino-cli_latest_Linux_ARMv7.tar.gz" ;;
    x86_64)        archive="arduino-cli_latest_Linux_64bit.tar.gz" ;;
    *) fail "Unsupported architecture: $machine" ;;
  esac

  url="https://downloads.arduino.cc/arduino-cli/$archive"
  tmp="$(mktemp -d)"
  log "Downloading $archive"
  curl -fsSL "$url" -o "$tmp/$archive" || fail "Could not download arduino-cli. Is there internet?"
  tar -xzf "$tmp/$archive" -C "$tmp"
  install -m 0755 "$tmp/arduino-cli" "$CLI_PATH"
  rm -rf "$tmp"
  log "Installed $CLI_PATH"
}

install_core() {
  log "Installing the Arduino AVR core (this downloads ~200 MB the first time)"
  as_target "$CLI_PATH" core update-index
  as_target "$CLI_PATH" core install arduino:avr
  log "Installed: $(as_target "$CLI_PATH" core list 2>/dev/null | grep arduino:avr || echo 'arduino:avr')"
}

install_cli
if [ "$CORE_ONLY" -eq 0 ]; then
  install_core
else
  log "Skipping core installation (--core-only)"
fi

if id -u "$TARGET_USER" >/dev/null 2>&1; then
  usermod -aG dialout "$TARGET_USER" 2>/dev/null || warn "Could not add $TARGET_USER to dialout"
fi

log "Done. ArduDeck can now compile and upload for the Arduino Uno."
