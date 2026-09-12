<script setup lang="ts">
import { computed, ref } from 'vue'
import { darkTheme, NConfigProvider, NDialogProvider, NMessageProvider, type GlobalThemeOverrides } from 'naive-ui'
import AppShell from './AppShell.vue'

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

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const isDark = ref(darkQuery.matches)
darkQuery.addEventListener('change', (e) => {
  isDark.value = e.matches
})
const naiveTheme = computed(() => (isDark.value ? darkTheme : null))
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
