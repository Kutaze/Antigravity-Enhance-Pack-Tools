@echo off
chcp 65001 >nul
title 推送代码到 GitHub (Antigravity Enhance Tools)
cd /d "%~dp0"
cls
echo ======================================================================
echo   正在准备推送到 GitHub: Kutaze/Antigravity-Enhance-Pack-Tools
echo ======================================================================
echo.
echo [原因定位]：
echo   检测到当前代理节点 IP 触发了 GitHub 官方的未授权频次限制：
echo   403 (rate limit exceeded)，导致 Git 默认的浏览器 OAuth 弹窗被拦截。
echo.
echo ======================================================================
echo   【一键解决办法】：使用 GitHub Personal Access Token (PAT)
echo ======================================================================
echo.
echo 1. 正在尝试自动为您在默认浏览器中打开 Token 创建页面...
start https://github.com/settings/tokens/new?scopes=repo^&description=AntigravityTools
echo.
echo 2. 在打开的网页最下方点击绿色的「Generate token」按钮；
echo 3. 复制生成的密钥 (以 ghp_ 开头)；
echo.
set /p "TOKEN=请在此右键粘贴 Token 并按回车: "

if "%TOKEN%"=="" (
    echo.
    echo [提示] 未输入 Token，尝试直接执行默认推送...
    git push -u origin main
) else (
    echo.
    echo [正在配置凭据并推送到远程仓库...]
    git push -u https://%TOKEN%@github.com/Kutaze/Antigravity-Enhance-Pack-Tools.git main
)

echo.
if %errorlevel% equ 0 (
    echo ======================================================================
    echo   ✔ 恭喜！代码与新版文档已成功全部推送到 GitHub 仓库！
    echo   仓库地址: https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools
    echo ======================================================================
) else (
    echo ======================================================================
    echo   ❌ 推送未完成，请检查 Token 权限 (需包含 repo) 或网络代理。
    echo ======================================================================
)
echo.
pause
