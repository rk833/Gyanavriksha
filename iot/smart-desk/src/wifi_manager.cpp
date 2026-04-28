#include <WiFi.h>
#include "config.h"
#include "wifi_manager.h"

static unsigned long g_lastWifiRetryMs = 0;

static void printConnectFailureReason() {
    wl_status_t status = WiFi.status();
    if (status == WL_NO_SSID_AVAIL) {
        Serial.println("WiFi reason: SSID not found (ESP32 supports only 2.4GHz).");
    } else if (status == WL_CONNECT_FAILED) {
        Serial.println("WiFi reason: connect failed (check password/auth mode).");
    } else if (status == WL_CONNECTION_LOST) {
        Serial.println("WiFi reason: connection lost during handshake.");
    } else if (status == WL_DISCONNECTED) {
        Serial.println("WiFi reason: disconnected (check signal/router).");
    } else {
        Serial.printf("WiFi reason: status code %d\n", static_cast<int>(status));
    }
}

void wifiBegin() {
    Serial.printf("Connecting to WiFi SSID: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
        delay(500);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        wifiPrintStatus();
        return;
    }
    Serial.println("\nWiFi connect timeout.");
    printConnectFailureReason();
}

void wifiEnsureConnected(unsigned long nowMs) {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }
    if (nowMs - g_lastWifiRetryMs < WIFI_RETRY_INTERVAL_MS) {
        return;
    }
    g_lastWifiRetryMs = nowMs;
    Serial.println("WiFi reconnect attempt...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifiIsConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void wifiPrintStatus() {
    Serial.printf("WiFi connected: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
}
