FROM eclipse-mosquitto:latest

COPY config/mosquitto.conf /etc/mosquitto/mosquitto.conf

EXPOSE 1883
EXPOSE 9001

CMD ["mosquitto", "-c", "/etc/mosquitto/mosquitto.conf"]