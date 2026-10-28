# Repo Atlas · 开源知识地图

围绕 **Agent Harness、Agent Memory、Human–Agent Interaction** 收集 GitHub 项目，生成按分支和提交固定的源码学习文档，在静态站点中浏览、收藏和边读边记。数据由 GitHub Actions 定时更新，前端部署到 GitHub Pages。

## 本地启动

需要 Node.js 24 和 Git。项目已附首批真实采集快照，启动前端无需 GitHub Token 或模型密钥。

```powershell
npm ci
npm run dev
```

打开终端显示的本地地址。生产构建使用 `npm run build`，产物在 `dist/`。

## 已实现

- 三个研究方向，仓库网格 / 列表展示，关键词搜索、语言筛选、推荐 / Star / 最近更新排序。
- 真实 GitHub 仓库元数据：Star、语言、许可证、上游更新时间。
- 每个上游分支 / 标签的独立 Markdown 文档，绑定 commit SHA，源码引用不随分支漂移。
- 分支切换、GitHub 版本比较、文档下载、上游和 DeepWiki 入口。
- 阅读状态、收藏、按仓库和分支隔离的 Markdown 笔记，支持编辑和预览。
- 笔记、收藏和阅读状态在浏览器自动保存；JSON 导出 / 导入按 ID 合并，保留较新笔记。
- GitHub Trending 今日 / 本周 / 本月快照，保留独立采集时间和失败时的历史快照。
- 仓库收录配置生成器：下载配置片段，加入配置并提交后自动处理。
- 自动化状态页面，展示采集警告、分支策略和备份操作。
- PR / 功能分支检查，定时采集、增量文档生成、知识库独立分支持久化及 Pages 部署。

## 收录仓库与多分支

编辑 `config/repos.json` 的 `repos` 数组：

```json
{
  "repo": "langchain-ai/deepagents",
  "category": "harness",
  "refs": ["default", "latest-release", "your-feature-branch"],
  "tags": ["Harness", "Planning"],
  "summary": "项目的中文简介。",
  "reason": "具体想从这个项目学习什么。"
}
```

`default` 自动解析默认分支，`latest-release` 解析最新稳定 Release 标签，没有发布时跳过。其他字符串作为真实分支或标签读取，支持包含 `/` 的分支名。类别为 `harness`、`memory`、`interaction`，也可连同 `categories` 扩展。

仓库收录采用人工精选白名单，Trending 仅用于发现，不自动把热门项目变成“优质”项目。网站的收录按钮下载配置，不会从浏览器写入 GitHub。

```powershell
# 有 GitHub Token 时放在当前终端环境变量 GITHUB_TOKEN 中，避免提交到仓库。
npm run collect
# 仅更新一个已配置仓库
node scripts/collect.mjs --repo=mem0ai/mem0
# 忽略增量缓存，重建全部跟踪版本
node scripts/collect.mjs --force
```

每个版本依次读取仓库元数据、解析提交、获取目录树、抽样 README / 包清单 / 源码文件。配置、生成器、模型设置或提交变化时重新生成。文件名包含 ref 的哈希，`feature/a` 和 `feature-a` 不会冲突。

默认限制为每个版本 5 个文件、每文件 10,000 字符。失败的仓库 / 分支保留上次快照；全部选中仓库失败则退出非零，不覆盖已有目录。部分失败会写入 `public/data/status.json` 并显示在自动化页面。

网络不能访问 `raw.githubusercontent.com` 时，自动从 GitHub 公开代码页的 JSON 数据读取原始行，再回退到 Git Blob API。可在本地设置 `$env:SOURCE_TRANSPORT = 'github-page'` 跳过原始域名。原始代码不会执行。

## DeepWiki 风格文档与可选 AI 分析

**没有密钥时**，生成可追溯的源码证据索引：项目定位、实际目录、核心文件和识别到的符号、阅读路线、分类研究问题、实验和来源。文档明确声明抽样覆盖及未验证内容；它不是对全仓架构已经验证的深度结论。

**配置密钥后**，默认使用 **DeepSeek Flash（`deepseek-flash`）**，接口为 `https://api.deepseek.com/chat/completions`。根据采集的源码片段生成中文架构分析、调用链、设计取舍及实验。只在采集进程中使用密钥，浏览器中没有模型凭证。文档会标记为“AI 辅助分析”，仍需人工核实。模型名称和接口依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)。

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 配置：

| 类型     | 名称               | 内容                                             |
| -------- | ------------------ | ------------------------------------------------ |
| Secret   | `DEEPSEEK_API_KEY` | DeepSeek API key，使用默认模型时只需配置这一项   |
| Secret   | `WIKI_API_KEY`     | 可选，兼容已有配置；指定时优先使用此 key         |
| Variable | `WIKI_API_URL`     | 可选，覆盖默认的完整 HTTPS Chat Completions 端点 |
| Variable | `WIKI_MODEL`       | 可选，覆盖默认模型 `deepseek-flash`              |

只配置 `DEEPSEEK_API_KEY` 即可启用默认的 DeepSeek Flash，也支持已有的 `WIKI_API_KEY`。本地采集使用同名环境变量。若覆盖为其他服务的端点，需配置 `WIKI_API_KEY`；`DEEPSEEK_API_KEY` 不会被转发到其他服务。没有密钥时仍生成证据索引。

模型调用失败时回退到证据索引并记录警告，下次采集会重试。目标仓库的公开源码片段会发送给所配置的服务。模型或端点变更会使对应分析缓存失效，密钥不写入数据和缓存标识。付费调用仅在配置密钥后发生。

本站与 DeepWiki 服务没有接口集成或隶属关系。DeepWiki 按钮只是上游仓库的服务链接，是否已被索引以该服务实际页面为准。

## GitHub Actions / Pages 发布

本项目计划发布到 `rinbarpen/github-repo-finder`。首次发布脚本 `scripts/publish.ps1` 会创建公开仓库、推送已经提交的 `main` 和 `dev`、设置默认分支，并启用 GitHub Actions 作为 Pages 的构建来源。脚本复用现有 `gh` 登录和 Git 代理，不写入模型密钥，也不强制覆盖远程分支。

运行脚本前需要完成 GitHub CLI 登录，并确保本地 `main` 和 `dev` 已提交且工作目录干净。可传入 `-DryRun` 只查看操作计划；可用 `-Repository owner/name` 指定其他新仓库。运行脚本后，由 `main` 的首次工作流生成 `knowledge` 分支并部署站点。

将本项目推送到你自己的 GitHub 仓库，生产分支名设为 `main`。在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。需允许工作流写入仓库内容以更新 `knowledge` 分支，部署环境使用 `github-pages`。

工作流在推送 `main`、手动执行以及每天 **北京时间 06:17（UTC 22:17）** 运行。GitHub 定时任务可能延迟，且遵循平台对非活跃仓库的调度规则。

1. 检出 `main`，安装锁定依赖并执行单元测试。
2. 从 `knowledge` 分支恢复上次数据，进行增量采集。
3. 校验数据、固定源码引用与分支文件唯一性，构建前端。
4. 仅将 `public/data/` 和 `public/knowledge/` 写入 `knowledge` 分支，不改写 `main`。
5. 上传 `dist/` 作为 Pages artifact，在独立的最小权限部署任务中发布。

源码、数据和部署相互分离：

| 分支 / 产物    | 用途                                                            |
| -------------- | --------------------------------------------------------------- |
| `main`         | 应用源码、配置、工作流，以及用于首次启动的快照                  |
| `dev`          | 日常开发与集成，检查通过后合并到 `main`                         |
| `feature/*`    | 独立功能开发，经 PR 检查后合并到 `dev` 或 `main`                |
| `knowledge`    | CI 自动创建的知识库分支，保存 JSON 与分支版 Markdown 的提交历史 |
| Pages artifact | 当前构建的静态站点，无需 `gh-pages` 分支                        |

`knowledge` 更新使用普通的非强制推送，保留提交历史。更新该分支不会触发 `main` 部署形成循环。生产工作流使用同一并发组串行执行；手动执行需选择 `main`。

`base: './'` 与 hash 路由使用户主页和 `/<repo>/` 项目子路径都可以部署，刷新文档链接不会出现 SPA 路由 404。支持没有自定义域名的标准 GitHub Pages。

## 学习笔记

笔记仅保存于当前浏览器的 `localStorage`，不会随公开站点上传，也不会自动同步到 GitHub。隐私窗口、清理站点数据或更换设备都会影响本地数据，请定期通过“学习笔记 → 导出笔记”备份。

导出包含笔记、收藏和阅读状态，导入前验证版本、字段、时间和大小。相同笔记 ID 保留更新时间较新的内容；其他笔记并存。若需要跨设备同步，可在后续加入个人 GitHub 私有仓库 / OAuth 服务层。

## 目录与验证

```text
config/repos.json                  精选仓库、类别与跟踪版本
scripts/collect.mjs                GitHub 与 Trending 采集、增量文档生成
scripts/lib.mjs                    文件选择、来源解析、文档模板
scripts/validate.mjs               知识库数据与 Markdown 一致性验证
scripts/persist-knowledge.mjs       只包含知识文件的独立 Git tree 提交
scripts/publish.ps1                 首次创建远程仓库、推送分支并启用 Pages
public/data/catalog.json           前端数据及可直接搜索的文档正文
public/knowledge/<repo>/<ref>.md    可以下载、版本管理的学习文档
src/                               React + TypeScript 前端
tests/                             分支、来源、笔记与 Git 持久化测试
.github/workflows/                 检查、定时更新与部署
```

```powershell
npm run check
```

执行测试、知识库验证和 TypeScript / Vite 生产构建。采集脚本使用 Node.js 内置 API，没有 Python 或运行时后端依赖。官方部署和数据接口参考：[Vite GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub Git Trees API](https://docs.github.com/en/rest/git/trees)。
