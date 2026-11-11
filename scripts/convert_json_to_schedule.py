"""
Convert data/aiml_sem5_timetable_validated.json → frontend/src/data/prebuiltSchedule.js

The validated JSON is the authoritative source: it has been self-corrected (Thursday
V C recovered from Master=TT), room-verified, conflict-free, and all sections satisfy
the >= 3 contact hours / day hard constraint.

Run from repo root:
    .venv/Scripts/python.exe scripts/convert_json_to_schedule.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VALIDATED_JSON = os.path.join(ROOT, "data", "aiml_sem5_timetable_validated.json")

# ---------------------------------------------------------------------------
# Load validated JSON
# ---------------------------------------------------------------------------
with open(VALIDATED_JSON, encoding="utf-8") as f:
    data = json.load(f)

# The validated JSON top-level has { "status", "message", "validation_report", "schedule" }
# "schedule" maps section labels ("V A", "V B", "V C") → list of ScheduledClass dicts.
schedule_data = data.get("schedule", {})

if not schedule_data:
    raise RuntimeError(
        f"'schedule' key not found or empty in {VALIDATED_JSON}. "
        "Re-run scripts/generate_validated_timetable.py to regenerate the file."
    )

# ---------------------------------------------------------------------------
# Build the JS-friendly output — keep all fields so the frontend can use them.
# ---------------------------------------------------------------------------
result = {}
for sec_label, classes in schedule_data.items():
    result[sec_label] = sorted(classes, key=lambda c: (c["day"], c["period"]))

# ---------------------------------------------------------------------------
# Write to frontend
# ---------------------------------------------------------------------------
out_dir = os.path.join(ROOT, "frontend", "src", "data")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "prebuiltSchedule.js")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated from data/aiml_sem5_timetable_validated.json\n")
    f.write("// RBU B.Tech CSE (AIML) Sem V — pre-built schedule seed\n")
    f.write("// Self-corrected ✓  Room-verified ✓  Min 3h/day constraint ✓\n")
    f.write("// Do NOT edit manually; re-run scripts/convert_json_to_schedule.py to regenerate.\n\n")
    f.write("export const prebuiltSchedule = " + json.dumps(result, indent=2) + ";\n")

print("Source: data/aiml_sem5_timetable_validated.json")
print("Sections written:")
for sec, items in result.items():
    contact = sum(1 for c in items if not c.get("is_recess", False))
    print(f"  {sec}: {len(items)} total slots  ({contact} contact classes)")
print(f"\nWritten -> {out_path}")
