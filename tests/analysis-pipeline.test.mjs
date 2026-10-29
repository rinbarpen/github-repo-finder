import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository } from "../scripts/analyze-repository.mjs";
import { architectureFixture } from "./fixtures/architecture.mjs";

test("the two-stage pipeline reads implementations before rendering an evidence-backed guide", async () => {
  const { report, files } = architectureFixture();
  const fileMap = new Map([
    ...files,
    ["README.md", "# Memory\nA small test memory engine."],
  ]);
  const tree = {
    tree: [...fileMap].map(([path, content]) => ({
      path,
      size: content.length,
      type: "blob",
      mode: "100644",
    })),
  };
  const purposes = [];
  const result = await analyzeRepository({
    entry: {
      repo: "org/memory",
      reason: "研究记忆运行路径",
      sourceRoots: ["src/"],
      analysis: { files: files.map(([p]) => p) },
    },
    category: { name: "Memory" },
    tree,
    ref: "main",
    sha: "a".repeat(40),
    now: "2026-10-30",
    ai: { enabled: true, model: "deepseek-flash" },
    config: {
      maxSourceFiles: 12,
      maxSourceCharacters: 10000,
      maxTotalSourceCharacters: 40000,
    },
    log: () => {},
    loadSource: async (file) => ({
      path: file.path,
      content: fileMap.get(file.path),
      url: `https://github.com/org/memory/blob/${"a".repeat(40)}/${file.path}`,
    }),
    callAI: async (_messages, _config, options) => {
      purposes.push(options.purpose);
      return {
        value:
          options.purpose === "planning"
            ? {
                scenario: "写入再检索一条记忆",
                files: files.map(([path]) => ({
                  path,
                  focus: [],
                  reason: "跟踪调用链",
                })),
              }
            : report,
        actualModel: "deepseek-flash",
        usage: null,
      };
    },
  });
  assert.deepEqual(purposes, ["planning", "architecture"]);
  assert.equal(result.mode, "ai");
  assert.equal(result.analysis.version, 3);
  assert.equal(result.analysis.flowSteps, 6);
  assert.ok(result.markdown.includes("把对话变成可以找回的记录"));
  assert.ok(result.sources.some((s) => s.path === "src/store.ts"));
});

test("a docs-only migration branch gets honest navigation instead of an invented architecture", async () => {
  let calls = 0;
  const result = await analyzeRepository({
    entry: { repo: "org/old-repo", reason: "当前代码已迁移" },
    category: { name: "Memory" },
    tree: {
      tree: [{ path: "README.md", size: 90, type: "blob", mode: "100644" }],
    },
    ref: "main",
    sha: "a".repeat(40),
    now: "2026-10-30",
    ai: { enabled: true },
    config: { maxSourceFiles: 12 },
    log: () => {},
    loadSource: async () => ({
      path: "README.md",
      content: "Current code: https://github.com/org/new-repo",
      url: "https://github.com/org/old-repo/blob/aaaaaaaa/README.md",
    }),
    callAI: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.mode, "navigation");
  assert.ok(result.markdown.includes("https://github.com/org/new-repo"));
  assert.ok(result.markdown.includes("不能据此讲解它的运行架构"));
});
