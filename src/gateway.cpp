#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_now.h>

#include "secrets.h"

struct LegacyTemperatureMessage {
  int NodeID;
  float Temperature;
};

struct TemperatureMessage {
  int NodeID;
  float Temperature;
  uint8_t FaultCode;
};

struct NodeState {
  float temperature = NAN;
  unsigned long lastSeenMs = 0;
  uint32_t packets = 0;
  uint8_t faultCode = 0;
};

constexpr int kNodeCount = 8;
constexpr unsigned long kUploadIntervalMs = 5000;
constexpr unsigned long kStaleAfterMs = 30000;
constexpr unsigned long kWifiConnectTimeoutMs = 20000;

NodeState nodes[kNodeCount];
unsigned long lastUploadMs = 0;
bool everReceivedData = false;
bool scannedWifi = false;

String macToString(const uint8_t *mac) {
  char buffer[18];
  snprintf(buffer, sizeof(buffer), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0],
           mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buffer);
}

bool isFresh(int index) {
  return nodes[index].lastSeenMs != 0 &&
         millis() - nodes[index].lastSeenMs <= kStaleAfterMs &&
         !isnan(nodes[index].temperature);
}

const char *nodeStatus(int index) {
  if (nodes[index].lastSeenMs == 0) {
    return "MISSING";
  }
  if (millis() - nodes[index].lastSeenMs > kStaleAfterMs) {
    return "STALE";
  }
  if (isnan(nodes[index].temperature) || nodes[index].faultCode != 0) {
    return "FAULT";
  }
  return "OK";
}

const char *faultName(uint8_t faultCode) {
  if (faultCode == 0) {
    return "NONE";
  }
  if (faultCode & 0x01) {
    return "OPEN";
  }
  if (faultCode & 0x02) {
    return "SHORT_GND";
  }
  if (faultCode & 0x04) {
    return "SHORT_VCC";
  }
  return "UNKNOWN";
}

unsigned long nodeAgeSeconds(int index) {
  if (nodes[index].lastSeenMs == 0) {
    return 0;
  }
  return (millis() - nodes[index].lastSeenMs) / 1000;
}

const char *wifiStatusName(wl_status_t status) {
  switch (status) {
  case WL_IDLE_STATUS:
    return "WL_IDLE_STATUS";
  case WL_NO_SSID_AVAIL:
    return "WL_NO_SSID_AVAIL";
  case WL_SCAN_COMPLETED:
    return "WL_SCAN_COMPLETED";
  case WL_CONNECTED:
    return "WL_CONNECTED";
  case WL_CONNECT_FAILED:
    return "WL_CONNECT_FAILED";
  case WL_CONNECTION_LOST:
    return "WL_CONNECTION_LOST";
  case WL_DISCONNECTED:
    return "WL_DISCONNECTED";
  default:
    return "UNKNOWN";
  }
}

void scanConfiguredWifiOnce() {
  if (scannedWifi) {
    return;
  }
  scannedWifi = true;

  Serial.print("Scanning for WiFi SSID ");
  Serial.println(WIFI_SSID);
  int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 0) {
    Serial.print("WiFi scan failed: ");
    Serial.println(networkCount);
    return;
  }

  bool found = false;
  for (int i = 0; i < networkCount; i++) {
    if (WiFi.SSID(i) == WIFI_SSID) {
      found = true;
      Serial.print("Found configured SSID. RSSI=");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm channel=");
      Serial.print(WiFi.channel(i));
      Serial.print(" encryption=");
      Serial.println(WiFi.encryptionType(i));
    }
  }

  if (!found) {
    Serial.print("Configured SSID not found. Networks seen=");
    Serial.println(networkCount);
  }
}

bool connectWifi(unsigned long timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  scanConfiguredWifiOnce();
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. IP=");
    Serial.print(WiFi.localIP());
    Serial.print(" channel=");
    Serial.println(WiFi.channel());
    return true;
  }

  Serial.print("WiFi not connected. status=");
  Serial.print(static_cast<int>(WiFi.status()));
  Serial.print(" ");
  Serial.println(wifiStatusName(WiFi.status()));
  Serial.println("Gateway will keep receiving ESP-NOW.");
  return false;
}

void onDataReceived(const uint8_t *macAddress, const uint8_t *data, int length) {
  if (length < static_cast<int>(sizeof(LegacyTemperatureMessage))) {
    Serial.print("Ignored short packet from ");
    Serial.print(macToString(macAddress));
    Serial.print(" length=");
    Serial.println(length);
    return;
  }

  TemperatureMessage message = {};
  if (length >= static_cast<int>(sizeof(TemperatureMessage))) {
    memcpy(&message, data, sizeof(message));
  } else {
    LegacyTemperatureMessage legacyMessage;
    memcpy(&legacyMessage, data, sizeof(legacyMessage));
    message.NodeID = legacyMessage.NodeID;
    message.Temperature = legacyMessage.Temperature;
    message.FaultCode = isnan(legacyMessage.Temperature) ? 0x80 : 0;
  }

  if (message.NodeID < 1 || message.NodeID > kNodeCount) {
    Serial.print("Invalid NodeID from ");
    Serial.print(macToString(macAddress));
    Serial.print(": ");
    Serial.println(message.NodeID);
    return;
  }

  int index = message.NodeID - 1;
  nodes[index].temperature = message.Temperature;
  nodes[index].lastSeenMs = millis();
  nodes[index].packets++;
  nodes[index].faultCode = message.FaultCode;
  everReceivedData = true;

  Serial.print("RX ");
  Serial.print(macToString(macAddress));
  Serial.print(" Temp");
  Serial.print(message.NodeID);
  Serial.print(" = ");
  if (isnan(message.Temperature)) {
    Serial.print("FAULT/NAN");
  } else {
    Serial.print(message.Temperature, 2);
    Serial.print(" C");
  }
  if (message.FaultCode != 0) {
    Serial.print(" fault=");
    Serial.print(faultName(message.FaultCode));
  }
  Serial.print(" packets=");
  Serial.println(nodes[index].packets);
}

void addTemperature(JsonDocument &doc, int index) {
  char key[8];
  char statusKey[16];
  char ageKey[20];
  char packetsKey[20];
  char faultKey[20];
  snprintf(key, sizeof(key), "Temp%d", index + 1);
  snprintf(statusKey, sizeof(statusKey), "Temp%d_Status", index + 1);
  snprintf(ageKey, sizeof(ageKey), "Temp%d_AgeSec", index + 1);
  snprintf(packetsKey, sizeof(packetsKey), "Temp%d_Packets", index + 1);
  snprintf(faultKey, sizeof(faultKey), "Temp%d_Fault", index + 1);

  if (isFresh(index)) {
    doc[key] = nodes[index].temperature;
  } else {
    doc[key] = nullptr;
  }
  doc[statusKey] = nodeStatus(index);
  if (nodes[index].lastSeenMs == 0) {
    doc[ageKey] = nullptr;
  } else {
    doc[ageKey] = nodeAgeSeconds(index);
  }
  doc[packetsKey] = nodes[index].packets;
  doc[faultKey] = faultName(nodes[index].faultCode);
}

void printStatus() {
  Serial.print("Status:");
  for (int i = 0; i < kNodeCount; i++) {
    Serial.print(" T");
    Serial.print(i + 1);
    Serial.print("=");
    if (isFresh(i)) {
      Serial.print(nodes[i].temperature, 1);
      Serial.print("C");
    } else if (nodes[i].lastSeenMs == 0) {
      Serial.print("never");
    } else {
      Serial.print("stale ");
      Serial.print((millis() - nodes[i].lastSeenMs) / 1000);
      Serial.print("s");
    }
  }
  Serial.println();
}

void uploadToGoogleSheet() {
  if (!everReceivedData) {
    Serial.println("No node data received yet; skipping upload.");
    return;
  }

  if (!connectWifi(10000)) {
    Serial.println("Upload skipped because WiFi is disconnected.");
    return;
  }

  JsonDocument doc;
  doc["method"] = "append";
  doc["GatewayStatus"] = WiFi.status() == WL_CONNECTED ? "OK" : "WIFI_DOWN";
  for (int i = 0; i < kNodeCount; i++) {
    addTemperature(doc, i);
  }

  String jsonData;
  serializeJson(doc, jsonData);

  Serial.print("Uploading: ");
  Serial.println(jsonData);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  if (!http.begin(client, GOOGLE_SCRIPT_URL)) {
    Serial.println("HTTP begin failed.");
    return;
  }
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(jsonData);
  String response = http.getString();

  if (code >= 200 && code < 400) {
    Serial.print("Sheet upload accepted. code=");
    Serial.println(code);
  } else {
    Serial.print("Sheet response code=");
    Serial.print(code);
    Serial.print(" body=");
    Serial.println(response);
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("ReactorDAQ Gateway starting");
  WiFi.mode(WIFI_STA);
  Serial.print("Gateway MAC: ");
  Serial.println(WiFi.macAddress());

  connectWifi(kWifiConnectTimeoutMs);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed.");
    return;
  }

  esp_now_register_recv_cb(onDataReceived);
  Serial.println("ESP-NOW receiver ready.");
}

void loop() {
  if (millis() - lastUploadMs >= kUploadIntervalMs) {
    lastUploadMs = millis();
    printStatus();
    uploadToGoogleSheet();
  }
}
