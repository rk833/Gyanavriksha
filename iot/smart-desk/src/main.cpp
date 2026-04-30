#include <Arduino.h>
#include <ArduinoJson.h>
#include <string.h>
#include "config.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensor_reader.h"

static bool g_ledAutoState = false;
static const char* g_ledSource = "auto";
static unsigned long g_manualOverrideUntilMs = 0;
static unsigned long g_lastSensorReadMs = 0;
static unsigned long g_lastTelemetryPublishMs = 0;
static unsigned long g_lastHeartbeatMs = 0;
static SensorSnapshot g_latestSnapshot{};
static const char* g_distanceRuleState = "sensor_unavailable";
static unsigned long g_awayCandidateSinceMs = 0;
static unsigned long g_tooCloseCandidateSinceMs = 0;
static unsigned long g_lastAwayEventMs = 0;
static unsigned long g_lastTooCloseEventMs = 0;
static bool g_distanceEventPending = false;
static const char* g_distanceEventTypePending = "none";

static void onLedCommand(bool ledOn) {
    g_ledAutoState = ledOn;
    g_ledSource = "manual";
    g_manualOverrideUntilMs = millis() + LED_MANUAL_OVERRIDE_MS;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    Serial.printf("LED command received -> %s (manual override %lu ms)\n", ledOn ? "ON" : "OFF", static_cast<unsigned long>(LED_MANUAL_OVERRIDE_MS));
}

static void applyLedRule(unsigned long nowMs, int lightRaw) {
    if (nowMs < g_manualOverrideUntilMs) {
        g_ledSource = "manual";
        return;
    }
    g_ledSource = "auto";
    if (lightRaw <= LDR_LED_ON_THRESHOLD) {
        g_ledAutoState = true;
        digitalWrite(LED_PIN, HIGH);
    } else if (lightRaw >= LDR_LED_OFF_THRESHOLD) {
        g_ledAutoState = false;
        digitalWrite(LED_PIN, LOW);
    }
}

static bool cooldownElapsed(unsigned long nowMs, unsigned long lastMs) {
    return lastMs == 0 || nowMs - lastMs >= DISTANCE_EVENT_COOLDOWN_MS;
}

static void triggerDistanceEvent(unsigned long nowMs, const char* eventType) {
    if (strcmp(eventType, "away") == 0) {
        if (!cooldownElapsed(nowMs, g_lastAwayEventMs)) {
            return;
        }
        g_lastAwayEventMs = nowMs;
    } else if (strcmp(eventType, "too_close") == 0) {
        if (!cooldownElapsed(nowMs, g_lastTooCloseEventMs)) {
            return;
        }
        g_lastTooCloseEventMs = nowMs;
    } else {
        return;
    }
    g_distanceEventPending = true;
    g_distanceEventTypePending = eventType;
    Serial.printf("Distance event triggered -> %s\n", eventType);
}

static void updateDistanceRuleState(unsigned long nowMs, const char* instantaneousState) {
    if (strcmp(instantaneousState, "sensor_unavailable") == 0) {
        g_awayCandidateSinceMs = 0;
        g_tooCloseCandidateSinceMs = 0;
        g_distanceRuleState = "sensor_unavailable";
        return;
    }
    if (strcmp(instantaneousState, "away") == 0) {
        g_tooCloseCandidateSinceMs = 0;
        if (g_awayCandidateSinceMs == 0) {
            g_awayCandidateSinceMs = nowMs;
        }
        if (nowMs - g_awayCandidateSinceMs >= DISTANCE_AWAY_SUSTAIN_MS && strcmp(g_distanceRuleState, "away") != 0) {
            g_distanceRuleState = "away";
            triggerDistanceEvent(nowMs, "away");
            Serial.println("Distance rule state -> away");
        }
        return;
    }
    if (strcmp(instantaneousState, "too_close") == 0) {
        g_awayCandidateSinceMs = 0;
        if (g_tooCloseCandidateSinceMs == 0) {
            g_tooCloseCandidateSinceMs = nowMs;
        }
        if (nowMs - g_tooCloseCandidateSinceMs >= DISTANCE_TOO_CLOSE_SUSTAIN_MS && strcmp(g_distanceRuleState, "too_close") != 0) {
            g_distanceRuleState = "too_close";
            triggerDistanceEvent(nowMs, "too_close");
            Serial.println("Distance rule state -> too_close");
        }
        return;
    }
    g_awayCandidateSinceMs = 0;
    g_tooCloseCandidateSinceMs = 0;
    if (strcmp(g_distanceRuleState, "present") != 0) {
        g_distanceRuleState = "present";
        Serial.println("Distance rule state -> present");
    }
}

static void printBootDiagnostics() {
    Serial.println("Boot Diagnostics");
    Serial.printf("  Device ID: %s\n", DEVICE_ID);
    Serial.printf("  Firmware: %s\n", FIRMWARE_VERSION);
    Serial.printf("  MQTT Broker: %s:%d\n", MQTT_BROKER, MQTT_PORT);
    Serial.printf("  LDR Mode: %s\n", LDR_USE_DIGITAL_OUTPUT ? "digital_do" : "analog_ao");
    Serial.printf("  Pin Map -> LDR:%d LED:%d TRIG:%d ECHO:%d\n", LDR_PIN, LED_PIN, ULTRASONIC_TRIG, ULTRASONIC_ECHO);
}

static void runBootSamples() {
    Serial.printf("Boot Sensor Samples (%d)\n", SENSOR_BOOT_SAMPLE_COUNT);
    for (int i = 0; i < SENSOR_BOOT_SAMPLE_COUNT; i++) {
        SensorSnapshot s = sensorReadSnapshot();
        Serial.printf(
            "  Sample %d -> light=%d (%s), distance=%.2fcm, state=%s\n",
            i + 1,
            s.lightRaw,
            s.lightBucket,
            s.distanceCm,
            s.distanceState
        );
        delay(200);
    }
}

static void publishSensorTelemetry(unsigned long nowMs) {
    JsonDocument lightDoc;
    lightDoc["device_id"] = DEVICE_ID;
    lightDoc["firmware_version"] = FIRMWARE_VERSION;
    lightDoc["ts"] = nowMs;
    lightDoc["raw_light"] = g_latestSnapshot.lightRaw;
    lightDoc["bucket"] = g_latestSnapshot.lightBucket;
    lightDoc["led_state"] = g_ledAutoState ? "on" : "off";
    lightDoc["source"] = g_ledSource;
    lightDoc["led_on_threshold"] = LDR_LED_ON_THRESHOLD;
    lightDoc["led_off_threshold"] = LDR_LED_OFF_THRESHOLD;
    char lightPayload[256];
    serializeJson(lightDoc, lightPayload);
    mqttPublish(TOPIC_LIGHT, lightPayload);

    JsonDocument distDoc;
    distDoc["device_id"] = DEVICE_ID;
    distDoc["firmware_version"] = FIRMWARE_VERSION;
    distDoc["ts"] = nowMs;
    distDoc["distance_cm"] = g_latestSnapshot.distanceCm;
    distDoc["state"] = g_distanceRuleState;
    distDoc["instant_state"] = g_latestSnapshot.distanceState;
    distDoc["presence"] = strcmp(g_distanceRuleState, "present") == 0;
    distDoc["posture_alert"] = strcmp(g_distanceRuleState, "too_close") == 0;
    distDoc["event_triggered"] = g_distanceEventPending;
    distDoc["event_type"] = g_distanceEventPending ? g_distanceEventTypePending : "none";
    distDoc["too_close_threshold"] = DISTANCE_TOO_CLOSE_CM;
    distDoc["presence_max_threshold"] = DISTANCE_PRESENT_MAX_CM;
    char distancePayload[256];
    serializeJson(distDoc, distancePayload);
    mqttPublish(TOPIC_DISTANCE, distancePayload);

    Serial.printf(
        "Live -> light=%d (%s), led=%s/%s, distance=%.2fcm, state=%s, event=%s, mqtt=%s\n",
        g_latestSnapshot.lightRaw,
        g_latestSnapshot.lightBucket,
        g_ledAutoState ? "on" : "off",
        g_ledSource,
        g_latestSnapshot.distanceCm,
        g_distanceRuleState,
        g_distanceEventPending ? g_distanceEventTypePending : "none",
        mqttIsConnected() ? "connected" : "offline"
    );
    g_distanceEventPending = false;
    g_distanceEventTypePending = "none";
}

void setup() {
    Serial.begin(115200);
    sensorReaderBegin();
    wifiBegin();
    mqttBegin(onLedCommand);
    printBootDiagnostics();
    runBootSamples();
    Serial.println("Gyanavriksha Smart Desk initialized and phase-2 ready");
}

void loop() {
    unsigned long now = millis();
    wifiEnsureConnected(now);
    mqttEnsureConnected(now);
    mqttLoop();

    if (now - g_lastSensorReadMs >= SENSOR_READ_INTERVAL) {
        g_latestSnapshot = sensorReadSnapshot();
        applyLedRule(now, g_latestSnapshot.lightRaw);
        updateDistanceRuleState(now, g_latestSnapshot.distanceState);
        g_lastSensorReadMs = now;
    }
    if (now - g_lastTelemetryPublishMs >= MQTT_PUBLISH_INTERVAL) {
        publishSensorTelemetry(now);
        g_lastTelemetryPublishMs = now;
    }
    if (now - g_lastHeartbeatMs >= MQTT_HEARTBEAT_INTERVAL) {
        mqttPublishHeartbeat(now);
        g_lastHeartbeatMs = now;
    }
}