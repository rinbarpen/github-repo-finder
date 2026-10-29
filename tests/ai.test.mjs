import test from "node:test";
import assert from "node:assert/strict";
import { requestWikiJSON, resolveWikiAIConfig } from "../scripts/ai-client.mjs";

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
  assert.equal(await requestWikiJSON([], config), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test("structured analysis uses Flash JSON output and does not store reasoning content", async (t) => {
  const value = { overview: { plainLanguage: "分析内容" } };
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(value),
              reasoning_content: "private reasoning",
            },
          },
        ],
      }),
    );
  });
  const result = await requestWikiJSON(
    [{ role: "user", content: "Return architecture JSON" }],
    resolveWikiAIConfig({ DEEPSEEK_API_KEY: "test-key" }),
  );
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.body.model, "deepseek-flash");
  assert.equal(request.body.reasoning_effort, "low");
  assert.equal(request.body.max_tokens, 32000);
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.deepEqual(request.body.response_format, { type: "json_object" });
  assert.deepEqual(result.value, value);
  assert.ok(!JSON.stringify(result).includes("private reasoning"));
});

test("truncation retries a complete JSON response with the same evidence and output-only budget", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(
      JSON.stringify({
        choices:
          requests.length === 1
            ? [
                {
                  finish_reason: "length",
                  message: { content: '{"overview":' },
                },
              ]
            : [
                {
                  finish_reason: "stop",
                  message: { content: '{"overview":"complete"}' },
                },
              ],
      }),
    );
  });
  const messages = [
    { role: "user", content: "Return JSON using these exact source lines" },
  ];
  const result = await requestWikiJSON(
    messages,
    resolveWikiAIConfig({ DEEPSEEK_API_KEY: "test-key" }),
  );
  assert.deepEqual(result.value, { overview: "complete" });
  assert.equal(result.formatRetries, 1);
  assert.deepEqual(requests[0].thinking, { type: "enabled" });
  assert.deepEqual(requests[1].thinking, { type: "disabled" });
  assert.deepEqual(requests[1].messages, messages);
});

test("authentication failures do not trigger paid repeated requests", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("", { status: 401 });
  });
  await assert.rejects(
    requestWikiJSON([], resolveWikiAIConfig({ DEEPSEEK_API_KEY: "test-key" })),
    /401/,
  );
  assert.equal(calls, 1);
});

test("truncated or non-JSON model outputs are rejected before a guide can be published", async (t) => {
  const configuration = resolveWikiAIConfig({ DEEPSEEK_API_KEY: "test-key" });
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            { finish_reason: "length", message: { content: '{"overview":' } },
          ],
        }),
      ),
  );
  await assert.rejects(requestWikiJSON([], configuration), /truncated/);
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "a long unstructured article" } }],
      }),
    );
  await assert.rejects(requestWikiJSON([], configuration), /invalid JSON/);
});
