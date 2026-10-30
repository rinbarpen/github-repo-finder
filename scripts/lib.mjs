import { createHash } from "node:crypto";

export const GENERATOR_VERSION = "atlas-architecture-3.2";
export const repoSlug = (name) => name.toLowerCase().replace("/", "--");
// A readable prefix plus a hash avoids collisions such as feature/a vs feature-a.
export const refSlug = (ref) =>
  `${ref.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60)}-${createHash("sha256").update(ref).digest("hex").slice(0, 8)}`;
export const fingerprint = (input) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
export const escapeMarkdown = (s) =>
  String(s ?? "").replace(/[\[\]<>`*_|\\]/g, "");
export const fileUrl = (repo, sha, path) =>
  `https://github.com/${repo}/blob/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;

export function validateConfig(config) {
  if (
    config.schemaVersion !== 1 ||
    !Array.isArray(config.categories) ||
    !Array.isArray(config.repos)
  )
    throw new Error("Invalid config schema");
  const categories = new Set(config.categories.map((c) => c.id));
  if (categories.size !== config.categories.length)
    throw new Error("Duplicate category");
  const names = new Set();
  for (const entry of config.repos) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(entry.repo))
      throw new Error(`Invalid repository: ${entry.repo}`);
    if (names.has(entry.repo.toLowerCase()))
      throw new Error(`Duplicate repository: ${entry.repo}`);
    names.add(entry.repo.toLowerCase());
    if (!categories.has(entry.category))
      throw new Error(`Unknown category: ${entry.category}`);
    if (
      entry.collection !== undefined &&
      !["classic", "emerging"].includes(entry.collection)
    )
      throw new Error(`Unknown collection: ${entry.collection}`);
    if (
      !Array.isArray(entry.refs) ||
      !entry.refs.length ||
      entry.refs.some((ref) => typeof ref !== "string" || !ref.trim())
    )
      throw new Error(`Missing refs: ${entry.repo}`);
  }
  if (
    !Number.isInteger(config.maxSourceFiles) ||
    config.maxSourceFiles < 2 ||
    config.maxSourceFiles > 32
  )
    throw new Error("maxSourceFiles must be 2–32");
  if (
    !Number.isInteger(config.maxSourceCharacters) ||
    config.maxSourceCharacters < 1000 ||
    config.maxSourceCharacters > 120000
  )
    throw new Error("maxSourceCharacters must be 1000–120000");
  if (
    config.repoConcurrency !== undefined &&
    (!Number.isInteger(config.repoConcurrency) ||
      config.repoConcurrency < 1 ||
      config.repoConcurrency > 4)
  )
    throw new Error("repoConcurrency must be 1–4");
  if (
    config.maxTotalSourceCharacters !== undefined &&
    (!Number.isInteger(config.maxTotalSourceCharacters) ||
      config.maxTotalSourceCharacters < 10000 ||
      config.maxTotalSourceCharacters > 700000)
  )
    throw new Error("maxTotalSourceCharacters must be 10000–700000");
  if (
    !config.trendingPeriods?.every((p) =>
      ["daily", "weekly", "monthly"].includes(p),
    )
  )
    throw new Error("Invalid trending period");
}

export function readingConfig(entry) {
  return {
    repo: entry.repo,
    reason: entry.reason,
    sourceRoots: entry.sourceRoots,
    analysis: entry.analysis,
  };
}

export function applyCatalogConfig(repos, entries) {
  const byId = new Map(
    entries.map((entry) => [entry.repo.toLowerCase(), entry]),
  );
  return repos.map((repo) => {
    const entry = byId.get(repo.id.toLowerCase());
    return entry
      ? {
          ...repo,
          category: entry.category,
          summary: entry.summary ?? repo.summary,
          reason: entry.reason ?? repo.reason,
          tags: entry.tags ?? repo.tags,
          collection: entry.collection,
          featured: entry.featured ?? false,
        }
      : repo;
  });
}

export function assertCatalogCoverage(repos, entries, selected = null) {
  const present = new Set(repos.map((repo) => repo.id.toLowerCase()));
  for (const entry of entries) {
    const id = entry.repo.toLowerCase();
    if ((!selected || selected.has(id)) && !present.has(id))
      throw new Error(
        `Missing required repository: ${entry.repo}; collection did not produce a guide`,
      );
  }
}

export function selectFiles(tree, limit, sourceRoots = []) {
  const score = (path) => {
    if (/^readme\.(md|rst|txt)$/i.test(path)) return 1000;
    if (/^(pyproject.toml|package.json|Cargo.toml|go.mod)$/.test(path))
      return 900;
    const name = path.split("/").at(-1);
    const penalty =
      /(^|\/)(examples?|docs?|apps|scripts|benchmarks|website)\//.test(path)
        ? 35
        : 0;
    if (/(pyproject.toml|package.json|Cargo.toml|go.mod)$/.test(name))
      return 50 - path.split("/").length - penalty;
    if (/\.(md|rst|txt|json|toml)$/.test(path))
      return 5 - path.split("/").length - penalty;
    if (
      /(agent|memory|client|runtime|graph|event|protocol|runner|orchestrat|server)/i.test(
        name,
      )
    )
      return 80 - path.split("/").length * 2 - penalty;
    if (/(main|index|core)\.(py|ts|tsx|js|go|rs)$/.test(name))
      return 70 - path.split("/").length - penalty;
    return 40 - path.split("/").length - penalty;
  };
  return tree
    .filter(
      (f) =>
        f.type === "blob" &&
        f.mode !== "120000" &&
        f.size < 512000 &&
        /\.(md|rst|txt|py|ts|tsx|js|go|rs|toml|json)$/.test(f.path) &&
        !/(^|\/)(\.[\w-]+|node_modules|vendor|dist|build|tests?|__tests__|e2e-tests|fixtures|lockfiles|locales|translations|migrations)\//.test(
          f.path,
        ) &&
        !/(^|\/)(test_|[^/]*[._](?:test|spec)\.)/.test(f.path) &&
        !/(^|\/)(AGENTS|CLAUDE|CONTRIBUTING|AI_POLICY|PRIVACY|SECURITY|TERMS|CODE_OF_CONDUCT)\.md$/i.test(
          f.path,
        ) &&
        !/(lock|\.min|\.generated)\.(json|js|ts|tsx|py)$/.test(f.path) &&
        !/(package-lock|pnpm-lock|yarn.lock)/.test(f.path),
    )
    .sort(
      (a, b) =>
        score(b.path) +
          (sourceRoots.some((p) => b.path.startsWith(p)) ? 100 : 0) -
          (score(a.path) +
            (sourceRoots.some((p) => a.path.startsWith(p)) ? 100 : 0)) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, limit);
}

export function symbols(content) {
  const found = [];
  const expression =
    /^\s*(?:(?:export|default|async|abstract|pub)\s+)*(?:class|interface|function|def|type|enum|struct|fn)\s+([\w]+)/gm;
  let match;
  while ((match = expression.exec(content)) && found.length < 14)
    if (!found.includes(match[1])) found.push(match[1]);
  for (const value of content.matchAll(
    /^\s*export\s+(?:const|let)\s+(\w+)\s*=/gm,
  )) {
    if (found.length >= 14) break;
    if (!found.includes(value[1])) found.push(value[1]);
  }
  return found;
}

export function extractBlobSource(html) {
  // GitHub embeds the original file lines in its public blob page payload.
  // Parse only JSON data; never evaluate repository or page scripts.
  const find = (object) => {
    if (!object || typeof object !== "object") return null;
    if (
      Array.isArray(object.rawLines) &&
      object.rawLines.every((line) => typeof line === "string")
    )
      return object.rawLines.join("\n");
    for (const child of Object.values(object)) {
      const found = find(child);
      if (found !== null) return found;
    }
    return null;
  };
  for (const script of html.matchAll(
    /<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const result = find(JSON.parse(script[1]));
      if (result !== null) return result;
    } catch {
      /* Unrelated JSON payload. */
    }
  }
  throw new Error(
    "Original source lines are unavailable in the GitHub blob page",
  );
}

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const plain = (s) =>
  decode(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
export function parseTrending(html) {
  const items = [];
  for (const article of html.matchAll(
    /<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g,
  )) {
    const block = article[1];
    const heading = block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "";
    const repo = heading.match(/href="\/([\w.-]+\/[\w.-]+)"/)?.[1];
    if (!repo) continue;
    const starsText =
      block.match(
        new RegExp(
          `href="/${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/stargazers"[^>]*>([\\s\\S]*?)</a>`,
        ),
      )?.[1] ?? "";
    const period = plain(
      block.match(
        /<span\b[^>]*class="[^"]*float-sm-right[^"]*"[^>]*>([\s\S]*?)<\/span>/,
      )?.[1] ?? "",
    );
    items.push({
      repo,
      description: plain(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""),
      language: plain(
        block.match(
          /itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/,
        )?.[1] ?? "",
      ),
      stars: Number(plain(starsText).replace(/[^\d]/g, "")) || 0,
      periodStars: Number(period.replace(/[^\d]/g, "")) || 0,
      url: `https://github.com/${repo}`,
    });
  }
  return items.slice(0, 25);
}

export function renderWiki({
  entry,
  metadata,
  ref,
  sha,
  tree,
  sources,
  category,
  now,
}) {
  const linked = (source) => `[${escapeMarkdown(source.path)}](${source.url})`;
  const directories = [...new Set(tree.tree.map((f) => f.path.split("/")[0]))]
    .filter((p) => tree.tree.some((f) => f.type === "tree" && f.path === p))
    .slice(0, 22);
  return `# ${entry.repo.split("/")[1]} 源码学习指南

> 基于选定源码的结构化索引 · ${ref} · ${sha.slice(0, 12)}
> 生成于 ${now}。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。

## 项目概览

${entry.summary}

${escapeMarkdown(metadata.description)}

**为什么值得读：** ${entry.reason}

| 项目 | 信息 |
| --- | --- |
| 研究方向 | ${category.name} / ${category.label} |
| 语言 | ${metadata.language ?? "未识别"} |
| 许可证 | ${metadata.license?.spdx_id ?? "未声明"} |
| 分支 / 标签 | ${escapeMarkdown(ref)} |
| 固定提交 | [${sha.slice(0, 12)}](https://github.com/${entry.repo}/commit/${sha}) |
| 上游主页 | [${entry.repo}](https://github.com/${entry.repo}) |

## 目录地图

以下目录实际存在于该提交，用于定位入口，不代表已完成全仓分析。

${directories.map((d) => `- [\`${d}/\`](https://github.com/${entry.repo}/tree/${sha}/${encodeURIComponent(d)})`).join("\n")}

${tree.truncated ? "> GitHub 返回的目录树被截断，此地图不完整。" : ""}

## 核心文件与符号

${sources.some((s) => /\.(py|ts|tsx|js|go|rs)$/.test(s.path)) ? "" : "> 该版本未采集到实现源码，无法据此建立调用链。请先沿 README 确认实现是否迁移到其他分支或仓库。"}

${sources
  .map(
    (s, index) => `### ${index + 1}. ${escapeMarkdown(s.path)}

来源：${linked(s)} · 读取 ${s.content.length.toLocaleString()} 字符${s.clipped ? "（片段，已截断）" : ""}

${/readme/i.test(s.path) ? "阅读目标：了解项目定位、安装方式、示例与官方文档入口。" : /\.(json|toml)$/.test(s.path) ? "阅读目标：核对依赖、包入口、构建和运行约定。" : "阅读目标：从实际定义出发，跟踪调用方、状态变化及异常分支。"}

${
  symbols(s.content).length
    ? `当前片段识别到的符号：${symbols(s.content)
        .map((v) => `\`${v}\``)
        .join("、")}。`
    : "当前片段未提取到顶层符号，请打开来源继续阅读。"
}`,
  )
  .join("\n\n")}

## 建议阅读路线

1. 从 README 确认项目边界，依据官方文档运行最小示例。
2. 从包清单定位公开入口，对照上面的核心文件查找调用关系。
3. 选择一次最小任务，记录输入、状态、工具或存储调用以及输出。
4. 为异常、取消和重复调用分别设计一个实验，验证自己的理解。
5. 切换到另一个跟踪分支或版本，对照固定提交复查行为变化。

## 研究问题

${category.questions.map((q) => `- [ ] ${q}`).join("\n")}
- [ ] 哪些行为已经通过实际代码或实验验证，哪些仍然是假设？
- [ ] 与同类别其他仓库相比，接口和设计取舍有哪些不同？

## 动手实验

- 复现 README 的最小示例，记录运行环境、版本与结果。
- 在一个关键入口加入日志，画出一次调用的真实时序。
- 用一个失败输入观察错误是如何返回和恢复的。

## 来源与覆盖范围

采集 ${sources.length} 个文件片段，目录记录 ${tree.tree.length} 项。分析固定到提交 \`${sha}\`，不随上游分支漂移。文件选择为启发式抽样，不能据此推断完整架构。

${sources.map((s) => `- ${linked(s)}`).join("\n")}

完整在线知识库入口：[DeepWiki](https://deepwiki.com/${entry.repo})（是否已被该服务索引以实际页面为准）。
`;
}
