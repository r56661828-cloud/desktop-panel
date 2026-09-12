# Desktop Panel 技术方案设计

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.3 |
| 撰写日期 | 2026-09-06 |
| 对应 PRD | v0.2（docs/PRD.md） |
| 范围 | 开发方案（不含测试方案） |

> v0.4 变更记录：按 UI-PLAN v0.1 引入 Naive UI / @lucide/vue / @tailwindcss/typography，1.1 选型表与版本清单同步更新；新增窗口最小化 IPC（win:minimize）。
> v0.3 变更记录：按「三方库不得落后 latest 超过一个大版本」的硬性要求，全量刷新版本基线（Electron 44 / Vite 7 / Vue 3.5 / Pinia 4 / Tailwind 4 / TypeScript 7 / TipTap 3 / vitest 5），新增 1.1 版本策略与锁定版本清单；6.1 补充依赖安装注意事项。
> v0.2 变更记录：6.1 节新增「项目创建步骤（Scaffold）」，记录工程的手工搭建过程与可复现步骤。

---

## 1. 技术选型

### 1.1 总体选型

| 层 | 选型 | 版本基线 | 理由 |
| --- | --- | --- | --- |
| 桌面框架 | Electron | 44.2.x（npm latest） | PRD 指定；Windows 层级控制、全局快捷键、托盘能力齐全 |
| 前端框架 | Vue + TypeScript | Vue 3.5.x / TS 7.0.x | 组合式 API 适合多标签状态管理；生态成熟 |
| 构建 | electron-vite + Vite | electron-vite 5.0 / Vite 7.3.x | 主/预加载/渲染三段式构建开箱即用，HMR 完整 |
| 状态管理 | Pinia | 4.0.x | 多标签、设置、窗口状态集中管理 |
| 样式 | Tailwind CSS + @tailwindcss/typography | 4.3.x / 0.5.x | 原子类 + Markdown 正文排版（prose） |
| 组件库 | Naive UI | 2.45.x（npm latest） | UI-PLAN v0.1 决策：Tooltip/Dialog/Message/ColorPicker 成套接入，CSS-in-JS 与 Tailwind 无冲突；主题走 themeOverrides 与全局 CSS 变量共享暖纸色板 |
| 图标 | @lucide/vue | 1.45.x | lucide-vue-next 已弃用，官方迁移至 @lucide/vue |
| 编辑器 | TipTap 3（ProseMirror 内核） | 3.31.x | 见 1.2 |
| Markdown 序列化 | tiptap-markdown + 自定义序列化规则 | 0.9（peer 支持 @tiptap/core ^3） | 见 3.2 |
| 在线更新 | electron-updater | 6.8.9 | 配套 electron-builder；GitHub Releases feed（docs/TECH-DESIGN-UPDATE.md） |
| 画布（涂鸦） | 原生 Canvas 2D | — | 需求为矢量笔画记录，无需重型画布库 |
| 单元级工具（如需） | vitest | 5.0 | 仅作为开发期自验工具，不含测试方案交付 |

**版本策略（硬性约束）**：所有三方库取 npm latest 稳定版（2026-09-06 查询），**任何库不得落后 latest 超过一个大版本**。当前唯一例外：**Vite 取 7.3.x 而非最新的 8.x**——electron-vite 5.0 的 peer 依赖上限为 `vite ^5 || ^6 || ^7`，vite 8 会直接装不上；7 与 8 相差一个大版本，在允许范围内。待 electron-vite 发布支持 vite 8 的版本后随升级收敛。查询命令：`npm view <pkg> version`（以 registry 为准，不凭记忆）。

**当前锁定版本清单**（2026-09-06 npm registry 实测值，与 `package.json` 对应）：

| 库 | 版本 | 说明 |
| --- | --- | --- |
| electron | 44.2.0 | |
| electron-vite | 5.0.0 | peer 限 vite ≤ 7 |
| vite | 7.3.6 | 唯一允许的落后一项（见上） |
| @vitejs/plugin-vue | 6.0.8 | 支持 vite 5–8 |
| electron-builder | 26.15.3 | |
| vue | 3.5.42 | |
| pinia | 4.0.3 | peer 需 @vue/devtools-api ^8.1.5，已列入 devDeps |
| @vue/devtools-api | 8.2.1 | 满足 pinia 4 peer |
| tailwindcss | 4.3.3 | v4 CSS-first，无 tailwind.config.js |
| @tailwindcss/postcss | 4.3.3 | 接入 PostCSS，v4 自带前缀处理 |
| @tailwindcss/typography | 0.5.20 | Markdown 正文 prose 排版 |
| naive-ui | 2.45.3 | 组件库（UI-PLAN v0.1） |
| @lucide/vue | 1.45.0 | 图标（lucide-vue-next 已弃用） |
| postcss | 8.5.28 | |
| typescript | 7.0.2 | vue-tsc peer `>=5.0.0` 满足；首次 typecheck 需验证兼容性 |
| vue-tsc | 3.3.11 | |
| vitest | 5.0.0 | peer 支持 vite 7 |
| @tiptap/* | 3.31.3 | 全部 TipTap 扩展统一 3.31.3，@tiptap/pm 必须精确同版 |
| tiptap-markdown | 0.9.0 | peer `@tiptap/core ^3.0.1`，与 TipTap 3 匹配 |

UI 组件采用 Naive UI 按需引入（v0.1 时期为纯自绘 Tailwind，UI-PLAN v0.1 起引入组件库升级视觉）；无边框窗口骨架（drag 区、窗口控制）与 TipTap/涂鸦功能层仍为自研。

### 1.2 编辑器选型：TipTap vs 备选

| 候选 | 结论 | 关键原因 |
| --- | --- | --- |
| **TipTap 3（选定）** | ✅ | ProseMirror 数据模型，可自定义 Node/Marks：下划线、颜色、字号、**涂鸦自定义 Node** 均为一等公民；`tiptap-markdown@0.9` 已适配 `@tiptap/core ^3`，未覆盖格式可降级为内嵌 HTML，正好匹配 PRD 3.1 |
| Milkdown | ❌ | 同为 ProseMirror，但主题/插件体系偏「预设整包」，自定义涂鸦 Node 与序列化规则的成本更高 |
| Vditor | ❌ | 三模式（所见即所得为半即时渲染），DOM 非受控，拿不到可靠的富文本数据模型，无法承载涂鸦 Node 与扩展 Marks |

TipTap 需要的扩展（v3 包结构：核心扩展仍在独立包，部分能力并入 StarterKit 与 TextStyleKit，以安装后实际导出为准）：

- 核心：`@tiptap/starter-kit@3`（标题/粗斜体/列表/代码块/引用/分割线/下划线/链接等，v3 起扩展收录范围更大）
- 表格：`@tiptap/extension-table`（Table/Row/Cell/Header）
- 格式：`@tiptap/extension-underline`、`@tiptap/extension-text-style@3`（TextStyleKit 含 Color / FontSize / BackgroundColor）、`@tiptap/extension-highlight`（背景色备选）
- 链接/图片：`@tiptap/extension-link`、`@tiptap/extension-image`（涂鸦 PNG 复用 Image 或自定义 Doodle Node，见 4）
- md 桥：`tiptap-markdown`

---

## 2. 总体架构

### 2.1 进程模型

```
┌─────────────────────────── Main（主进程，Node 侧）───────────────────────────┐
│ WindowManager   窗口创建/置顶/钉住/位置尺寸持久化                                │
│ ShortcutService 全局快捷键注册/注销/冲突降级                                     │
│ TrayService     托盘图标/菜单/气泡                                              │
│ FileService     打开/保存对话框、原子写盘、文件监听（外部变更）                     │
│ DraftService    草稿暂存/恢复（userData/drafts）                                │
│ SettingsService settings.json 读写                                             │
│ AssetProtocol   自定义协议 app-file:// 安全加载本地图片（md 相对路径）              │
└───────────────▲──────────────────────────────────────────┬──────────────────┘
                │ IPC（contextBridge 暴露，通道白名单）        │
┌───────────────┴──────────────────────────────────────────▼──────────────────┐
│ Renderer（渲染进程，Vue 3 SPA）                                                │
│ 标题栏 / 标签栏 / 格式工具栏 / TipTap 编辑器实例（每标签一个，keep-alive）          │
│ DoodleLayer 涂鸦覆盖画布 / Toast / Tooltip                                     │
│ Pinia: tabsStore / editorStore(每tab) / settingsStore / uiStore               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 安全基线

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`（渲染进程不碰 Node API）；
- 主进程通过 `preload` 的 `contextBridge` 暴露唯一 API 对象 `window.api`，IPC 通道以白名单常量定义（`ipcChannels.ts` 共享于主/预加载）；
- 渲染进程发起的所有文件路径，必须来自主进程返回的对话框结果或主进程已登记的已打开文件清单，不接受渲染进程任意拼路径读写。

---

## 3. 核心模块设计

### 3.1 窗口与层级（对应 PRD M2，决策 D1/D3）

- 单 `BrowserWindow`，`frame: false`，`transparent: false`，尺寸 720×560，min 400×300；`show: false` 启动，就绪后显示（避免白屏闪烁）。
- 位置尺寸持久化：自实现（`userData/window-state.json`，含 `x/y/width/height/maximized`），首次启动居中偏上（垂直 1/4 处）；多显示器时校验可见性，不可见则回落主屏居中。
- **钉住实现**：
  ```ts
  // 钉住
  win.setAlwaysOnTop(true, 'screen-saver')   // Windows 下确保高于普通置顶应用
  // 取消钉住
  win.setAlwaysOnTop(false)
  ```
  - 钉住状态写入 `settings.json`（`pinned: boolean`），跨会话记忆；
  - 已知边界：Windows 下若前台是全屏独占（如全屏游戏），置顶可能失效——记录为已知限制，不特殊处理。
- 无边框拖动：标题栏容器 `style="-webkit-app-region: drag"`，交互控件（按钮、标签）局部 `no-drag`；缩放使用 Electron 原生边缘缩放（`resizable: true` + CSS `--webkit-app-region` 不干扰边缘 8px 热区，必要时用系统 `WM_NCHITTEST` 处理，见风险 7.3）。
- 失焦无特殊行为（PRD D1）：不监听 `blur` 做任何窗口动作。

### 3.2 编辑器与 Markdown 序列化（对应 PRD M3/M7，决策 D5）

#### 数据流

```
打开 .md ──parse──▶ ProseMirror Doc ──WYSIWYG 编辑──▶ Doc（内存）
                                                        │ Ctrl+S
保存 ◀──serialize（md 文本 + assets 相对路径）◀──────────┘
```

- 解析：`tiptap-markdown` 的 `markdownParser`；启用 HTML 解析（`html: true`），使 `<u>`、`<span style>` 等扩展格式还原为对应 Marks。
- 序列化：`tiptap-markdown` 的 `serializer`，自定义规则：
  - 标准节点 → 标准 md；
  - `underline` mark → `<u>…</u>`；
  - `color/fontSize` marks → `<span style="color:…;font-size:…">…</span>`；
  - 序列化时对相邻同格式 mark 合并，控制 HTML 片段最小化；
- `table` → 管道表语法（GFM）；表格内含扩展格式时降级为 HTML `<table>`（tiptap-markdown 默认行为，接受）。
- **往返一致性**（round-trip）是本模块最大风险，见 7.1 应对。

#### 格式工具栏（FR-7.2）

- 采用浮动气泡菜单（`@tiptap/extension-bubble-menu`），选区出现时弹出，含：粗/斜/下/删/行内代码、字号下拉、文字颜色与背景色色板、清除格式。

### 3.3 多标签（对应 PRD M10）

- **实现策略**：每个标签一个 TipTap 编辑器组件实例，用 `<KeepAlive>` 保活——光标、滚动、撤销栈天然保留，切换零恢复成本。标签数上限走软限制（>15 个时提示，不强制）。
- `tabsStore` 结构：

```ts
interface TabItem {
  id: string                 // uuid
  filePath: string | null    // null = 未命名
  fileName: string           // 展示名
  docType: 'markdown' | 'plaintext'
  dirty: boolean
  savedMtimeMs: number | null // 打开/保存时磁盘 mtime，用于外部变更检测
  cursor: object | null       // ProseMirror selection 快照（keep-alive 下仅备份用）
  draft: boolean              // 是否有未落盘草稿
}
```

- 切换：`Ctrl+Tab/Ctrl+Shift+Tab`（全局 keydown 拦截）、`Ctrl+PgUp/PgDn`、点击；打开已存在文件先查 `filePath` 命中（大小写不敏感规范化比较）。
- 关闭最后标签：兜底新建空白标签（FR-10.6），不通知主进程。
- 标签栏收缩：CSS flex-shrink + `min-width` + 中键滚动，不做虚拟化（标签量级小）。

### 3.4 文件 IO 与保存（对应 PRD M5/M6）

全部经主进程 `FileService`，IPC 接口见 5.3。

- **打开**：`dialog.showOpenDialog({ filters: [md/markdown/txt], multiSelections: true })` → 主进程读取内容与 `mtime` → 返回 `{ path, content, mtimeMs }` → 渲染进程建标签、解析。
- **保存（原子写）**：
  ```
  write temp 文件（同目录 .tmp 后缀）→ fs.rename 覆盖 → 成功后更新 mtime 缓存
  ```
  另存为：`dialog.showSaveDialog` → 同上。Windows 上 `rename` 覆盖已存在文件可用，失败（EPERM/EXDEV）时降级为「先删后 rename」+ 失败回滚提示。
- **图片资产**：涂鸦 PNG/JSON 写入 `<文档目录>/assets/`；文档内以相对路径 `./assets/xxx.png` 引用。
- **本地图片加载**：渲染进程 `<img src>` 不能直接读盘，注册自定义协议：
  ```ts
  protocol.handle('app-file', ...)  // app-file://<url-encoded-abs-path>
  ```
  编辑器内相对路径解析规则：以当前标签 `filePath` 的目录为 base 解析为绝对路径再走 `app-file://`；未保存的未命名文档中图片以 blob/data URL 展示，另存为成功后重写为相对路径。
- **外部变更检测**：`FileService` 对已打开文件用 `fs.watch`（防抖 300ms）+ 唤起面板时比对 `mtimeMs` 双保险；变更时向渲染进程推 `file:changed` 事件，标签上显示冲突条（重新加载 / 保留我的版本）。
- **编码**：读取统一按 UTF-8，带 BOM 时剥离并保存时还原 BOM 标记；非 UTF-8 文件（GBK 等）首版提示「编码不受支持」并只读打开（P2 支持 GBK 转码）。

### 3.5 草稿与崩溃恢复（对应 PRD 5.9）

- 草稿目录：`userData/drafts/`，每个标签一个文件 `drafts/<tabId>.json`：

```jsonc
{
  "version": 1,
  "tabId": "uuid",
  "filePath": "D:\\notes\\a.md",     // null = 未命名
  "docType": "markdown",
  "content": "<md 原文>",            // 序列化后的 md 文本
  "savedAt": 1757123456789
}
```

- 触发时机（主进程统一调度，防抖 500ms）：
  - 面板隐藏时全量落草稿；
  - 编辑期间每 30s 自动落脏标签草稿；
  - 内容变更即标记 `draft: true`（内存）。
- 恢复：启动时扫描 `drafts/`，逐条重建标签；`dirty` 恢复为 true；草稿与磁盘内容一致（md 文本相同）时直接标记 clean。
- 清理：标签正常关闭/保存成功后删除对应草稿文件；启动时丢弃 `savedAt` 距今 > 30 天的草稿。

### 3.6 全局快捷键与托盘（对应 PRD M1/M9）

```ts
// ShortcutService
globalShortcut.register('Control+Shift+Q', () => win.toggle())  // toggle: 显示+聚焦 / 隐藏
```

- toggle 显示时：`win.show()` → 若最小化先还原 → `win.focus()` → 渲染进程聚焦活动标签编辑器（IPC `editor:focus`）；
- 注册失败（返回 false）：托盘气泡「快捷键被占用，可在托盘菜单唤起」，托盘菜单保留「显示/隐藏面板」项作为永久降级；
- 设置页（P2）改键：先 `unregisterAll` 再注册新组合，失败回滚旧键；
- 托盘菜单：显示/隐藏面板、最近打开（P1）、新建标签、开机自启（勾选）、设置（P2）、退出。

### 3.7 涂鸦（对应 PRD M8，决策 D4）

#### 数据模型（矢量 JSON Schema）

```jsonc
// assets/doodle-1757123456789.json
{
  "version": 1,
  "canvas": { "width": 680, "height": 320 },   // 创建时画布 CSS 尺寸
  "strokes": [
    {
      "id": "uuid",
      "tool": "pen | line | arrow | rect | ellipse | eraser",
      "color": "#ff0000",
      "size": 3,                                // 细1/中3/粗6 映射
      // pen: 采样点序列（落笔起，pointermove 采点，含压力则存 pressure）
      "points": [[x, y], [x, y], ...],
      // 规则图形只存两端点
      "from": [x, y], "to": [x, y]
    }
  ]
}
```

- eraser 存为「被擦除 stroke id 列表」的快照操作而非笔画（撤销模型一致）：`{ tool: "eraser", erasedIds: [...] }`。

#### 交互实现

- **进入**：编辑器上方插入绝对定位覆盖层（`position: absolute; inset: 0`，z-index 高于编辑器），底层画布（显示）+ 顶层画布（当前笔画预览，双缓冲避免重绘闪烁）；进入时记录编辑器光标位置（ProseMirror selection）作为插图落点。
- **绘制**：Pointer Events（`pointerdown/move/up`），`setPointerCapture`；曲线用二次贝塞尔平滑（中点法）采样简化（Ramer–Douglas–Peucker，阈值 1px）控制点数。
- **完成**：
  1. 合成层导出 PNG（透明底，`canvas.toBlob('image/png')`）；
  2. IPC 写盘 `assets/doodle-<ts>.png` + `assets/doodle-<ts>.json`；
  3. 编辑器 `insertContent` 插入自定义 `doodle` Node（见下），退出涂鸦模式。
- **自定义 Doodle Node**（NodeView 渲染为 `<img>` + 角标）：

```ts
addAttributes: {
  src: string,          // 相对路径 ./assets/xxx.png
  dataPath: string,     // 相对路径 ./assets/xxx.json
  width: number         // 原始宽度，用于缩放显示
}
```

- **再编辑**：NodeView 内监听双击 → IPC 读取 JSON → 重新打开覆盖画布并重放 strokes → 完成时**复用原文件名**覆盖写 PNG/JSON → NodeView 通知 `src` 带版本参数刷新（`?v=<mtime>`）。
- 未命名文档中涂鸦：PNG/JSON 暂存 `userData/pending-assets/`，文档以占位路径引用；另存为成功后由主进程批量迁移到目标 `assets/` 并重写引用（渲染进程在保存回调里做字符串替换后二次序列化）。

### 3.8 纯文本模式（对应 PRD M4）

- `.txt` 标签不挂 TipTap，用 `<textarea>`（或 contenteditable 关闭的简单编辑器）；
- 工具栏按 `docType === 'plaintext'` 置灰；涂鸦入口隐藏；
- 保存序列化即原文，不做任何转换。

### 3.9 持久化汇总

| 文件 | 内容 | 写入时机 |
| --- | --- | --- |
| `userData/settings.json` | 快捷键、钉住状态、开机自启、默认路径、最近文件（≤10）、主题 | 变更即写（防抖） |
| `userData/window-state.json` | 窗口位置/尺寸 | 移动/缩放结束（防抖 500ms） |
| `userData/drafts/<tabId>.json` | 标签草稿 | 见 3.5 |
| `userData/pending-assets/` | 未命名文档的涂鸦资产 | 涂鸦完成时 |

---

## 4. UI 结构（渲染进程组件树）

```
App
├─ TitleBar（drag 区）
│   ├─ DocTitle（活动标签文件名 + ●脏标记）
│   └─ Actions: Pin / Doodle / Open / Save / Collapse
├─ TabBar（+ 新建，标签项，中键关闭）
├─ EditorArea
│   ├─ PlainEditor | TipTapEditor（KeepAlive，v-show 切换）
│   │   ├─ BubbleMenu（浮动格式栏）
│   │   └─ DoodleNodeView（涂鸦图片节点）
│   ├─ DoodleLayer（涂鸦覆盖画布 + 工具条：工具/颜色/粗细/撤销/完成/取消）
│   └─ FileConflictBar（外部变更提示条）
├─ ToastHost
└─ ConfirmDialog（未保存关闭确认 / 退出确认）
```

主题：CSS variables 定义深/浅两套 token，`prefers-color-scheme` 跟随系统。

---

## 5. IPC 接口清单

### 5.1 通道约定

- 命名：`<域>:<动作>`；invoke（请求响应）与 send/on（推送）分列；
- 所有通道在 `shared/ipc-channels.ts` 定义常量，preload 中逐一绑定，主进程统一 `ipcMain.handle` 注册表校验参数（zod 手写校验器即可，不引重库）。

### 5.2 接口表

| 通道 | 类型 | 入参 | 出参 | 说明 |
| --- | --- | --- | --- | --- |
| `win:toggle` | invoke | — | — | 快捷键入口由主进程直接调，此通道留托盘用 |
| `win:setPinned` | invoke | `pinned: boolean` | `ok` | 钉住切换（渲染侧按钮） |
| `win:getState` | invoke | — | `{ pinned, bounds }` | 启动恢复 |
| `win:collapse` | invoke | — | — | 收起按钮 = hide |
| `dialog:openFile` | invoke | `{ multi?: boolean }` | `Array<{ path, content, mtimeMs }>` | 打开文件对话框+读取 |
| `dialog:saveAs` | invoke | `{ defaultName, docType }` | `{ path } \| null` | 另存为对话框 |
| `file:write` | invoke | `{ path, content, bom?: boolean }` | `{ mtimeMs }` | 原子写（文本） |
| `file:writeBinary` | invoke | `{ path, base64 }` | `{ mtimeMs }` | 原子写（PNG） |
| `file:readAsset` | invoke | `{ path }` | `{ base64 \| text }` | 读涂鸦 JSON / 图片（限已登记文档目录内） |
| `file:migrateAssets` | invoke | `{ fromDir, toDir, names[] }` | `{ map: Record<name, relPath> }` | 未命名文档保存后迁移涂鸦资产 |
| `draft:save` | invoke | `DraftItem[]` | — | 批量落草稿（主进程调度亦可） |
| `settings:get / set` | invoke | — / `Partial<Settings>` | `Settings` | 设置读写 |
| `recent:add` | invoke | `{ path }` | — | 最近文件（P1） |
| `app:quit` | invoke | — | — | 托盘退出（先走未保存确认流程） |
| `update:getState` | invoke | — | `UpdateState` | 更新状态机当前值 |
| `update:check` | invoke | `{ manual }` | `UpdateState` | 手动/定时检查入口 |
| `update:install` | invoke | `{ version }` | — | 静默安装已下载版本（版本一致性校验） |
| `update:decline` | invoke | `{ version }` | `UpdateState` | D1 拒绝语义 + 清缓存 |
| `update:state` | on（推） | — | `UpdateState` | 状态机全量推送 |
| `update:changelog` | on（推） | — | `{ version, content }` | 刚升级完成 → 开说明页 |
| `file:changed` | on（推） | — | `{ path, mtimeMs }` | 外部变更推送 |
| `shortcut:triggered` | on（推） | — | `{ action: 'show' \| 'hide' }` | 唤醒后聚焦编辑器等 |
| `editor:focus` | on（推） | — | — | 主进程要求渲染聚焦编辑区 |

### 5.3 路径安全约束

`file:readAsset` / `file:writeBinary` 只允许写入「当前已打开文档所在目录的 `assets/` 子目录」或 `userData` 白名单目录；主进程维护 `openedDirs` 集合，路径做 `path.resolve` 后前缀校验，越界一律拒绝。

---

## 6. 工程结构

```
desktop-panel/
├─ electron.vite.config.ts
├─ package.json
├─ docs/
├─ src/
│  ├─ main/                     # 主进程
│  │  ├─ index.ts               # 入口：单例锁、窗口、协议、托盘装配
│  │  ├─ window.ts              # WindowManager
│  │  ├─ shortcut.ts            # ShortcutService
│  │  ├─ tray.ts                # TrayService
│  │  ├─ services/
│  │  │  ├─ file.ts             # FileService（对话框/原子写/监听）
│  │  │  ├─ draft.ts            # DraftService
│  │  │  ├─ settings.ts         # SettingsService
│  │  │  └─ paths.ts            # userData 目录约定与白名单校验
│  │  └─ protocol.ts            # app-file:// 注册
│  ├─ preload/
│  │  └─ index.ts               # contextBridge 暴露 window.api
│  ├─ shared/
│  │  ├─ ipc-channels.ts
│  │  ├─ types.ts               # DraftItem / TabSnapshot / Settings 等
│  │  └─ doodle-schema.ts       # 涂鸦 JSON 类型与版本迁移
│  └─ renderer/
│     ├─ index.html / main.ts / App.vue
│     ├─ stores/                # tabs / settings / ui（Pinia）
│     ├─ components/            # TitleBar / TabBar / EditorArea / Toast / Confirm
│     ├─ editor/
│     │  ├─ extensions/         # 自定义 Marks/Node（Doodle 等）
│     │  ├─ markdown.ts         # 序列化/反序列化规则
│     │  └─ plain/              # 纯文本编辑组件
│     ├─ doodle/                # 画布层、工具条、笔迹算法、JSON 编解码
│     └─ styles/                # tailwind + theme tokens
└─ resources/                   # 图标（托盘/应用）
```

- **单实例锁**：`app.requestSingleInstanceLock()`，二次启动 → 聚焦已有面板；
- **打包**：electron-builder，NSIS 安装包（x64），应用图标/版本信息；生产环境关闭 devtools。

### 6.1 项目创建步骤（Scaffold）

项目没有使用 `npm create @quick-start/electron` 交互式模板，而是**手工搭建**——便于锁定依赖清单与目录结构（模板会带入不需要的 ESLint/路由等）。实际创建过程如下，可复现：

**① 初始化与依赖安装**（Node ≥ 20，本机 Node 22）

```bash
mkdir desktop-panel && cd desktop-panel
npm init -y
```

随后手写 `package.json`（替代 npm init 生成物），关键内容：

- `main: "./out/main/index.js"`（electron-vite 构建产物入口）；
- scripts：`dev/build`（electron-vite）、`typecheck:node|web`（tsc / vue-tsc 双工程检查）、`test`（vitest）、`dist`（electron-builder 打包）；
- dependencies：TipTap 全家桶（starter-kit + table/underline/text-style/highlight/link/image + @tiptap/pm）、`tiptap-markdown`、`@tiptap/vue-3`、`vue`、`pinia`；
- devDependencies：`electron`、`electron-vite`、`electron-builder`、`@vitejs/plugin-vue`、`tailwindcss + @tailwindcss/postcss + postcss`、`typescript + vue-tsc`、`vitest`（版本见 1.1 版本策略）。

```bash
npm install --no-audit --no-fund
```

**依赖安装注意**（升级大版本时实测踩坑）：

- 切换依赖大版本（如 TipTap 2→3、Pinia 2→4）后，**旧 node_modules 树会导致 ERESOLVE 冲突**（npm 报 `Found: @tiptap/xxx@2.x` 之类）。 remedy：删除 `node_modules` 与 `package-lock.json` 后全新安装；
- `@tiptap/*` 全系列必须**精确同版**（3.31.3），`@tiptap/pm` 与 `@tiptap/core` 版本不一致会被 peer 检查拒绝；
- pinia 4 将 `@vue/devtools-api ^8.1.5` 列为 peer，需在 devDependencies 显式补上；
- npm 退出码会被管道（`| tail`）掩盖，判断安装成败要以 `node -e "require('<pkg>/package.json').version"` 实测为准。

**② electron-vite 三段式配置**（`electron.vite.config.ts`）

- main / preload 两段用 `externalizeDepsPlugin()`（Node 依赖外置，不打进 bundle）；
- renderer 段挂 `@vitejs/plugin-vue`；
- 三段统一注册路径别名：`@shared → src/shared`（三端共用），`@main`（主进程内部）、`@ → src/renderer`。

**③ TypeScript 双工程**（解决主/渲染类型环境不同的问题）

- `tsconfig.node.json`：主进程 + preload + shared，lib 仅 ES2022（无 DOM），供 `tsc --noEmit` 校验；
- `tsconfig.web.json`：renderer + shared，lib 含 DOM、`jsx: preserve`，供 `vue-tsc --noEmit` 校验；
- 根 `tsconfig.json` 仅做 references 聚合，`npm run typecheck` 串行跑两工程。

**④ 样式与测试基建**

- Tailwind 4（CSS-first：`@import "tailwindcss"` + `@theme inline` 引用 CSS variables 主题 token，`@tailwindcss/postcss` 接入 PostCSS；v4 自带前缀处理，不需要 autoprefixer；深浅色默认跟随系统 `prefers-color-scheme`）；
- `vitest.config.ts`：只收 `tests/**/*.test.ts`，复用 `@shared` 别名，environment 用 node（被测对象均为纯逻辑：md 序列化规则、涂鸦 Schema 编解码）。

**⑤ 源码骨架按第 6 章目录结构创建**：`src/main`（入口 + services）、`src/preload`、`src/shared`、`src/renderer`（components / stores / editor / doodle / styles）。

> 后续如需重建，按上述 ①→⑤ 顺序执行即可；依赖版本以仓库 `package.json` 为准，不追求与本文档中的版本基线逐字一致。

---

## 7. 技术风险与应对

| # | 风险 | 影响 | 应对 |
| --- | --- | --- | --- |
| 7.1 | **md 往返一致性**：md → WYSIWYG → md 后格式漂移（缩进、列表空行、HTML 合并差异） | 保存后文件 diff 噪音、用户内容意外变化 | 建立固定样例集（标题/表格/嵌套列表/扩展格式/代码块）做开发期自验脚本（vitest 断言二次序列化稳定）；规则上「能保真则保真」，未识别语法在解析时以原始文本块保留 |
| 7.2 | `Ctrl+Shift+Q` 全局占用率高（部分输入法/工具） | 唤醒不可用 | 注册失败检测 + 托盘降级入口 + 设置改键（P2 前可用 `settings.json` 手改） |
| 7.3 | 无边框窗口边缘缩放手感差（drag 区吞掉热区） | 交互体验 | 保留 8px 边缘 `no-drag` + Electron 原生 resizable；不达预期再上 `WM_NCHITTEST` 消息处理 |
| 7.4 | 全屏独占应用（全屏游戏/视频）下置顶失效 | 钉住承诺打折 | 已知限制写入文档；screen-saver 级别已尽量覆盖非独占全屏 |
| 7.9 | **WSLg 开发环境下置顶不可验证**：X11 层 alwaysOnTop 状态不传导到 Windows 侧窗口 Z 序，WSLg 窗口对 Windows 原生应用永远是普通层级 | 开发者在 WSL 中误判钉住功能失效 | 钉住/遮挡类用例（TC-M2-01/02 等）必须在 Windows 真机验收；进程内断言（isAlwaysOnTop）仅验证调用生效，不验证显示层 Z 序 |
| 7.5 | 大量标签 × TipTap 实例内存增长 | 常驻内存超目标 | KeepAlive 上限 15 个软提示；超出时 LRU 卸载非活动标签（序列化快照恢复）——设计预留，首版不实现 |
| 7.6 | `fs.watch` 在网络盘/部分目录不可靠 | 外部变更漏报 | 保留「唤起时 mtime 比对」兜底（3.4），不依赖 watch 单点 |
| 7.7 | 未命名文档涂鸦资产迁移时用户取消保存 | 悬挂资产/引用失效 | 迁移失败回滚：保留 pending-assets，文档引用不变，草稿继续持有 |
| 7.8 | Windows 高分屏多显示器缩放差异导致窗口位置错乱 | 窗口跑到不可见区 | window-state 恢复时做工作区可见性校验（3.1） |

---

## 8. 开发里程碑（对齐 PRD 版本规划）

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| M0 骨架（~3d） | electron-vite 工程搭建、无边框窗口、标题栏/托盘、`Ctrl+Shift+Q` toggle、钉住置顶、窗口状态持久化、IPC 骨架与安全基线 | 可唤醒可钉住的面板壳 |
| M1 编辑与文件（~5d） | TipTap 集成、md 序列化规则、表格、纯文本模式、多标签、打开/保存（原子写+另存为）、草稿暂存恢复、`app-file://` 协议 | PRD v0.1 MVP 主体 |
| M2 富文本完整版（~3d） | Underline/TextStyle/Color/FontSize/Highlight、浮动格式栏、清除格式、HTML 内嵌序列化收敛 | M7 完成 |
| M3 涂鸦（~4d） | 覆盖画布与工具条、六种工具、撤销重做、PNG+JSON 落盘、Doodle Node、双击再编辑、未命名文档资产迁移 | M8 完成 |
| M4 收尾（~2d） | 外部变更检测、冲突条、最近文件、深浅主题、托盘菜单补全、打包 NSIS | 可发布安装包 |

依赖关系：M1 是关键路径；涂鸦（M3）依赖 M1 的资产协议与保存流程；富文本扩展格式（M2）与涂鸦（M3）可并行。
