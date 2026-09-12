# Desktop Panel UI 优化方案（第一版）

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 撰写日期 | 2026-09-06 |
| 触发来源 | 首轮真机体验反馈（4 项） |
| 状态 | 待确认后开发 |

---

## 1. 问题清单与根因

| # | 反馈 | 定性 | 根因分析 |
| --- | --- | --- | --- |
| P1 | 页面太简单，没有「便签」的样子，希望引入现代流行的第三方组件库 | 体验升级 | 当前为手写 Tailwind 最简 UI + emoji 图标，无设计语言；无 Tooltip/Dialog/取色器等成套组件（手搓的 ConfirmDialog/Toast 质感不足） |
| P2 | 右上角没有关闭按钮 | 功能缺失 | 标题栏只有「收起（—）」，缺少符合 Windows 惯例的窗口控制组 |
| P3 | 点击内容区只有靠上有光标，下半区无效 | **缺陷** | 编辑器高度链断裂：`EditorContent` 外层容器高度为 auto，`.ProseMirror` 的 `min-height: 100%` 对 auto 高度父级无法解析 → ProseMirror 实际高度只有内容高度，内容区以下的空白不属于编辑器，点击落不到画布上 |
| P4 | Tab 关闭按钮不需要悬浮才出现，应常显 | 交互调整 | TabBar 中关闭按钮用了 `hidden group-hover:inline`，改为常显即可 |

---

## 2. 选型方案（P1）

### 2.1 组件库：Naive UI（推荐）

| 候选 | 结论 | 理由 |
| --- | --- | --- |
| **Naive UI（选定）** | ✅ | Vue 3 原生 + TS 优先；CSS-in-JS 无需额外样式引入，与 Tailwind 4 共存无冲突；自带 **ColorPicker / Tooltip / Popover / Dropdown / Modal / Message** 全套所需组件；树摇后体积小（~200KB gz），对热唤醒 ≤200ms 的性能目标影响可控；深色模式开箱即用，与现有「跟随系统」策略吻合 |
| Element Plus | 备选 | 生态最大、国内最流行，视觉偏企业后台；CSS 变量主题与 Tailwind 共存良好；体积略大 |
| shadcn-vue | 备选 | 视觉最「现代流行」，但为源码拷贝式接入、搭建成本高，且组件面（取色器等）需拼装，交付速度不合适 |

**配套**：

- 图标：`lucide-vue-next`（tree-shakable，线条风与便签定位匹配），替换现有全部 emoji 图标；
- 排版：`@tailwindcss/typography`（`prose` 类），解决 Markdown 正文排版质感（标题层级/代码块/引用/任务列表样式）。

> 版本约束：按技术方案 1.1 的硬性规则，接入时以 `npm view` 实测 latest 并登记进版本清单（当前 latest：naive-ui 2.x、lucide-vue-next 0.5xx、@tailwindcss/typography 0.5.x，均为各库最新 major，符合「不得落后一个大版本」）。

### 2.2 保留自研的部分

- **无边框窗口骨架**（drag 区、窗口控制）仍自绘——组件库不覆盖 frameless 交互；
- **TipTap 编辑器与涂鸦画布**不动——功能层与本次视觉升级正交；
- **浮动格式工具栏**保留现有 `coordsAtPos` 定位逻辑，内部按钮换成 Naive UI 按钮 + Tooltip + ColorPicker（替换原生 `input[type=color]`，跨平台观感统一）。

---

## 3. 视觉设计方向：「暖纸便签」

目标：一眼是「便签」，而非「编辑器窗口」。原则：轻、暖、圆、有层次。

| Token | 现值 | 调整为 | 说明 |
| --- | --- | --- | --- |
| 主色 | `#2563EB`（蓝） | `#F59E0B`（琥珀）系 | 便签经典暖黄；按钮/图钉激活态/脏标记用主色，文字链接保留蓝色系以保证可读性 |
| 亮色背景 | `#FFFFFF` | `#FDFBF7`（纸白）+ 内容区 `#FFFFFF` 卡片 | 模拟纸面，标题栏/标签栏微暖灰 |
| 深色背景 | `#1F2937` | `#1C1917`（stone-900）系 | 暖灰深色，避免冷蓝 |
| 圆角 | 无体系 | 标签/按钮 8px、卡片 12px、工具条 10px | Tailwind 4 `@theme` 统一 radius token |
| 投影 | toast 才有 | 工具条/对话框/活动标签柔和投影（`shadow-sm` 级） | 层次感，避免大阴影显重 |
| 标题栏 | 平铺灰条 | 左侧应用徽标 + 文件名，右侧图标按钮组（hover 有底色反馈） | 图标语义化：图钉/表格/画笔/文件夹/软盘/减号/叉 |
| 编辑区 | 裸 ProseMirror | `prose` 排版 + 顶部 24px 留白 + 内容最大宽度约束（面板宽时不过分拉长行） | 阅读质感 |

深浅色仍跟随系统（`prefers-color-scheme`），Naive UI 主题用 `darkTheme` 同步切换。

---

## 4. 逐项改造方案

### P1-1 组件库接入与主题改造

- 安装 `naive-ui`、`lucide-vue-next`、`@tailwindcss/typography`；按需引入（`NConfigProvider` 包根，注册 `NMessage`/`NDialog` 全局提供者）；
- 暖纸便签主题 token 落到 `styles/main.css` 的 CSS variables + Naive UI `themeOverrides`（两处共享同一套色值）；
- 替换手搓组件：`ToastHost` → `useMessage`，`ConfirmDialog` → `useDialog`（`ui` store 的 `askConfirm` Promise 接口不变，仅换实现，调用方零改动）。

### P1-2 标题栏与窗口控制（对应反馈 2）

- 右侧按钮组改为：`图钉 | 表格 | 涂鸦 | 打开 | 保存 | —（最小化） | ✕（关闭面板）`；
- **✕ 语义 = 隐藏面板、应用驻留托盘**（PRD FR-1.5：面板关闭不退出应用），不是退出进程；托盘菜单「退出」仍是唯一带未保存确认的退出路径；
- — 与 ✕ 均走既有 IPC（`—` 用 `win.minimize()`，✕ 用现有 `win:collapse`）；图标按钮全部接 Naive UI `NTooltip`，图钉 tooltip 文案维持 PRD 3.3 的两态文案。

### P1-3 编辑器点击热区修复（对应反馈 3，缺陷）

- 修复方式（CSS 层，不改功能代码）：
  ```
  .editor-wrap            → flex flex-col
  :deep(.tiptap 外层容器)  → flex: 1（撑满）
  .ProseMirror            → flex: 1; min-height: 100% 保留
  ```
- 使 ProseMirror 高度 = 内容区全高，空白区域点击可落焦点（光标定位到文末）；
- 纯文本 `textarea` 已是 `h-full`，无此问题；
- 验收：空文档/短文档下，点击内容区任意位置（含底部大片空白）均出现光标。

### P1-4 标签栏（对应反馈 4）

- 关闭按钮去掉 `hidden group-hover:inline`，常显（hover 仅做底色反馈）；
- 配合主题：活动标签加顶部主色指示条 + 柔和投影，非活动标签透明底。

### P1-5 浮动工具栏重构

- 结构保留（选区出现时 `coordsAtPos` 定位），内部换 Naive UI 按钮组 + `NTooltip` + `NColorPicker`（字号档位、清除格式保留）；
- 表格上下文按钮组（增删行列）同样接入。

### P1-6 涂鸦工具条样式对齐

- 功能不动，工具条视觉与主题统一（同色板/圆角/投影），画布光标、透明底逻辑保持。

---

## 5. 对既有文档与测试的影响

| 对象 | 影响 |
| --- | --- |
| TECH-DESIGN 1.1 | 「不引入 UI 组件库」决策作废，更新选型表（Naive UI + lucide + typography）与版本清单 |
| E2E 冒烟（tests/e2e/smoke.mjs） | 组件库按钮渲染结构变化，`button[title^=…]` 选择器会失效 → 改造时同步给关键按钮加 `data-testid`，冒烟脚本改用 testid 定位；15 条断言全部保持 |
| 单元测试 | md 往返/涂鸦 Schema 与 UI 无关，不受影响 |
| TEST-CASES | 视觉验收要点新增：✕ 关闭后托盘驻留、tooltip 呈现、空文档点击热区 |

---

## 6. 范围外（本次不做）

- 主题手动切换设置页（仍跟随系统，属 v0.3 设置页范畴）；
- 多套皮肤/颜色自定义；
- 布局结构级改版（标签栏位置、编辑区分栏等）。

## 7. 工作量与验收

- 预估：**1~1.5 人天**（P1-1 主题 0.5d、P1-2/4/5 组件替换 0.5d、P1-3 修复 0.25d、E2E 适配 0.25d）；
- 验收标准：
  1. 四条反馈逐条复验通过（关闭按钮存在且行为=隐藏驻托盘、任意区域点击出光标、tab 关闭常显、整体便签质感）；
  2. `typecheck + 单测 13 条 + E2E 冒烟 15 条` 全绿；
  3. 亮/暗两套模式下无对比度问题；热唤醒 ≤ 200ms 不回退。
