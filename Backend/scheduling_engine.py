"""
AcadFlow - Dynamic Scheduling & Reshuffling Engine (operational engine).

Pure-Python, framework-free module. It is deliberately decoupled from the
syllabus ledger / audit engine: it only knows about the live timetable
(sections -> list of ScheduledClass) and never reads syllabus progress.

Conventions (identical to main.py / the frontend):
  * day    : 0-indexed (0 = Monday ... 5 = Saturday)
  * period : 1-indexed (1 .. num_periods)

Public API
  validate_slot_availability(...)  -> SlotCheck        (Task 2.2)
  find_free_slot(...)              -> Optional[(day, period, room)]
  domino_swap(...)                 -> DominoResult     (Task 2.1)
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Tuple

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Suffixes the engine / extra-class endpoint append to course names.
_TAGS = (" (Rescheduled)", " (Extra)", " (Displaced)")


def day_label(day: int) -> str:
    return DAY_NAMES[day] if 0 <= day < len(DAY_NAMES) else f"Day {day + 1}"


def base_name(name: str) -> str:
    """Strip engine-added tags such as ' (Rescheduled)' from a course name."""
    changed = True
    while changed:
        changed = False
        for tag in _TAGS:
            if name.endswith(tag):
                name = name[: -len(tag)]
                changed = True
    return name


def is_lab_room(room: str) -> bool:
    return "lab" in room.lower()


# --------------------------------------------------------------------------- #
# Result types
# --------------------------------------------------------------------------- #
@dataclass
class SlotCheck:
    """Outcome of validate_slot_availability()."""
    available: bool
    reasons: List[str] = field(default_factory=list)
    free_rooms: List[str] = field(default_factory=list)
    # Classes that block the slot because of a *section* clash. The domino
    # engine can try to relocate these (1-level displacement).
    blocking_section_classes: List[Any] = field(default_factory=list)


@dataclass
class Move:
    """One relocation performed (or planned) by the engine."""
    course_name: str
    section: str
    from_day: Optional[int]
    from_period: Optional[int]
    to_day: int
    to_period: int
    room: str
    role: str  # "primary" | "displaced"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "course_name": self.course_name,
            "section": self.section,
            "from_day": self.from_day,
            "from_period": self.from_period,
            "to_day": self.to_day,
            "to_period": self.to_period,
            "room": self.room,
            "role": self.role,
            "from_label": (
                None if self.from_day is None
                else f"{day_label(self.from_day)} P{self.from_period}"
            ),
            "to_label": f"{day_label(self.to_day)} P{self.to_period}",
        }


@dataclass
class DominoResult:
    success: bool
    tier: Optional[str] = None  # "direct" | "tier1_same_day" | "tier2_cross_day"
    moves: List[Move] = field(default_factory=list)
    message: str = ""
    schedule: Optional[Dict[str, List[Any]]] = None


# --------------------------------------------------------------------------- #
# Availability validator
# --------------------------------------------------------------------------- #
def _iter_classes(schedule: Dict[str, List[Any]]) -> Iterable[Tuple[str, Any]]:
    for sec, classes in schedule.items():
        for c in classes:
            yield sec, c


def validate_slot_availability(
    schedule: Dict[str, List[Any]],
    section: str,
    teachers: List[str],
    is_lab: bool,
    day: int,
    period: int,
    all_rooms: List[str],
    *,
    num_days: int = 6,
    num_periods: int = 8,
    ignore: Optional[Iterable[Any]] = None,
) -> SlotCheck:
    """
    Runtime conflict check for placing a class at (day, period).

    Checks, in order:
      1. bounds
      2. section clash (section already has a class / recess there)
      3. faculty clash (any teacher teaching in ANY section at that time)
      4. room availability with strict type matching (Lab vs Theory)

    `ignore` is a collection of ScheduledClass objects (by identity) treated as
    absent - used when simulating a move so the class being moved does not
    block its own destination.
    """
    ignored = {id(c) for c in (ignore or [])}
    reasons: List[str] = []

    if not (0 <= day < num_days):
        return SlotCheck(False, [f"Day {day} is outside 0..{num_days - 1}."])
    if not (1 <= period <= num_periods):
        return SlotCheck(False, [f"Period {period} is outside 1..{num_periods}."])

    blocking: List[Any] = []
    for c in schedule.get(section, []):
        if id(c) in ignored or c.day != day or c.period != period:
            continue
        if c.is_recess:
            reasons.append("Section has recess in this period.")
        else:
            reasons.append(f"Section already has '{c.course_name}' in this period.")
            blocking.append(c)

    teacher_set = set(teachers)
    for sec, c in _iter_classes(schedule):
        if id(c) in ignored or c.is_recess or c.day != day or c.period != period:
            continue
        clash = teacher_set.intersection(c.teachers)
        if clash:
            reasons.append(
                f"Faculty {', '.join(sorted(clash))} already teaching '{c.course_name}' "
                f"in section {sec}."
            )

    occupied = {
        c.room
        for _, c in _iter_classes(schedule)
        if id(c) not in ignored and not c.is_recess and c.day == day and c.period == period
    }
    free_rooms = [r for r in all_rooms if r not in occupied and is_lab_room(r) == is_lab]
    if not free_rooms:
        kind = "lab" if is_lab else "theory"
        reasons.append(f"No free {kind} room in this period.")

    return SlotCheck(
        available=not reasons,
        reasons=reasons,
        free_rooms=free_rooms,
        blocking_section_classes=blocking,
    )


def find_free_slot(
    schedule: Dict[str, List[Any]],
    section: str,
    teachers: List[str],
    is_lab: bool,
    days: Iterable[int],
    all_rooms: List[str],
    *,
    num_days: int = 6,
    num_periods: int = 8,
    ignore: Optional[Iterable[Any]] = None,
    exclude: Optional[Iterable[Tuple[int, int]]] = None,
) -> Optional[Tuple[int, int, str]]:
    """First conflict-free (day, period, room) over `days`, scanning periods in order."""
    excluded = set(exclude or [])
    for d in days:
        for p in range(1, num_periods + 1):
            if (d, p) in excluded:
                continue
            chk = validate_slot_availability(
                schedule, section, teachers, is_lab, d, p, all_rooms,
                num_days=num_days, num_periods=num_periods, ignore=ignore,
            )
            if chk.available:
                return d, p, chk.free_rooms[0]
    return None


# --------------------------------------------------------------------------- #
# Multi-day domino swap
# --------------------------------------------------------------------------- #
def _class_is_lab(cls: Any, course_catalog: Optional[List[Any]], section: str) -> bool:
    """Lab-ness of an already-scheduled class: catalog lookup, else room-name heuristic."""
    if course_catalog:
        nm = base_name(cls.course_name)
        for c in course_catalog:
            if c.section == section and c.name == nm:
                return bool(c.is_lab)
    return is_lab_room(cls.room)


def _place(schedule, section, course_name, teachers, day, period, room, ScheduledClass):
    new = ScheduledClass(
        day=day, period=period, room=room, course_name=course_name, teachers=list(teachers)
    )
    schedule.setdefault(section, []).append(new)
    schedule[section].sort(key=lambda x: (x.day, x.period))
    return new


def _remove(schedule, section, cls):
    schedule[section] = [c for c in schedule[section] if c is not cls]


def domino_swap(
    schedule: Dict[str, List[Any]],
    *,
    section: str,
    course_name: str,
    teachers: List[str],
    is_lab: bool,
    target_day: int,
    target_period: Optional[int],
    all_rooms: List[str],
    ScheduledClass: Any,
    source: Optional[Any] = None,
    num_days: int = 6,
    num_periods: int = 8,
    course_catalog: Optional[List[Any]] = None,
    tag: str = " (Rescheduled)",
) -> DominoResult:
    """
    Relocate a class to `target_day` using a two-tier fallback.

    Pre-step  DIRECT        : target slot already free  -> just place it.
    Tier 1    SAME-DAY SWAP : target slot blocked by one of the section's own
                              classes (the "blocker") -> relocate the blocker to
                              another free period on the SAME day, then place.
    Tier 2    CROSS-DAY SWAP: same-day relocation impossible -> relocate the
                              blocker to a free slot on any OTHER day, then place.

    Displacement is exactly one level deep: a blocker is moved only into a slot
    that is free without moving anything else (no cascading chains), so the
    operation always terminates and is easy to explain in a UI toast.

    If `target_period` is None the engine tries every period of the target day
    (direct placements first, then Tier 1 / Tier 2 swaps).

    The input `schedule` is NEVER mutated; a modified deep copy is returned in
    DominoResult.schedule on success.
    """
    work = copy.deepcopy(schedule)
    # Re-locate `source` inside the copy so identity-based ignore works.
    src_copy = None
    if source is not None:
        for c in work.get(section, []):
            if (c.day, c.period, c.course_name, c.room) == (
                source.day, source.period, source.course_name, source.room
            ):
                src_copy = c
                break

    if source is not None and src_copy is None:
        return DominoResult(False, None, [], "The class to move was not found in the schedule.")
    if (source is not None and target_period is not None
            and (source.day, source.period) == (target_day, target_period)):
        return DominoResult(False, None, [], "The class is already in that slot.")

    ignore = [src_copy] if src_copy is not None else []
    out_name = base_name(course_name) + tag
    periods = [target_period] if target_period else list(range(1, num_periods + 1))

    def commit(moves: List[Move], tier: str, msg: str) -> DominoResult:
        return DominoResult(True, tier, moves, msg, work)

    def primary_move(day, period, room) -> Move:
        return Move(
            base_name(course_name), section,
            None if source is None else source.day,
            None if source is None else source.period,
            day, period, room, "primary",
        )

    def finish_primary(day, period, room):
        if src_copy is not None:
            _remove(work, section, src_copy)
        _place(work, section, out_name, teachers, day, period, room, ScheduledClass)

    # ---- Pre-step: direct placement -------------------------------------
    for p in periods:
        chk = validate_slot_availability(
            work, section, teachers, is_lab, target_day, p, all_rooms,
            num_days=num_days, num_periods=num_periods, ignore=ignore,
        )
        if chk.available:
            room = chk.free_rooms[0]
            finish_primary(target_day, p, room)
            return commit(
                [primary_move(target_day, p, room)], "direct",
                f"Moved {base_name(course_name)} to {day_label(target_day)} P{p} in {room}.",
            )

    # ---- Tier 1 / Tier 2: displace a single blocking class ---------------
    for tier_name, search_days in (
        ("tier1_same_day", lambda: [target_day]),
        ("tier2_cross_day", lambda: [d for d in range(num_days) if d != target_day]),
    ):
        for p in periods:
            chk = validate_slot_availability(
                work, section, teachers, is_lab, target_day, p, all_rooms,
                num_days=num_days, num_periods=num_periods, ignore=ignore,
            )
            # Only a pure *section* clash is resolvable by displacement: faculty
            # or room conflicts belong to other sections and are not ours to move.
            if len(chk.blocking_section_classes) != 1:
                continue
            blocker = chk.blocking_section_classes[0]
            if blocker.is_recess or (src_copy is not None and blocker is src_copy):
                continue
            # Faculty/room clashes are only fatal if they exist *independently* of the
            # blocker, so re-check the slot as if the blocker were already gone.
            sim = validate_slot_availability(
                work, section, teachers, is_lab, target_day, p, all_rooms,
                num_days=num_days, num_periods=num_periods,
                ignore=ignore + [blocker],
            )
            if not sim.available:
                continue

            blocker_is_lab = _class_is_lab(blocker, course_catalog, section)
            dest = find_free_slot(
                work, section, blocker.teachers, blocker_is_lab, search_days(), all_rooms,
                num_days=num_days, num_periods=num_periods,
                ignore=ignore + [blocker],
                exclude=[(target_day, p)],
            )
            if dest is None:
                continue
            bd, bp, broom = dest
            blocker_name = base_name(blocker.course_name)
            b_from = (blocker.day, blocker.period)
            b_teachers = list(blocker.teachers)

            _remove(work, section, blocker)
            _place(work, section, blocker_name + " (Displaced)", b_teachers,
                   bd, bp, broom, ScheduledClass)
            room = sim.free_rooms[0]
            # Room chosen for the primary must still be free after the blocker moved.
            finish_primary(target_day, p, room)

            moves = [
                primary_move(target_day, p, room),
                Move(blocker_name, section, b_from[0], b_from[1], bd, bp, broom, "displaced"),
            ]
            scope = "same day" if tier_name == "tier1_same_day" else "another day"
            return commit(
                moves, tier_name,
                f"Moved {base_name(course_name)} to {day_label(target_day)} P{p} in {room}. "
                f"Displaced {blocker_name} to {day_label(bd)} P{bp} ({scope}).",
            )

    where = f"{day_label(target_day)} P{target_period}" if target_period else day_label(target_day)
    return DominoResult(
        False, None, [],
        f"No conflict-free arrangement found for {where}: the slot is blocked and the "
        f"blocking class could not be relocated (tried same-day and cross-day swaps).",
    )

