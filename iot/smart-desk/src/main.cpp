#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensor_reader.h"

static bool g_ledAutoState = false;
static unsigned long g_lastSensorReadMs = 0;
static unsigned long g_lastTelemetryPublishMs = 0;
static unsigned long g_lastHeartbeatMs = 0;
static SensorSnapshot g_latestSnapshot{};

static void onLedCommand(bool ledOn) {
    g_ledAutoState = ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    Serial.printf("LED command received -> %s\n", ledOn ? "ON" : "OFF");
}

static void applyLedRule(int lightRaw) {
    if (lightRaw <= LDR_LED_ON_THRESHOLD) {
        g_ledAutoState = true;
        digitalWrite(LED_PIN, HIGH);
    } else if (lightRaw >= LDR_LED_OFF_THRESHOLD) {
        g_ledAutoState = false;
        digitalWrite(LED_PIN, LOW);
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
    lightDoc["value"] = g_latestSnapshot.lightRaw;
    lightDoc["bucket"] = g_latestSnapshot.lightBucket;
    lightDoc["led_active"] = g_ledAutoState;
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
    distDoc["state"] = g_latestSnapshot.distanceState;
    distDoc["presence"] = g_latestSnapshot.presence;
    distDoc["posture_alert"] = g_latestSnapshot.postureAlert;
    distDoc["too_close_threshold"] = DISTANCE_TOO_CLOSE_CM;
    distDoc["presence_max_threshold"] = DISTANCE_PRESENT_MAX_CM;
    char distancePayload[256];
    serializeJson(distDoc, distancePayload);
    mqttPublish(TOPIC_DISTANCE, distancePayload);

    Serial.printf(
        "Live -> light=%d (%s), led=%s, distance=%.2fcm, state=%s, mqtt=%s\n",
        g_latestSnapshot.lightRaw,
        g_latestSnapshot.lightBucket,
        g_ledAutoState ? "on" : "off",
        g_latestSnapshot.distanceCm,
        g_latestSnapshot.distanceState,
        mqttIsConnected() ? "connected" : "offline"
    );
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
        applyLedRule(g_latestSnapshot.lightRaw);
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