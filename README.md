# Ardu OS

**A desktop physical-computing environment for classrooms.** Ardu OS opens as a Windows
application and contains three internal apps:

| App | Purpose |
|---|---|
| **ArduDeck** | BUILD - make a real system from a sensor, a rule and an action |
| **ArduWorld** | EXPLORE - real-world physical-computing experiences *(coming soon)* |
| **ArduQuest** | SOLVE - physical missions where the answer is not given *(coming soon)* |

ArduDeck talks to a real Arduino Uno over USB and never shows a terminal, a compiler, a
COM port or a line of C++ unless a student deliberately asks to see the code.

```
OBSERVE  ->  BUILD A RULE  ->  TEST IT IN THE REAL WORLD  ->  ITERATE  ->  DEPLOY
                                                                     (-> optionally read the code)
```

The acceptance test for the MVP is exactly this sequence on real hardware:

1. Raspberry Pi boots and launches ArduDeck by itself.
2. Plug an Arduino Uno into the Pi -> ArduDeck detects it.
3. Choose Light Sensor -> pin A0 -> the screen shows live values.
4. Cover the LDR -> the number changes immediately.
5. Build the flow: Light Sensor A0 -> Less Than 300 -> LED D9 ON.
6. Press TEST LIVE -> the real LED reacts as the light crosses the threshold.
7. Change the threshold -> the real LED reacts to the new value at once.
8. Press DEPLOY -> ArduDeck generates C++, compiles it, uploads it.
9. Unplug the Arduino -> the LDR + LED system keeps working on its own.

Everything else in this repository exists to make that sequence reliable in a classroom.

---

## WHAT ARDUDECK IS

| | |
|---|---|
| **Hardware** | Raspberry Pi 3 Model B, official 7" touchscreen, Arduino Uno over USB |
| **Screen** | 800x480, touch only, no keyboard, no mouse, no external monitor |
| **Network** | Wi-Fi optional. ArduDeck needs internet **once** (installer) and never again |
| **Persistence** | Local SQLite database. No accounts, no cloud, no login |
| **UI** | React + TypeScript + Vite, designed directly for 800x480 |
| **Backend** | Python (FastAPI) on the same Pi, one local origin at `http://localhost:8080` |
| **Codegen** | Deterministic templates in TypeScript. No AI, no external API, byte-identical output |
| **Firmware** | A tiny custom sketch, *ArduDeck Bridge*, that turns the Uno into an I/O bridge |

Two modes, one product:

* **Live Mode** - the Arduino is a bridge; the Pi evaluates the student's rule ~25 times per
  second and drives outputs in real time.
* **Deploy Mode** - the Pi generates Arduino C++ for the flow, compiles it with `arduino-cli`
  and uploads it, so the board keeps running after it is unplugged.

---

## DEVELOPMENT QUICK START

Requirements: Node 18.18+, Python 3.10+ (both are used by the dev runner). No Arduino needed.

```bash
git clone <this repo> && cd ARDUDECK-CONSOLE
npm install
npm run dev            # starts the Python API (8080) and the Vite dev server (5173)
npm run desktop:dev    # same, plus the Ardu OS desktop window (Electron)
```

Open <http://localhost:5173> in a browser, or use `npm run desktop:dev` to see the real
desktop experience: one window, no tabs, no URL bar. The primary target is a school
notebook at 1366x768; 1920x1080 scales comfortably.

Useful commands:

```bash
npm run dev:api          # backend only
npm run dev:ui           # UI only
npm run desktop:dev      # Electron window + dev stack
npm run desktop:package  # Windows installer + portable build
npm run typecheck        # strict TypeScript, core + UI
npm run lint             # ESLint
npm run test             # core unit tests (validation, IR, code generation)
npm run test:api         # Python tests (protocol, runtime, deploy, API)
npm run build            # production UI into apps/ui/dist (served by the backend)
npm run check            # typecheck + lint + tests + build
```

### Repository layout

```
apps/ui                    React desktop UI (Ardu OS shell, ArduDeck, flow builder, design system)
core                       Pure TypeScript: components, graph, validation, IR, codegen
services/hardware-api      FastAPI: hardware backends, runtime engine, deploy, projects, WS
desktop                    Electron shell: starts/stops the backend, owns the window
firmware/ardudeck-bridge   The Arduino sketch used for Live Mode
scripts/                   Pi installer, arduino-cli setup, kiosk, update
systemd/                   ardudeck-api.service
docs/                      ARCHITECTURE.md, HARDWARE.md, DESKTOP.md
core/fixtures              Golden IR + generated sketch shared by both test suites
```

---

## MOCK MODE

The whole product works without a Raspberry Pi and without an Arduino:

* **No Arduino, dev machine** (`ARDUDECK_MOCK=auto`, the default): the backend simulates a board.
  Sensors drift and make noise like real ones; LEDs, servos, buzzers and distances are recorded
  and shown on screen. The UI clearly labels everything as *SIMULATED*.
* **Raspberry Pi without an Arduino** (`ARDUDECK_MOCK=off`, set by the service): ArduDeck shows
  *"Connect your Arduino to start."* A student can still press **Try simulation** - and the screen
  says SIMULATED while that lasts.
* **Slider-driven sensors**: in simulation the Live Sensor screen and the Test Live screen expose
  sliders (and Press/Release buttons) so a value can be driven by hand.
* **Deployment**: uploading to a simulated board is refused with a friendly message; the rest of
  the deploy pipeline (sketch writing, progress, error mapping) runs and is unit tested with a
  fake `arduino-cli`.

`npm run dev` uses `ARDUDECK_MOCK=auto`. Nothing in production depends on mock mode.

### Browser build (static hosting)

When the UI is served without the local Python service (for example on
<https://ardudeck.vercel.app>), it probes the service once at startup. If nothing answers, the
backend runs inside the tab: projects live in `localStorage` and the runtime evaluates flows.

The browser build can also drive a real Arduino over **Web Serial** (Chrome or Edge on a computer,
no driver install). The student clicks **Connect Arduino** once; the browser asks for permission,
the ArduDeck Bridge firmware is flashed straight from the page when the board does not have it,
and from then on Live Sensor, Test Live and Live Mode run against the real board. The grant is
remembered, so later visits reconnect on their own. Web USB is deliberately not used on Windows:
it would require replacing the board's serial driver with WinUSB (Zadig) and would break normal
COM use.

Uploading a standalone program stays desktop-only: the hosted build has no C++ toolchain, so
Deploy points at Live Mode or the Ardu OS app. The Electron desktop shell is unaffected - it
always uses its own backend.

---

## ACTUATOR-ONLY FLOWS

A card can also run on its own. Drop an LED on the canvas and stack controls on it
(HIGH -> DELAY 500 -> LOW -> DELAY 500): the flow compiles to an unconditional loop
with no sensor, tests live in simulation, and deploys like any other project. The
same works for a buzzer, a servo or an RGB LED. This is the fastest path from an
empty canvas to a blinking LED.

---

## RASPBERRY PI (SECONDARY / EXPERIMENTAL HARDWARE CONSOLE TARGET)

**Primary target: Windows 10/11 school notebooks.** The Raspberry Pi path is kept as a
secondary, experimental hardware-console target and no longer dictates layout, screen
size, packaging or navigation. The UI has no fixed 800x480 frame any more; on the Pi the
kiosk browser simply fills the display, exactly as before.

Target: **Raspberry Pi OS** (Bookworm or newer) on a Pi 3 with the official 7" touchscreen.

```bash
git clone <this repo> ~/ardudeck && cd ~/ardudeck
sudo ./scripts/install-pi.sh
```

What the installer changes (also printed when you run it):

1. apt packages: `python3-venv`, `python3-pip`, `git`, `curl`, `rsync`, `chromium`,
   `unclutter`, `nodejs`, `npm`.
2. Arduino CLI in `/usr/local/bin` + the `arduino:avr` core (needs internet, ~200 MB once).
3. A system user `ardudeck` (no login shell) in the `dialout` group, plus `/var/lib/ardudeck`
   and `/var/log/ardudeck`.
4. The repository copied to `/opt/ardudeck`.
5. A Python virtual environment with the backend dependencies.
6. The touch UI built into `apps/ui/dist` (slow on a Pi 3; build it on your computer and copy
   `apps/ui/dist` if you prefer).
7. The `ardudeck-api` systemd service (serves both the API and the UI on port 8080).
8. A sudoers rule (`/etc/sudoers.d/ardudeck`) allowing only:
   `systemctl restart ardudeck-api` - used by the Teacher Mode button.
9. The Chromium kiosk autostart for the desktop user (`--no-kiosk` skips this).

Verify:

```bash
systemctl status ardudeck-api
curl -s http://localhost:8080/api/health | python3 -m json.tool
journalctl -u ardudeck-api -f
```

`scripts/setup-arduino-cli.sh` and `scripts/setup-kiosk.sh` can be run on their own; both are
safe to re-run. `scripts/update-ardudeck.sh` pulls, rebuilds and restarts.

---

## ARDUINO CONNECTION

1. Flash nothing yourself. Plug the Uno into the Pi with a USB-A to USB-B cable.
2. The header pill in the UI shows the state. Student-facing states are:
   `Connect Arduino` -> `Connecting...` -> `Arduino Ready` -> `Program running`.
3. If the board is connected but a previous deployment is on it, ArduDeck says
   *"Arduino needs setup"* and offers **Prepare Arduino**, which uploads ArduDeck Bridge.
   This also happens automatically when a student starts Test Live.
4. Technical details (serial device, board, raw serial traffic) live in **Teacher Mode**:
   hold the ArduDeck mark on the Home screen for 5 seconds.

ArduDeck never assumes a fixed `/dev/tty*` path: it enumerates USB serial devices, scores known
Arduino/CH340/CP2102/FTDI chips, and prefers `arduino-cli board list` results when available.
More than one compatible device -> the UI offers a simple choice.

---

## LIVE MODE ARCHITECTURE

```
flow (UI) --compile--> IR --POST /api/runtime/start--> RuntimeEngine (Python thread)
                                                        |            ^
                                              writes outputs    reads sensor cache
                                                        v            |
                                                  ArduDeck Bridge --USB--> Arduino
                                                        |
                                                  telemetry (WebSocket, 10 Hz)
                                                        v
                                                    highlight on screen
```

* The Pi evaluates the flow; the browser only displays. React re-renders cannot slow the loop.
* The bridge streams the watched pins every 25 ms; the engine applies an output only when it
  actually changes, so the serial link stays quiet and latency stays well under 150 ms.
* Test Live falls back to simulation - clearly labelled - when no Arduino is available.
* Perceived latency target: ~25-60 ms from sensor change to output change.

Details, including the serial protocol, are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## DEPLOY MODE ARCHITECTURE

Deterministic, template-based, exactly as specified:

```
Visual Graph -> Graph Validator -> Intermediate Representation -> Arduino Code Generator
             -> arduino-cli compile -> arduino-cli upload -> friendly status
```

* `core/src/pipeline/compile.ts` is the only place that turns a flow into code.
* The generator emits the same readable structure a teacher would write by hand
  (`const int lightPin = A0;`, `if (lightValue < 300) { ... } else { ... }`, `delay(50);`)
  and returns a **line map** (`node id -> line ranges`) which powers "tap a block, see its
  code" in the View Code screen.
* Before uploading, the backend stops the runtime, releases the serial port, writes the sketch
  to a temporary folder, compiles to a build directory, and uploads with `--input-dir`.
* After a successful upload the state becomes `Program running`; Live Mode will prepare the
  bridge again the next time a student asks for it.
* Golden files in `core/fixtures/` pin the exact IR and the exact generated sketch; the Python
  test suite loads the same files, so the contract between the two languages is verified.

---

## HOW TO ADD A NEW COMPONENT

1. **Define it** in `core/src/components/registry.ts`: id, name, category, icon, pins
   (with allowed pin kinds), settings fields, reading range, wiring/safety note.
   The UI, validator and pin pickers pick it up automatically.
2. **Validation** needs nothing if the component is a sensor, condition or action with a single
   input/output; special rules go in `core/src/validation/validate.ts`.
3. **Code generation**: add its action/read handling in `core/src/codegen/generate.ts`
   (and `core/src/ir/build.ts` if it is a new kind of read or action).
4. **Live Mode**: the runtime understands IR ops. New ops need a handler in
   `services/hardware-api/app/runtime/engine.py` and, for real hardware, a command in
   `firmware/ardudeck-bridge/ardudeck-bridge.ino` and `services/hardware-api/app/hardware/protocol.py`.
5. **Tests**: add a case to `core/tests/` and, if you touched the protocol or runtime,
   to `services/hardware-api/tests/`.
6. If the peripheral is slow or uses a timer (ultrasonic, servo), document it in
   [docs/HARDWARE.md](docs/HARDWARE.md) and keep the pin-intelligence notes in the UI honest.

---

## KIOSK SETUP

`scripts/setup-kiosk.sh` writes exactly two files in the desktop user's home directory:

* `~/.config/autostart/ardudeck-kiosk.desktop` - starts the console at login
* `~/.config/ardudeck/kiosk-url` - the URL to open (default `http://localhost:8080`)

`scripts/kiosk-launch.sh` then waits for the backend, disables screen blanking with `xset`,
hides the cursor with `unclutter`, and starts Chromium with `--kiosk` (no tabs, no URL bar, no
session-crash bubble, no pinch zoom, no update nags).

Make sure desktop autologin is enabled: `raspi-config` -> System Options -> Boot / Auto Login
-> Desktop Autologin. Reboot: the Pi should go power-on -> ArduDeck boot screen -> Home.

---

## SSH MAINTENANCE

SSH is never touched by the installer.

```bash
ssh pi@<pi-address>

systemctl status ardudeck-api           # is the console service running?
journalctl -u ardudeck-api -f           # live backend log
journalctl -u ardudeck-api -n 200       # recent upload/compile output
sudo systemctl restart ardudeck-api     # restart the console
pkill chromium                          # leave the kiosk (returns on next reboot)
/opt/ardudeck/scripts/update-ardudeck.sh
```

Data lives in `/var/lib/ardudeck/ardudeck.db` (SQLite, WAL mode). Copy that single file to back
up student work.

---

## TROUBLESHOOTING

| What you see | What it means | What to do |
|---|---|---|
| `Connect Arduino` | No USB serial device found | Check the cable (USB-A to USB-B), try another port |
| `Arduino needs setup` | A deployed program is running, no bridge | Press **Prepare Arduino**, or run Test Live again |
| `We can't talk to your Arduino.` | avrdude could not reach the board | Re-seat the USB cable, close other programs, retry |
| `The Arduino connection is busy.` | The serial port is held elsewhere | Stop other uploads, unplug/replug the USB cable |
| Upload says tools are missing | `arduino-cli` not installed | `sudo /opt/ardudeck/scripts/setup-arduino-cli.sh` |
| `The Arduino Uno support is not installed.` | AVR core missing | Same script, it installs the core |
| Console does not start at boot | Kiosk autostart not configured | Run `sudo ./scripts/setup-kiosk.sh` |
| The screen goes black after a while | Desktop blanking still enabled | The kiosk script disables it; run it as the desktop user |
| Browser shows the API page only | UI not built | `cd /opt/ardudeck && npm ci && npm run build` |
| Project will not open | Saved data damaged by a power cut | ArduDeck says so and keeps the rest; start a new project |

Nothing above leaves a student stuck: every screen has an obvious next action, and errors are
one short sentence plus at most three things to try. Raw compiler/serial output is only behind
**DETAILS** in Teacher Mode.

---

## WHAT IS VERIFIED WITHOUT HARDWARE

Automated and green in this repository: core unit tests (validation, IR, codegen incl. golden
sketches), Python tests (serial protocol, IR parsing, runtime evaluation against the mock
backend, deploy pipeline with a fake CLI, project storage, HTTP API, WebSocket greeting),
strict TypeScript, ESLint, and the production build.

Compiled with the real toolchain (`arduino-cli 1.5.2`, `arduino:avr 1.8.8`, FQBN
`arduino:avr:uno`): the generated sketches for light→LED, knob→servo, distance→buzzer and
button→LED (916-2114 bytes of flash) and the ArduDeck Bridge firmware (7688 bytes flash, 384
bytes RAM). No board is required for that check:

```bash
arduino-cli compile --fqbn arduino:avr:uno firmware/ardudeck-bridge
```

Requires your hardware to confirm (see the acceptance test at the top and
[docs/HARDWARE.md](docs/HARDWARE.md)): real sensor values, real LED/servo/buzzer behaviour,
`arduino-cli` compile+upload to a real Uno, the bridge handshake, kiosk behaviour and touch
feel on the 7" screen.
