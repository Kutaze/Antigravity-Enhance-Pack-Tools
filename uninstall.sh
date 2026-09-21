#!/usr/bin/env bash
# ==============================================================================
# Antigravity Enhance Tools - 还原官方纯净版 (macOS & Linux)
# ==============================================================================
set -e

echo "============================================================"
echo "   Antigravity 还原官方纯净版 - macOS / Linux 卸载向导      "
echo "============================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
NODE_CMD="node"
if ! command -v node >/dev/null 2>&1; then
    if [ -f "/Applications/Antigravity.app/Contents/MacOS/Antigravity" ]; then
        export ELECTRON_RUN_AS_NODE=1
        NODE_CMD="/Applications/Antigravity.app/Contents/MacOS/Antigravity"
    elif [ -f "/Applications/Antigravity.app/Contents/MacOS/Electron" ]; then
        export ELECTRON_RUN_AS_NODE=1
        NODE_CMD="/Applications/Antigravity.app/Contents/MacOS/Electron"
    elif [ -f "/opt/Antigravity/antigravity" ]; then
        export ELECTRON_RUN_AS_NODE=1
        NODE_CMD="/opt/Antigravity/antigravity"
    elif [ -f "/usr/bin/antigravity" ]; then
        export ELECTRON_RUN_AS_NODE=1
        NODE_CMD="/usr/bin/antigravity"
    fi
fi

cd "$SCRIPT_DIR"
"$NODE_CMD" src/unpatcher.js "$@"
