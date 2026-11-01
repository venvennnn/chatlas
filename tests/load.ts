import { performance } from "node:perf_hooks";
import { cpus, totalmem } from "node:os";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../apps/server/src/store.ts";
import { Analysis } from "../apps/server/src/analysis.ts";
const dir = mkdtempSync(join(tmpdir(), "chatlas-load-"));
const store = new Store(join(dir, "load.sqlite")),
  analysis = new Analysis(store),
  s = store.start("demo");
const d = store.createDecision(s.id, "Load test", ["A", "B", "C"], 60);
store.open(d.id);
const latency: number[] = [],
  updates: number[] = [];
let seq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const started = performance.now();
try {
  for (const phase of [
    { rate: 50, seconds: 6 },
    { rate: 200, seconds: 2 },
  ]) {
    const begin = performance.now();
    for (let tick = 0; tick < phase.seconds * 10; tick++) {
      for (let i = 0; i < phase.rate / 10; i++) {
        const at = Date.now(),
          n = seq++,
          text =
            n % 10 === 0
              ? "!vote 1 3"
              : n % 2
                ? "Please play Minecraft"
                : "Please play Valorant";
        const before = performance.now();
        store.ingest(s.id, {
          id: String(n),
          userId: n % 10 === 0 ? "voter-" + (n % 70) : "person-" + (n % 80),
          name: "Synthetic",
          text,
          at,
          arrival: at,
          emotes: [],
        });
        latency.push(performance.now() - before);
      }
      if (tick % 10 === 0) {
        const before = performance.now();
        analysis.update(s.id, store.messages(s.id));
        while (analysis.busy && performance.now() - before < 3000)
          await sleep(5);
        updates.push(performance.now() - before);
      }
      await sleep(Math.max(0, begin + (tick + 1) * 100 - performance.now()));
    }
  }
  const r = store.result(d.id);
  assert.equal(r.voters, 7);
  assert.deepEqual(r.counts, [7, 0, 7]);
  store.close(d.id);
  const sorted = [...latency].sort((a, b) => a - b);
  const report = {
    at: new Date().toISOString(),
    source: "synthetic; not Twitch traffic",
    hardware: {
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      totalMemoryGiB: Math.round(totalmem() / 2 ** 30),
      node: process.version,
    },
    workload: {
      sustained: "50 messages/s for 6 s",
      burst: "200 messages/s for 2 s",
      messages: seq,
      elapsedMs: Math.round(performance.now() - started),
    },
    persistLatencyMs: {
      median: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: Math.max(...sorted),
    },
    workerRoundTripMs: { max: Math.max(...updates) },
    rssMiB: Math.round(process.memoryUsage().rss / 2 ** 20),
    analysis: analysis.provider,
    ballots: r,
    limits:
      "Bounded local SQLite/worker test. Does not measure Twitch network latency, rendering FPS, or end-to-end vote visibility.",
  };
  mkdirSync("docs", { recursive: true });
  writeFileSync(
    "docs/LOAD_RESULTS.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await analysis.stop();
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
}
