@echo off
chcp 65001 >nul
title 推送代码到 GitHub (Antigravity Enhance Tools)
cd /d "%~dp0"
cls
echo ======================================================================
echo   正在推送到 GitHub: Tsuenoku/Antigravity-Enhance-Pack-Tools
echo ======================================================================
echo.
echo 提示：如果是首次连接 GitHub，稍后会自动弹出浏览器登录授权窗口，
echo       请在浏览器中点击「Sign in with your browser」或确认授权即可。
echo.
echo 正在执行 git push -u origin main ...
echo.

git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ======================================================================
    echo   ✔ 恭喜！代码与资源已成功全部推送到 GitHub 仓库！
    echo   仓库地址: https://github.com/Tsuenoku/Antigravity-Enhance-Pack-Tools
    echo ======================================================================
) else (
    echo ======================================================================
    echo   ❌ 推送未完成。若遇网络连接问题，可开启代理或重试。
    echo ======================================================================
)
echo.
pause
