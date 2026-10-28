import test from "node:test";
import assert from "node:assert/strict";
import { emptyPersonal, parsePersonal, mergePersonal } from "../src/storage.ts";

const note = (id, updatedAt, body = "思考") => ({
  id,
  repo: "org/repo",
  ref: "main",
  title: "笔记",
  body,
  updatedAt,
});
test("note imports merge by ID, preserve newer edits and keep independent branches", () => {
  const current = {
    ...emptyPersonal(),
    notes: [note("1", "2026-10-28T01:00:00Z", "新版本")],
    bookmarks: ["org/repo"],
    progress: { "org/repo@main": "done" },
  };
  const incoming = {
    ...emptyPersonal(),
    notes: [
      note("1", "2026-10-27T01:00:00Z", "旧版本"),
      { ...note("2", "2026-10-28T02:00:00Z"), ref: "dev" },
    ],
    bookmarks: ["org/repo", "org/other"],
  };
  const result = mergePersonal(current, incoming);
  assert.equal(result.notes.length, 2);
  assert.equal(result.notes[0].body, "新版本");
  assert.equal(result.notes[1].ref, "dev");
  assert.deepEqual(result.bookmarks, ["org/repo", "org/other"]);
  assert.equal(result.progress["org/repo@main"], "done");
});
test("imports reject malformed, incompatible, and oversized note data before merging", () => {
  assert.throws(() => parsePersonal(null));
  assert.throws(() => parsePersonal({ ...emptyPersonal(), schemaVersion: 2 }));
  assert.throws(() =>
    parsePersonal({ ...emptyPersonal(), notes: [{ id: "x" }] }),
  );
  assert.throws(() =>
    parsePersonal({ ...emptyPersonal(), notes: [note("1", "invalid")] }),
  );
  assert.throws(() =>
    parsePersonal({
      ...emptyPersonal(),
      notes: [note("1", "2026-10-28", "x".repeat(200001))],
    }),
  );
  assert.throws(() =>
    parsePersonal({ ...emptyPersonal(), progress: { x: "bad" } }),
  );
  assert.deepEqual(parsePersonal(emptyPersonal()), emptyPersonal());
});
