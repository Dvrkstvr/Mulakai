@echo off
REM Mulakai complete startup: ACE-Step API + server + client
setlocal

echo ==================================
echo   Mulakai Startup
echo ==================================
echo.

REM Check dependencies are installed
if not exist "%~dp0client\node_modules" (
    echo Error: client dependencies not installed. Run: cd client ^&^& npm install
    pause
    exit /b 1
)
if not exist "%~dp0server\node_modules" (
    echo Error: server dependencies not installed. Run: cd server ^&^& npm install
    pause
    exit /b 1
)

REM ACE-Step location (override with: set ACESTEP_PATH=C:\path\to\ACE-Step-1.5)
if "%ACESTEP_PATH%"=="" (
    set "ACESTEP_PATH=S:\AI Gen\ACE-Step-1.5"
)
if not exist "%ACESTEP_PATH%" (
    echo Error: ACE-Step not found at %ACESTEP_PATH%
    echo Set ACESTEP_PATH to your ACE-Step-1.5 directory.
    pause
    exit /b 1
)

REM Detect ACE-Step installation type (native FastAPI server, NOT Gradio)
set API_COMMAND=
if exist "%ACESTEP_PATH%\python_embeded\python.exe" (
    echo [+] Detected Windows Portable Package
    set API_COMMAND=python_embeded\python acestep\api_server.py --port 8001
) else (
    echo [+] Detected Standard Installation
    set API_COMMAND=uv run acestep-api --port 8001
)

echo.
echo [1/3] Starting ACE-Step API server...
start "ACE-Step API" cmd /k "cd /d "%ACESTEP_PATH%" && %API_COMMAND%"

echo Waiting for API to initialize...
timeout /t 5 /nobreak >nul

echo [2/3] Starting Mulakai server...
start "Mulakai Server" cmd /k "cd /d "%~dp0server" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Mulakai client...
start "Mulakai Client" cmd /k "cd /d "%~dp0client" && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ==================================
echo   All services running
echo ==================================
echo.
echo   ACE-Step API: http://localhost:8001
echo   Server:       http://localhost:3001
echo   Client:       http://localhost:5173
echo.
echo   Close the terminal windows to stop all services.
echo.
echo Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo All services are running.
echo this launcher will close now :)
timeout /t 3 /nobreak >nul
