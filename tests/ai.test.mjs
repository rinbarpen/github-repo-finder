import test from "node:test";
import assert from "node:assert/strict";
import { enrichWithAI, resolveWikiAIConfig } from "../scripts/collect.mjs";

test("DeepSeek Flash defaults work with only a provider key, including blank Actions variables", () => {
  const config = resolveWikiAIConfig({
    DEEPSEEK_API_KEY: " deepseek-test-key ",
    WIKI_API_URL: " ",
    WIKI_MODEL: "",
  });
  assert.deepEqual(config, {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-flash",
    key: "deepseek-test-key",
    enabled: true,
  });
});

test("explicit Wiki configuration overrides defaults and keeps legacy key support", () => {
  const config = resolveWikiAIConfig({
    WIKI_API_URL: "https://example.com/v1/chat/completions",
    WIKI_MODEL: "custom-model",
    WIKI_API_KEY: "wiki-test-key",
    DEEPSEEK_API_KEY: "deepseek-test-key",
  });
  assert.equal(config.url, "https://example.com/v1/chat/completions");
  assert.equal(config.model, "custom-model");
  assert.equal(config.key, "wiki-test-key");
  assert.equal(config.enabled, true);
  assert.equal(
    resolveWikiAIConfig({ WIKI_API_KEY: "legacy-key" }).enabled,
    true,
  );
});

test("a DeepSeek key does not get forwarded to another provider or a lookalike domain", () => {
  for (const url of [
    "https://example.com/chat/completions",
    "https://api.deepseek.com.example.com/chat/completions",
  ]) {
    const config = resolveWikiAIConfig({
      WIKI_API_URL: url,
      DEEPSEEK_API_KEY: "deepseek-test-key",
    });
    assert.equal(config.key, "");
    assert.equal(config.enabled, false);
  }
});

test("plaintext and malformed AI endpoints are rejected before sending any key", () => {
  assert.throws(
    () =>
      resolveWikiAIConfig({
        WIKI_API_URL: "http://api.deepseek.com/chat/completions",
        WIKI_API_KEY: "test-key",
      }),
    /HTTPS/,
  );
  assert.throws(
    () => resolveWikiAIConfig({ WIKI_API_URL: "invalid-url" }),
    /valid HTTPS URL/,
  );
});

test("missing model credentials keep the evidence fallback without making an API call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected paid API call");
  });
  const config = resolveWikiAIConfig({});
  assert.equal(config.model, "deepseek-flash");
  assert.equal(config.enabled, false);
  assert.equal(await enrichWithAI("# Evidence", [], config), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test("AI analysis sends the default Flash model and returns only cited final Markdown", async (t) => {
  const source = {
    path: "src/agent.py",
    url: `https://github.com/org/repo/blob/${"a".repeat(40)}/src/agent.py`,
    content: "class Agent: pass",
  };
  const content = `## 架构分析\n[来源](${source.url})\n${"基于提供的源码分析。".repeat(70)}`;
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content, reasoning_content: "private reasoning" } },
        ],
      }),
    );
  });
  const result = await enrichWithAI(
    "# 项目\n> commit aaaa\n\n## 项目概览\n证据索引",
    [source],
    resolveWikiAIConfig({ DEEPSEEK_API_KEY: "test-key" }),
  );
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.body.model, "deepseek-flash");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(
    JSON.parse(request.body.messages[1].content).untrustedSourceData[0].content,
    source.content,
  );
  assert.ok(result.includes(content));
  assert.ok(result.includes("AI 辅助分析"));
  assert.ok(!result.includes("private reasoning"));
});
