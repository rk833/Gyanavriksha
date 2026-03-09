# MQTT Topic Structure

All topics are namespaced per device: `gyanavriksha/devices/{device_id}/...`

| Topic | Direction | Description |
|-------|-----------|-------------|
| `.../sensors/light` | Device → Broker | LDR reading + LED status |
| `.../sensors/distance` | Device → Broker | HC-SR04 distance + presence/posture |
| `.../status` | Device → Broker | Online/offline heartbeat |
| `.../commands/led` | Broker → Device | ON/OFF command for LED |