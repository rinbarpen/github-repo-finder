import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import {
  fingerprint,
  GENERATOR_VERSION,
  repoSlug,
  refSlug,
  fileUrl,
  validateConfig,
  parseTrending,
  renderWiki,
  extractBlobSource,
  applyCatalogConfig,
  readingConfig,
} from "./lib.mjs";
import { resolveWikiAIConfig } from "./ai-client.mjs";
export { resolveWikiAIConfig, requestWikiJSON } from "./ai-client.mjs";
import { analyzeRepository } from "./analyze-repository.mjs";
import { ARCHITECTURE_VERSION } from "./architecture.mjs";
import { mapConcurrent, numberedSource } from "./source-reader.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
};
async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, value, "utf8");
  await rename(temp, path);
}

export async function request(
  url,
  { token, text = false, optional = false, timeout = 30000, attempts = 3 } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const headers = {
        "User-Agent": "repo-atlas-knowledge-collector",
        Accept: text ? "*/*" : "application/vnd.github+json",
      };
      if (new URL(url).hostname === "api.github.com") {
        headers["X-GitHub-Api-Version"] = "2022-11-28";
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeout),
      });
      if (optional && response.status === 404) return null;
      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status} from ${new URL(url).hostname}${new URL(url).pathname}`,
        );
        error.retryable = response.status === 429 || response.status >= 500;
        if (response.status === 403)
          error.message +=
            " (check GitHub API rate limits / token permissions)";
        throw error;
      }
      return text ? response.text() : response.json();
    } catch (error) {
      if (
        attempt === attempts - 1 ||
        error.retryable === false ||
        /^HTTP 4(?!29)/.test(error.message)
      )
        throw error;
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
    }
  }
}

async function readSource(repo, sha, file, token) {
  if (process.env.SOURCE_TRANSPORT !== "github-page") {
    try {
      return await request(
        `https://raw.githubusercontent.com/${repo}/${sha}/${file.path.split("/").map(encodeURIComponent).join("/")}`,
        { text: true, timeout: 8000, attempts: 1 },
      );
    } catch {
      /* Some networks cannot reach raw.githubusercontent.com. */
    }
  }
  try {
    return extractBlobSource(
      await request(fileUrl(repo, sha, file.path), { text: true, attempts: 1 }),
    );
  } catch {
    const blob = await request(
      `https://api.github.com/repos/${repo}/git/blobs/${file.sha}`,
      { token },
    );
    if (blob.encoding !== "base64")
      throw new Error("Unsupported source encoding");
    return Buffer.from(blob.content, "base64").toString("utf8");
  }
}

async function collectRepo(
  entry,
  config,
  previous,
  { token, force, now, errors },
) {
  const api = `https://api.github.com/repos/${entry.repo}`;
  const metadata = await request(api, { token });
  if (metadata.private)
    throw new Error("Only public repositories may be published");
  const wikis = [];
  const requestedRefs = [];
  for (const tracked of entry.refs) {
    if (tracked === "default") requestedRefs.push(metadata.default_branch);
    else if (tracked === "latest-release") {
      const release = await request(`${api}/releases/latest`, {
        token,
        optional: true,
      });
      if (release) requestedRefs.push(release.tag_name);
    } else requestedRefs.push(tracked);
  }
  for (const ref of [...new Set(requestedRefs)]) {
    try {
      const commit = await request(
        `${api}/commits/${encodeURIComponent(ref)}`,
        { token },
      );
      const sha = commit.sha;
      const category = config.categories.find((c) => c.id === entry.category);
      const ai = resolveWikiAIConfig();
      const signature = fingerprint({
        sha,
        entry: readingConfig(entry),
        category,
        version: GENERATOR_VERSION,
        maxFiles: config.maxSourceFiles,
        maxChars: config.maxSourceCharacters,
        maxTotalChars: config.maxTotalSourceCharacters,
        architectureVersion: ARCHITECTURE_VERSION,
        aiConfigured: ai.enabled,
        model: ai.enabled ? ai.model : null,
        endpoint: ai.enabled ? ai.url : null,
      });
      const prior = previous?.wikis?.find((w) => w.ref === ref);
      if (!force && prior?.fingerprint === signature) {
        wikis.push(prior);
        continue;
      }
      const tree = await request(
        `${api}/git/trees/${commit.commit.tree.sha}?recursive=1`,
        { token },
      );
      let analyzed;
      try {
        analyzed = await analyzeRepository({
          entry,
          category,
          tree,
          ref,
          sha,
          now,
          ai,
          config,
          loadSource: async (file) => ({
            path: file.path,
            url: fileUrl(entry.repo, sha, file.path),
            content: await readSource(entry.repo, sha, file, token),
          }),
          saveDraft: async (draft) =>
            atomicWrite(
              resolve(
                ROOT,
                ".cache/architecture-review",
                repoSlug(entry.repo),
                `${refSlug(ref)}.json`,
              ),
              JSON.stringify({ repo: entry.repo, ref, sha, ...draft }, null, 2),
            ),
        });
      } catch (error) {
        errors.push(
          `${entry.repo}@${ref}: architecture analysis rejected: ${error.message}`,
        );
        if (prior) {
          wikis.push(prior);
          continue;
        }
        throw error;
      }
      const sources = analyzed.sources;
      const mode = analyzed.mode;
      const markdown =
        analyzed.markdown ??
        renderWiki({
          entry,
          metadata,
          ref,
          sha,
          tree,
          sources: sources.map((s) => ({ ...s, content: numberedSource(s) })),
          category,
          now,
        });
      const path = `knowledge/${repoSlug(entry.repo)}/${refSlug(ref)}.md`;
      await atomicWrite(resolve(ROOT, "public", path), markdown);
      const analysisPath = analyzed.report
        ? path.replace(/\.md$/, ".analysis.json")
        : undefined;
      if (analysisPath)
        await atomicWrite(
          resolve(ROOT, "public", analysisPath),
          JSON.stringify(
            {
              version: ARCHITECTURE_VERSION,
              repo: entry.repo,
              ref,
              sha,
              analysis: analyzed.analysis,
              plan: analyzed.plan,
              report: analyzed.report,
            },
            null,
            2,
          ) + "\n",
        );
      wikis.push({
        ref,
        sha,
        treeSha: commit.commit.tree.sha,
        fingerprint: signature,
        generatedAt: now,
        mode,
        markdown,
        path,
        analysis: analyzed.analysis,
        analysisPath,
        sources: sources.map((s) => ({
          path: s.path,
          url: s.url,
          characters: s.characters,
          totalLines: s.totalLines,
          clipped: s.clipped,
          ranges: s.segments.map(({ startLine, endLine }) => ({
            startLine,
            endLine,
          })),
        })),
        truncated: tree.truncated,
      });
    } catch (error) {
      errors.push(`${entry.repo}@${ref}: ${error.message}`);
      const prior = previous?.wikis?.find((w) => w.ref === ref);
      if (prior) wikis.push(prior);
    }
  }
  if (!wikis.length)
    throw new Error("No tracked branch was successfully analyzed");
  return {
    id: metadata.full_name.toLowerCase(),
    name: metadata.name,
    owner: metadata.owner.login,
    url: metadata.html_url,
    description: metadata.description ?? "",
    summary: entry.summary,
    reason: entry.reason,
    category: entry.category,
    tags: entry.tags,
    collection: entry.collection,
    featured: entry.featured ?? false,
    stars: metadata.stargazers_count,
    forks: metadata.forks_count,
    language: metadata.language ?? "Other",
    license: metadata.license?.spdx_id ?? "未声明",
    defaultBranch: metadata.default_branch,
    updatedAt: metadata.pushed_at,
    collectedAt: now,
    archived: metadata.archived,
    wikis,
  };
}

export async function main() {
  const config = await readJson(resolve(ROOT, "config/repos.json"));
  validateConfig(config);
  const previous = await readJson(resolve(ROOT, "public/data/catalog.json"), {
    repos: [],
    trending: {},
  });
  const now = new Date().toISOString();
  const errors = [];
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const only = process.argv.find((a) => a.startsWith("--repo="))?.slice(7);
  const selection =
    process.argv.find((a) => a.startsWith("--repos="))?.slice(8) ?? only;
  const selectedRepos = selection
    ? new Set(
        selection
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      )
    : null;
  const trendingOnly = process.argv.includes("--trending-only");
  if (trendingOnly)
    errors.push(
      ...(previous.errors ?? []).filter((e) => !e.startsWith("Trending ")),
    );
  else if (selectedRepos)
    errors.push(
      ...(previous.errors ?? []).filter(
        (e) =>
          !e.startsWith("Trending ") &&
          ![...selectedRepos].some((name) => e.toLowerCase().startsWith(name)),
      ),
    );
  if (
    selectedRepos &&
    [...selectedRepos].some(
      (name) => !config.repos.some((e) => e.repo.toLowerCase() === name),
    )
  )
    throw new Error(
      "Every requested repository must be configured in config/repos.json",
    );
  let succeeded = 0;
  const collected = await mapConcurrent(
    config.repos,
    config.repoConcurrency ?? 3,
    async (entry) => {
      const old = previous.repos.find((r) => r.id === entry.repo.toLowerCase());
      if (
        trendingOnly ||
        (selectedRepos && !selectedRepos.has(entry.repo.toLowerCase()))
      )
        return old;
      console.log(`Collecting ${entry.repo}`);
      try {
        const repo = await collectRepo(entry, config, old, {
          token,
          force: process.argv.includes("--force"),
          now,
          errors,
        });
        succeeded++;
        return repo;
      } catch (error) {
        errors.push(`${entry.repo}: ${error.message}`);
        return old;
      }
    },
  );
  const repos = applyCatalogConfig(collected.filter(Boolean), config.repos);
  const trending = {};
  for (const period of config.trendingPeriods) {
    const source = `https://github.com/trending?since=${period}`;
    try {
      const items = parseTrending(await request(source, { text: true }));
      if (!items.length)
        throw new Error(
          "No entries found; GitHub Trending markup may have changed",
        );
      trending[period] = { fetchedAt: now, source, items };
    } catch (error) {
      errors.push(`Trending ${period}: ${error.message}`);
      trending[period] = {
        ...(previous.trending[period] ?? {
          fetchedAt: null,
          source,
          items: [],
        }),
        error: error.message,
      };
    }
  }
  if (!succeeded && !trendingOnly)
    throw new Error(
      `Collection failed for every selected repository; previous catalog kept. ${errors.join("; ")}`,
    );
  if (trendingOnly && !Object.values(trending).some((t) => t.fetchedAt === now))
    throw new Error("All Trending requests failed; previous catalog kept.");
  const catalog = {
    schemaVersion: 1,
    generatedAt: now,
    categories: config.categories,
    repos,
    trending,
    errors,
  };
  await atomicWrite(
    resolve(ROOT, "public/data/catalog.json"),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  await atomicWrite(
    resolve(ROOT, "public/data/status.json"),
    JSON.stringify(
      { generatedAt: now, repositories: repos.length, errors },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Saved ${repos.length} repositories, ${repos.reduce((n, r) => n + r.wikis.length, 0)} branch analyses, ${errors.length} warnings.`,
  );
  errors.forEach((e) => console.warn(e));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
