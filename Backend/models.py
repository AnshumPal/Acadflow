"""
AcadFlow - Data Models and Schema Definitions.
"""
from typing import List, Optional, Dict
from pydantic import BaseModel, model_validator

# RBU credit scheme (Academic Regulations, July 2025):
#   Lectures / Tutorials : 1 hour/week = 1 credit   -> 1 theory credit  = 1 period/week
#   Laboratory / Project : 1 hour/week = 1/2 credit -> 1 lab credit     = 2 periods/week
LAB_PERIODS_PER_CREDIT = 2
THEORY_PERIODS_PER_CREDIT = 1


def periods_from_credits(credits: int, is_lab: bool) -> int:
    """Weekly periods a course occupies, derived from its credits per the RBU scheme."""
    per_credit = LAB_PERIODS_PER_CREDIT if is_lab else THEORY_PERIODS_PER_CREDIT
    return credits * per_credit


class Course(BaseModel):
    id: str
    name: str
    teachers: List[str]
    section: str
    # Input the credits (RBU scheme of teaching); weekly `hours` is derived from them.
    # `hours` may still be supplied directly for backward compatibility / overrides.
    credits: Optional[int] = None
    hours: Optional[int] = None
    is_lab: bool = False
    elective_group: Optional[str] = None
    # Optional pinned slot: lock this course to a fixed period column (1-indexed),
    # e.g. MDM / Open Elective / Honors / Idea Lab that must sit at a common institute slot.
    fixed_period: Optional[int] = None
    # Optional parallel batch group: labs sharing this tag run in the SAME slot in
    # different lab rooms (e.g. CN Lab A1/A2 || C&EC Lab A3/A4), so the whole section stays busy.
    parallel_group: Optional[str] = None

    @model_validator(mode="after")
    def derive_hours_from_credits(self):
        if self.hours is None:
            if self.credits is None:
                raise ValueError(
                    f"Course '{self.id}' must specify either 'credits' or 'hours'."
                )
            self.hours = periods_from_credits(self.credits, self.is_lab)
        return self


class TimetableRequest(BaseModel):
    num_days: int = 6
    num_periods: int = 8
    sections: List[str]
    teachers: List[str]
    rooms: List[str]
    courses: List[Course]

    @model_validator(mode="after")
    def validate_request_integrity(self):
        if self.num_days < 1:
            raise ValueError("Number of working days must be at least 1.")
        if self.num_periods < 4:
            raise ValueError(
                "Number of periods per day must be at least 4 (to accommodate regular lecture slots and recess)."
            )
        if not self.sections:
            raise ValueError("At least one section must be provided.")
        if not self.rooms:
            raise ValueError("At least one classroom/lab must be provided.")
        if not self.courses:
            raise ValueError("At least one course must be provided.")
        return self


class ScheduledClass(BaseModel):
    day: int
    period: int
    room: str
    course_name: str
    teachers: List[str]
    is_recess: bool = False


class MoveDetail(BaseModel):
    """One relocation performed by the reschedule engine (drives the UI toast)."""
    course_name: str
    section: str
    from_day: Optional[int] = None
    from_period: Optional[int] = None
    to_day: int
    to_period: int
    room: str
    role: str  # "primary" | "displaced"
    from_label: Optional[str] = None
    to_label: str


class RescheduleMetadata(BaseModel):
    tier: str  # "direct" | "tier1_same_day" | "tier2_cross_day"
    displaced_count: int
    moves: List[MoveDetail]


class TimetableResponse(BaseModel):
    status: str
    schedule: Optional[Dict[str, List[ScheduledClass]]] = None
    message: str
    # Populated by /reschedule-dynamic only; absent (null) for other endpoints.
    reschedule: Optional[RescheduleMetadata] = None


class RescheduleRequest(BaseModel):
    current_schedule: Dict[str, List[ScheduledClass]]
    target_day: int  # 0-indexed (0 = Monday)
    course: Course
    all_rooms: List[str]
    num_periods: int = 8
    num_days: int = 6
    # Optional: exact period (1-indexed) to move to. If omitted, the engine tries
    # every period of target_day (direct placement first, then domino swaps).
    target_period: Optional[int] = None
    # Optional: the existing class being moved. If given it is removed from its old
    # slot (a true move). If omitted, a new "(Rescheduled)" class is added (legacy).
    source_day: Optional[int] = None
    source_period: Optional[int] = None
    # Optional: full catalog, lets the engine tell lab vs theory for displaced classes.
    all_courses: Optional[List[Course]] = None

    @model_validator(mode="after")
    def validate_target(self):
        if not (0 <= self.target_day < self.num_days):
            raise ValueError(f"target_day must be in 0..{self.num_days - 1}.")
        if self.target_period is not None and not (1 <= self.target_period <= self.num_periods):
            raise ValueError(f"target_period must be in 1..{self.num_periods}.")
        if (self.source_day is None) != (self.source_period is None):
            raise ValueError("source_day and source_period must be provided together.")
        return self


class ExportRequest(BaseModel):
    schedule: Dict[str, List[ScheduledClass]]
    num_days: int = 6
    num_periods: int = 8


class ExtraClassRequest(BaseModel):
    current_schedule: Dict[str, List[ScheduledClass]]
    course_id: str
    section: str
    all_courses: List[Course]  # Needed to fetch teacher and lab info
    all_rooms: List[str]
    target_day: Optional[int] = None  # Optional: If provided, only searches this day. If null, searches the whole week.
    num_days: int = 6
    num_periods: int = 8

