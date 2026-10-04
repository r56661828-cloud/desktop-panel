# UI 重构（第二轮）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 应用外壳微交互增强 + 三态主题（深/浅/跟随系统）切换，风格延续「暖纸便签」，零新增运行时依赖。

**Architecture:** `html[data-theme]` 属性驱动两套 CSS 变量（D3）；`shared/theme.ts` 纯函数为解析/循环/校验单点；渲染层 `stores/theme.ts` 持有 preference（持久化在主进程 Settings.theme）并驱动 `data-theme` 与 Naive `darkTheme`；动效全部 CSS transform/opacity + Vue Transition。

**Tech Stack:** Vue 3.5 + Pinia 4 + Tailwind CSS 4 + Naive UI + vitest + playwright-core（E2E）。

**Spec:** [docs/UI-REDESIGN.md](UI-REDESIGN.md)（D1–D8 决策基线，本计划逐条落地）

## Global Constraints

- 零新增 npm 依赖；动画只允许 transform/opacity；`prefers-reduced-motion` 全局降级
- 现有 `data-testid` 全部保留（E2E 冒烟依赖）；热唤醒 ≤200ms 不回退
- 每任务完成后跑 `npm run typecheck && npm test` 保持全绿
- 编辑器正文排版（ProseMirror/prose 样式）不动；涂鸦绘制逻辑不动

---

### Task 1: 主题纯函数 + 单测（TDD）

**Files:**
- Create: `src/shared/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces: `ThemePreference = 'light'|'dark'|'system'`；`ResolvedTheme = 'light'|'dark'`；`resolveTheme(preference, systemDark): ResolvedTheme`；`nextThemePreference(p): ThemePreference`（循环 system→light→dark→system）；`isThemePreference(v: unknown): v is ThemePreference`
- Consumes: 无

- [ ] **Step 1: 写失败测试** `tests/theme.test.ts`（导入风格对齐 tests/update-logic.test.ts）

```ts
import { describe, expect, it } from 'vitest'
import { isThemePreference, nextThemePreference, resolveTheme } from '../src/shared/theme'

describe('resolveTheme', () => {
  it('system 跟随操作系统明暗', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('手动态覆盖系统值', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})

describe('nextThemePreference', () => {
  it('循环 system → light → dark → system', () => {
    expect(nextThemePreference('system')).toBe('light')
    expect(nextThemePreference('light')).toBe('dark')
    expect(nextThemePreference('dark')).toBe('system')
  })
})

describe('isThemePreference', () => {
  it('接受三态字符串', () => {
    for (const v of ['light', 'dark', 'system']) expect(isThemePreference(v)).toBe(true)
  })
  it('拒绝非法值', () => {
    for (const v of ['auto', '', 1, null, undefined, {}]) expect(isThemePreference(v)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/shared/theme.ts`

```ts
/** 主题三态（UI-REDESIGN D2）：system 跟随操作系统，手动态覆盖系统值 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

/** 标题栏按钮循环顺序（D4）：system → light → dark → system */
export function nextThemePreference(p: ThemePreference): ThemePreference {
  return p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'
}

/** Settings IPC 白名单校验（sanitizeSettings 用） */
export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system'
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/theme.test.ts`
Expected: 3 个 describe 全 PASS

- [ ] **Step 5: 提交**

```bash
git add src/shared/theme.ts tests/theme.test.ts
git commit -m "feat(ui): 主题三态纯函数 resolveTheme/nextThemePreference/isThemePreference + 单测"
```

---

### Task 2: Settings.theme 持久化字段

**Files:**
- Modify: `src/shared/types.ts`（Settings 接口 L25-33、DEFAULT_SETTINGS L35-43）
- Modify: `src/main/ipc.ts`（sanitizeSettings L150-160）

**Interfaces:**
- Consumes: T1 的 `ThemePreference` / `isThemePreference`
- Produces: `Settings.theme: ThemePreference`（渲染层 T4 经 `window.api.getSettings()` 读取）

- [ ] **Step 1: types.ts 加字段**

文件顶部加 `import type { ThemePreference } from './theme'`；`Settings` 接口内加：

```ts
  theme: ThemePreference // 主题三态（UI-REDESIGN D2）：light/dark/system，默认 system
```

`DEFAULT_SETTINGS` 内加 `theme: 'system'`。

- [ ] **Step 2: ipc.ts 白名单**

`sanitizeSettings` 内加一行（风格对齐现有条目）：

```ts
  if (isThemePreference(patch.theme)) out.theme = patch.theme
```

顶部 import 处加 `import { isThemePreference } from '@shared/theme'`（对齐现有 `@shared/types` 引入方式）。

- [ ] **Step 3: 验证 + 提交**

Run: `npm run typecheck && npm test`
Expected: 全绿

```bash
git add src/shared/types.ts src/main/ipc.ts
git commit -m "feat(settings): Settings.theme 三态字段 + IPC 白名单校验"
```

---

### Task 3: main.css——data-theme 选择器 + 动效 token

**Files:**
- Modify: `src/renderer/styles/main.css`

**Interfaces:**
- Produces: `:root[data-theme='dark']` 变量块；`@custom-variant dark`；`--motion-fast/--motion-base/--motion-ease`；`.ui-anim-fade/.ui-anim-pop/.ui-anim-slide-down`；`pill`/`dialog` Transition 类；`.dialog-card` 换肤过渡；reduced-motion 降级
- Consumes: 无（T4 写 `data-theme` 属性后生效）

- [ ] **Step 1: 选择器改造**

`@plugin` 行之后加：

```css
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));
```

把 `@media (prefers-color-scheme: dark) { :root { … } }` 整块改为 `:root[data-theme='dark'] { … }`（变量值不动，只换选择器；`:root` 浅色块保持不动）。

- [ ] **Step 2: 文件末尾追加动效区**

```css
/* ---- 动效 token 与共享动画（UI-REDESIGN D6）：全部 transform/opacity ---- */
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);
}

/* 换肤过渡：颜色属性在使用处过渡 */
.drag-region,
.editor-card,
.dialog-card {
  transition:
    background-color var(--motion-base) ease,
    border-color var(--motion-base) ease,
    color var(--motion-base) ease;
}

/* 编辑卡片聚焦微反馈（仅边框色） */
.editor-card:focus-within {
  border-color: color-mix(in srgb, var(--panel-accent) 45%, var(--panel-border));
}

@keyframes ui-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ui-pop-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes ui-slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ui-anim-fade { animation: ui-fade-in var(--motion-fast) var(--motion-ease); }
.ui-anim-pop { animation: ui-pop-in var(--motion-fast) var(--motion-ease); }
.ui-anim-slide-down { animation: ui-slide-down var(--motion-base) var(--motion-ease); }

/* Vue Transition：更新 pill（enter+leave 对称） */
.pill-enter-active,
.pill-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease), transform var(--motion-base) var(--motion-ease);
}
.pill-enter-from,
.pill-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* Vue Transition：弹框遮罩淡入 + 卡片弹入 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-active .dialog-card {
  transition: opacity var(--motion-base) var(--motion-ease), transform var(--motion-base) var(--motion-ease);
}
.dialog-enter-from .dialog-card {
  opacity: 0;
  transform: scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 3: 验证 + 提交**

Run: `npm run build`
Expected: 构建成功（CSS 编译无错）

```bash
git add src/renderer/styles/main.css
git commit -m "feat(ui): data-theme 选择器 + dark 变体 + 动效 token/共享动画/reduced-motion"
```

---

### Task 4: 渲染层主题 store + App.vue 接线

**Files:**
- Create: `src/renderer/stores/theme.ts`
- Modify: `src/renderer/App.vue`

**Interfaces:**
- Consumes: T1 纯函数；T2 `Settings.theme`；`window.api.getSettings/setSettings`（shared/api.ts L35-36）
- Produces: `useThemeStore()`：`preference: Ref<ThemePreference>`、`resolved: ComputedRef<ResolvedTheme>`、`init(): Promise<void>`、`cycle(): Promise<void>`（T5 TitleBar 消费）

- [ ] **Step 1: 创建 stores/theme.ts**

```ts
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { nextThemePreference, resolveTheme, type ResolvedTheme, type ThemePreference } from '@shared/theme'
import { useUiStore } from './ui'

/**
 * 主题状态（UI-REDESIGN §3）：preference 持久化在主进程 Settings.theme；
 * resolved 驱动 <html data-theme>（CSS 变量换肤，D3）与 Naive darkTheme（App.vue 消费）。
 */
export const useThemeStore = defineStore('theme', () => {
  const ui = useUiStore()
  const preference = ref<ThemePreference>('system')
  const systemDark = ref(false)

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = darkQuery.matches
  darkQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
  })

  const resolved = computed<ResolvedTheme>(() => resolveTheme(preference.value, systemDark.value))

  function applyToDom(): void {
    document.documentElement.dataset.theme = resolved.value
  }

  async function init(): Promise<void> {
    try {
      const s = await window.api.getSettings()
      preference.value = s.theme
    } catch {
      // 主进程未就绪：保持 system 默认
    }
    applyToDom()
    watch(resolved, applyToDom)
  }

  /** 标题栏按钮（D4）：循环三态 + toast + 持久化（D5） */
  async function cycle(): Promise<void> {
    const next = nextThemePreference(preference.value)
    preference.value = next
    applyToDom()
    const label = next === 'system' ? '跟随系统' : next === 'light' ? '浅色' : '深色'
    ui.toast(`主题：${label}`)
    try {
      await window.api.setSettings({ theme: next })
    } catch (e) {
      ui.toast('主题保存失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return { preference, resolved, init, cycle }
})
```

- [ ] **Step 2: App.vue 改接线**

`<script setup>` 替换为（themeOverrides 块原样保留，删除本地 `darkQuery/isDark/naiveTheme` 三行）：

```ts
import { computed, onMounted } from 'vue'
import { darkTheme, NConfigProvider, NDialogProvider, NMessageProvider, type GlobalThemeOverrides } from 'naive-ui'
import AppShell from './AppShell.vue'
import { useThemeStore } from './stores/theme'

// Naive UI 主题与 CSS 变量共享同一套暖纸色板（UI-PLAN §3）
const overrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#f59e0b',
    primaryColorHover: '#f59e0b',
    primaryColorPressed: '#d97706',
    primaryColorSuppl: '#d97706',
    borderRadius: '8px'
  }
}

const theme = useThemeStore()
const naiveTheme = computed(() => (theme.resolved === 'dark' ? darkTheme : null))
onMounted(() => void theme.init())
```

模板不动。

- [ ] **Step 3: 验证 + 提交**

Run: `npm run typecheck && npm test`
Expected: 全绿

```bash
git add src/renderer/stores/theme.ts src/renderer/App.vue
git commit -m "feat(ui): 主题 store（Settings 持久化 + data-theme 驱动）+ App.vue 接线"
```

---

### Task 5: TitleBar 主题切换按钮

**Files:**
- Modify: `src/renderer/components/TitleBar.vue`

**Interfaces:**
- Consumes: T4 `useThemeStore()`（`preference`/`cycle`）；lucide `Monitor/Sun/Moon`
- Produces: `data-testid="theme-btn"`（T8 E2E 消费）

- [ ] **Step 1: script 部分**

import 行追加：`Monitor, Moon, Sun`（加入 `@lucide/vue` 现有导入）；`import { computed } from 'vue'`（现有 `onMounted, ref` 同行补）；`import { useThemeStore } from '@/stores/theme'`。
加：

```ts
const theme = useThemeStore()
const themeLabel = computed(() => (theme.preference === 'system' ? '跟随系统' : theme.preference === 'light' ? '浅色' : '深色'))
```

- [ ] **Step 2: 模板插入**（放在「保存」按钮之后、分隔竖线 `<span class="mx-1 h-4 w-px bg-panel-border" />` 之前）

```vue
      <TitleBarIcon :tooltip="`主题：${themeLabel} · 点击切换`" testid="theme-btn" @click="theme.cycle()">
        <template #icon>
          <Monitor v-if="theme.preference === 'system'" :size="15" />
          <Sun v-else-if="theme.preference === 'light'" :size="15" />
          <Moon v-else :size="15" />
        </template>
      </TitleBarIcon>
```

- [ ] **Step 3: 验证 + 提交**

Run: `npm run typecheck && npm test`
Expected: 全绿

```bash
git add src/renderer/components/TitleBar.vue
git commit -m "feat(ui): 标题栏主题三态切换按钮（theme-btn）"
```

---

### Task 6: 微交互模板层（按压/过渡/进出场）

**Files:**
- Modify: `src/renderer/components/TitleBarIcon.vue`
- Modify: `src/renderer/components/TabBar.vue`
- Modify: `src/renderer/components/TitleBar.vue`（更新 pill）
- Modify: `src/renderer/editor/TipTapEditor.vue`（浮动工具栏）
- Modify: `src/renderer/components/EditorArea.vue`（冲突条）

**Interfaces:**
- Consumes: T3 的 `.ui-anim-*`、`pill` Transition 类
- Produces: 无新接口

- [ ] **Step 1: TitleBarIcon.vue**——NButton 的 class 属性由 `'text-panel-text2'` 改为 `'text-panel-text2 transition-transform active:scale-90'`（其余不动）

- [ ] **Step 2: TabBar.vue**
- 根 div class 末尾加 `transition-colors`（换肤过渡）
- 标签 div 的静态 class `group relative flex …` 末尾加 `transition-colors`；关闭按钮 class 末尾加 `transition-colors`
- 激活指示条 span（`v-if="tab.id === tabs.activeId"` 那个）class 末尾加 `ui-anim-fade`

- [ ] **Step 3: TitleBar.vue 更新 pill**——把现有 `v-if="update.buttonLabel"` 的 button 完整包进 Transition（button 内部属性/内容逐字保留）：

```vue
      <Transition name="pill">
        <!-- 在线更新入口（TECH-DESIGN-UPDATE §5.1）：仅 downloaded 可点击弹确认框 -->
        <button
          v-if="update.buttonLabel"
          class="rounded-full px-2.5 py-1 text-xs font-medium"
          :class="
            update.buttonClickable
              ? 'bg-panel-accent text-white hover:opacity-90'
              : 'cursor-default bg-panel-bg2 text-panel-text2'
          "
          :data-testid="update.buttonClickable ? 'update-btn' : 'update-progress'"
          @click="update.openConfirm()"
        >
          {{ update.buttonLabel }}
        </button>
      </Transition>
```

- [ ] **Step 4: TipTapEditor.vue 浮动工具栏**——`v-if="toolbarVisible"` 的工具栏 div 的 class 末尾加 `ui-anim-pop`（无需 Transition 包裹，挂载即播进入动画）

- [ ] **Step 5: EditorArea.vue 冲突条**——`v-if="tabs.activeTab?.conflict"` 的 div 的 class 末尾加 `ui-anim-slide-down`

- [ ] **Step 6: 验证 + 提交**

Run: `npm run typecheck && npm test && npm run build`
Expected: 全绿、构建成功

```bash
git add src/renderer/components/TitleBarIcon.vue src/renderer/components/TabBar.vue src/renderer/components/TitleBar.vue src/renderer/editor/TipTapEditor.vue src/renderer/components/EditorArea.vue
git commit -m "feat(ui): 微交互——按压反馈/标签过渡/pill 与工具栏进出场/冲突条滑入"
```

---

### Task 7: UpdateDialog 统一 + 涂鸦工具条反馈

**Files:**
- Modify: `src/renderer/components/UpdateDialog.vue`
- Modify: `src/renderer/doodle/DoodleLayer.vue`

**Interfaces:**
- Consumes: T3 的 `dialog` Transition 类与 `.dialog-card`
- Produces: 无新接口

- [ ] **Step 1: UpdateDialog.vue**——模板整体替换为（内部说明区/按钮不动）：

```vue
<template>
  <!-- 升级确认弹框（TECH-DESIGN-UPDATE §5.2 / UI-REDESIGN §5）：统一 token + 进出动画 -->
  <Transition name="dialog">
    <div v-if="update.confirmVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div class="dialog-card w-80 rounded-xl border border-panel-border bg-panel-card p-4 shadow-xl">
        <div class="mb-1 text-sm font-semibold text-panel-text">
          升级到 v{{ update.state.version }}
        </div>
        <MarkdownView :md="update.state.releaseNotes || `# v${update.state.version}\n\n详见发布页 Release Notes。`" class="mb-2" />
        <div class="mb-4 rounded-md bg-panel-bg2 p-2 text-xs leading-5 text-panel-text2">
          应用将关闭并自动完成安装（约十几秒），完成后自动重启。<br />
          未保存的内容已存入草稿，重启后自动恢复。
        </div>
        <div class="flex justify-end gap-2">
          <NButton size="tiny" quaternary data-testid="update-decline" @click="update.decline()">暂不</NButton>
          <NButton size="tiny" type="primary" data-testid="update-install" @click="update.install()">立即升级</NButton>
        </div>
      </div>
    </div>
  </Transition>
</template>
```

- [ ] **Step 2: DoodleLayer.vue 工具条**（token 已对齐，仅补反馈，逐处改 class）：
- 工具按钮（v-for TOOLS）：静态 class `flex items-center justify-center rounded p-1 text-panel-text2` → 末尾加 `transition-transform active:scale-90`
- 颜色圆点（v-for COLORS）：class `h-4 w-4 cursor-pointer rounded-full border border-panel-border` → 末尾加 `transition-transform hover:scale-110`
- 粗细按钮（v-for SIZES）：静态 class `rounded px-1.5 py-0.5 text-xs` → 末尾加 `transition-colors`
- 撤销/重做两按钮：class 末尾各加 `transition-colors`
- 画布、绘制逻辑、NButton 完成/取消不动

- [ ] **Step 3: 验证 + 提交**

Run: `npm run typecheck && npm test && npm run build`
Expected: 全绿

```bash
git add src/renderer/components/UpdateDialog.vue src/renderer/doodle/DoodleLayer.vue
git commit -m "feat(ui): UpdateDialog 纳入统一弹框动效 + 涂鸦工具条按压/hover 反馈"
```

---

### Task 8: E2E 冒烟增补 + 文档 + 全量验证

**Files:**
- Modify: `tests/e2e/smoke.mjs`（「更新守卫」断言之后插入）
- Modify: `docs/TEST-CASES.md`（末尾追加）

**Interfaces:**
- Consumes: T5 的 `theme-btn` testid；T4 的 `data-theme` 落属性；T2 的 settings.json 持久化
- Produces: 无

- [ ] **Step 1: smoke.mjs 插入主题断言**（更新守卫断言之后、「未钉住时普通层级」之前；`clickButton` 辅助函数复用）

```js
  // 主题三态切换（UI-REDESIGN）：默认 system 已解析为确定值；点击循环 system → light → dark
  const theme0 = await win.evaluate(() => document.documentElement.dataset.theme)
  ok(theme0 === 'light' || theme0 === 'dark', `主题初始解析生效（data-theme=${theme0}）`)
  await clickButton('theme-btn')
  const theme1 = await win.evaluate(() => document.documentElement.dataset.theme)
  ok(theme1 === 'light', '主题循环：system → light')
  await clickButton('theme-btn')
  const theme2 = await win.evaluate(() => document.documentElement.dataset.theme)
  ok(theme2 === 'dark', '主题循环：light → dark')
  const settingsText = ['desktop-panel', 'Electron']
    .map((n) => {
      try {
        return fs.readFileSync(path.join(os.homedir(), '.config', n, 'settings.json'), 'utf-8')
      } catch {
        return ''
      }
    })
    .join('')
  ok(settingsText.includes('"theme": "dark"'), '主题偏好持久化 settings.json')
```

- [ ] **Step 2: TEST-CASES.md 末尾追加**

```md
## UI 二轮（UI-REDESIGN）视觉验收增补

| # | 验收点 | 方法 |
| --- | --- | --- |
| TC-UI2-01 | 三态切换即时生效 + toast 提示 | 手动：点击标题栏主题按钮循环三态 |
| TC-UI2-02 | 重启后主题保持 | 手动：dark 下重启应用 |
| TC-UI2-03 | system 态随 OS 明暗实时切换 | 手动：切换操作系统主题观察跟随 |
| TC-UI2-04 | 深/浅对比度（正文/次级/边框/主色） | 手动目检两态 |
| TC-UI2-05 | reduced-motion 下动画全关 | 系统开启「减少动态效果」后目检 |
| TC-UI2-06 | 热唤醒 ≤200ms 不回退 | 手动：Ctrl+Shift+Q 唤醒体感/计时 |
```

- [ ] **Step 3: 全量验证**

Run: `npm run typecheck && npm test && npm run build`
Expected: 全绿

Run: `node tests/e2e/smoke.mjs`（需 X11/WSLg 显示；无显示环境先试 `xvfb-run -a node tests/e2e/smoke.mjs`，仍不可行则记录为手动验证项）
Expected: 全部 ✓（含 4 条新增主题断言），末行 `E2E SMOKE: ALL PASS`

- [ ] **Step 4: 提交**

```bash
git add tests/e2e/smoke.mjs docs/TEST-CASES.md
git commit -m "test(ui): E2E 冒烟补主题三态断言；TEST-CASES 增补 UI 二轮视觉验收"
```

---

## 执行交接

任务依赖：T1 → T2；T3 独立；T4 ← T1+T2；T5 ← T4；T6 ← T3；T7 ← T3；T8 ← 全部。

**Plan complete and saved to `docs/UI-REDESIGN-PLAN.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每个任务派一个全新 subagent 实施，任务间由主会话审查 diff + 跑门禁
**2. Inline Execution** — 本会话内按 executing-plans 批量执行、检查点停留

按 router 委派规则（源码写入默认委派），本计划落地时采用 Subagent-Driven。
