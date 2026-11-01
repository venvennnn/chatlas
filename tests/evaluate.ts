import { Worker } from "node:worker_threads";
import { writeFileSync } from "node:fs";
const fixtures = [
  ["Minecraft survival tonight", "minecraft"],
  ["Please play Minecraft", "minecraft"],
  ["No Minecraft again please", "minecraft"],
  ["Minecraft building stream?", "minecraft"],
  ["Please play Valorant ranked", "valorant"],
  ["Valorant with friends", "valorant"],
  ["No more Valorant ranked", "valorant"],
  ["Valorant next please", "valorant"],
  ["The stream audio is loud", "sound"],
  ["Please lower the sound", "sound"],
  ["Audio volume is fine", "sound"],
  ["Sound is too loud", "sound"],
  ["The music is great", "music"],
  ["What is this music playlist?", "music"],
  ["Please share the music", "music"],
  ["Love this music", "music"],
];
const worker = new Worker(
  new URL("../apps/server/src/analysis-worker.mjs", import.meta.url),
  { workerData: { model: "lexical" } },
);
try {
  const now = Date.now();
  const messages = fixtures.map(([text], i) => ({
    id: String(i),
    userId: String(i),
    name: "Synthetic",
    text,
    emotes: [],
    at: now,
    arrival: now,
    sequence: i,
  }));
  const result: any = await new Promise((resolve, reject) => {
    worker.on("error", reject);
    worker.on("message", (m) => {
      if (m.topics) resolve(m);
    });
    worker.postMessage({ sessionId: "evaluation", messages, now });
  });
  const membership = new Map();
  for (const t of result.topics)
    for (const id of t.memberIds) membership.set(Number(id), t.id);
  let tp = 0,
    fp = 0,
    fn = 0;
  for (let i = 0; i < fixtures.length; i++)
    for (let j = i + 1; j < fixtures.length; j++) {
      const expected = fixtures[i][1] === fixtures[j][1],
        actual = membership.has(i) && membership.get(i) === membership.get(j);
      if (expected && actual) tp++;
      if (!expected && actual) fp++;
      if (expected && !actual) fn++;
    }
  const report = {
    source:
      "Codex-authored synthetic fixtures with explicit topic labels; not human audience evaluation",
    samples: fixtures.length,
    lexical: {
      pairwisePrecision: tp / (tp + fp || 1),
      pairwiseRecall: tp / (tp + fn || 1),
      tp,
      fp,
      fn,
    },
    semantic: {
      status:
        "not evaluated; requires cached model and independent human-labeled evaluation",
    },
    stability: { status: "not independently evaluated" },
    limitations:
      "Small synthetic set. No claims of general clustering quality or audience representativeness.",
  };
  writeFileSync(
    "docs/EVALUATION_RESULTS.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await worker.terminate();
}
