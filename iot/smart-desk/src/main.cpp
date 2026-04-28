#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublish = 0;
unsigned long lastMqttReconnectAttempt = 0;
const unsigned long mqttReconnectIntervalMs = 5000;
bool ledAutoState = false;
float distanceWindow[DISTANCE_FILTER_WINDOW] = {0};
size_t distanceWindowCount = 0;
size_t distanceWindowCursor = 0;

void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
float readDistance();
int readLight();
float filteredDistance(float reading);
const char* lightBucket(int lightValue);
const char* distanceState(float distanceCm);
void printBootDiagnostics();
void printPinMap();
void runSensorBootSamples();
void publishSensorData();

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    pinMode(ULTRASONIC_TRIG, OUTPUT);
    pinMode(ULTRASONIC_ECHO, INPUT);
    if (LDR_USE_DIGITAL_OUTPUT) {
        pinMode(LDR_PIN, INPUT);
    }
    
    setupWiFi();
    setupMQTT();
    printBootDiagnostics();
    runSensorBootSamples();
    Serial.println("Gyanavriksha Smart Desk initialized and calibration-ready");
}

void loop() {
    unsigned long now = millis();
    if (!mqttClient.connected() && now - lastMqttReconnectAttempt >= mqttReconnectIntervalMs) {
        lastMqttReconnectAttempt = now;
        reconnectMQTT();
    }
    if (mqttClient.connected()) {
        mqttClient.loop();
    }

    if (now - lastPublish >= MQTT_PUBLISH_INTERVAL) {
        publishSensorData();
        lastPublish = now;
    }
}

void setupWiFi() {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("Connecting to WiFi SSID: %s\n", WIFI_SSID);
    unsigned long start = millis();
    const unsigned long timeoutMs = 20000;
    while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
        delay(500);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
        return;
    }
    Serial.println("\nWiFi connect timeout.");
    wl_status_t status = WiFi.status();
    if (status == WL_NO_SSID_AVAIL) {
        Serial.println("Reason: SSID not found. ESP32 supports only 2.4GHz WiFi.");
    } else if (status == WL_CONNECT_FAILED) {
        Serial.println("Reason: connection failed. Check password and router auth mode.");
    } else if (status == WL_CONNECTION_LOST) {
        Serial.println("Reason: connection lost during handshake.");
    } else if (status == WL_DISCONNECTED) {
        Serial.println("Reason: disconnected. Check signal, channel, and router settings.");
    } else {
        Serial.printf("Reason: WiFi status code %d\n", static_cast<int>(status));
    }
}

void setupMQTT() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
}

void reconnectMQTT() {
    if (mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD)) {
        Serial.println("MQTT connected.");
        mqttClient.subscribe(TOPIC_LED_CMD);
        mqttClient.publish(TOPIC_STATUS, "{\"status\":\"online\"}");
    } else {
        Serial.printf("MQTT reconnect failed rc=%d\n", mqttClient.state());
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    if (String(topic) == TOPIC_LED_CMD) {
        if (message == "ON") {
            ledAutoState = true;
            digitalWrite(LED_PIN, HIGH);
        } else if (message == "OFF") {
            ledAutoState = false;
            digitalWrite(LED_PIN, LOW);
        }
    }
}

float readDistance() {
    digitalWrite(ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(ULTRASONIC_TRIG, LOW);
    long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);
    if (duration <= 0) {
        return -1.0f;
    }
    float cm = duration * 0.034f / 2.0f;
    if (cm < DISTANCE_VALID_MIN_CM || cm > DISTANCE_VALID_MAX_CM) {
        return -1.0f;
    }
    return cm;
}

int readLight() {
    if (LDR_USE_DIGITAL_OUTPUT) {
        int doState = digitalRead(LDR_PIN);
        return doState == LDR_DO_DARK_STATE ? 0 : 4095;
    }
    return analogRead(LDR_PIN);
}

float filteredDistance(float reading) {
    if (reading > 0.0f) {
        distanceWindow[distanceWindowCursor] = reading;
        distanceWindowCursor = (distanceWindowCursor + 1) % DISTANCE_FILTER_WINDOW;
        if (distanceWindowCount < DISTANCE_FILTER_WINDOW) {
            distanceWindowCount++;
        }
    }
    if (distanceWindowCount == 0) {
        return -1.0f;
    }
    float total = 0.0f;
    for (size_t i = 0; i < distanceWindowCount; i++) {
        total += distanceWindow[i];
    }
    return total / static_cast<float>(distanceWindowCount);
}

const char* lightBucket(int lightValue) {
    if (lightValue <= LDR_BUCKET_DIM_MAX) {
        return "dim";
    }
    if (lightValue <= LDR_BUCKET_NORMAL_MAX) {
        return "normal";
    }
    if (lightValue <= LDR_BUCKET_BRIGHT_MAX) {
        return "bright";
    }
    return "invalid";
}

const char* distanceState(float distanceCm) {
    if (distanceCm < 0.0f) {
        return "sensor_unavailable";
    }
    if (distanceCm < DISTANCE_TOO_CLOSE_CM) {
        return "too_close";
    }
    if (distanceCm <= DISTANCE_PRESENT_MAX_CM) {
        return "present";
    }
    return "away";
}

void printPinMap() {
    Serial.println("Pin Map");
    Serial.printf("  LDR_PIN: %d\n", LDR_PIN);
    Serial.printf("  LED_PIN: %d\n", LED_PIN);
    Serial.printf("  ULTRASONIC_TRIG: %d\n", ULTRASONIC_TRIG);
    Serial.printf("  ULTRASONIC_ECHO: %d\n", ULTRASONIC_ECHO);
}

void printBootDiagnostics() {
    Serial.println("Boot Diagnostics");
    Serial.printf("  Device ID: %s\n", DEVICE_ID);
    Serial.printf("  MQTT Broker: %s:%d\n", MQTT_BROKER, MQTT_PORT);
    Serial.printf("  WiFi RSSI: %d dBm\n", WiFi.RSSI());
    Serial.printf("  Free Heap: %u bytes\n", ESP.getFreeHeap());
    Serial.printf("  CPU Frequency: %u MHz\n", ESP.getCpuFreqMHz());
    printPinMap();
    Serial.println("Calibration Constants");
    Serial.printf("  Light On Threshold: %d\n", LDR_LED_ON_THRESHOLD);
    Serial.printf("  Light Off Threshold: %d\n", LDR_LED_OFF_THRESHOLD);
    Serial.printf("  LDR Mode: %s\n", LDR_USE_DIGITAL_OUTPUT ? "digital_do" : "analog_ao");
    if (LDR_USE_DIGITAL_OUTPUT) {
        Serial.printf("  LDR DO Dark State: %s\n", LDR_DO_DARK_STATE == HIGH ? "HIGH" : "LOW");
    }
    Serial.printf("  Too Close Distance: %.2f cm\n", DISTANCE_TOO_CLOSE_CM);
    Serial.printf("  Presence Max Distance: %.2f cm\n", DISTANCE_PRESENT_MAX_CM);
}

void runSensorBootSamples() {
    Serial.printf("Boot Sensor Samples (%d)\n", SENSOR_BOOT_SAMPLE_COUNT);
    for (int i = 0; i < SENSOR_BOOT_SAMPLE_COUNT; i++) {
        int light = readLight();
        float distance = readDistance();
        float smoothDistance = filteredDistance(distance);
        Serial.printf(
            "  Sample %d -> light=%d (%s), distance=%.2fcm, state=%s\n",
            i + 1,
            light,
            lightBucket(light),
            smoothDistance,
            distanceState(smoothDistance)
        );
        delay(200);
    }
}

void publishSensorData() {
    float distance = filteredDistance(readDistance());
    int light = readLight();

    if (light <= LDR_LED_ON_THRESHOLD) {
        ledAutoState = true;
        digitalWrite(LED_PIN, HIGH);
    } else if (light >= LDR_LED_OFF_THRESHOLD) {
        ledAutoState = false;
        digitalWrite(LED_PIN, LOW);
    }

    JsonDocument lightDoc;
    lightDoc["device_id"] = DEVICE_ID;
    lightDoc["value"] = light;
    lightDoc["bucket"] = lightBucket(light);
    lightDoc["led_active"] = ledAutoState;
    lightDoc["led_on_threshold"] = LDR_LED_ON_THRESHOLD;
    lightDoc["led_off_threshold"] = LDR_LED_OFF_THRESHOLD;
    char lightBuffer[256];
    serializeJson(lightDoc, lightBuffer);
    mqttClient.publish(TOPIC_LIGHT, lightBuffer);

    JsonDocument distDoc;
    distDoc["device_id"] = DEVICE_ID;
    distDoc["distance_cm"] = distance;
    distDoc["state"] = distanceState(distance);
    distDoc["presence"] = (distance > 0.0f && distance <= DISTANCE_PRESENT_MAX_CM);
    distDoc["posture_alert"] = (distance > 0.0f && distance < DISTANCE_TOO_CLOSE_CM);
    distDoc["too_close_threshold"] = DISTANCE_TOO_CLOSE_CM;
    distDoc["presence_max_threshold"] = DISTANCE_PRESENT_MAX_CM;
    char distBuffer[256];
    serializeJson(distDoc, distBuffer);
    mqttClient.publish(TOPIC_DISTANCE, distBuffer);

    Serial.printf(
        "Live -> light=%d (%s), led=%s, distance=%.2fcm, state=%s\n",
        light,
        lightBucket(light),
        ledAutoState ? "on" : "off",
        distance,
        distanceState(distance)
    );
}