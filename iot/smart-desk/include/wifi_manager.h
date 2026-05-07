#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

void wifiBegin();
void wifiEnsureConnected(unsigned long nowMs);
bool wifiIsConnected();
void wifiPrintStatus();

#endif
