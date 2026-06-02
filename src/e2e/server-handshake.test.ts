import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// End-to-end MCP contract test: spawn the BUILT server exactly as `npx
// claude-omakase` would, drive a real stdio JSON-RPC handshake, and assert that
// (a) initialize succeeds, (b) tools/list returns every tool, and (c) stdout
// carries nothing but valid JSON-RPC. This is the contract a clean-env client
// relies on — handler unit tests never exercise the actual stdio transport.

const SERVER = fileURLToPath(new URL("../../dist/server.js", import.meta.url));
const EXPECTED_TOOLS = [
  "find_skill",
  "list_installed_skills",
  "install_skill",
  "uninstall_skill",
  "update_skill",
  "doctor_skills",
  "recommend_skills",
  "offer_skill",
  "onboard_starter_pack",
  "set_profile",
  "propose_new_skill",
];

test("MCP stdio handshake: initialize + tools/list over a real process", async (t) => {
  if (!existsSync(SERVER)) {
    assert.fail(`built server missing at ${SERVER} — run \`npm run build\` first`);
  }

  const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));

  const stdoutChunks: string[] = [];
  child.stdout.on("data", (d) => stdoutChunks.push(d.toString("utf8")));

  const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + "\n");
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "probe", version: "1" } },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

  // Wait until the tools/list response (id 2) shows up, or time out.
  const responses = await collectUntil(stdoutChunks, (msgs) => msgs.some((m) => m.id === 2), 8000);

  // (c) Every non-empty stdout line must be valid JSON — no banners/logs leaking.
  const lines = stdoutChunks.join("").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line), `non-JSON on stdout would break the client: ${line}`);
  }

  // (a) initialize
  const init = responses.find((m) => m.id === 1) as { result?: { serverInfo?: { name?: string } } } | undefined;
  assert.ok(init?.result, "initialize returned a result");
  assert.equal(init.result.serverInfo?.name, "claude-omakase");

  // (b) tools/list returns the full toolset
  const list = responses.find((m) => m.id === 2) as
    | { result?: { tools?: Array<{ name: string }> } }
    | undefined;
  assert.ok(list?.result?.tools, "tools/list returned tools");
  const names = list.result.tools.map((tdef) => tdef.name);
  for (const expected of EXPECTED_TOOLS) {
    assert.ok(names.includes(expected), `tools/list is missing ${expected}`);
  }
});

// Accumulate stdout, parsing complete JSON lines, until `done` is satisfied.
async function collectUntil(
  chunks: string[],
  done: (msgs: Array<Record<string, unknown>>) => boolean,
  timeoutMs: number
): Promise<Array<Record<string, unknown>>> {
  const start = Date.now();
  for (;;) {
    const msgs: Array<Record<string, unknown>> = [];
    for (const line of chunks.join("").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        msgs.push(JSON.parse(t));
      } catch {
        /* partial line, ignore */
      }
    }
    if (done(msgs)) return msgs;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for response; stdout so far: ${chunks.join("")}`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}
