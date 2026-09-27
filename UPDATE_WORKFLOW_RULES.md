# 🚀 Antigravity Enhance Tools 版本发布规则速览 (快捷入口)

> 本项目的全套权威版本更新规范、密钥资产库 (GitHub / Discord Bot Token) 与 5 步 SOP 流水线已放置于上级目录：
> **[查看父级完整规则文件](../UPDATE_WORKFLOW_RULES.md)** (`D:\desk\Antigravity\UPDATE_WORKFLOW_RULES.md`)

---

### 每次更新必跑 5 步流水线（严禁遗漏任何一步）：
1. **Step 1: 版本号递增**（`package.json` 与代码内版本自增）
2. **Step 2: 撰写结构化更新日志**（`✨ 新特性` / `🚀 优化` / `🐛 修复` / `🛡️ 稳定`）
3. **Step 3: 同步 GitHub 主页与更新页**（更新 `README.md`，push 到 `Kutaze/Antigravity-Enhance-Pack-Tools`）
4. **Step 4: 同步官网主页并推送**（更新 `docs/index.html` 并同步推送到 `antigravity-enhance-tools.github.io`）
5. **Step 5: Discord 自动化同步更新公告**（调用 Discord Bot API 自动发帖到 `# 🚀・更新-公告`，频道 ID: `1552041754629505079`）

详细脚本与密钥凭据请直接查阅上级目录的 `UPDATE_WORKFLOW_RULES.md`。
