#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseRef = process.env["CATALOG_ROLLBACK_BASE"] ?? "origin/main";
const worktree = mkdtempSync(join(tmpdir(), "omakase-rollback-"));

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

try {
  try {
    git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
  } catch (error) {
    if (baseRef === "origin/main") {
      git(["fetch", "--depth=1", "origin", "main"]);
      git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
    } else {
      throw error;
    }
  }
  const expected = git(["show", `${baseRef}:catalog.json`]);

  git(["worktree", "add", "--detach", worktree, "HEAD"]);
  writeFileSync(
    join(worktree, "catalog.json"),
    JSON.stringify(
      {
        version: 1,
        generated_at: "1970-01-01T00:00:00.000Z",
        entries: [{ id: "known-bad-refresh-output" }],
      },
      null,
      2
    ),
    "utf8"
  );

  git(["-C", worktree, "checkout", baseRef, "--", "catalog.json"]);
  const restored = await readFile(join(worktree, "catalog.json"), "utf8");

  assert.equal(restored, expected);
  JSON.parse(restored);

  console.log(`catalog rollback verified against ${baseRef}`);
} finally {
  try {
    git(["worktree", "remove", "--force", worktree], { stdio: "ignore" });
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
}
