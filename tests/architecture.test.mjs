import test from "node:test";
import assert from "node:assert/strict";
import {
  groundReport,
  renderArchitecture,
  reviewReport,
} from "../scripts/architecture.mjs";
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
  assert.ok(
    !markdown.includes("flowchart TD"),
    "independent API phases must not be joined into a fabricated execution chain",
  );
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

test("an unverifiable author rationale becomes explicitly labelled inference, never a fabricated quotation", () => {
  const { sources, report } = architectureFixture();
  report.decisions[0].kind = "maintainer-stated";
  report.decisions[0].maintainerQuote =
    "The author explicitly chose this rationale";
  report.decisions[0].why = `作者明确说明${report.decisions[0].why}`;
  const grounded = groundReport(report, sources);
  assert.equal(grounded.report.decisions[0].kind, "engineering-inference");
  assert.equal(grounded.report.decisions[0].maintainerQuote, "");
  assert.ok(!grounded.report.decisions[0].why.includes("作者明确说明"));
  assert.equal(grounded.notes.length, 1);
  assert.equal(
    report.decisions[0].kind,
    "maintainer-stated",
    "the raw model response stays untouched",
  );
  assert.deepEqual(reviewReport(grounded.report, sources), []);
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

test("a compound trace verifies every function, including an absent first function", () => {
  const { sources, report } = architectureFixture();
  report.flow[1].symbol = "extract / embed";
  report.flow[1].evidence.push({
    path: "src/extract.ts",
    startLine: 4,
    endLine: 6,
  });
  assert.deepEqual(reviewReport(report, sources), []);
  report.flow[1].symbol = "invented / embed";
  assert.ok(reviewReport(report, sources).some((s) => s.includes("invented")));
  report.flow[1].symbol = "extract / embed";
  sources[1].symbols.find((s) => s.name === "extract").bodyIncluded = false;
  assert.ok(
    reviewReport(report, sources).some((s) =>
      s.includes("尚未完整读取 extract"),
    ),
  );
});

test("separate real source excerpts render separately and share a strict total line budget", () => {
  const { sources, report } = architectureFixture();
  report.codeWalkthroughs[0].evidence = [
    { path: "src/extract.ts", startLine: 2, endLine: 2 },
    { path: "src/extract.ts", startLine: 5, endLine: 5 },
  ];
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
  const section = markdown.split(/^## 6\./m)[1].split(/^## 7\./m)[0];
  assert.ok(section.includes('return message.split(";")'));
  assert.ok(section.includes("return facts.map(fact => [fact.length])"));
  report.codeWalkthroughs[0].evidence = Array.from({ length: 3 }, () => ({
    path: "src/engine.ts",
    startLine: 1,
    endLine: 12,
  }));
  assert.ok(
    reviewReport(report, sources).some((s) => s.includes("总计超过 30 行")),
  );
});
