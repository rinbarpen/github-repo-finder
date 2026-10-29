import test from "node:test";
import assert from "node:assert/strict";
import { renderArchitecture, reviewReport } from "../scripts/architecture.mjs";
import { architectureFixture } from "./fixtures/architecture.mjs";

test("a coherent guide ties modules, execution, mechanisms and tradeoffs to read code", () => {
  const { sources, report } = architectureFixture();
  assert.deepEqual(reviewReport(report, sources), []);
  const markdown = renderArchitecture({
    entry: { repo: "org/memory" },
    ref: "main",
    sha: "a".repeat(40),
    now: "2026-10-30",
    report,
    sources,
    model: "deepseek-flash",
  });
  assert.ok(markdown.includes("```mermaid\nflowchart LR"));
  assert.ok(markdown.includes("flowchart TD"));
  assert.ok(markdown.includes("export function handle(input)"));
  assert.ok(markdown.includes("#L1-L3"));
  assert.ok(markdown.includes("工程推断"));
});

test("having long prose and source links is insufficient when the actual mechanism is missing", () => {
  const { sources, report } = architectureFixture();
  report.technologies = [];
  assert.ok(
    reviewReport(report, sources).some((s) => s.includes("technologies")),
  );
});

test("invented paths and citations outside the read line ranges are rejected", () => {
  const { sources, report } = architectureFixture();
  report.flow[0].evidence[0].path = "src/imagined-runtime.ts";
  report.decisions[0].evidence[0].startLine = 500;
  assert.ok(
    reviewReport(report, sources).filter((s) => s.includes("未读取")).length >=
      2,
  );
});

test("a run trace cannot rely on a method whose body was cut off", () => {
  const { sources, report } = architectureFixture();
  sources[0].symbols.forEach((s) => {
    s.bodyIncluded = false;
  });
  assert.ok(
    reviewReport(report, sources).some((s) =>
      s.includes("尚未完整读取 handle"),
    ),
  );
});

test("author intent requires a real quote rather than an analyst's plausible guess", () => {
  const { sources, report } = architectureFixture();
  report.decisions[0].kind = "maintainer-stated";
  report.decisions[0].maintainerQuote = "the author definitely intended this";
  assert.ok(
    reviewReport(report, sources).some((s) => s.includes("声称作者意图")),
  );
});

test("code excerpts are copied from the evidence, never from model-invented snippet text", () => {
  const { sources, report } = architectureFixture();
  report.codeWalkthroughs[0].code = "launch_the_imaginary_runtime()";
  const markdown = renderArchitecture({
    entry: { repo: "org/memory" },
    ref: "main",
    sha: "a".repeat(40),
    now: "2026-10-30",
    report,
    sources,
    model: "deepseek-flash",
  });
  assert.ok(!markdown.includes("launch_the_imaginary_runtime"));
  assert.ok(markdown.includes("const facts = extract(input)"));
});

test("malformed model arrays fail the gate without crashing validation", () => {
  const { sources, report } = architectureFixture();
  report.flow = [{ evidence: { path: "src/engine.ts" } }];
  assert.ok(reviewReport(report, sources).length > 0);
});
