/** 主题三态（UI-REDESIGN D2）：system 跟随操作系统，手动态覆盖系统值 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

/** 标题栏按钮循环顺序（D4）：system → light → dark → system */
export function nextThemePreference(p: ThemePreference): ThemePreference {
  return p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'
}

/** Settings IPC 白名单校验（sanitizeSettings 用） */
export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system'
}
