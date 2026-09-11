// 触发 electron 官方 postinstall 下载二进制（默认 GitHub 不通时走 npmmirror 镜像）
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('node_modules/electron/dist/electron')
if (fs.existsSync(dist)) {
  console.log('electron binary already present')
  process.exit(0)
}

const installer = path.resolve('node_modules/electron/install.js')
const env = { ...process.env, ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/' }

const r = spawnSync(process.execPath, [installer], { env, stdio: 'inherit' })
if (r.status !== 0 || !fs.existsSync(dist)) {
  console.error('download failed, trying without mirror...')
  execFileSync(process.execPath, [installer], { stdio: 'inherit' })
}

console.log(fs.existsSync(dist) ? 'ELECTRON-DOWNLOADED' : 'ELECTRON-DOWNLOAD-FAILED')
process.exit(fs.existsSync(dist) ? 0 : 1)
