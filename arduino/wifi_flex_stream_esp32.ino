/*
  ESP32 flex sensor streamer for wireless calibration.

  Reads one flex sensor on an analog pin and pushes text lines like:
    Flex raw value: 712

  The laptop calibration tool can listen in TCP mode:
    python3 arduino/test.py calibrate --source tcp --tcp-port 8765 ...

  Update WIFI_SSID, WIFI_PASSWORD, and LAPTOP_IP before uploading.
*/

#include <WiFi.h>

const char* WIFI_SSID = "ccny-wifi";
const char* WIFI_PASSWORD = "Johnson19701971!";
const char* LAPTOP_IP = "192.168.88.4";
const uint16_t LAPTOP_PORT = 8765;

const int FLEX_PIN = 34;
const unsigned long SAMPLE_INTERVAL_MS = 100;

WiFiClient client;
unsigned long lastSentAt = 0;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectLaptop() {
  while (!client.connected()) {
    client.connect(LAPTOP_IP, LAPTOP_PORT);
    if (!client.connected()) {
      delay(1000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  connectWifi();
  connectLaptop();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if (!client.connected()) {
    connectLaptop();
  }

  unsigned long now = millis();
  if (now - lastSentAt >= SAMPLE_INTERVAL_MS) {
    int raw = analogRead(FLEX_PIN);
    client.print("Flex raw value: ");
    client.println(raw);
    lastSentAt = now;
  }
}
