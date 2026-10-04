import { describe, expect, it } from 'vitest'
import { isThemePreference, nextThemePreference, resolveTheme } from '../src/shared/theme'

describe('resolveTheme', () => {
  it('system 跟随操作系统明暗', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('手动态覆盖系统值', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})

describe('nextThemePreference', () => {
  it('循环 system → light → dark → system', () => {
    expect(nextThemePreference('system')).toBe('light')
    expect(nextThemePreference('light')).toBe('dark')
    expect(nextThemePreference('dark')).toBe('system')
  })
})

describe('isThemePreference', () => {
  it('接受三态字符串', () => {
    for (const v of ['light', 'dark', 'system']) expect(isThemePreference(v)).toBe(true)
  })
  it('拒绝非法值', () => {
    for (const v of ['auto', '', 1, null, undefined, {}]) expect(isThemePreference(v)).toBe(false)
  })
})
