#include <Wifi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Arduino.h>
#include <esp_now.h>
#include <ArduinoJson.h>


const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* scriptURL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";


typedef struct TemperatureMessage {
int NodeID;
float Temperature;
} TemperatureMessage;

TemperatureMessage incomingData;

float temperature[8]= {0,0,0,0,0,0,0,0};

bool receivedData[8] = {false, false, false, false, false, false, false, false};

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000; // 10 seconds

void onDataReceived(const uint8_t *macAddress, const uint8_t *data, int length) {
  memcpy(&incomingData, data, sizeof(incomingData));
    int nodeID = incomingData.NodeID;
    float temp = incomingData.Temperature;

    if(nodeID < 1 || nodeID > 8) {
        Serial.println("Received data from invalid node ID: ");
        return;
    }

     int index = nodeID - 1;

     temperature[index] = temp;
        receivedData[index] = true;
    
    Serial.print("Received data from Temp ");
    Serial.print(nodeID);
    Serial.print(": ");
    Serial.println(temp);
    Serial.println(" °C");
  }

 void setup() {
    Serial.begin(9600);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");

    Serial.println();
    Serial.println("Connected to WiFi network: ");
    Serial.println(ssid);
    Serial.println("Central node MAC Address: ");
    Serial.println(WiFi.macAddress());
    Serial.println("Central node IP Address: ");
    Serial.println(WiFi.localIP());
    
    if (esp_now_init() != ESP_OK) {
        Serial.println("Error initializing ESP-NOW");
        return;
    }

    Serial.println("ESP-NOW initialized successfully");
     esp_now_register_recv_cb (onDataReceived);
    
    Serial.println("Central node ready to receive data from sensor nodes");

 }

void loop() {
if(millis()- lastSendTime >= sendInterval) {
    lastSendTime = millis();

    if(anyDataReceived()) {
        sendCombinedDataToGoogleSheet();

    } else {
        Serial.println("No data received from sensor nodes yet.");
        }
    }
}

bool anyDataReceived() {
    for(int i = 0; i < 8; i++) {
        if(receivedData[i]) {
            return true;
        }
    }
    return false;
}

void sendCombinedDataToGoogleSheet() {
    if(WiFi.status() != WL_CONNECTED) {
       Serial.println("WiFi disconnected. Reconnecting...");

       WiFi.begin(ssid, password);
       while (WiFi.status()!= WL_CONNECTED && attempts < 10) {
         delay(500);
         Serial.println(".");
        attempts++;
        }
     
        if(WiFi.status() == WL_CONNECTED) {
            Serial.println();
            Serial.println("Could not reconnect to WiFi");
            return;
        }
        Serial.println();
        Serial.println("Reconnected to WiFi");
}

    StaticJsonDocument<300> doc;

    doc["T1"] = receivedData[0] ? temperatures[0] : nullptr;
    doc["T2"] = receivedData[1] ? temperatures[1] : nullptr;
    doc["T3"] = receivedData[2] ? temperatures[2] : nullptr;
    doc["T4"] = receivedData[3] ? temperatures[3] : nullptr;
    doc["T5"] = receivedData[4] ? temperatures[4] : nullptr;
    doc["T6"] = receivedData[5] ? temperatures[5] : nullptr;
    doc["T7"] = receivedData[6] ? temperatures[6] : nullptr;
    doc["T8"] = receivedData[7] ? temperatures[7] : nullptr;

    String jsonData;
    serializeJson(doc, jsonData);

    Serial.println("Sending combined data to Google Sheet: ");
    Serial.println(jsonData);

    WifiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.begin(client, scriptURL);
    http.addHeader("Content-Type", "application/json");
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    int httpResponseCode = http.POST(jsonData);

    Serial.println("Google Sheet Response Code: ");
    Serial.println(httpResponseCode);

    string response = http.getString();
    Serial.println("Google Sheet Response: ");
    Serial.println(response);

    http.end();
}

