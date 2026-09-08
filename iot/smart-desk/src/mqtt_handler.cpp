#include <string.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "mqtt_handler.h"

static WiFiClient g_wifiClient;
static PubSubClient g_mqttClient(g_wifiClient);
static MqttLedCommandHandler g_ledHandler = nullptr;
static unsigned long g_lastReconnectAttemptMs = 0;
static unsigned long g_reconnectBackoffMs = MQTT_RECONNECT_BASE_MS;

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) {
        msg += static_cast<char>(payload[i]);
    }
    if (String(topic) != TOPIC_LED_CMD || g_ledHandler == nullptr) {
        return;
    }
    if (msg == "ON") {
        g_ledHandler(true);
    } else if (msg == "OFF") {
        g_ledHandler(false);
    }
}

void mqttBegin(MqttLedCommandHandler ledHandler) {
    g_ledHandler = ledHandler;
    g_mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    g_mqttClient.setCallback(mqttCallback);
}

void mqttEnsureConnected(unsigned long nowMs) {
    if (g_mqttClient.connected()) {
        return;
    }
    if (nowMs - g_lastReconnectAttemptMs < g_reconnectBackoffMs) {
        return;
    }
    g_lastReconnectAttemptMs = nowMs;
    Serial.printf("MQTT reconnect attempt (backoff=%lu ms)...\n", g_reconnectBackoffMs);
    bool ok = g_mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD);
    if (!ok) {
        Serial.printf("MQTT reconnect failed rc=%d\n", g_mqttClient.state());
        g_reconnectBackoffMs = min(g_reconnectBackoffMs * 2, static_cast<unsigned long>(MQTT_RECONNECT_MAX_MS));
        return;
    }
    Serial.println("MQTT connected.");
    g_mqttClient.subscribe(TOPIC_LED_CMD);
    g_reconnectBackoffMs = MQTT_RECONNECT_BASE_MS;
}

void mqttLoop() {
    if (g_mqttClient.connected()) {
        g_mqttClient.loop();
    }
}

bool mqttIsConnected() {
    return g_mqttClient.connected();
}

bool mqttPublish(const char* topic, const char* payload) {
    if (!g_mqttClient.connected()) {
        return false;
    }
    size_t len = strlen(payload);
    bool ok = g_mqttClient.publish(topic, payload);
    if (!ok) {
        Serial.printf(
            "MQTT publish failed (topic=%s payload_len=%u). Check WiFi/MQTT buffer size.\n",
            topic,
            static_cast<unsigned int>(len));
    }
    return ok;
}

void mqttPublishHeartbeat(unsigned long nowMs) {
    JsonDocument statusDoc;
    statusDoc["device_id"] = DEVICE_ID;
    statusDoc["firmware_version"] = FIRMWARE_VERSION;
    statusDoc["uptime_ms"] = nowMs;
    statusDoc["wifi_rssi"] = WiFi.RSSI();
    statusDoc["status"] = "online";
    char payload[256];
    serializeJson(statusDoc, payload);
    mqttPublish(TOPIC_STATUS, payload);
}

int mqttStateCode() {
    return g_mqttClient.state();
}
