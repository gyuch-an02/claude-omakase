#!/usr/bin/env node
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

import * as listInstalled from "./tools/list-installed.js";
import * as installSkill from "./tools/install-skill.js";
import * as uninstallSkill from "./tools/uninstall-skill.js";
import * as updateSkill from "./tools/update-skill.js";
import * as doctor from "./tools/doctor.js";
import * as recommend from "./tools/recommend.js";
import * as profileLib from "./profile.js";
import { load as loadCatalog } from "./catalog/cache.js";
import type { Profile } from "./types.js";

const app = express();
const PORT = Number(process.env["PORT"] ?? 3002);

app.use(cors());
app.use(express.json());

function fail(res: express.Response, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  res.status(500).json({ error: msg });
}

app.get("/api/catalog", async (_req, res) => {
  try { res.json(await loadCatalog()); } catch (e) { fail(res, e); }
});

app.get("/api/skills/installed", async (_req, res) => {
  try { res.json(await listInstalled.handle()); } catch (e) { fail(res, e); }
});

app.post("/api/skills/install", async (req, res) => {
  try {
    const args = installSkill.installSkillInput.parse(req.body);
    res.json(await installSkill.handle(args));
  } catch (e) { fail(res, e); }
});

app.delete("/api/skills/:id", async (req, res) => {
  try {
    const args = uninstallSkill.uninstallSkillInput.parse({ id: req.params["id"] });
    res.json(await uninstallSkill.handle(args));
  } catch (e) { fail(res, e); }
});

app.post("/api/skills/:id/update", async (req, res) => {
  try {
    const args = updateSkill.updateSkillInput.parse({ id: req.params["id"] });
    res.json(await updateSkill.handle(args));
  } catch (e) { fail(res, e); }
});

app.get("/api/skills/doctor", async (_req, res) => {
  try { res.json(await doctor.handle()); } catch (e) { fail(res, e); }
});

app.get("/api/recommend", async (req, res) => {
  try {
    const args = recommend.recommendInput.parse({
      context: req.query["context"] || undefined,
      limit: req.query["limit"] ? Number(req.query["limit"]) : undefined,
    });
    res.json(await recommend.handle(args));
  } catch (e) { fail(res, e); }
});

app.get("/api/profile", async (_req, res) => {
  try { res.json(await profileLib.load()); } catch (e) { fail(res, e); }
});

app.post("/api/profile", async (req, res) => {
  try {
    await profileLib.save(req.body as Profile);
    res.json(await profileLib.load());
  } catch (e) { fail(res, e); }
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = join(__dirname, "../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}

// Loopback only by default: this dev server exposes install/uninstall (writes
// under ~/.claude/skills/) with no auth, so it must not listen on all
// interfaces. Set OMAKASE_WEB_HOST=0.0.0.0 to expose it deliberately.
const HOST = process.env["OMAKASE_WEB_HOST"] ?? "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Claude Omakase UI → http://${HOST}:${PORT}`);
});
