import { test } from "node:test";
import assert from "node:assert/strict";
import { adapterNames, selectAdapters } from "./index.js";

test("selectAdapters: empty selection keeps default registry order", () => {
  const selected = selectAdapters();
  assert.deepEqual(
    selected.map((adapter) => adapter.name),
    adapterNames()
  );
});

test("selectAdapters: returns only requested adapters in registry order", () => {
  const selected = selectAdapters(["skillsmp", "handpicked"]);
  assert.deepEqual(
    selected.map((adapter) => adapter.name),
    ["handpicked", "skillsmp"]
  );
});

test("selectAdapters: unknown names fail with valid options", () => {
  assert.throws(
    () => selectAdapters(["handpicked", "nope"]),
    /unknown adapter\(s\): nope\. Valid adapters:/
  );
});
