import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const temporary = resolve(".cache/tests/Markdown-view.mjs");
await mkdir(resolve(".cache/tests"), { recursive: true });
const compiled = ts.transpileModule(
  await readFile(resolve("src/Markdown.tsx"), "utf8"),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
await writeFile(temporary, compiled);
const { Markdown } = await import(pathToFileURL(temporary).href);
await unlink(temporary);

test("Mermaid fences enter the diagram view instead of showing raw diagram code", () => {
  const html = renderToStaticMarkup(
    React.createElement(Markdown, {
      children: "```mermaid\nflowchart LR\nA[Input] --> B[Output]\n```",
    }),
  );
  assert.ok(html.includes('role="figure"'));
  assert.ok(html.includes("正在绘制图表"));
  assert.ok(!html.includes('class="language-mermaid"'));
});

test("chapter IDs and compact line citations remain usable without altering hash routes", () => {
  const html = renderToStaticMarkup(
    React.createElement(Markdown, {
      anchorPrefix: "guide",
      children:
        '## 2. 一张图看懂架构\n\n数据在此处变化 [1][s]\n\n[s]: https://github.com/org/repo/blob/aaaa/src/main.py#L2-L8 "src/main.py:2-8"',
    }),
  );
  assert.ok(html.includes('id="guide-2"'));
  assert.ok(html.includes('class="source-reference"'));
  assert.ok(html.includes("#L2-L8"));
});

test("untrusted raw HTML in generated reports remains inert", () => {
  const html = renderToStaticMarkup(
    React.createElement(Markdown, {
      children:
        '<script>alert("unsafe")</script>\n\n<img src=x onerror=alert(1)>',
    }),
  );
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
});
