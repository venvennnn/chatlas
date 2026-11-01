import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../apps/server/src/app.ts";
import { hash } from "../apps/server/src/store.ts";
const origin = "http://localhost:5173";
test("owner auth, CSRF, idempotency, overlay isolation and rotation", async () => {
  const { app } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    assert.equal((await app.inject("/api/snapshot")).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo/bootstrap",
          payload: {},
        })
      ).statusCode,
      403,
    );
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/demo/bootstrap",
      headers: { origin, "x-chatlas-client": "dashboard" },
      payload: {},
    });
    assert.equal(bootstrap.statusCode, 200);
    const cookie = bootstrap.cookies.find((c) => c.name === "chatlas")!;
    const headers = {
      origin,
      "x-chatlas-client": "dashboard",
      cookie: `chatlas=${cookie.value}`,
      "idempotency-key": randomUUID(),
    };
    const start = await app.inject({
      method: "POST",
      url: "/api/sessions/start",
      headers,
      payload: { source: "demo" },
    });
    assert.equal(start.statusCode, 200);
    const same = await app.inject({
      method: "POST",
      url: "/api/sessions/start",
      headers,
      payload: { source: "demo" },
    });
    assert.equal(same.json().id, start.json().id);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/sessions/start",
          headers,
          payload: { source: "replay" },
        })
      ).statusCode,
      409,
    );
    const rotate = await app.inject({
      method: "POST",
      url: "/api/overlay/rotate",
      headers,
      payload: {},
    });
    const token = rotate.json().token;
    const overlay = await app.inject({
      method: "POST",
      url: "/api/overlay/bootstrap",
      headers: { origin },
      payload: { token },
    });
    assert.equal(overlay.statusCode, 200);
    const oc = overlay.cookies.find((c) => c.name === "chatlas_overlay")!;
    const oh = {
      origin,
      "x-chatlas-client": "dashboard",
      cookie: `chatlas_overlay=${oc.value}`,
    };
    const snap = await app.inject({
      url: "/api/overlay/snapshot",
      headers: oh,
    });
    assert.equal(snap.statusCode, 200);
    assert.deepEqual(snap.json().sessions, []);
    assert.deepEqual(snap.json().decisions, []);
    assert.ok(snap.json().topics.every((t: any) => t.evidence.length === 0));
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/decisions",
          headers: oh,
          payload: {},
        })
      ).statusCode,
      401,
    );
    await app.inject({
      method: "POST",
      url: "/api/overlay/rotate",
      headers,
      payload: {},
    });
    assert.equal(
      (await app.inject({ url: "/api/overlay/snapshot", headers: oh }))
        .statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
test("OAuth state is expiring, browser-bound, and single-use even on denial", async () => {
  const { app, store } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    store.run(
      "INSERT INTO oauth_states VALUES(?,?,?)",
      hash("state"),
      hash("browser"),
      Date.now() + 10000,
    );
    assert.equal(
      (await app.inject("/auth/twitch/callback?state=state")).statusCode,
      400,
    );
    const r = await app.inject({
      url: "/auth/twitch/callback?state=state&error=access_denied",
      headers: { cookie: "chatlas_oauth=browser" },
    });
    assert.equal(r.statusCode, 400);
    assert.equal(
      store.get("SELECT 1 FROM oauth_states WHERE hash=?", hash("state")),
      undefined,
    );
    assert.equal(
      (
        await app.inject({
          url: "/auth/twitch/callback?state=state&code=anything",
          headers: { cookie: "chatlas_oauth=browser" },
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
test("analysis promotes several contributors, expires evidence, keeps disagreement neutral", async () => {
  const { app, store, analysis } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    const s = store.start("demo");
    const now = Date.now();
    for (let i = 0; i < 4; i++)
      store.ingest(s.id, {
        id: String(i),
        userId: String(i),
        name: "Test",
        text: i === 3 ? "No Minecraft please" : "Please play Minecraft",
        at: now,
        arrival: now,
        emotes: [],
      });
    analysis.update(s.id, store.messages(s.id), now);
    for (let i = 0; i < 100 && !analysis.topics.length; i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.ok(analysis.topics.length > 0);
    assert.equal(analysis.topics[0].label, "Minecraft discussion");
    assert.equal(analysis.topics[0].contributors, 4);
    assert.equal(analysis.topics[0].messages, 4);
    assert.ok(analysis.topics[0].evidence.some((m) => m.text.startsWith("No")));
    analysis.update(s.id, [], now + 120001);
    for (let i = 0; i < 100 && analysis.busy; i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(analysis.topics.length, 0);
  } finally {
    await app.close();
  }
});

test("owner binding blocks anonymous Demo access to retained live history", async () => {
  const { app, store } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    store.set("ownerId", "bound-owner");
    const r = await app.inject({
      method: "POST",
      url: "/api/demo/bootstrap",
      headers: { origin, "x-chatlas-client": "dashboard" },
      payload: {},
    });
    assert.equal(r.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("manual merge and split persist memberships and audit lineage; session deletion cascades", async () => {
  const { app, store, analysis } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    const s = store.start("demo");
    const now = Date.now();
    for (let i = 0; i < 8; i++)
      store.ingest(s.id, {
        id: "m" + i,
        userId: "u" + i,
        name: "Synthetic",
        text: i < 4 ? "Please play Minecraft" : "Please play Valorant",
        at: now,
        arrival: now,
        emotes: [],
      });
    analysis.update(s.id, store.messages(s.id));
    for (let i = 0; i < 150 && analysis.topics.length < 2; i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(analysis.topics.length, 2);
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/demo/bootstrap",
      headers: { origin, "x-chatlas-client": "dashboard" },
      payload: {},
    });
    const token = bootstrap.cookies.find((c) => c.name === "chatlas")!;
    const headers = {
      origin,
      "x-chatlas-client": "dashboard",
      cookie: "chatlas=" + token.value,
    };
    const ids = analysis.topics.map((t) => t.id);
    const merge = await app.inject({
      method: "POST",
      url: "/api/topics/merge",
      headers,
      payload: { ids, label: "Game discussion" },
    });
    assert.equal(merge.statusCode, 200, merge.body);
    for (
      let i = 0;
      i < 150 && !analysis.topics.some((t) => t.id === merge.json().id);
      i++
    )
      await new Promise((r) => setTimeout(r, 20));
    const merged = analysis.topics.find((t) => t.id === merge.json().id);
    assert.ok(merged);
    assert.equal(merged.contributors, 8);
    assert.equal(merged.label, "Game discussion");
    const split = await app.inject({
      method: "POST",
      url: "/api/topics/" + merged.id + "/split",
      headers,
      payload: { messageIds: ["m0"], label: "Separate suggestion" },
    });
    assert.equal(split.statusCode, 200, split.body);
    for (
      let i = 0;
      i < 150 && !analysis.topics.some((t) => t.id === split.json().id);
      i++
    )
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(
      analysis.topics.find((t) => t.id === split.json().id)?.messages,
      1,
    );
    assert.ok(
      store
        .all("SELECT * FROM audit_events WHERE session_id=?", s.id)
        .some((e) => e.action === "topic.merge"),
    );
    await app.inject({
      method: "DELETE",
      url: "/api/sessions/" + s.id,
      headers,
    });
    assert.equal(store.all("SELECT * FROM chat_messages").length, 0);
    assert.equal(store.all("SELECT * FROM manual_memberships").length, 0);
    assert.equal(
      store.all("SELECT * FROM audit_events WHERE session_id=?", s.id).length,
      0,
    );
  } finally {
    await app.close();
  }
});

test("unpublished decisions stay private and synthetic input cannot enter Replay", async () => {
  const { app, store } = await createApp(":memory:", {
    background: false,
    model: "lexical",
  });
  try {
    const s = store.start("replay");
    store.createDecision(s.id, "Private draft", ["A", "B"], 30);
    store.run(
      "INSERT INTO dashboard_sessions VALUES(?,?,?)",
      hash("test-overlay"),
      Date.now() + 10000,
      "overlay",
    );
    const r = await app.inject({
      url: "/api/overlay/snapshot",
      headers: { cookie: "chatlas_overlay=test-overlay" },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().decision, null);
    store.run(
      "INSERT INTO dashboard_sessions VALUES(?,?,?)",
      hash("test-owner"),
      Date.now() + 10000,
      "owner",
    );
    const bad = await app.inject({
      url: "/api/demo/messages",
      method: "POST",
      headers: {
        origin,
        "x-chatlas-client": "dashboard",
        cookie: "chatlas=test-owner",
      },
      payload: { text: "Synthetic text" },
    });
    assert.equal(bad.statusCode, 409);
  } finally {
    await app.close();
  }
});
