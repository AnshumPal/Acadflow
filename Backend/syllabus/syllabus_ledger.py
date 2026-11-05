"""
AcadFlow - Syllabus Ledger Business Logic.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from models.database_models import SyllabusLedger
except (ImportError, ValueError):
    from ..models.database_models import SyllabusLedger

DEFAULT_REGULAR_TARGET = 36
DEFAULT_EXTRA_TARGET = 3


def get_or_create_ledger(
    db: Session,
    course_id: str,
    section_id: str,
    regular_target: int = DEFAULT_REGULAR_TARGET,
    extra_target: int = DEFAULT_EXTRA_TARGET,
) -> SyllabusLedger:
    ledger = db.scalar(
        select(SyllabusLedger).where(
            SyllabusLedger.course_id == course_id,
            SyllabusLedger.section_id == section_id,
        )
    )
    if ledger is None:
        ledger = SyllabusLedger(
            course_id=course_id,
            section_id=section_id,
            regular_target=regular_target,
            extra_target=extra_target,
            regular_completed=0,
            extra_completed=0,
            extra_scheduled=0,
        )
        db.add(ledger)
        db.flush()  
    return ledger


def progress_dict(ledger: SyllabusLedger) -> dict:
    regular_target = ledger.regular_target if ledger.regular_target is not None else DEFAULT_REGULAR_TARGET
    extra_target = ledger.extra_target if ledger.extra_target is not None else DEFAULT_EXTRA_TARGET
    regular_completed = ledger.regular_completed or 0
    extra_completed = ledger.extra_completed or 0
    extra_scheduled = ledger.extra_scheduled or 0

    total_target = regular_target + extra_target
    total_completed = regular_completed + extra_completed
    return {
        "course_id": ledger.course_id,
        "section_id": ledger.section_id,
        "regular_target": regular_target,
        "extra_target": extra_target,
        "regular_completed": regular_completed,
        "extra_completed": extra_completed,
        "extra_scheduled": extra_scheduled,
        "total_completed": total_completed,
        "regular_remaining": max(0, regular_target - regular_completed),
        "extra_remaining": max(
            0, extra_target - extra_completed - extra_scheduled
        ),
        "total_target": total_target,
    }


def increment_lecture(ledger: SyllabusLedger, lecture_type: str) -> None:
    if ledger.regular_completed is None:
        ledger.regular_completed = 0
    if ledger.extra_completed is None:
        ledger.extra_completed = 0
    if ledger.extra_scheduled is None:
        ledger.extra_scheduled = 0
    regular_target = ledger.regular_target if ledger.regular_target is not None else DEFAULT_REGULAR_TARGET
    extra_target = ledger.extra_target if ledger.extra_target is not None else DEFAULT_EXTRA_TARGET

    if lecture_type == "regular":
        if ledger.regular_completed >= regular_target:
            raise ValueError("Regular lecture target has already been completed.")
        ledger.regular_completed += 1
    elif lecture_type == "extra":
        if ledger.extra_completed >= extra_target:
            raise ValueError("Extra lecture target has already been completed.")
        ledger.extra_completed += 1
        if ledger.extra_scheduled > 0:
            ledger.extra_scheduled -= 1
    else:
        raise ValueError("lecture_type must be 'regular' or 'extra'")
