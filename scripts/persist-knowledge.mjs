// Write a dedicated Git tree without checking out or committing application code.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export async function persistKnowledge(
  root = resolve(import.meta.dirname, ".."),
) {
  const temporary = await mkdtemp(join(tmpdir(), "repo-atlas-index-"));
  const env = {
    ...process.env,
    GIT_INDEX_FILE: join(temporary, "index"),
    GIT_AUTHOR_NAME: "repo-atlas[bot]",
    GIT_AUTHOR_EMAIL: "repo-atlas[bot]@users.noreply.github.com",
    GIT_COMMITTER_NAME: "repo-atlas[bot]",
    GIT_COMMITTER_EMAIL: "repo-atlas[bot]@users.noreply.github.com",
  };
  const git = (args, input) =>
    execFileSync("git", args, {
      cwd: root,
      env,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  try {
    let parent;
    try {
      parent = git(["rev-parse", "--verify", "refs/remotes/origin/knowledge"]);
    } catch {
      /* First publication. */
    }
    git(["read-tree", "--empty"]);
    git(["add", "--force", "--", "public/data", "public/knowledge"]);
    const tree = git(["write-tree"]);
    if (parent && tree === git(["rev-parse", `${parent}^{tree}`]))
      console.log("Knowledge unchanged; no commit required.");
    else {
      const commit = git(
        ["commit-tree", tree, ...(parent ? ["-p", parent] : [])],
        `chore(knowledge): refresh repository knowledge ${new Date().toISOString().slice(0, 10)}\n`,
      );
      git(["push", "origin", `${commit}:refs/heads/knowledge`]);
      console.log(`Published knowledge commit ${commit.slice(0, 12)}`);
    }
  } finally {
    // Only remove the uniquely created temporary index directory.
    const safePrefix =
      resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/");
    if (
      !resolve(temporary).startsWith(safePrefix) ||
      !temporary.includes("repo-atlas-index-")
    )
      throw new Error("Unsafe temporary directory");
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  persistKnowledge().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
