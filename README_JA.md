<div align="center">

<img src="assets/logo_glyph_transparent.png" alt="Antigravity Enhance Tools" width="100" height="100" />

# Antigravity Enhance Tools (拡張機能スイート)
### ネイティブUI多言語化 · リアルタイムコンテキスト測定 · 思考深度調整 · デュアルテーマGUI

**Google Antigravity 公式デスクトップクライアント向けに特化したUIおよび操作性拡張スイート。**

<p align="center">
  <a href="https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools/releases"><img src="https://img.shields.io/badge/Release-v0.1.5-6366f1?style=flat-square" alt="Release" /></a>
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

1. **Antigravity tools の思想吸収とネイティブ内蔵化**: アカウント使用量枠や多機能管理の方向性を参考にしつつ、独立した外部アプリを別途起動する煩わしさとメモリ消費を排除するため、全機能を Antigravity クライアント内部へネイティブ統合。
2. **Codex に学ぶ直感的なインタラクション**: トークン使用量をステータスバーカプセル（5段階カード）でリアルタイム可視化し、思考スライダーで推論深度を即座に調整。
3. **Workbuddy に学ぶモダンなUI/UX**: 洗練された丸角デザインと独自の DOM キャッシュガード（Cache Guard）により、画面のちらつきやフリーズを根絶。
4. **オープンソースへのリスペクト**: 先駆的オープンソースプロジェクト [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) の知見を深く参考にさせていただきました。

> [!IMPORTANT]
> **🛡️ アカウントセキュリティとローカルプライバシー保護宣言**
> - **100% ローカル保存・外部送信ゼロ**: 外部サーバーは一切使用せず、データの第三者収集や通信は行いません。
> - **OS水準の認証情報隔離**: アカウントのOAuthトークンや更新トークンは、すべてローカルOSのセキュアな認証情報マネージャー（Windows Credential Manager / macOS Keychain）および専用フォルダ（`~/.gemini/account_profiles/`）にのみ安全に保管されます。
> - **公式直接通信と完全自律**: 認証およびトークン更新は端末から直接 Google 公式エンドポイントと行われます。ログアウト時の二次確認と端末内完全消去に対応。

---

## ✨ 機能一覧

### ネイティブ全画面多言語化
- メニューバー、サイドパネル、対話入力欄、設定画面などUI全域をカバー。
- AIプログラミングやAgent共同作業に即した自然な専門用語調整。

### 動的マルチアカウント即時切り替え (Multi-Account Switcher)
- **ネイティブ内蔵化デザイン**: 肥大化した外部ツールを別途起動する必要なく、底面ステータスバーから直接切り替えと残量枠確認が可能。
- **無制限動的プロファイル**: Google アカウント（PRO / ULTRA / FREE）を制限なく登録・管理・検索可能。
- **ワンクリック即時切替**: Access Token の自動リフレッシュと OS 認証情報ストアの同期により、アカウント混線を徹底防止。
- **アバター統合インタラクション**: アバターまたはユーザー名クリックで管理画面を展開。二段階確認付きログアウトと認証情報の完全削除をサポート。

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

### [v0.1.5] - 2026-09-23
- **動的マルチアカウント即時切り替えシステム**:
  - 外部ツールの機能をクライアント内へ直接統合し、不要な常駐アプリの負荷を完全解消。
  - 無制限の動的アカウント管理（PRO / ULTRA / FREE）と高速検索・フィルター対応。
  - JWT署名検証によるアカウント間の認証情報混線防止。
  - 二段階確認付きログアウトとOS認証情報ストア（Windows Credential Manager / Keychain）の完全削除。
  - 100% ローカル保存のセキュリティ・プライバシー保証。
- **底面ステータスバーのアバター統合**:
  - アバターとアカウント切り替えボタンを統合し、シームレスなUI操作を実現。
  - 残量枠バッジとツールチップの視認性を向上。
- **UI多言語化の更なる拡充**:
  - ダイアログや設定項目を中心に437件の翻訳データを追加。

### [v0.1.4] - 2026-09-21
- **スキルハブ（Skills Hub）の刷新**：3列レスポンシブグリッドレイアウトへの全面改修、ダーク・ライト両テーマにおける高コントラストなテキスト表示、新規チャット自動遷移呼び出し、仕様フォルダ展開機能。
- **起動時ズーム異常の安全ガード**：破損したChromiumキャッシュを自動クリアし、異常なUI拡大を防止するガードを実装。グローバルズームショートカット（`Ctrl+0` / `Ctrl+=` / `Ctrl+-`）とリアルタイムトースト通知を追加。

### [v0.1.3] - 2026-09-21
- macOS（Apple Silicon M1〜M4 および Intel）と各主要 Linux ディストリビューションに対応。
- 独立 Node.js が未検出の場合、クライアント内蔵 Electron 実行環境を自動活用するインテリジェント機構を実装。
- 多言語ドキュメント（簡体字中国語・英語・日本語）の追加とナビゲーションの最適化。

---

## 📜 ライセンスと免責事項

- 本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
- [renkeshui/antigravity-chinese-locale](https://github.com/renkeshui/antigravity-chinese-locale) プロジェクトに心より感謝申し上げます。
- コミュニティプロジェクト Antigravity tools のアカウント枠管理およびツール統合の着想に深く感謝申し上げます。
- Google Antigravity は Google LLC の商標です。本プロジェクトは独立したコミュニティによるオープンソースソフトウェアです。
