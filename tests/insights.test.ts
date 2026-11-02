import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/server/src/app.ts";
import { Store } from "../apps/server/src/store.ts";
import { intentOf } from "../apps/server/src/topic-language.mjs";
import type { Topic } from "../packages/shared/src/index.ts";
const origin = "http://localhost:5173";

test("timestamped evidence is owner-only, bucket-exact, and respects deletion and expiry", async () => {
  const { app, store, analysis, snapshot } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    const auth = await app.inject({
      method: "POST",
      url: "/api/demo/bootstrap",
      headers: { origin, "x-chatlas-client": "dashboard" },
      payload: {},
    });
    const cookie = auth.cookies.find((c) => c.name === "chatlas")!;
    const headers = {
      origin,
      "x-chatlas-client": "dashboard",
      cookie: `chatlas=${cookie.value}`,
    };
    const session = store.start("demo");
    const now = Date.now();
    for (let i = 0; i < 5; i++)
      store.ingest(session.id, {
        id: `m${i}`,
        userId: `u${i}`,
        name: "Test person",
        text:
          i === 4
            ? "No Minecraft again please"
            : "Please play Minecraft survival",
        at: now - (i < 3 ? 15000 : 75000),
        arrival: now,
        emotes: [],
      });
    analysis.update(session.id, store.messages(session.id, now), now);
    for (let i = 0; i < 200 && analysis.busy; i++)
      await new Promise((r) => setTimeout(r, 10));
    const topic = analysis.topics[0];
    assert.ok(topic);
    assert.equal(snapshot().analysis.windowEnd, now);
    assert.deepEqual(topic.periods, { recent: 3, previous: 2 });
    assert.equal(topic.intent?.disagreement, 1);
    const url = `/api/topics/${topic.id}/evidence?windowEnd=${now}&bucket=10`;
    assert.equal((await app.inject(url)).statusCode, 401);
    const result = await app.inject({ url, headers });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().total, 3);
    assert.equal(result.json().people, 3);
    assert.deepEqual(
      result
        .json()
        .messages.map((m: any) => m.id)
        .sort(),
      ["m0", "m1", "m2"],
    );
    assert.equal(
      (
        await app.inject({
          url: url.replace("bucket=10", "bucket=99"),
          headers,
        })
      ).statusCode,
      400,
    );
    store.moderate(session.id, { messageId: "m0" });
    assert.equal((await app.inject({ url, headers })).json().people, 2);
    const recap = await app.inject({
      url: `/api/sessions/${session.id}/recap`,
      headers,
    });
    assert.equal(recap.statusCode, 200);
    assert.equal(recap.json().sampleCount, 1);
    assert.ok(!JSON.stringify(recap.json()).includes("Test person"));
    assert.ok(!JSON.stringify(recap.json()).includes("Please play"));
    assert.equal(
      (await app.inject(`/api/sessions/${session.id}/recap`)).statusCode,
      401,
    );
    const prefs = {
      scale: 0.8,
      opacity: 0.9,
      mascot: false,
      topicCount: 2,
      safeArea: 48,
      preset: "gameplay",
    };
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/settings",
          headers,
          payload: { overlay: prefs },
        })
      ).statusCode,
      200,
    );
    assert.deepEqual(snapshot().settings.overlay, prefs);
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/settings",
          headers,
          payload: { overlay: { ...prefs, scale: 4 } },
        })
      ).statusCode,
      400,
    );
    const readiness = await app.inject({ url: "/api/readiness", headers });
    assert.equal(readiness.json().obsVerified, false);
    assert.equal(readiness.json().liveReceived, false);
    analysis.reset();
    assert.equal((await app.inject({ url, headers })).statusCode, 410);
  } finally {
    await app.close();
  }
});

test("sampled session recaps survive restart, record simulation, and cascade on deletion", () => {
  const directory = mkdtempSync(join(tmpdir(), "chatlas-recap-"));
  const path = join(directory, "test.sqlite");
  let store = new Store(path);
  try {
    const session = store.start("demo");
    const now = Date.now();
    const topic: Topic = {
      id: "topic",
      label: "Minecraft",
      approved: true,
      pinned: false,
      hidden: false,
      messages: 10,
      contributors: 5,
      share: 0.5,
      repetition: 0.5,
      trend: 0,
      spark: [],
      evidence: [],
      kind: "discussion",
      x: 0,
      y: 0,
    };
    store.saveSample(session.id, now, [topic], 10, 20, 1);
    store.saveSample(session.id, now + 1000, [topic], 10, 20, 1);
    assert.equal(store.recap(session.id).sampleCount, 1);
    store.set("testUniqueMessages", true);
    store.saveSample(
      session.id,
      now + 15000,
      [
        { ...topic, id: "new-topic-id", contributors: 8 },
        { ...topic, id: "duplicate-label", contributors: 3 },
      ],
      12,
      24,
      0.8,
    );
    store.end();
    store.db.close();
    store = new Store(path);
    const recap = store.recap(session.id);
    assert.equal(recap.sampleCount, 2);
    assert.equal(recap.topics[0].peakPeople, 8);
    assert.equal(recap.topics.length, 1);
    assert.equal(recap.topics[0].samples, 2);
    assert.equal(recap.samples[1].simulated, true);
    assert.ok(recap.session.endedAt);
    store.run("DELETE FROM analysis_sessions WHERE id=?", session.id);
    assert.equal(store.get("SELECT COUNT(*) n FROM analysis_samples").n, 0);
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("language rules preserve disagreement rather than interpreting mentions as support", () => {
  assert.deepEqual(intentOf("No Minecraft again please"), {
    suggestions: false,
    disagreement: true,
    questions: false,
  });
  assert.deepEqual(intentOf("Could we play Minecraft?"), {
    suggestions: true,
    disagreement: false,
    questions: true,
  });
  assert.deepEqual(intentOf("Minecraft"), {
    suggestions: false,
    disagreement: false,
    questions: false,
  });
});

test("open-ended labels extract recurring subjects rather than relying on a topic whitelist", async () => {
  const { inferTopicLabel } =
    await import("../apps/server/src/topic-language.mjs");
  const messages = [
    "pewdiepie",
    "long time pewdiepie has been on youtube",
    "pewdiepie is doing what",
    "what is pewdiepie doing",
  ].map((text, i) => ({ text, id: String(i), userId: `u${i}` }));
  assert.deepEqual(inferTopicLabel(messages), {
    label: "Pewdiepie discussion",
    source: "extracted",
    approved: false,
  });
  const novel = [
    "Asterforge crafting mechanics",
    "Asterforge has new mechanics",
    "Asterforge looks interesting",
  ].map((text, i) => ({ text, userId: String(i) }));
  assert.equal(inferTopicLabel(novel).label, "Asterforge discussion");
  const phrase = [
    "Elden Ring tonight",
    "Please play Elden Ring",
    "What about Elden Ring?",
  ].map((text, i) => ({ text, userId: String(i) }));
  assert.equal(inferTopicLabel(phrase).label, "Elden Ring discussion");
  const noise = ["sunrise", "ocean", "garden"].map((text, i) => ({
    text,
    userId: String(i),
  }));
  assert.equal(inferTopicLabel(noise).source, "fallback");
  assert.equal(
    inferTopicLabel(messages.map((m) => ({ ...m, userId: "one" }))).source,
    "fallback",
  );
  const known = [
    "minecraft tonight",
    "minecraft tonight again",
    "please play minecraft tonight",
  ].map((text, i) => ({ text, userId: String(i) }));
  assert.equal(
    inferTopicLabel(known, undefined, { minecraft: "Minecraft discussion" })
      .approved,
    true,
  );
});

test("screenshot-style simulated chat gets an extracted label and remains private until approved", async () => {
  const { app, store, analysis, snapshot } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    const session = store.start("demo");
    store.set("testUniqueMessages", true);
    const now = Date.now();
    const texts = [
      "pewdiepie",
      "long time pewdiepie has been on youtube",
      "pewdiepie is doing what",
      "what is pewdiepie doing",
    ];
    texts.forEach((text, i) =>
      store.ingest(session.id, {
        id: `screenshot-${i}`,
        userId: "one-account",
        name: "Tester",
        text,
        at: now - 1,
        arrival: now,
        emotes: [],
      }),
    );
    analysis.update(session.id, store.messages(session.id, now), now);
    for (let i = 0; i < 200 && analysis.busy; i++)
      await new Promise((r) => setTimeout(r, 10));
    const topic = analysis.topics.find((t) => /pewdiepie/i.test(t.label));
    assert.ok(topic);
    assert.equal(topic.labelSource, "extracted");
    assert.equal(topic.contributors, 4);
    assert.equal(topic.approved, false);
    assert.equal(snapshot("overlay").topics.length, 0);
    const auth = await app.inject({
      method: "POST",
      url: "/api/demo/bootstrap",
      headers: { origin, "x-chatlas-client": "dashboard" },
      payload: {},
    });
    const cookie = auth.cookies.find((c) => c.name === "chatlas")!;
    const headers = {
      origin,
      "x-chatlas-client": "dashboard",
      cookie: `chatlas=${cookie.value}`,
    };
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/topics/${topic.id}`,
          headers,
          payload: { label: topic.label },
        })
      ).statusCode,
      200,
    );
    for (let i = 0; i < 200 && analysis.busy; i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(snapshot("overlay").topics[0]?.label, "Pewdiepie discussion");
  } finally {
    await app.close();
  }
});
