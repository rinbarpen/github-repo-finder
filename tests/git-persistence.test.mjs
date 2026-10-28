import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { persistKnowledge } from "../scripts/persist-knowledge.mjs";

test("knowledge publication creates an isolated branch, fast-forwards history and skips unchanged content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-git-test-"));
  const repo = join(directory, "app");
  const remote = join(directory, "remote.git");
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Atlas Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Atlas Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  const git = (args, cwd = repo) =>
    execFileSync("git", args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  try {
    await mkdir(repo);
    await mkdir(remote);
    git(["init", "--bare"], remote);
    git(["init", "-b", "main"]);
    await mkdir(join(repo, "public/data"), { recursive: true });
    await mkdir(join(repo, "public/knowledge"), { recursive: true });
    await writeFile(join(repo, "public/data/catalog.json"), '{"version":1}');
    await writeFile(join(repo, "public/knowledge/main.md"), "# Wiki");
    await writeFile(
      join(repo, "application-source.ts"),
      "export const privateAppCode = true;",
    );
    git(["add", "."]);
    git(["commit", "-m", "Application source"]);
    const main = git(["rev-parse", "HEAD"]);
    git(["remote", "add", "origin", remote]);
    await persistKnowledge(repo);
    git(["fetch", "origin", "knowledge:refs/remotes/origin/knowledge"]);
    const first = git(["rev-parse", "origin/knowledge"]);
    assert.equal(
      git(["ls-tree", "-r", "--name-only", first]),
      "public/data/catalog.json\npublic/knowledge/main.md",
    );
    assert.equal(
      git(["rev-parse", "HEAD"]),
      main,
      "Application branch must remain unchanged",
    );
    await persistKnowledge(repo);
    assert.ok(
      git(["ls-remote", "origin", "refs/heads/knowledge"]).startsWith(first),
      "Unchanged files should not create commits",
    );
    await writeFile(join(repo, "public/data/catalog.json"), '{"version":2}');
    await persistKnowledge(repo);
    git(["fetch", "origin", "knowledge:refs/remotes/origin/knowledge"]);
    const second = git(["rev-parse", "origin/knowledge"]);
    assert.notEqual(second, first);
    assert.equal(git(["rev-parse", `${second}^`]), first);
    assert.equal(git(["rev-parse", "HEAD"]), main);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
