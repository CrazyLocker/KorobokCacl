@echo off
setlocal enabledelayedexpansion

rem Find java.exe
if defined JAVA_HOME (
    set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
) else (
    set "JAVA_EXE=java.exe"
)

rem Resolve %~dp0 into absolute path
for %%i in ("%~dp0.") do set "SCRIPT_DIR=%%~fi"

set "CLASSPATH=%SCRIPT_DIR%\gradle\wrapper\gradle-wrapper.jar"

"%JAVA_EXE%" -Xmx64m -Xms64m -Dorg.gradle.appname=%~n0 -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
