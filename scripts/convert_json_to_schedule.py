"""
Convert data/aiml_sem5_timetable_complete.json → frontend/src/data/prebuiltSchedule.js

Run from repo root:
    .\.venv\Scripts\python.exe scripts/convert_json_to_schedule.py
"""
import json
import os
import re

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SEC_MAP = {"VA": "V A", "VB": "V B", "VC": "V C"}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "data", "aiml_sem5_timetable_complete.json"), encoding="utf-8") as f:
    data = json.load(f)

result = {}
for sec_key, sec_data in data["sections"].items():
    sec_label = SEC_MAP.get(sec_key, sec_key)
    classes = []
    for day_entry in sec_data.get("timetable", []):
        day_name = day_entry.get("day", "")
        if day_name not in DAY_NAMES:
            continue
        day_idx = DAY_NAMES.index(day_name)
        for slot in day_entry.get("slots", []):
            act = slot.get("activity")
            t = slot.get("type", "free")
            if not act or t == "free":
                continue
            is_recess = t == "recess"
            rooms_found = re.findall(r"DT[-\s]?\d+(?:\s*\(Lab\))?", act, re.IGNORECASE)
            room = rooms_found[0].strip() if rooms_found else "TBD"
            course_name = "RECESS" if is_recess else act.split("(")[0].strip()
            classes.append(
                {
                    "day": day_idx,
                    "period": slot["period"],
                    "room": "Campus" if is_recess else room,
                    "course_name": course_name,
                    "teachers": [],
                    "is_recess": is_recess,
                }
            )
    result[sec_label] = sorted(classes, key=lambda x: (x["day"], x["period"]))

out_dir = os.path.join(ROOT, "frontend", "src", "data")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "prebuiltSchedule.js")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated from data/aiml_sem5_timetable_complete.json\n")
    f.write("// RBU B.Tech CSE (AIML) Sem V — pre-built schedule seed\n")
    f.write("// Do NOT edit manually; re-run scripts/convert_json_to_schedule.py to regenerate.\n\n")
    f.write("export const prebuiltSchedule = " + json.dumps(result, indent=2) + ";\n")

for sec, items in result.items():
    print(f"  {sec}: {len(items)} slots")
print(f"\nWritten → {out_path}")

