#include <WiFiNINA.h>
#include <ArduinoHttpClient.h>  // talk to web server
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

#include "arduino_secrets.h"    // hiding SSID and password in a header

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
int status = WL_IDLE_STATUS;

char serverAddress[] = "vivariho.me";
int port = 3030;

int fails = 0, attempts = 0;

WiFiClient wifi;
HttpClient client = HttpClient(wifi, serverAddress, port);

// DIGITAL PINS
#define TEMP_PIN 0
#define HUM_PIN 1
#define MIST_PIN 2
#define DOOR_L_PIN 3
#define DOOR_R_PIN 4

// DS18B20 Temp Sensor OneWire
OneWire temp(TEMP_PIN);
DallasTemperature sensors(&temp);

// DHT22 Hum/Temp Sensor
#define DHTTYPE DHT22
DHT dht(HUM_PIN, DHTTYPE);

// DS18B20 Addresses
// Probe1 - 0x28, 0x7E, 0x38, 0x95, 0xF0, 0x01, 0x3C, 0x1B
// Probe2 - 0x28, 0x89, 0xED, 0x95, 0xF0, 0x01, 0x3C, 0x60
// Probe3 - 0x28, 0x52, 0x76, 0x95, 0xF0, 0x01, 0x3C, 0x9B
// Probe4 - 0x28, 0xBB, 0xBB, 0x95, 0xF0, 0x01, 0x3C, 0xEA
// Probe5 - 0x28, 0xCD, 0xA5, 0x95, 0xF0, 0x01, 0x3C, 0x1E

DeviceAddress Probe1 = { 0x28, 0x7E, 0x38, 0x95, 0xF0, 0x01, 0x3C, 0x1B };
DeviceAddress Probe2 = { 0x28, 0x89, 0xED, 0x95, 0xF0, 0x01, 0x3C, 0x60 };
DeviceAddress Probe3 = { 0x28, 0x52, 0x76, 0x95, 0xF0, 0x01, 0x3C, 0x9B };
DeviceAddress Probe4 = { 0x28, 0xBB, 0xBB, 0x95, 0xF0, 0x01, 0x3C, 0xEA };
DeviceAddress Probe5 = { 0x28, 0xCD, 0xA5, 0x95, 0xF0, 0x01, 0x3C, 0x1E };

// data vars
float temp1, temp2, temp3, temp4, temp5, tempAvg, errFlag = 0, dhtHum, dhtTemp;

int tempCount, probeRes = 9, leftDoorState, rightDoorState, mistLevel;

void setup(void) {
    Serial.begin(9600);
    //while(!Serial);

    while(status != WL_CONNECTED) {
        Serial.print("Attempting to connect to network: ");
        Serial.println(ssid);

        status = WiFi.begin(ssid, pass);
    }

    Serial.println("You're connected to the network.");
    
    Serial.println();
    Serial.println("----------------------------------------");

    printData();

    Serial.println("----------------------------------------");
    Serial.println();
    
    Serial.print("Initializing Dallas Temperature Control Library Version ");
    Serial.print(DALLASTEMPLIBVERSION);
    Serial.println("...");
    Serial.println();

    sensors.begin();
    sensors.setResolution(Probe1, probeRes);
    sensors.setResolution(Probe2, probeRes);
    sensors.setResolution(Probe3, probeRes);
    sensors.setResolution(Probe4, probeRes);
    sensors.setResolution(Probe5, probeRes);

    Serial.println("Done!");
    Serial.println();
    Serial.print("Total Probes at Boot: ");
    tempCount = sensors.getDeviceCount();
    Serial.println(tempCount);
    Serial.print("Resolution: ");
    Serial.println(probeRes);
    
    Serial.println();
    Serial.println("----------------------------------------");
    Serial.println();
    
    Serial.println("Initializing DHT Sensor Library...");
    Serial.println();
    
    dht.begin();

    Serial.println("Done!");
    
    Serial.println();
    Serial.println("----------------------------------------");
    Serial.println();
    
    Serial.println("Initializing reed switches...");
    Serial.println();
    Serial.print("Left door...");

    pinMode(DOOR_L_PIN, INPUT_PULLUP);

    Serial.println("Done!");
    
    Serial.print("Right door...");

    pinMode(DOOR_R_PIN, INPUT_PULLUP);
    
    Serial.println("Done!");
    
    Serial.println();
    Serial.println("----------------------------------------");
    Serial.println();
}

void loop() {
    printTemps();
    printHumidity();
    printDoors();
    printReservoir();
    uploadData();
    resetCheck();
}

void resetCheck() {
    if ((attempts - fails) >= 15000 || fails > 50) {
        NVIC_SystemReset();
    }
}

void printReservoir() {
    Serial.println();

    Serial.print("Mist reservoir level: ");

    long duration;

    pinMode(MIST_PIN, OUTPUT);
    digitalWrite(MIST_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(MIST_PIN, HIGH);
    delayMicroseconds(5);
    digitalWrite(MIST_PIN, LOW);

    pinMode(MIST_PIN, INPUT);
    duration = pulseIn(MIST_PIN, HIGH);

    mistLevel = microsecondsToInches(duration);

    Serial.print(mistLevel);
    Serial.print("in");

    Serial.println();
    Serial.println("----------------------------------------");
}

long microsecondsToInches(long microseconds)  {
    return microseconds / 74 / 2;
}

void printDoors() {
    Serial.println();
    
    Serial.print("The left door is ");
    if (digitalRead(DOOR_L_PIN) == LOW) { // door is closed
        Serial.println("closed.");
        leftDoorState = 0;
    } else {
        Serial.println("open.");
        leftDoorState = 1;
    }

    Serial.println();
    Serial.print("The right door is ");
    if (digitalRead(DOOR_R_PIN) == LOW) { // door is closed
        Serial.println("closed.");
        rightDoorState = 0;
    } else {
        Serial.println("open.");
        rightDoorState = 1;
    }

    Serial.println();
    Serial.println("----------------------------------------");
}

void uploadData() {
    // Arduino HTTP Client

    Serial.println();
    Serial.print("Signal Strength (RSSI): ");
    Serial.println(WiFi.RSSI());
    
    String postURL = String("POST readings to " + String(serverAddress) + ':' + String(port));
    Serial.println(postURL);
    String contentType = "application/x-www-form-urlencoded";   // POST method to send data to server
    String postData = String(
        //"temp1="    + String(temp1) + 
        //"&temp2="   + String(temp2) +
        "temp3="            + String(temp3) +
        "&temp4="           + String(temp4) +
        "&temp5="           + String(temp5) +
        "&dhtHum="          + String(dhtHum) +
        "&dhtTemp="         + String(dhtTemp) +
        "&leftDoorState="   + String(leftDoorState) +
        "&rightDoorState="  + String(rightDoorState) +
        "&mistLevel="       + String(mistLevel) );
    Serial.print("Readings: ");
    Serial.println(postData);

    attempts++;
    client.post("/temperatures", contentType, postData);

    int statusCode = client.responseStatusCode();
    String response = client.responseBody();

    Serial.print("Status code: ");
    Serial.println(statusCode);
    Serial.print("Response: ");
    Serial.println(response);

    if (statusCode != 200) {
        fails++;
    }

    if (fails != 0) {
        float failureRate = ((float)fails/(float)attempts) * 100;
        Serial.print("POST has failed ");
        Serial.print(failureRate);
        Serial.print("% of the time. (Failures: ");
        Serial.print(fails);
        Serial.print("/ Attempts: ");
        Serial.print(attempts);
        Serial.println(")");
    } else {
        Serial.println("There have been no POST failures! :D");
    }

    Serial.println();
    Serial.println("----------------------------------------");

    delay(1000);
}

void printData() {
    Serial.println();
    
    Serial.println("Board information: ");
    IPAddress ip = WiFi.localIP();
    Serial.print("IP Address: ");
    Serial.println(ip);

    Serial.println();
    Serial.println("Network information: ");
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());

    long rssi = WiFi.RSSI();
    Serial.print("Signal Strength (RSSI): ");
    Serial.println(rssi);
    Serial.println();
}

void printTemps() {  
    Serial.println();

    Serial.println("Requesting temps...");
    Serial.println();
    sensors.requestTemperatures();

    //Serial.print("Probe 1:\t");
    //temp1 = sensors.getTempF(Probe1);
    //printTemperature(Probe1);
    
    //Serial.print("Probe 2:\t");
    //temp2 = sensors.getTempF(Probe2);
    //printTemperature(Probe2);
    
    Serial.print("Probe 3:\t");
    temp3 = sensors.getTempF(Probe3);
    printTemperature(Probe3);
    
    Serial.print("Probe 4:\t");
    temp4 = sensors.getTempF(Probe4);
    printTemperature(Probe4);
    
    Serial.print("Probe 5:\t");
    temp5 = sensors.getTempF(Probe5);
    printTemperature(Probe5);

    Serial.print("DHT22:\t\t");
    dhtTemp = dht.readTemperature(true);
    if (!isnan(dhtTemp)) {
        Serial.print(dht.readTemperature());
        Serial.print("\xC2\xB0");
        Serial.print("C  |  ");
        Serial.print(dhtTemp);
        Serial.print("\xC2\xB0");
        Serial.println("F");
    } else {
        Serial.print("DHT Error");
        errFlag = 1;
    }

    Serial.println();
    Serial.print("Average:\t");

    //if (temp1> 0 && temp2> 0 && temp3> 0 && temp4> 0 && temp5 > 0 && dhtTemp > 0) {
    //    errFlag = 0;
    //}

    if (temp3> 0 && temp4> 0 && temp5 > 0 && dhtTemp > 0) {
        errFlag = 0;
    }

    if (errFlag == 0) {
        //tempAvg = (temp1 + temp2 + temp3 + temp4 + temp5 + dhtTemp) / tempCount;
        tempAvg = (temp3 + temp4 + temp5 + dhtTemp) / 4;
        Serial.print(DallasTemperature::toCelsius(tempAvg));
        Serial.print("\xC2\xB0");
        Serial.print("C  |  ");
        Serial.print(tempAvg);
        Serial.print("\xC2\xB0");
        Serial.println("F");
    } else {
        Serial.print("Temp Error");
        tempAvg = -127;
    }

    Serial.println();
    Serial.println("----------------------------------------");
}

void printHumidity() {
    Serial.println();

    Serial.println("Requesting humidity...");
    Serial.println();

    dhtHum = dht.readHumidity();
    Serial.print("Humidity: ");
    Serial.print(dhtHum);
    Serial.println("%");

    Serial.println();
    Serial.println("----------------------------------------");
}

void printTemperature(DeviceAddress deviceAddress) {
    float tempC = sensors.getTempC(deviceAddress);

    if (tempC == -127.00) {
        Serial.println("Temp Error");
        errFlag = 1;
    } else {
        Serial.print(sensors.getTempC(deviceAddress));
        Serial.print("\xC2\xB0");
        Serial.print("C  |  ");
        Serial.print(sensors.getTempF(deviceAddress));
        Serial.print("\xC2\xB0");
        Serial.println("F");
    }
}
