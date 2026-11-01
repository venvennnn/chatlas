import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
const stop = new Set(
  "a an the is are was were i you we they it this that to for of and or but on in with be have has my your so just can do should would could lets let what how next play playing want think please really".split(
    " ",
  ),
);
const tokens = (t) =>
  t
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.filter((t) => !stop.has(t)) ?? [];
const canonical = (t) =>
  ({
    mc: "minecraft",
    crafting: "minecraft",
    mining: "minecraft",
    valo: "valorant",
    val: "valorant",
    ranked: "valorant",
    breaks: "break",
    hydrate: "break",
    water: "break",
    audio: "sound",
    volume: "sound",
    loud: "sound",
    lagging: "lag",
    buffering: "lag",
    fps: "lag",
  })[t] ?? t;
const cosine = (a, b) => {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (const [k, v] of a) {
    aa += v * v;
    dot += v * (b.get(k) ?? 0);
  }
  for (const v of b.values()) bb += v * v;
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
};
const id = (t) => createHash("sha256").update(t).digest("hex").slice(0, 12);
let session = null,
  clusters = [],
  index = 0,
  extractor = null,
  modelError = false;
let provider = "Limited semantic grouping · lexical TF-IDF";
const cache = new Map();
let resetEpoch = 0;
async function initialize() {
  if (!workerData?.model || workerData.model === "lexical") return;
  try {
    const { MiniLMProvider } = await import("./providers.ts");
    extractor = await MiniLMProvider.load(
      workerData.model,
      workerData.cacheDir,
    );
    provider = extractor.name;
  } catch {
    modelError = true;
    provider = "Limited semantic grouping · lexical TF-IDF (model not cached)";
  }
}
const ready = initialize();
parentPort.on(
  "message",
  async ({
    sessionId,
    clear = false,
    messages,
    now,
    reset = false,
    manual = [],
    generation = 0,
  }) => {
    if (clear) {
      resetEpoch++;
      cache.clear();
      clusters = [];
      session = null;
      return;
    }
    if (!sessionId) return;
    const currentEpoch = resetEpoch;
    await ready;
    if (currentEpoch !== resetEpoch) {
      parentPort.postMessage({
        sessionId,
        topics: [],
        provider,
        coverage: 0,
        queue: 0,
        generation,
      });
      return;
    }
    if (session !== sessionId || reset) {
      session = sessionId;
      clusters = [];
      index = 0;
    }
    const valid = messages.filter((m) => !m.text.trim().startsWith("!"));
    const activeTexts = new Set(
      valid.map((m) => m.text.normalize("NFKC").toLowerCase().trim()),
    );
    for (const text of cache.keys())
      if (!activeTexts.has(text)) cache.delete(text);
    const docs = valid.map((m) => [...new Set(tokens(m.text).map(canonical))]);
    const df = new Map();
    for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1);
    let coverage = 1;
    if (extractor) {
      const texts = [
        ...new Set(
          valid
            .filter(
              (m) =>
                !cache.has(m.text.normalize("NFKC").toLowerCase().trim()) &&
                !m.emotes.length &&
                tokens(m.text).length >= 1,
            )
            .map((m) => m.text.normalize("NFKC").toLowerCase().trim()),
        ),
      ];
      const bounded = texts.slice(0, 256);
      for (let i = 0; i < bounded.length; i += 16) {
        const batch = bounded.slice(i, i + 16);
        try {
          const vectors = await extractor.embed(batch);
          if (currentEpoch !== resetEpoch) {
            cache.clear();
            parentPort.postMessage({
              sessionId,
              topics: [],
              provider,
              coverage: 0,
              queue: 0,
              generation,
            });
            return;
          }
          batch.forEach((text, j) =>
            cache.set(text, new Map(vectors[j].map((v, k) => [String(k), v]))),
          );
        } catch {
          provider = "Semantic inference unavailable · retrying cached model";
          break;
        }
      }
      coverage = valid.length
        ? valid.filter(
            (m) =>
              cache.has(m.text.normalize("NFKC").toLowerCase().trim()) ||
              m.emotes.length,
          ).length / valid.length
        : 1;
      while (cache.size > 4096) cache.delete(cache.keys().next().value);
    }
    const activeIds = new Set(valid.map((m) => m.id));
    for (const c of clusters)
      c.members = c.members.filter((m) => activeIds.has(m.id));
    clusters = clusters.filter((c) => c.members.length);
    const seen = new Set(clusters.flatMap((c) => c.members.map((m) => m.id)));
    const vectorFor = (m, words) =>
      extractor
        ? cache.get(m.text.normalize("NFKC").toLowerCase().trim())
        : new Map(
            words.map((t) => [
              t,
              1 + Math.log(1 + valid.length / ((df.get(t) ?? 0) + 1)),
            ]),
          );
    for (const c of clusters) {
      const people = new Map();
      for (const m of c.members)
        if (!people.has(m.userId)) people.set(m.userId, m);
      const center = new Map();
      for (const m of people.values()) {
        const v = vectorFor(m, [...new Set(tokens(m.text).map(canonical))]);
        if (v)
          for (const [k, n] of v)
            center.set(k, (center.get(k) ?? 0) + n / people.size);
      }
      c.centroid = center;
    }
    for (let j = 0; j < valid.length; j++) {
      const m = valid[j];
      if (seen.has(m.id)) continue;
      const words = docs[j];
      const emote = m.emotes.length > 0 && words.length < 3;
      if (
        (!words.length && !emote) ||
        (!emote &&
          words.every((w) =>
            ["lol", "yes", "no", "gg", "kekw", "pog", "nice"].includes(w),
          ))
      )
        continue;
      const vec = vectorFor(m, words);
      if (!vec && !emote) continue;
      const key = emote ? "emote:" + m.emotes[0] : null;
      const forced = manual.find((x) => x.message_id === m.id)?.topic_id;
      let best = forced ? clusters.find((c) => c.id === forced) : null,
        sim = 0;
      if (!forced)
        for (const c of clusters) {
          if (c.manual) continue;
          const s = key
            ? c.key === key
              ? 1
              : 0
            : c.key
              ? 0
              : cosine(vec, c.centroid);
          if (s > sim) {
            best = c;
            sim = s;
          }
        }
      if (!best || (!forced && sim < (extractor ? 0.72 : 0.24))) {
        const n = index++;
        best = {
          id: forced ?? id(sessionId + ":" + m.id),
          manual: Boolean(forced),
          key,
          centroid: vec ?? new Map(),
          members: [],
          x: [16, 40, 64, 85, 16, 40, 64, 85][n % 8],
          y: [28, 28, 28, 28, 72, 72, 72, 72][n % 8],
        };
        clusters.push(best);
      }
      best.members.push(m);
      const people = new Map();
      for (const mm of best.members)
        if (!people.has(mm.userId)) people.set(mm.userId, mm);
      const centroid = new Map();
      for (const mm of people.values()) {
        const v = vectorFor(mm, [...new Set(tokens(mm.text).map(canonical))]);
        if (v)
          for (const [k, n] of v)
            centroid.set(k, (centroid.get(k) ?? 0) + n / people.size);
      }
      best.centroid = centroid;
    }
    const participants = new Set(messages.map((m) => m.userId)).size;
    const topics = clusters
      .map((c) => {
        const people = new Set(c.members.map((m) => m.userId));
        const counts = new Map();
        for (const m of c.members)
          for (const t of new Set(tokens(m.text).map(canonical)))
            counts.set(t, (counts.get(t) ?? 0) + 1);
        const word =
          [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "conversation";
        const safe = {
          minecraft: "Minecraft discussion",
          valorant: "Valorant discussion",
          break: "Taking a break",
          sound: "Stream sound",
          lag: "Stream quality",
          music: "Music discussion",
          chess: "Chess discussion",
          horror: "Horror games",
          stardew: "Stardew Valley discussion",
        };
        const label = c.key ? "Emote wave" : (safe[word] ?? "Other discussion");
        const spark = Array.from(
          { length: 12 },
          (_, i) =>
            new Set(
              c.members
                .filter(
                  (m) =>
                    m.at >= now - 120000 + i * 10000 &&
                    m.at < now - 110000 + i * 10000,
                )
                .map((m) => m.userId),
            ).size,
        );
        const recent = new Set(
          c.members.filter((m) => m.at >= now - 60000).map((m) => m.userId),
        ).size;
        const prev = new Set(
          c.members.filter((m) => m.at < now - 60000).map((m) => m.userId),
        ).size;
        return {
          id: c.id,
          label,
          approved: Boolean(safe[word] || c.key),
          pinned: false,
          hidden: false,
          messages: c.members.length,
          contributors: people.size,
          share: participants ? people.size / participants : 0,
          repetition: (c.members.length - people.size) / c.members.length,
          trend: recent - prev,
          spark,
          evidence: c.members.slice(-12).reverse(),
          kind: c.key
            ? "emote"
            : c.members.some((m) => /\?/.test(m.text))
              ? "question"
              : c.members.some((m) =>
                    /\b(should|suggest|let'?s|please play)\b/i.test(m.text),
                  )
                ? "suggestion"
                : "discussion",
          x: c.x,
          y: c.y,
          memberIds: c.members.map((m) => m.id),
        };
      })
      .filter(
        (t) => t.contributors >= 3 || manual.some((x) => x.topic_id === t.id),
      );
    parentPort.postMessage({
      sessionId,
      topics,
      coverage,
      queue: 0,
      provider,
      modelError,
      generation,
    });
  },
);
