@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
if not exist "%~dp0app\campus-flora.exe" (
    echo 请先完整解压比赛提交包，再双击本文件。
    pause
    exit /b 1
)
"%~dp0app\campus-flora.exe"
if errorlevel 1 pause
