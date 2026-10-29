import ts from "typescript";
import path from "node:path";

export const isImplementation = (name) =>
  /\.(py|ts|tsx|js|jsx|go|rs)$/.test(name);
export const isTest = (name) =>
  /(?:^|\/)(?:tests?|__tests__|e2e-tests)\/|(?:^|\/)test_|\.(?:test|spec)\./.test(
    name,
  );
export function readableFiles(tree) {
  return tree.filter(
    (f) =>
      f.type === "blob" &&
      f.mode !== "120000" &&
      f.size < 700000 &&
      /\.(md|mdx|rst|txt|py|ts|tsx|js|jsx|go|rs|toml|json|yaml|yml|proto)$/.test(
        f.path,
      ) &&
      !/(?:^|\/)(?:\.[\w-]+|node_modules|vendor|dist|build|fixtures|locales|translations)\//.test(
        f.path,
      ) &&
      !/(?:^|\/)(?:AGENTS|CLAUDE|CONTRIBUTING|AI_POLICY|PRIVACY|SECURITY|TERMS|CODE_OF_CONDUCT)\.md$/i.test(
        f.path,
      ) &&
      !/(?:lock|\.min|\.generated)\.(?:json|js|ts)$|package-lock|pnpm-lock|yarn\.lock/.test(
        f.path,
      ),
  );
}

export async function mapConcurrent(items, limit, work) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        result[index] = await work(items[index], index);
      }
    }),
  );
  return result;
}

export function sourceInventory(tree, entry, limit = 1000) {
  const roots = entry.sourceRoots ?? [];
  const hints = entry.analysis?.files ?? [];
  return readableFiles(tree)
    .map((f) => {
      let score = roots.some((r) => f.path.startsWith(r)) ? 80 : 0;
      if (hints.includes(f.path)) score += 250;
      if (/^readme\./i.test(f.path)) score += 300;
      if (
        /(?:^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod)$/.test(
          f.path,
        )
      )
        score += 45;
      if (
        /(?:architecture|design|concept|quickstart|getting.started)/i.test(
          f.path,
        )
      )
        score += 40;
      if (/generated|v1-deprecated|deprecated|api-surface/.test(f.path))
        score -= 150;
      if (isTest(f.path)) score -= 25;
      if (/(?:examples?|docs?|apps)\//.test(f.path)) score -= 20;
      return { ...f, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

// Preserve positions while hiding examples inside Python strings/docstrings.
// This is a static declaration index, not a Python parser or evaluator.
function pythonCodeLines(content) {
  let code = "";
  let quote = "";
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quote) {
      if (ch === "\\") {
        code += " ";
        if (i + 1 < content.length) code += content[++i] === "\n" ? "\n" : " ";
      } else if (content.startsWith(quote, i)) {
        code += " ".repeat(quote.length);
        i += quote.length - 1;
        quote = "";
      } else {
        code += ch === "\n" ? "\n" : " ";
      }
    } else if (ch === "#") {
      while (i < content.length && content[i] !== "\n") { code += " "; i++; }
      if (i < content.length) code += "\n";
    } else if (ch === '"' || ch === "'") {
      quote = content.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      code += " ".repeat(quote.length);
      i += quote.length - 1;
    } else {
      code += ch;
    }
  }
  return code.split(/\r?\n/);
}

export function indexSource(name, content) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  if (/\.[cm]?[jt]sx?$/.test(name)) {
    const file = ts.createSourceFile(
      name,
      content,
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node, parentName = "") => {
      const named = node.name?.getText(file);
      const isClass = ts.isClassDeclaration(node);
      const callable =
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessor(node) ||
        ts.isSetAccessor(node) ||
        ts.isConstructorDeclaration(node);
      const arrow =
        (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer));
      if (
        (callable && (named || ts.isConstructorDeclaration(node))) ||
        arrow ||
        (isClass && named)
      ) {
        const label = ts.isConstructorDeclaration(node) ? "constructor" : named;
        symbols.push({
          name: parentName && !isClass ? `${parentName}.${label}` : label,
          startLine:
            file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          endLine: file.getLineAndCharacterOfPosition(node.end).line + 1,
          kind: isClass ? "class" : callable && !node.body ? "declaration" : "function",
        });
      }
      ts.forEachChild(node, (child) =>
        visit(child, isClass && named ? named : parentName),
      );
    };
    visit(file);
  } else if (name.endsWith(".py")) {
    const declarations = [];
    const codeLines = pythonCodeLines(content);
    for (let i = 0; i < lines.length; i++) {
      const m = codeLines[i].match(/^(\s*)(?:(async)\s+)?(def|class)\s+(\w+)/);
      if (m)
        declarations.push({
          name: m[4],
          indent: m[1].replace(/\t/g, "    ").length,
          startLine: i + 1,
          kind: m[3] === "class" ? "class" : "function",
        });
    }
    for (let i = 0; i < declarations.length; i++) {
      const item = declarations[i];
      const next = declarations
        .slice(i + 1)
        .find((n) => n.indent <= item.indent);
      const owner = declarations
        .slice(0, i)
        .reverse()
        .find(
          (n) =>
            n.kind === "class" &&
            n.indent < item.indent &&
            !declarations
              .slice(declarations.indexOf(n) + 1, i)
              .some((p) => p.indent <= n.indent),
        );
      symbols.push({
        name: owner ? `${owner.name}.${item.name}` : item.name,
        startLine: item.startLine,
        endLine: next ? next.startLine - 1 : lines.length,
        kind: item.kind,
      });
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/(?:pub\s+)?(?:async\s+)?(?:fn|func)\s+(\w+)/);
      if (m)
        symbols.push({
          name: m[1],
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 100),
          kind: "function",
        });
    }
  }
  return { lines, symbols };
}

function mergeRanges(ranges) {
  const sorted = ranges.sort((a, b) => a.startLine - b.startLine);
  const result = [];
  for (const range of sorted) {
    const last = result.at(-1);
    if (last && range.startLine <= last.endLine + 1)
      last.endLine = Math.max(last.endLine, range.endLine);
    else result.push({ ...range });
  }
  return result;
}

export function excerptSource(
  file,
  { focus = [], maxCharacters = 30000 } = {},
) {
  const { lines, symbols } = indexSource(file.path, file.content);
  let ranges;
  if (file.content.length <= maxCharacters)
    ranges = [{ startLine: 1, endLine: lines.length }];
  else {
    const wanted = [
      ...new Map(
        focus
          .flatMap((f) => {
            const exact = symbols.filter((s) => s.name === f);
            return exact.length
              ? exact
              : symbols.filter(
                  (s) => s.name.split(".").at(-1) === f.split(".").at(-1),
                );
          })
          .map((s) => [s.name + s.startLine, s]),
      ).values(),
    ];
    const selected = wanted.length
      ? wanted
      : symbols
          .filter(
            (s) =>
              s.kind === "function" &&
              !s.name.split(".").at(-1).startsWith("_"),
          )
          .slice(0, 5);
    const candidates = [
      ...selected.map((s) => ({
        startLine: Math.max(1, s.startLine - 3),
        endLine: s.endLine,
      })),
      { startLine: 1, endLine: Math.min(50, lines.length) },
    ];
    ranges = [];
    let remaining = maxCharacters;
    for (const candidate of candidates) {
      if (remaining < 350) break;
      let end = candidate.endLine;
      let text = lines.slice(candidate.startLine - 1, end).join("\n");
      if (text.length > remaining) {
        // Preserve a complete late method when possible, rather than the file prefix.
        const perLine = Math.max(
          1,
          text.length / (end - candidate.startLine + 1),
        );
        end = Math.min(
          end,
          candidate.startLine + Math.floor(remaining / perLine) - 1,
        );
        text = lines.slice(candidate.startLine - 1, end).join("\n");
        while (text.length > remaining && end > candidate.startLine)
          text = lines.slice(candidate.startLine - 1, --end).join("\n");
      }
      if (end >= candidate.startLine) {
        ranges.push({ startLine: candidate.startLine, endLine: end });
        remaining -= text.length;
      }
    }
    ranges = mergeRanges(ranges);
  }
  const segments = ranges.map((range) => ({
    ...range,
    text: lines.slice(range.startLine - 1, range.endLine).join("\n"),
  }));
  const included = (symbol) =>
    segments.some(
      (s) => s.startLine <= symbol.startLine && s.endLine >= symbol.endLine,
    );
  return {
    path: file.path,
    url: file.url,
    totalLines: lines.length,
    segments,
    symbols: [...symbols]
      .sort((a, b) => Number(included(b)) - Number(included(a)))
      .slice(0, 160)
      .sort((a, b) => a.startLine - b.startLine)
      .map((s) => ({ ...s, bodyIncluded: s.kind !== "declaration" && included(s) })),
    clipped: segments.length !== 1 || segments[0]?.endLine !== lines.length,
    characters: segments.reduce((n, s) => n + s.text.length, 0),
  };
}

export function numberedSource(source) {
  return source.segments
    .map(
      (s) =>
        `--- ${source.path}:${s.startLine}-${s.endLine} ---\n${s.text
          .split("\n")
          .map((line, i) => `${s.startLine + i}| ${line}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

export function importedFiles(sourcePath, content, inventory) {
  const available = new Set(inventory.map((f) => f.path));
  const candidates = new Set();
  const tryBase = (base) => {
    for (const suffix of [
      "",
      ".py",
      "/__init__.py",
      ".ts",
      ".tsx",
      ".js",
      "/index.ts",
      "/index.tsx",
      "/index.js",
    ]) {
      const candidate = base + suffix;
      if (available.has(candidate)) {
        candidates.add(candidate);
        return;
      }
    }
  };
  if (sourcePath.endsWith(".py")) {
    for (const m of content.matchAll(
      /^\s*from\s+([\w.]+)\s+import\s+([^\n]+)/gm,
    )) {
      const dots = m[1].match(/^\.+/)?.[0].length ?? 0;
      if (dots) {
        let base = path.posix.dirname(sourcePath);
        for (let i = 1; i < dots; i++) base = path.posix.dirname(base);
        tryBase(path.posix.join(base, m[1].slice(dots).replaceAll(".", "/")));
      } else {
        const suffix = m[1].replaceAll(".", "/");
        for (const f of inventory)
          if (
            f.path.endsWith(`/${suffix}.py`) ||
            f.path === `${suffix}.py` ||
            f.path === `${suffix}/__init__.py` ||
            f.path.endsWith(`/${suffix}/__init__.py`)
          )
            candidates.add(f.path);
      }
    }
  } else {
    for (const m of content.matchAll(
      /(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g,
    )) {
      if (m[1].startsWith("."))
        tryBase(
          path.posix
            .normalize(path.posix.join(path.posix.dirname(sourcePath), m[1]))
            .replace(/\.js$/, ""),
        );
      else if (m[1].startsWith("@/")) {
        const src = sourcePath.lastIndexOf("/src/");
        if (src >= 0) tryBase(sourcePath.slice(0, src + 5) + m[1].slice(2));
      }
    }
  }
  return [...candidates]
    .filter(
      (p) => p !== sourcePath && !/generated|v1-deprecated|api-surface/.test(p),
    )
    .slice(0, 12);
}

export function validateReadingPlan(plan, inventory, maxFiles) {
  const paths = new Set(inventory.map((f) => f.path));
  if (!plan || !Array.isArray(plan.files) || !plan.files.length)
    throw new Error("Reading plan has no files");
  const unique = new Map();
  for (const item of plan.files) {
    if (!item || !paths.has(item.path))
      throw new Error(
        `Reading plan requested an unavailable file: ${item?.path}`,
      );
    if (
      !Array.isArray(item.focus) ||
      item.focus.some((s) => typeof s !== "string") ||
      typeof item.reason !== "string"
    )
      throw new Error(
        `Reading plan needs focus symbols and a reason: ${item.path}`,
      );
    unique.set(item.path, {
      path: item.path,
      focus: item.focus.slice(0, 8),
      reason: item.reason,
    });
  }
  return {
    scenario: String(plan.scenario ?? ""),
    files: [...unique.values()].slice(0, maxFiles),
  };
}
