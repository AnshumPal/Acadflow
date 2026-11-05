"""
AcadFlow - Extra Class Slot Finder for Catchup Scheduling.
"""
from typing import Any, Dict, List, Optional


def _get_field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def find_extra_class_slot(
    current_schedule: Dict[str, List[Any]],
    section: str,
    teachers: List[str],
    is_lab: bool,
    all_rooms: List[str],
    num_days: int = 6,
    num_periods: int = 8,
    target_day: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Search across the timetable to locate an empty, conflict-free slot
    for an extra lecture or lab class.

    Returns:
      {"success": True, "day": d, "period": p, "room": room}
      or
      {"success": False, "message": "..."}
    """
    days_to_search = [target_day] if target_day is not None else range(num_days)

    for d in days_to_search:
        for p in range(1, num_periods + 1):
            # Check 1: Is the section busy on this day & period?
            section_classes = current_schedule.get(section, [])
            section_busy = any(
                _get_field(c, "day") == d and _get_field(c, "period") == p
                for c in section_classes
            )
            if section_busy:
                continue

            # Check 2: Are the required teachers busy in ANY section?
            teacher_busy = False
            for sec, classes in current_schedule.items():
                for c in classes:
                    if _get_field(c, "day") == d and _get_field(c, "period") == p:
                        c_teachers = _get_field(c, "teachers", [])
                        if any(t in c_teachers for t in teachers):
                            teacher_busy = True
                            break
                if teacher_busy:
                    break

            if teacher_busy:
                continue

            # Check 3: Room Availability & Strict Lab Matching
            occupied_rooms = [
                _get_field(c, "room")
                for sec, classes in current_schedule.items()
                for c in classes
                if _get_field(c, "day") == d
                and _get_field(c, "period") == p
                and not _get_field(c, "is_recess", False)
            ]

            available_rooms = []
            for r in all_rooms:
                is_lab_room = "lab" in r.lower()
                if r not in occupied_rooms and is_lab == is_lab_room:
                    available_rooms.append(r)

            if available_rooms:
                return {
                    "success": True,
                    "day": d,
                    "period": p,
                    "room": available_rooms[0],
                }

    return {
        "success": False,
        "message": "Could not find a conflict-free slot for this extra class. All teachers or suitable rooms are busy.",
    }

