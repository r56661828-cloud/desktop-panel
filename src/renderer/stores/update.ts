import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UpdateState } from '@shared/types'
import { useTabsStore } from './tabs'
import { useUiStore } from './ui'

/**
 * 更新状态（TECH-DESIGN-UPDATE §5）：主进程推送全量状态，
 * 标题栏按钮按 phase 呈现；确认框交互（立即升级/暂不）落 D1 语义。
 */
export const useUpdateStore = defineStore('update', () => {
  const ui = useUiStore()

  const state = ref<UpdateState>({ phase: 'idle' })
  const confirmVisible = ref(false)
  let lastManual = false

  function applyState(s: UpdateState): void {
    state.value = s
    if (s.error && lastManual) {
      ui.toast('检查更新失败：' + s.error, 'error')
    }
  }

  async function check(manual: boolean): Promise<void> {
    lastManual = manual
    try {
      applyState(await window.api.checkForUpdates(manual))
    } catch (e) {
      if (manual) ui.toast('检查更新失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  async function init(): Promise<void> {
    try {
      state.value = await window.api.getUpdateState()
    } catch {
      // 主进程未就绪保持 idle
    }
  }

  const buttonLabel = computed<string | null>(() => {
    const s = state.value
    if (s.phase === 'downloaded') return `更新 v${s.version ?? ''}`
    if (s.phase === 'downloading') return `↓ ${Math.round(s.percent ?? 0)}%`
    if (s.phase === 'available') return `发现 v${s.version ?? ''}`
    if (s.phase === 'installing') return '安装中…'
    return null
  })

  const buttonClickable = computed(() => state.value.phase === 'downloaded')

  function openConfirm(): void {
    if (state.value.phase !== 'downloaded') return
    confirmVisible.value = true
  }

  function closeConfirm(): void {
    confirmVisible.value = false
  }

  async function install(): Promise<void> {
    const version = state.value.version
    if (!version) return
    const tabs = useTabsStore()
    try {
      await tabs.flushDrafts() // 安装前确保草稿落盘（§3.3 时序）
      closeConfirm()
      state.value = { phase: 'installing', version }
      await window.api.installUpdate(version)
      // 安装器会退出并重启应用，正常不会走到这里
    } catch (e) {
      ui.toast('启动升级失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  async function decline(): Promise<void> {
    const version = state.value.version
    closeConfirm()
    if (!version) return
    try {
      state.value = await window.api.declineUpdate(version)
      ui.toast('已跳过该版本，可随时在托盘菜单手动检查更新')
    } catch (e) {
      ui.toast('操作失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  return { state, confirmVisible, buttonLabel, buttonClickable, check, init, applyState, openConfirm, closeConfirm, install, decline }
})
