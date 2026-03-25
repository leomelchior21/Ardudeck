# ArduDeck

Educational platform for students to design Arduino systems using a visual Circuit Builder and Logic Flowchart.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Supabase
Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up the database
Run `supabase/schema.sql` in your Supabase SQL editor.

### 4. Import students from CSV
```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=your-service-key \
node scripts/import-students.mjs "path/to/Turmas.csv"
```

### 5. Run dev server
```bash
npm run dev
```

---

## Features

- **RA-based Login** — students log in with their student ID (no passwords)
- **Circuit Builder** — add components, auto pin assignment, conflict detection
- **Logic Flowchart** — drag-and-drop node editor (React Flow)
- **Project Manager** — create, open, delete projects per student
- **Character System** — 45 pixel characters to choose from
- **Auto-save** — projects saved to Supabase

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- React Flow (node-based flowchart)
- Zustand (state management)
- Supabase (auth + database)

## Supported Components

### Actuators
LED, RGB LED, Servo 180°, Servo 360°, Buzzer, Relay, Stepper 28BYJ-48, Solenoid

### Sensors
Potentiometer, Button, LDR, Ultrasonic, Temperature (NTC), Humidity (DHT11),
Water Turbidity, Water Level, Rain Sensor, Soil Humidity
