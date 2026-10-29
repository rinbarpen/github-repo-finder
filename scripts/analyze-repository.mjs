import { requestWikiJSON } from "./ai-client.mjs";
import {
  ARCHITECTURE_VERSION,
  planMessages,
  reportMessages,
  groundReport,
  reviewReport,
  renderArchitecture,
  renderNavigation,
} from "./architecture.mjs";
import {
  excerptSource,
  importedFiles,
  isImplementation,
  isTest,
  mapConcurrent,
  sourceInventory,
  validateReadingPlan,
} from "./source-reader.mjs";

export async function analyzeRepository({
  entry,
  category,
  tree,
  ref,
  sha,
  now,
  ai,
  config,
  loadSource,
  log = console.log,
  callAI = requestWikiJSON,
  saveDraft = async () => {},
}) {
  const inventory = sourceInventory(tree.tree, entry, 1400);
  const byPath = new Map(inventory.map((f) => [f.path, f]));
  const cache = new Map();
  const notes = [];
  const load = async (file) => {
    if (!cache.has(file.path))
      cache.set(
        file.path,
        Promise.resolve(loadSource(file)).then((s) =>
          typeof s === "string" ? { path: file.path, content: s } : s,
        ),
      );
    return cache.get(file.path);
  };
  const maxFiles = config.maxSourceFiles;
  const focusByPath = entry.analysis?.focus ?? {};
  const metadata = inventory
    .filter(
      (f) =>
        /^readme\./i.test(f.path) ||
        /^(?:package.json|pyproject.toml|Cargo.toml|go.mod)$/.test(f.path),
    )
    .slice(0, 3);
  const core = (entry.analysis?.files ?? [])
    .map((p) => byPath.get(p))
    .filter(Boolean);
  const implementations = inventory.filter(
    (f) =>
      isImplementation(f.path) &&
      !isTest(f.path) &&
      !/generated|deprecated|api-surface/.test(f.path),
  );
  const examples = inventory.filter(
    (f) =>
      (isTest(f.path) || /(?:^|\/)examples?\//.test(f.path)) &&
      isImplementation(f.path),
  );
  const architectureDocs = inventory
    .filter(
      (f) =>
        /(?:architecture|design|concept)/i.test(f.path) &&
        /\.mdx?$/.test(f.path),
    )
    .slice(0, 1);
  const bootstrapFiles = [
    ...new Map(
      [
        ...metadata,
        ...core.slice(0, 2),
        ...architectureDocs,
        ...implementations.slice(0, 1),
      ].map((f) => [f.path, f]),
    ).values(),
  ];
  const bootstrap = (
    await mapConcurrent(bootstrapFiles, 4, async (file) => {
      try {
        return excerptSource(await load(file), {
          focus: focusByPath[file.path] ?? [],
          maxCharacters: 16000,
        });
      } catch (error) {
        notes.push(`${file.path}: ${error.message}`);
        return null;
      }
    })
  ).filter(Boolean);
  if (!implementations.length) {
    const sources = bootstrap.length
      ? bootstrap
      : await mapConcurrent(inventory.slice(0, 2), 2, async (f) =>
          excerptSource(await load(f)),
        );
    return {
      markdown: renderNavigation({ entry, ref, sha, now, sources }),
      sources,
      mode: "navigation",
      analysis: {
        version: ARCHITECTURE_VERSION,
        kind: "navigation",
        reason: "No implementation source in this ref",
        filesRead: sources.length,
        charactersRead: sources.reduce((n, s) => n + s.characters, 0),
      },
    };
  }
  let plan = { scenario: entry.analysis?.scenario ?? entry.reason, files: [] };
  let plannedBy = "profile-and-imports";
  if (ai.enabled) {
    log(`${entry.repo}@${ref}: planning source reading (${ai.model})`);
    try {
      const planned = await callAI(
        planMessages({ entry, category, inventory, bootstrap }),
        ai,
        { purpose: "planning" },
      );
      plan = validateReadingPlan(
        planned.value,
        inventory,
        Math.min(18, maxFiles),
      );
      plannedBy = "model-and-profile";
    } catch (error) {
      notes.push(`Reading planner fallback: ${error.message}`);
      log(
        `${entry.repo}@${ref}: planner unavailable; following profile and local imports`,
      );
    }
  }
  const selection = new Map();
  const add = (file, focus = [], reason = "") => {
    if (!file || (selection.size >= maxFiles && !selection.has(file.path)))
      return;
    const previous = selection.get(file.path);
    selection.set(file.path, {
      file,
      focus: [
        ...new Set([
          ...(previous?.focus ?? []),
          ...focus,
          ...(focusByPath[file.path] ?? []),
        ]),
      ],
      reason: reason || previous?.reason || "Architecture reading",
    });
  };
  for (const file of metadata) add(file);
  for (const file of core) add(file, [], "Curated core implementation");
  for (const item of plan.files)
    add(byPath.get(item.path), item.focus, item.reason);
  if (![...selection.keys()].some((p) => isTest(p) || /examples?\//.test(p)))
    add(examples[0], [], "Check observable behavior in a test/example");
  for (const file of implementations.slice(0, 6)) add(file);
  // Follow real local imports to implementation modules, not guessed filenames.
  const primary = [...selection.values()];
  await mapConcurrent(primary, 4, async ({ file }) => {
    try {
      await load(file);
    } catch (error) {
      notes.push(`${file.path}: ${error.message}`);
    }
  });
  for (const { file } of primary) {
    try {
      const raw = await load(file);
      for (const dependency of importedFiles(file.path, raw.content, inventory))
        add(byPath.get(dependency), [], `Imported by ${file.path}`);
    } catch {
      /* Recorded above. */
    }
  }
  const selected = [...selection.values()];
  const rawFiles = await mapConcurrent(selected, 4, async ({ file }) => {
    try {
      return await load(file);
    } catch {
      return null;
    }
  });
  const sources = [];
  let remaining = config.maxTotalSourceCharacters ?? 320000;
  for (let i = 0; i < selected.length && remaining >= 1000; i++) {
    if (!rawFiles[i]) continue;
    const item = selected[i];
    const source = excerptSource(rawFiles[i], {
      focus: item.focus,
      maxCharacters: Math.min(config.maxSourceCharacters, remaining),
    });
    sources.push(source);
    remaining -= source.characters;
  }
  if (!sources.some((s) => isImplementation(s.path)))
    throw new Error("No implementation evidence could be read");
  log(
    `${entry.repo}@${ref}: read ${sources.length} files / ${sources.reduce((n, s) => n + s.characters, 0)} characters, following ${plan.scenario}`,
  );
  if (!ai.enabled) return { sources, mode: "evidence", notes, plan };
  await saveDraft({ phase: "evidence-ready", plan, sources, notes });
  let result;
  let issues;
  let previousReport;
  for (let attempt = 0; attempt < 2; attempt++) {
    log(
      `${entry.repo}@${ref}: writing architecture guide${attempt ? " (repairing evidence/coverage)" : ""}`,
    );
    result = await callAI(
      reportMessages({
        entry,
        category,
        plan,
        sources,
        issues,
        previousReport,
      }),
      ai,
      { purpose: "architecture" },
    );
    const grounded = groundReport(result.value, sources);
    result.value = grounded.report;
    for (const note of grounded.notes)
      if (!notes.includes(note)) notes.push(note);
    if (result.formatRetries)
      notes.push(`完整 JSON 重试 ${result.formatRetries} 次，未使用截断片段`);
    issues = reviewReport(result.value, sources, entry.analysis);
    await saveDraft({
      phase: issues.length ? "needs-repair" : "accepted",
      plan,
      sources,
      report: result.value,
      issues,
      notes,
    });
    if (!issues.length) break;
    previousReport = result.value;
    log(
      `${entry.repo}@${ref}: quality gate requested ${issues.length} repairs`,
    );
  }
  if (issues.length)
    throw new Error(
      `Architecture quality gate failed: ${issues.slice(0, 6).join("; ")}`,
    );
  const report = result.value;
  const markdown = renderArchitecture({
    entry,
    ref,
    sha,
    now,
    report,
    sources,
    model: ai.model,
  });
  const analysis = {
    version: ARCHITECTURE_VERSION,
    kind: "architecture",
    requestedModel: ai.model,
    actualModel: result.actualModel,
    filesRead: sources.length,
    charactersRead: sources.reduce((n, s) => n + s.characters, 0),
    modules: report.modules.length,
    flowSteps: report.flow.length,
    mechanisms: report.technologies.length,
    decisions: report.decisions.length,
    readingStrategy: plannedBy,
    structuralChecks: "passed",
    usage: result.usage,
    notes,
  };
  log(
    `${entry.repo}@${ref}: architecture guide accepted (${analysis.modules} modules, ${analysis.flowSteps} traced steps, ${analysis.mechanisms} mechanisms)`,
  );
  return { markdown, mode: "ai", sources, analysis, report, plan };
}
