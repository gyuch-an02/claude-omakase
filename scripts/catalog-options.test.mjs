import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogArgs } from "./catalog-options.mjs";

test("parseCatalogArgs: default build has no adapter filter", () => {
  assert.deepEqual(parseCatalogArgs([]), { probe: false, adapterNames: [] });
});

test("parseCatalogArgs: parses repeated and comma-separated adapters", () => {
  assert.deepEqual(
    parseCatalogArgs(["--adapter", "handpicked,skillsmp", "--adapter=github-skills", "--probe"]),
    {
      probe: true,
      adapterNames: ["handpicked", "skillsmp", "github-skills"],
    }
  );
});

test("parseCatalogArgs: rejects missing adapter value", () => {
  assert.throws(() => parseCatalogArgs(["--adapter"]), /requires a value/);
  assert.throws(() => parseCatalogArgs(["--adapter="]), /requires a value/);
});

test("parseCatalogArgs: rejects unknown options", () => {
  assert.throws(() => parseCatalogArgs(["--wat"]), /unknown option: --wat/);
});
