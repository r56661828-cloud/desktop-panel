# Desktop Panel 在线更新技术方案

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 撰写日期 | 2026-09-12 |
| 需求评审 | docs/UPDATE-PLAN.md（Q1–Q4 已按推荐拍板） |
| **前提假设** | **代码签名已就绪（SignPath 接入完成）**——本方案所有安装/升级/校验环节均站在「产物已签名」的前提下设计，不再包含未签名场景的绕行逻辑 |
| 范围 | 一期：NSIS 安装版自动更新全链路；绿色版仅提示手动更新 |

---

## 1. 决策基线（已确认）

| # | 决策 |
| --- | --- |
| D1 | 取消语义：用户点「暂不」→ `declinedVersion` 记录该版本，**该版本内不下载、不自动装、下次启动不装**；仅保留标题栏手动入口；新版本发布重置循环 |
| D2 | 一期更新源仅 GitHub Releases；generic 双源回退放二期（预留接口） |
| D3 | 绿色版（zip 便携）一期不支持自动更新，界面提示「请到 Releases 页手动下载」 |
| D4 | 检查频率：启动后 30s 首查 + 每 4 小时定时 + 托盘手动触发 |

**双仓现实**：当前 `origin` 是 Gitee（you-renjun/desktop-panel，镜像+国内分发）；**需新建 GitHub 公开仓库**并添加为第二远端——CI（Actions）、Releases 更新源、SignPath 集成都挂在 GitHub 侧。代码推流：`git push origin master`（Gitee）+ `git push github master`（GitHub）。

---

## 2. 总体架构与状态机

```
┌ Main: UpdateService（单例）──────────────────────────────────┐
│ 调度: 启动+30s 首查 / setInterval 4h / IPC 手动触发            │
│ electron-updater: checkForUpdates → downloadUpdate → 安装      │
│ 事件: state 变更 → webContents.send(update:state)             │
│ 缓存目录: %LOCALAPPDATA%/<appName>-updater/（electron-updater 自管）│
└───────────────▲──────────────────────────────────────────────┘
                │ IPC: update:check / update:download+install / update:decline
┌ Renderer ─────┴──────────────────────────────────────────────┐
│ TitleBar UpdateButton（idle/checking/downloading%/ready）      │
│ UpdateConfirmDialog（Naive UI：版本+说明+后果+立即升级/暂不）   │
│ ChangelogTab（升级后自动打开的只读标签，复用 TipTap 只读渲染）   │
└──────────────────────────────────────────────────────────────┘
```

状态机（`UpdateState`，主进程持有、每次变更全量推送）：

```
idle → checking → available → downloading(percent) → downloaded → installing
                     │                                          │
                     └─ declined → idle(该版本)                 └─ error(可重试，回到 idle)
```

---

## 3. UpdateService 设计（主进程）

### 3.1 初始化与守卫

- `app.isPackaged === false` 时**整体禁用**（dev 不检查、不注册定时），测试走 `dev-app-update.yml`；
- electron-updater `autoDownload = false`、`autoInstallOnAppQuit = false`——**全手动控制**，理由：D1 要求「拒绝的版本不下载」，默认的自动下载无法跳过已拒绝版本；
- `disableWebInstaller = true`；`allowDowngrade = false`。

### 3.2 检查与下载流程

```
check(manual=false)
  → autoUpdater.checkForUpdates()
  → update-available 事件:
      if (version === settings.declinedVersion) → 状态回 idle（titlebar 不亮，仅托盘菜单可见版本提示）
      else → downloadUpdate() → downloading...
  → download-progress → 推送 percent（节流 500ms）
  → update-downloaded → 落盘 changelog → 状态 downloaded
```

- 检查失败（离线/限流）：静默回 `idle`，主进程日志记录；手动触发时 toast「检查失败，请稍后再试」；
- 手动检查不受 `declinedVersion` 限制：手动查到已拒绝版本 → 状态 `available`，允许用户改主意重新下载。

### 3.3 安装联动（关键时序）

`update:install`（用户点「立即升级」）：

1. 通知渲染层 `flushDrafts()`（等 Promise，防草稿丢失——复用 PRD 5.9 机制）；
2. 销毁定时器；
3. `autoUpdater.quitAndInstall(isSilent=true, isForceRunAfter=true)`——NSIS 静默安装 + 完成后自动重启新版本；
4. 单实例锁：安装器重启的是新 exe，旧进程已退出、锁已释放，`second-instance` 分支不干扰。

### 3.4 启动静默安装（D-需求 6：杀进程后下次打开自动升级）

放在 `app.whenReady()` 内、`createWindow()` **之前**：

```
const raced = Promise.race([autoUpdater.checkForUpdates(), timeout(5000)])
若结果为已下载/可下载 且 version !== declinedVersion:
    → downloadUpdate() 完成（缓存命中时瞬时）→ quitAndInstall(true, true)
    → 全程不创建窗口（用户感知：启动图标多转一下，直接进新版本）
否则/超时 → 正常 createWindow 流程
```

- 缓存命中（上次已下载但没装）时下载步骤瞬时完成，实际体验是「打开即升级」；
- `declinedVersion` 命中 → 跳过安装，正常启动，仅标题栏亮入口。

### 3.5 升级说明（D-需求 7）

- `update-downloaded` 事件携带 `releaseNotes`（GitHub Release 正文，electron-updater 自动带入 latest.yml）→ 主进程写 `userData/changelogs/<version>.md`；
- 新版本首次启动：比对 `settings.lastRunVersion !== app.getVersion()` → 渲染层自动 `tabs.newChangelogTab(version)`（只读标签：禁编辑、标题「vX.Y.Z 更新内容」，内容从 `userData/changelogs/` 读取，缺失时兜底读 `resources/CHANGELOG.md` 对应章节）；
- 渲染完成后 `settings.lastRunVersion = 当前版本`（只开一次）。

---

## 4. IPC 契约新增（白名单内追加）

| 通道 | 类型 | 入参 | 出参/推送 | 说明 |
| --- | --- | --- | --- | --- |
| `update:check` | invoke | `{ manual: boolean }` | `UpdateState` | 手动/调度统一入口 |
| `update:install` | invoke | `{ version }` | — | 校验 version === 当前 downloaded 版本才执行 3.3 时序 |
| `update:decline` | invoke | `{ version }` | `UpdateState` | 写 `declinedVersion` + 清理该版本缓存包（`autoUpdater` 无删除 API → `fs.rm` 缓存目录内该版本文件，路径经 pending 同款白名单校验） |
| `update:state` | on | — | `UpdateState` | 主进程推送：`{ phase, version?, percent?, releaseNotes?, error? }` |

渲染层 `PanelApi` 同步扩展四个方法/监听。安全基线不变：无渲染层传入 URL 的通道，feed 地址只来自主进程配置（满足「仅 https + 主机白名单」约束——一期 host 白名单：`github.com`、`objects.githubusercontent.com`、`release-assets.githubusercontent.com`；二期 generic 源增补 Gitee 域）。

---

## 5. 渲染层设计

### 5.1 TitleBar UpdateButton

- `idle`：不显示（或托盘菜单可见「检查更新」）；
- `available/downloaded`：琥珀底「更新 v0.2.0」按钮（`data-testid="update-btn"`），点击弹确认框；
- `downloading`：按钮显示 `下载中 42%`（不可点）；
- `checking`：不显示（避免闪烁）；
- `error`：回到 idle，托盘菜单可见。

### 5.2 UpdateConfirmDialog（Naive UI Dialog）

- 标题 `升级到 v0.2.0`；
- 内容：releaseNotes markdown 渲染 + 后果文案：「应用将关闭并自动完成安装（约十几秒），完成后自动重启。未保存内容已存入草稿，重启后自动恢复。」；
- 按钮：`立即升级`（primary）→ `update:install`；`暂不` → `update:decline`（toast「已跳过该版本，可随时在托盘菜单手动检查」）。

### 5.3 升级说明标签

- 新增 `docType: 'changelog'` 的特殊标签（只读，不参与保存/脏标记/草稿；关闭即销毁）；复用 TipTap 只读渲染（`editable: false`）或轻量 markdown 渲染均可，实现取简。

### 5.4 settings 扩展

```ts
declinedVersion: string | null   // D1
lastRunVersion: string           // 5.5 升级说明触发标记
```

---

## 6. 更新源与 CI（GitHub 侧）

### 6.1 仓库准备

- 新建 GitHub 公开仓库（SignPath 接入的前提，见 docs/SIGNING.md）；本地添加远端 `github`；
- 推流纪律：`git push origin <branch>`（Gitee）与 `git push github <branch>` 同步。

### 6.2 发布产物清单（Release assets，缺一不可）

```
DesktopPanel-Setup-<ver>.exe      # NSIS 安装器（electron-updater 下载对象）
DesktopPanel-Setup-<ver>.exe.blockmap   # 差量更新
latest.yml                        # feed 清单（version/files/hash/releaseNotes）
```

### 6.3 GitHub Actions workflow（`.github/workflows/release.yml`）

```
触发: push tag v*
runner: windows-latest
steps:
  1. checkout（github 仓库）
  2. setup-node 22 + npm ci
  3. npm run typecheck && npm test          # 门禁
  4. npm run build                           # electron-vite build
  5. 签名（SignPath 步骤，前提已就绪）        # 对 Setup exe 签名
  6. npx electron-builder --win nsis --publish always   # 生成并上传 Release（含 latest.yml/blockmap）
env: GH_TOKEN(secrets.GITHUB_TOKEN)、SignPath 凭据(secrets)
```

- `build.publish = { provider: 'github', owner, repo }` 写入 package.json（owner/repo 以实际新建仓库为准）；
- 本地 `npm run dist` 保持 `--publish never`，只有 CI 发布；
- 差量更新依赖 `.blockmap` 随包上传（6.2），workflow 通配上传避免遗漏。

### 6.4 依赖版本

`electron-updater` 实现时以 `npm view electron-updater version` 取 latest 登记 TECH-DESIGN 主文档版本清单（与 electron-builder 26 配套性以 peer/官方兼容矩阵为准）。

---

## 7. 安全设计

| 项 | 措施 |
| --- | --- |
| 更新源 | 仅 https；host 白名单见 §4；无渲染层可控 URL |
| 升级包校验 | electron-updater 内置 SHA512（latest.yml）+ **代码签名一致性校验**（`verifyUpdateCodeSignature`，默认开启；前提已签名，发布者不一致即拒绝安装） |
| changelog 落盘 | userData 目录（已有白名单），内容来源为 GitHub Release 正文（md 原样存储，渲染时走既有 CSP，不引入远程脚本） |
| IPC | 四个新通道全部入参校验；`update:install` 必须与 downloaded 版本一致 |

---

## 8. 边界与错误处理

| # | 场景 | 行为 |
| --- | --- | --- |
| 8.1 | 检查时离线/被墙/限流 | 静默回 idle；手动触发给 toast；不重试风暴（下次定时再查） |
| 8.2 | 下载中断 | electron-updater 断点续传；进程被杀后下次 check 续传 |
| 8.3 | 用户拒绝版本又出新版 | 新 version ≠ declinedVersion → 正常全流程 |
| 8.4 | 安装失败（磁盘/权限/杀软占用） | NSIS 安装器自身回滚，旧版本可继续运行；electron-updater 报 error → 状态 error → idle；下次启动重试 |
| 8.5 | 升级安装时应用正在编辑 | 3.3 第一步 flushDrafts 兜底；弹框文案已明示草稿保护 |
| 8.6 | 静默安装时机用户正在用 | 启动静默安装只发生在「启动早期窗口未显示」阶段；运行期一律经确认框 |
| 8.7 | blockmap 缺失 | 差量退化为全量下载（electron-updater 自动降级），不阻塞 |
| 8.8 | 绿色版运行 | UpdateService 检测无 NSIS 卸载注册表项/安装目录特征 → 推送 `phase: 'portable'`，TitleBar 不渲染更新按钮，托盘菜单「检查更新」置灰并提示手动下载（D3） |

---

## 9. 测试策略

| 层 | 内容 |
| --- | --- |
| 单元测试 | 版本比较、declined 判定、状态机迁移（纯函数抽离）；vitest |
| 本地链路 | `dev-app-update.yml` 指向本地 http-server 的假 feed（latest.yml + 假 exe）跑通 检查→下载→确认→安装 分支；dev 守卫用 `forceDevUpdateConfig` 临时开启 |
| CI 干跑 | workflow `workflow_dispatch` 手动触发，验证产物清单完整（exe/blockmap/latest.yml） |
| 端到端真升级 | 发布 0.2.0 → 本地装 0.2.0 安装版 → bump 0.2.1 走 CI → 启动观察：自动检查/下载/弹框/取消(declined 持久化)/确认/静默安装/重启后 changelog tab 全分支 |
| 回归 | E2E 冒烟 17 条全绿（更新功能不破坏既有链路）；冒烟补 2 条 update 相关（按钮状态存在性、dev 守卫不触发） |
| TEST-CASES 增补 | 新增 TC-U 系列（检查/下载/确认/取消持久化/启动静默装/changelog tab/离线/绿色版降级） |

---

## 10. 里程碑与工作量

| 阶段 | 内容 | 工时 |
| --- | --- | --- |
| U1 | UpdateService + IPC + settings 扩展 + 单测 | 0.5d |
| U2 | 渲染层（按钮/弹框/取消/托盘菜单） | 0.5d |
| U3 | 升级说明 tab + changelog 存储 | 0.5d |
| U4 | GitHub 仓库 + Actions workflow + SignPath 签名步骤 + publish 配置 | 0.25d（签名账号就绪前提下） |
| U5 | 端到端真升级验证 + 冒烟回归 | 0.25d |
| 合计 | | **~2d** |

前置依赖：GitHub 公开仓库创建（用户）、SignPath 账号与签名策略就绪（用户，docs/SIGNING.md）。

---

## 11. 文档影响面（实现时同步）

- TECH-DESIGN 主文档：1.1 选型表增 electron-updater、版本清单、IPC 表增四通道；
- TEST-CASES：新增 TC-U 系列（约 10 条）；
- DEPLOY：更新「自动更新」章节（替换当前「手动下载」口径）；
- README：特性列表增「自动更新」。
