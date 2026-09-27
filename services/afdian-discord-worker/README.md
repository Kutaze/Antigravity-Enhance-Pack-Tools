# 爱发电 (Afdian) ↔ Discord 全自动同步服务

基于 **Cloudflare Workers** 边缘计算构建，**100% 永久免费、免购买服务器、自带全球公网 HTTPS、零冷启动**。

---

## 🌟 核心功能
1. **爱发电 Webhook 实时响应**：毫秒级接收订单推送，严格返回爱发电要求的 `{"ec": 200, "em": "ok"}`；
2. **Discord 频道炫酷广播**：收到赞助时，自动在指定频道发送爱发电标志性紫色（`#946ce6`）富文本卡片；
3. **自动赋予专属彩色身份组**：自动读取赞助者在结算时填写的 Discord ID 或用户名，调用 Discord Bot API 即时为赞助者发放身份组；
4. **内置订单防重幂等机制**：防止网络抖动重复触发发货与通知；
5. **一键测试端点**：访问 `/test` 即可免付费模拟赞助通知。

---

## 🚀 3 步极速部署指南

### 第一步：准备 Discord 端配置（约 2 分钟）

#### 1.1 获取频道 Webhook 地址（用于发送赞助广播）
1. 打开 Discord，进入您的服务器（`discord.gg/QRsPcNrSB`）；
2. 选择希望展示赞助通知的频道（如 `#赞助鸣谢` 或 `#sponsors`）；
3. 点击频道旁的设置图标 ⚙️ -> **整合 (Integrations)** -> **Webhooks** -> **新建 Webhook**；
4. 复制生成的 **Webhook URL** 备用。

#### 1.2 创建 Discord 机器人（用于自动上身份组）
1. 打开 [Discord Developer Portal](https://discord.com/developers/applications)；
2. 点击右上角 **New Application**，取名（如 `Afdian Sync Bot`）；
3. 进入左侧 **Bot** 菜单：
   - 点击 **Reset Token**，复制生成的 **Bot Token** 备用；
   - 往下滚动找到 **Privileged Gateway Intents**，勾选 **SERVER MEMBERS INTENT** 并保存；
4. 进入左侧 **OAuth2** -> **URL Generator**：
   - SCOPES 勾选：`bot`；
   - BOT PERMISSIONS 勾选：`Manage Roles`（管理身份组）；
   - 复制最下方的生成的邀请链接，在浏览器中打开，将机器人邀请到您的服务器；
5. ⭐️ **极其关键的权限层级设置**：
   - 在 Discord 服务器设置 -> **身份组 (Roles)** 中；
   - **将机器人的身份组位置拖拽到所有赞助者身份组（如“极客能量包”）之上**（若机器人在赞助者身份组下方，Discord 会因权限越级而拒绝赋权）。

#### 1.3 复制服务器 ID 与 身份组 ID
1. 在 Discord 软件设置 -> 高级 -> 开启「开发者模式」；
2. 右键您的服务器头像 -> 点击「复制服务器 ID」；
3. 在服务器设置的身份组列表中，右键对应的赞助者身份组 -> 点击「复制身份组 ID」。

---

### 第二步：在 Cloudflare 部署 Worker（1 分钟）

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)；
2. 点击左侧菜单 **Workers 和 Pages** -> 点击 **创建应用程序** -> **创建 Worker**；
3. 名称填 `afdian-discord-sync`，点击右下角 **部署**；
4. 部署后点击 **编辑代码**，将本项目 [`worker.js`](worker.js) 的全部内容复制粘贴覆盖进去，点击右上角 **保存并部署**；
5. 点击返回，进入该 Worker 的 **设置 (Settings)** -> **变量与机密 (Variables and Secrets)**，添加以下环境变量：
   - `DISCORD_WEBHOOK_URL`：第一步获取的频道 Webhook 地址；
   - `DISCORD_BOT_TOKEN`：第一步获取的机器人 Bot Token；
   - `DISCORD_GUILD_ID`：第一步获取的 Discord 服务器 ID；
   - `ROLE_TIER_GEEK_ID`：¥12 极客能量包身份组 ID；
   - `ROLE_SPONSORS_ID`：基础赞助者身份组 ID；
   - `ROLE_TIER_COCREATOR_ID`：¥29.9 深度共创官身份组 ID（可选）；
6. 复制该 Worker 的分配域名，如：`https://afdian-discord-sync.xxxx.workers.dev`。

---

### 第三步：在爱发电后台绑定 Webhook（30 秒）

1. 打开 [爱发电开发者后台](https://afdian.com/dashboard/dev)；
2. 在 **Webhook** 设置项中，填入您的 Worker 接收地址：
   ```
   https://afdian-discord-sync.xxxx.workers.dev/webhook
   ```
3. 保存设置，大功告成！

---

## 🧪 验证与测试

部署完成后，您可以在浏览器直接访问测试接口：
```
https://afdian-discord-sync.xxxx.workers.dev/test
```
如果配置正确，您的 Discord 频道会立刻收到一条精美的爱发电紫色测试赞助卡片！
