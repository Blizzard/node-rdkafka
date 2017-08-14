@echo off
set sdir=%1
set mask=%2
set nmsk=%3
setlocal disabledelayedexpansion
for /f "delims=" %%A in ('forfiles /s /p %sdir% /m %mask% /c "cmd /c echo @path"') do (
  set "file=%%~A"
  setlocal enabledelayedexpansion
  set "file=!file:%CD%\=!"
  set "file=!file:\=/!"
  if [%nmsk%] == [] (
    echo !file!
  ) else (
    echo.!file!|findstr /C:"%nmsk%" >nul 2>&1
    if errorlevel 1 (
      echo !file!
    )
  )
  endlocal
)
