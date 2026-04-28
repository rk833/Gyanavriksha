#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>

typedef void (*MqttLedCommandHandler)(bool ledOn);

void mqttBegin(MqttLedCommandHandler ledHandler);
void mqttEnsureConnected(unsigned long nowMs);
void mqttLoop();
bool mqttIsConnected();
bool mqttPublish(const char* topic, const char* payload);
void mqttPublishHeartbeat(unsigned long nowMs);
int mqttStateCode();

#endif
