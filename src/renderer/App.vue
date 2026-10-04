<script setup lang="ts">
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
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="overrides" class="h-full">
    <NMessageProvider placement="bottom-right" :duration="2500">
      <NDialogProvider>
        <AppShell />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
