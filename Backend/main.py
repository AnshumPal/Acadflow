"""
AcadFlow: Intelligent Academic Scheduling and Resource Management.
Main FastAPI application entrypoint and route handlers.
"""
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

# Relative / absolute import compatibility
try:
    from .models import (
        Course,
        TimetableRequest,
        ScheduledClass,
        MoveDetail,
        RescheduleMetadata,
        TimetableResponse,
        RescheduleRequest,
        ExportRequest,
        ExtraClassRequest,
        periods_from_credits,
    )
    from .solver import generate_schedule
    from .exporter import build_excel_timetable
    from . import scheduling_engine as engine
    from .syllabus import router as syllabus_router, find_extra_class_slot
except (ImportError, ValueError):
    from models import (
        Course,
        TimetableRequest,
        ScheduledClass,
        MoveDetail,
        RescheduleMetadata,
        TimetableResponse,
        RescheduleRequest,
        ExportRequest,
        ExtraClassRequest,
        periods_from_credits,
    )
    from solver import generate_schedule
    from exporter import build_excel_timetable
    import scheduling_engine as engine
    from syllabus import router as syllabus_router, find_extra_class_slot

logger = logging.getLogger("acadflow")

# Initialize FastAPI application
app = FastAPI(
    title="AcadFlow: Intelligent Academic Scheduling and Resource Management",
    description="Automated timetable generation, dynamic domino rescheduling, and formatted Excel export.",
    version="2.0.0",
)

# Configure CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Syllabus tracking & audit router
app.include_router(syllabus_router)


@app.get("/")
def root():
    return {
        "name": "AcadFlow API",
        "status": "online",
        "docs_url": "/docs",
    }


@app.post("/api/v1/generate", response_model=TimetableResponse)
async def create_timetable(request: TimetableRequest):
    """
    Generate an optimal academic timetable using CP-SAT constraint satisfaction.
    Executed in a background worker threadpool to keep the server event loop responsive.
    """
    try:
        result = await run_in_threadpool(generate_schedule, request)
        if result["status"] == "failed":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Error generating timetable schedule")
        raise HTTPException(status_code=500, detail=f"Failed to generate timetable: {str(e)}")


@app.post("/api/v1/reschedule-dynamic", response_model=TimetableResponse)
async def dynamic_reschedule(request: RescheduleRequest):
    """
    Move a class to a target day (and optionally period) using the multi-day
    domino-swap engine:
      - Direct placement if free
      - Tier 1: same-day single displacement swap
      - Tier 2: cross-day single displacement swap
    Returns displacement metadata for UI notifications and toast updates.
    """
    try:
        schedule = request.current_schedule
        section = request.course.section

        source = None
        if request.source_day is not None:
            source = next(
                (
                    c for c in schedule.get(section, [])
                    if c.day == request.source_day and c.period == request.source_period
                    and not c.is_recess
                ),
                None,
            )
            if source is None:
                raise HTTPException(
                    status_code=404,
                    detail="No class found at the given source_day/source_period for this section.",
                )

        result = engine.domino_swap(
            schedule,
            section=section,
            course_name=request.course.name,
            teachers=request.course.teachers,
            is_lab=request.course.is_lab,
            target_day=request.target_day,
            target_period=request.target_period,
            all_rooms=request.all_rooms,
            ScheduledClass=ScheduledClass,
            source=source,
            num_days=request.num_days,
            num_periods=request.num_periods,
            course_catalog=request.all_courses,
        )
        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        moves = [m.to_dict() for m in result.moves]
        return {
            "status": "success",
            "schedule": result.schedule,
            "message": result.message,
            "reschedule": {
                "tier": result.tier,
                "displaced_count": sum(1 for m in moves if m["role"] == "displaced"),
                "moves": moves,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in dynamic reschedule")
        raise HTTPException(status_code=500, detail=f"Reschedule error: {str(e)}")


@app.post("/api/v1/schedule-extra", response_model=TimetableResponse)
async def schedule_extra_class(request: ExtraClassRequest):
    """
    Greedy search across the timetable to locate an empty, conflict-free slot
    for an extra lecture or lab class.
    """
    try:
        schedule = request.current_schedule
        section = request.section

        # 1. Fetch course details to know teacher assignments and lab room requirements
        target_course = next(
            (c for c in request.all_courses if c.id == request.course_id and c.section == section),
            None,
        )

        if not target_course:
            raise HTTPException(status_code=404, detail="Course ID not found for the provided section.")

        teachers = target_course.teachers
        is_course_lab = target_course.is_lab

        slot_result = find_extra_class_slot(
            current_schedule=schedule,
            section=section,
            teachers=teachers,
            is_lab=is_course_lab,
            all_rooms=request.all_rooms,
            num_days=request.num_days,
            num_periods=request.num_periods,
            target_day=request.target_day,
        )

        if not slot_result["success"]:
            raise HTTPException(status_code=400, detail=slot_result["message"])

        d, p, room = slot_result["day"], slot_result["period"], slot_result["room"]
        new_class = ScheduledClass(
            day=d,
            period=p,
            room=room,
            course_name=target_course.name + " (Extra)",
            teachers=teachers,
        )

        if section not in schedule:
            schedule[section] = []
        schedule[section].append(new_class)
        schedule[section] = sorted(schedule[section], key=lambda x: (x.day, x.period))

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        day_label = day_names[d] if d < len(day_names) else f"Day {d+1}"
        return {
            "status": "success",
            "schedule": schedule,
            "message": f"Extra class scheduled successfully on {day_label}, Period {p} in {room}.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in scheduling extra class")
        raise HTTPException(status_code=500, detail=f"Extra class error: {str(e)}")


@app.post("/api/v1/export/excel")
async def export_schedule_to_excel(request: ExportRequest):
    """
    Export the generated schedule to a professionally styled Excel (.xlsx) file.
    """
    try:
        output = build_excel_timetable(request)
        headers = {"Content-Disposition": 'attachment; filename="AcadFlow_Timetable_Formatted.xlsx"'}
        return StreamingResponse(
            output,
            headers=headers,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        logger.exception("Error generating Excel export")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {str(e)}")
