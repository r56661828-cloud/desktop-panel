# Desktop Panel 打包部署文档

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 撰写日期 | 2026-09-12 |
| 适用版本 | v0.1.0（Electron 44 / electron-builder 26） |
| 产物形态 | Windows x64：NSIS 安装包 + zip 绿色版 |

---

## 1. 产物概览

在 WSL/Linux 开发机上执行打包，产出**可直接在 Windows 运行**的产物（位于 `dist/`）：

| 产物 | 文件 | 状态 | 用途 |
| --- | --- | --- | --- |
| zip 绿色版 | `dist/DesktopPanel-0.1.0-x64.zip`（约 153MB） | ✅ 已产出（2026-09-12） | 免安装：解压到任意目录，直接运行 `Desktop Panel.exe` |
| 解包目录 | `dist/win-unpacked/` | ✅ 已产出 | zip 的原始内容，可直接拷贝整个目录使用 |
| NSIS 安装包 | `dist/DesktopPanel-Setup-0.1.0.exe` | ⏳ 需在 Windows 机器打包 | 常规安装：可选目录、创建桌面/开始菜单快捷方式 |

> **为什么 Linux 交叉打包只出了 zip**：NSIS 安装器在 Linux 上构建需要 wine（编辑 exe 安装器资源），当前 WSL 未安装且无 sudo 权限；zip 绿色版不受影响且功能完全一致。需要安装包时在 Windows 机器执行 2.2 节命令即可（配置已就绪）。

> 两条路径**都不要求 Windows 机器装有 Node/Git**——产物是自包含的（内置 Electron 运行时）。

> 两条路径**都不要求 Windows 机器装有 Node/Git**——安装包/绿色版是自包含的（内置 Electron 运行时）。

## 2. 打包方法

### 2.1 在 WSL/Linux 上交叉打包（当前采用，无需 Windows）

```bash
# 一次性准备（首次）
npm install
node scripts/fetch-electron.mjs   # 下载 electron 二进制（自动走 npmmirror）

# 打包（Windows 目标：NSIS + zip）
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" \
ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/" \
npm run dist
```

- `npm run dist` = `electron-vite build`（编译三端产物到 `out/`）+ `electron-builder --win --publish never`；
- **WSL 无 wine 时只打 zip**（跳过 NSIS）：`npx electron-builder --win zip --publish never`（前置 `npm run build`）；
- 镜像变量用于国内网络：拉取 win32 版 Electron 运行时 zip 与 NSIS/winCodeSign 打包工具，GitHub 直连可达时可省略；
- 打包配置在 `package.json` 的 `build` 字段：appId、图标（`resources/icon.png` 自动转 ico）、`extraResources`（托盘图标随包分发）、NSIS 选项（可选目录/快捷方式）；
- **asar 瘦身**：`build.files` 已排除 `node_modules`（主/预加载进程仅外置 `electron`，渲染层全量打包，运行时不需要 node_modules）——排除后 app.asar 由 117MB 降至 2.6MB；若未来主进程开始 require 运行时依赖，需移除该排除项。

### 2.2 在 Windows 上打包（可选，与 2.1 结果一致）

前置：Node ≥ 20、npm。

```powershell
npm install
npm run dist
```

如 Electron 二进制下载缓慢，先设置镜像再安装/打包：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
npm run dist
```

## 3. Windows 上的部署与运行

### 3.1 安装包方式（推荐日常使用）

> 前置：先在 Windows 机器执行 2.2 打出 `DesktopPanel-Setup-0.1.0.exe`（或将来在 WSL 安装 wine 后交叉打包）。

1. 拷贝 `DesktopPanel-Setup-0.1.0.exe` 到 Windows 机器（U 盘/网络传输均可）；
2. 双击运行 → 选择安装目录 → 安装（默认装到 `%LOCALAPPDATA%\Programs\Desktop Panel\`，仅当前用户，无需管理员）；
3. 安装完成自动启动；桌面与开始菜单生成「Desktop Panel」快捷方式；
4. **首次运行提示**：未做代码签名，会被 Windows 11 智能应用控制直接拦截（无「仍要运行」入口），需先关闭 SAC——见 5.1 的实测处理与代价说明。

### 3.2 绿色版方式（免安装/便携，当前已可用）

1. 把 `dist/DesktopPanel-0.1.0-x64.zip` 拷到 Windows 机器（WSL 下可直接复制到 `/mnt/c/...`），解压到任意可写目录（如 `D:\Tools\DesktopPanel\`）；
2. 运行目录内 `Desktop Panel.exe`；
3. 如需开机自启，在托盘菜单勾选「开机自启」（写入当前用户的启动项）。

> **绿色版没有安装向导是设计使然**（解压即用）。选目录/创建快捷方式的安装流程属于 3.1 的 NSIS 安装包。
>
> **重新打包后仍被智能应用控制拦截**（实测 2026-09-12）：SAC 按「文件哈希 + 云端信誉」逐个评估，每次重新构建的 exe 都是新的未知文件，会再次触发拦截，且 SAC 无单应用白名单。自用场景的唯一稳定解法是关闭 SAC（见 5.1），或完成代码签名。

### 3.3 安装后的功能自检（对齐 TEST-CASES P0，约 10 分钟）

| 步骤 | 预期 |
| --- | --- |
| 双击启动 → 面板出现，托盘有蓝色图标 | 正常驻留 |
| 任意应用前台按 `Ctrl+Shift+Q` | 面板唤醒并聚焦编辑区 |
| 点击图钉 → Alt+Tab 切走 | 面板仍置顶（已真机验证 ✅ 2026-09-12） |
| 输入内容 → Ctrl+S → 另存为 | 生成 `.md`，第三方工具打开渲染一致 |
| Ctrl+O 打开 md/txt | 正常打开编辑，再次打开同文件不重复开标签 |
| Ctrl+D 涂鸦 → 完成 | 透明 PNG 插入文档；双击图片可再编辑 |
| ✕ 关闭 → Ctrl+Shift+Q 再唤起 | 内容与脏标记完整（✕ 只隐藏，应用驻留托盘） |
| 托盘 → 退出（有未保存内容） | 弹出三选确认 |

## 4. 数据与目录说明（Windows）

| 内容 | 位置 |
| --- | --- |
| 应用安装目录（安装版） | `%LOCALAPPDATA%\Programs\Desktop Panel\` |
| 设置 / 草稿 / 涂鸦 pending 资产 | `%APPDATA%\desktop-panel\`（`settings.json`、`drafts\`、`pending-assets\`） |
| 窗口位置尺寸 | `%APPDATA%\desktop-panel\window-state.json` |
| 用户文档 | 用户自选目录；涂鸦资产写在文档同目录 `assets\` 下 |

卸载安装版不会删除 `%APPDATA%\desktop-panel`（草稿与设置保留）；绿色版直接删目录即可。

## 5. 已知限制与注意事项

1. **未签名 → Windows 11「智能应用控制」直接拦截（实测 2026-09-12）**：双击 exe 弹「智能应用控制已阻止可能不安全的应用」，**没有「仍要运行」入口**（普通 SmartScreen 的「更多信息→仍要运行」不适用）。处理：
   - 自用：`设置 → 隐私和安全性 → Windows 安全中心 → 应用和浏览器控制 → 智能应用控制 设置 → 关`，关后即可运行。⚠️ 该功能一旦手动关闭无法重新开启（需重置 Windows），自担权衡；
   - 评估模式下可先试：右键 zip → 属性 → 勾选「解除锁定」→ 重新解压（清除网络标记；「开」模式下无效）；
   - 正式分发：走开源免费签名（SignPath Foundation）接入后两个拦截均消除，方案见 `docs/SIGNING.md`；
2. **全屏独占应用**（全屏游戏/视频）会盖住钉住的面板——平台限制，非缺陷（技术方案 7.4）；
3. **快捷键冲突**：若 `Ctrl+Shift+Q` 被其他软件占用，注册失败时托盘有气泡提示，可从托盘菜单唤起（改键设置页在 v0.3 规划中，当前可手改 `%APPDATA%\desktop-panel\settings.json` 的 `shortcut` 字段后重启）；
4. **自动更新**：未接入（当前手动下载新安装包覆盖安装即可，用户数据不受影响）；
5. 杀毒软件误报：NSIS 未签名安装包偶发被误报，可加白名单或改用 zip 绿色版。

## 6. 打包常见问题（排查）

| 现象 | 处理 |
| --- | --- |
| 打包卡在下载 electron / winCodeSign | 确认带上了 2.1 的两个镜像环境变量 |
| Linux 打 NSIS 报 `spawn wine ENOENT` | NSIS 交叉打包需要 wine；WSL 用 `npx electron-builder --win zip` 只打绿色版，或装 wine，或在 Windows 机器打包 |
| `npm install` 后报 ERESOLVE | 删除 `node_modules` 与 `package-lock.json` 重装（大版本切换残留，见技术方案 6.1） |
| 打包产物图标不显示 | 确认 `resources/icon.png` 存在（`node scripts/gen-icons.mjs` 可重新生成） |
| 托盘图标空白 | `extraResources` 未生效：确认 `build.extraResources` 配置未被改动 |
| 安装包双击无反应 | 检查是否被杀软隔离；查看 `%TEMP%` 下 NSIS 日志 |
