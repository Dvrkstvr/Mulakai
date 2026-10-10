@echo off
REM Mulakai complete startup: ACE-Step API + server + client, plus the optional
REM Demucs, lyrics, HeartMuLa, YuE2 and Ollama (chat planner) services when installed
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

REM Engines bind to ENGINE_HOST: 127.0.0.1 by default, or 0.0.0.0 so the home server can
REM reach them too (deploy/home-lan/README.md "Engines"; gpu-pc-lan.ps1 sets it for you).
REM 0.0.0.0 still answers on 127.0.0.1. Only the Windows Firewall rule keeps the rest of
REM the LAN out, because Ollama, Demucs and lyrics-server have no key.
if "%ENGINE_HOST%"=="" set "ENGINE_HOST=127.0.0.1"

REM Detect ACE-Step installation type (native FastAPI server, NOT Gradio)
set API_COMMAND=
if exist "%ACESTEP_PATH%\python_embeded\python.exe" (
    echo [+] Detected Windows Portable Package
    set API_COMMAND=python_embeded\python acestep\api_server.py --host %ENGINE_HOST% --port 8001
) else (
    echo [+] Detected Standard Installation
    set API_COMMAND=uv run acestep-api --host %ENGINE_HOST% --port 8001
)

REM Demucs (stem separation) is optional — detect it before starting the
REM Mulakai server so DEMUCS_API_URL is in the environment it inherits.
REM uvr-server speaks the same contract on the same port (Roformer vocals, see
REM uvr-server\README.md) and is preferred when installed; only one of the two runs.
set "DEMUCS_READY="
set "UVR_READY="
if exist "%~dp0uvr-server\venv\Scripts\python.exe" (
    set "UVR_READY=1"
    set "DEMUCS_API_URL=http://127.0.0.1:8002"
) else if exist "%~dp0demucs-server\venv\Scripts\activate.bat" (
    set "DEMUCS_READY=1"
    set "DEMUCS_API_URL=http://127.0.0.1:8002"
)

REM lyrics-server (READ LYRICS: the words sung in a cover's source) is optional - see
REM lyrics-server\README.md. Detected here so LYRICS_API_URL reaches the Mulakai server.
set "LYRICS_READY="
if exist "%~dp0lyrics-server\venv\Scripts\python.exe" (
    set "LYRICS_READY=1"
    set "LYRICS_API_URL=http://127.0.0.1:8005"
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
REM SheetSage2 (YuE2 covers' transcriber) is picked up when installed in the same distro
REM as yue-server\README.md describes. Override with: set YUE_SHEETSAGE_HOME=... (a Linux path).
if "%YUE_SHEETSAGE_HOME%"=="" set "YUE_SHEETSAGE_HOME=~/sheetsage2"
set "YUE_READY="
if not defined YUE_API_URL (
    wsl.exe -d %YUE_DISTRO% --exec bash -lc "test -x %YUE_VENV%/bin/python" >nul 2>&1 && set "YUE_READY=1"
)
if defined YUE_READY set "YUE_API_URL=http://127.0.0.1:8004"

REM The chat (CHAT start screen, SCORE) needs a local Ollama with a 16k context - see
REM PLAN.md "Chat: Talk a Song Into Being". A LLM_API_URL that is already set is used as-is
REM and nothing is started here. Otherwise an installed Ollama is started on 127.0.0.1:11434
REM unless one already answers there. Override with: set LLM_MODEL=... / set OLLAMA_MODELS=...
if "%LLM_MODEL%"=="" set "LLM_MODEL=qwen3:14b"
set "OLLAMA_EXE="
set "OLLAMA_READY="
set "OLLAMA_RUNNING="
REM One-line IFs: a path like "C:\Program Files (x86)\..." would end a ( ) block early.
if not defined LLM_API_URL if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined LLM_API_URL if not defined OLLAMA_EXE for %%I in (ollama.exe) do if not "%%~$PATH:I"=="" set "OLLAMA_EXE=%%~$PATH:I"
if not defined LLM_API_URL if defined OLLAMA_EXE curl -s -m 2 http://127.0.0.1:11434/api/version >nul 2>&1 && set "OLLAMA_RUNNING=1"
if defined OLLAMA_EXE if not defined OLLAMA_RUNNING set "OLLAMA_READY=1"
if defined OLLAMA_EXE set "LLM_API_URL=http://127.0.0.1:11434"
if defined OLLAMA_READY if not defined OLLAMA_MODELS if exist "E:\ai\ollama\models" set "OLLAMA_MODELS=E:\ai\ollama\models"
if defined OLLAMA_READY set "OLLAMA_CONTEXT_LENGTH=16384"
if defined OLLAMA_READY set "OLLAMA_HOST=%ENGINE_HOST%:11434"

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
echo [1/8] Starting the chat planner (Ollama)...
if defined OLLAMA_READY start "Ollama (chat, 16k)" cmd /k ""%OLLAMA_EXE%" serve"
if defined OLLAMA_RUNNING echo   Using the Ollama already running on :11434 (fine if it was started with OLLAMA_CONTEXT_LENGTH=16384, as this script does; the chat says so if its context is too short)
if defined OLLAMA_RUNNING if not "%ENGINE_HOST%"=="127.0.0.1" echo   It keeps its own bind address: quit it (tray icon) and rerun this script so the home server can reach it too
if not defined OLLAMA_EXE if defined LLM_API_URL echo   Not started - using LLM_API_URL=%LLM_API_URL%
if not defined LLM_API_URL echo   Skipped - no Ollama installed, so CHAT and SCORE stay hidden. See PLAN.md "Score Agent".

echo [2/8] Starting ACE-Step API server...
start "ACE-Step API" cmd /k "cd /d "%ACESTEP_PATH%" && %API_COMMAND%"

echo Waiting for API to initialize...
timeout /t 5 /nobreak >nul

echo [3/8] Starting Mulakai server...
start "Mulakai Server" cmd /k "cd /d "%~dp0server" && npm run dev"

timeout /t 3 /nobreak >nul

echo [4/8] Starting stem-separation service...
if defined UVR_READY (
    start "UVR Server" cmd /k "cd /d "%~dp0uvr-server" && venv\Scripts\python.exe -m uvicorn main:app --host %ENGINE_HOST% --port 8002"
) else if defined DEMUCS_READY (
    start "Demucs Server" cmd /k "cd /d "%~dp0demucs-server" && venv\Scripts\activate && uvicorn main:app --host %ENGINE_HOST% --port 8002"
) else (
    echo   Skipped - neither uvr-server\venv nor demucs-server\venv found. See their README.md files.
)

timeout /t 2 /nobreak >nul

echo [5/8] Starting lyrics reader...
if defined LYRICS_READY start "Lyrics Server" cmd /k "cd /d "%~dp0lyrics-server" && venv\Scripts\python.exe -m uvicorn main:app --host %ENGINE_HOST% --port 8005"
if not defined LYRICS_READY echo   Skipped - no lyrics-server\venv. See lyrics-server\README.md.

echo [6/8] Starting HeartMuLa engine...
REM One-line IFs, not a ( ) block: cmd parses a whole block up front, and a HEARTMULA_PATH
REM like "C:\Program Files (x86)\..." would end it early at its ")".
if defined HEARTMULA_READY start "HeartMuLa Server" cmd /k "cd /d "%~dp0heartmula-server" && "%HEARTMULA_PATH%\.venv\Scripts\python.exe" main.py"
if not defined HEARTMULA_READY if defined HEARTMULA_API_URL echo   Not started - using HEARTMULA_API_URL=%HEARTMULA_API_URL%
if not defined HEARTMULA_API_URL echo   Skipped - no heartlib venv and weights under HEARTMULA_PATH. See heartmula-server\README.md.

echo [7/8] Starting YuE2 engine...
REM Launched through wsl.exe: WSL does not start on its own, and this process keeps the
REM distro running. 127.0.0.1 inside WSL is reachable from Windows; the LAN reaches
REM it only with WSL's mirrored networking (gpu-pc-lan.ps1).
if defined YUE_READY start "YuE2 Server" cmd /k wsl.exe -d %YUE_DISTRO% --cd "%~dp0yue-server" --exec bash -lc "if [ -x %YUE_SHEETSAGE_HOME%/.venv/bin/python ]; then export YUE_SHEETSAGE_PYTHON=%YUE_SHEETSAGE_HOME%/.venv/bin/python YUE_SHEETSAGE_DIR=%YUE_SHEETSAGE_HOME%/SheetSage2; fi; YUE_HOST=%ENGINE_HOST% YUE_DATA_DIR=~/yue-data %YUE_VENV%/bin/python main.py"
if not defined YUE_READY if defined YUE_API_URL echo   Not started - using YUE_API_URL=%YUE_API_URL%
if not defined YUE_API_URL echo   Skipped - no YuE2 venv at %YUE_VENV% in WSL distro %YUE_DISTRO%. See yue-server\README.md.

echo [8/8] Starting Mulakai client...
start "Mulakai Client" cmd /k "cd /d "%~dp0client" && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ==================================
echo   All services running
echo ==================================
echo.
if not "%ENGINE_HOST%"=="127.0.0.1" echo   Engines listen on %ENGINE_HOST% (this PC and the home server)
echo   ACE-Step API: http://localhost:8001
echo   Server:       http://localhost:3001
echo   Client:       http://localhost:5173
if defined UVR_READY echo   UVR split:    http://localhost:8002
if defined DEMUCS_READY echo   Demucs:       http://localhost:8002
if defined HEARTMULA_READY echo   HeartMuLa:    http://localhost:8003 (loads its weights into RAM, ~20 s)
if defined LYRICS_READY echo   Lyrics:       http://localhost:8005 (loads its model per job)
if defined YUE_READY echo   YuE2:         http://127.0.0.1:8004 (verifies its weights, ~6 s)
if defined LLM_API_URL echo   Chat planner: %LLM_API_URL% (%LLM_MODEL%, loaded per turn)
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
