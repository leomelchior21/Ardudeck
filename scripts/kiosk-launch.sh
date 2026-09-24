#!/usr/bin/env bash
#
# Launch ArduDeck fullscreen on the official 7" touchscreen.
# Called automatically by ~/.config/autostart/ardudeck-kiosk.desktop
#
# It disables screen blanking and hides the mouse cursor, then starts Chromium
# in kiosk mode against the local ArduDeck service.
#
set -u

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL_FILE="$HOME/.config/ardudeck/kiosk-url"
URL="$(cat "$URL_FILE" 2>/dev/null || echo "http://localhost:8080")"

# Wait for the backend to answer before opening the window.
for _ in $(seq 1 60); do
  if curl -fsS "${URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# No screensaver, no DPMS blanking: this is an instrument, not a laptop.
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Hide the pointer (touch input is the only input).
if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.5 -root >/dev/null 2>&1 &
fi

CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$CHROMIUM" ]; then
  printf 'ArduDeck: chromium is not installed. Run sudo apt-get install chromium\n' >&2
  exit 1
fi

exec "$CHROMIUM" \
  --kiosk \
  --app="$URL" \
  --window-position=0,0 \
  --window-size=800,480 \
  --force-device-scale-factor=1 \
  --start-fullscreen \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=Translate,MediaRouter,OptimizationHints \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --touch-events=enabled \
  "$@"
