import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyCatalogConfig,
  assertCatalogCoverage,
  fingerprint,
  readingConfig,
  validateConfig,
} from "../scripts/lib.mjs";

test("curation changes update cached and unselected repositories while preserving branch guides", () => {
  const wikis = [
    { ref: "main", sha: "a".repeat(40), markdown: "reviewed guide" },
  ];
  const previous = {
    id: "org/repo",
    category: "harness",
    summary: "old",
    tags: [],
    wikis,
  };
  const entries = [
    {
      repo: "Org/Repo",
      category: "memory",
      summary: "new",
      reason: "retrieval",
      collection: "emerging",
      tags: ["Memory"],
    },
  ];
  const [updated] = applyCatalogConfig([previous], entries);
  assert.equal(updated.collection, "emerging");
  assert.equal(updated.category, "memory");
  assert.equal(updated.summary, "new");
  assert.equal(updated.wikis, wikis);
  assert.equal(previous.summary, "old");
});

test("editing a collection or discovery tag does not invalidate expensive source analysis", () => {
  const entry = {
    repo: "org/repo",
    collection: "classic",
    tags: ["Old tag"],
    summary: "old",
    reason: "memory",
    sourceRoots: ["src/"],
    analysis: { scenario: "write and search" },
  };
  const edited = {
    ...entry,
    collection: "emerging",
    tags: ["New tag"],
    summary: "new",
  };
  assert.equal(
    fingerprint(readingConfig(entry)),
    fingerprint(readingConfig(edited)),
  );
  assert.notEqual(
    fingerprint(readingConfig(entry)),
    fingerprint(
      readingConfig({
        ...entry,
        analysis: { scenario: "check another algorithm" },
      }),
    ),
  );
});

test("unknown collection values are rejected before collecting data", async () => {
  const config = JSON.parse(
    await readFile(new URL("../config/repos.json", import.meta.url), "utf8"),
  );
  assert.doesNotThrow(() => validateConfig(config));
  config.repos[0].collection = "trending-is-quality";
  assert.throws(() => validateConfig(config), /Unknown collection/);
});

test("a partial refresh cannot silently omit a newly requested repository", () => {
  const entries = [{ repo: "org/existing" }, { repo: "org/new" }];
  const repos = [{ id: "org/existing" }];
  assert.throws(
    () => assertCatalogCoverage(repos, entries),
    /Missing required repository: org\/new/,
  );
  assert.doesNotThrow(() =>
    assertCatalogCoverage(repos, entries, new Set(["org/existing"])),
  );
  assert.throws(
    () => assertCatalogCoverage(repos, entries, new Set(["org/new"])),
    /org\/new/,
  );
});
