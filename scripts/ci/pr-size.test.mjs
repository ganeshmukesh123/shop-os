import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { describe, it } from "node:test";

const SCRIPT_PATH = path.resolve("scripts/pr-size.sh");

function runGit(repositoryPath, ...gitArguments) {
  execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...gitArguments],
    {
      cwd: repositoryPath,
      stdio: "ignore",
    },
  );
}

/** A throwaway repository: `main` has one file, the `feature` branch adds `addedLines` lines. */
function buildRepository(addedLines) {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "pr-size-"));
  runGit(repositoryPath, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repositoryPath, "base.txt"), "base\n");
  runGit(repositoryPath, "add", ".");
  runGit(repositoryPath, "commit", "-q", "-m", "base");
  runGit(repositoryPath, "checkout", "-q", "-b", "feature");
  fs.writeFileSync(path.join(repositoryPath, "change.txt"), "line\n".repeat(addedLines));
  fs.writeFileSync(path.join(repositoryPath, "pnpm-lock.yaml"), "generated\n".repeat(5000));
  runGit(repositoryPath, "add", ".");
  runGit(repositoryPath, "commit", "-q", "-m", "change");
  return repositoryPath;
}

function runScript(repositoryPath, environment = {}) {
  return spawnSync("bash", [SCRIPT_PATH, "main"], {
    cwd: repositoryPath,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

describe("pr-size.sh", () => {
  it("counts changed lines and ignores the lock file", () => {
    const result = runScript(buildRepository(120));
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed lines: 120 /);
    assert.match(result.stdout, /Small: ideal/);
  });

  it("reports each size band", () => {
    assert.match(runScript(buildRepository(300)).stdout, /Normal/);
    assert.match(runScript(buildRepository(500)).stdout, /Large/);
    assert.match(runScript(buildRepository(900)).stdout, /Too large/);
  });

  it("only warns when no failure limit is set", () => {
    assert.equal(runScript(buildRepository(900)).status, 0);
  });

  it("fails over the limit in CI mode", () => {
    const result = runScript(buildRepository(900), { PR_SIZE_FAIL_OVER: "800" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Split the PR/);
  });

  it("passes over the limit when the PR is labelled mechanical", () => {
    const result = runScript(buildRepository(900), {
      PR_SIZE_FAIL_OVER: "800",
      PR_SIZE_EXEMPT: "true",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Exempt/);
  });

  it("passes at exactly the limit", () => {
    assert.equal(runScript(buildRepository(800), { PR_SIZE_FAIL_OVER: "800" }).status, 0);
  });
});
