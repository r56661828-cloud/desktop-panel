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
