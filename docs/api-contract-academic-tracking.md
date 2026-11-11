# API contract: lecture logs, syllabus and reschedule

The frontend's **Lecture Log** and **Syllabus Progress** views already work against this contract.
Until these endpoints exist they store data in the browser (`VITE_DATA_SOURCE=local`). Once the
backend implements them, set `VITE_DATA_SOURCE=remote` in `frontend/.env.local`; no frontend code
changes are needed.

Shapes are defined on the frontend in `frontend/src/api/lectures.js` and `frontend/src/api/syllabus.js`.

---

## Timetable Ingestion

Two synchronous endpoints that accept raw CSV timetable dumps, perform automated self-correction,
room-type enforcement, faculty/room conflict pre-checks, and validate the
**Minimum Daily Hours Hard Constraint** (`Hours(d, s) >= 3`).

### Hard Constraint — Minimum Daily Contact Hours

> **Non-negotiable:** Every active section `s` must have ≥ 3 contact hours on every operational
> day `d` (Monday–Saturday). Recess, lunch, and free-study slots **do not** count.

```
Hard Constraint H2:  Hours(d, s) >= 3  ∀d ∈ {Mon,Tue,Wed,Thu,Fri,Sat}, ∀s ∈ Sections
```

Violations detected during ingestion trigger the **Redistribution Protocol** — excess classes are
automatically moved from the section's heaviest day to the deficit day before returning the response.

### `POST /api/v1/timetable/ingest`

Ingest, self-correct, and validate a timetable. Returns the full structured JSON payload.

**Request body:**

```python
class TimetableIngestRequest(BaseModel):
    csv_content: str          # Raw multi-section CSV dump (supports "--- OR ---" parallel-batch splits)
    auto_self_correct: bool = True   # Cross-reference Master=TT to recover blank days
    export_excel: bool = False       # Unused by this endpoint; use /ingest/excel instead
```

**Response (200 OK):**

```jsonc
{
  "status": "success",
  "message": "Timetable ingested, self-corrected, validated, and generated successfully.",
  "validation_report": {
    "is_valid": true,
    "coverage_complete": true,
    "recovered_slots": [
      "Recovered 6 slots for Section V C on THURSDAY using Master=TT cross-reference.",
      "Redistributed 'Computer Networks (CN)' in Section V B from Monday P1 (6 hrs) to Saturday P6 to satisfy the >= 3 daily hours hard constraint."
    ],
    "conflicts_detected": [],
    "room_violations": [],
    "sections_checked": ["V A", "V B", "V C"],
    "total_classes_scheduled": 134,
    "warnings": []
  },
  "schedule": {
    "V A": [ /* ScheduledClass objects */ ],
    "V B": [ /* ScheduledClass objects */ ],
    "V C": [ /* ScheduledClass objects */ ]
  }
}
```

**Errors:**
- `400` — Parse failure or unrecoverable constraint violation

### `POST /api/v1/timetable/ingest/excel`

Same ingestion pipeline, but streams the validated schedule as a formatted `.xlsx` file (one sheet per section).

**Request body:** Same as `/ingest`.

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
with header `Content-Disposition: attachment; filename="AcadFlow_Timetable_Validated.xlsx"`

---

## `TimetableResponse` — Updated Schema

Both `/api/v1/generate` and `/api/v1/reschedule-dynamic` now include a `min_hours_audit` field.

```python
class TimetableResponse(BaseModel):
    status: str
    schedule: Optional[Dict[str, List[ScheduledClass]]] = None
    message: str
    reschedule: Optional[RescheduleMetadata] = None   # /reschedule-dynamic only
    min_hours_audit: Optional[Dict[str, Dict[str, int]]] = None  # NEW — per-section per-day hours
```

**Example `min_hours_audit`:**

```jsonc
{
  "V A": { "Monday": 4, "Tuesday": 3, "Wednesday": 4, "Thursday": 4, "Friday": 5, "Saturday": 6 },
  "V B": { "Monday": 5, "Tuesday": 5, "Wednesday": 4, "Thursday": 4, "Friday": 5, "Saturday": 3 },
  "V C": { "Monday": 4, "Tuesday": 6, "Wednesday": 5, "Thursday": 5, "Friday": 5, "Saturday": 6 }
}
```

All values must be ≥ 3 in a valid schedule. If the solver or domino-swap produces a schedule where
any cell < 3, the Redistribution Protocol runs automatically before the response is returned.

### `POST /api/v1/generate` — Min-Hours Enforcement

After CP-SAT solver completes, the endpoint:
1. Calls `validate_minimum_daily_hours()` on the generated schedule.
2. If violations detected → runs `redistribute_to_meet_minimum_hours()`.
3. Re-validates; appends redistribution count to `message`.
4. Returns `min_hours_audit` matrix in the response.

### `POST /api/v1/reschedule-dynamic` — Post-Swap Validation

After a successful domino swap:
1. Calls `validate_minimum_daily_hours()` on the resulting schedule.
2. If violations remain (edge case; domino guard should block most) → runs redistribution.
3. If redistribution cannot resolve violations → returns `400` with violation details.
4. Returns `min_hours_audit` matrix alongside `reschedule` metadata.

---

## Suggested layout

The frontend's **Lecture Log** and **Syllabus Progress** views already work against this contract.
Until these endpoints exist they store data in the browser (`VITE_DATA_SOURCE=local`). Once the
backend implements them, set `VITE_DATA_SOURCE=remote` in `frontend/.env.local`; no frontend code
changes are needed.

Shapes are defined on the frontend in `frontend/src/api/lectures.js` and `frontend/src/api/syllabus.js`.

## Suggested layout

Keep `Backend/main.py` small to avoid merge conflicts: put each group in its own router
(`Backend/routers/lectures.py`, `Backend/routers/syllabus.py`) and add one
`app.include_router(...)` line per router. Keep every route under `/api/v1/` — the Vite
dev/preview proxy only forwards `/api`.

## Lecture logs

```
GET    /api/v1/lectures?section=&course_id=&from=&to=&status=   -> { "items": [LectureLog] }
POST   /api/v1/lectures            body: LectureLogCreate      -> LectureLog          (409 if the slot is already logged)
PATCH  /api/v1/lectures/{id}       body: partial LectureLog    -> LectureLog
DELETE /api/v1/lectures/{id}                                    -> 204
```

```python
class LectureLogCreate(BaseModel):
    section: str
    course_id: str
    course_name: str
    date: date                     # "YYYY-MM-DD"
    day: int                       # 0 = Monday, same as ScheduledClass.day
    period: int                    # first period, 1-indexed
    periods: int = 1               # 2 for a lab block
    room: Optional[str] = None
    teachers: List[str] = []
    slot_type: Literal["regular", "extra", "rescheduled"] = "regular"
    status: Literal["conducted", "not_held"]
    unit_id: Optional[str] = None  # CourseSyllabus.units[].id
    topic: Optional[str] = None
    reason: Optional[Literal["faculty_leave", "holiday", "event", "other"]] = None  # when not_held
    remarks: Optional[str] = None

class LectureLog(LectureLogCreate):
    id: str
    created_at: datetime
    updated_at: datetime
```

Unique on `(section, course_id, date, period)`.

## Syllabus units

```
GET    /api/v1/syllabus?section=                 -> { "items": [CourseSyllabus] }
PUT    /api/v1/syllabus/{course_id}   body: CourseSyllabus -> CourseSyllabus
DELETE /api/v1/syllabus/{course_id}?section=     -> 204   (falls back to the bundled template)
```

```python
class SyllabusUnit(BaseModel):
    id: str
    title: str
    planned_lectures: int          # in periods; a lab session counts as 2

class CourseSyllabus(BaseModel):
    section: str
    course_id: str
    units: List[SyllabusUnit]
    updated_at: Optional[datetime] = None
```

Keyed by `(section, course_id)` because course ids can repeat across sections.

## Academic calendar

```
GET /api/v1/calendar                       -> AcademicCalendar
PUT /api/v1/calendar  body: AcademicCalendar -> AcademicCalendar
```

```python
class Holiday(BaseModel):
    date: date
    label: str

class AcademicCalendar(BaseModel):
    semester_start: date
    semester_end: date
    holidays: List[Holiday] = []
```

## Changes requested to existing endpoints

All are backward compatible; Pydantic already ignores the new fields today.

1. **`POST /api/v1/reschedule-dynamic`**
   - Add `num_days: int = 6` and reject `target_day` outside `0..num_days-1` (today `target_day=9` returns 200).
   - Add `target_period: Optional[int] = None`; when set, place the class there or return 400.
     Frontend switch: `VITE_RESCHEDULE_TARGET_PERIOD=true`.
   - Place `is_lab` courses as two consecutive periods in one lab room (today only one period is added).
     Frontend switch: `VITE_RESCHEDULE_LAB_BLOCKS=true`.
   - The frontend already removes the original class from `current_schedule` before sending it, so the
     endpoint should keep only *adding* the new slot.
2. **`ScheduledClass`** — add `course_id: Optional[str] = None` and fill it in `generate`, `reschedule-dynamic`
   and `schedule-extra`. The frontend currently matches classes to courses by name.
3. **`Backend/main.py`** — `logger` is used in three `except` blocks but never defined, so unexpected errors
   surface as a bare 500. Add `import logging` and `logger = logging.getLogger("acadflow")`.
4. **CORS** — `ALLOWED_ORIGINS` only lists port 5173. The frontend now calls the API same-origin through the
   Vite proxy, so this only matters if the API is hosted on another origin; read the list from an env var then.
