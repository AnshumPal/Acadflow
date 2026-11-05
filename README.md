# AcadFlow: Intelligent Academic Scheduling & Resource Management

An intelligent, constraint-based timetable generation, dynamic rescheduling, and syllabus tracking engine built with **FastAPI**, **Google OR-Tools (CP-SAT)**, **SQLAlchemy**, and **React + Vite**.

---

## Project Overview

AcadFlow converts complex academic constraints (courses, teachers, classrooms, labs, credits, and section availability) into conflict-free, optimized weekly timetables, while tracking syllabus progress and dynamically scheduling catchup sessions.

### Key Capabilities

- **Constraint-Based Scheduling**: Solves high-dimensional scheduling problems using Google OR-Tools CP-SAT.
- **RBU Credit Scheme Support**: Automatic mapping from course credits to weekly teaching periods (theory: 1 credit = 1 period/week; lab: 1 credit = 2 periods/week).
- **Hard & Soft Constraint Satisfaction**:
  - Mutual exclusivity for teachers, classrooms, and labs.
  - Dedicated lab room matching and continuous multi-period lab blocks.
  - Pinned period slots for institute-wide courses (e.g. Open Elective, Honors, Idea Lab).
  - Parallel elective scheduling and batch lab groups.
  - Anti-fatigue limits: recess placement, max 4 teaching hours/day for faculty, max 2 classes/day per subject.
  - Contiguous student scheduling to eliminate gaps between classes.
- **Dynamic Rescheduling (Domino Swap Engine)**: Multi-day displacement engine supporting direct placement, Tier 1 same-day swaps, and Tier 2 cross-day swaps with UI displacement reporting.
- **Extra Class Scheduling**: Greedy search across the week to allocate slots for remedial or extra classes.
- **Syllabus Ledger & Deficit Audit**:
  - Persistent tracking of regular and extra lecture completions via SQLAlchemy (`SyllabusLedger`, `LectureLog`).
  - Automated deficit detection (`calculate_deficit`, `audit_ledger`) comparing completed lectures against expected linear progress.
  - Auto-catchup scheduler (`find_extra_class_slot`) finding conflict-free slots across the schedule for lagging courses.
- **Formatted Excel Export**: Generates styled `.xlsx` workbooks per section with lecture timings, recess markers, borders, and course coordinator legends.
- **Full-Featured 4-View React Frontend**: Responsive dashboard with real-time timetable grid, interactive lecture logging, syllabus tracking with pace audits, and dynamic rescheduling with one-click undo.
- **Pre-Seeded RBU Official Timetable**: Instant access to the conflict-free RBU B.Tech CSE (AIML) V-Semester timetable across sections V A, V B, and V C.

---

## System Architecture

```
AcadFlow/
├── Backend/                 # Python FastAPI Backend
│   ├── main.py              # FastAPI app initialization, CORS, route handlers & threadpool dispatch
│   ├── models/
│   │   ├── schemas.py       # Pydantic schemas, validation rules, RBU credit calculations
│   │   └── database_models.py # SQLAlchemy ORM models (SyllabusLedger, LectureLog)
│   ├── solver.py            # Google OR-Tools CP-SAT constraint satisfaction solver (generate_schedule)
│   ├── scheduling_engine.py # Pure-Python domino-swap dynamic rescheduling & slot validation engine
│   ├── syllabus/
│   │   ├── syllabus_audit.py # Deficit calculation and progress audit
│   │   ├── syllabus_ledger.py# Ledger retrieval, lecture increment, and progress reporting
│   │   ├── extra_scheduler.py# Conflict-free slot finder for auto-catchup extra lectures
│   │   └── router.py         # Syllabus REST API endpoints (/api/v1/syllabus/*)
│   ├── exporter.py          # Professional Excel workbook builder using openpyxl (build_excel_timetable)
│   ├── test_main.py         # Pytest suite for solver, credit scheme & core API
│   └── test_syllabus.py     # Pytest suite for syllabus ledger, audit & catchup scheduling
│
├── frontend/                # React + Vite Modern Frontend
│   ├── src/
│   │   ├── api/             # Modular API layer (timetable, lectures, syllabus, client, http, config)
│   │   ├── components/
│   │   │   ├── TimetableGrid.jsx       # Interactive timetable schedule grid with room/faculty badges
│   │   │   ├── ClassActionSheet.jsx    # Quick action drawer on class slot click
│   │   │   ├── RescheduleModal.jsx     # Interactive target day/period picker & missed class logger
│   │   │   ├── lectures/               # Lecture completion ledger & filtering views
│   │   │   ├── progress/               # Syllabus meters, unit breakdown, audit & catchup widgets
│   │   │   └── ui/                     # Badges, modals, toasts, tabs, and headers
│   │   ├── hooks/           # Custom React hooks (useLectureLogs, useSyllabus, useAcademicCalendar)
│   │   ├── utils/           # Pure utilities (progress calculations, calendar math, schedule mutations)
│   │   ├── data/            # Preset timetable schedules, academic calendar & sample payloads
│   │   └── App.jsx          # Primary application shell & view coordinator
│   └── vite.config.js       # Vite build setup with /api proxy to FastAPI backend
│
├── scripts/
│   ├── start_backend.bat    # Quick-launch batch script for FastAPI backend
│   └── convert_json_to_schedule.py # Utility script to convert timetable JSON into frontend presets
└── docs/
    └── api-contract-academic-tracking.md # Academic tracking API specification contract
```

---

## Frontend Overview & Core Views

The frontend provides four seamlessly integrated views accessible via top-level navigation:

1. **Configuration & Data (`setup`)**:
   - Interactive forms and JSON payload editor for courses, faculty, room inventories, and working days/periods.
   - One-click loader for the official Ramdeobaba University (RBU) V-Semester AIML curriculum preset.
   - Triggers the CP-SAT constraint satisfaction solver in a background worker thread.

2. **Generated Timetable (`timetable`)**:
   - Full-width weekly schedule grid color-coded by course, theory vs lab blocks, and recess markers.
   - Section tabs (V A, V B, V C) to switch between schedules instantly.
   - Clicking any class opens the **Class Action Sheet** with course metadata, teacher names, and quick access to dynamic rescheduling.
   - Formatted Excel export button (`.xlsx`) with lecture timing headers.

3. **Lecture Log (`lectures`)**:
   - Tracks actual teaching sessions against scheduled timetable slots across the semester.
   - Record lecture status: `Conducted`, `Not Held`, `Rescheduled`, or `Extra`.
   - Reason logging for missed classes (e.g. faculty leave, holiday, exam duty) and custom remarks.
   - Filterable by section, subject, status, and date range.

4. **Syllabus Progress & Audit (`progress`)**:
   - Visual progress bars comparing planned vs conducted lectures per course.
   - Unit-level breakdowns with granular topic completion states.
   - Automated semester pace audit showing whether a course is on track or lagging based on the academic calendar.
   - Recommended catchup actions and extra class scheduling recommendations.

### Interactive Rescheduling with Undo

- When moving a class, the **Domino Swap Engine** determines the optimal relocation (direct placement, same-day swap, or cross-day swap).
- Supports specifying both a target day and an exact target period.
- Option to automatically log the original slot as "Not Held" with a recorded cancellation reason.
- Includes instantaneous single-click **Undo** functionality with toast notifications to revert accidental schedule changes.

### Configurable Data Layer (Local vs Remote)

Configured via `frontend/.env` (see `frontend/.env.example`):
- `VITE_DATA_SOURCE=local`: Persists lecture logs, syllabus units, and calendar locally in browser storage (offline-first).
- `VITE_DATA_SOURCE=remote`: Syncs directly with the FastAPI SQLite backend endpoints.
- `VITE_RESCHEDULE_TARGET_PERIOD=true`: Enables exact period targeting for class moves.

---

## Backend Architecture & Module Responsibilities

| Module | Responsibility |
|---|---|
| `models/schemas.py` | Defines `Course`, `TimetableRequest`, `ScheduledClass`, `RescheduleRequest`, `ExtraClassRequest`, `ExportRequest`, and credit conversion logic. |
| `models/database_models.py` | SQLAlchemy ORM models for `SyllabusLedger` and `LectureLog` with deduplication keys and SQLite support. |
| `solver.py` | Contains `generate_schedule()` which builds CP-SAT Boolean variables and constraint sets, solving them in a worker thread. |
| `scheduling_engine.py` | Contains `domino_swap()`, `validate_slot_availability()`, and `find_free_slot()` for fast, deterministic class relocations without re-solving the full CP-SAT model. |
| `syllabus/` | Manages syllabus progress tracking, linear deficit auditing, and automated catchup class allocation. |
| `exporter.py` | Contains `build_excel_timetable()` to create styled multi-sheet workbooks with metadata, lecture timings, and faculty legends. |
| `main.py` | Coordinates the API endpoints, mounts the syllabus router, sets up CORS middleware, and provides backwards-compatible re-exports. |

---

## API Endpoints

Interactive Swagger API documentation is available at `http://127.0.0.1:8000/docs`.

### Timetable & Scheduling
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service health status. |
| `POST` | `/api/v1/generate` | Generates a complete timetable using the CP-SAT constraint solver. |
| `POST` | `/api/v1/reschedule-dynamic` | Moves a class using the domino-swap fallback engine (direct &rarr; same-day swap &rarr; cross-day swap). |
| `POST` | `/api/v1/schedule-extra` | Finds a conflict-free slot across the week for an extra class. |
| `POST` | `/api/v1/export/excel` | Streams a formatted Excel (`.xlsx`) spreadsheet of the schedule. |

### Syllabus Tracking & Catchup
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/syllabus/log` | Logs a completed regular or extra lecture (idempotent with `request_id`). |
| `GET` | `/api/v1/syllabus/progress/{course_id}/{section_id}` | Retrieves syllabus progress, completed vs target counts, and remaining allowance. |
| `POST` | `/api/v1/syllabus/audit-and-catchup` | Audits course progress against current week, detects lagging courses, and optionally auto-schedules catchup sessions. |

---

## Local Setup and Run

### Prerequisites

- Python 3.10 or newer
- Node.js and npm

### 1. Backend Setup

In PowerShell from the repository root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Frontend Setup

In a second terminal:

```powershell
cd frontend
npm install
```

### 3. Start the Backend

**Option A — From the repository root (using the script):**
```powershell
.\scripts\start_backend.bat
```

**Option B — From the `Backend` folder:**
```powershell
cd Backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

The backend API and Swagger docs will be live at:
- API Root: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 4. Start the Frontend

From the `frontend` directory:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests directly to `http://127.0.0.1:8000`.

---

## Running Tests

Both backend and frontend are covered by automated test suites.

### Backend Tests (Pytest)

Run all backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest Backend/test_main.py Backend/test_syllabus.py -v
```

*Covers 24 tests across RBU credit mapping, CP-SAT generation, faculty fatigue, pinned slots, parallel labs, domino dynamic rescheduling, SQLite syllabus ledger, lecture logging, and audit/catchup.*

### Frontend Tests (Vitest)

Run the Vitest unit and integration test suite:

```powershell
npm test --prefix frontend
```

*Covers 76 tests across 10 test suites verifying calendar calculations, lecture log handling, syllabus progress formulas, reschedule undo mechanics, slot availability, and API error formatting.*

### Production Build

Verify that the frontend builds without errors:

```powershell
npm run build --prefix frontend
```
