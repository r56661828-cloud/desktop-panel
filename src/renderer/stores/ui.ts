import { defineStore } from 'pinia'
import type { MessageApi, DialogApi } from 'naive-ui'

export type ConfirmResult = 'save' | 'discard' | 'cancel'

/**
 * UI 反馈中枢：Naive UI 的 useMessage/useDialog 由 AppShell 注册进来，
 * 对业务层暴露与实现无关的 toast / askConfirm（Promise 三选）接口。
 */
export const useUiStore = defineStore('ui', () => {
  let message: MessageApi | null = null
  let dialog: DialogApi | null = null

  function registerMessageApi(m: MessageApi): void {
    message = m
  }

  function registerDialogApi(d: DialogApi): void {
    dialog = d
  }

  function toast(msg: string, type: 'info' | 'error' = 'info'): void {
    if (!message) {
      console.warn('[toast]', msg)
      return
    }
    message[type === 'error' ? 'error' : 'info'](msg, { duration: 2500, keepAliveOnHover: true })
  }

  /** 三选确认：保存 / 不保存 / 取消（关闭与 Esc = 取消） */
  function askConfirm(title: string, message: string, threeWay = true): Promise<ConfirmResult> {
    if (!dialog) return Promise.resolve('cancel')
    const d = dialog
    return new Promise((resolve) => {
      let settled = false
      const settle = (v: ConfirmResult): void => {
        if (!settled) {
          settled = true
          resolve(v)
        }
      }
      const negativeText = threeWay ? '不保存' : '取消'
      d.warning({
        title,
        content: message,
        positiveText: threeWay ? '保存' : '确定',
        negativeText,
        closable: threeWay,
        maskClosable: threeWay,
        onPositiveClick: () => settle('save'),
        onNegativeClick: () => settle(threeWay ? 'discard' : 'cancel'),
        onClose: () => settle('cancel'),
        onMaskClick: () => settle('cancel'),
        onEsc: () => settle('cancel')
      })
    })
  }

  return { registerMessageApi, registerDialogApi, toast, askConfirm }
})
