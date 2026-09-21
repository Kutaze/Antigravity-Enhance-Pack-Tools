<div align="center">

<img src="assets/logo_glyph_transparent.png" alt="Antigravity Enhance Tools" width="100" height="100" />

# Antigravity Enhance Tools (拡張機能スイート)
### ネイティブUI多言語化 · リアルタイムコンテキスト測定 · 思考深度調整 · デュアルテーマGUI

**Google Antigravity 公式デスクトップクライアント向けに特化したUIおよび操作性拡張スイート。**

<p align="center">
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases"><img src="https://img.shields.io/badge/Release-v0.1.3-6366f1?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981?style=flat-square" alt="License" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/Platform-Windows_%7C_macOS_%7C_Linux-0284c7?style=flat-square" alt="Platform" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/UI-Dual_Theme_GUI-8b5cf6?style=flat-square" alt="UI" /></a>
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools"><img src="https://img.shields.io/badge/Runtime-Zero_Dependency-f59e0b?style=flat-square" alt="Runtime" /></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> • 
  <a href="README_EN.md">English</a> • 
  <b>日本語</b>
</p>

<p align="center">
  <a href="#-機能一覧">機能一覧</a> • 
  <a href="#-インストール">インストール</a> • 
  <a href="#-ワークフロー">ワークフロー</a> • 
  <a href="#-api-リファレンス">API リファレンス</a> • 
  <a href="#-更新履歴">更新履歴</a>
</p>

</div>

---

## 🌟 プレビュー (Showcase)

### 1. モダンデュアルテーマ GUI インストーラー (`Antigravity Enhance Tools.exe`)
丸角カードレイアウト、高精細 ClearType レンダリング、ディレクトリ自動検出エンジンを搭載し、右上ボタンで「ライト」と「ダーク」テーマを瞬時に切り替え可能：

| ライトモード (デフォルト) | ダークモード (ワンクリック切替) |
| :---: | :---: |
| <img src="assets/gui_installer_light_preview.png" width="450" /> | <img src="assets/gui_installer_dark_preview.png" width="450" /> |

### 2. クライアント内部拡張機能
DOM監視のループ振動を防止し、会話インタラクションにミリ秒単位でスムーズに応答：

| リアルタイムコンテキストカプセル & 詳細ホバーカード | 4段階思考深度 (Thinking) スライダー |
| :---: | :---: |
| <img src="assets/verified_anti_freeze_live.png" width="450" /> | <img src="assets/verified_model_slider_live.png" width="450" /> |

---

## 🧠 設計思想

### 開発方針とインスピレーション (Design Philosophy & Inspiration)

本プロジェクトは、業界の先進的AIツールおよびオープンソースコミュニティの成果から深く学び構築されています：

1. **Codex に学ぶ直感的なインタラクション**:
   - **コンテキスト消費の可視化**: トークン使用量をステータスバーカプセルと5段階ホバーカードでリアルタイム表示し、コンテキスト溢れへの不安を解消。
   - **思考深度のスムーズな制御**: モデル選択メニュー内に4段階の思考スライダーを配置し、作業の流れを止めずに推論深度を調整。

2. **Workbuddy に学ぶモダンなUI/UX**:
   - **洗練されたデザイン**: 微細な光沢グラデーションロゴ、階層構造のシャドウ、現代的な丸角スタイルを統一。
   - **ゼロ・ジャンク体験**: 独自の DOM キャッシュガード（Cache Guard）を搭載し、Electron + React 環境特有の画面ちらつきやフリーズを根絶。

3. **オープンソースへのリスペクト**:
   - Antigravity クライアントの日本語・多言語化にあたり、先駆的オープンソースプロジェクト [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) の知見を深く参考にさせていただきました。

---

## ✨ 機能一覧

### ネイティブ全画面多言語化
- メニューバー、サイドパネル、対話入力欄、設定画面などUI全域をカバー。
- AIプログラミングやAgent共同作業に即した自然な専門用語調整。

### リアルタイムコンテキスト測定
- ステータスバー常駐カプセルでトークン消費量と残量を動的表示（例: `6.4K / 250K (2.6%)`）。
- キャッシュ済み、入力負荷、推論思考、生成出力の5層をポップアップで瞬時に確認。

### 4段階思考深度スライダー
- モデル選択ポップアップ内に「OFF / 低 / 中 / 高」の調整スライダーを配置。

### 視覚的スキルハブ (Skills Hub)
- チャットツールバーに常駐する専用アイコンから、美しいモーダルでスキル一覧をブラウズ。
- 35以上の厳選スキル（アーキテクチャ、UI設計、レビュー、オフィス文書、Geminiエコシステムなど）をリアルタイム検索。
- カードをクリックするだけで `$skill-name` を対話欄に自動入力し、カーソルを即座にフォーカス。

### コンテキストメニュー連携スクリーンショット
- 入力欄左側の「+」メニュー内に「スクリーンショット (Win+Shift+S)」をネイティブ配置。
- 撮影完了後、クリップボードの画像を自動検知して対話欄へシームレスに挿入。

### フリーズ防止 DOM キャッシュガード
- ノードハッシュ検証により、不要な再描画と無限ループを遮断。

---

## 🚀 インストール

### 1. Windows 環境
1. [Releases ページ](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases) から最新の **`Antigravity Enhance Tools.exe`** をダウンロード。
2. 実行し、パスを確認後 **「一键安装 / 更新增强补丁」** (インストール/更新) をクリック。

### 2. macOS & Linux 環境
ターミナルを開き、以下のコマンドを実行するだけで自動セットアップが完了します：
```bash
curl -fsSL https://raw.githubusercontent.com/Kutaze/Antigravity-Enhance-Pack-Tools/main/install.sh | bash
```

### 3. 公式オリジナル版への復元
- **Windows**: GUIインストーラーで **「一键还原官方原版」** をクリック。
- **macOS / Linux**: `./uninstall.sh` を実行。

---

## 📝 更新履歴

### [v0.1.3] - 2026-09-21
- macOS（Apple Silicon M1〜M4 および Intel）と各主要 Linux ディストリビューションに対応。
- 独立 Node.js が未検出の場合、クライアント内蔵 Electron 実行環境を自動活用するインテリジェント機構を実装。
- 多言語ドキュメント（簡体字中国語・英語・日本語）の追加とナビゲーションの最適化。

---

## 📜 ライセンスと免責事項

- 本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
- [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) プロジェクトに心より感謝申し上げます。
- Google Antigravity は Google LLC の商標です。本プロジェクトは独立したコミュニティによるオープンソースソフトウェアです。
