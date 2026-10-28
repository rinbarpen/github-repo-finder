import test from "node:test";
import assert from "node:assert/strict";
import {
  refSlug,
  repoSlug,
  selectFiles,
  parseTrending,
  renderWiki,
  symbols,
  validateConfig,
  extractBlobSource,
} from "../scripts/lib.mjs";
import { request } from "../scripts/collect.mjs";
import { readFile } from "node:fs/promises";

test("branch names remain distinct even when sanitized paths collide", () => {
  assert.notEqual(refSlug("feature/a"), refSlug("feature-a"));
  assert.notEqual(refSlug("release/v1"), refSlug("release-v1"));
  assert.equal(repoSlug("Org/Repo"), "org--repo");
  assert.ok(!refSlug("../../main").includes("/"));
  assert.ok(refSlug("a".repeat(200)).length <= 69);
});

test("file selection prioritizes README, manifest and actual source, excluding tests, vendor, locks and symlinks", () => {
  const files = [
    "tests/memory.py",
    "e2e-tests/test_agent.py",
    "AGENTS.md",
    "docs/AGENTS.md",
    "node_modules/agent.ts",
    "src/memory.py",
    "README.md",
    "pyproject.toml",
    "package-lock.json",
    "src/other.py",
  ].map((path) => ({ path, type: "blob", mode: "100644", size: 1200 }));
  files.push({ path: "src/agent.ts", type: "blob", mode: "120000", size: 20 });
  assert.deepEqual(
    selectFiles(files, 3).map((f) => f.path),
    ["README.md", "pyproject.toml", "src/memory.py"],
  );
});

test("Trending extracts observed counts and decodes descriptions from GitHub markup", () => {
  const html =
    '<article class="Box-row"><h2 class="h3"><a href="/org/repo">org / repo</a></h2><p>Tools &amp; memory</p><span itemprop="programmingLanguage">Python</span><a href="/org/repo/stargazers"><svg></svg> 12,345 </a><span class="d-inline-block float-sm-right"><svg></svg>1,234 stars today</span></article>';
  assert.deepEqual(parseTrending(html), [
    {
      repo: "org/repo",
      description: "Tools & memory",
      language: "Python",
      stars: 12345,
      periodStars: 1234,
      url: "https://github.com/org/repo",
    },
  ]);
  assert.deepEqual(parseTrending("<h1>Rate limit</h1>"), []);
});

test("symbol inventory reports only symbols actually present in the sampled source", () => {
  assert.deepEqual(
    symbols(
      "export interface AgentState {}\nasync def run_task():\n pass\nclass Memory:\n pass\nexport type Event = {}",
    ),
    ["AgentState", "run_task", "Memory", "Event"],
  );
});

test("public blob fallback reads original JSON lines without evaluating page scripts", () => {
  const html =
    '<script type="application/json" data-target="react-app.embeddedData">{"payload":{"codeView":{"rawLines":["class Agent:","  pass"]}}}</script><script>throw new Error("never execute")</script>';
  assert.equal(extractBlobSource(html), "class Agent:\n  pass");
  assert.throws(() => extractBlobSource("<h1>Sign in</h1>"), /unavailable/);
});

test("generated learning document binds evidence to its commit and declares partial coverage", () => {
  const sha = "a".repeat(40);
  const md = renderWiki({
    entry: { repo: "org/repo", summary: "简介", reason: "收录原因" },
    metadata: { description: "description", language: "Python" },
    ref: "feature/test",
    sha,
    tree: { truncated: true, tree: [{ path: "src", type: "tree" }] },
    sources: [
      {
        path: "src/agent.py",
        url: `https://github.com/org/repo/blob/${sha}/src/agent.py`,
        content: "class Agent: pass",
        clipped: true,
      },
    ],
    category: { name: "Harness", label: "运行", questions: ["问题"] },
    now: "2026-10-28",
  });
  assert.ok(md.includes(sha));
  assert.ok(md.includes("class") === false);
  assert.ok(md.includes("`Agent`"));
  assert.ok(md.includes("目录树被截断"));
  assert.ok(md.includes("未执行或验证目标项目"));
  assert.ok(md.includes("（片段，已截断）"));
});

test("config rejects duplicate repositories and unknown categories", async () => {
  const config = JSON.parse(
    await readFile(new URL("../config/repos.json", import.meta.url), "utf8"),
  );
  assert.doesNotThrow(() => validateConfig(config));
  assert.throws(
    () =>
      validateConfig({ ...config, repos: [...config.repos, config.repos[0]] }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      validateConfig({
        ...config,
        repos: [{ ...config.repos[0], category: "missing" }],
      }),
    /Unknown category/,
  );
});

test("GitHub token is sent only to api.github.com; optional missing releases return null", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response("{}", { status: 200 });
  });
  await request("https://api.github.com/repos/org/repo", {
    token: "test-token",
  });
  await request("https://raw.githubusercontent.com/org/repo/main/README.md", {
    token: "test-token",
    text: true,
  });
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(calls[1].options.headers.Authorization, undefined);
  globalThis.fetch = async () => new Response("", { status: 404 });
  assert.equal(
    await request("https://api.github.com/repos/org/repo/releases/latest", {
      optional: true,
    }),
    null,
  );
});
