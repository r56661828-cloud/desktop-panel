import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DoodleAttrs {
  src: string
  dataSrc: string
  width: number | null
}

/** 涂鸦会话状态：create = 新插图（插入当前光标处）；edit = 双击已有涂鸦再编辑 */
export const useDoodleStore = defineStore('doodle', () => {
  const active = ref(false)
  const mode = ref<'create' | 'edit'>('create')
  const editAttrs = ref<DoodleAttrs | null>(null)
  const editPos = ref<number | null>(null)

  function startCreate(): void {
    mode.value = 'create'
    editAttrs.value = null
    editPos.value = null
    active.value = true
  }

  function startEdit(attrs: DoodleAttrs, pos: number): void {
    mode.value = 'edit'
    editAttrs.value = attrs
    editPos.value = pos
    active.value = true
  }

  function close(): void {
    active.value = false
    editAttrs.value = null
    editPos.value = null
  }

  return { active, mode, editAttrs, editPos, startCreate, startEdit, close }
})
