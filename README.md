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

当前收录 **21 个项目**，覆盖三个研究方向，并支持“经典项目 / 新锐项目”筛选。此次补充 6 个经典项目与 6 个新锐项目，见[选题与学习路线](docs/curation.md)。标签依据维护状态、可读实现和设计代表性人工选择；Trending 继续作为发现入口。

编辑 `config/repos.json` 的 `repos` 数组：

```json
{
  "repo": "langchain-ai/deepagents",
  "category": "harness",
  "collection": "emerging",
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

每个版本依次读取仓库元数据、固定提交和目录树，然后先制定阅读计划，再读取入口、关键方法、数据结构、适配器及相关测试/示例。TypeScript 使用编译器 AST 定位方法范围，Python 按定义和缩进建立符号索引；大文件优先读取指定方法体，不再只截取文件开头。配置、生成器、模型设置或提交变化时重新生成。文件名包含 ref 的哈希，`feature/a` 和 `feature-a` 不会冲突。

当前预算为每个版本最多 24 个文件、单文件最多 70,000 字符、合计最多 350,000 字符。仓库配置的 `analysis` 记录一个贯穿全文的场景、重点问题、核心文件和需完整读取的方法。阅读计划与本地导入关系共同决定补读范围，三个仓库并行处理，单仓库内的版本分别分析。

对于容易停留在装配层的项目，可用 `analysis.requiredTraceSymbols` 指定必须贯穿的方法，例如 assistant-ui 的消息追加与模型 roundtrip；缺少这些方法的执行解释时，报告会被退回补写。

可用 `node scripts/collect.mjs --repos=langchain-ai/deepagents,mem0ai/mem0` 只重建选中仓库。失败的仓库 / 分支保留上次快照；部分失败会写入 `public/data/status.json`。架构质量检查不通过时，不将未经确认的调用链作为新文档发布。

网络不能访问 `raw.githubusercontent.com` 时，自动从 GitHub 公开代码页的 JSON 数据读取原始行，再回退到 Git Blob API。可在本地设置 `$env:SOURCE_TRANSPORT = 'github-page'` 跳过原始域名。原始代码不会执行。

## DeepWiki 风格文档与可选 AI 分析

**没有密钥时**，生成可追溯的源码证据索引：项目定位、实际目录、核心文件和识别到的符号、阅读路线、分类研究问题、实验和来源。文档明确声明抽样覆盖及未验证内容；它不是对全仓架构已经验证的深度结论。

**配置密钥后**，默认使用 **DeepSeek Flash（`deepseek-flash`）**，接口为 `https://api.deepseek.com/chat/completions`。第一阶段生成源码阅读计划，第二阶段依据带行号的实现生成结构化架构导读：

1. 用一句话建立直觉，再给出贯穿全文的具体输入和输出。
2. 用模块图解释职责、数据和状态边界。
3. 沿实际方法体走完一次请求，明确外部依赖的执行边界。
4. 解释 3–4 个核心机制：问题、算法、数据结构、本项目实现及依赖提供的部分。
5. 对比另一种做法，解释设计收益、代价和适用边界；作者意图需要源码原文，否则只能标为工程推断。
6. 精读直接从实际源码行截取的代码，并提出可观察的验证实验。

发布前会检查方法体覆盖、调用步骤、跨模块证据、引用行段、核心机制和设计取舍，不再只检查篇幅和一个链接。代码片段由渲染器从实际已读行段截取。结构检查通过不等于自动证明所有解释正确，仍需人工复核关键因果关系。

前端支持架构图/流程图、章节跳转和源码行引用，图表按需加载。长代码默认限制高度，可展开完整片段；优先选短片段，单个精读主题最多 120 行。实现和验证它的测试可以共同引用，测试不能替代实现证据。结构化报告另存为同名 `.analysis.json`，供复核阅读计划和证据。仅有迁移 README 的分支生成导航说明，不虚构其架构。模型名称和接口依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/)。

普通引用优先落在短行段；长方法可以引用至多 500 行，但必须属于一个已经完整读取的方法体。页面内精读片段仍限制为每个主题 120 行，避免长方法引用直接变成长篇代码展示。

DeepSeek 阅读计划关闭思考，架构分析使用 `low` 思考档和 32,000 token 上限。截断、无效 JSON、超时或暂时性服务错误最多重试一次；重试关闭思考，重新请求完整 JSON，不拼接残缺内容。无法逐字核实的作者动机降为明确标注的工程推断，源码引用与完整方法体检查仍须通过。参数依据 [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 与[思考模式说明](https://api-docs.deepseek.com/guides/thinking_mode/)。

可先阅读人工逐项核对的写法示例：[Mem0](docs/examples/mem0-architecture.md)、[DeepAgents](docs/examples/deepagents-architecture.md)、[AG-UI](docs/examples/ag-ui-architecture.md)。三篇分别从记忆写入检索、长任务执行、事件与界面状态出发，解释核心机制、真实边界和设计取舍。

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

运行脚本前需要完成 GitHub CLI 登录，并确保本地 `main` 和 `dev` 已提交且工作目录干净。可传入 `-DryRun` 只查看操作计划；可用 `-Repository owner/name` 指定其他新仓库。推送后，脚本会确认对应 `main` 提交已有成功或进行中的发布任务；没有时主动触发一次。随后工作流生成 `knowledge` 分支并部署站点。

将本项目推送到你自己的 GitHub 仓库，生产分支名设为 `main`。在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。需允许工作流写入仓库内容以更新 `knowledge` 分支，部署环境使用 `github-pages`。

工作流在推送 `main`、手动执行以及每天 **北京时间 06:17（UTC 22:17）** 运行。GitHub 定时任务可能延迟，且遵循平台对非活跃仓库的调度规则。

1. 检出 `main`，安装锁定依赖并执行单元测试。
2. 从 `knowledge` 分支恢复上次数据，进行增量采集。
3. 校验数据与来源，将通过检查的文档增量保存到 `knowledge` 分支。失败版本保留上次文档，重试时可复用已成功的结果。
4. 对本轮选中仓库做架构检查；任何版本仍未生成合格导读时，不部署新站点。全部通过后构建前端。
5. 仅 `main` 上传 Pages artifact 并部署。手动在 `dev` 运行时生成 `architecture-preview` 预览产物，不更新线上站点和正式知识库分支。

手动运行工作流时，`repositories` 可以填写逗号分隔的仓库名做小范围质量预览，留空则处理全部。`force` 用于忽略已有分析缓存。

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

执行测试、知识库验证和 TypeScript / Vite 生产构建。采集使用 Node.js 和已安装的 TypeScript 编译器做静态读取，不执行目标仓库代码，不依赖 Python 运行时。官方部署和数据接口参考：[Vite GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub Git Trees API](https://docs.github.com/en/rest/git/trees)。
