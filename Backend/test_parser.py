"""
AcadFlow - Test Suite for Timetable Ingestion, Parser, and Self-Correction.
"""
import io
import os
import sys
import pytest
from openpyxl import load_workbook

# Add Backend to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from timetable_parser import TimetableParser, ValidationReport
from models import ScheduledClass, TimetableIngestRequest
from main import ingest_and_validate_timetable, ingest_timetable_and_stream_excel

SAMPLE_CSV = """Shift/Semester: V A,,,Session: 2025-26,,,Date: 10/11/2026,,
Lecture,1,2,3,4,5,6,7,8
"TIME
DAY",9:00 - 10:00,10:00 - 11:00,11:00 - 12:00,12:00 - 1:00,1:00 - 2:00,2:00 - 3:00,3:00 - 4:00,4:00 - 5:00
MONDAY,,"MDM-II
(MDM Faculty)
[DT-403]",RECESS,"Computer Networks (CN)
(Prof. N. Lanke)
[DT-612]","Idea Lab
(Prof. S. Meshram)
[DT-609 (Lab)]","Idea Lab
(Prof. S. Meshram)
[DT-609 (Lab)]",,
TUESDAY,"Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-403]","Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-406]","PDA (Programming for Data Science)
(D. Junghare)
[DT-403]
--- OR ---
IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-406]",RECESS,,,,
WEDNESDAY,,"MDM-II
(MDM Faculty)
[DT-403]",RECESS,"C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-609 (Lab)]
--- OR ---
CN Lab (Batch 1)
(Prof. N. Lanke, Dr. P. Agarkar)
[DT-405 (Lab)]","C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-609 (Lab)]
--- OR ---
CN Lab (Batch 1)
(Prof. N. Lanke, Dr. P. Agarkar)
[DT-405 (Lab)]","Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-612]",,
THURSDAY,,"Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-612]",RECESS,"CN Lab (Batch 2)
(Prof. N. Lanke, Dr. P. Agarkar)
[DT-609 (Lab)]
--- OR ---
C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]","CN Lab (Batch 2)
(Prof. N. Lanke, Dr. P. Agarkar)
[DT-609 (Lab)]
--- OR ---
C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]","PDA (Programming for Data Science)
(D. Junghare)
[DT-406]
--- OR ---
IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-612]",,
FRIDAY,"DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]
--- OR ---
ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-409 (Lab)]","DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]
--- OR ---
ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-409 (Lab)]",RECESS,"Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-612]","MDM-II
(MDM Faculty)
[DT-612]","Computer Networks (CN)
(Prof. N. Lanke)
[DT-403]",,
SATURDAY,"Open Elective-III (OE)
(Prof. Karthikeyan V.)
[DT-403]","ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-405 (Lab)]","ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-405 (Lab)]",RECESS,"PDA (Programming for Data Science)
(D. Junghare)
[DT-406]
--- OR ---
IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-612]","Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-403]","Computer Networks (CN)
(Prof. N. Lanke)
[DT-403]",
Shift/Semester: V B,,,Session: 2025-26,,,Date: 10/11/2026,,
Lecture,1,2,3,4,5,6,7,8
"TIME
DAY",9:00 - 10:00,10:00 - 11:00,11:00 - 12:00,12:00 - 1:00,1:00 - 2:00,2:00 - 3:00,3:00 - 4:00,4:00 - 5:00
MONDAY,"Computer Networks (CN)
(Dr. R. Welekar)
[DT-406]","Computer Networks (CN)
(Dr. R. Welekar)
[DT-612]","Open Elective-III (OE)
(Prof. A. Lokhande)
[DT-406]",RECESS,"Idea Lab
(Prof. A. Lokhande)
[DT-509 (Lab)]","Idea Lab
(Prof. A. Lokhande)
[DT-509 (Lab)]","Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-403]",
TUESDAY,,"C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]
--- OR ---
CN Lab (Batch 2)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-405 (Lab)]","C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]
--- OR ---
CN Lab (Batch 2)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-405 (Lab)]",RECESS,"IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-403]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-406]","MDM-II
(MDM Faculty)
[DT-406]","Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-406]",
WEDNESDAY,"DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]
--- OR ---
ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-405 (Lab)]","DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]
--- OR ---
ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-405 (Lab)]","Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-403]",RECESS,"Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-406]",,,
THURSDAY,"Cloud & Edge Computing for AI (C&EC)
(Prof. H. Patil)
[DT-406]","DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-609 (Lab)]
--- OR ---
ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-509 (Lab)]","DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-609 (Lab)]
--- OR ---
ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-509 (Lab)]",RECESS,"IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-403]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-612]",,,
FRIDAY,,"Computer Networks (CN)
(Dr. R. Welekar)
[DT-406]","MDM-II
(MDM Faculty)
[DT-406]",RECESS,"CN Lab (Batch 1)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-409 (Lab)]
--- OR ---
C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-405 (Lab)]","CN Lab (Batch 1)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-409 (Lab)]
--- OR ---
C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-405 (Lab)]","Machine Learning (ML)
(Dr. A. Pimpalkar)
[DT-612]",
SATURDAY,,"MDM-II
(MDM Faculty)
[DT-612]",RECESS,"IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-403]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-612]",,,,
Shift/Semester: V C,,,Session: 2025-26,,,Date: 10/11/2026,,
Lecture,1,2,3,4,5,6,7,8
"TIME
DAY",9:00 - 10:00,10:00 - 11:00,11:00 - 12:00,12:00 - 1:00,1:00 - 2:00,2:00 - 3:00,3:00 - 4:00,4:00 - 5:00
MONDAY,"ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-409 (Lab)]","ML Lab (Batch 1)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 2)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-409 (Lab)]",RECESS,"Machine Learning (ML)
(Prof. A. Gudadhe)
[DT-403]","Machine Learning (ML)
(Prof. A. Gudadhe)
[DT-612]",,,
TUESDAY,"Open Elective-III (OE)
(Prof. P. Dhule)
[DT-406]","MDM-II
(MDM Faculty)
[DT-403]","MDM-II
(MDM Faculty)
[DT-612]",RECESS,"Cloud & Edge Computing for AI (C&EC)
(Dr. P. Agarkar)
[DT-612]","ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]","ML Lab (Batch 2)
(Dr. A. Pimpalkar, Prof. A. Gudadhe)
[DT-609 (Lab)]
--- OR ---
DAV Lab (Batch 1)
(Prof. Karthikeyan V., Prof. S. Meshram)
[DT-509 (Lab)]",
WEDNESDAY,"Computer Networks (CN)
(Dr. R. Welekar)
[DT-403]","Idea Lab
(Prof. R. Padegaonkar)
[DT-609 (Lab)]","Idea Lab
(Prof. R. Padegaonkar)
[DT-609 (Lab)]",RECESS,"IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-403]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-612]","IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-403]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-406]",,
THURSDAY,,,,,,,,
FRIDAY,"MDM-II
(MDM Faculty)
[DT-403]","C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-609 (Lab)]
--- OR ---
CN Lab (Batch 2)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-405 (Lab)]","C&EC Lab (Batch 1)
(Prof. H. Patil, Prof. P. Dhule)
[DT-609 (Lab)]
--- OR ---
CN Lab (Batch 2)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-405 (Lab)]",RECESS,"Computer Networks (CN)
(Dr. R. Welekar)
[DT-406]","IP (Image Processing Generative Models)
(Prof. S. Meshram)
[DT-406]
--- OR ---
PDA (Programming for Data Science)
(D. Junghare)
[DT-612]",,
SATURDAY,"Computer Networks (CN)
(Dr. R. Welekar)
[DT-612]","C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]
--- OR ---
CN Lab (Batch 1)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-409 (Lab)]","C&EC Lab (Batch 2)
(Prof. H. Patil, Prof. P. Dhule)
[DT-509 (Lab)]
--- OR ---
CN Lab (Batch 1)
(Dr. P. Agarkar, Prof. R. Padegaonkar)
[DT-409 (Lab)]",RECESS,"Machine Learning (ML)
(Prof. A. Gudadhe)
[DT-403]","Cloud & Edge Computing for AI (C&EC)
(Dr. P. Agarkar)
[DT-406]","Cloud & Edge Computing for AI (C&EC)
(Dr. P. Agarkar)
[DT-406]",
"""


def test_parser_ingestion_and_self_correction():
    parser = TimetableParser()
    raw_schedule = parser.ingest_csv(SAMPLE_CSV)

    # Initial parsed schedule should detect that V C is missing Thursday (day 3)
    vc_days_before = set(c.day for c in raw_schedule["V C"])
    assert 3 not in vc_days_before, "V C Thursday should originally be empty"

    # Self-correct schedule
    corrected_schedule, recovered_notes = parser.self_correct_schedule(raw_schedule)
    vc_days_after = set(c.day for c in corrected_schedule["V C"])
    assert 3 in vc_days_after, "V C Thursday must be recovered by self-correction"
    assert len(recovered_notes) >= 1
    assert "Section V C on THURSDAY" in recovered_notes[0]


def test_parser_room_type_enforcement():
    parser = TimetableParser()
    assert parser.is_lab_course("Machine Learning Lab")
    assert parser.is_lab_course("CN Lab (Batch 1)")
    assert parser.is_lab_course("Idea Lab")
    assert not parser.is_lab_course("Computer Networks (CN)")
    assert not parser.is_lab_course("Machine Learning (ML)")

    assert parser.is_lab_room("DT-609 (Lab)")
    assert parser.is_lab_room("DT-509 (Lab)")
    assert not parser.is_lab_room("DT-403")
    assert not parser.is_lab_room("DT-612")


def test_parser_validation_conflict_free():
    parser = TimetableParser()
    res = parser.process_and_generate(SAMPLE_CSV)

    assert res["status"] == "success"
    vr = res["validation_report"]
    assert vr["is_valid"] is True
    assert vr["coverage_complete"] is True
    assert len(vr["conflicts_detected"]) == 0
    assert len(vr["room_violations"]) == 0
    assert set(vr["sections_checked"]) == {"V A", "V B", "V C"}


def test_parser_excel_generation(tmp_path):
    parser = TimetableParser()
    excel_path = os.path.join(tmp_path, "test_output.xlsx")
    res = parser.process_and_generate(SAMPLE_CSV, output_excel_path=excel_path)

    assert os.path.exists(excel_path)
    wb = load_workbook(excel_path)
    assert set(wb.sheetnames) == {"V A", "V B", "V C"}

    # Verify sheet V C has Thursday row populated
    ws_vc = wb["V C"]
    # Row 7 is Thursday (row 4=Monday, 5=Tuesday, 6=Wednesday, 7=Thursday)
    thursday_row_val = ws_vc.cell(row=7, column=1).value
    assert thursday_row_val == "THURSDAY"
    # Col 2 is Period 1
    p1_val = ws_vc.cell(row=7, column=2).value
    assert p1_val is not None and "MDM-II" in p1_val


def test_api_ingest_endpoint():
    req = TimetableIngestRequest(
        csv_content=SAMPLE_CSV,
        auto_self_correct=True,
        export_excel=False,
    )
    data = ingest_and_validate_timetable(req)
    assert data["status"] == "success"
    assert "schedule" in data
    assert "V C" in data["schedule"]
    # Ensure Thursday has recovered slots in V C
    vc_thursday = [c for c in data["schedule"]["V C"] if c["day"] == 3]
    assert len(vc_thursday) > 0


def test_api_ingest_excel_endpoint():
    req = TimetableIngestRequest(
        csv_content=SAMPLE_CSV,
        auto_self_correct=True,
        export_excel=True,
    )
    streaming_response = ingest_timetable_and_stream_excel(req)
    assert streaming_response.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment; filename=" in streaming_response.headers["Content-Disposition"]


def test_minimum_daily_hours_hard_constraint_validation():
    from scheduling_engine import (
        count_daily_contact_hours,
        validate_minimum_daily_hours,
        evaluate_schedule_fitness,
    )

    # Schedule with 2 contact hours on Saturday and 0 on Thursday
    schedule = {
        "Sec1": [
            ScheduledClass(day=0, period=1, room="DT-403", course_name="T1", teachers=["A"]),
            ScheduledClass(day=0, period=2, room="DT-403", course_name="T2", teachers=["A"]),
            ScheduledClass(day=0, period=3, room="DT-403", course_name="T3", teachers=["A"]),
            ScheduledClass(day=5, period=1, room="DT-403", course_name="T4", teachers=["B"]),
            ScheduledClass(day=5, period=2, room="DT-403", course_name="T5", teachers=["B"]),
            # Saturday only has 2 hours; Thursday has 0 hours
        ]
    }

    assert count_daily_contact_hours(schedule, "Sec1", 0) == 3
    assert count_daily_contact_hours(schedule, "Sec1", 5) == 2
    assert count_daily_contact_hours(schedule, "Sec1", 3) == 0

    is_valid, violations, matrix = validate_minimum_daily_hours(schedule, min_hours=3, num_days=6)
    assert is_valid is False
    assert len(violations) >= 2
    assert any("Saturday" in v for v in violations)
    assert any("Thursday" in v for v in violations)

    # Fitness evaluation must heavily penalize deficit days
    fitness = evaluate_schedule_fitness(schedule, min_hours=3, num_days=6)
    assert fitness < 0


def test_redistribution_protocol_heaviest_to_deficit():
    from scheduling_engine import (
        count_daily_contact_hours,
        validate_minimum_daily_hours,
        redistribute_to_meet_minimum_hours,
    )

    # Sec1 has Monday (day 0) with 5 classes and Saturday (day 5) with only 2 classes
    schedule = {
        "Sec1": [
            ScheduledClass(day=0, period=1, room="DT-403", course_name="T1", teachers=["A"]),
            ScheduledClass(day=0, period=2, room="DT-403", course_name="T2", teachers=["A"]),
            ScheduledClass(day=0, period=4, room="DT-403", course_name="T3", teachers=["A"]),
            ScheduledClass(day=0, period=5, room="DT-403", course_name="T4", teachers=["A"]),
            ScheduledClass(day=0, period=6, room="DT-403", course_name="T5", teachers=["A"]),
            ScheduledClass(day=1, period=1, room="DT-403", course_name="T6", teachers=["B"]),
            ScheduledClass(day=1, period=2, room="DT-403", course_name="T7", teachers=["B"]),
            ScheduledClass(day=1, period=3, room="DT-403", course_name="T8", teachers=["B"]),
            ScheduledClass(day=2, period=1, room="DT-403", course_name="T9", teachers=["C"]),
            ScheduledClass(day=2, period=2, room="DT-403", course_name="T10", teachers=["C"]),
            ScheduledClass(day=2, period=3, room="DT-403", course_name="T11", teachers=["C"]),
            ScheduledClass(day=3, period=1, room="DT-403", course_name="T12", teachers=["D"]),
            ScheduledClass(day=3, period=2, room="DT-403", course_name="T13", teachers=["D"]),
            ScheduledClass(day=3, period=3, room="DT-403", course_name="T14", teachers=["D"]),
            ScheduledClass(day=4, period=1, room="DT-403", course_name="T15", teachers=["E"]),
            ScheduledClass(day=4, period=2, room="DT-403", course_name="T16", teachers=["E"]),
            ScheduledClass(day=4, period=3, room="DT-403", course_name="T17", teachers=["E"]),
            ScheduledClass(day=5, period=1, room="DT-403", course_name="T18", teachers=["F"]),
            ScheduledClass(day=5, period=2, room="DT-403", course_name="T19", teachers=["F"]),
        ]
    }

    assert count_daily_contact_hours(schedule, "Sec1", 5) == 2
    assert count_daily_contact_hours(schedule, "Sec1", 0) == 5

    balanced, logs = redistribute_to_meet_minimum_hours(
        schedule,
        all_rooms=["DT-403", "DT-406", "DT-612"],
        min_hours=3,
        num_days=6,
        num_periods=8,
    )

    assert len(logs) >= 1
    # After redistribution, Saturday must have at least 3 contact hours
    assert count_daily_contact_hours(balanced, "Sec1", 5) >= 3
    # Monday must still have at least 3 contact hours
    assert count_daily_contact_hours(balanced, "Sec1", 0) >= 3

    is_valid, violations, _ = validate_minimum_daily_hours(balanced, min_hours=3, num_days=6)
    assert is_valid is True
    assert len(violations) == 0


def test_domino_swap_prevents_dropping_below_minimum_hours():
    from scheduling_engine import domino_swap
    from models import ScheduledClass as SC

    # Sec1 has Tuesday (day 1) with exactly 3 classes. Moving one class away to Day 2
    # would leave Tuesday with only 2 hours, which must be blocked by the hard constraint.
    schedule = {
        "Sec1": [
            SC(day=1, period=1, room="DT-403", course_name="T1", teachers=["A"]),
            SC(day=1, period=2, room="DT-403", course_name="T2", teachers=["A"]),
            SC(day=1, period=3, room="DT-403", course_name="T3", teachers=["A"]),
        ]
    }

    source_class = schedule["Sec1"][0]
    result = domino_swap(
        schedule,
        section="Sec1",
        course_name="T1",
        teachers=["A"],
        is_lab=False,
        target_day=2,  # Move to Wednesday
        target_period=1,
        all_rooms=["DT-403", "DT-406"],
        ScheduledClass=SC,
        source=source_class,
    )

    assert result.success is False
    assert "Minimum Daily Hours Hard Constraint" in result.message


