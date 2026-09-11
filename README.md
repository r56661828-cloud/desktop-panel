# Desktop Panel

快捷键唤醒、可钉住置顶的 Windows 桌面速记面板（Electron）。支持 Markdown / 纯文本编辑、多标签、富文本格式化与可再编辑涂鸦。

## 文档

| 文档 | 说明 |
| --- | --- |
| [PRD](docs/PRD.md) | 产品需求 v0.2：功能模块（M1–M10）、决策记录（D1–D6） |
| [技术方案](docs/TECH-DESIGN.md) | 技术选型与版本策略、进程架构、核心模块设计、IPC 契约、脚手架步骤 |
| [测试用例方案](docs/TEST-CASES.md) | 测试分层策略、功能用例、可靠性/性能/兼容性专项、冒烟集 |

## 核心特性

- `Ctrl+Q` 全局快捷键唤醒/收起面板
- 钉住 = 始终置顶（Alt+Tab 切换应用后仍最前）；未钉住 = 普通窗口层级
- Markdown 所见即所得（含表格），扩展格式以内嵌 HTML 落盘；纯文本模式
- 单窗口多标签，独立保存与脏标记
- 富文本：加粗/斜体/下划线/删除线/字号/颜色
- 涂鸦（曲线/直线/箭头/矩形/圆）：PNG + 矢量 JSON 双文件落盘，双击可再编辑
- 草稿自动暂存与崩溃恢复，原子写盘

## 技术栈

Electron 44 · Vue 3.5 + TypeScript · electron-vite 5 · Vite 7 · Pinia 4 · Tailwind CSS 4 · TipTap 3（ProseMirror）

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
