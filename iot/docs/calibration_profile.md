# Smart Desk Sensor Calibration Profile (Phase 1)

## Firmware Constants

Defined in `iot/smart-desk/include/config.h`:

- `LDR_LED_ON_THRESHOLD = 1000`
- `LDR_LED_OFF_THRESHOLD = 1400`
- `LDR_BUCKET_DIM_MAX = 1200`
- `LDR_BUCKET_NORMAL_MAX = 2600`
- `DISTANCE_TOO_CLOSE_CM = 30.0`
- `DISTANCE_PRESENT_MAX_CM = 150.0`
- `DISTANCE_VALID_MIN_CM = 2.0`
- `DISTANCE_VALID_MAX_CM = 400.0`
- `DISTANCE_FILTER_WINDOW = 5`

## Light Calibration Table

| Environment | Typical LDR Raw Value | Bucket | LED Auto Decision |
|---|---:|---|---|
| Night / very dim room | 500 - 900 | dim | ON |
| Indoor normal study light | 1300 - 2300 | normal | Hold prior state |
| Bright daylight / direct lamp | 2800 - 3800 | bright | OFF |

## Distance Calibration Table (HC-SR04)

| Student Position | Typical Distance (cm) | Classified State |
|---|---:|---|
| Leaning too close to desk | 15 - 28 | too_close |
| Normal seated position | 35 - 110 | present |
| Left desk / away | > 150 | away |

## Reproducible Calibration Process

1. Flash firmware and open serial monitor at `115200`.
2. Capture 20 readings each for dim, normal, and bright light conditions.
3. Capture 20 readings each for too-close, present, and away distances.
4. Adjust constants in `config.h` only, do not rewrite sensor logic.
5. Reflash and repeat until state transitions are stable.

## Stability Notes

- Hysteresis is used for LED control to reduce flicker:
  - Turn ON below `LDR_LED_ON_THRESHOLD`
  - Turn OFF above `LDR_LED_OFF_THRESHOLD`
- Distance data is smoothed with moving average window size `5`.
- Invalid ultrasonic readings are treated as `sensor_unavailable` and do not crash runtime.
