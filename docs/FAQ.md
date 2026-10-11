# FAQ — 常见问题与环境排障

> 来源：2026-10-11 新设备环境排查实录。适用 electron 44 / npm 10.x / Windows + WSL 双端开发。
> 所有修复均已进仓库：`.npmrc`（二进制镜像）+ `package.json` 的 `postinstall`（装包即补装 electron 二进制）。

## 快速结论（TL;DR）

新设备克隆后的标准流程就是三步，**无需任何手动配置**：

```powershell
git clone <仓库地址>
npm install        # postinstall 自动从 npmmirror 补装 electron 二进制（约 120MB，期间无输出）
npm run dev
```

如果卡住或报错，按下面对照排查。

---

## Q1：`npm run dev` 报 `Error: Electron uninstall`（最常见）

**报错位置**：`electron-vite/dist/chunks/*.js` 的 `getElectronPath`。

**根因链**（三层叠加，缺一不触发）：

1. electron 44 **移除了 postinstall**：`npm install` 成功 ≠ 二进制已下载，包壳（wrapper）先装上，二进制推迟到首次 `require('electron')` 时懒加载下载；
2. 懒下载默认源是 `github.com/electron/electron/releases`，国内网络不可达；
3. electron-vite 的 `getElectronPath` **只读 `path.txt`、缺失即抛错，永远不会触发懒下载**——懒下载只在 `require('electron')` 时发生，而 electron-vite 恰好绕过了它。

**修复**（已进仓库，`git pull` 后 `npm install` 即自愈）：

- `.npmrc` 提供 `electron_mirror` → npm 运行脚本时导出为 `npm_config_electron_mirror`，@electron/get 读取；
- `package.json` 的 `postinstall` 调 electron 自带安装脚本，装包即下载二进制（脚本自带 isInstalled 幂等检查，重复安装零开销）。

**临时手动修复**（不 pull 时）：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
node node_modules\electron\install.js    # 下载约 120MB 期间没有任何输出，安静 1-2 分钟属正常
npm run dev
```

## Q2：`npm config set electron_mirror ...` 报 `not a valid npm option`

npm 10.9.8 即拒绝该键（并非 npm 11.2.0 才开始严格校验），**直接编辑 `.npmrc` 文件不受影响**——npm 会把 `.npmrc` 里的未知键导出为 `npm_config_*` 环境变量传给脚本，electron 的下载器正是读这个变量。

## Q3：`npm ci` 显示 `added 533 packages` 但 `npm ls electron` 是 `(empty)`

**实测记录**（npm 10.9.7 / Windows 11）：全新 `npm ci` 精确跳过 electron 及其依赖共 5 个包；`omit`/`cpu`/`os`/`libc` 配置全干净、锁文件条目正常、无 optional 标记，根因未定位。

**解法**：点名安装绕过 npm 的依赖树解析：

```powershell
npm install electron@44.2.0 --save-exact
git checkout -- package.json package-lock.json   # 撤销 --save-exact 的版本号改动，已装的不受影响
npm ls electron --depth=0                        # 应显示 electron@44.2.0
```

**排查顺序**（如复现）：`npm config ls -l` 看 omit/cpu/os/libc → `npm config get production` → `echo $env:NODE_ENV` → 安全软件白名单 → 升级 npm。

## Q4：首次 `npm run dev` 卡在 `Downloading Electron binary...`

正常现象。二进制约 120MB，走 npmmirror，视网络几十秒到几分钟。**不要中断**，完成后自动进入应用。

## Q5：`npm run dist` 打包时下载 NSIS / winCodeSign 卡住

electron-builder 的工具（NSIS、winCodeSign 等）同样从 GitHub 下载。`.npmrc` 已配 `electron_builder_binaries_mirror`，`git pull` 后重试即可。若仍卡住，设置环境变量：

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist
```

## Q6：快速自检清单（Windows PowerShell）

```powershell
npm ls electron --depth=0                          # 必须显示 electron@44.x
Test-Path node_modules\electron\dist\electron.exe  # 装好二进制后为 True
Test-Path .npmrc                                   # 必须为 True（git pull 后）
npm config get registry                            # 官方源即可，二进制镜像不依赖 registry
```

---

## 附：本仓库的两层修复

| 文件 | 作用 |
| --- | --- |
| `.npmrc` | `electron_mirror` + `electron_builder_binaries_mirror` 指向 npmmirror；故意不写 `registry`，避免公共仓库强推国内 npm 源 |
| `package.json` → `postinstall` | 装包时调 electron 安装脚本补装二进制，恢复 electron 44 之前"install 即可用"的行为 |

对应提交：`.npmrc` `25bbe32`（feat/ui-redesign）/ `c7ec367`（main）；`postinstall` `15244be`（feat/ui-redesign）/ `60aa187`（main）。
