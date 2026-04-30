# Sprint 6 Phase 5 Demo Runbook (GD-143)

This runbook is the single script to demonstrate end-to-end IoT behavior for Sprint 6 sign-off.

## Prerequisites

- Backend API running (`/api/admin/*` and `/api/iot/telemetry`)
- Frontend admin panel running
- ESP32 firmware flashed and connected to same Wi-Fi as broker
- Mosquitto broker running on laptop
- One registered IoT device with valid `node_id` and API key

## Step 1 - Start broker and services

```bash
docker run -d --name gyan-mqtt -p 1883:1883 eclipse-mosquitto:2
docker ps
```

Start backend and frontend in separate terminals, then open `http://localhost:5173/admin/iot`.

## Step 2 - Validate device status visibility

1. Open Device Management table.
2. Confirm your device appears with:
   - status
   - last seen timestamp
   - latest light snapshot
   - latest distance snapshot
3. Open device details and confirm telemetry list updates.

Expected result: admin can identify stale/offline nodes quickly.

## Step 3 - Trigger and verify light automation

1. Darken LDR sensor (cover it).
2. Wait one publish cycle.
3. Confirm:
   - LED turns ON physically
   - Device snapshots show new light value
   - Alert Timeline includes `auto_light_on`
4. Shine bright light on sensor.
5. Confirm `auto_light_off` appears.

## Step 4 - Trigger and verify distance alerts

1. Move object very close for sustained threshold window.
2. Confirm Alert Timeline shows `too_close` (critical).
3. Move object away for sustained threshold window.
4. Confirm Alert Timeline shows `away` (warning).

## Step 5 - Validate timeline filters

Use timeline controls:
- device filter
- severity filter (`critical`, `warning`, `info`)
- time window filter (`6h`, `24h`, `72h`)

Expected result: timeline entries narrow correctly per selected dimensions.

## Step 6 - Broker outage and recovery

1. Stop broker:
   ```bash
   docker stop gyan-mqtt
   ```
2. Observe device eventually transitions to disconnected/offline behavior.
3. Restart broker:
   ```bash
   docker start gyan-mqtt
   ```
4. Wait for reconnect backoff cycle and verify telemetry resumes.

Expected result: reconnect succeeds and dashboard continuity is preserved.

## Step 7 - Security rejection visibility

Send invalid telemetry (wrong API key or topic/payload mismatch), then verify:
- request is rejected (`403` or failure reason)
- security overview counters increase
- integrity violation is visible in audit/security views

## Step 8 - Evidence capture checklist

Capture and store:
- screenshot of device table with snapshots
- screenshot of alert timeline showing `too_close`, `away`, `auto_light_on/off`
- serial monitor logs for reconnect sequence
- sample accepted telemetry payload
- sample rejected telemetry payload and response
- security overview counters screenshot

Store artifacts under sprint evidence folder and link in sprint notes.
