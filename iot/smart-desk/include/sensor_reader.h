#ifndef SENSOR_READER_H
#define SENSOR_READER_H

#include <Arduino.h>

struct SensorSnapshot {
    int lightRaw;
    const char* lightBucket;
    float distanceCm;
    const char* distanceState;
    bool presence;
    bool postureAlert;
};

void sensorReaderBegin();
SensorSnapshot sensorReadSnapshot();

#endif
