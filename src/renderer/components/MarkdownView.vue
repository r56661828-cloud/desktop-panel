<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { buildExtensions } from '@/editor/extensions'

/** 只读 Markdown 渲染（更新说明等），复用编辑器扩展（含 md 解析） */
const props = defineProps<{ md: string }>()

const editor = shallowRef<Editor>()

onMounted(() => {
  editor.value = new Editor({ extensions: buildExtensions(), content: props.md, editable: false })
})

watch(
  () => props.md,
  (v) => editor.value?.commands.setContent(v)
)

onBeforeUnmount(() => {
  editor.value?.destroy()
  editor.value = undefined
})
</script>

<template>
  <EditorContent
    :editor="editor"
    class="md-view max-h-44 overflow-y-auto rounded-md border border-panel-border bg-panel-bg2 text-left text-xs [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-2"
  />
</template>
