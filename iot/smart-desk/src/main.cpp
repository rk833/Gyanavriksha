#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublish = 0;
unsigned long postureStartTime = 0;
bool postureAlertActive = false;

// Function prototypes
void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
float readDistance();
int readLight();
void publishSensorData();

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    pinMode(ULTRASONIC_TRIG, OUTPUT);
    pinMode(ULTRASONIC_ECHO, INPUT);
    
    setupWiFi();
    setupMQTT();
    
    Serial.println("Gyanavriksha Smart Desk initialized");
}

void loop() {
    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();

    unsigned long now = millis();
    if (now - lastPublish >= MQTT_PUBLISH_INTERVAL) {
        publishSensorData();
        lastPublish = now;
    }
}

void setupWiFi() {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

void setupMQTT() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
}

void reconnectMQTT() {
    while (!mqttClient.connected()) {
        if (mqttClient.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD)) {
            mqttClient.subscribe(TOPIC_LED_CMD);
            // Publish online status
            mqttClient.publish(TOPIC_STATUS, "{\"status\":\"online\"}");
        } else {
            delay(5000);
        }
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    if (String(topic) == TOPIC_LED_CMD) {
        if (message == "ON") digitalWrite(LED_PIN, HIGH);
        else if (message == "OFF") digitalWrite(LED_PIN, LOW);
    }
}

float readDistance() {
    digitalWrite(ULTRASONIC_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(ULTRASONIC_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(ULTRASONIC_TRIG, LOW);
    long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);
    return duration * 0.034 / 2;
}

int readLight() {
    return analogRead(LDR_PIN);
}

void publishSensorData() {
    float distance = readDistance();
    int light = readLight();
    
    // Auto-lighting control
    if (light < LIGHT_THRESHOLD) {
        digitalWrite(LED_PIN, HIGH);
    }
    
    // Publish light data
    JsonDocument lightDoc;
    lightDoc["device_id"] = DEVICE_ID;
    lightDoc["value"] = light;
    lightDoc["threshold"] = LIGHT_THRESHOLD;
    lightDoc["led_active"] = (light < LIGHT_THRESHOLD);
    char lightBuffer[256];
    serializeJson(lightDoc, lightBuffer);
    mqttClient.publish(TOPIC_LIGHT, lightBuffer);
    
    // Publish distance data
    JsonDocument distDoc;
    distDoc["device_id"] = DEVICE_ID;
    distDoc["distance_cm"] = distance;
    distDoc["presence"] = (distance < PRESENCE_MAX_CM);
    distDoc["posture_alert"] = (distance < POSTURE_MIN_CM);
    char distBuffer[256];
    serializeJson(distDoc, distBuffer);
    mqttClient.publish(TOPIC_DISTANCE, distBuffer);
}