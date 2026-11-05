"""
AcadFlow - Syllabus Audit and Deficit Calculation.
"""


def calculate_deficit(
    completed: int,
    current_week: int,
    total_weeks: int,
    target: int = 36,
) -> dict:
    """Linear progress trajectory; weeks are one-indexed."""
    if total_weeks < 1:
        raise ValueError("total_weeks must be at least 1")
    if current_week < 0 or current_week > total_weeks:
        raise ValueError("current_week must be between 0 and total_weeks")
    if target < 0 or completed < 0:
        raise ValueError("target and completed cannot be negative")

    expected = round(target * current_week / total_weeks)
    deficit = max(0, expected - completed)
    return {
        "expected": expected,
        "completed": completed,
        "deficit": deficit,
        "is_lagging": deficit > 0,
    }


def audit_ledger(ledger, current_week: int, total_weeks: int) -> dict:
    regular_completed = ledger.regular_completed or 0
    regular_target = ledger.regular_target if ledger.regular_target is not None else 36
    result = calculate_deficit(
        completed=regular_completed,
        current_week=current_week,
        total_weeks=total_weeks,
        target=regular_target,
    )
    return {
        "course_id": ledger.course_id,
        "section_id": ledger.section_id,
        **result,
        "regular_target": regular_target,
        "extra_completed": ledger.extra_completed or 0,
        "extra_scheduled": ledger.extra_scheduled or 0,
    }
