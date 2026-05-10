/**
 * Merge WebSocket `iot_telemetry` payloads into REST-shaped IoT status (same rules as frontend-web IoTStatus).
 */

export type IotTelemetryWsMessage = {
  type: 'iot_telemetry';
  latest_distance_cm?: number | null;
  latest_distance_at?: string | null;
  latest_ldr_value?: number | null;
  latest_ldr_at?: string | null;
  latest_led_activated?: boolean | null;
  device_id?: string;
  node_status?: string;
  last_seen_at?: string | null;
};

export type DeviceEntry = {
  device_id: string;
  node_id?: string;
  device_label?: string;
  device_type?: string;
  status?: string;
  is_active?: boolean;
  last_seen_at?: string | null;
  latest_distance?: { distance_cm: number | null; recorded_at: string | null } | null;
  latest_light?: {
    ldr_value: number | null;
    led_activated: boolean | null;
    recorded_at: string | null;
  } | null;
};

export type IoTStatusShape = {
  devices: DeviceEntry[];
  device_count: number;
  latest_distance_cm?: number | null;
  latest_ldr_value?: number | null;
  latest_led_activated?: boolean | null;
  latest_distance_at?: string | null;
  latest_ldr_at?: string | null;
};

export function mergeIotTelemetryIntoStatus<T extends IoTStatusShape | null>(prev: T, msg: IotTelemetryWsMessage): T {
  if (!prev || !msg || msg.type !== 'iot_telemetry') return prev;

  const next = { ...prev } as IoTStatusShape;
  if (msg.latest_distance_cm !== undefined && msg.latest_distance_cm !== null) {
    next.latest_distance_cm = msg.latest_distance_cm;
    if (msg.latest_distance_at) next.latest_distance_at = msg.latest_distance_at;
  }
  if (msg.latest_ldr_value !== undefined && msg.latest_ldr_value !== null) {
    next.latest_ldr_value = msg.latest_ldr_value;
    if (msg.latest_ldr_at) next.latest_ldr_at = msg.latest_ldr_at;
  }
  if (msg.latest_led_activated !== undefined && msg.latest_led_activated !== null) {
    next.latest_led_activated = msg.latest_led_activated;
  }
  if (msg.device_id && Array.isArray(next.devices)) {
    next.devices = next.devices.map((d) => {
      if (String(d.device_id) !== String(msg.device_id)) return { ...d };
      const u = { ...d };
      if (msg.node_status != null) u.status = msg.node_status;
      if (msg.last_seen_at) u.last_seen_at = msg.last_seen_at;
      if (msg.latest_distance_cm != null || msg.latest_distance_at) {
        u.latest_distance = {
          distance_cm: msg.latest_distance_cm != null ? msg.latest_distance_cm : (u.latest_distance?.distance_cm ?? null),
          recorded_at: msg.latest_distance_at ? msg.latest_distance_at : (u.latest_distance?.recorded_at ?? null),
        };
      }
      if (msg.latest_ldr_value != null || msg.latest_ldr_at) {
        u.latest_light = {
          ldr_value: msg.latest_ldr_value != null ? msg.latest_ldr_value : (u.latest_light?.ldr_value ?? null),
          led_activated: msg.latest_led_activated != null ? msg.latest_led_activated : (u.latest_light?.led_activated ?? null),
          recorded_at: msg.latest_ldr_at ? msg.latest_ldr_at : (u.latest_light?.recorded_at ?? null),
        };
      }
      return u;
    });
  }
  return next as T;
}
