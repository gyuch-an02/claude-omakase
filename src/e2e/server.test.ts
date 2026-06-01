import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packageVersion } from "../server.js";

// Regression: serverInfo.version was hardcoded "0.1.0" and drifted from the
// published package version. It must now track package.json.
test("packageVersion matches the package manifest and is not the stale hardcode", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  ) as { version: string };

  assert.equal(packageVersion(), pkg.version);
  assert.notEqual(packageVersion(), "0.1.0");
  assert.match(packageVersion(), /^\d+\.\d+\.\d+/);
});
