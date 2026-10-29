import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { validateConfig } from "./lib.mjs";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(
  await readFile(resolve(root, "config/repos.json"), "utf8"),
);
validateConfig(config);
const catalog = JSON.parse(
  await readFile(resolve(root, "public/data/catalog.json"), "utf8"),
);
assert.equal(catalog.schemaVersion, 1);
assert.ok(
  Number.isFinite(Date.parse(catalog.generatedAt)),
  "Missing collection timestamp",
);
assert.ok(catalog.repos.length > 0, "Catalog must not be empty");
const categories = new Set(config.categories.map((c) => c.id));
const ids = new Set();
const paths = new Set();
const requireArchitecture = process.argv.includes("--require-architecture");
const selectedArgument = process.argv
  .find((v) => v.startsWith("--repos="))
  ?.slice(8);
const selected = selectedArgument
  ? new Set(
      selectedArgument
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    )
  : null;
for (const repo of catalog.repos) {
  assert.ok(!ids.has(repo.id), `Duplicate ${repo.id}`);
  ids.add(repo.id);
  assert.ok(categories.has(repo.category), `Unknown category for ${repo.id}`);
  assert.ok(Number.isInteger(repo.stars) && repo.stars >= 0);
  assert.ok(repo.wikis.length > 0, `No wiki for ${repo.id}`);
  const refs = new Set();
  for (const wiki of repo.wikis) {
    if (requireArchitecture && (!selected || selected.has(repo.id))) {
      assert.equal(
        wiki.analysis?.version,
        3,
        `Architecture generation did not succeed for ${repo.id}@${wiki.ref}`,
      );
      assert.ok(["architecture", "navigation"].includes(wiki.analysis.kind));
      if (wiki.analysis.kind === "architecture") {
        assert.equal(wiki.mode, "ai");
        assert.equal(wiki.analysis.structuralChecks, "passed");
        assert.ok(
          wiki.analysis.flowSteps >= 5 &&
            wiki.analysis.mechanisms >= 3 &&
            wiki.analysis.decisions >= 3,
        );
        const artifact = JSON.parse(
          await readFile(resolve(root, "public", wiki.analysisPath), "utf8"),
        );
        assert.equal(artifact.sha, wiki.sha);
        assert.equal(artifact.version, 3);
      }
    }
    assert.ok(!refs.has(wiki.ref), `Duplicate ref ${repo.id}@${wiki.ref}`);
    refs.add(wiki.ref);
    assert.match(wiki.sha, /^[a-f0-9]{40}$/, "Wiki must be pinned to a commit");
    assert.ok(wiki.sources.length > 0);
    assert.ok(
      wiki.sources.every((s) =>
        s.url.startsWith(
          `https://github.com/${repo.owner}/${repo.name}/blob/${wiki.sha}/`,
        ),
      ),
      "Every source must reference its immutable commit",
    );
    assert.ok(wiki.path.startsWith("knowledge/") && !wiki.path.includes(".."));
    assert.ok(!paths.has(wiki.path), `Branch path collision: ${wiki.path}`);
    paths.add(wiki.path);
    assert.equal(
      await readFile(resolve(root, "public", wiki.path), "utf8"),
      wiki.markdown,
      `Markdown/catalog mismatch for ${repo.id}@${wiki.ref}`,
    );
    assert.ok(wiki.markdown.includes(wiki.sha));
  }
}
for (const period of config.trendingPeriods) {
  const trend = catalog.trending[period];
  assert.ok(trend, `Missing trending period ${period}`);
  if (trend.items.length)
    assert.ok(
      Number.isFinite(Date.parse(trend.fetchedAt)),
      "Trending requires its own observation timestamp",
    );
  assert.ok(
    trend.items.every((t) =>
      /^https:\/\/github.com\/[\w.-]+\/[\w.-]+$/.test(t.url),
    ),
  );
}
console.log(
  `Validated ${catalog.repos.length} repositories, ${paths.size} independent version documents, ${config.trendingPeriods.length} trending feeds.`,
);
