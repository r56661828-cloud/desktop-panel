# Desktop Panel 在线更新功能评审与方案

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1（评审稿） |
| 撰写日期 | 2026-09-12 |
| 触发来源 | 用户需求：VS Code 式更新体验（检查→静默下载→确认→重启安装→升级说明页） |
| 状态 | 待拍板后开发 |

---

## 1. 结论

**可实现**，采用 Electron 生态标准方案 **electron-updater**（electron-builder 官方配套），你描述的六个环节全部有现成能力承接。但有一个**硬前提**和两个**待拍板**：

- **硬前提**：electron-updater 只对「**NSIS 安装版**」生效。你现在双击运行的绿色版（zip）**不支持自动升级**——一键升级的前提是软件以安装版形态存在于用户机器上。这直接决定了它和开源发布是同一件事：GitHub 仓库 + Actions 出 Windows 安装包 + Releases 作更新源，一鱼两吃。
- **待拍板 A（取消语义）**：你描述里「点取消不主动升级」和「杀进程后下次打开自动升级」存在冲突场景——用户点了取消、然后杀进程，下次启动装不装？推荐：**取消 = 该版本内彻底不再自动装**（含下次启动，只留手动入口），下个新版本重新开始循环。否则用户会觉得被骚扰（详见 5.3）。
- **待拍板 B（绿色版策略）**：绿色版用户怎么办？推荐一期明确「绿色版请手动下载新版」，二期再评估 DIY 目录替换方案（可做但有维护成本，见 3.2）。

---

## 2. 需求逐条映射

| # | 你的需求 | electron-updater 承接方式 | 可行性 |
| --- | --- | --- | --- |
| 1 | 首次打开 + 运行中定时检查 | 主进程启动延迟 30s 检查一次 + 每 4h 定时；`autoUpdater.checkForUpdates()` | ✅ |
| 2 | 有更新则后台静默下载 | `autoDownload = true`（默认），下载在后台进行，有进度事件 | ✅ |
| 3 | 下载完成后页面显示「更新」 | `update-downloaded` 事件 → IPC 推给渲染层 → 标题栏亮「更新」按钮（带版本号角标） | ✅ |
| 4 | 点击更新 → 弹框说明后果、询问确认 | 自研弹框（Naive UI）：新版本号 + 更新内容 + 「将重启应用完成安装，未保存内容会存入草稿」；确认后 `quitAndInstall()`（NSIS 静默安装 + 自动重启） | ✅ |
| 5 | 点取消 → 不主动升级 | 记录 `declinedVersion` 到 settings，该版本不再自动弹（决策 A）；标题栏保留手动入口 | ✅ |
| 6 | 杀进程后下次启动自动升级 | electron-updater 缓存机制：已下载的安装包持久在 `%LOCALAPPDATA%\<app>-updater\`；下次启动 `checkForUpdates()` 若版本相同且已缓存，会快速再发 `update-downloaded` → 启动早期（窗口显示前）静默 `quitAndInstall` | ✅ |
| 7 | 升级后自动开 tab 说明更新内容 | 更新事件携带 `releaseNotes`（取自 GitHub Release 正文）→ 存入 settings；新版本首次启动比对 `lastRunVersion ≠ 当前版本` → 自动开一个只读标签渲染说明 | ✅ |

---

## 3. 技术选型

### 3.1 一期：electron-updater + NSIS + GitHub Releases（推荐）

- **electron-updater**：electron-builder 官方配套，NSIS 静默安装、断点续传、差量下载（blockmap）、签名校验都是现成的，自研这些要数周；
- **更新源**：GitHub Releases（官方 provider，`latest.yml` 自动生成）。国内加速：二期加 generic 双源回退（主源超时切 Gitee/自建静态地址；electron-updater 不原生支持多源回退，需自己写 30s 超时切换，工程量小）；
- **CI 打包**：GitHub Actions 的 Windows runner 出 NSIS 包——**顺带解决了 WSL 缺 wine 打不了安装包的问题**，并天然是将来接 SignPath 签名的位置。

### 3.2 二期（可选评估）：绿色版静默更新

原理是 DIY：下载新 zip → 解压到兄弟目录 → 写一个 `updater.cmd`（等进程退出 → 换目录 → 重启）。Windows 允许重命名运行中的 exe，所以「换目录」可行。但有杀软误报、文件占用、回滚等长尾问题，维护成本高。**建议一期不做，绿色版明确提示手动更新**，跑一段时间看绿色版用户占比再定。

---

## 4. 需要准备的东西（前置清单）

| # | 事项 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | GitHub 公开仓库 | 🔄 你正在搞 | 更新源与 CI 的载体，开源发布的第一步 |
| 2 | GitHub Actions workflow（Windows 打包 + 发布 Release） | ❌ 待建 | `test → electron-vite build → electron-builder --win → 创建 Release 并上传 exe + latest.yml`；同时解决 NSIS 无法本地打包的问题 |
| 3 | electron-builder `publish` 配置 | ❌ 待加 | `provider: github`（或 generic 指向自建地址）；`npm run dist` 增加 `--publish always` 的 CI 专用脚本 |
| 4 | NSIS 安装包产物 | ❌ 依赖 #2 | electron-updater 硬要求；本地 WSL 打不出（wine），全部走 CI |
| 5 | dependencies 增加 `electron-updater` | ❌ 待加 | 版本按项目规则取 npm latest |
| 6 | Release 说明纪律 | 约定 | GitHub Release 正文 = 用户看到的「更新内容」，写给人看；package.json `version` 是版本唯一事实源 |
| 7 | 签名（发布前） | 🔄 你在办 | 未签名期间升级功能可用，但新装 exe 仍会被 SAC/SmartScreen 拦（见 6.3）；接入 SignPath 后 `verifyUpdateCodeSignature` 保证升级包同证书 |

---

## 5. 交互细节设计

### 5.1 状态与入口
- 标题栏常驻更新状态：检查中不显示；发现新版本 → 「更新」按钮（琥珀色，带角标版本号）；下载中 → 进度百分比；已下载 → 「更新」可点击态；
- 托盘菜单加「检查更新」项（手动触发兜底）。

### 5.2 确认弹框（点击「更新」后）
- 标题：`升级到 vX.Y.Z`；
- 正文：Release 说明（markdown 渲染）+ 后果提示：「应用将关闭并自动完成安装（约十几秒），随后自动重启。未保存的内容已存入草稿，重启后自动恢复」；
- 按钮：`立即升级` / `暂不`。

### 5.3 取消语义（待拍板 A）
- 推荐：`declinedVersion = vX.Y.Z` → 该版本不再自动弹框、下次启动**不自动安装**；标题栏保留小字入口可手动升级；下个新版本重新走完整流程；
- 备选（按你原文字面）：取消只对当前会话有效，杀进程后下次启动仍自动装——不推荐，骚扰感强。

### 5.4 静默安装与升级说明页
- 检测到「已下载且未被拒绝」的更新 + 用户非活跃（面板隐藏 ≥ 5 分钟）→ 下次启动窗口显示前静默 `quitAndInstall(true, true)`；
- 新版本首次启动：`settings.lastRunVersion ≠ app.getVersion()` → 自动新开一个标签，标题「vX.Y.Z 更新内容」，只读渲染上次存的 releaseNotes，用户可关闭/查看历史（存 `userData/changelogs/`）。

### 5.5 定时与安全
- 启动后 30s 首查 + 每 4h 一查（`setInterval`，面板隐藏时照常）；手动「检查更新」随时可用；
- 更新源仅允许 https 且域名白名单（github.com / objects.githubusercontent.com / 未来 Gitee 域），杜绝渲染层传入任意 URL（IPC 入参校验）。

---

## 6. 风险与坑（点评部分）

| # | 风险 | 说明与对策 |
| --- | --- | --- |
| 6.1 | **绿色版用户无法自动升级** | 一期明示「绿色版请到 Releases 手动下载」；二期评估 DIY 换目录（3.2） |
| 6.2 | GitHub Releases 国内下载慢/失败 | 一期接受；二期 generic 双源回退（Gitee 或自建静态托管 latest.yml + 安装包） |
| 6.3 | **未签名 + 自动升级 + SAC 的死结** | 自动更新装上的新 exe 若未签名，SAC 用户在重启后的新 exe 上可能再遇拦截弹窗，升级体验断裂。**发布给他人前签名是硬前提**，与 SignPath 计划吻合 |
| 6.4 | 用户取消/杀进程时序边界 | 取消语义拍板（5.3）后严格实现；已下载未安装的缓存包要随「拒绝」清理，避免下次启动误装 |
| 6.5 | dev 模式误触发升级 | 开发态禁用自动检查（`!app.isPackaged` 守卫）；测试用 `dev-app-update.yml` 指向测试 feed，版本号 bump 走一轮真实升级（如 0.2.0 → 0.2.1）验证全链路 |
| 6.6 | 差量更新依赖 blockmap | electron-builder 默认生成 `.blockmap`，Release 上传时别漏（workflow 里用通配上传 exe + blockmap + latest.yml） |

---

## 7. 待确认问题

| # | 问题 | 推荐 |
| --- | --- | --- |
| Q1 | 取消语义按 5.3 推荐执行？ | 该版本内不再自动装 |
| Q2 | 一期更新源仅 GitHub Releases，国内加速放二期？ | 是 |
| Q3 | 绿色版一期仅提示手动更新？ | 是 |
| Q4 | 定时检查频率 4h 是否合适？ | 是（无流量负担，GitHub API 限额内） |

---

## 8. 工作量估算（拍板后）

| 模块 | 工时 |
| --- | --- |
| UpdateService（主进程）+ IPC + 白名单校验 | 0.5d |
| 渲染层：更新按钮/进度/确认弹框/取消逻辑 | 0.5d |
| 升级说明页（自动开 tab + changelog 存储） | 0.5d |
| GitHub Actions workflow + publish 配置 + 端到端真升级验证 | 0.5d |
| 合计 | **~2d**（依赖 GitHub 仓库就绪） |
