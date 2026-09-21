@echo off
chcp 65001 >nul
echo ========================================================
echo   Antigravity 增强扩展包 一键构建脚本
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js 后重试。
    pause
    exit /b 1
)

echo [1/2] 正在运行构建脚本 build.js...
node build.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   ✔ 构建成功！Antigravity增强与汉化工具.exe 已生成就绪。
    echo ========================================================
) else (
    echo.
    echo [失败] 构建过程发生错误，请检查控制台输出信息。
)

pause
