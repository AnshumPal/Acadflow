"""
Tests for Syllabus Tracking, Audit, and Catchup Scheduling.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

import main
from main import app
from syllabus.syllabus_audit import calculate_deficit, audit_ledger
from syllabus.syllabus_ledger import (
    get_or_create_ledger, increment_lecture, progress_dict,
    DEFAULT_REGULAR_TARGET, DEFAULT_EXTRA_TARGET
)
from syllabus.extra_scheduler import find_extra_class_slot
from models.database_models import SyllabusLedger

client = TestClient(app)


# ---------- Deficit Calculation ----------

def test_calculate_deficit_on_track():
    # 36 lectures over 12 weeks: at week 6, expected is 18.
    res = calculate_deficit(completed=18, current_week=6, total_weeks=12, target=36)
    assert res["expected"] == 18
    assert res["deficit"] == 0
    assert res["is_lagging"] is False


def test_calculate_deficit_lagging():
    # Expected is 18, completed only 14 -> deficit of 4
    res = calculate_deficit(completed=14, current_week=6, total_weeks=12, target=36)
    assert res["expected"] == 18
    assert res["deficit"] == 4
    assert res["is_lagging"] is True


def test_calculate_deficit_invalid_inputs():
    with pytest.raises(ValueError):
        calculate_deficit(completed=5, current_week=15, total_weeks=10)
    with pytest.raises(ValueError):
        calculate_deficit(completed=5, current_week=5, total_weeks=0)


# ---------- Ledger Increment Logic ----------

def test_increment_regular_lecture():
    ledger = SyllabusLedger(
        course_id="CS101", section_id="A", regular_target=2, extra_target=1
    )
    increment_lecture(ledger, "regular")
    assert ledger.regular_completed == 1
    increment_lecture(ledger, "regular")
    assert ledger.regular_completed == 2
    with pytest.raises(ValueError):
        increment_lecture(ledger, "regular")


def test_increment_extra_lecture():
    ledger = SyllabusLedger(
        course_id="CS101", section_id="A", regular_target=2, extra_target=1, extra_scheduled=1
    )
    increment_lecture(ledger, "extra")
    assert ledger.extra_completed == 1
    assert ledger.extra_scheduled == 0
    with pytest.raises(ValueError):
        increment_lecture(ledger, "extra")


# ---------- Extra Scheduler Slot Finder ----------

def test_find_extra_class_slot_success():
    sched = {
        "A": [
            {"day": 0, "period": 1, "room": "R101", "teachers": ["T1"], "is_recess": False}
        ]
    }
    res = find_extra_class_slot(
        current_schedule=sched,
        section="A",
        teachers=["T1"],
        is_lab=False,
        all_rooms=["R101", "R102"],
        num_days=5,
        num_periods=8,
    )
    assert res["success"] is True
    assert (res["day"], res["period"]) != (0, 1)


# ---------- API Endpoints ----------

def test_syllabus_log_endpoint():
    req_id = f"test-log-{uuid.uuid4()}"
    cid = f"COURSE_{uuid.uuid4().hex[:6]}"
    payload = {
        "course_id": cid,
        "section_id": "SEC1",
        "lecture_type": "regular",
        "request_id": req_id,
    }
    r = client.post("/api/v1/syllabus/log", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["duplicate"] is False
    assert data["progress"]["regular_completed"] == 1

    # Duplicate request_id should be idempotent
    r2 = client.post("/api/v1/syllabus/log", json=payload)
    assert r2.status_code == 200
    assert r2.json()["duplicate"] is True


def test_syllabus_progress_endpoint():
    cid = f"COURSE_{uuid.uuid4().hex[:6]}"
    # First create/log a lecture
    client.post("/api/v1/syllabus/log", json={
        "course_id": cid,
        "section_id": "SEC1",
        "lecture_type": "regular",
        "request_id": str(uuid.uuid4()),
    })
    r = client.get(f"/api/v1/syllabus/progress/{cid}/SEC1")
    assert r.status_code == 200
    data = r.json()
    assert data["course_id"] == cid
    assert data["section_id"] == "SEC1"


def test_audit_and_catchup_endpoint():
    cid = f"COURSE_{uuid.uuid4().hex[:6]}"
    # Create a lagging ledger: 0 completed at week 8
    client.post("/api/v1/syllabus/log", json={
        "course_id": cid,
        "section_id": "SEC1",
        "lecture_type": "regular",
        "request_id": str(uuid.uuid4()),
    })
    sched = {
        "SEC1": []
    }
    payload = {
        "current_week": 8,
        "total_weeks": 12,
        "auto_schedule": True,
        "current_schedule": sched,
        "all_courses": [
            {"id": cid, "name": "Computer Science", "teachers": ["Prof. Smith"], "section": "SEC1", "is_lab": False}
        ],
        "all_rooms": ["R101", "Lab1"],
        "num_days": 5,
        "num_periods": 8,
    }
    r = client.post("/api/v1/syllabus/audit-and-catchup", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["current_week"] == 8
    assert "lagging_courses" in data
    assert "scheduling_results" in data
