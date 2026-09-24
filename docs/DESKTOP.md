# Ardu OS Desktop

Ardu OS is a Windows desktop application first. This document explains how the shell is
put together and how to build an installer for school notebooks.

## Architecture

```
Ardu OS (Electron)
  ├── desktop/main.cjs        window + backend lifecycle
  ├── apps/ui/dist            the built React UI (loaded from the shell or from the API)
  └── services/hardware-api   FastAPI backend on 127.0.0.1:8080
```

The desktop shell:

1. looks for an already healthy backend and reuses it (never two instances);
2. otherwise starts the backend, either from a bundled executable or from system Python;
3. waits for `/api/health` before showing the window;
4. loads the UI — no tabs, no URL bar, no browser chrome;
5. shows a friendly recovery page if the engine stops;
6. stops the backend it started when the window closes.

In production the students never see or type `localhost`. The window URL is an
implementation detail.

## Development

```bash
npm install
npm run desktop:dev
```

`tools/desktop.mjs` starts the normal dev stack (`tools/dev.mjs`: FastAPI on 8080, Vite on
5173) and then opens the Electron window against `http://localhost:5173`, so hot reload
keeps working.

## Packaging (Windows)

```bash
npm run desktop:package
```

Steps:

1. `npm run build` produces `apps/ui/dist`.
2. If PyInstaller is available in `services/hardware-api/.venv`, a self-contained backend
   is built into `desktop/backend-dist/ardu-os-api/`.
3. `electron-builder` produces an NSIS installer and a portable build in `desktop/release`.

Without PyInstaller the installer still builds; the shell then falls back to system Python
plus the bundled backend sources. For a truly self-contained school deployment use
PyInstaller:

```bash
services/hardware-api/.venv/Scripts/python -m pip install pyinstaller
npm run desktop:package
```

### Arduino CLI provisioning

Students never install the Arduino IDE. Put `arduino-cli.exe` (and its `arduino15` core
folder with `arduino:avr` installed) in `vendor/tools/` before packaging. The shell passes
`ARDUDECK_ARDUINO_CLI` to the backend when that executable is present. See
`vendor/tools/README.md`.

## Local data

Writable data lives outside Program Files:

```
%LOCALAPPDATA%/ArduOS/data        SQLite projects + work files
%LOCALAPPDATA%/ArduOS/logs        backend logs
```

The packaged shell points the backend at these folders with `ARDUDECK_DATA_DIR`,
`ARDUDECK_LOG_DIR` and `ARDUDECK_WORK_DIR`.

## Hardware access

The backend owns the serial port exactly as before (automatic discovery, CH340/CP2102/FTDI
scoring, `arduino-cli board list`). Electron adds no privilege of its own: on Windows the
COM port is a normal user-accessible device, so no driver step is required beyond the
USB-serial driver that ships with the board.

## Raspberry Pi

The Pi remains a secondary, experimental target. `scripts/install-pi.sh`, `setup-kiosk.sh`
and the `systemd` unit are untouched, and the UI fills the display because it no longer
draws a fixed frame.
