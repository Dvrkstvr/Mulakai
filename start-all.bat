@echo off
REM Mulakai complete startup: ACE-Step API + server + client, plus the optional
REM Demucs, HeartMuLa and YuE2 services when they are installed
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

REM Demucs (stem separation) is optional — detect it before starting the
REM Mulakai server so DEMUCS_API_URL is in the environment it inherits.
set "DEMUCS_READY="
if exist "%~dp0demucs-server\venv\Scripts\activate.bat" (
    set "DEMUCS_READY=1"
    set "DEMUCS_API_URL=http://127.0.0.1:8002"
)

REM HeartMuLa (optional first-take engine) runs from heartlib's own Python 3.10 venv
REM with its ~22 GB of weights - see heartmula-server\README.md. Override with:
REM set HEARTMULA_PATH=C:\path\to\heartlib. A HEARTMULA_API_URL that is already set
REM (e.g. a server running in WSL) is used as-is and nothing is started here.
if "%HEARTMULA_PATH%"=="" set "HEARTMULA_PATH=S:\AI Gen\heartlib"
set "HEARTMULA_READY="
if not defined HEARTMULA_API_URL (
    if exist "%HEARTMULA_PATH%\.venv\Scripts\python.exe" if exist "%HEARTMULA_PATH%\ckpt\tokenizer.json" (
        set "HEARTMULA_READY=1"
        set "HEARTMULA_API_URL=http://127.0.0.1:8003"
        set "HEARTMULA_MODEL_PATH=%HEARTMULA_PATH%\ckpt"
    )
)

REM YuE2 (optional first-take engine) runs inside WSL2 from its own venv - see
REM yue-server\README.md. Override with: set YUE_DISTRO=... / set YUE_VENV=... (a Linux
REM path). A YUE_API_URL that is already set is used as-is and nothing is started here.
if "%YUE_DISTRO%"=="" set "YUE_DISTRO=Ubuntu-24.04"
if "%YUE_VENV%"=="" set "YUE_VENV=~/yue2/.venv"
set "YUE_READY="
if not defined YUE_API_URL (
    wsl.exe -d %YUE_DISTRO% --exec bash -lc "test -x %YUE_VENV%/bin/python" >nul 2>&1 && set "YUE_READY=1"
)
if defined YUE_READY set "YUE_API_URL=http://127.0.0.1:8004"

REM Only one model fits in VRAM at a time. With any extra engine configured, ACE-Step
REM must hand its GPU memory back when idle (PLAN.md, "Multiple Song-Creation Engines",
REM point 10). All three flags, as measured; ACE-Step's .env never overrides these.
set "ENGINE_CONFIGURED="
if defined HEARTMULA_API_URL set "ENGINE_CONFIGURED=1"
if defined YUE_API_URL set "ENGINE_CONFIGURED=1"
if defined ENGINE_CONFIGURED (
    set "ACESTEP_OFFLOAD_TO_CPU=true"
    set "ACESTEP_OFFLOAD_DIT_TO_CPU=true"
    set "ACESTEP_LM_OFFLOAD_TO_CPU=true"
    echo [+] Extra engine configured - ACE-Step will offload its models to CPU when idle
)

echo.
echo [1/6] Starting ACE-Step API server...
start "ACE-Step API" cmd /k "cd /d "%ACESTEP_PATH%" && %API_COMMAND%"

echo Waiting for API to initialize...
timeout /t 5 /nobreak >nul

echo [2/6] Starting Mulakai server...
start "Mulakai Server" cmd /k "cd /d "%~dp0server" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/6] Starting Demucs stem-separation service...
if defined DEMUCS_READY (
    start "Demucs Server" cmd /k "cd /d "%~dp0demucs-server" && venv\Scripts\activate && uvicorn main:app --port 8002"
) else (
    echo   Skipped - demucs-server\venv not found. See demucs-server\README.md to set it up.
)

timeout /t 2 /nobreak >nul

echo [4/6] Starting HeartMuLa engine...
REM One-line IFs, not a ( ) block: cmd parses a whole block up front, and a HEARTMULA_PATH
REM like "C:\Program Files (x86)\..." would end it early at its ")".
if defined HEARTMULA_READY start "HeartMuLa Server" cmd /k "cd /d "%~dp0heartmula-server" && "%HEARTMULA_PATH%\.venv\Scripts\python.exe" main.py"
if not defined HEARTMULA_READY if defined HEARTMULA_API_URL echo   Not started - using HEARTMULA_API_URL=%HEARTMULA_API_URL%
if not defined HEARTMULA_API_URL echo   Skipped - no heartlib venv and weights under HEARTMULA_PATH. See heartmula-server\README.md.

echo [5/6] Starting YuE2 engine...
REM Launched through wsl.exe: WSL does not start on its own, and this process keeps the
REM distro running. 127.0.0.1 inside WSL is reachable from Windows.
if defined YUE_READY start "YuE2 Server" cmd /k wsl.exe -d %YUE_DISTRO% --cd "%~dp0yue-server" --exec bash -lc "YUE_DATA_DIR=~/yue-data %YUE_VENV%/bin/python main.py"
if not defined YUE_READY if defined YUE_API_URL echo   Not started - using YUE_API_URL=%YUE_API_URL%
if not defined YUE_API_URL echo   Skipped - no YuE2 venv at %YUE_VENV% in WSL distro %YUE_DISTRO%. See yue-server\README.md.

echo [6/6] Starting Mulakai client...
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
if defined DEMUCS_READY echo   Demucs:       http://localhost:8002
if defined HEARTMULA_READY echo   HeartMuLa:    http://localhost:8003 (loads its weights into RAM, ~20 s)
if defined YUE_READY echo   YuE2:         http://127.0.0.1:8004 (verifies its weights, ~6 s)
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
