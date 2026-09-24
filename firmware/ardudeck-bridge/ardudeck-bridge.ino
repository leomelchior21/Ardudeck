/*
  ArduDeck Bridge
  ===============

  Turns an Arduino Uno into a transparent I/O bridge for the ArduDeck console
  while a student is testing a flow on screen. It is replaced by the generated
  sketch when the student presses DEPLOY.

  Protocol: one ASCII line per message, 115200 baud.

    ?                 identify                    -> "OK ARDUDECK 1"
    E A0,D2,U3        stream these pins (D=digital, U=digital+pullup)
    E                 stop streaming
    e 25              streaming interval (ms)
    R D2              read once                   -> "V D2 1"
    W D9 1            digital write
    P D3 128          PWM write
    S D5 90           servo angle
    T D6 440 200      tone (frequency, duration ms)
    N D6              stop tone
    M D7 D8           measure distance (cm)       -> "C 42"
    X                 make all outputs safe

  Replies are only sent when a student would wait for them (?, R, M) or when
  something is wrong (ERR). Values are streamed as they change.

  Pins D0 and D1 are never used: they carry this serial link.
*/

#include <Servo.h>

const uint8_t PROTOCOL_VERSION = 1;
const uint8_t ARDUDECK_MAX_LINE = 48;
const uint8_t ARDUDECK_MAX_ECHO = 20;
const uint8_t ARDUDECK_MAX_SERVOS = 4;
const uint8_t ARDUDECK_MAX_OUTPUTS = 14;

struct EchoPin {
  uint8_t pin;
  bool analog;
};

EchoPin echoPins[ARDUDECK_MAX_ECHO];
uint8_t echoCount = 0;
unsigned long echoIntervalMs = 25;
unsigned long lastEchoAt = 0;

struct ServoSlot {
  uint8_t pin;
  Servo servo;
  bool attached;
};

ServoSlot servos[ARDUDECK_MAX_SERVOS];
uint8_t outputPins[ARDUDECK_MAX_OUTPUTS];
uint8_t outputCount = 0;

char lineBuffer[ARDUDECK_MAX_LINE];
uint8_t lineLength = 0;

/* Prototypes: keeps the sketch valid C++ without relying on code generation. */
void sendOk();
void sendError(const __FlashStringHelper *reason);
void readSerial();
char *nextToken(char **cursor, char delimiter);
bool parsePinToken(const char *token, uint8_t *pin, bool *analog, bool *pullup);
void markOutput(uint8_t pin);
void handleLine(char *line);
void handleWatch(char *list);
void emitEchoes();
void handleMeasure(char *trigToken, char *echoToken);
ServoSlot *findServo(uint8_t pin);
ServoSlot *allocateServo(uint8_t pin);
void makeOutputsSafe();

void sendOk() {
  Serial.print(F("OK ARDUDECK "));
  Serial.println((int)PROTOCOL_VERSION);
}

void sendError(const __FlashStringHelper *reason) {
  Serial.print(F("ERR "));
  Serial.println(reason);
}

void setup() {
  Serial.begin(115200);
  Serial.print(F("ARDUDECK READY "));
  Serial.println((int)PROTOCOL_VERSION);
}

void loop() {
  readSerial();
  if (echoCount > 0 && (unsigned long)(millis() - lastEchoAt) >= echoIntervalMs) {
    lastEchoAt = millis();
    emitEchoes();
  }
}

void readSerial() {
  while (Serial.available() > 0) {
    char incoming = (char)Serial.read();
    if (incoming == '\r') {
      continue;
    }
    if (incoming == '\n') {
      lineBuffer[lineLength] = 0;
      if (lineLength > 0) {
        handleLine(lineBuffer);
      }
      lineLength = 0;
      continue;
    }
    if (lineLength < ARDUDECK_MAX_LINE - 1) {
      lineBuffer[lineLength++] = incoming;
    } else {
      lineLength = 0;
      sendError(F("line too long"));
    }
  }
}

/* Minimal tokenizer that never touches global state. */
char *nextToken(char **cursor, char delimiter) {
  if (*cursor == NULL) {
    return NULL;
  }
  char *start = *cursor;
  while (*start == delimiter) {
    start++;
  }
  if (*start == 0) {
    *cursor = NULL;
    return NULL;
  }
  char *end = start;
  while (*end != 0 && *end != delimiter) {
    end++;
  }
  if (*end == 0) {
    *cursor = NULL;
  } else {
    *end = 0;
    *cursor = end + 1;
  }
  return start;
}

bool parsePinToken(const char *token, uint8_t *pin, bool *analog, bool *pullup) {
  if (token == NULL || token[0] == 0) {
    return false;
  }
  char first = token[0];
  if ((first == 'A' || first == 'a') && token[1] >= '0' && token[1] <= '5' && token[2] == 0) {
    *analog = true;
    *pullup = false;
    *pin = (uint8_t)(14 + (token[1] - '0'));
    return true;
  }
  if (first != 'D' && first != 'd' && first != 'U' && first != 'u') {
    return false;
  }
  int index = atoi(token + 1);
  if (index < 2 || index > 13) {
    return false;
  }
  *analog = false;
  *pullup = (first == 'U' || first == 'u');
  *pin = (uint8_t)index;
  return true;
}

void markOutput(uint8_t pin) {
  for (uint8_t i = 0; i < outputCount; i++) {
    if (outputPins[i] == pin) {
      return;
    }
  }
  if (outputCount < ARDUDECK_MAX_OUTPUTS) {
    outputPins[outputCount++] = pin;
  }
}

void handleLine(char *line) {
  char *cursor = line;
  char *command = nextToken(&cursor, ' ');
  char *arg1 = nextToken(&cursor, ' ');
  char *arg2 = nextToken(&cursor, ' ');
  char *arg3 = nextToken(&cursor, ' ');

  if (command == NULL) {
    return;
  }

  if (command[0] == '?' && command[1] == 0) {
    sendOk();
    return;
  }

  if (command[0] == 'E' && command[1] == 0) {
    handleWatch(arg1);
    return;
  }

  if (command[0] == 'e' && command[1] == 0) {
    long interval = atol(arg1 == NULL ? "0" : arg1);
    if (interval < 5) {
      interval = 5;
    }
    if (interval > 5000) {
      interval = 5000;
    }
    echoIntervalMs = (unsigned long)interval;
    return;
  }

  uint8_t pin = 0;
  bool analog = false;
  bool pullup = false;

  if (command[0] == 'R' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup)) {
      sendError(F("pin"));
      return;
    }
    int value = analog ? analogRead(pin) : digitalRead(pin);
    Serial.print(F("V "));
    Serial.print(arg1);
    Serial.print(' ');
    Serial.println(value);
    return;
  }

  if (command[0] == 'W' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup) || analog) {
      sendError(F("pin"));
      return;
    }
    pinMode(pin, OUTPUT);
    markOutput(pin);
    digitalWrite(pin, atoi(arg2 == NULL ? "0" : arg2) ? HIGH : LOW);
    return;
  }

  if (command[0] == 'P' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup) || analog || pin == 2 || pin == 4 || pin == 7 || pin == 8 || pin == 12 || pin == 13) {
      sendError(F("pwm pin"));
      return;
    }
    int value = atoi(arg2 == NULL ? "0" : arg2);
    if (value < 0) {
      value = 0;
    }
    if (value > 255) {
      value = 255;
    }
    pinMode(pin, OUTPUT);
    markOutput(pin);
    analogWrite(pin, value);
    return;
  }

  if (command[0] == 'S' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup) || analog) {
      sendError(F("servo pin"));
      return;
    }
    int angle = atoi(arg2 == NULL ? "90" : arg2);
    if (angle < 0) {
      angle = 0;
    }
    if (angle > 180) {
      angle = 180;
    }
    ServoSlot *slot = findServo(pin);
    if (slot == NULL) {
      slot = allocateServo(pin);
    }
    if (slot == NULL) {
      sendError(F("no servo slot"));
      return;
    }
    if (!slot->attached) {
      slot->servo.attach(pin);
      slot->attached = true;
    }
    slot->servo.write(angle);
    return;
  }

  if (command[0] == 'T' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup) || analog) {
      sendError(F("tone pin"));
      return;
    }
    unsigned int frequency = (unsigned int)atol(arg2 == NULL ? "440" : arg2);
    unsigned long duration = (unsigned long)atol(arg3 == NULL ? "0" : arg3);
    pinMode(pin, OUTPUT);
    markOutput(pin);
    if (duration > 0) {
      tone(pin, frequency, duration);
    } else {
      tone(pin, frequency);
    }
    return;
  }

  if (command[0] == 'N' && command[1] == 0) {
    if (!parsePinToken(arg1, &pin, &analog, &pullup) || analog) {
      sendError(F("tone pin"));
      return;
    }
    noTone(pin);
    return;
  }

  if (command[0] == 'M' && command[1] == 0) {
    handleMeasure(arg1, arg2);
    return;
  }

  if (command[0] == 'X' && command[1] == 0) {
    makeOutputsSafe();
    return;
  }

  sendError(F("unknown command"));
}

void handleWatch(char *list) {
  echoCount = 0;
  if (list == NULL) {
    return;
  }
  char *cursor = list;
  char *token = nextToken(&cursor, ',');
  while (token != NULL && echoCount < ARDUDECK_MAX_ECHO) {
    uint8_t pin = 0;
    bool analog = false;
    bool pullup = false;
    if (parsePinToken(token, &pin, &analog, &pullup)) {
      if (!analog) {
        pinMode(pin, pullup ? INPUT_PULLUP : INPUT);
      }
      echoPins[echoCount].pin = pin;
      echoPins[echoCount].analog = analog;
      echoCount++;
    }
    token = nextToken(&cursor, ',');
  }
}

void emitEchoes() {
  for (uint8_t i = 0; i < echoCount; i++) {
    if (echoPins[i].analog) {
      Serial.print(F("A A"));
      Serial.print((int)(echoPins[i].pin - 14));
      Serial.print(' ');
      Serial.println(analogRead(echoPins[i].pin));
    } else {
      Serial.print(F("D D"));
      Serial.print((int)echoPins[i].pin);
      Serial.print(' ');
      Serial.println(digitalRead(echoPins[i].pin));
    }
  }
}

void handleMeasure(char *trigToken, char *echoToken) {
  uint8_t trigPin = 0;
  uint8_t echoPin = 0;
  bool analog = false;
  bool pullup = false;
  if (!parsePinToken(trigToken, &trigPin, &analog, &pullup) || analog) {
    sendError(F("trig pin"));
    return;
  }
  if (!parsePinToken(echoToken, &echoPin, &analog, &pullup) || analog) {
    sendError(F("echo pin"));
    return;
  }

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, 30000UL);
  long centimeters = duration == 0 ? -1 : (long)(duration / 58UL);
  Serial.print(F("C "));
  Serial.println(centimeters);
}

ServoSlot *findServo(uint8_t pin) {
  for (uint8_t i = 0; i < ARDUDECK_MAX_SERVOS; i++) {
    if (servos[i].attached && servos[i].pin == pin) {
      return &servos[i];
    }
  }
  return NULL;
}

ServoSlot *allocateServo(uint8_t pin) {
  for (uint8_t i = 0; i < ARDUDECK_MAX_SERVOS; i++) {
    if (!servos[i].attached) {
      servos[i].pin = pin;
      return &servos[i];
    }
  }
  return NULL;
}

void makeOutputsSafe() {
  for (uint8_t i = 0; i < outputCount; i++) {
    uint8_t pin = outputPins[i];
    noTone(pin);
    if (pin == 3 || pin == 5 || pin == 6 || pin == 9 || pin == 10 || pin == 11) {
      analogWrite(pin, 0);
    }
    digitalWrite(pin, LOW);
  }
}
