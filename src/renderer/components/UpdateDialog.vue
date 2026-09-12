<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useUpdateStore } from '@/stores/update'
import MarkdownView from './MarkdownView.vue'

const update = useUpdateStore()
</script>

<template>
  <!-- 升级确认弹框（TECH-DESIGN-UPDATE §5.2）：说明后果，D1 语义按钮 -->
  <div v-if="update.confirmVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="w-80 rounded-xl border border-panel-border bg-panel-card p-4 shadow-xl">
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
</template>
