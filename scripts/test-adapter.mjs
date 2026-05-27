#!/usr/bin/env node
// Smoke-test adapter output after build:catalog.
//
// Checks are intentionally network-backed and soft-failing by default:
// - npx commands resolve against npm
// - uvx/pipx commands resolve against PyPI
// - file-only skill sources return HTTP 200
//
// The script writes a structured JSON report for CI review and exits 0 unless
// --fail-on-error is passed. Catalog-refresh uses it as a soft check.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const args = parseArgs(process.argv.slice(2));
const catalogPath = args.catalog ?? join(repoRoot, "catalog.json");
const outPath = args.out ?? join(repoRoot, "adapter-smoke-report.json");

const startedAt = new Date().toISOString();
const results = [];
let catalogGeneratedAt = null;
let fatalError = null;

try {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalogGeneratedAt = catalog.generated_at ?? null;

  for (const entry of catalog.entries ?? []) {
    const checks = [];

    if (entry.install?.command) {
      checks.push(await checkInstallCommand(entry));
    }

    for (const file of entry.install?.skill_files ?? []) {
      checks.push(await checkSkillFile(entry, file));
    }

    if (checks.length === 0) {
      checks.push({
        kind: "metadata",
        ok: false,
        message: "entry has neither install.command nor install.skill_files",
      });
    }

    results.push({
      id: entry.id,
      name: entry.name,
      source: entry.source?.adapter ?? "unknown",
      verified: Boolean(entry.verified),
      checks,
    });
  }
} catch (error) {
  fatalError = error;
  results.push({
    id: null,
    name: "catalog-load",
    source: "catalog",
    verified: false,
    checks: [
      {
        kind: "catalog",
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
    ],
  });
}

const summary = summarize(results);
const report = {
  ok: fatalError === null && summary.failed === 0,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  catalog_path: catalogPath,
  catalog_generated_at: catalogGeneratedAt,
  total_entries: results.length,
  summary,
  results,
  ...(fatalError
    ? {
        error: {
          name: fatalError instanceof Error ? fatalError.name : "Error",
          message:
            fatalError instanceof Error ? fatalError.message : String(fatalError),
          stack: fatalError instanceof Error ? fatalError.stack : undefined,
        },
      }
    : {}),
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

for (const line of humanSummary(report)) {
  const writer = report.ok ? console.log : console.warn;
  writer(line);
}

if (!report.ok && args.failOnError) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = { failOnError: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--catalog") {
      parsed.catalog = requireValue(argv, ++i, arg);
    } else if (arg === "--out") {
      parsed.out = requireValue(argv, ++i, arg);
    } else if (arg === "--fail-on-error") {
      parsed.failOnError = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value`);
  if (value.startsWith("-")) {
    throw new Error(`${flag} requires a value, got ${value}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/test-adapter.mjs [options]

Options:
  --catalog <path>       catalog JSON to inspect (default: ./catalog.json)
  --out <path>           report JSON path (default: ./adapter-smoke-report.json)
  --fail-on-error        exit 1 when any check fails
  -h, --help             show this help
`);
}

async function checkInstallCommand(entry) {
  const command = entry.install.command;
  const packageName = packageNameFor(entry.install);
  if (!packageName) {
    return {
      kind: "install.command",
      ok: false,
      command,
      message: `cannot determine package name for install command ${command}`,
    };
  }

  if (command === "npx") {
    return checkRegistryJson({
      kind: "install.command",
      command,
      packageName,
      url: `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    });
  }

  if (command === "uvx" || command === "pipx") {
    return checkRegistryJson({
      kind: "install.command",
      command,
      packageName,
      url: `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
    });
  }

  return {
    kind: "install.command",
    ok: true,
    command,
    packageName,
    skipped: true,
    message: `unsupported command ${command}; only npx, uvx, and pipx are checked`,
  };
}

function packageNameFor(install) {
  const args = install.args ?? [];
  const firstPackageArg = args.find((arg) => !arg.startsWith("-"));
  return firstPackageArg ?? null;
}

async function checkRegistryJson({ kind, command, packageName, url }) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    return {
      kind,
      ok: res.ok,
      command,
      packageName,
      url,
      status: res.status,
      message: res.ok
        ? `${packageName} resolved`
        : `${packageName} registry lookup returned HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      kind,
      ok: false,
      command,
      packageName,
      url,
      message: `${packageName} registry lookup failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function checkSkillFile(_entry, file) {
  if (!file.source?.startsWith("https://")) {
    return {
      kind: "skill_file",
      ok: false,
      source: file.source ?? null,
      target: file.target ?? null,
      message: "skill file source must be https://",
    };
  }

  try {
    const res = await fetch(file.source, { method: "HEAD" });
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(file.source, { method: "GET" });
      return skillFileResult(file, getRes.status, getRes.ok);
    }
    return skillFileResult(file, res.status, res.ok);
  } catch (e) {
    return {
      kind: "skill_file",
      ok: false,
      source: file.source,
      target: file.target,
      message: `skill file fetch failed: ${(e).message}`,
    };
  }
}

function skillFileResult(file, status, ok) {
  return {
    kind: "skill_file",
    ok,
    source: file.source,
    target: file.target,
    status,
    message: ok
      ? `${file.source} resolved`
      : `${file.source} returned HTTP ${status}`,
  };
}

function summarize(entries) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const entry of entries) {
    for (const check of entry.checks) {
      if (check.skipped) {
        skipped += 1;
      } else if (check.ok) {
        passed += 1;
      } else {
        failed += 1;
      }
    }
  }
  return { passed, failed, skipped };
}

function humanSummary(report) {
  const lines = [
    `Adapter smoke report: ${report.total_entries} entries, ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`,
    `Wrote ${outPath}`,
  ];
  for (const entry of report.results) {
    for (const check of entry.checks) {
      if (!check.ok && !check.skipped) {
        lines.push(`WARN ${entry.id}: ${check.message}`);
      }
    }
  }
  return lines;
}
