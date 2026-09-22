<div align="center">

<img src="assets/logo_glyph_transparent.png" alt="Antigravity Enhance Tools" width="100" height="100" />

# Antigravity Enhance Tools
### Native UI Localization · Real-time Context Telemetry · Thinking Depth Control · Dual-Theme GUI

**An all-in-one UI and interaction enhancement suite tailored for the official Google Antigravity desktop client.**

<p align="center">
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases"><img src="https://img.shields.io/badge/Release-v0.1.5-6366f1?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981?style=flat-square" alt="License" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/Platform-Windows_%7C_macOS_%7C_Linux-0284c7?style=flat-square" alt="Platform" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/UI-Dual_Theme_GUI-8b5cf6?style=flat-square" alt="UI" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/Runtime-Zero_Dependency-f59e0b?style=flat-square" alt="Runtime" /></a>
</p>

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

### 1. Modern Dual-Theme GUI Installer (`Antigravity Enhance Tools.exe`)
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

Throughout the architectural conception and UX design of **Antigravity Enhance Tools**, the project has deeply integrated best practices from leading tools and open source projects:

1. **Antigravity Tools Concept Integration**: Inspired by the community's Antigravity tools project for account quota tracking and utility management; but instead of running a separate bloated standalone window, this project natively embeds all core multi-account management directly into Antigravity with zero overhead.
2. **Codex-Inspired Interaction**: Transparent token consumption telemetry pill (5-tier breakdown card) and seamless thinking depth slider (4-tier control) eliminating context anxiety.
3. **Workbuddy-Inspired UI/UX**: Minimalist aesthetic with rounded cards and subtle glow, paired with a proprietary DOM Cache Guard ensuring zero-jank fluid interaction.
4. **Open Source Localization Reference**: Deeply inspired by [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) for its comprehensive terminology mapping and localization structure.

> [!IMPORTANT]
> **🛡️ Security & Local Privacy Guarantee**
> - **100% Local Storage**: No remote third-party servers; zero telemetry or telemetry tracking.
> - **OS-Level Credential Isolation**: OAuth tokens, refresh tokens, and account profiles are stored **strictly inside your local operating system credential store** (Windows Credential Manager / macOS Keychain) and local private directory (`~/.gemini/account_profiles/`).
> - **Direct Google Communication**: All authentication handshakes connect directly from your machine to official Google OAuth endpoints. Logging out triggers double confirmation and securely wipes credentials from system memory.

---

## ✨ Features

### Native Full UI Localization
- **100% Coverage**: Complete translation of menu bars, workspace views, sidebar panels, input fields, and dialogs.
- **Developer-Calibrated Terminology**: Carefully tuned for LLMs, agentic workflows, and pair programming.

### Dynamic Multi-Account Switcher
- **Native Embedded Experience**: Eliminates the need for bloated standalone external tools by seamlessly embedding multi-account management directly into Antigravity's status bar.
- **Unlimited Dynamic Profiles**: Fully dynamic architecture supporting unlimited Google accounts (PRO / ULTRA / FREE) with instant search and filter tabs.
- **Instant Hot-Swapping**: One-click profile switching with automatic Access Token refresh and OS credential manager synchronization.
- **Unified Avatar Interaction**: Click the bottom-bar avatar or display name to summon the management modal; includes double-confirmation logout with clean credential removal.

### Real-time Context Telemetry
- **Status Bar Dynamic Capsule**: Displays exact consumed tokens and percentage (e.g. `6.4K / 250K (2.6%)`).
- **5-Tier Breakdown Card**: Expands on hover to show Cached Context, Prompt Input, Thinking Tokens, Generated Output, and Remaining Tokens.

### 4-Level Thinking Slider
- **Embedded in Model Selector**: Seamlessly slide between `Off`, `Low`, `Medium`, and `High` reasoning modes.

### Visual Skills Hub
- **Dedicated Toolbar Trigger**: Direct access button on the chat input bar opening a modern, theme-adaptive skills selector.
- **35+ Built-in & Ecosystem Skills**: Categorized into Architecture & Engineering, Design & UI, Review & Diagnosis, Documents, and Gemini Ecosystem, with instant fuzzy search.
- **One-Click Invocation**: Click any skill card to insert `$skill-name` into the chat box with automatic cursor focus.
- **Dynamic Skill Discovery**: Detects custom user skills from workspace and global directories.

### Native Screenshot Integration
- **"+" Context Menu Access**: Built-in screenshot item directly inside the "+" context menu (`Win+Shift+S`).
- **Auto Clipboard Injection**: Automatically captures and injects new screenshots directly into the active prompt editor without saving to disk.

### Anti-Freeze DOM Cache Guard
- **Fingerprint Verification**: Prevents recursive DOM mutation loops and client lockups.

---

## 🚀 Installation

### 1. Windows
- Download **`Antigravity Enhance Tools.exe`** from [Releases](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases).
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

### [v0.1.5] - 2026-09-23
- **Dynamic Multi-Account Management & Hot-Switching**:
  - Embedded multi-account management natively into the status bar, removing external application bloat;
  - Dynamic profile pool: Add, manage, and hot-switch unlimited Google accounts with real-time filtering;
  - Security isolation: JWT email validation preventing credential pollution;
  - Safe logout: Modal confirmation with OS credential cleanup;
  - 100% local storage guarantee with zero remote telemetry.
- **Unified Bottom-Bar User Interaction**:
  - Merged user avatar and profile switch button into a seamless entrance;
  - Redesigned compact quota badge with refined tooltip positioning.
- **Deep Localization Expansion**:
  - Added 437 new UI translation entries for dialogs, settings, and notifications.

### [v0.1.4] - 2026-09-21
- **Skills Hub Overhaul**: Upgraded to 3-column responsive grid layout, high-contrast dark typography for both themes, auto new-chat invocation, and directory reveal.
- **Startup Zoom Safety Guard**: Cleared corrupted Chromium zoom caches and implemented strict bounds clamping against abnormal UI magnifications; added global zoom hotkeys (`Ctrl+0` / `Ctrl+=` / `Ctrl+-`) with visual toast feedback.

### [v0.1.3] - 2026-09-21
- Added full macOS (Apple Silicon M1-M4 & Intel) and Linux support with automated bash scripts.
- Runtime auto-probe reuses client built-in Electron runtime if system Node is absent.
- Standardized single-emoji title styling and multilingual documentation.

---

## 📜 License & Acknowledgments

- Licensed under the [MIT License](LICENSE).
- Special thanks to [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) for pioneering localization work on Antigravity.
- Special thanks to community project Antigravity tools for quota tracking and account management ideas, which inspired our native embedded design.
- Google Antigravity is a trademark of Google LLC. This project is an independent community project.
