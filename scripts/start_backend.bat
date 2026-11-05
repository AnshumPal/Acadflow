@echo off
rem AcadFlow - Launch backend server using active virtual environment
cd /d "%~dp0..\Backend"
"%~dp0..\.venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
