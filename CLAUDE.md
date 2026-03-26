# ArduDeck — Claude Context

## What this project is
Educational web app for Arduino students. They log in with their RA (student ID), manage circuit projects, and design logic flowcharts visually. Full retro 8-bit pixel aesthetic.

---

## Tech Stack
- **React 18 + TypeScript + Vite**
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (not PostCSS)
- **React Flow** — node-based flowchart editor
- **Zustand** — global state with localStorage persistence (`ardudeck-session`)
- **Supabase** — database + API (no auth/JWT, RA-based login only)
- **Press Start 2P** — pixel font from Google Fonts

---

## Project Structure
```
src/
  App.tsx                         # Screen router: login → dashboard → builder
  components/
    auth/LoginScreen.tsx          # RA login, pixel window + cat mascot
    circuit/BuilderScreen.tsx     # Main builder (left=circuit, right=flow)
    circuit/CircuitPanel.tsx      # Component list + Add dropdown
    circuit/ComponentCard.tsx     # Per-component colored card, always-expanded
    fileManager/Dashboard.tsx     # Project list + profile panel
    flow/FlowPanel.tsx            # ReactFlow canvas
    flow/FlowToolbar.tsx          # Add Condition/AND/OR/Timer/Delay buttons
    flow/nodes/                   # SensorNode, ActionNode, ConditionNode,
                                  # TimerNode, DelayNode, LogicNode
    profile/ProfilePanel.tsx      # Student info + avatar
    profile/CharacterSelector.tsx # 45-character grid picker
    profile/PixelAvatar.tsx       # Emoji-based pixel avatar renderer
    ui/WindowFrame.tsx            # Retro OS window chrome (title bar, bottom bar)
    ui/PixelCat.tsx               # SVG pixel cat mascot
  data/
    components.ts                 # All 18 component definitions (icons, colors, pins)
    characters.ts                 # 45 character definitions + emoji mapping
  lib/
    supabase.ts                   # Supabase client + all DB helpers
  logic/
    pinEngine.ts                  # Auto pin assignment + conflict detection
    flowGenerator.ts              # Auto-generate flow summary text
  store/
    useAppStore.ts                # Zustand store — single source of truth
  types/
    database.ts                   # TypeScript interfaces for all data models
scripts/
  import-students.mjs             # Node.js CSV → Supabase importer
supabase/
  schema.sql                      # Run once in Supabase SQL Editor
```

---

## Supabase
- **URL:** `https://imodobxbarcsjylvitxt.supabase.co`
- **Anon key (VITE_SUPABASE_ANON_KEY):** `sb_publishable_jkHrLZkNR4Zh3XtHEgpTMA_JnMMpG6w`
- **Tables:** `students`, `projects`
- No Supabase Auth — login is purely a SELECT on `students.ra`
- RLS policies are open (`using (true)`) — intentional for school use
- `supabase.ts` uses `createClient<any>` to avoid generated-type conflicts

### students table
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| ra | text | unique, login key |
| full_name | text | |
| grade | text | e.g. "EF 9A" |
| group_name | text | "A" or "B" (from amarelo/branco) |
| character_id | int | 0–44 |
| created_at | timestamptz | |

### projects table
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| student_id | uuid | FK → students.id |
| name | text | |
| data | jsonb | `{ components, nodes, edges }` |
| updated_at | timestamptz | auto-updated by trigger |
| created_at | timestamptz | |

---

## State Management (Zustand)
`useAppStore` is the single source of truth. Key slices:
- `student` — persisted to localStorage, restored on reload
- `activeScreen` — `'login' | 'dashboard' | 'builder'`
- `components` — `CircuitComponent[]` — current project's circuit
- `flowNodes` / `flowEdges` — React Flow state
- `currentProject` / `projectDirty` — save state
- `addComponent(type)` — calls pinEngine, auto-creates flow node
- `removeComponent(id)` — removes card + cleans orphaned flow nodes
- `loadProject(project)` — loads all slices from project.data
- `createNewProject(name)` — sets activeScreen to 'builder'

---

## Design System
All pixel styles are in `src/index.css` (CSS variables + utility classes).

### Colors
| Use | Value |
|---|---|
| Actuators | `#f5a623` |
| Sensors | `#4a9eff` |
| Condition | `#22c55e` |
| Logic AND/OR | `#f97316` |
| Timer | `#06b6d4` |
| Delay | `#a855f7` |
| Background | `#e8e4d0` |
| Panel | `#f0ead6` |
| Border | `#2d2d2d` |
| App green bg | `#5cb85c` |

### Per-component card colors (ComponentCard.tsx)
LED=yellow, Servo=orange, Buzzer=red, RGB=purple, Relay=green, Button=blue, LDR=amber, Ultrasonic=cyan, etc.

### CSS utility classes
- `.pixel-btn` + `.pixel-btn-yellow/green/red/blue/gray/orange/purple/dark`
- `.pixel-card` — bordered card with pixel shadow
- `.pixel-input` — pixel-styled input
- `.pixel-badge` — small inline tag
- `.pixel-panel-header` — panel title bar
- `.pixel-blink` — blinking animation
- `.pixel-shake` — error shake animation
- `.dotted-sep` — dotted separator line

---

## Pin Assignment Engine (`logic/pinEngine.ts`)
Auto-assigns Arduino Uno pins when a component is added:
- Analog sensors → A0–A5
- PWM actuators (LED, Servo) → D3/5/6/9/10/11
- Digital → D2/4/5/6/7/8/12/13
- Falls back with yellow warning if preferred type unavailable
- `checkPinConflicts()` returns a Map of conflicted pins → component IDs
- Card border turns red on conflict

---

## CSV Import
File: `Turmas JK - AF e EM - 2026.03.csv` (in project root, outside `ardudeck/`)
- Encoding: **Latin-1** (Windows)
- Separator: **semicolon**
- Two students per row (columns 0–5 and 9–14)
- MATRIC column = RA (numeric string)
- GRUPO: `amarelo` → `A`, `branco` → `B`
- 102 students already imported as of 2026-03-25

Run importer:
```bash
SUPABASE_URL=https://imodobxbarcsjylvitxt.supabase.co \
SUPABASE_SERVICE_KEY=<secret-key> \
node scripts/import-students.mjs "../Turmas JK - AF e EM - 2026.03.csv"
```

---

## Environment Variables
| Var | Used by |
|---|---|
| `VITE_SUPABASE_URL` | Browser (Vite) |
| `VITE_SUPABASE_ANON_KEY` | Browser (Vite) |
| `SUPABASE_URL` | import script only |
| `SUPABASE_SERVICE_KEY` | import script only |

Local: `.env.local` (gitignored)
Production: set in Vercel → Settings → Environment Variables

---

## Deployment
- **Repo:** https://github.com/leomelchior21/Ardudeck
- **Hosting:** Vercel (auto-deploys on push to `master`)
- Build command: `npm run build`
- Output dir: `dist`

---

## Known Students
- RA `497635` — Leo Maker (admin/teacher, added manually)
- All EF 9A/9B/9C/9D students from the 2026.03 CSV roster
