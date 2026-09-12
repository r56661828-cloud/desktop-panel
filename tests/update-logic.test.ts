import { describe, expect, it } from 'vitest'
import { isSafeVersion, normalizeReleaseNotes, shouldDownload } from '@shared/update-logic'

/** 更新逻辑纯函数（TECH-DESIGN-UPDATE §3.2 D1 取消语义 / §3.5 changelog 落盘） */
describe('update-logic', () => {
  describe('shouldDownload（D1 取消语义）', () => {
    it('未拒绝的新版本：自动检查也下载', () => {
      expect(shouldDownload('0.2.0', null, false)).toBe(true)
      expect(shouldDownload('0.2.0', '0.1.0', false)).toBe(true)
    })

    it('已拒绝版本：自动检查跳过，手动检查放行（允许改主意）', () => {
      expect(shouldDownload('0.2.0', '0.2.0', false)).toBe(false)
      expect(shouldDownload('0.2.0', '0.2.0', true)).toBe(true)
    })
  })

  describe('normalizeReleaseNotes', () => {
    it('字符串原样返回', () => {
      expect(normalizeReleaseNotes('## Fixes\n- a')).toBe('## Fixes\n- a')
    })

    it('分段数组拼接', () => {
      expect(
        normalizeReleaseNotes([
          { version: '0.1.0', note: 'first' },
          { version: '0.2.0', note: 'second' }
        ])
      ).toBe('first\n\nsecond')
    })

    it('空值返回空串', () => {
      expect(normalizeReleaseNotes(null)).toBe('')
      expect(normalizeReleaseNotes(undefined)).toBe('')
      expect(normalizeReleaseNotes([])).toBe('')
    })
  })

  describe('isSafeVersion（changelog 文件名白名单）', () => {
    it('接受标准语义版本与预发布号', () => {
      expect(isSafeVersion('0.2.0')).toBe(true)
      expect(isSafeVersion('1.10.3-beta.1')).toBe(true)
    })

    it('拒绝路径片段与任意串', () => {
      expect(isSafeVersion('../../etc/passwd')).toBe(false)
      expect(isSafeVersion('0.2.0.md')).toBe(false)
      expect(isSafeVersion('abc')).toBe(false)
      expect(isSafeVersion('')).toBe(false)
    })
  })
})
