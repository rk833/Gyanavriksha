# IoT Smart Desk: Run Guide

This guide explains how to run the ESP32 smart-desk firmware using `uv`, then switch LDR mode between digital (`DO`) and analog (`AO`).

## Project Path

Run commands inside:

`iot/smart-desk`

---

## 1) Setup with `uv`

### Create virtual environment

```bash
uv venv --seed
```

### Activate environment

Git Bash (Windows):

```bash
source .venv/Scripts/activate
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Install PlatformIO

```bash
uv pip install -U platformio
```

### Verify install

```bash
python -m platformio --version
```

---

## 2) Build, Upload, Monitor

### Build

```bash
python -m platformio run
```

### Upload

```bash
python -m platformio run --target upload
```

### Serial monitor

```bash
python -m platformio device monitor
```

If COM port is not auto-detected:

```bash
python -m platformio device list
python -m platformio run --target upload --upload-port COM3
python -m platformio device monitor --port COM3 --baud 115200
```

---

## 3) LDR Mode Switch: Digital vs Analog

Edit file:

`iot/smart-desk/include/config.h`

### A) Digital mode (`DO` pin from LDR module)

Use this when your LDR module has `DO` output and you connect it to a digital GPIO.

```cpp
#define LDR_PIN 13
#define LDR_USE_DIGITAL_OUTPUT true
#define LDR_DO_DARK_STATE HIGH
```

If dark/bright is reversed, switch:

```cpp
#define LDR_DO_DARK_STATE LOW
```

Typical wiring:
- `VCC -> 3V3`
- `GND -> GND`
- `DO -> GPIO13` (or any digital GPIO you choose)

### B) Analog mode (`AO` pin from LDR module)

Use this when your LDR module has `AO` output and you want real light intensity values.

```cpp
#define LDR_PIN 32
#define LDR_USE_DIGITAL_OUTPUT false
```

Typical wiring:
- `VCC -> 3V3`
- `GND -> GND`
- `AO -> GPIO32` (or GPIO34)

---

## 4) Reflash after Changing LDR Mode

After any config change:

```bash
python -m platformio run --target upload
python -m platformio device monitor
```

---

## 5) Expected Serial Output

You should see:

- WiFi connection status
- Boot diagnostics (pin map and constants)
- Boot sensor samples
- Repeating live logs:

`Live -> light=..., led=..., distance=...cm, state=...`

---

## 6) Common Issues

- `pio: command not found`  
  Use `python -m platformio ...` instead.

- `Could not open COMx`  
  Replace `COMx` with real port from `python -m platformio device list`.

- Upload stops mid-way  
  Keep `upload_speed = 115200` in `platformio.ini`.

- MQTT reconnect failed `rc=-2`  
  Broker IP is unreachable; sensor logs still run locally.

---

## 7) Current Team Setup (Ready-to-Use)

Use these exact values for the current hardware and laptop setup:

### `iot/smart-desk/include/config.h`

```cpp
#define WIFI_SSID "heavenyard_2"
#define WIFI_PASSWORD "CLB4041D64"

#define LDR_PIN 13
#define LDR_USE_DIGITAL_OUTPUT true
#define LDR_DO_DARK_STATE HIGH
```

### `iot/smart-desk/platformio.ini`

```ini
upload_port = COM3
upload_speed = 115200
monitor_port = COM3
monitor_speed = 115200
```

### Wiring used

- LDR: `VCC -> 3V3`, `GND -> GND`, `DO -> GPIO13`
- LED: `GPIO2 -> resistor -> LED anode`, LED cathode -> GND
- Ultrasonic: `TRIG -> GPIO5`, `ECHO -> GPIO18`, `GND -> GND`, `VCC -> VIN`

### Run commands

```bash
python -m platformio run --target upload
python -m platformio device monitor
```

---

## 8) MQTT Broker Setup (Windows)

Follow these steps to make ESP32 MQTT connect successfully.

### 1) Start Mosquitto broker (from repo root)

```bash
docker run -d --name gyan-mqtt -p 1883:1883 eclipse-mosquitto:2
```

Check it:

```bash
docker ps
```

### 2) Find your laptop IPv4 (same Wi-Fi as ESP32)

PowerShell:

```powershell
ipconfig
```

Use the IPv4 from your active Wi-Fi adapter (example: `192.168.1.121`).

### 3) Update ESP32 config

In `iot/smart-desk/include/config.h`:

```cpp
#define MQTT_BROKER "YOUR_LAPTOP_IPV4"
```

### 4) Reflash and monitor

```bash
python -m platformio run --target upload
python -m platformio device monitor
```

You should then see:

- `MQTT connected.`
- `mqtt=connected`

