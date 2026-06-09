#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <esp_now.h>

#include "Adafruit_MAX31855.h"
#include "secrets.h"

#ifndef NODE_ID
#define NODE_ID 1
#endif

static_assert(NODE_ID >= 1 && NODE_ID <= 8, "NODE_ID must be 1 through 8");

constexpr int MAXDO = 12;
constexpr int MAXCS = 10;
constexpr int MAXCLK = 13;
constexpr int LED1 = 5;
constexpr int LED2 = 6;
constexpr unsigned long kSendIntervalMs = 5000;
constexpr unsigned long kWifiConnectTimeoutMs = 15000;

uint8_t gatewayAddress[] = {0xE4, 0xB0, 0x63, 0xAE, 0xB7, 0x2C};

struct TemperatureMessage {
  int NodeID;
  float Temperature;
};

Adafruit_MAX31855 thermocouple(MAXCLK, MAXCS, MAXDO);
unsigned long lastSendMs = 0;

String macToString(const uint8_t *mac) {
  char buffer[18];
  snprintf(buffer, sizeof(buffer), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0],
           mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buffer);
}

void onDataSent(const uint8_t *macAddress, esp_now_send_status_t status) {
  Serial.print("ESP-NOW send to ");
  Serial.print(macToString(macAddress));
  Serial.print(": ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "success" : "failed");
}

void connectWifiForChannel() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting WiFi for channel sync");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < kWifiConnectTimeoutMs) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. channel=");
    Serial.println(WiFi.channel());
  } else {
    Serial.println("WiFi not connected. ESP-NOW will try default channel.");
  }
}

bool setupEspNow() {
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed.");
    return false;
  }

  esp_now_register_send_cb(onDataSent);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, gatewayAddress, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to add gateway peer.");
    return false;
  }

  Serial.print("Gateway peer added: ");
  Serial.println(macToString(gatewayAddress));
  return true;
}

float readTemperatureC() {
  double c = thermocouple.readCelsius();
  if (isnan(c)) {
    uint8_t error = thermocouple.readError();
    Serial.print("Thermocouple fault:");
    if (error & MAX31855_FAULT_OPEN) {
      Serial.print(" OPEN");
    }
    if (error & MAX31855_FAULT_SHORT_GND) {
      Serial.print(" SHORT_GND");
    }
    if (error & MAX31855_FAULT_SHORT_VCC) {
      Serial.print(" SHORT_VCC");
    }
    Serial.println();
    return NAN;
  }
  return static_cast<float>(c);
}

void sendTemperature() {
  TemperatureMessage message;
  message.NodeID = NODE_ID;
  message.Temperature = readTemperatureC();

  Serial.print("Temp");
  Serial.print(NODE_ID);
  Serial.print(" reading=");
  if (isnan(message.Temperature)) {
    Serial.print("FAULT/NAN");
  } else {
    Serial.print(message.Temperature, 2);
    Serial.print(" C");
  }
  Serial.println();

  esp_err_t result =
      esp_now_send(gatewayAddress, reinterpret_cast<uint8_t *>(&message),
                   sizeof(message));

  if (result != ESP_OK) {
    Serial.print("esp_now_send error=");
    Serial.println(result);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);

  Serial.println();
  Serial.print("ReactorDAQ Temp");
  Serial.print(NODE_ID);
  Serial.println(" node starting");

  WiFi.mode(WIFI_STA);
  Serial.print("Node MAC: ");
  Serial.println(WiFi.macAddress());

  Serial.print("Initializing MAX31855...");
  if (!thermocouple.begin()) {
    Serial.println("failed.");
  } else {
    Serial.println("ok.");
  }

  connectWifiForChannel();
  setupEspNow();
}

void loop() {
  if (millis() - lastSendMs >= kSendIntervalMs) {
    lastSendMs = millis();
    digitalWrite(LED1, HIGH);
    sendTemperature();
    digitalWrite(LED1, LOW);
  }
}
