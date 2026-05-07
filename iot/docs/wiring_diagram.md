# Smart Desk Wiring Diagram (Phase 1)

## Hardware

- ESP32-WROOM-32 Dev Board
- LDR Sensor Module
- HC-SR04 Ultrasonic Sensor
- White LED
- 220 ohm resistor
- Breadboard and jumper wires

## Pin Map

| Component | ESP32 Pin | Notes |
|---|---|---|
| LDR Analog Output | GPIO 34 | ADC input only |
| White LED (anode via 220 ohm resistor) | GPIO 2 | Digital output |
| HC-SR04 Trigger | GPIO 5 | Digital output |
| HC-SR04 Echo | GPIO 18 | Digital input |
| Common Ground | GND | Shared across all devices |
| HC-SR04 VCC | VIN | Use VIN when ESP32 is USB-powered and no external 5V supply is available |
| LDR Module VCC | 3V3 | Safe for ESP32 logic level |

## Wiring Steps

1. Connect all grounds together.
2. Connect LDR module analog output to GPIO 34.
3. Connect LED anode to GPIO 2 through 220 ohm resistor, cathode to GND.
4. Connect HC-SR04 trigger to GPIO 5.
5. Connect HC-SR04 echo to GPIO 18.
6. Connect HC-SR04 VCC to VIN.
7. Power ESP32 by USB and verify serial monitor boot diagnostics.

## Safety and Stability Checks

- Do not connect 5V directly to ESP32 GPIO pins.
- Confirm echo pin voltage level compatibility before powering.
- Add voltage divider on HC-SR04 ECHO line if module outputs 5V logic.
- Ensure sensor wires are firmly seated to avoid intermittent readings.
- Use a stable USB power source for repeatable calibration runs.
