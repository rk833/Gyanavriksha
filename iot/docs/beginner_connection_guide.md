# Beginner Guide: How to Connect ESP32 + LDR + HC-SR04 + LED

This guide is written for first-time hardware users.
Follow it slowly, one step at a time.

---

## 1) What You Are Building

You will connect:

- 1 x ESP32 dev board
- 1 x LDR sensor module
- 1 x HC-SR04 ultrasonic sensor
- 1 x White LED
- 1 x 220 ohm resistor
- 1 x Breadboard
- Jumper wires
- USB cable (to connect ESP32 to laptop)

After this:

- ESP32 reads light from LDR
- ESP32 reads distance from HC-SR04
- ESP32 controls LED
- You can verify everything from serial monitor

---

## 2) Important Safety First

- Do not connect random wires while USB power is ON.
- Always unplug USB first, then change wiring, then reconnect.
- Never connect ESP32 GPIO pin directly to 5V.
- LED must use resistor (220 ohm) in series.
- Keep one common GND across all modules.

If unsure, stop and recheck.

---

## 3) Pin Map You Will Use

Use this exact map:

- `LDR analog output -> GPIO 34`
- `LED control -> GPIO 2` (through 220 ohm resistor)
- `HC-SR04 TRIG -> GPIO 5`
- `HC-SR04 ECHO -> GPIO 18`
- `All GNDs connected together`

This matches your firmware config in `iot/smart-desk/include/config.h`.

---

## 4) Breadboard Basics (Very Short)

- Breadboard side rails are usually for power (`+` and `-`).
- Middle rows are connected in groups.
- Do not assume everything is connected; inspect row lines.

If you are unsure, place modules first, then do one wire at a time.

---

## 5) Step-by-Step Wiring (Do in Order)

## Step A: Place ESP32

1. Put ESP32 on breadboard so pins are accessible.
2. Keep USB side outward so cable can connect easily.

## Step B: Make Common Ground

1. Choose one breadboard line as GND line.
2. Connect ESP32 `GND` to this GND line.
3. Later, every module ground goes to this same GND line.

## Step C: Connect LDR Module

Some LDR modules have `AO` (analog output), some have only `DO` (digital output).

If your module has `AO`:

1. LDR `AO` -> ESP32 `GPIO 34` (or `GPIO 32`)
2. LDR `GND` -> common GND line
3. LDR `VCC` -> ESP32 `3V3`

If your module has only `DO`:

1. LDR `DO` -> ESP32 digital pin (example `D13` / `GPIO 13`)
2. LDR `GND` -> common GND line
3. LDR `VCC` -> ESP32 `3V3`
4. Turn the small potentiometer on the LDR module to set light/dark trigger level

Important:

- `AO` gives real light values (best for calibration buckets and thresholds).
- `DO` gives only ON/OFF trigger state (dark/not-dark), not full analog intensity.
- If you use `DO`, firmware should use `digitalRead()` for the LDR pin instead of `analogRead()`.

For `DO` mode in this project, set in `iot/smart-desk/include/config.h`:

```cpp
#define LDR_PIN 13
#define LDR_USE_DIGITAL_OUTPUT true
#define LDR_DO_DARK_STATE HIGH
```

If behavior is inverted, change:

```cpp
#define LDR_DO_DARK_STATE LOW
```

## Step D: Connect LED + Resistor

LED has:
- Long leg = anode (+)
- Short leg = cathode (-)

Connection:

1. ESP32 `GPIO 2` -> 220 ohm resistor -> LED long leg (anode)
2. LED short leg (cathode) -> common GND line

## Step E: Connect HC-SR04

HC-SR04 has pins: `VCC`, `TRIG`, `ECHO`, `GND`

1. `TRIG` -> ESP32 `GPIO 5`
2. `ECHO` -> ESP32 `GPIO 18`
3. `GND` -> common GND line
4. `VCC` -> ESP32 `VIN` (recommended when ESP32 is powered by USB and you do not have external 5V supply)

Important:

- Echo pin voltage can be 5V on some HC-SR04 boards.
- If your board outputs 5V echo, use a voltage divider before ESP32 pin.
- If you are not sure, ask before powering.
- Powering HC-SR04 from `3V3` may work on some modules but can be unstable.

---

## 6) Final Wiring Checklist (Before Power ON)

Check all of these:

- [ ] ESP32 GND connected to common GND line
- [ ] LDR AO -> GPIO34/GPIO32 OR LDR DO -> selected digital pin (example GPIO13)
- [ ] LDR VCC -> 3V3
- [ ] LDR GND -> GND
- [ ] LED has resistor in series
- [ ] LED control line from GPIO2
- [ ] LED cathode to GND
- [ ] HC-SR04 TRIG -> GPIO5
- [ ] HC-SR04 ECHO -> GPIO18
- [ ] HC-SR04 GND -> GND
- [ ] HC-SR04 VCC -> VIN (if no external 5V source)
- [ ] No loose wire touching neighboring pin

Only then connect USB power.

---

## 7) Upload Firmware and Verify

Open terminal in:

`iot/smart-desk`

Run:

```bash
pio run
pio run --target upload
pio device monitor
```

You should see boot logs from `main.cpp`:

- Boot Diagnostics
- Pin Map
- Calibration Constants
- Boot Sensor Samples

If you see these logs, wiring + firmware are basically alive.

---

## 8) Quick Functional Tests

## Test 1: LDR

1. Look at light value in serial logs.
2. Cover LDR with finger or cloth.
3. Value should move into dim range.
4. LED auto-state should respond based on threshold.

## Test 2: Ultrasonic

1. Put hand near sensor (around 20-30 cm).
2. Check `distance_cm` decreases.
3. Move away far from sensor.
4. Check distance and state change.

## Test 3: LED Output

1. Observe LED when light changes.
2. It should not flicker rapidly due to hysteresis settings.

---

## 9) Common Mistakes and Fixes

### Problem: No serial output

- Check USB cable supports data (not charging-only).
- Check correct COM port selected.
- Confirm monitor speed is `115200`.

### Problem: LDR always same value

- AO wire may be wrong pin.
- LDR VCC/GND reversed.
- Using digital output pin instead of AO.

### Problem: Distance always -1 or 0

- TRIG/ECHO swapped.
- Sensor not powered correctly.
- Echo level compatibility issue.

### Problem: LED never turns ON

- LED polarity reversed.
- Missing resistor or wrong connection row.
- GPIO2 wire not actually connected.

---

## 10) If You Are Completely Stuck

Do this minimum debug path:

1. Disconnect HC-SR04 and LDR, test only LED first.
2. Then connect only LDR and test.
3. Then connect HC-SR04 last.
4. Re-test after each addition.

This isolates issues quickly.

---

## 11) Next Step After Connection

After hardware works, continue with:

- `SPRINT_GUIDES/PHASES_GUIDES/sprint_6_phase_2_guide.md`

That phase implements full firmware modularization and robust MQTT connectivity.
