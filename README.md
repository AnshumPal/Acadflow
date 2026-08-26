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
- Frontend: located in `frontend/`, built with React, Vite, Tailwind CSS, and UI components for timetable display.
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
venv\Scripts\activate
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
