@echo off
chcp 65001 >nul
echo ========================================================
echo   Antigravity 增强扩展包 一键构建脚本
echo ========================================================
echo.

set "NODE_CMD=node"
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
        set "NODE_CMD=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
        set ELECTRON_RUN_AS_NODE=1
    ) else (
        echo [错误] 未检测到 Node.js 或 Antigravity 运行时环境！
        pause
        exit /b 1
    )
)

echo [1/2] 正在运行构建脚本 build.js...
"%NODE_CMD%" build.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   ✔ 构建成功！Antigravity Enhance Tools.exe 已生成就绪。
    echo ========================================================
) else (
    echo.
    echo [失败] 构建过程发生错误，请检查控制台输出信息。
)

pause
