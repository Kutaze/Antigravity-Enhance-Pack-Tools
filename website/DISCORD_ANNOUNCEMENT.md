# 📢 Antigravity Enhance Tools v0.1.6 深度修复与体验重构版发布！

> **让 Antigravity 顺手 10 倍！** 全界面原生深度汉化 · 多账号快捷切换 · 毫秒级配额感知 · 时空刻度导航 · 35+ 技能中心

---

各位社区开发者与小伙伴们好！👋 

针对大家近期在超长会话定位、模型切换面板以及搜索索引中遇到的痛点问题，我们推出了 **v0.1.6 深度修复与体验重构版**。本次更新对底层 IPC 通信通道、前端虚拟滚动拦截与模型思考能力调度器进行了外科手术式的精细重构，彻底消除定位抖动与闪退现象！

---

## 🛠️ 重点缺陷修复 (Bug Fixes)

### 1. 🎚️ 彻底解决侧边栏/刻度轴上下疯狂跳转与震荡
* **问题表象**：在长会话中点击刻度条或侧边栏定位，页面陷入上下反复弹跳的死循环。
* **修复方案**：引入 `isProgrammaticNavigating` 状态机与 **850ms 单向锁定抑制窗口**。当用户主动触发跳转时，暂时切断页面滚动的事件反向监听（ScrollSpy），平滑滚动就位并锁死防震荡，彻底消除死循环反馈环路。

### 2. 📜 攻关超长上下文虚拟滚动节点剔除（不在当前页也能看历史！）
* **问题表象**：Antigravity 官方采用极其激进的 DOM 虚拟滚动（Virtual Scroll）机制，一旦会话过长，前面的轮次会被直接从 DOM 树物理销毁，导致无法通过常规方式直接跳转。
* **修复方案**：独创 **`agy-historical-viewer` 毛玻璃历史快照卡片**。当目标轮次已被 DOM 虚拟滚动移出视口时，无缝呼出全景历史回放浮层，完整呈现该轮次的 User Prompt 与 Assistant 回复，支持一键复制内容与平滑漫游，彻底告别“找不到历史记录”的窘境。

### 3. 🔍 修复搜索记录读取异常，建立本地文件直读权威索引
* **问题表象**：历史记录搜索栏读取到混乱的数据，充斥着 `<CONTEXT_SUMMARY>` 等系统压缩总结摘要或重复文本。
* **修复方案**：彻底抛弃依赖 DOM 渲染层提取历史的脆弱方案，主进程新增 `antigravity:get-conversation-turns` 原生 IPC 接口。直接穿透直读本地用户目录的权威日志（`transcript.jsonl` / `transcript_full.jsonl`），在服务端通过流式解析精准剥离 `<CONTEXT_SUMMARY>` 与内部标记，提炼最纯净的问答对，搜索直达不偏不倚。

### 4. ⚡ 修复模型切换菜单“点击闪退/点不开需重复点击”
* **问题表象**：点击模型切换菜单时面板瞬间弹出又闪退消失，必须反复多次点击才能勉强展开。
* **修复方案**：排查发现自动同步逻辑在菜单刚展开时触发了微任务级的模拟点击（`trySelectSubmenuEffort`），导致外层 Radix Popover 误判为“外部点击”而主动关闭。新版彻底重构为事件隔离与安全挂载，彻底杜绝闪退。

### 5. 🧠 修复 Claude/GPT 思考滑块崩溃与跨模型污染
* **问题表象**：Claude 等不支持思考调节的模型上强行拖动滑块会引发逻辑异常，且在切回 Gemini 后导致界面报错闪退。
* **修复方案**：实现 **模型思考能力自适应引擎 (`getModelThinkingCapabilities`)**：
  * **Gemini 系列**：保留 4 挡完整动态调节滑块（0k / 8k / 16k / 24k）；
  * **Claude 系列**：动态识别并安全替换为 `内置思考 (不可调)` 优雅徽章；
  * **GPT 系列**：安全映射为 `固定推理 (中)` 徽章；
  * 阻断非 Gemini 模型的非法调用，从源头杜绝跨模型状态污染与界面崩溃。

---

## 📥 获取与安装

- 💻 **GitHub 仓库**：[https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools](https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools)
- 🌐 **官方网站**：[https://antigravity-enhance-tools.github.io/](https://antigravity-enhance-tools.github.io/)
- ⚡ **使用方式**：下载 Release 包中的 `Antigravity Enhance Tools.exe`，启动后点击「开始一键注入」即可完成无损升级！

---
欢迎大家在 Discord 各个频道分享反馈与使用心得！感谢大家的支持！✨
