import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { Twitch } from "../apps/server/src/twitch.ts";
import { Auth, encrypt } from "../apps/server/src/auth.ts";
import { Store, hash } from "../apps/server/src/store.ts";
import { config } from "../apps/server/src/config.ts";
import {
  importReplay,
  controlReplay,
  tickReplay,
} from "../apps/server/src/replay.ts";
const wait = (n: number) => new Promise((r) => setTimeout(r, n));
class Socket extends EventEmitter {
  close() {
    this.emit("close");
  }
  terminate() {
    this.emit("close");
  }
  message(type: string, payload: any, metadata: any = {}) {
    this.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          metadata: { message_type: type, ...metadata },
          payload,
        }),
      ),
    );
  }
}
test("simulated EventSub welcome, own-channel subscriptions, migration, lost connection, deduplication and revocation", async () => {
  const store = new Store(":memory:"),
    s = store.start("live");
  const sockets: Socket[] = [],
    subscriptions: any[] = [];
  let invalidated = false;
  const auth = {
    connection: () => ({ id: "owner", channel: "owner" }),
    token: async () => "synthetic",
    invalidate: () => {
      invalidated = true;
    },
  } as unknown as Auth;
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    subscriptions.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 202 });
  };
  const twitch = new Twitch(
    store,
    auth,
    () => {},
    () => {},
    () => {
      const ws = new Socket();
      sockets.push(ws);
      return ws as unknown as WebSocket;
    },
  );
  try {
    await twitch.start();
    sockets[0].message("session_welcome", {
      session: { id: "session-one", keepalive_timeout_seconds: 10 },
    });
    await wait(10);
    assert.equal(subscriptions.length, 4);
    assert.ok(
      subscriptions.every(
        (s) =>
          s.condition.broadcaster_user_id === "owner" &&
          s.condition.user_id === "owner" &&
          s.transport.session_id === "session-one",
      ),
    );
    assert.equal(twitch.state, "subscribing");
    const payload = {
      subscription: { type: "channel.chat.message" },
      event: {
        message_id: "message",
        broadcaster_user_id: "owner",
        chatter_user_id: "viewer",
        chatter_user_name: "Viewer",
        message: { text: "Minecraft discussion", fragments: [] },
      },
    };
    const metadata = {
      message_id: "delivery",
      message_timestamp: new Date().toISOString(),
    };
    sockets[0].message("notification", payload, metadata);
    sockets[0].message("notification", payload, metadata);
    await wait(5);
    assert.equal(twitch.state, "live");
    assert.equal(store.messages(s.id).length, 1);
    sockets[0].message("session_reconnect", {
      session: {
        reconnect_url: "wss://eventsub.wss.twitch.tv/ws?reconnect=synthetic",
      },
    });
    await wait(5);
    sockets[1].message("session_welcome", { session: { id: "migrated" } });
    await wait(5);
    assert.equal(subscriptions.length, 4);
    assert.equal(twitch.gaps.length, 0);
    sockets[1].close();
    assert.equal(twitch.state, "reconnecting");
    assert.equal(twitch.gaps.length, 1);
    await wait(2100);
    sockets[2].message("session_welcome", { session: { id: "fresh" } });
    await wait(10);
    assert.equal(subscriptions.length, 8);
    sockets[2].message("revocation", {
      subscription: { status: "authorization_revoked" },
    });
    assert.equal(twitch.state, "authorization required");
    assert.equal(invalidated, true);
  } finally {
    twitch.stop();
    globalThis.fetch = fetchOriginal;
    store.db.close();
  }
});
test("single-flight refresh persists rotated refresh token; invalid identity invalidates all credentials", async () => {
  const store = new Store(":memory:"),
    auth = new Auth(store),
    before = config.TOKEN_ENCRYPTION_KEY;
  config.TOKEN_ENCRYPTION_KEY = "34".repeat(32);
  const original = globalThis.fetch;
  let calls = 0;
  try {
    store.run(
      "INSERT INTO channel_connections VALUES(?,?,?)",
      "owner",
      "owner",
      encrypt({
        access_token: "expired",
        refresh_token: "old-refresh",
        expiresAt: 0,
      }),
    );
    store.run(
      "INSERT INTO overlay_credentials VALUES(?,?)",
      hash("overlay"),
      Date.now(),
    );
    globalThis.fetch = async () => {
      calls++;
      await wait(10);
      return Response.json({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
      });
    };
    assert.deepEqual(
      await Promise.all([auth.token(), auth.token(), auth.token()]),
      ["new-access", "new-access", "new-access"],
    );
    assert.equal(calls, 1);
    assert.equal(auth.connection().tokens.refresh_token, "rotated-refresh");
    globalThis.fetch = async () =>
      Response.json({ user_id: "wrong-user", client_id: "wrong", scopes: [] });
    await assert.rejects(() => auth.validate());
    assert.equal(auth.connection(), null);
    assert.equal(store.all("SELECT * FROM overlay_credentials").length, 0);
  } finally {
    globalThis.fetch = original;
    config.TOKEN_ENCRYPTION_KEY = before;
    store.db.close();
  }
});
test("replay pause/speed, separate identities, deletion race and duplicate event suppression", () => {
  const store = new Store(":memory:"),
    s = store.start("demo");
  try {
    const lines = [
      { type: "delete", id: "delete", messageId: "late", offset: 0 },
      {
        type: "message",
        id: "late",
        userId: "a",
        text: "Must remain deleted",
        offset: 10,
      },
      {
        type: "message",
        id: "visible",
        userId: "a",
        text: "Visible replay",
        offset: 20,
      },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    assert.equal(importReplay(store, s.id, lines), 3);
    controlReplay(store, { paused: true });
    store.set("playback", {
      ...store.setting("playback", null),
      wallAt: Date.now() - 1000,
    });
    tickReplay(store);
    assert.equal(store.messages(s.id).length, 0);
    controlReplay(store, { paused: false, speed: 4 });
    store.set("playback", {
      ...store.setting("playback", null),
      wallAt: Date.now() - 1000,
    });
    tickReplay(store);
    assert.equal(store.messages(s.id).length, 1);
    assert.equal(store.messages(s.id)[0].userId, "replay:a");
    tickReplay(store);
    assert.equal(store.messages(s.id).length, 1);
  } finally {
    store.db.close();
  }
});
