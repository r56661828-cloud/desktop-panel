# Desktop Panel

快捷键唤醒、可钉住置顶的 Windows 桌面速记面板（Electron）。支持 Markdown / 纯文本编辑、多标签、富文本格式化与可再编辑涂鸦。

## 文档

| 文档 | 说明 |
| --- | --- |
| [PRD](docs/PRD.md) | 产品需求 v0.2：功能模块（M1–M10）、决策记录（D1–D6） |
| [技术方案](docs/TECH-DESIGN.md) | 技术选型与版本策略、进程架构、核心模块设计、IPC 契约、脚手架步骤 |
| [测试用例方案](docs/TEST-CASES.md) | 测试分层策略、功能用例、可靠性/性能/兼容性专项、冒烟集 |
| [打包部署](docs/DEPLOY.md) | Windows 产物（zip 绿色版/NSIS 安装包）、镜像加速、部署自检清单、已知限制 |
| [签名与开源发布](docs/SIGNING.md) | SignPath 接入与发布行动清单 |
| [签名政策](docs/CODE-SIGNING-POLICY.md) | 代码签名政策（SignPath.io / SignPath Foundation） |
| [隐私政策](docs/PRIVACY.md) | 数据本地存储、无收集、更新检查的网络访问说明 |
| [行为准则](CODE_OF_CONDUCT.md) | Contributor Covenant v2.1 |
| [在线更新评审](docs/UPDATE-PLAN.md) | 自动更新需求评审、决策记录（Q1–Q4） |
| [在线更新技术方案](docs/TECH-DESIGN-UPDATE.md) | electron-updater 架构、状态机、IPC 契约、CI 与发布流程 |

## 核心特性

- `Ctrl+Shift+Q` 全局快捷键唤醒/收起面板
- 钉住 = 始终置顶（Alt+Tab 切换应用后仍最前）；未钉住 = 普通窗口层级
- Markdown 所见即所得（含表格），扩展格式以内嵌 HTML 落盘；纯文本模式
- 单窗口多标签，独立保存与脏标记
- 富文本：加粗/斜体/下划线/删除线/字号/颜色
- 涂鸦（曲线/直线/箭头/矩形/圆）：PNG + 矢量 JSON 双文件落盘，双击可再编辑
- 草稿自动暂存与崩溃恢复，原子写盘
- 在线更新（安装版）：检查/静默下载/确认升级/更新说明页（见 docs/TECH-DESIGN-UPDATE.md）

## 下载 Download

| 渠道 | 产物 |
| --- | --- |
| [GitHub Releases](https://github.com/r56661828-cloud/desktop-panel/releases) | 安装版 `DesktopPanel-Setup-*.exe`（推荐）· 绿色版 `DesktopPanel-*-x64.zip`（解压即用） |

均由公共 CI（GitHub Actions）从仓库源码自动构建，更新包元数据（`latest.yml`/`.blockmap`）随 Release 发布，供应用内自动更新使用。

> Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org)（免费代码签名由 SignPath Foundation 提供，签名接入进行中）。签名政策见 [docs/CODE-SIGNING-POLICY.md](docs/CODE-SIGNING-POLICY.md)。

## 技术栈

Electron 44 · Vue 3.5 + TypeScript · electron-vite 5 · Vite 7 · Pinia 4 · Tailwind CSS 4 + Naive UI · TipTap 3（ProseMirror）

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（HMR）
npm run typecheck  # 双工程类型检查
npm run test       # 单元测试（md 往返一致性 / 涂鸦 Schema）
npm run build      # 构建
npm run dist       # 打包 NSIS 安装包
```

图标由 `node scripts/gen-icons.mjs` 生成（resources/tray.png、resources/icon.png）。
