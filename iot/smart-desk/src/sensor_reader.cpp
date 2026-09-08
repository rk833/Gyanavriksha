#include <Arduino.h>
#include "config.h"
#include "sensor_reader.h"

static float g_distanceWindow[DISTANCE_FILTER_WINDOW] = {0};
static size_t g_distanceWindowCount = 0;
static size_t g_distanceWindowCursor = 0;

static float readDistanceRaw() {
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

static float filteredDistance(float reading) {
    if (reading > 0.0f) {
        g_distanceWindow[g_distanceWindowCursor] = reading;
        g_distanceWindowCursor = (g_distanceWindowCursor + 1) % DISTANCE_FILTER_WINDOW;
        if (g_distanceWindowCount < DISTANCE_FILTER_WINDOW) {
            g_distanceWindowCount++;
        }
    }
    if (g_distanceWindowCount == 0) {
        return -1.0f;
    }
    float total = 0.0f;
    for (size_t i = 0; i < g_distanceWindowCount; i++) {
        total += g_distanceWindow[i];
    }
    return total / static_cast<float>(g_distanceWindowCount);
}

static int readLightRaw() {
    if (LDR_USE_DIGITAL_OUTPUT) {
        int doState = digitalRead(LDR_PIN);
        return doState == LDR_DO_DARK_STATE ? 0 : 4095;
    }
    return analogRead(LDR_PIN);
}

static const char* lightBucketLabel(int lightValue) {
    if (lightValue <= LDR_BUCKET_DIM_MAX) return "dim";
    if (lightValue <= LDR_BUCKET_NORMAL_MAX) return "normal";
    if (lightValue <= LDR_BUCKET_BRIGHT_MAX) return "bright";
    return "invalid";
}

static const char* distanceStateLabel(float distanceCm) {
    if (distanceCm < 0.0f) return "sensor_unavailable";
    if (distanceCm < DISTANCE_TOO_CLOSE_CM) return "too_close";
    if (distanceCm <= DISTANCE_PRESENT_MAX_CM) return "present";
    return "away";
}

void sensorReaderBegin() {
    pinMode(LED_PIN, OUTPUT);
    pinMode(ULTRASONIC_TRIG, OUTPUT);
    pinMode(ULTRASONIC_ECHO, INPUT);
    if (LDR_USE_DIGITAL_OUTPUT) {
        pinMode(LDR_PIN, INPUT);
    }
}

SensorSnapshot sensorReadSnapshot() {
    SensorSnapshot s{};
    s.lightRaw = readLightRaw();
    s.lightBucket = lightBucketLabel(s.lightRaw);
    s.distanceCm = filteredDistance(readDistanceRaw());
    s.distanceState = distanceStateLabel(s.distanceCm);
    s.presence = s.distanceCm > 0.0f && s.distanceCm <= DISTANCE_PRESENT_MAX_CM;
    s.postureAlert = s.distanceCm > 0.0f && s.distanceCm < DISTANCE_TOO_CLOSE_CM;
    return s;
}
