#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

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
  uint8_t FaultCode;
};

Adafruit_MAX31855 thermocouple(MAXCLK, MAXCS, MAXDO);
unsigned long lastSendMs = 0;
int espNowChannel = 0;

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

int scanConfiguredWifiChannel() {
  Serial.print("Scanning for WiFi SSID ");
  Serial.println(WIFI_SSID);

  int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 0) {
    Serial.print("WiFi scan failed: ");
    Serial.println(networkCount);
    return 0;
  }

  int bestChannel = 0;
  int bestRssi = -1000;
  for (int i = 0; i < networkCount; i++) {
    if (WiFi.SSID(i) == WIFI_SSID && WiFi.RSSI(i) > bestRssi) {
      bestRssi = WiFi.RSSI(i);
      bestChannel = WiFi.channel(i);
    }
  }

  if (bestChannel > 0) {
    Serial.print("Found configured SSID. RSSI=");
    Serial.print(bestRssi);
    Serial.print(" dBm channel=");
    Serial.println(bestChannel);
  } else {
    Serial.print("Configured SSID not found. Networks seen=");
    Serial.println(networkCount);
  }

  return bestChannel;
}

bool setEspNowChannel(int channel) {
  if (channel <= 0) {
    return false;
  }

  WiFi.disconnect(false);
  WiFi.scanDelete();
  delay(100);

  esp_wifi_set_ps(WIFI_PS_NONE);
  esp_err_t result = esp_wifi_set_promiscuous(true);
  if (result != ESP_OK) {
    Serial.print("ESP-NOW promiscuous enable failed. error=");
    Serial.println(result);
  }

  result = esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (result == ESP_OK) {
    espNowChannel = channel;
    Serial.print("ESP-NOW channel set to ");
    Serial.println(channel);
    return true;
  } else {
    Serial.print("ESP-NOW channel set failed. error=");
    Serial.println(result);
    return false;
  }
}

void connectWifiForChannel() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  int scannedChannel = scanConfiguredWifiChannel();
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
    setEspNowChannel(WiFi.channel());
  } else {
    Serial.println("WiFi not connected.");
    if (scannedChannel > 0) {
      Serial.println("Using scanned WiFi channel for ESP-NOW.");
      if (!setEspNowChannel(scannedChannel)) {
        espNowChannel = scannedChannel;
        Serial.print("Peer will still use scanned channel ");
        Serial.println(espNowChannel);
      }
    } else {
      Serial.println("ESP-NOW will try default channel.");
    }
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
  peerInfo.channel = espNowChannel > 0 ? espNowChannel : 0;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to add gateway peer.");
    return false;
  }

  Serial.print("Gateway peer added: ");
  Serial.println(macToString(gatewayAddress));
  if (peerInfo.channel > 0) {
    Serial.print("Gateway peer channel: ");
    Serial.println(peerInfo.channel);
  }
  return true;
}

uint8_t readFaultCode() {
  uint8_t error = thermocouple.readError();
  uint8_t faultCode = 0;
  if (error & MAX31855_FAULT_OPEN) {
    faultCode |= 0x01;
  }
  if (error & MAX31855_FAULT_SHORT_GND) {
    faultCode |= 0x02;
  }
  if (error & MAX31855_FAULT_SHORT_VCC) {
    faultCode |= 0x04;
  }
  return faultCode;
}

float readTemperatureC(uint8_t &faultCode) {
  double c = thermocouple.readCelsius();
  if (isnan(c)) {
    faultCode = readFaultCode();
    Serial.print("Thermocouple fault:");
    if (faultCode & 0x01) {
      Serial.print(" OPEN");
    }
    if (faultCode & 0x02) {
      Serial.print(" SHORT_GND");
    }
    if (faultCode & 0x04) {
      Serial.print(" SHORT_VCC");
    }
    if (faultCode == 0) {
      Serial.print(" UNKNOWN");
    }
    Serial.println();
    return NAN;
  }
  faultCode = 0;
  return static_cast<float>(c);
}

void sendTemperature() {
  TemperatureMessage message;
  message.NodeID = NODE_ID;
  message.Temperature = readTemperatureC(message.FaultCode);

  Serial.print("Temp");
  Serial.print(NODE_ID);
  Serial.print(" reading=");
  if (isnan(message.Temperature)) {
    Serial.print("FAULT/NAN");
    Serial.print(" code=");
    Serial.print(message.FaultCode);
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
