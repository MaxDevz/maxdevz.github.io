@echo off
REM Start GameApp.py using the local virtual environment in application\env
cd /d "%~dp0"
if not exist "env\Scripts\python.exe" (
  echo Virtual environment not found. Creating one now...
  python -m venv env
  if errorlevel 1 (
    echo Failed to create virtual environment. Please install Python first.
    pause
    exit /b 1
  )
  call "env\Scripts\activate.bat"
  echo Installing Flask...
  pip install flask
  echo Installing Flask-CORS...
  pip install flask-cors
) else (
  call "env\Scripts\activate.bat"
)
python GameApp.py
pause
