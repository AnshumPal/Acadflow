"""
AcadFlow - Generate Validated JSON & Excel Workbooks from Ingested University Timetables.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "Backend"))

from timetable_parser import TimetableParser
from test_parser import SAMPLE_CSV

def main():
    print("Initializing AcadFlow Timetable Parser...")
    parser = TimetableParser()

    out_json_path = os.path.join(ROOT, "data", "aiml_sem5_timetable_validated.json")
    out_xlsx_path = os.path.join(ROOT, "data", "AcadFlow_Timetable_Sem5_Validated.xlsx")

    print(f"Ingesting raw timetable data and executing self-correction pipeline...")
    result = parser.process_and_generate(SAMPLE_CSV, output_excel_path=out_xlsx_path)

    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"Generated Validated JSON Payload -> {out_json_path}")
    print(f"Generated Validated Excel Workbook -> {out_xlsx_path}")
    print("\nValidation Summary:")
    print(json.dumps(result["validation_report"], indent=2))

if __name__ == "__main__":
    main()
