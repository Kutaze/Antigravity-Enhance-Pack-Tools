#!/usr/bin/env bash
# ==============================================================================
# Antigravity Enhance Tools (macOS & Linux Universal Installer)
# ==============================================================================
set -e

REPO_URL="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"

echo "============================================================"
echo "   Antigravity Enhance Tools - macOS / Linux 安装向导       "
echo "============================================================"
echo ""

# 1. Detect Operating System
OS="$(uname -s)"
case "$OS" in
    Darwin*)  PLATFORM="macOS" ;;
    Linux*)   PLATFORM="Linux" ;;
    *)        PLATFORM="Unknown" ;;
esac
echo "[1/4] 检测到操作系统: $PLATFORM"

# 2. Check execution environment (local or piped via curl)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
IS_LOCAL=false
if [ -f "$SCRIPT_DIR/src/patcher.js" ] && [ -d "$SCRIPT_DIR/core" ]; then
    IS_LOCAL=true
    WORKDIR="$SCRIPT_DIR"
    echo "[2/4] 使用本地脚本运行: $WORKDIR"
else
    echo "[2/4] 检测到网络执行模式，正在从 GitHub 获取最新扩展包..."
    TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'antigravity-enhance')
    WORKDIR="$TMP_DIR/Antigravity-Enhance-Pack"
    git clone --depth=1 "$REPO_URL.git" "$WORKDIR" 2>/dev/null || {
        echo "[提示] git clone 超时，正在通过 Release 归档包拉取..."
        curl -fsSL "$REPO_URL/archive/refs/heads/main.tar.gz" -o "$TMP_DIR/main.tar.gz"
        tar -xzf "$TMP_DIR/main.tar.gz" -C "$TMP_DIR"
        WORKDIR="$TMP_DIR/Antigravity-Enhance-Pack-Tools-main"
    }
fi

# 3. Detect Node runtime (Prefer system node, fallback to Antigravity's own Electron)
NODE_CMD=""
if command -v node >/dev/null 2>&1; then
    NODE_CMD="node"
elif [ "$PLATFORM" = "macOS" ] && [ -f "/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
    export ELECTRON_RUN_AS_NODE=1
    NODE_CMD="/Applications/Antigravity.app/Contents/MacOS/Antigravity"
elif [ "$PLATFORM" = "macOS" ] && [ -f "/Applications/Antigravity.app/Contents/MacOS/Electron" ]; then
    export ELECTRON_RUN_AS_NODE=1
    NODE_CMD="/Applications/Antigravity.app/Contents/MacOS/Electron"
elif [ "$PLATFORM" = "Linux" ] && [ -f "/opt/Antigravity/antigravity" ]; then
    export ELECTRON_RUN_AS_NODE=1
    NODE_CMD="/opt/Antigravity/antigravity"
elif [ "$PLATFORM" = "Linux" ] && [ -f "/usr/bin/antigravity" ]; then
    export ELECTRON_RUN_AS_NODE=1
    NODE_CMD="/usr/bin/antigravity"
fi

if [ -z "$NODE_CMD" ]; then
    echo "[错误] 未检测到 Node.js 运行环境或 Antigravity 官方客户端！"
    echo "macOS 用户可通过 Homebrew 安装: brew install node"
    echo "Linux 用户可通过包管理器安装: sudo apt install nodejs 或 sudo dnf install nodejs"
    exit 1
fi
echo "[3/4] 运行引擎已就绪: $NODE_CMD"

# 4. Run patcher
echo "[4/4] 正在执行增强与汉化补丁注入..."
echo ""
cd "$WORKDIR"
"$NODE_CMD" src/patcher.js "$@"

EXIT_CODE=$?
if [ "$IS_LOCAL" = false ] && [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
fi

exit $EXIT_CODE
