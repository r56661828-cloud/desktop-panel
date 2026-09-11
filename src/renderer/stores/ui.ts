import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConfirmResult = 'save' | 'discard' | 'cancel'

export const useUiStore = defineStore('ui', () => {
  // ---- Toast ----
  const toasts = ref<{ id: number; msg: string; type: 'info' | 'error' }[]>([])
  let toastSeq = 0

  function toast(msg: string, type: 'info' | 'error' = 'info'): void {
    const id = ++toastSeq
    toasts.value.push({ id, msg, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 2500)
  }

  // ---- 三选确认（保存 / 不保存 / 取消，PRD FR-9.2 / FR-10.5） ----
  const confirmOpen = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  const confirmThreeWay = ref(true)
  let confirmResolve: ((v: ConfirmResult) => void) | null = null

  function askConfirm(title: string, message: string, threeWay = true): Promise<ConfirmResult> {
    confirmTitle.value = title
    confirmMessage.value = message
    confirmThreeWay.value = threeWay
    confirmOpen.value = true
    return new Promise((resolve) => {
      confirmResolve = resolve
    })
  }

  function answerConfirm(v: ConfirmResult): void {
    if (!confirmOpen.value) return
    confirmOpen.value = false
    confirmResolve?.(v)
    confirmResolve = null
  }

  return { toasts, toast, confirmOpen, confirmTitle, confirmMessage, confirmThreeWay, askConfirm, answerConfirm }
})
