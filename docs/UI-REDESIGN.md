# Desktop Panel UI 重构方案（第二轮）：微交互增强 + 三态主题

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 撰写日期 | 2026-09-20 |
| 前作 | docs/UI-PLAN.md（第一轮：Naive UI 接入 + 暖纸便签主题，已完成） |
| 需求来源 | 点击/画面/弹框元素丰富增强；主题支持深、浅、跟随系统切换（UI-PLAN §6 预留的 v0.3 范畴落地） |
| 状态 | 待评审后进入实施计划 |

---

## 1. 决策基线（已与需求方逐条确认）

| # | 决策 |
| --- | --- |
| D1 | 增强方向：**微交互优先、风格延续**「暖纸便签」——不做视觉语言改版，不动布局结构 |
| D2 | 主题三态：`light` / `dark` / `system`，默认 `system`；现有「跟随系统」行为成为 system 态，行为不回退 |
| D3 | 主题架构：**`data-theme` 属性驱动**——`html[data-theme]` 选择器承载两套 CSS 变量，变量换值即全局换肤；不引入 `.dark` class 策略或 JS 写变量方案 |
| D4 | 切换入口：**标题栏图标按钮**，三态循环 `system → light → dark → system`，单击切换 + toast 提示 |
| D5 | 持久化：主进程 `Settings.theme` 字段（settings.json，与 pinned/shortcut 同级），渲染层经现有 `settings:get` / `settings:set` IPC 读写；为将来托盘菜单同步预留 |
| D6 | 动效预算：全部 CSS transform/opacity + Vue `<Transition>`，合成层完成；统一 motion token；`prefers-reduced-motion` 全局降级；**热唤醒 ≤200ms 不回退，零新增运行时依赖** |
| D7 | 范围：应用外壳（标题栏/标签栏/弹框/浮动格式工具栏）+ 涂鸦工具条视觉对齐；**编辑器正文排版（ProseMirror/prose）本轮不动** |
| D8 | 弹框体系：UpdateDialog 手搓结构保留（内含 MarkdownView 说明区，换 NModal 成本大于收益），纳入统一 token + 进出动画；冲突提示条加滑入动画 |

---

## 2. 主题系统设计（D2/D3）

### 2.1 解析单点

新增纯函数（放 `src/shared/theme.ts`，无 electron/DOM 依赖，vitest 可单测）：

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** 三态解析（UI-REDESIGN D2）：system 跟随操作系统，手动态覆盖系统值 */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}
```

### 2.2 变量与选择器改造（styles/main.css）

- `@media (prefers-color-scheme: dark) { :root { … } }` → `:root[data-theme='dark'] { … }`；现有 `:root` 浅色块保持不动（无 `data-theme` 属性时即浅色保底）
- 唯一 `dark:` 用法（TipTapEditor 的 `dark:prose-invert`）：Tailwind 4 加一行
  `@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));`
- `html[data-theme]` 由渲染层在启动与切换时写入；`matchMedia('(prefers-color-scheme: dark)')` 监听保留，preference ≠ system 时忽略系统变化

### 2.3 Naive UI 同源派生（App.vue）

`resolved` 由 §2.1 函数算出并 `document.documentElement.dataset.theme` 落属性；`naiveTheme = computed(() => resolved === 'dark' ? darkTheme : null)`（现有代码微调，themeOverrides 琥珀色板不变）。

### 2.4 换肤过渡

标题栏/标签栏/编辑卡片/弹框卡片等背景容器加
`transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease`，
换肤时颜色平滑插值不闪跳（CSS 变量本身不可过渡，过渡加在使用处）。

---

## 3. 切换入口与持久化（D4/D5）

- `src/shared/types.ts`：`Settings` 加 `theme: ThemePreference`，`DEFAULT_SETTINGS.theme = 'system'`
- `src/main/ipc.ts` `sanitizeSettings`：白名单加一行（`light|dark|system` 枚举校验）
- `TitleBar.vue`：复用 `TitleBarIcon` 加主题按钮（`data-testid="theme-btn"`）：
  - 图标：lucide `Monitor / Sun / Moon` 对应当前 preference
  - tooltip：「主题：跟随系统 / 浅色 / 深色 · 点击切换」
  - 单击：循环 `system → light → dark → system`，`setSettings({ theme })` 持久化，toast 提示「已切换：深色」等
- 启动时序：App.vue `onMounted` 先 `window.api.getSettings()` 读 theme → 解析 → 落 `data-theme`

---

## 4. 微交互清单（D1/D6，全部 transform/opacity）

统一定义 motion token（main.css）：`--motion-fast: 120ms`、`--motion-base: 180ms`、缓动 `cubic-bezier(0.2, 0, 0, 1)`；`@media (prefers-reduced-motion: reduce)` 全局关闭过渡与动画。

| 元素 | 增强 |
| --- | --- |
| 标题栏图标按钮（TitleBarIcon） | `:active` 按压 `scale(0.9)`，图标颜色 120ms 过渡（hover 底色已有） |
| 标签页（TabBar） | 激活指示条淡入（opacity + 微位移 120ms）；标签 hover 背景、关闭按钮 hover 加深补 120ms 过渡 |
| 更新 pill（TitleBar） | 出现/消失 `<Transition>`（fade + scale 180ms） |
| 浮动格式工具栏（TipTapEditor） | 弹出动画 `scale(0.96)→1` + 淡入 120ms ease-out |
| 冲突提示条（EditorArea） | 顶部滑入 `translateY(-8px)→0` + 淡入 180ms |
| 编辑卡片 | 聚焦时 border-color 160ms 微反馈（仅边框色，克制） |
| 弹框（见 §5） | 遮罩淡入 + 卡片进入动画 |

---

## 5. 弹框体系统一（D8）

- **UpdateDialog**：布局结构不动；圆角/阴影/边框统一 `--panel-*` token；`<Transition>`：遮罩淡入 180ms + 卡片 `scale(0.95)→1` + 淡入；遮罩加 `backdrop-blur-sm`（全案唯一质感点缀，成本极低）
- **冲突提示条**：样式不动，加 §4 滑入动画
- Naive `useMessage`/`useDialog` 自带动效，零改动

---

## 6. 涂鸦工具条对齐（D7）

`DoodleLayer.vue` 工具条的背景/边框/圆角/阴影改用 `--panel-*` 变量，按钮加 hover/按压反馈（与 §4 同 token）；**画布光标、透明底、绘制逻辑、双击再编辑零改动**。

---

## 7. 对既有文档与测试的影响

| 对象 | 影响 |
| --- | --- |
| E2E 冒烟（tests/e2e/smoke.mjs） | 现有 `data-testid` 全部保留不动；新增 `theme-btn` testid，可加 1 条「点击后 `html[data-theme]` 变化」断言（可选） |
| 单元测试 | 新增 `tests/theme.test.ts`：`resolveTheme` 三态/系统值变化；`sanitizeSettings` theme 枚举白名单（若主进程测试未覆盖则并入同文件纯函数测试） |
| 既有单测（md 往返/涂鸦 Schema/update-logic） | 与 UI 无关，不受影响 |
| TEST-CASES | 视觉验收增补：三态切换即时生效、重启后保持、深浅对比度、reduced-motion 降级、动画流畅无掉帧 |
| UI-PLAN §6「主题手动切换属 v0.3」 | 本文档落地该预留项 |
| 性能 | 无新增依赖；动画全部 transform/opacity；热唤醒 ≤200ms 不回退 |

---

## 8. 范围外（本期不做）

- 独立设置页（主题入口仅标题栏按钮；Settings 字段已为将来托盘/设置页同步留好位置）
- 编辑器正文排版调整；多套皮肤/自定义色板
- 托盘主题菜单；Windows 云母/亚克力材质等原生窗口特效

---

## 9. 改动面与工作量预估

| 文件 | 改动 |
| --- | --- |
| `src/shared/theme.ts`（新） | `resolveTheme` 纯函数 + 类型 |
| `src/shared/types.ts` | Settings.theme 字段 |
| `src/main/ipc.ts` | sanitizeSettings 白名单 +1 行 |
| `src/renderer/styles/main.css` | data-theme 选择器、motion token、过渡、reduced-motion |
| `src/renderer/App.vue` | 主题解析接线（读 Settings → data-theme → Naive theme） |
| `src/renderer/components/TitleBar.vue` | 主题按钮 |
| `TitleBarIcon.vue` / `TabBar.vue` / `TipTapEditor.vue` / `EditorArea.vue` / `UpdateDialog.vue` | 模板层 Transition 与按压/过渡类 |
| `src/renderer/doodle/DoodleLayer.vue` | 工具条 token 对齐 |
| `tests/theme.test.ts`（新） | 单测 |

预估 **1.5–2 人天**（主题系统 0.5d、微交互+弹框 0.5–0.75d、涂鸦对齐 0.25d、测试与验收 0.25–0.5d）。

**验收标准**：
1. 三态切换即时生效、toast 提示、重启后保持；system 态随 OS 切换实时响应；
2. `typecheck + 单测 + E2E 冒烟` 全绿；
3. 深/浅两套下对比度无回退（正文/次级文字/边框/主色）；
4. reduced-motion 系统下动画全关；热唤醒 ≤200ms 不回退。
