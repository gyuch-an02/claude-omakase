import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packageVersion, zodToJsonSchema } from "../server.js";
import { uninstallSkillInput } from "../tools/uninstall-skill.js";

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

test("zodToJsonSchema unwraps refined fields for MCP tool schemas", () => {
  const schema = zodToJsonSchema(uninstallSkillInput) as {
    properties?: { id?: { type?: string; description?: string } };
    required?: string[];
  };

  assert.equal(schema.properties?.id?.type, "string");
  assert.match(schema.properties?.id?.description ?? "", /Installed skill id/);
  assert.ok(schema.required?.includes("id"));
});
