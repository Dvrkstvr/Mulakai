@echo off
REM Mulakai dependency install: client + server
setlocal

echo ==================================
echo   Mulakai Install
echo ==================================
echo.

REM Run npm via a policy-bypassed PowerShell so this works even if the
REM machine's execution policy is Restricted - no need to run
REM fix-execution-policy.bat first, and nothing persists after each call.
echo [1/2] Installing client dependencies...
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm install --prefix '%~dp0client'"
if errorlevel 1 (
    echo Error: client npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Installing server dependencies...
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm install --prefix '%~dp0server'"
if errorlevel 1 (
    echo Error: server npm install failed.
    pause
    exit /b 1
)

echo.
echo ==================================
echo   Install complete
echo ==================================
pause
