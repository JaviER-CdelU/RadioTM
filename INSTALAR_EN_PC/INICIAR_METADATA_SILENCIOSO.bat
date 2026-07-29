@echo off
cd /d "%~dp0"
node metadata.js >> metadata.log 2>&1
