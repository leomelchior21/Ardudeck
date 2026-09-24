# ArduDeck Architecture

This document explains how the parts fit together, why the boundaries are where they are, and
what each failure mode does. It is the reference for anyone extending ArduDeck.

---

## 1. The two modes

ArduDeck has exactly two ways of running an Arduino, and they are deliberately different:

| | Live Mode | Deploy Mode |
|---|---|---|
| Who decides | The Raspberry Pi | The Arduino |
| Firmware | ArduDeck Bridge (I/O bridge) | Generated sketch |
| Latency | ~25-60 ms (USB round trip) | hardware speed |
| Survives unplugging | No | Yes |
| Purpose | experiment, iterate, test a rule | make it real, keep it running |

**Transition rules**

* Live Mode needs the bridge. If a deployed sketch is on the board, `POST /api/runtime/start`
  returns `needs-bridge` and the UI offers **Prepare Arduino** (bridge install job).
* Deploy needs the port. The pipeline stops the runtime, the hardware manager releases the
  serial port (`release_for_upload`), compiles, uploads, then marks the state `deployed`.
* After deployment the runtime can never talk to the board again until the bridge is restored;
  this is why `deployed` is a first-class hardware state instead of an error.

---

## 2. Compiler-like pipeline

```
            apps/ui (React)
                 |
   core/src/graph        visual graph (nodes, edges, positions, config)
   core/src/validation   structural + pin rules -> student-facing messages
   core/src/ir           Intermediate Representation (frozen JSON contract)
   core/src/codegen      deterministic C++ + line map (node id -> line ranges)
                 |
     /api/runtime/start |  /api/deploy
                 v
   services/hardware-api (Python)
     runtime/engine.py   evaluates IR against live values
     deploy/pipeline.py  writes sketch -> arduino-cli compile -> upload
                 |
            USB serial
                 v
            Arduino Uno
```

Rules that keep this honest:

* React components never build C++ and never talk to serial ports.
* The only entry point from a flow to code is `compileFlow()` in `core/src/pipeline/compile.ts`.
* The IR is the only interface between TypeScript and Python; both sides have tests that load
  the same golden file (`core/fixtures/light-led.ir.json`).
* Code generation is deterministic: the same flow produces byte-identical output, which is what
  makes "tap a block, see its code" trustworthy.

### Intermediate Representation

```json
{
  "version": 1,
  "title": "Light controls LED",
  "loopDelayMs": 50,
  "reads": [
    { "id": "sensor_light", "name": "Light Sensor", "var": "light", "kind": "analog", "pin": "A0" }
  ],
  "rules": [
    {
      "id": "cond_less",
      "var": "light",
      "condition": { "op": "lt", "value": 300 },
      "then": [ { "nodeId": "act_led", "name": "LED", "var": "led", "op": "digitalWrite", "pin": "D9", "value": 1 } ],
      "else": [ { "nodeId": "act_led", "name": "LED", "var": "led", "op": "digitalWrite", "pin": "D9", "value": 0 } ]
    }
  ]
}
```

Read kinds: `analog`, `digital`, `distance`.
Action ops: `digitalWrite`, `pwmWrite`, `servoWrite`, `tone`, `stopTone`.

The IR is intentionally flat: one read, one comparison, one set of actions per rule. It is the
smallest shape that expresses the classroom sequence *observe -> rule -> act*, and it maps 1:1
to both generated C++ and the runtime evaluator. Branching, logic nodes and variables are the
documented extension points (a rule grows into a tree, and the validator grows with it).

---

## 3. Hardware layer (Python)

`HardwareManager` owns exactly one backend at a time and keeps watching the USB ports.

```
BackendBase (values cache, output records, status events)
├── MockBackend      simulated drift/noise, slider input, recorded outputs
└── BridgeBackend    one supervisor thread: open port, handshake, stream, watchdog, reconnect
```

* **States** the UI understands: `starting`, `connecting`, `ready`, `needs-bridge`, `deployed`,
  `uploading`, `disconnected`, `no-arduino`. No raw error strings ever reach a student.
* **Detection**: `discovery.py` merges `pyserial` enumeration with `arduino-cli board list`
  (cached) and scores devices (real Uno > Arduino-compatible > CH340/CP2102/FTDI > other).
  Hot-plugging an Arduino switches from simulation to hardware automatically (unless the mode
  is forced with `ARDUDECK_MOCK=on`).
* **Recovery**: the bridge supervisor pings after 3 s of silence and reconnects after 8 s. The
  upload pipeline releases and re-acquires the port. Every failure produces a state event, so
  the UI never has to poll.

### ArduDeck Bridge protocol

Line-based ASCII at 115200 baud, documented in full in
[../firmware/ardudeck-bridge/ardudeck-bridge.ino](../firmware/ardudeck-bridge/ardudeck-bridge.ino).

```
Pi -> Arduino:  ? | E A0,D2,U3 | e 25 | R D2 | W D9 1 | P D3 128 | S D5 90
                T D6 440 200 | N D6 | M D7 D8 | X
Arduino -> Pi:  ARDUDECK READY 1 | OK ARDUDECK 1 | A A0 742 | D D2 1 | C 42 | V D2 1 | ERR ...
```

Why a custom protocol instead of Firmata:

* every message is human-readable, so Teacher Mode can show the exact traffic;
* the firmware reports when it is ready and which version it is, so ArduDeck can detect and
  reinstall it automatically;
* streaming interval, ultrasonic pings, tone and servo are under our control and fit in ~300
  lines of C++;
* there is no third-party runtime dependency on either side.

The `HardwareBackend` interface keeps Firmata swappable if this ever proves limiting.

### Pin intelligence

`core/src/components/pins.ts` is the single source of truth: A0-A5 for analog needs, D2-D13 for
digital, D3/D5/D6/D9/D10/D11 for PWM. **D0/D1 are never offered** because they carry the USB
serial link. The validator rejects duplicates and impossible combinations, including the two
pins of one block (TRIG/ECHO). Timer side effects of the Servo library (D9/D10) and `tone()`
(D3/D11) are documented for teachers in [HARDWARE.md](HARDWARE.md).

---

## 4. Runtime engine

One thread per running flow. Tick = `min(IR.loopDelayMs, 80 ms)`, default 50 ms (60 ms when a
distance sensor is present).

```
read values from the backend cache -> evaluate each rule -> apply only changed outputs
                                    -> publish telemetry (immediate on change, 5 Hz heartbeat)
```

* Outputs are de-duplicated by signature, so a steady rule sends zero serial traffic.
* Distance sensors are polled every 8 ticks (~400 ms) because each ping is a physical event.
* A sensor without a reading never triggers a rule (`ok: false` in telemetry), so a loose wire
  cannot make an LED flicker.
* `STOP` makes outputs safe: digital LOW, PWM 0, `noTone`, and the bridge's `X` command. Servos
  stay where they are - snapping an arm on stop would be worse than leaving it.
* Telemetry over WebSocket: values, rule truth, output states. The UI highlights the active
  path from that data; it never evaluates anything itself.

---

## 5. Deploy pipeline

```
start_deploy(name, code)                 synchronous checks: no job running, code sanity, port exists
  prepare   write work/<job>/<Sketch>/<Sketch>.ino
  check     stop runtime, release serial port
  compile   arduino-cli compile --fqbn arduino:avr:uno --output-dir <build>
  upload    arduino-cli upload -p <port> --input-dir <build>
  finish    state -> deployed, project marked with deployedAt + generated code
```

* Progress is published on the event bus and forwarded over the WebSocket; the screen also polls
  `GET /api/deploy/current` as a safety net.
* Failures are mapped through `deploy/messages.py`: one short sentence plus at most three hints,
  with the raw log kept for **DETAILS** in Teacher Mode.
* Repeated taps on UPLOAD are refused with `deploy-busy` instead of starting a second job.
* Cancel is checked between steps (a compile cannot be interrupted safely; it is allowed to
  finish and then stops before upload).

---

## 6. Storage

SQLite (`services/hardware-api/app/projects/store.py`), WAL mode, one transaction per save with
`INSERT ... ON CONFLICT(id) DO UPDATE`. A power cut cannot corrupt the database, and a row that
is somehow unreadable is reported as "This saved project could not be opened" instead of
crashing the app. Autosave debounces 1.5 s of edits and also flushes on `pagehide`.

---

## 7. Threading and performance on a Raspberry Pi 3

| Thread | Job |
|---|---|
| asyncio (uvicorn) | HTTP, WebSocket, static UI |
| hardware supervisor | serial port, handshake, watchdog (one per backend) |
| mock ticker | simulated values at 50 ms |
| runtime engine | evaluate flow, ~20-40 Hz |
| deploy job | compile/upload subprocesses, streaming log lines |
| hardware scan | USB enumeration every 2.5 s |

Frontend choices that keep a 1 GB Pi 3 comfortable:

* no UI kit, no state library, no animation library, no WebGL;
* a ~40-line external store with `useSyncExternalStore`: a sensor update re-renders only the
  components that select it;
* React Flow is used for the canvas only; nodes are plain DOM, edges are SVG, animations off;
* values are pushed at 10 Hz (telemetry/values) even though the loop runs faster;
* the production bundle is ~133 kB gzipped (React + React Flow + app).

---

## 8. Failure handling map

| Situation | Behaviour |
|---|---|
| Arduino unplugged while testing | Bridge supervisor drops to `disconnected`, engine pauses, UI shows the state and keeps the flow |
| Cable reconnected | Supervisor reopens the port, handshakes, re-applies watches automatically |
| Bridge missing (deployed sketch on board) | `needs-bridge` state; Test Live offers **Prepare Arduino** |
| Serial port busy | Friendly "busy" message with three hints; DETAILS has the avrdude output |
| Upload fails halfway | Job reports the failing step, project keeps its previous state, retry is one tap |
| Double upload tap | Refused with "An upload is already running." |
| Wrong pin configuration | Validation blocks TEST LIVE and DEPLOY, highlights the block, explains in words |
| Sensor reading impossible (no echo) | Value shows `--`, rules are treated as false, note says "No echo. Check the sensor and the wires." |
| Malformed saved project | Backend returns `malformed: true`, UI offers to start a new project |
| Backend restarting | UI keeps working from its last state, WebSocket reconnects with backoff, boot screen offers Try again |
| No network | Everything is local; only the one-time install and `arduino-cli` core download need internet |
| Power cycle | systemd restarts the backend, kiosk restarts the browser, SQLite keeps the projects |

---

## 9. Extension points

* **New component**: see "HOW TO ADD A NEW COMPONENT" in the README. Registry-driven, no UI edits.
* **More conditions** (between, changed by, stays above): new registry entries + an IR condition
  op + codegen + engine support; the validator only needs the new category rules.
* **Logic, math, timers, variables**: the rule shape grows from a single comparison into an
  expression tree; keep the IR as the contract and both consumers stay small.
* **Multiple outputs / branching**: actions are already lists; branch ports would add an
  `IrRule.branches` array without touching the deploy pipeline.
* **Firmata instead of the bridge**: implement `BackendBase` in a new module and select it in
  `HardwareManager`; nothing above the hardware layer changes.
