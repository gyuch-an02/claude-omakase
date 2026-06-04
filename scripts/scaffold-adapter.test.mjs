import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import assert from "node:assert/strict";

const execFileAsync = promisify(execFile);
const scriptPath = new URL("./scaffold-adapter.mjs", import.meta.url);

test("scaffold-adapter: creates adapter and beside-file test", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "omakase-scaffold-"));

  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath.pathname, "example-source"],
    {
      env: { ...process.env, OMAKASE_REPO_ROOT: repoRoot },
    }
  );

  const adapter = await readFile(
    join(repoRoot, "src", "adapters", "example-source.ts"),
    "utf8"
  );
  const adapterTest = await readFile(
    join(repoRoot, "src", "adapters", "example-source.test.ts"),
    "utf8"
  );

  assert.match(stdout, /Created src\/adapters\/example-source\.ts/);
  assert.match(adapter, /export async function fetch\(\): Promise<Entry\[]>/);
  assert.match(adapter, /source: {\n {6}adapter: "example-source"/);
  assert.match(adapterTest, /normalizeExampleSource/);
  assert.match(adapterTest, /skips entries without an HTTPS SKILL\.md URL/);
});

test("scaffold-adapter: rejects invalid adapter names", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "omakase-scaffold-"));

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath.pathname, "Bad_Name"], {
      env: { ...process.env, OMAKASE_REPO_ROOT: repoRoot },
    }),
    /Adapter name must be kebab-case/
  );
});

test("scaffold-adapter: refuses to overwrite existing files", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "omakase-scaffold-"));
  const env = { ...process.env, OMAKASE_REPO_ROOT: repoRoot };

  await execFileAsync(process.execPath, [scriptPath.pathname, "repeat-source"], {
    env,
  });

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath.pathname, "repeat-source"], {
      env,
    }),
    /Refusing to overwrite existing file/
  );
});
