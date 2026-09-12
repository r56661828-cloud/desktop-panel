<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui'

/** 标题栏图标按钮：NTooltip 气泡 + data-testid（E2E 定位） */
defineProps<{
  tooltip: string
  testid: string
  active?: boolean
}>()
</script>

<template>
  <NTooltip trigger="hover" placement="bottom" :show-arrow="false" :style="{ maxWidth: '260px' }">
    <template #trigger>
      <NButton
        quaternary
        size="tiny"
        class="text-panel-text2"
        :class="active ? 'opacity-100 !text-panel-accent' : ''"
        :data-testid="testid"
        @click="$emit('click')"
      >
        <template #icon>
          <slot name="icon" />
        </template>
      </NButton>
    </template>
    {{ tooltip }}
  </NTooltip>
</template>
