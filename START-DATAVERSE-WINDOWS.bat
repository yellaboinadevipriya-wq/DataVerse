@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Python launcher not found. Install Python 3.11+ first.& pause & exit /b 1)
where node >nul 2>nul || (echo Node.js not found. Install Node.js 20+ first.& pause & exit /b 1)
if not exist .venv py -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --quiet -r requirements.txt || (echo Backend install failed.& pause & exit /b 1)
if not exist .env copy .env.example .env >nul
start "DataVerse API" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate.bat && uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"
cd frontend
if not exist node_modules call npm install || (echo Frontend install failed.& pause & exit /b 1)
call npm run dev
