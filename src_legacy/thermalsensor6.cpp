#include <Arduino.h>
#include <SPI.h>
#include "Adafruit_MAX31855.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "Adafruit_GFX.h"
#include "Adafruit_ILI9341.h"


// digital IO pins. make sure the variable is connected to the right pin
#define MAXDO   12
#define MAXCS   10
#define MAXCLK  13
#define LED1    5
#define LED2    6
#define TFT_CS   10
#define TFT_DC    9
#define TFT_RST   8 // Use -1 if connected to Arduino RESET pin

// Initialize Adafruit ILI9341
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);

// initialize the Thermocouple
Adafruit_MAX31855 thermocouple(MAXCLK, MAXCS, MAXDO);

//Setting up WiFi  and Web App details
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

//replace Web App URL below with your own
const char* scriptURL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

void setup() {
  Serial.begin(9600);
 pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);

  /* tft.begin();
  tft.setRotation(1);
 
  tft.fillScreen(ILI9341_WHITE); // Clear screen with a background color */

  while (!Serial) delay(1); // wait for Serial 

  Serial.println("MAX31855 test");
  // wait for chip to stabilize
  delay(500);
  Serial.print("Initializing sensor...");
  if (!thermocouple.begin()) {
    Serial.println("ERROR.");
    while (1) delay(10);
    
    
  }

   WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);
   
    WiFi.begin(ssid, password);
    Serial.println("\nConnecting");

    while(WiFi.status() != WL_CONNECTED){
        Serial.print(".");
        delay(100);
         digitalWrite(LED1, HIGH);
         delay(1000);
         digitalWrite(LED1,LOW);
         delay(1000);
    }
    Serial.println("\nConnected to the WiFi network");
  // OPTIONAL: Can configure fault checks as desired (default is ALL)
  // Multiple checks can be logically OR'd together.
  // thermocouple.setFaultChecks(MAX31855_FAULT_OPEN | MAX31855_FAULT_SHORT_VCC);  // short to GND fault is ignored
    tft.setCursor(20, 20);
    tft.setTextColor(ILI9341_BLACK);
    tft.setTextSize(2);
    tft.println("Temperature:");

  Serial.println("DONE."); 
}

void loop() {
  // basic readout test, just print the current temp
   Serial.print("Internal Temp = ");
   Serial.println(thermocouple.readInternal());

   double c = thermocouple.readCelsius();
   if (isnan(c)) {
     Serial.println("Thermocouple fault(s) detected!");
     uint8_t e = thermocouple.readError();
     if (e & MAX31855_FAULT_OPEN) Serial.println("FAULT: Thermocouple is open - no connections.");
     if (e & MAX31855_FAULT_SHORT_GND) Serial.println("FAULT: Thermocouple is short-circuited to GND.");
     if (e & MAX31855_FAULT_SHORT_VCC) Serial.println("FAULT: Thermocouple is short-circuited to VCC.");
   } else {
     Serial.print("C = ");
     Serial.println(c);

    digitalWrite(LED2, HIGH);
    digitalWrite(LED2, LOW);

   }


    //temp data will be sent to the google sheet while connected to wifi
   if(WiFi.status()==WL_CONNECTED) {
    digitalWrite(LED1, HIGH);
    digitalWrite(LED2, HIGH);

    tft.setCursor(20, 20);
    tft.setTextColor(ILI9341_BLACK);
    tft.setTextSize(2);
    tft.println("Connected to wifi network");

    tft.fillRect(10, 40, 100, 20, ILI9341_BLACK);

    tft.setCursor(10, 40);
    tft.setTextColor(ILI9341_GREEN);
    tft.print(c);
    tft.print(" C");
    delay(1000);

    WiFiClientSecure client;
    client.setInsecure();   // skip certificate validation

    HTTPClient http;
    http.begin(client, scriptURL);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.addHeader("Content-Type", "application/json");
    
    float temp = c;
    String jsonData = "{\"method\":\"append\",\"temp6\":" + String(temp) + "}";
    int httpResponseCode = http.POST(jsonData);
    Serial.println("Response Code: " + String(httpResponseCode));

    String payload = http.getString();
    Serial.println(payload);
    http.end();
    }
    else{
      Serial.println("WiFi Disconnected");
      digitalWrite(LED1, HIGH);
      delay(1000);
      digitalWrite(LED1,LOW);
      delay(1000);

      tft.setCursor(10, 40);// adjust if needed
      tft.setTextColor(ILI9341_RED);
      tft.print(" WiFi Disconnected");
      delay(1000);

    }



   delay(1000);
}
