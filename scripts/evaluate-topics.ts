import { readFileSync, writeFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { intentOf } from "../apps/server/src/topic-language.mjs";
const input = process.argv[2];
if (!input)
  throw new Error(
    "Usage: npm run evaluate:topics -- dataset.json [output.json]",
  );
const dataset = JSON.parse(readFileSync(input, "utf8"));
if (
  !["synthetic", "human-reviewed"].includes(dataset.provenance) ||
  !Array.isArray(dataset.records) ||
  dataset.records.length < 3 ||
  dataset.records.length > 5000
)
  throw new Error("Provide provenance and 3–5000 labeled records");
for (const row of dataset.records)
  if (
    typeof row.text !== "string" ||
    !row.text.trim() ||
    typeof row.topic !== "string"
  )
    throw new Error("Each record needs text and a topic label");
const records: {
  text: string;
  topic: string;
  intent?: ReturnType<typeof intentOf>;
}[] = dataset.records;
const worker = new Worker(
  new URL("../apps/server/src/analysis-worker.mjs", import.meta.url),
  { workerData: { model: "lexical" } },
);
try {
  const now = Date.now();
  const result: any = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Evaluation timed out")),
      30000,
    );
    worker.once("error", reject);
    worker.on("message", (r) => {
      if (r.topics) {
        clearTimeout(timeout);
        resolve(r);
      }
    });
    worker.postMessage({
      sessionId: "evaluation",
      now,
      messages: records.map((r, i) => ({
        id: String(i),
        userId: String(i),
        name: "Evaluation",
        text: r.text,
        at: now - 1,
        arrival: now,
        sequence: i,
        emotes: [],
      })),
    });
  });
  const membership = new Map<number, string>();
  for (const topic of result.topics)
    for (const id of topic.memberIds) membership.set(Number(id), topic.id);
  let tp = 0,
    fp = 0,
    fn = 0;
  for (let i = 0; i < records.length; i++)
    for (let j = i + 1; j < records.length; j++) {
      const expected = records[i].topic === records[j].topic;
      const actual =
        membership.has(i) && membership.get(i) === membership.get(j);
      if (actual && expected) tp++;
      else if (actual) fp++;
      else if (expected) fn++;
    }
  const intent = Object.fromEntries(
    ["suggestions", "disagreement", "questions"].map((kind) => {
      let tp = 0,
        fp = 0,
        fn = 0,
        labeled = 0;
      for (const record of records) {
        const expected =
          record.intent?.[kind as keyof ReturnType<typeof intentOf>];
        if (expected === undefined) continue;
        labeled++;
        const actual = intentOf(record.text)[
          kind as keyof ReturnType<typeof intentOf>
        ];
        if (expected && actual) tp++;
        else if (actual) fp++;
        else if (expected) fn++;
      }
      return [
        kind,
        {
          labeled,
          tp,
          fp,
          fn,
          precision: tp + fp ? tp / (tp + fp) : null,
          recall: tp + fn ? tp / (tp + fn) : null,
        },
      ];
    }),
  );
  const report = {
    at: new Date().toISOString(),
    declaredProvenance: dataset.provenance,
    records: records.length,
    assigned: membership.size,
    grouping: {
      tp,
      fp,
      fn,
      pairwisePrecision: tp + fp ? tp / (tp + fp) : null,
      pairwiseRecall: tp + fn ? tp / (tp + fn) : null,
    },
    intent,
    limits:
      "Lexical model only; provenance is declared by dataset author, not independently verified. Synthetic regression results do not establish real-world accuracy. Topics need three contributors. Intent rules are not sentiment analysis.",
  };
  const text = JSON.stringify(report, null, 2) + "\n";
  if (process.argv[3]) writeFileSync(process.argv[3], text);
  console.log(text);
} finally {
  await worker.terminate();
}
