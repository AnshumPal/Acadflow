"""
AcadFlow - CP-SAT Timetable Constraint Solver.
"""
import math
from fastapi import HTTPException
from ortools.sat.python import cp_model

try:
    from .models import TimetableRequest, ScheduledClass
except (ImportError, ValueError):
    from models import TimetableRequest, ScheduledClass


def generate_schedule(data: TimetableRequest) -> dict:
    """
    Core CP-SAT constraint satisfaction solver for generating conflict-free
    academic timetables across multiple sections, teachers, rooms, and courses.
    """
    model = cp_model.CpModel()
    schedule = {}
    recess = {}
    sec_active_day = {}

    # 1. Initialize Variables using Internal Index
    for c_idx, c in enumerate(data.courses):
        for r_idx in range(len(data.rooms)):
            for d in range(data.num_days):
                for p in range(data.num_periods):
                    schedule[(c_idx, r_idx, d, p)] = model.NewBoolVar(f"c{c_idx}_r{r_idx}_d{d}_p{p}")

    for section in data.sections:
        for d in range(data.num_days):
            for p in range(data.num_periods):
                recess[(section, d, p)] = model.NewBoolVar(f"rec_{section}_d{d}_p{p}")

    # 2. Define "Day Off" logic per section
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        for d in range(data.num_days):
            is_active = model.NewBoolVar(f"sec_{section}_d{d}_active")
            total_classes_day = sum(
                schedule[(i, r_idx, d, p)]
                for i in c_indices for r_idx in range(len(data.rooms)) for p in range(data.num_periods)
            )
            model.Add(total_classes_day > 0).OnlyEnforceIf(is_active)
            model.Add(total_classes_day == 0).OnlyEnforceIf(is_active.Not())
            sec_active_day[(section, d)] = is_active

    # A. ROOM ASSIGNMENTS (Enforce lab room types if lab rooms are present)
    has_lab_rooms = any("lab" in r.lower() for r in data.rooms)
    has_theory_rooms = any("lab" not in r.lower() for r in data.rooms)
    for c_idx, c in enumerate(data.courses):
        for r_idx, room in enumerate(data.rooms):
            is_lab_room = "lab" in room.lower()
            if has_lab_rooms and c.is_lab and not is_lab_room:
                for d in range(data.num_days):
                    for p in range(data.num_periods):
                        model.Add(schedule[(c_idx, r_idx, d, p)] == 0)
            elif has_theory_rooms and (not c.is_lab) and is_lab_room:
                for d in range(data.num_days):
                    for p in range(data.num_periods):
                        model.Add(schedule[(c_idx, r_idx, d, p)] == 0)

    # A2. PINNED SLOTS (fixed_period): confine a course to one period column.
    # Used for institute-wide fixed slots (MDM / Open Elective / Honors / Idea Lab).
    for c_idx, c in enumerate(data.courses):
        if c.fixed_period is None:
            continue
        pinned = c.fixed_period - 1  # API is 1-indexed; internal is 0-indexed
        if pinned < 0 or pinned >= data.num_periods:
            raise HTTPException(
                status_code=400,
                detail=f"Course '{c.id}': fixed_period {c.fixed_period} is outside 1..{data.num_periods}.",
            )
        for r_idx in range(len(data.rooms)):
            for d in range(data.num_days):
                for p in range(data.num_periods):
                    if p != pinned:
                        model.Add(schedule[(c_idx, r_idx, d, p)] == 0)

    # B. EARLY START (Only if the day is active and periods allow)
    if data.num_periods >= 2:
        for section in data.sections:
            c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
            for d in range(data.num_days):
                class_at_0 = sum(schedule[(i, r_idx, d, 0)] for i in c_indices for r_idx in range(len(data.rooms)))
                class_at_1 = sum(schedule[(i, r_idx, d, 1)] for i in c_indices for r_idx in range(len(data.rooms)))

                b0 = model.NewBoolVar(f"sec_{section}_d{d}_has_class_0")
                b1 = model.NewBoolVar(f"sec_{section}_d{d}_has_class_1")

                model.Add(class_at_0 > 0).OnlyEnforceIf(b0)
                model.Add(class_at_0 == 0).OnlyEnforceIf(b0.Not())
                model.Add(class_at_1 > 0).OnlyEnforceIf(b1)
                model.Add(class_at_1 == 0).OnlyEnforceIf(b1.Not())

                model.Add(b0 + b1 >= 1).OnlyEnforceIf(sec_active_day[(section, d)])

    # C. RECESS & ANTI-FATIGUE (Only if the day is active)
    recess_slots = [2, 3] if data.num_periods >= 4 else [min(1, data.num_periods - 1)]
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        for d in range(data.num_days):
            if len(recess_slots) == 2:
                model.Add(recess[(section, d, recess_slots[0])] + recess[(section, d, recess_slots[1])] == 1).OnlyEnforceIf(sec_active_day[(section, d)])
                model.Add(recess[(section, d, recess_slots[0])] + recess[(section, d, recess_slots[1])] == 0).OnlyEnforceIf(sec_active_day[(section, d)].Not())
            elif len(recess_slots) == 1:
                model.Add(recess[(section, d, recess_slots[0])] == 1).OnlyEnforceIf(sec_active_day[(section, d)])
                model.Add(recess[(section, d, recess_slots[0])] == 0).OnlyEnforceIf(sec_active_day[(section, d)].Not())

            for p in range(data.num_periods):
                if p not in recess_slots:
                    model.Add(recess[(section, d, p)] == 0)

            active_periods_vars = []
            for p in range(data.num_periods):
                period_active = model.NewBoolVar(f"sec_{section}_d{d}_p{p}_active_cutoff")
                total_classes_this_period = sum(
                    schedule[(i, r_idx, d, p)] for i in c_indices for r_idx in range(len(data.rooms))
                )

                model.Add(total_classes_this_period == 0).OnlyEnforceIf(recess[(section, d, p)])
                model.Add(total_classes_this_period > 0).OnlyEnforceIf(period_active)
                model.Add(total_classes_this_period == 0).OnlyEnforceIf(period_active.Not())
                active_periods_vars.append(period_active)

            if 2 in recess_slots:
                for p in range(6, data.num_periods):
                    model.Add(active_periods_vars[p] == 0).OnlyEnforceIf(recess[(section, d, 2)])
            if 3 in recess_slots:
                for p in range(7, data.num_periods):
                    model.Add(active_periods_vars[p] == 0).OnlyEnforceIf(recess[(section, d, 3)])

    # D. COURSE DELIVERY & CONTINUOUS LABS
    for c_idx, c in enumerate(data.courses):
        if not c.is_lab:
            model.Add(sum(
                schedule[(c_idx, r_idx, d, p)]
                for r_idx in range(len(data.rooms)) for d in range(data.num_days) for p in range(data.num_periods)
            ) == c.hours)
        else:
            lab_start = {}
            if data.num_periods > 1 and len(data.rooms) > 0:
                for r_idx in range(len(data.rooms)):
                    for d in range(data.num_days):
                        for p in range(data.num_periods - 1):
                            lab_start[(r_idx, d, p)] = model.NewBoolVar(f"ls_{c_idx}_r{r_idx}_d{d}_p{p}")

                if lab_start:
                    model.AddExactlyOne(lab_start.values())

                for r_idx in range(len(data.rooms)):
                    for d in range(data.num_days):
                        for p in range(data.num_periods):
                            starts_covering = []
                            if p < data.num_periods - 1 and (r_idx, d, p) in lab_start:
                                starts_covering.append(lab_start[(r_idx, d, p)])
                            if p > 0 and (r_idx, d, p-1) in lab_start:
                                starts_covering.append(lab_start[(r_idx, d, p-1)])
                            model.Add(schedule[(c_idx, r_idx, d, p)] == sum(starts_covering))

    # E. PARALLEL ELECTIVES
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        groups = {}
        for c_idx in c_indices:
            c = data.courses[c_idx]
            # parallel_group co-schedules batch labs; elective_group co-schedules electives.
            grp = c.parallel_group or c.elective_group or f"core_{c_idx}"
            if grp not in groups:
                groups[grp] = []
            groups[grp].append(c_idx)

        for d in range(data.num_days):
            for p in range(data.num_periods):
                group_active_vars = []
                for grp_name, course_indices in groups.items():
                    grp_active = model.NewBoolVar(f"sec_{section}_grp_{grp_name}_d{d}_p{p}")
                    group_active_vars.append(grp_active)
                    for c_idx in course_indices:
                        c_active = sum(schedule[(c_idx, r_idx, d, p)] for r_idx in range(len(data.rooms)))
                        model.Add(c_active == grp_active)
                model.AddAtMostOne(group_active_vars)

    # F. MUTUAL EXCLUSIVITY (Rooms & Teachers)
    for d in range(data.num_days):
        for p in range(data.num_periods):
            for r_idx in range(len(data.rooms)):
                model.AddAtMostOne(schedule[(c_idx, r_idx, d, p)] for c_idx in range(len(data.courses)))
            for teacher in data.teachers:
                teacher_c_indices = [i for i, c in enumerate(data.courses) if teacher in c.teachers]
                model.AddAtMostOne(schedule[(c_idx, r_idx, d, p)] for c_idx in teacher_c_indices for r_idx in range(len(data.rooms)))

    # G. MAX 1 LAB GROUP PER DAY
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        lab_groups = {}
        for c_idx in c_indices:
            c = data.courses[c_idx]
            if c.is_lab:
                # Parallel batch labs count as ONE lab session for the "1 lab/day" rule.
                grp_name = c.parallel_group or c.elective_group or f"core_lab_{c_idx}"
                if grp_name not in lab_groups:
                    lab_groups[grp_name] = []
                lab_groups[grp_name].append(c_idx)

        for d in range(data.num_days):
            daily_active_lab_groups = []
            for grp_name, c_grp_indices in lab_groups.items():
                grp_active_today = model.NewBoolVar(f"lab_grp_{grp_name}_active_d{d}")
                total_classes_today = sum(
                    schedule[(i, r_idx, d, p)]
                    for i in c_grp_indices for r_idx in range(len(data.rooms)) for p in range(data.num_periods)
                )
                model.Add(total_classes_today > 0).OnlyEnforceIf(grp_active_today)
                model.Add(total_classes_today == 0).OnlyEnforceIf(grp_active_today.Not())
                daily_active_lab_groups.append(grp_active_today)
            model.Add(sum(daily_active_lab_groups) <= 1)

    # H. LOAD BALANCING (Relaxed to handle Day Offs)
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        unique_groups_hours = {}
        for c_idx in c_indices:
            c = data.courses[c_idx]
            grp = c.elective_group if c.elective_group else f"core_{c_idx}"
            if grp not in unique_groups_hours:
                unique_groups_hours[grp] = c.hours

        total_student_hours = sum(unique_groups_hours.values())
        avg_hours = total_student_hours / max(1, data.num_days)
        max_classes = min(data.num_periods, max(1, int(math.ceil(avg_hours)) + 2))

        for d in range(data.num_days):
            active_periods_today = []
            for p in range(data.num_periods):
                period_active = model.NewBoolVar(f"sec_{section}_d{d}_p{p}_active_load")
                total_classes_this_period = sum(
                    schedule[(i, r_idx, d, p)] for i in c_indices for r_idx in range(len(data.rooms))
                )
                model.Add(total_classes_this_period > 0).OnlyEnforceIf(period_active)
                model.Add(total_classes_this_period == 0).OnlyEnforceIf(period_active.Not())
                active_periods_today.append(period_active)
            model.Add(sum(active_periods_today) <= max_classes)

    # I. CONTIGUOUS SCHEDULING
    for section in data.sections:
        c_indices = [i for i, c in enumerate(data.courses) if c.section == section]
        for d in range(data.num_days):
            is_occupied = []
            for p in range(data.num_periods):
                occupied_var = model.NewBoolVar(f"sec_{section}_d{d}_p{p}_occupied")
                total_events = sum(
                    schedule[(i, r_idx, d, p)]
                    for i in c_indices for r_idx in range(len(data.rooms))
                ) + recess[(section, d, p)]

                model.Add(total_events > 0).OnlyEnforceIf(occupied_var)
                model.Add(total_events == 0).OnlyEnforceIf(occupied_var.Not())
                is_occupied.append(occupied_var)

            transitions = []
            for p in range(data.num_periods):
                t = model.NewBoolVar(f"sec_{section}_d{d}_p{p}_transition")
                if p == 0:
                    model.Add(t == is_occupied[0])
                else:
                    model.Add(t >= is_occupied[p] - is_occupied[p-1])
                transitions.append(t)

            model.Add(sum(transitions) <= 1).OnlyEnforceIf(sec_active_day[(section, d)])

    # J. FACULTY WORKLOAD
    max_teacher_hours_per_day = 4
    for teacher in data.teachers:
        teacher_c_indices = [i for i, c in enumerate(data.courses) if teacher in c.teachers]
        if not teacher_c_indices:
            continue

        for d in range(data.num_days):
            daily_teacher_classes = []
            for p in range(data.num_periods):
                for r_idx in range(len(data.rooms)):
                    for c_idx in teacher_c_indices:
                        daily_teacher_classes.append(schedule[(c_idx, r_idx, d, p)])
            model.Add(sum(daily_teacher_classes) <= max_teacher_hours_per_day)

    # K. SUBJECT FATIGUE
    for c_idx, c in enumerate(data.courses):
        if not c.is_lab:
            for d in range(data.num_days):
                model.Add(sum(
                    schedule[(c_idx, r_idx, d, p)]
                    for r_idx in range(len(data.rooms)) for p in range(data.num_periods)
                ) <= 2)

    # SOLVE
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 45.0
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        result = {section: [] for section in data.sections}
        for section in data.sections:
            for d in range(data.num_days):
                for p in range(data.num_periods):
                    if solver.Value(recess[(section, d, p)]) == 1:
                        result[section].append(ScheduledClass(
                            day=d, period=p + 1, room="Campus", course_name="RECESS", teachers=[], is_recess=True
                        ))
                    else:
                        for r_idx, room in enumerate(data.rooms):
                            for c_idx, c in enumerate(data.courses):
                                if c.section == section and solver.Value(schedule[(c_idx, r_idx, d, p)]) == 1:
                                    result[section].append(ScheduledClass(
                                        day=d, period=p + 1, room=room, course_name=c.name, teachers=c.teachers
                                    ))
        return {"status": "success", "schedule": result, "message": "Timetable generated successfully"}
    else:
        return {"status": "failed", "schedule": None, "message": "Could not find a conflict-free timetable."}

