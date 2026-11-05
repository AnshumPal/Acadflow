"""
AcadFlow - Syllabus Tracking & Audit API Router.
"""
from typing import Literal, Optional, List, Dict
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

try:
    from models.database_models import Base, SyllabusLedger, LectureLog
    from syllabus.syllabus_ledger import (
        get_or_create_ledger, progress_dict, increment_lecture
    )
    from syllabus.syllabus_audit import audit_ledger
    from syllabus.extra_scheduler import find_extra_class_slot
except (ImportError, ValueError):
    from ..models.database_models import Base, SyllabusLedger, LectureLog
    from .syllabus_ledger import (
        get_or_create_ledger, progress_dict, increment_lecture
    )
    from .syllabus_audit import audit_ledger
    from .extra_scheduler import find_extra_class_slot

router = APIRouter(prefix="/api/v1/syllabus", tags=["Syllabus"])

# SQLite persistence
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./acadflow.db")
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class LectureLogRequest(BaseModel):
    course_id: str = Field(min_length=1)
    section_id: str = Field(min_length=1)
    lecture_type: Literal["regular", "extra"]
    request_id: Optional[str] = None


class AuditRequest(BaseModel):
    current_week: int = Field(ge=0)
    total_weeks: int = Field(gt=0)
    auto_schedule: bool = False
    current_schedule: Optional[Dict[str, List[dict]]] = None
    all_courses: List[dict] = []
    all_rooms: List[str] = []
    num_days: int = 6
    num_periods: int = 8


@router.post("/log")
def log_completed_lecture(request: LectureLogRequest, db: Session = Depends(get_db)):
    if request.request_id:
        duplicate = db.scalar(
            select(LectureLog).where(LectureLog.request_id == request.request_id)
        )
        if duplicate:
            ledger = db.get(SyllabusLedger, duplicate.ledger_id)
            return {
                "message": "This lecture log was already processed.",
                "duplicate": True,
                "progress": progress_dict(ledger),
            }

    ledger = get_or_create_ledger(db, request.course_id, request.section_id)
    try:
        increment_lecture(ledger, request.lecture_type)
        db.add(LectureLog(
            ledger=ledger,
            lecture_type=request.lecture_type,
            request_id=request.request_id,
        ))
        db.commit()
        db.refresh(ledger)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate lecture log request_id.")
    return {
        "message": "Lecture logged successfully.",
        "duplicate": False,
        "progress": progress_dict(ledger),
    }


@router.get("/progress/{course_id}/{section_id}")
def get_syllabus_progress(
    course_id: str, section_id: str, db: Session = Depends(get_db)
):
    ledger = db.scalar(
        select(SyllabusLedger).where(
            SyllabusLedger.course_id == course_id,
            SyllabusLedger.section_id == section_id,
        )
    )
    if ledger is None:
        raise HTTPException(status_code=404, detail="Syllabus ledger not found.")
    return progress_dict(ledger)


@router.post("/audit-and-catchup")
def audit_and_catchup(request: AuditRequest, db: Session = Depends(get_db)):
    if request.current_week > request.total_weeks:
        raise HTTPException(status_code=422, detail="current_week cannot exceed total_weeks")

    ledgers = db.scalars(select(SyllabusLedger)).all()
    reports = [audit_ledger(x, request.current_week, request.total_weeks) for x in ledgers]
    lagging = [x for x in reports if x["is_lagging"]]
    scheduling_results = []

    # Scheduling is optional because an audit may be run without a live timetable.
    # A scheduled extra lecture is NOT counted as completed.
    if request.auto_schedule:
        if request.current_schedule is None or not request.all_courses or not request.all_rooms:
            raise HTTPException(
                status_code=422,
                detail="auto_schedule requires current_schedule, all_courses and all_rooms.",
            )

        for item in lagging:
            ledger = next(
                x for x in ledgers
                if x.course_id == item["course_id"] and x.section_id == item["section_id"]
            )
            if ledger.extra_completed + ledger.extra_scheduled >= ledger.extra_target:
                scheduling_results.append({
                    "course_id": ledger.course_id,
                    "section_id": ledger.section_id,
                    "scheduled": False,
                    "message": "Extra lecture allowance is already used or reserved.",
                })
                continue

            course = next(
                (c for c in request.all_courses
                 if c.get("id") == ledger.course_id
                 and c.get("section") == ledger.section_id),
                None,
            )
            if course is None:
                scheduling_results.append({
                    "course_id": ledger.course_id,
                    "section_id": ledger.section_id,
                    "scheduled": False,
                    "message": "Course details not found in all_courses.",
                })
                continue

            result = find_extra_class_slot(
                current_schedule=request.current_schedule,
                section=ledger.section_id,
                teachers=course.get("teachers", []),
                is_lab=bool(course.get("is_lab", False)),
                all_rooms=request.all_rooms,
                num_days=request.num_days,
                num_periods=request.num_periods,
            )
            if result["success"]:
                new_class = {
                    "day": result["day"],
                    "period": result["period"],
                    "room": result["room"],
                    "course_name": course.get("name", ledger.course_id) + " (Extra)",
                    "teachers": course.get("teachers", []),
                    "is_recess": False,
                }
                request.current_schedule.setdefault(ledger.section_id, []).append(new_class)
                request.current_schedule[ledger.section_id].sort(
                    key=lambda c: (c["day"], c["period"])
                )
                ledger.extra_scheduled += 1
                scheduling_results.append({
                    "course_id": ledger.course_id,
                    "section_id": ledger.section_id,
                    "scheduled": True,
                    "slot": new_class,
                })
            else:
                scheduling_results.append({
                    "course_id": ledger.course_id,
                    "section_id": ledger.section_id,
                    "scheduled": False,
                    "message": result["message"],
                })

        db.commit()

    return {
        "current_week": request.current_week,
        "total_weeks": request.total_weeks,
        "courses_audited": len(reports),
        "lagging_courses": lagging,
        "scheduling_results": scheduling_results,
        "updated_schedule": request.current_schedule if request.auto_schedule else None,
    }

