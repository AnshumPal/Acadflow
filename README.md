# AcadFlow: Intelligent Academic Scheduling API

A lightweight, constraint-based timetable generation engine built with FastAPI and Google OR-Tools.

## Project Overview

AcadFlow converts course, teacher, room, and section constraints into a feasible academic timetable. It is designed to:
- generate weekly schedules for multiple sections and rooms
- enforce lab-room assignments and continuous lab sessions
- assign recess periods and avoid teacher conflicts
- support elective groups, rescheduling, and export to Excel
- provide a React/Vite frontend for schedule interaction and API testing

## Current Status

- Backend: implemented in `Backend/main.py` with FastAPI endpoints for timetable generation and schedule export.
- Frontend: located in `frontend/`, built with React, Vite and Tailwind CSS. It covers timetable configuration and display, class rescheduling with a free-slot preview, a lecture completion log, and a syllabus progress dashboard with an audit panel. See [Frontend](#frontend).
- Dependencies: listed in `requirements.txt`; installation command is included below.
- Usage: backend API docs are available at `http://127.0.0.1:8000/docs` when the server is running.

## Quick Start

**1. Clone the repository**
```
git clone https://github.com/himanshh-k/AcadFlow.git
cd AcadFlow
```

**2. Create a Virtual Environment**
```
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux
```

**3. Install dependencies**
```
pip install -r requirements.txt
```

**4. Navigate to Backend folder and start the server**
```
cd Backend
uvicorn main:app --reload
```

**5. Test the API**<br>
Once the server is running, open your browser and navigate to:
[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) 

**6. Test custom json file**<br>
Expand /api/v1/generate<br>
Click "Try it out" and paste json content to generate a timetable

## Frontend

AcadFlow Studio is the React app in `frontend/`. It has four views:

| View | What it does |
|---|---|
| 1. Configuration & Data | Build the input (sections, rooms, teachers, courses) visually or as JSON, then generate. |
| 2. Generated Timetable | Weekly grid per section. Click a class to reschedule it or log it; click an empty cell to add an extra class; export to Excel. |
| 3. Lecture Log | Pick a date and record each timetabled lecture as conducted (unit and topic) or not held (reason). |
| 4. Syllabus Progress | Completion and pace per course against the semester plan, plus an audit of what needs attention. |

### Requirements

- Node.js 18 or newer (developed on Node 22)
- Python 3.10 or newer for the backend

### Run the backend and the frontend

Use two terminals.

**Terminal 1 — backend** (from the repository root, after the Quick Start steps above):
```
cd Backend
uvicorn main:app --reload
```
The API listens on `http://127.0.0.1:8000`.

**Terminal 2 — frontend:**
```
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. The Vite dev server forwards every `/api/...` request to the backend on port 8000, so no CORS setup is needed.

To try it quickly: click **Load RBU Template**, then **Generate Timetable**.

### Production build

```
cd frontend
npm run build      # outputs frontend/dist
npm run preview    # serves dist on http://localhost:4173, still forwarding /api to port 8000
```

### Tests

```
cd frontend
npm test           # runs the Vitest suite once
npm run test:watch # re-runs on change
```

The tests cover the progress and audit calculations, the reschedule slot preview, error messages, Undo, the calendar and schedule helpers, and the API services in both data modes. They run in Node and need neither the backend nor a browser.

### Environment variables

All are optional. Copy `frontend/.env.example` to `frontend/.env.local` to change them, then restart `npm run dev`.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | empty (same origin) | Backend origin. Leave empty when using `npm run dev` / `npm run preview`; set it only if the API is hosted on another origin (that origin must then be allowed by the backend's CORS list). |
| `VITE_DATA_SOURCE` | `local` | Where lecture logs, syllabus units and the semester calendar are stored: `local` or `remote` (see below). |
| `VITE_RESCHEDULE_TARGET_PERIOD` | `false` | Set to `true` once the backend accepts `target_period`, so users can pick the exact period when rescheduling. |
| `VITE_RESCHEDULE_LAB_BLOCKS` | `false` | Set to `true` once the backend moves a lab as a two-period block; until then lab rescheduling is disabled. |

### API integration

All HTTP calls go through the service layer in `frontend/src/api/`:

| File | Responsibility |
|---|---|
| `config.js` | Reads the environment variables above. |
| `http.js` | Shared axios instance: base URL, timeouts (60 s for generation), a hook for a future auth token, and decoding of error bodies returned as files. |
| `errors.js` | `getErrorMessage()` turns FastAPI errors, validation errors, timeouts and an unreachable server into one readable sentence. |
| `timetable.js` | `POST /api/v1/generate`, `/reschedule-dynamic`, `/schedule-extra`, `/export/excel`. |
| `lectures.js`, `syllabus.js` | Lecture logs, syllabus units and the semester calendar, in either data mode. |
| `client.js` | Re-exports the above so older `import … from './api/client'` code keeps working. |

How the timetable endpoints are used:

- The backend is stateless: the frontend sends the whole schedule with each reschedule or extra-class request and stores the returned schedule.
- `/reschedule-dynamic` only adds the new slot, so the frontend removes the original class (both periods for a lab) before sending. Before you apply, the reschedule dialog previews where the class will land, using the same first-free-period search as the backend.
- Classes are matched to catalog courses by name, because the schedule carries no course id.

The endpoints the new views need, and the backend changes requested from the team, are specified in [docs/api-contract-academic-tracking.md](docs/api-contract-academic-tracking.md).

### Local versus remote data mode

The timetable itself always comes from the backend. Lecture logs, syllabus units and the semester calendar have no backend endpoints yet, so by default they live in the browser:

| | `VITE_DATA_SOURCE=local` (default) | `VITE_DATA_SOURCE=remote` |
|---|---|---|
| Storage | This browser's `localStorage` | `/api/v1/lectures`, `/api/v1/syllabus`, `/api/v1/calendar` |
| Shared between users / devices | No | Yes |
| Survives clearing site data | No | Yes |
| "Generate sample logs" demo button | Shown | Hidden |
| Badge in the Lecture Log and Progress views | "Saved in this browser" | "Synced with server" |

The browser keeps these keys: `acadflow_schedule_v1` (timetable), `acadflow_payload_v1` (course catalog), `acadflow_lectures_v1`, `acadflow_syllabus_v1`, `acadflow_calendar_v1`. **Clear All** resets the timetable and catalog but keeps lecture logs; remove them from the Lecture Log history, or clear the site's data in the browser.

Switching to `remote` needs no code changes once the backend implements the contract. Data saved in `local` mode is not migrated automatically.
