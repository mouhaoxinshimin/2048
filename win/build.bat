@echo off
setlocal
set VSDIR=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 (echo VCVARS_FAILED & exit /b 1)

cd /d "%~dp0"
set WV2=G:\dev\DuiLib_Ultimate-master\3rd\WebView2

rc /nologo app.rc
if errorlevel 1 (echo RC_FAILED & exit /b 1)

cl /nologo /O2 /EHsc /std:c++17 /MT /utf-8 /DUNICODE /D_UNICODE main.cpp ^
   /I"%WV2%\include" ^
   /link /SUBSYSTEM:WINDOWS /OUT:Game2048.exe ^
   app.res ^
   "%WV2%\lib\x64\WebView2LoaderStatic.lib" ^
   user32.lib gdi32.lib ole32.lib oleaut32.lib shlwapi.lib shell32.lib advapi32.lib
if errorlevel 1 (echo CL_FAILED & exit /b 1)

echo BUILD_OK
exit /b 0
