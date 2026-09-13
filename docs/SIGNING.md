# Desktop Panel 发布签名方案（SignPath Foundation 免费签名）

| 项 | 内容 |
| --- | --- |
| 文档版本 | v0.2 |
| 撰写日期 | 2026-09-12（v0.2 更新于 2026-09-13） |
| 适用版本 | v0.1.1（Electron 44 / electron-builder 26.15.3） |
| 结论 | 走开源路线，申请 **SignPath Foundation 免费代码签名**，GitHub 主仓发布 + Gitee 镜像分发 |
| 仓库 | https://github.com/r56661828-cloud/desktop-panel （公开、MIT、默认分支 main） |

---

## 1. 为什么是 SignPath Foundation（选型结论）

| 途径 | 费用 | 前提/限制 | 结论 |
| --- | --- | --- | --- |
| **SignPath Foundation** | **0 元** | 必须开源（OSI 许可证）、源码在 GitHub/GitLab 公开仓库、产物免费分发、项目活跃维护；证书由 Foundation 代持（云端 HSM，私钥不出库），OV 级 | ✅ 采用 |
| Certum「开源开发者」证书 | 约几十欧/年 | 个人证书，本地保管（云卡/SimpleSign） | 备选（若最终不开源） |
| Azure Trusted Signing | ~$9.99/月 | 需组织/企业身份验证，个人开发者难通过 | ❌ |
| 自签名证书 | 0 元 | 仅本机信任，分发无效；未签名 exe 已被 Win11 智能应用控制实测拦截（DEPLOY.md 5.1） | ❌ |

> 免费个人代码签名证书品类已消亡，SignPath Foundation 是目前唯一免费且正规的分发级签名途径（微软官方文档也推荐 OSS 项目使用）。

## 2. 前置条件（SignPath 审核要求 → 我方 checklist）

| 审核要求 | 我方动作 | 状态 |
| --- | --- | --- |
| OSI 认可的开源许可证 | `LICENSE`（GitHub 生成，MIT）+ `package.json` `"license": "MIT"` | ✅ 2026-09-13 |
| 公开源码仓库 | GitHub 公开仓库已建并推送全部历史（提交身份已匿名化：用户名 + noreply 邮箱） | ✅ 2026-09-13 |
| 产物免费分发 | GitHub Releases 免费下载 | ✅ 随 CI 建立（首个 Release v0.1.1） |
| 项目活跃维护 | 提交历史、多个 Release、完善 README（截图/构建说明/changelog）——审核人工看成熟度 | ✅ 持续（7+ 提交、在线更新等功能迭代） |

## 3. 申请步骤

1. 访问 [signpath.org](https://signpath.org/) →「Free Code Signing for Open Source」→ Apply（无需个人身份证明，以仓库为准）；
2. 填写：项目名、GitHub 仓库 URL、许可证、项目描述、下载页（**可直接抄写内容见 3.1**）；
3. 通过审核（数天到数周）后在 [signpath.io](https://signpath.io) 获得 **Organization**（证书由 Foundation 代持）；
4. 在 SignPath 建 Project（slug 建议 `desktop-panel`）+ 两条签名策略：`test-policy` / `release-policy`；
5. 建 **CI 用户**并生成 API Token（存 GitHub Secrets）；建议同时安装 **SignPath GitHub App**（Trusted Build：`release-policy` 可绑定"只签来自本仓库 Actions 的构建请求"，token 泄露也无法异地提交）。

### 3.1 申请表抄写内容（以 2026-09-13 实际表单截图为准）

> 字段与提示语来自 signpath.org/apply 实际页面（含必填标记 `*`）。**建议英文填写**；`*` 为必填。

| 表单项 | 必填 | 抄写内容 |
| --- | --- | --- |
| Project Name | * | `Desktop Panel` |
| Repository URL | * | `https://github.com/r56661828-cloud/desktop-panel` |
| Homepage URL | * | `https://github.com/r56661828-cloud/desktop-panel`（提示允许直接用仓库页） |
| Download URL | | `https://github.com/r56661828-cloud/desktop-panel`（⚠️ 要求下载页**必须提及 SignPath Foundation 签名**——README 下载区已含声明，满足要求。用纯 ASCII 的仓库主页链接最稳；中文锚点 `#下载-download` 在浏览器可用，但表单校验对非 ASCII 的行为未知，不冒险） |
| Privacy Policy URL | | `https://github.com/r56661828-cloud/desktop-panel/blob/main/docs/PRIVACY.md`（声明"不收集数据"，见下） |
| Wikipedia URL | | 留空 |
| Tagline | * | `Keyboard-summoned, always-on-top quick note panel for Windows.`（一句英文，会公开显示在 Foundation 网站） |
| Description | * | 见下方粘贴文本（提示要求：短段落、勿列版本特性/依赖） |
| Reputation | * | 见下方粘贴文本（⚠️ 最关键项：需证明项目"被广泛使用或可信"；我们是新项目，采取诚实路线，见说明） |
| Maintainer Type | | 下拉选个人开发者对应项（如 Individual / Independent developer） |
| Build System | | `GitHub Actions` |
| First Name / Last Name | * | `Desktop` / `Panel`（仅 SignPath 内部账号可见，证书主体是 SignPath Foundation + 项目名、不含个人姓名；介意间可填真实拼音，二选一） |
| Email | * | 可收信的真实邮箱（仅 SignPath 可见，审核往来靠邮件） |
| Company Name | | 留空 |
| Primary Discovery Channel | * | 如实选（下拉选项以页面为准，如搜索引擎 / AI 推荐） |
| Please specify the exact source | | 可留空 |
| 复选框 | | ✅ 必勾：Code of Conduct 同意；✅ 必勾：个人数据存储同意；⬜ 营销邮件可勾可不勾 |

**Description 粘贴文本**：

```text
Desktop Panel is a Windows desktop quick-note application: a lightweight
scratchpad panel summoned with a global hotkey that can stay always-on-top,
for capturing thoughts without leaving the current task. Notes are stored
locally as plain files and support Markdown formatting and simple sketching.
It ships as a per-user installer and a portable build, is built automatically
by public CI from the repository source, and is distributed for free via
GitHub Releases.
```

**Reputation 粘贴文本**（新项目的诚实路线——不虚构使用量，展示工程成熟度）：

```text
Desktop Panel is a new project (public repository created 2026-09) and does not
yet have media coverage or third-party articles. Current trust signals:
- Repository: https://github.com/r56661828-cloud/desktop-panel (public, MIT,
  complete commit history since the first commit)
- Engineering maturity: public CI (GitHub Actions) runs typecheck, unit tests
  and Windows builds; every tag produces a published GitHub Release; unit and
  E2E smoke tests are part of the repository; comprehensive docs (PRD,
  technical design, test-case plan, deployment guide, code-signing policy)
- Distribution: free downloads via GitHub Releases (installer + portable zip),
  download statistics visible on the Releases page
The project is under active development, and we request consideration for the
free open-source signing program at this early stage.
```

> **关于 Reputation 的策略说明**：如果希望更有把握，也可以先运营一段时间再申请（攒 star/下载量/写一篇介绍文章），审核主要看这一项。两种都合规，自行权衡。

## 4. CI 发布流水线（GitHub Actions）

**已落地**：`.github/workflows/release.yml` 已随仓库推送（打 tag `v*` 或手动触发 → windows-latest 构建 → typecheck/单测 → 打包 → 无密钥自动跳过签名的占位步 → `--publish always` 发 Release）。下面为设计时骨架，**实际以仓库内 workflow 为准**：

`.github/workflows/release.yml` 骨架：

```yaml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: windows-latest        # NSIS 打包需 Windows；GitHub 托管机免 wine
    permissions:
      contents: write              # 允许创建 Release
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck && npm test
      - run: npm run build
      - run: npx electron-builder --win --publish never   # 签名在 sign 钩子内完成
        env:
          SIGNPATH_API_TOKEN: ${{ secrets.SIGNPATH_API_TOKEN }}
          SIGNPATH_ORGANIZATION_ID: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*.exe
            dist/*.zip
```

说明：GitHub 托管机网络直连，不需要 WSL 里那两个 npmmirror 镜像变量；`npm run dist` 在此环境下 NSIS + zip 一次全出。

## 5. 签名接入（核心）

### 5.1 配置（已对照本地 electron-builder 26.15.3 源码验证）

```jsonc
// package.json 的 build 字段
"win": {
  "icon": "resources/icon.png",
  "signtoolOptions": {
    "sign": "scripts/sign.js",           // 自定义签名入口：函数 | 脚本路径 | 模块名
    "signingHashAlgorithms": ["sha256"]  // ⚠️ 必设：默认 sha1+sha256 会按哈希各调一次钩子
  }
}
```

### 5.2 `scripts/sign.js` 骨架

electron-builder 对**每个待签文件**调用一次本脚本，任务对象含 `path`（待签文件绝对路径）、`name`（productName）、`isNest` 等；签名完成后把结果写到 `task.resultOutputPath`（builder 会用它覆写原文件），或直接覆写 `task.path`。

```js
module.exports = async function sign(task) {
  const { SIGNPATH_API_TOKEN, SIGNPATH_ORGANIZATION_ID } = process.env
  if (!SIGNPATH_API_TOKEN) {
    console.warn('[sign] 未配置 SIGNPATH_API_TOKEN，跳过签名（本地构建）')
    return // 同一份配置本地/CI 通用：本地不出 token 就静默跳过
  }
  // 1) POST https://signpath.io/api/v1/{organizationId}/signing-requests
  //    multipart 上传 task.path，附 projectId / signingPolicySlug / description
  // 2) 轮询请求状态直至 Completed
  // 3) 下载签名产物 → task.resultOutputPath = 本地临时文件路径
  // 字段细节以 docs.signpath.io API 参考为准；亦可改调官方 PowerShell 模块一步到位：
  //   Submit-SigningRequest -OrganizationId <id> -ProjectSlug desktop-panel `
  //     -SigningPolicySlug release-policy -ApiToken $env:SIGNPATH_API_TOKEN `
  //     -InputArtifactPath "<待签文件>" -OutputArtifactPath "<输出文件>" -WaitForCompletion
}
```

### 5.3 签名覆盖面（一个钩子全覆盖的原因）

签名发生在归档/封装之前，以下文件都会流经 sign 钩子：

| 文件 | 说明 |
| --- | --- |
| `Desktop Panel.exe` | 在打进 zip 和 NSIS 之前签 → **绿色版与安装版内的主程序都带签名** |
| `DesktopPanel-Setup-x.y.z.exe` | NSIS 安装包本体 |
| NSIS 卸载器 | electron-builder 在安装包内自动二次签 |

时间戳由 SignPath 侧自动加（RFC 3161），无需本地配置。

> **不推荐**备选的"后置签名"路线（构建完用官方 GitHub Action 单独提交 Setup.exe）：zip 里的主 exe 和卸载器覆盖不到，要补就得解包签名重打包，得不偿失。官方 Action（[SignPath/github-action-submit-signing-request](https://github.com/SignPath/github-action-submit-signing-request)）留作将来需要独立签名步骤时的备件。

## 6. 验证与用户侧效果

- CI 内加验证步：PowerShell `Get-AuthenticodeSignature "<exe>"` 状态应为 `Valid`（或 `signtool verify /pa /all`）；
- 用户侧：右键 exe → 属性 → 数字签名，应看到 SignPath Foundation 签发信息；
- **预期管理**：签名消除"未签名"这一拦截主因（DEPLOY.md 5.1 实测的 SAC 拦截）；但 Foundation 证书是 OV 级（非 EV），新证书初期 SmartScreen 仍可能提示"未知发布者"、SAC 云信誉不足时个别机器仍可能拦——信誉随下载量累积后消失，属正常过程。

## 7. Gitee 镜像分发

1. Gitee 建镜像仓（开源仓需**实名认证 + 人工审核**），源码用仓库镜像/Actions 同步；
2. Release 资产无官方自动镜像通道 → 每次发版**手动（或脚本调 Gitee API）上传同一套签名产物**；
3. README 双语标注：「官方发布以 GitHub Releases 为准，Gitee 为下载镜像」；
4. Gitee 下载的文件同样带 MOTW 标记触发 SmartScreen，签名同样生效。

## 8. 风险与备选

| 风险 | 处理 |
| --- | --- |
| SignPath 审核被拒/超时 | 补成熟度素材（README/截图/changelog/更多 Release）重申；急用则切 Certum 开源证书（付费，`signtoolOptions.certificateFile/certificatePassword` 走原生 signtool，无需自定义脚本） |
| SignPath 云服务不可用 | CI 重试即可；已签产物不受影响。这也是 CI 流水线（阶段 1）先行于签名接入的原因 |
| API Token 泄露 | 存 GitHub Secrets；release-policy 绑定 GitHub App（Trusted Build）后异地提交无效 |
| 双哈希重复签名 | `signingHashAlgorithms: ["sha256"]` 必设（见 5.1） |
| `package.json` 无 `license` 字段 | 开源时补 `"license": "MIT"`（`"private": true` 保留，防误发 npm） |

## 9. 行动清单（按序）

1. ✅ git 首次提交 → 建 GitHub 公开仓库并 push（2026-09-13 完成，含 v0.1.1 UI 重构与在线更新功能；提交身份匿名化）；
2. ✅ `LICENSE`（MIT，GitHub 生成）+ `package.json` 补 `"license": "MIT"` 与 `"repository"` 字段（2026-09-13）；
3. ✅ README 完善（特性列表/构建说明，随仓库推送）；
4. ✅ 推送 tag `v0.1.1` 跑通 Release 流水线（2026-09-13 验证通过：[Release v0.1.1](https://github.com/r56661828-cloud/desktop-panel/releases/tag/v0.1.1) 已含 Setup.exe + blockmap + latest.yml；期间修复两处：electron-updater 打进主进程产物、build.publish.owner 改为实际用户名）；
5. ⏳ **提交 SignPath 申请**——申请材料已全部就绪（前置四项 ✅；表单抄写见 3.1；支撑材料齐备：README 下载区含 SignPath Foundation 声明 ✅、[docs/PRIVACY.md](PRIVACY.md) ✅、[docs/CODE-SIGNING-POLICY.md](CODE-SIGNING-POLICY.md) ✅、CODE_OF_CONDUCT.md ✅）；唯一弱项是 Reputation（新项目无媒体/使用量，3.1 提供了诚实文案，或选择先运营再申请）；
6. ⏳ 授权下来后接 `scripts/sign.js`（见 5.2 骨架）+ 配置 4 个 Secrets（`SIGNPATH_API_TOKEN` / `SIGNPATH_ORGANIZATION_ID` / `SIGNPATH_PROJECT_ID` / `SIGNPATH_SIGNING_POLICY`），把 workflow 占位签名步改为真实签名（半天级），发首个签名版；
7. ⏳ Gitee 镜像仓（源码同步 + Release 产物手动/脚本上传，见第 7 节）。
