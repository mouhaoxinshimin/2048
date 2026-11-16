@echo off
rem 2048 Windows 外壳构建脚本
rem 依赖：VS2022 BuildTools + WebView2 SDK
setlocal
set VSDIR=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 (echo VCVARS_FAILED & exit /b 1)

cd /d "%~dp0"
set WV2=G:\dev\DuiLib_Ultimate-master\3rd\WebView2

cl /nologo /O2 /EHsc /std:c++17 /MT /utf-8 /DUNICODE /D_UNICODE main.cpp ^
   /I"%WV2%\include" ^
   /link /SUBSYSTEM:WINDOWS /OUT:Game2048.exe ^
   "%WV2%\lib\x64\WebView2LoaderStatic.lib" ^
   user32.lib gdi32.lib ole32.lib oleaut32.lib shlwapi.lib shell32.lib advapi32.lib
if errorlevel 1 (echo CL_FAILED & exit /b 1)

echo BUILD_OK
exit /b 0
