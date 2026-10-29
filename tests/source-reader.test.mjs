import test from "node:test";
import assert from "node:assert/strict";
import {
  excerptSource,
  indexSource,
  importedFiles,
  mapConcurrent,
  validateReadingPlan,
} from "../scripts/source-reader.mjs";

test("Python excerpts read the requested late method, not imports or a same-named async class", () => {
  const content = `${"# header padding\n".repeat(700)}class Memory:\n    def add(self, message):\n        facts = extract(message)\n        return store(facts)\n\n    def search(self, query):\n        return retrieve(query)\n\nclass AsyncMemory:\n    async def add(self, message):\n        return await store(message)\n`;
  const source = excerptSource(
    { path: "memory.py", content },
    { focus: ["Memory.add"], maxCharacters: 900 },
  );
  const method = source.symbols.find((s) => s.name === "Memory.add");
  assert.equal(method.startLine, 702);
  assert.equal(method.bodyIncluded, true);
  const text = source.segments.map((s) => s.text).join("\n");
  assert.ok(text.includes("facts = extract(message)"));
  assert.ok(!text.includes("return await store(message)"));
});

test("TypeScript AST follows the actual method body through nested braces and string literals", () => {
  const content = `${"// padding\n".repeat(500)}export class Agent {\n  run(input: string) {\n    const bracket = '}';\n    if (input) { return { value: input }; }\n    return { value: bracket };\n  }\n  stop() { return false; }\n}\n`;
  const { symbols } = indexSource("agent.ts", content);
  const run = symbols.find((s) => s.name === "Agent.run");
  assert.equal(run.startLine, 502);
  assert.equal(run.endLine, 506);
  const source = excerptSource(
    { path: "agent.ts", content },
    { focus: ["Agent.run"], maxCharacters: 700 },
  );
  assert.ok(source.symbols.find((s) => s.name === "Agent.run").bodyIncluded);
  assert.ok(
    source.segments.some((s) => s.text.includes("return { value: bracket }")),
  );
});

test("Python declaration evidence excludes executable-looking docstring examples", () => {
  const content = `class Agent:\n    \"\"\"Example:\n    class Imaginary:\n        def execute(self):\n            pass\n    \"\"\"\n    def run(self):\n        text = 'escaped \\' quote'\n        return text  # \"\"\"not a string opener\n`;
  const { symbols } = indexSource("agent.py", content);
  assert.deepEqual(symbols.map((s) => s.name), ["Agent", "Agent.run"]);
  assert.equal(symbols[1].startLine, 7);
});

test("TypeScript abstract signatures do not count as implementations, while arrow methods do", () => {
  const source = excerptSource({ path: "agent.ts", content: "abstract class Agent {\n  abstract run(): void;\n  execute = () => { return actual_work(); };\n}\n" });
  assert.equal(source.symbols.find((s) => s.name === "Agent.run").bodyIncluded, false);
  assert.equal(source.symbols.find((s) => s.name === "Agent.execute").bodyIncluded, true);
});

test("a late implementation remains indexed even after 160 earlier declarations", () => {
  const content = `${Array.from({ length: 180 }, (_, i) => `def early${i}():\n    pass\n`).join("\n")}\ndef late():\n    return actual_work()\n`;
  const source = excerptSource({ path: "large.py", content }, { focus: ["late"], maxCharacters: 500 });
  assert.ok(source.symbols.find((s) => s.name === "late")?.bodyIncluded);
});

test("local import following resolves Python packages, TypeScript relatives and src aliases", () => {
  const files = [
    "pkg/memory.py",
    "pkg/store.py",
    "pkg/utils/__init__.py",
    "sdk/src/apply/index.ts",
    "sdk/src/agent/transport.ts",
    "sdk/src/agent/agent.ts",
  ].map((path) => ({ path }));
  assert.deepEqual(
    importedFiles(
      "pkg/memory.py",
      "from .store import Store\nfrom pkg.utils import normalize",
      files,
    ),
    ["pkg/store.py", "pkg/utils/__init__.py"],
  );
  assert.deepEqual(
    importedFiles(
      "sdk/src/agent/agent.ts",
      'import { apply } from "@/apply";\nimport { fetch } from "./transport.js";',
      files,
    ),
    ["sdk/src/apply/index.ts", "sdk/src/agent/transport.ts"],
  );
});

test("reading plans cannot request invented files or external URLs", () => {
  const files = [{ path: "src/run.ts" }];
  assert.throws(
    () =>
      validateReadingPlan(
        {
          files: [
            { path: "https://example.com/private", focus: [], reason: "read" },
          ],
        },
        files,
        20,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      validateReadingPlan(
        { files: [{ path: "src/missing.ts", focus: [], reason: "read" }] },
        files,
        20,
      ),
    /unavailable/,
  );
});

test("bounded concurrency preserves configuration order and never exceeds the worker budget", async () => {
  let active = 0,
    peak = 0;
  const result = await mapConcurrent([4, 3, 2, 1], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, value * 2));
    active--;
    return value * 10;
  });
  assert.deepEqual(result, [40, 30, 20, 10]);
  assert.equal(peak, 2);
});
