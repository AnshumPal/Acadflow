"""
AcadFlow - Excel Timetable Exporter.
"""
import io
from datetime import date
import openpyxl.utils
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, Border, Side, PatternFill

try:
    from .models import ExportRequest
except (ImportError, ValueError):
    from models import ExportRequest


def build_excel_timetable(request: ExportRequest) -> io.BytesIO:
    """
    Generates a professionally formatted Excel spreadsheet (.xlsx) representing
    the timetable for each section, including header information, slot grid,
    styling, and coordinator legends.
    """
    wb = Workbook()

    if "Sheet" in wb.sheetnames:
        wb.remove(wb["Sheet"])

    day_names = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    times = [
        "9:00 - 10:00",
        "10:00 - 11:00",
        "11:00 - 12:00",
        "12:00 - 1:00",
        "1:00 - 2:00",
        "2:00 - 3:00",
        "3:00 - 4:00",
        "4:00 - 5:00",
    ]

    bold_font = Font(bold=True)
    center_aligned = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )
    header_fill = PatternFill(start_color="EAEAEA", end_color="EAEAEA", fill_type="solid")

    for section, classes in request.schedule.items():
        ws = wb.create_sheet(title=section)

        ws.column_dimensions["A"].width = 15
        for col in range(2, request.num_periods + 2):
            ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 24

        ws.merge_cells("A1:C1")
        ws["A1"] = f"Shift/Semester: {section}"
        ws["A1"].font = bold_font

        ws.merge_cells("D1:F1")
        ws["D1"] = "Session: 2025-26"
        ws["D1"].font = bold_font
        ws["D1"].alignment = Alignment(horizontal="center")

        ws.merge_cells("G1:I1")
        ws["G1"] = f"Date: {date.today().strftime('%d/%m/%Y')}"
        ws["G1"].font = bold_font
        ws["G1"].alignment = Alignment(horizontal="right")

        ws["A2"] = "Lecture"
        ws["A3"] = "TIME\nDAY"
        ws.row_dimensions[3].height = 30

        for i in range(request.num_periods):
            ws.cell(row=2, column=i + 2, value=str(i + 1))
            ws.cell(row=3, column=i + 2, value=times[i] if i < len(times) else "---")

        for i in range(request.num_days):
            ws.cell(row=i + 4, column=1, value=day_names[i])
            ws.row_dimensions[i + 4].height = 80

        unique_courses = {}

        # Aggregate classes by (day, period) slot
        grid = {}
        for c in classes:
            if c.day >= request.num_days or c.period > request.num_periods:
                continue
            key = (c.day, c.period)
            if key not in grid:
                grid[key] = []
            grid[key].append(c)

        # Fill the grid cells
        for (day, period), slot_classes in grid.items():
            row = day + 4
            col = period + 1
            cell = ws.cell(row=row, column=col)

            if len(slot_classes) == 1 and slot_classes[0].is_recess:
                cell.value = "RECESS"
                cell.font = bold_font
            else:
                cell_texts = []
                for sc in slot_classes:
                    teachers_str = ", ".join(sc.teachers)
                    cell_texts.append(f"{sc.course_name}\n({teachers_str})\n[{sc.room}]")
                    unique_courses[sc.course_name] = teachers_str

                cell.value = "\n--- OR ---\n".join(cell_texts)

        # Apply borders and styling to grid
        for r in range(2, request.num_days + 4):
            for col_idx in range(1, request.num_periods + 2):
                cell = ws.cell(row=r, column=col_idx)
                cell.border = thin_border
                cell.alignment = center_aligned
                if r <= 3 or col_idx == 1:
                    cell.fill = header_fill
                    cell.font = bold_font

        legend_start_row = request.num_days + 6

        ws.cell(row=legend_start_row, column=2, value="Time Table In-Charge").font = bold_font
        ws.cell(row=legend_start_row, column=request.num_periods, value="HOD").font = bold_font

        legend_table_row = legend_start_row + 2
        ws.cell(row=legend_table_row, column=2, value="Course Details").font = bold_font
        ws.cell(row=legend_table_row, column=3, value="Course Coordinator").font = bold_font

        ws.cell(row=legend_table_row, column=2).border = thin_border
        ws.cell(row=legend_table_row, column=3).border = thin_border
        ws.cell(row=legend_table_row, column=2).fill = header_fill
        ws.cell(row=legend_table_row, column=3).fill = header_fill

        current_row = legend_table_row + 1
        for course, coordinator in unique_courses.items():
            if course == "RECESS":
                continue
            ws.cell(row=current_row, column=2, value=course).border = thin_border
            ws.cell(row=current_row, column=3, value=coordinator).border = thin_border
            current_row += 1

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

