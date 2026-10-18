export const BLINK = `// FIRST LIGHT\n// GPIO 2 → breadboard → 220 Ω resistor → LED → GND\n// Change the delay. Make it yours.\n\nconst int LED_PIN = 2;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n  Serial.println("Hello, Circuit Lab.");\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("Light on");\n  delay(500);\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("Light off");\n  delay(500);\n}\n`;

export const EXAMPLES = {blink:BLINK,button:`// Button: IO4 → terminal 1, GND → terminal 2\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n  pinMode(2, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  int pressed = digitalRead(4) == LOW;\n  digitalWrite(2, pressed);\n  Serial.println(pressed);\n  delay(20);\n}\n`,analog:`// Pot: VCC → 3V3, GND → GND, W → VP (GPIO 36)\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(36, INPUT);\n}\nvoid loop() {\n  int value = analogRead(36);\n  Serial.println(value);\n  delay(100);\n}\n`,oled:`// OLED: VCC → 3V3, GND → GND, SDA → IO21, SCL → IO22\n// OLED is a built-in Lab API, not the Adafruit library.\nvoid setup() {\n  Wire.begin(21, 22);\n  OLED.begin(0x3C);\n  OLED.clear();\n  OLED.println("Hello, world!");\n  OLED.println("Made in Circuit Lab");\n  OLED.display();\n}\nvoid loop() {\n  delay(100);\n}\n`,pwm:`// Averaged PWM electrical model, 8-bit resolution\nvoid setup() {\n  ledcAttach(2, 1000, 8);\n}\nvoid loop() {\n  for (int level = 0; level < 256; level += 5) {\n    ledcWrite(2, level);\n    delay(20);\n  }\n  for (int level = 255; level > 0; level -= 5) {\n    ledcWrite(2, level);\n    delay(20);\n  }\n}\n`};

EXAMPLES.lcd=`// Generic 3.3 V LCD backpack; Lab text API
void setup() {
  Wire.begin(21, 22);
  LCD.begin(0x27);
  LCD.clear();
  LCD.println("CIRCUIT LAB");
  LCD.println("Hello, hardware!");
  LCD.display();
}
void loop() { delay(100); }
`;

export const WIFI_SENDER=`// Virtual Wi-Fi + UDP. This board creates the access point.
int state = 0;
void setup() {
  Serial.begin(115200);
  WiFi.softAP("CircuitLab", "learn1234", 6);
  UDP.begin(4210);
}
void loop() {
  state = !state;
  UDP.beginPacket("192.168.4.255", 4210);
  UDP.print(state);
  UDP.endPacket();
  Serial.println(state);
  delay(500);
}
`;

export const WIFI_RECEIVER=`// This board joins the AP and drives its wired LED.
void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(115200);
  WiFi.begin("CircuitLab", "learn1234", 6);
  UDP.begin(4210);
}
void loop() {
  if (UDP.parsePacket()) {
    String message = UDP.readString();
    digitalWrite(2, message == "1");
    Serial.println(message);
  }
  delay(1);
}
`;
