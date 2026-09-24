# ArduDeck Hardware Guide

Everything a teacher needs to wire ArduDeck's components safely, plus the pin map and the
serial protocol reference for maintainers.

---

## 1. The console

| Part | Notes |
|---|---|
| Raspberry Pi 3 Model B (1 GB) | Runs the backend, the UI and the kiosk browser |
| Official 7" touchscreen, 800x480 | The UI is designed for exactly this panel |
| USB-A to USB-B cable | Goes to the Arduino Uno |
| 5 V power supply for the Pi | 2.5 A recommended |
| Arduino Uno | Uno R3 (official) or a compatible clone with CH340/CP2102/FTDI |

No keyboard, mouse or monitor is needed. SSH stays available for maintenance.

---

## 2. Pin map (Arduino Uno)

```
Analog inputs        A0 A1 A2 A3 A4 A5
Digital              D2 ... D13
PWM capable          D3 D5 D6 D9 D10 D11
Serial (never used)  D0 D1                 <- reserved by ArduDeck Bridge
```

* ArduDeck never offers D0/D1: they carry the USB serial link.
* Pins A4/A5 are also I2C lines on the Uno; ArduDeck keeps them for analog sensors.
* Current safety: each pin can source about 20 mA safely (40 mA absolute maximum). LEDs need a
  resistor; motors, pumps, relays and bigger buzzers need their own power supply.

---

## 3. Wiring the supported components

### Light sensor (LDR) - analog

```
5V ----[ LDR ]----+----[ 10 kOhm ]---- GND
                  |
                  A0
```

With this divider the value rises in bright light (dark ~200, room light ~500-700, direct light
~900+). Any LDR works; 10 kOhm is a good partner resistor.

### Potentiometer (knob) - analog

```
5V ----| outer leg
       | middle leg ---- A1
GND ---| outer leg
```

### Push button - digital (built-in pull-up)

```
D2 ---- one side
GND --- other side
```

Config setting **Button to GND** means ArduDeck uses `INPUT_PULLUP`: released = 1, pressed = 0.
If your buttons are wired to 5 V instead, choose **Button to 5V** and add a 10 kOhm resistor to
GND, then pressed = 1.

### LED - digital

```
D9 ----[ 220-330 Ohm ]----|>|---- GND
```

Long leg (anode) towards the resistor. Never connect an LED directly between a pin and GND.

### Buzzer - digital

```
D6 (or D8) ---- + on the piezo
GND ---------- - on the piezo
```

Small piezo buzzers can be driven directly. Louder magnetic buzzers need a transistor driver
and their own supply.

### Servo - digital

```
D5 ---------- signal (orange/yellow)
5-6 V supply - V+ (red)
GND --------- GND (brown/black)   and   Arduino GND ---- supply GND  (common ground!)
```

Servos draw peaks well above what an Arduino pin can supply. **Power the servo from a separate
5-6 V supply** and connect the grounds together. Servo angles are 0-180 degrees.

### HC-SR04 distance sensor - digital

```
VCC  -> Arduino 5V
GND  -> Arduino GND
TRIG -> D7
ECHO -> D8
```

Returns centimetres. A reading of `--` with the note "No echo" means nothing came back: check
the sensor faces a surface within ~2 m and that TRIG/ECHO are not swapped.

---

## 4. Timer conflicts teachers should know about

The Arduino libraries behind generated code use hardware timers:

| Library | Timer | Side effect |
|---|---|---|
| `Servo` | Timer1 | `analogWrite()` on D9 and D10 stops working |
| `tone()` | Timer2 | `analogWrite()` on D3 and D11 stops working |

In the current component set outputs are digital only (LED, buzzer, servo), so these conflicts
cannot appear yet. When PWM brightness is added, ArduDeck must warn when a servo is present and
a PWM device wants D9/D10. The validator has the hook for this (`servo-pwm` warning) and
`docs/ARCHITECTURE.md` describes where to add it.

---

## 5. Power rules

* Never power motors, pumps, relays, solenoids or high-current LED strips from a GPIO pin.
* Use a transistor/MOSFET/relay module with its own supply for anything above ~20 mA.
* Always connect grounds between the Arduino and an external supply ("common ground").
* Do not power a servo from the Arduino 5 V pin; use a separate regulator.
* Keep the Arduino's USB cable connected while using ArduDeck; it is both power and data.
* After DEPLOY the Uno runs standalone, but it still needs power: keep USB connected to a
  charger or a battery pack.

---

## 6. Serial protocol reference (ArduDeck Bridge)

115200 baud, one ASCII line per message. Implemented in
`firmware/ardudeck-bridge/ardudeck-bridge.ino`, mirrored in
`services/hardware-api/app/hardware/protocol.py`.

| Direction | Message | Meaning |
|---|---|---|
| Pi -> board | `?` | identify: expects `OK ARDUDECK <version>` |
| Pi -> board | `E A0,D2,U3` | stream these pins (`A` analog, `D` digital, `U` digital + pull-up) |
| Pi -> board | `E` | stop streaming |
| Pi -> board | `e 25` | streaming interval in ms (5-5000) |
| Pi -> board | `R D2` | read once, answers `V D2 1` |
| Pi -> board | `W D9 1` | digital write |
| Pi -> board | `P D3 128` | PWM write (0-255) |
| Pi -> board | `S D5 90` | servo angle (0-180) |
| Pi -> board | `T D6 440 200` | tone: frequency, duration in ms |
| Pi -> board | `N D6` | stop tone |
| Pi -> board | `M D7 D8` | ultrasonic measurement, answers `C <cm>` |
| Pi -> board | `X` | make all outputs safe (digital LOW, PWM 0, no tone) |
| board -> Pi | `ARDUDECK READY 1` | printed once after boot/reset |
| board -> Pi | `OK ARDUDECK 1` | handshake answer |
| board -> Pi | `A A0 742` | streamed analog value |
| board -> Pi | `D D2 1` | streamed digital value |
| board -> Pi | `C 42` | distance in cm (`-1` when there is no echo) |
| board -> Pi | `V D2 1` | answer to `R` |
| board -> Pi | `ERR <reason>` | malformed command (shown in Teacher Mode) |

Notes:

* Opening the serial port resets the Uno, so ArduDeck waits for the boot banner and then
  handshakes. That is why "Connecting..." takes about two seconds.
* `X` only touches pins that were written as outputs, so an input with a pull-up is never
  disturbed.
* Servos stay attached and keep their last angle after `X` - deliberate, to avoid snapping arms.

---

## 7. Deployed sketches

Generated sketches are plain, readable Arduino C++:

```cpp
const int lightPin = A0;
const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int lightValue = analogRead(lightPin);

  if (lightValue < 300) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }

  delay(50);
}
```

A teacher can open the same sketch in the Arduino IDE later: nothing ArduDeck-specific is
required, no libraries beyond `Servo.h` (only when a servo is used).

---

## 8. Teacher hardware checklist

Before a lesson:

- [ ] Backend running: `systemctl status ardudeck-api`
- [ ] Arduino plugged in, header shows **Arduino Ready**
- [ ] Each component wired per the diagrams above, grounds shared where needed
- [ ] LED blinks once when you press TEST LIVE (proves the bridge works)
- [ ] Deploy a test flow once, then unplug the USB cable and confirm the LED still follows the
      LDR - this proves the deployed sketch runs standalone
- [ ] Screen does not blank after a minute (kiosk script handles it)

If something fails, open Teacher Mode (hold the ArduDeck mark for 5 s) and check the SERIAL and
UPLOAD logs before changing any wiring.
