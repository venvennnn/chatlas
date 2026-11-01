import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "chatlas-production-")),
  port = 41000 + Math.floor(Math.random() * 1000),
  origin = "https://chatlas.test",
  base = "http://127.0.0.1:" + port;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  APP_ORIGIN: "",
  RAILWAY_PUBLIC_DOMAIN: "chatlas.test",
  DATABASE_PATH: join(dir, "production.sqlite"),
  SESSION_SECRET: randomBytes(32).toString("hex"),
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  EMBEDDING_MODEL: "lexical",
};
let child: ChildProcess | null = null;
async function start() {
  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["start"], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) return;
    } catch {
      /* Wait for this process's health check. */
    }
    if (child.exitCode !== null)
      throw new Error("Production server exited before becoming healthy");
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Production readiness timed out");
}
async function stop() {
  if (!child) return;
  const p = child;
  if (p.exitCode !== null) {
    child = null;
    return;
  }
  const exited = once(p, "exit");
  if (process.platform !== "win32") process.kill(-p.pid!, "SIGTERM");
  else p.kill("SIGTERM");
  await exited;
  child = null;
}
let cookie = "";
async function call(path: string, body?: unknown) {
  const r = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      "x-chatlas-client": "dashboard",
      "idempotency-key": randomUUID(),
      cookie,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r;
}
try {
  await start();
  const html = await (await fetch(base)).text();
  const asset = html.match(/src="(\/assets\/[^"]+)"/)?.[1];
  assert.ok(asset, "Built frontend asset referenced");
  assert.equal((await fetch(base + asset)).status, 200);
  const auth = await call("/demo/bootstrap", {});
  cookie = auth.headers.get("set-cookie")!.split(";")[0];
  const empty = await (await call("/snapshot")).json();
  assert.equal(empty.session, null);
  assert.deepEqual(empty.playback, {
    paused: false,
    speed: 1,
    positionMs: null,
  });
  await call("/sessions/start", { source: "demo" });
  await call("/replay/control", { paused: true });
  const d = await (
    await call("/decisions", {
      question: "Production smoke",
      options: ["A", "B"],
      duration: 60,
    })
  ).json();
  await call("/decisions/" + d.id + "/open", {});
  await call("/demo/messages", { text: "!vote 2", userId: "smoke" });
  await call("/decisions/" + d.id + "/close", {});
  await stop();
  await start();
  const snapshot = await (await call("/snapshot")).json();
  assert.equal(snapshot.decision.id, d.id);
  assert.equal(snapshot.decision.state, "closed");
  assert.deepEqual(snapshot.decision.counts, [0, 1]);
  const report = {
    at: new Date().toISOString(),
    result: "passed",
    checks: [
      "Railway public domain supplies the HTTPS application origin",
      "npm start serves built frontend and referenced asset",
      "health responds",
      "authenticated empty-database snapshot before starting a session",
      "origin and cookie authenticated mutations",
      "approval vote persistence",
      "graceful process shutdown",
      "same-database restart and authenticated snapshot recovery",
    ],
    limits:
      "Local production process tested behind a declared HTTPS public origin. No external TLS reverse proxy, Docker image, Twitch connection, or OBS process was exercised.",
  };
  writeFileSync(
    "docs/PRODUCTION_SMOKE.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
