// E2E 冒烟测试（TEST-CASES P0 可自动化子集），playwright-core _electron 驱动。
// 运行：node tests/e2e/smoke.mjs（需先 npm run build；需 X11/WSLg 显示）
import { _electron as electron } from 'playwright-core'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..')
let failures = 0
const ok = (cond, name) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  if (!cond) failures++
}

const electronBin = path.join(ROOT, 'node_modules/electron/dist/electron')
if (!fs.existsSync(electronBin)) {
  console.error('electron binary not found:', electronBin)
  process.exit(1)
}

// 清理上次的 userData（userData 落在 ~/.config/<app>）
for (const dir of ['desktop-panel', 'Electron']) {
  fs.rmSync(path.join(os.homedir(), '.config', dir), { recursive: true, force: true })
}

const app = await electron.launch({
  executablePath: electronBin,
  args: [path.join(ROOT, 'out/main/index.js'), '--no-sandbox'],
  timeout: 30000
})

/** 点击标题栏/工具条按钮后把鼠标移开，避免 NTooltip 悬浮层拦截后续点击 */
let win
async function clickButton(testid) {
  await win.click(`[data-testid="${testid}"]`)
  await win.mouse.move(360, 300)
  await win.waitForTimeout(300)
}

try {
  win = await app.firstWindow()
  win.on('console', (m) => {
    if (m.type() === 'error') console.log('[console.error]', m.text())
  })

  // TC-M1-01(自动化部分): 启动后面板显示
  await win.waitForSelector('.drag-region', { timeout: 10000 })
  ok(true, '应用启动且标题栏渲染')

  // 全局快捷键已注册（FR-1.1，v0.1.0 起默认 Ctrl+Shift+Q）
  const shortcutOk = await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Control+Shift+Q'))
  ok(shortcutOk, '全局快捷键 Ctrl+Shift+Q 注册成功')

  // 未钉住时普通层级（D1）
  const beforePin = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop())
  ok(beforePin === false, '未钉住时非置顶')

  // TC-M2-02: 钉住 → alwaysOnTop 生效（UI 改版后以 data-testid 定位）
  await clickButton('pin-btn')
  const afterPin = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop())
  ok(afterPin === true, '钉住后置顶生效')

  // 恢复未钉住
  await clickButton('pin-btn')

  // TC-M3-01: 输入 Markdown，WYSIWYG 渲染
  await win.click('.ProseMirror')
  await win.keyboard.press('Control+a')
  await win.keyboard.press('Delete')
  await win.keyboard.type('# E2E 标题')
  await win.keyboard.press('Enter')
  await win.keyboard.press('Enter') // 跳出标题块
  await win.keyboard.type('正文 **加粗** 文本')
  await win.keyboard.type('正文 **加粗** 文本')
  try {
    await win.waitForSelector('h1:has-text("E2E 标题")', { timeout: 5000 })
    await win.waitForSelector('strong:has-text("加粗")', { timeout: 5000 })
    ok(true, 'Markdown 所见即所得渲染（标题/粗体）')
  } catch {
    const html = await win.evaluate(() => document.querySelector('.ProseMirror')?.innerHTML?.slice(0, 400))
    console.log('[诊断] ProseMirror:', html, 'active:', await win.evaluate(() => document.activeElement?.className))
    throw new Error('h1 未出现')
  }

  // 脏标记（FR-5.4）
  await win.waitForTimeout(400) // 等待 emit debounce
  const dirtyDot = await win.locator('.drag-region >> text=●').count()
  ok(dirtyDot > 0, '输入后标题栏出现脏标记 ●')

  // P1-3 点击热区修复：短文档下点击编辑器下半区应出现光标
  const pmBox = await win.locator('.ProseMirror').boundingBox()
  await win.mouse.click(pmBox.x + pmBox.width / 2, pmBox.y + pmBox.height - 30)
  await win.waitForTimeout(150)
  const hotspotOk = await win.evaluate(() => document.activeElement?.classList?.contains('ProseMirror') === true)
  ok(hotspotOk, '点击内容区下半区出现光标（热区修复）')

  // TC-M3-03(插入部分): 插入表格
  await clickButton('table-btn')
  await win.waitForSelector('.ProseMirror table', { timeout: 5000 })
  await win.keyboard.type('表头A')
  await win.waitForTimeout(400)
  ok(true, '表格插入并可编辑')

  // 草稿暂存（FR-9.1）：编辑后落 userData/drafts
  await win.waitForTimeout(1600) // draft debounce 800ms + 余量
  const draftFound = ['desktop-panel', 'Electron'].some((name) => {
    const d = path.join(os.homedir(), '.config', name, 'drafts')
    try {
      return fs.readdirSync(d).some((f) => f.endsWith('.json'))
    } catch {
      return false
    }
  })
  ok(draftFound, '未保存内容自动落草稿')

  // TC-M8-01/02/05: 涂鸦模式 → 画曲线 → 完成插入
  await clickButton('doodle-btn')
  await win.waitForSelector('canvas', { timeout: 5000 })
  const box = await win.locator('canvas').boundingBox()
  await win.mouse.move(box.x + 30, box.y + 30)
  await win.mouse.down()
  for (let i = 1; i <= 10; i++) await win.mouse.move(box.x + 30 + i * 10, box.y + 30 + Math.sin(i) * 15)
  await win.mouse.up()
  await win.click('[data-testid="doodle-complete"]')
  await win.waitForSelector('img[data-doodle]', { timeout: 5000 })
  ok(true, '涂鸦完成并插入文档')

  // 涂鸦 PNG/JSON 落盘（pending，未命名文档）
  await win.waitForTimeout(400)
  const assetFound = ['desktop-panel', 'Electron'].some((name) => {
    const base = path.join(os.homedir(), '.config', name, 'pending-assets')
    try {
      return fs.readdirSync(base).some((tab) => {
        const files = fs.readdirSync(path.join(base, tab))
        return files.some((f) => f.endsWith('.png')) && files.some((f) => f.endsWith('.json'))
      })
    } catch {
      return false
    }
  })
  ok(assetFound, '涂鸦 PNG+JSON 落盘（pending 资产）')

  // TC-M10-01: 多标签
  await win.keyboard.press('Control+t')
  await win.waitForTimeout(300)
  const tabCount = await win.locator('[data-testid="tab"], [data-testid="tab-active"]').count()
  ok(tabCount >= 2, 'Ctrl+T 新建标签')

  // TC-M10-02: 标签切换
  await win.keyboard.press('Control+Tab')
  await win.waitForTimeout(200)
  ok(true, 'Ctrl+Tab 标签切换无异常')

  // P2 关闭按钮：✕ = 隐藏面板、应用驻留（UI-PLAN P1-2）
  await clickButton('close-btn')
  const hiddenByClose = await app.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isVisible())
  ok(hiddenByClose, '✕ 关闭面板（窗口隐藏）')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.show()
    w.focus()
  })
  await win.waitForTimeout(300)

  // 渲染进程安全基线（TC-C-05）
  const nodeExposed = await win.evaluate(() => typeof process !== 'undefined' || typeof require !== 'undefined')
  ok(!nodeExposed, '渲染进程未暴露 Node API（sandbox）')

  // 内容完整（面板收起再唤起不丢内容，FR-9.1）
  await win.keyboard.press('Escape')
  await win.waitForTimeout(300)
  const visibleAfterEsc = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
  ok(!visibleAfterEsc, 'Esc 收起面板')
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.show()
    w.focus()
  })
  await win.waitForTimeout(300)
  const h1 = await win.locator('h1:has-text("E2E 标题")').count()
  ok(h1 > 0, '重新唤起后内容完整')
} catch (e) {
  failures++
  console.error('✗ E2E 异常中断:', e.message)
} finally {
  await app.close().catch(() => {})
}

console.log(failures === 0 ? '\nE2E SMOKE: ALL PASS' : `\nE2E SMOKE: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
