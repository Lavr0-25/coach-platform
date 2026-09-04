@echo off
rem Entry point for Windows Task Scheduler (comments in English only:
rem cmd.exe reads this file in OEM codepage 866, UTF-8 Cyrillic breaks it).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-agent.ps1"