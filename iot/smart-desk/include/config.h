#ifndef CONFIG_H
#define CONFIG_H

// WiFi Credentials
#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASSWORD "your_wifi_password"

// MQTT Broker
#define MQTT_BROKER "192.168.1.100"  // Your server IP
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASSWORD ""

// Device Identity
#define DEVICE_ID "smart-desk-001"
#define DEVICE_API_KEY "your_device_api_key"

// MQTT Topics (namespaced per device)
#define TOPIC_LIGHT "gyanavriksha/devices/" DEVICE_ID "/sensors/light"
#define TOPIC_DISTANCE "gyanavriksha/devices/" DEVICE_ID "/sensors/distance"
#define TOPIC_STATUS "gyanavriksha/devices/" DEVICE_ID "/status"
#define TOPIC_LED_CMD "gyanavriksha/devices/" DEVICE_ID "/commands/led"

// Sensor Pins
#define LDR_PIN 34            // Analog pin for LDR
#define LED_PIN 2             // Digital pin for White LED
#define ULTRASONIC_TRIG 5     // HC-SR04 Trigger
#define ULTRASONIC_ECHO 18    // HC-SR04 Echo

// Thresholds
#define LIGHT_THRESHOLD 300   // Below this = too dark, activate LED
#define POSTURE_MIN_CM 30     // Closer than this = posture alert
#define PRESENCE_MAX_CM 150   // Further than this = student absent
#define POSTURE_ALERT_SEC 10  // Seconds before posture alert triggers

// Timing
#define SENSOR_READ_INTERVAL 1000   // Read sensors every 1 second
#define MQTT_PUBLISH_INTERVAL 5000  // Publish to MQTT every 5 seconds

#endif