<div align="center">

<img src="assets/logo_glyph_transparent.png" alt="Antigravity Enhance Tools" width="100" height="100" />

# Antigravity Enhance Tools
### Native UI Localization · Real-time Context Telemetry · Thinking Depth Control · Dual-Theme GUI

**An all-in-one UI and interaction enhancement suite tailored for the official Google Antigravity desktop client.**

[![Release](https://img.shields.io/badge/Release-v0.1.3-6366f1?style=for-the-badge)](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows_%7C_macOS_%7C_Linux-0284c7?style=for-the-badge)](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools)
[![UI](https://img.shields.io/badge/UI-Dual_Theme_GUI_%2B_CLI-8b5cf6?style=for-the-badge)](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools)
[![Runtime](https://img.shields.io/badge/Runtime-Zero_Dependency-f59e0b?style=for-the-badge)](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools)

<p align="center">
  <a href="README.md">简体中文</a> • 
  <b>English</b> • 
  <a href="README_JA.md">日本語</a>
</p>

<p align="center">
  <a href="#-features">Features</a> • 
  <a href="#-installation">Installation</a> • 
  <a href="#-workflow">Workflow</a> • 
  <a href="#-api-reference">API Reference</a> • 
  <a href="#-changelog">Changelog</a>
</p>

</div>

---

## 🌟 Showcase

### 1. Modern Dual-Theme GUI Installer (`Antigravity增强与汉化工具.exe`)
Features rounded corners, ClearType typography, intelligent directory auto-detection, and seamless one-click switching between Light and Dark themes:

| Modern Light Mode (Default) | Dark Obsidian Mode (One-Click) |
| :---: | :---: |
| <img src="assets/gui_installer_light_preview.png" width="450" /> | <img src="assets/gui_installer_dark_preview.png" width="450" /> |

### 2. Client In-App Enhancements
Eliminates DOM oscillation loops, delivering sub-millisecond response to conversational interactions:

| Real-time Context Usage Pill & Hover Card | 4-Level Dynamic Thinking Slider |
| :---: | :---: |
| <img src="assets/verified_anti_freeze_live.png" width="450" /> | <img src="assets/verified_model_slider_live.png" width="450" /> |

---

## 🧠 Core Philosophy

### Design Philosophy & Inspiration

Throughout the architectural conception and UX design of **Antigravity Enhance Tools**, the project has deeply studied industry-leading AI productivity tools and open source innovations:

1. **Codex-Inspired Interaction**:
   - **Context Budget Transparency**: Transparent token consumption telemetry pill in the status bar and 5-tier breakdown card, giving developers full visibility into token usage and context limits.
   - **Thinking Depth Control**: Smooth 4-tier slider embedded directly into the model selector to adjust reasoning depth without interrupting coding flow.

2. **Workbuddy-Inspired UI/UX**:
   - **Modern Aesthetic**: Rounded card layout, delicate glowing gradient logo, clear shadow layering, and high-fidelity typography matching host environments.
   - **Zero-Jank Experience**: Proprietary DOM Cache Guard and event debounce engines preventing recursive DOM loops and re-render stutter.

3. **Open Source Localization Reference**:
   - Deeply inspired by the pioneering open-source project [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) for its comprehensive terminology mapping and localization structure.

---

## ✨ Features

### Native Full UI Localization
- **100% Coverage**: Complete translation of menu bars, workspace views, sidebar panels, input fields, and dialogs.
- **Developer-Calibrated Terminology**: Carefully tuned for LLMs, agentic workflows, and pair programming.

### Real-time Context Telemetry
- **Status Bar Dynamic Capsule**: Displays exact consumed tokens and percentage (e.g. `6.4K / 250K (2.6%)`).
- **5-Tier Breakdown Card**: Expands on hover to show Cached Context, Prompt Input, Thinking Tokens, Generated Output, and Remaining Tokens.

### 4-Level Thinking Slider
- **Embedded in Model Selector**: Seamlessly slide between `Off`, `Low`, `Medium`, and `High` reasoning modes.

### Anti-Freeze DOM Cache Guard
- **Fingerprint Verification**: Prevents recursive DOM mutation loops and client lockups.

---

## 🚀 Installation

### 1. Windows
- Download **`Antigravity增强与汉化工具.exe`** from [Releases](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases).
- Run the executable, confirm path, and click **「一键安装 / 更新增强补丁」** (Install / Update Patch).

### 2. macOS & Linux
- Run the one-line terminal installer:
```bash
curl -fsSL https://raw.githubusercontent.com/Kutaze/Antigravity-Enhance-Pack-Tools/main/install.sh | bash
```

### 3. Restore Official Clean Version
- Windows: Click **「一键还原官方原版」** (Restore Official Version) in the GUI installer.
- macOS / Linux: Run `./uninstall.sh`.

---

## 📝 Changelog

### [v0.1.3] - 2026-09-21
- Added full macOS (Apple Silicon M1-M4 & Intel) and Linux support with automated bash scripts.
- Runtime auto-probe reuses client built-in Electron runtime if system Node is absent.
- Standardized single-emoji title styling and multilingual documentation.

---

## 📜 License & Acknowledgments

- Licensed under the [MIT License](LICENSE).
- Special thanks to [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) for pioneering localization work on Antigravity.
- Google Antigravity is a trademark of Google LLC. This project is an independent community project.
