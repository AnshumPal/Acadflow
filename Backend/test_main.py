"""
Test suite for AcadFlow backend.

Run from the Backend/ folder:
    ../.venv/Scripts/python.exe -m pytest -v
"""
from collections import Counter

import pytest
from fastapi.testclient import TestClient

import main
from main import Course, periods_from_credits, app

client = TestClient(app)


def teaching_slots(section_schedule):
    """Count non-recess periods per course name."""
    return Counter(c["course_name"] for c in section_schedule if not c["is_recess"])


# ---------- Credit scheme (RBU) ----------

def test_theory_credits_map_to_periods():
    assert periods_from_credits(3, is_lab=False) == 3
    assert periods_from_credits(2, is_lab=False) == 2


def test_lab_credit_maps_to_block():
    # 1 lab credit = one lab (a 2-period block)
    assert periods_from_credits(1, is_lab=True) == 2


def test_course_derives_hours_from_credits():
    theory = Course(id="T1", name="DL", teachers=["A"], section="X", credits=3)
    lab = Course(id="L1", name="DL Lab", teachers=["A"], section="X", credits=1, is_lab=True)
    assert theory.hours == 3
    assert lab.hours == 2


def test_course_accepts_explicit_hours():
    legacy = Course(id="H1", name="Legacy", teachers=["A"], section="X", hours=4)
    assert legacy.hours == 4


def test_course_requires_credits_or_hours():
    with pytest.raises(Exception):
        Course(id="B1", name="Bad", teachers=["A"], section="X")


# ---------- Generation ----------

FEASIBLE_PAYLOAD = {
    "num_days": 5,
    "num_periods": 8,
    "sections": ["A"],
    "teachers": ["T1", "T2"],
    "rooms": ["R101", "Lab201"],
    "courses": [
        {"id": "C1", "name": "DL", "teachers": ["T1"], "section": "A", "credits": 3, "is_lab": False},
        {"id": "C2", "name": "CN", "teachers": ["T2"], "section": "A", "credits": 2, "is_lab": False},
        {"id": "C3", "name": "DL Lab", "teachers": ["T1"], "section": "A", "credits": 1, "is_lab": True},
    ],
}


def test_generate_returns_success_and_schedule():
    r = client.post("/api/v1/generate", json=FEASIBLE_PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert "A" in data["schedule"]


def test_generated_periods_match_credits():
    r = client.post("/api/v1/generate", json=FEASIBLE_PAYLOAD)
    slots = teaching_slots(r.json()["schedule"]["A"])
    assert slots["DL"] == 3        # 3-credit theory -> 3 periods
    assert slots["CN"] == 2        # 2-credit theory -> 2 periods
    assert slots["DL Lab"] == 2    # 1-credit lab   -> 2-period block


def test_no_teacher_double_booking():
    r = client.post("/api/v1/generate", json=FEASIBLE_PAYLOAD)
    seen = set()  # (teacher, day, period)
    for cls in r.json()["schedule"]["A"]:
        if cls["is_recess"]:
            continue
        for t in cls["teachers"]:
            key = (t, cls["day"], cls["period"])
            assert key not in seen, f"teacher {t} double-booked at {key}"
            seen.add(key)


def test_infeasible_payload_returns_400():
    # A 6-credit theory course can place at most 2 periods/day (subject-fatigue rule),
    # so across only 2 days it needs 6 but can fit 4 -> no conflict-free timetable.
    payload = {
        "num_days": 2,
        "num_periods": 8,
        "sections": ["A"],
        "teachers": ["T1"],
        "rooms": ["R101"],
        "courses": [
            {"id": "C1", "name": "Big", "teachers": ["T1"], "section": "A", "credits": 6, "is_lab": False},
        ],
    }
    r = client.post("/api/v1/generate", json=payload)
    assert r.status_code == 400


def test_fixed_period_pins_course_to_that_column():
    # MDM pinned to period 1 must appear only in period 1.
    payload = {
        "num_days": 5, "num_periods": 8,
        "sections": ["A"], "teachers": ["T1", "T2"], "rooms": ["R101", "R102"],
        "courses": [
            {"id": "MDM", "name": "MDM", "teachers": ["T1"], "section": "A", "credits": 2,
             "is_lab": False, "fixed_period": 1},
            {"id": "CN", "name": "CN", "teachers": ["T2"], "section": "A", "credits": 3, "is_lab": False},
        ],
    }
    r = client.post("/api/v1/generate", json=payload)
    assert r.status_code == 200
    mdm_periods = {c["period"] for c in r.json()["schedule"]["A"]
                   if c["course_name"] == "MDM"}
    assert mdm_periods == {1}, f"MDM should only be at period 1, got {mdm_periods}"


def test_parallel_labs_run_in_same_slot_different_rooms():
    # Two labs sharing a parallel_group must run at the SAME day+period (parallel batches),
    # in different lab rooms.
    payload = {
        "num_days": 5, "num_periods": 8,
        "sections": ["A"], "teachers": ["T1", "T2", "T3"],
        "rooms": ["R101", "Lab1", "Lab2"],
        "courses": [
            {"id": "CNL", "name": "CN Lab", "teachers": ["T1"], "section": "A", "credits": 1,
             "is_lab": True, "parallel_group": "BATCH"},
            {"id": "CECL", "name": "C&EC Lab", "teachers": ["T2"], "section": "A", "credits": 1,
             "is_lab": True, "parallel_group": "BATCH"},
            {"id": "TH", "name": "Theory", "teachers": ["T3"], "section": "A", "credits": 2, "is_lab": False},
        ],
    }
    r = client.post("/api/v1/generate", json=payload)
    assert r.status_code == 200
    sched = r.json()["schedule"]["A"]
    cn = {(c["day"], c["period"]) for c in sched if c["course_name"] == "CN Lab"}
    cec = {(c["day"], c["period"]) for c in sched if c["course_name"] == "C&EC Lab"}
    assert cn and cec, "both labs should be scheduled"
    assert cn == cec, f"parallel labs must share the same slots: {cn} vs {cec}"
    # different rooms at the shared slot
    for (day, period) in cn:
        rooms_here = {c["room"] for c in sched
                      if c["day"] == day and c["period"] == period
                      and c["course_name"] in ("CN Lab", "C&EC Lab")}
        assert len(rooms_here) == 2, f"parallel labs must use 2 different rooms at {(day, period)}"


def test_num_periods_below_minimum_rejected():
    # Teammate's validation: fewer than 4 periods/day is rejected (422).
    payload = {
        "num_days": 5, "num_periods": 2,
        "sections": ["A"], "teachers": ["T1"], "rooms": ["R101"],
        "courses": [{"id": "C1", "name": "X", "teachers": ["T1"], "section": "A", "credits": 1}],
    }
    r = client.post("/api/v1/generate", json=payload)
    assert r.status_code == 422


# ---------- Export ----------

def test_excel_export_returns_xlsx():
    gen = client.post("/api/v1/generate", json=FEASIBLE_PAYLOAD).json()
    r = client.post("/api/v1/export/excel", json={
        "schedule": gen["schedule"], "num_days": 5, "num_periods": 8,
    })
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    assert r.content[:2] == b"PK"  # xlsx is a zip
