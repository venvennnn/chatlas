import Fastify from "fastify";
import cookies from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { Store, hash } from "./store.ts";
import { Auth, randomToken, cookie } from "./auth.ts";
import { Analysis } from "./analysis.ts";
import { Twitch } from "./twitch.ts";
import { importReplay, controlReplay, tickReplay } from "./replay.ts";
import { seedDemo, demoMessage } from "./demo.ts";
import { config, twitchConfigured, projectRoot } from "./config.ts";
import type { Snapshot } from "../../../packages/shared/src/index.ts";
export async function createApp(
  path = config.DATABASE_PATH,
  options: { background?: boolean; model?: string } = {},
) {
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  await app.register(cookies);
  const store = new Store(path),
    auth = new Auth(store),
    analysis = new Analysis(store, options.model);
  let revision = Date.now(),
    demoCounter = 0,
    lastPurge = 0;
  const clients = new Map<WebSocket, "owner" | "overlay">();
  const clientHashes = new Map<WebSocket, string>();
  const changed = () => {
    revision++;
  };
  const twitch = new Twitch(store, auth, changed, () => {
    analysis.reset();
    refresh();
  });
  const settings = () => ({
    paused: store.setting("paused", false),
    showEvidence: store.setting("showEvidence", false),
    area: store.setting("area", "people"),
  });
  const snapshot = (role: "owner" | "overlay" = "owner"): Snapshot => {
    const session = store.current(),
      messages = session ? store.messages(session.id) : [],
      decisions = session ? store.decisions(session.id) : [];
    const ts = settings();
    const topics = analysis.topics.filter((t) => !t.hidden);
    const safeTopics = topics
      .filter((t) => t.approved)
      .map((t) => ({ ...t, evidence: ts.showEvidence ? t.evidence : [] }));
    return {
      schemaVersion: 1,
      revision,
      session,
      connection: {
        state: twitch.state,
        channel: auth.connection()?.channel ?? null,
        configured: twitchConfigured,
      },
      analysis: {
        provider: analysis.provider,
        coverage: analysis.coverage,
        queue: analysis.queue,
        windowSeconds: 120,
      },
      topics: role === "overlay" ? (ts.paused ? [] : safeTopics) : topics,
      decision:
        decisions.find((d) => d.state === "open") ??
        decisions.find((d) => d.state === "closed") ??
        (role === "owner" ? decisions[0] : null) ??
        null,
      decisions: role === "owner" ? decisions : [],
      participants: new Set(messages.map((m) => m.userId)).size,
      messageCount: messages.length,
      timeline: Array.from(
        { length: 24 },
        (_, i) =>
          messages.filter(
            (m) =>
              m.at >= Date.now() - 120000 + i * 5000 &&
              m.at < Date.now() - 115000 + i * 5000,
          ).length,
      ),
      playback: (() => {
        const p = store.setting("playback", null);
        return p?.sessionId === session?.id
          ? {
              paused: p.paused,
              speed: p.speed,
              positionMs:
                p.cursor + (p.paused ? 0 : (Date.now() - p.wallAt) * p.speed),
            }
          : {
              paused: store.setting("demoPaused", false),
              speed: store.setting("demoSpeed", 1),
              positionMs: null,
            };
      })(),
      gaps: twitch.gaps,
      settings: ts,
      sessions: role === "owner" ? store.sessions() : [],
    };
  };
  const refresh = () => {
    const s = store.current();
    if (s) analysis.update(s.id, store.messages(s.id));
    else analysis.reset();
    changed();
  };
  app.setErrorHandler((err: any, _req, reply) => {
    reply.code(err.statusCode ?? (err instanceof z.ZodError ? 400 : 409)).send({
      error:
        err instanceof z.ZodError
          ? err.issues
              .map((i: any) => i.path.join(".") + ": " + i.message)
              .join("; ")
          : err.message,
    });
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Cache-Control", "no-store");
    if (
      req.url.startsWith("/api/") &&
      req.method !== "GET" &&
      req.url !== "/api/overlay/bootstrap"
    ) {
      auth.csrf(req);
      if (req.url !== "/api/demo/bootstrap") auth.requireOwner(req);
    }
  });
  const owner = async (req: any) => auth.requireOwner(req);
  const idem = (req: any, fn: () => any) => {
    const key = z
      .string()
      .min(8)
      .max(150)
      .parse(req.headers["idempotency-key"]);
    const request = JSON.stringify({ url: req.url, body: req.body ?? null });
    const old = store.get("SELECT * FROM idempotency WHERE key=?", key);
    if (old) {
      if (old.request !== request)
        throw new Error("Idempotency key reused for a different request");
      return JSON.parse(old.response);
    }
    const result = fn();
    store.run(
      "INSERT INTO idempotency VALUES(?,?,?,?)",
      key,
      request,
      JSON.stringify(result),
      Date.now(),
    );
    changed();
    return result;
  };
  app.get("/api/health", () => ({
    ok: true,
    schemaVersion: 1,
    database: "ready",
  }));
  app.post("/api/demo/bootstrap", async (req, reply) => {
    if (auth.connection() || store.setting("ownerId", null))
      return reply
        .code(403)
        .send({ error: "Sign in through Twitch to control this installation" });
    auth.create(reply);
    return { ok: true };
  });
  app.get("/api/snapshot", { preHandler: owner }, () => snapshot());
  app.get("/api/sessions/:id", { preHandler: owner }, (req) => {
    const id = (req.params as any).id;
    const session = store.sessions().find((s) => s.id === id);
    if (!session)
      throw Object.assign(new Error("Session not found"), { statusCode: 404 });
    return { session, decisions: store.decisions(id) };
  });
  app.get(
    "/api/connection",
    { preHandler: owner },
    () => snapshot().connection,
  );
  app.post("/api/sessions/start", (req) =>
    idem(req, () => {
      const { source } = z
        .object({ source: z.enum(["demo", "live", "replay"]) })
        .parse(req.body);
      if (source === "live" && !auth.connection())
        throw new Error("Authorize the broadcaster first");
      if (source !== "live" && twitch.state === "live") twitch.stop();
      const s = store.start(source)!;
      twitch.gaps = [];
      analysis.reset();
      if (source === "demo") seedDemo(store, s.id);
      refresh();
      return s;
    }),
  );
  app.post("/api/sessions/end", (req) =>
    idem(req, () => {
      store.end();
      analysis.reset();
      twitch.stop();
      return { ok: true };
    }),
  );
  app.delete("/api/sessions/:id", (req) => {
    const { id } = req.params as any;
    if (store.current()?.id === id) {
      store.end();
      analysis.reset();
      twitch.stop();
    }
    store.run("DELETE FROM audit_events WHERE session_id=?", id);
    store.run("DELETE FROM idempotency");
    store.run("DELETE FROM analysis_sessions WHERE id=?", id);
    changed();
    return { ok: true };
  });
  app.post("/api/demo/reset", (req) =>
    idem(req, () => {
      const s = store.current();
      if (s?.source === "live")
        throw new Error("Demo controls cannot modify Live sessions");
      if (s) {
        store.end();
        store.run("DELETE FROM audit_events WHERE session_id=?", s.id);
        store.run("DELETE FROM analysis_sessions WHERE id=?", s.id);
      }
      const next = store.start("demo")!;
      analysis.reset();
      seedDemo(store, next.id);
      refresh();
      return next;
    }),
  );
  app.post("/api/replay/control", (req) => {
    const b = z
      .object({
        paused: z.boolean().optional(),
        speed: z.number().min(0.25).max(4).optional(),
      })
      .parse(req.body);
    if (store.current()?.source === "live")
      throw new Error("Replay controls are unavailable in Live mode");
    controlReplay(store, b);
    if (b.paused !== undefined) store.set("demoPaused", b.paused);
    if (b.speed !== undefined) store.set("demoSpeed", b.speed);
    return { ok: true };
  });
  app.post("/api/demo/messages", (req) => {
    const b = z
      .object({
        text: z.string().min(1).max(500),
        userId: z.string().min(1).max(100).default("you"),
      })
      .parse(req.body);
    const s = store.current();
    if (!s || s.source !== "demo")
      throw new Error("Synthetic messages are allowed only in Demo sessions");
    store.ingest(s.id, {
      id: randomToken(),
      userId: s.source + ":" + b.userId,
      name: b.userId,
      text: b.text,
      at: Date.now(),
      arrival: Date.now(),
      emotes: [],
    });
    refresh();
    return { ok: true };
  });
  app.post("/api/replay/import", (req) => {
    const b = z
      .object({
        lines: z.string().min(1).max(60000),
        synthetic: z.boolean().default(true),
      })
      .parse(req.body);
    const s = store.current();
    if (!s || s.source === "live")
      throw new Error("Start a Demo or Replay session first");
    if (
      (b.synthetic && s.source !== "demo") ||
      (!b.synthetic && s.source !== "replay")
    )
      throw new Error(
        "Synthetic fixtures require DEMO mode; consented recordings require REPLAY mode",
      );
    const count = importReplay(store, s.id, b.lines);
    store.run("DELETE FROM chat_messages WHERE session_id=?", s.id);
    analysis.reset();
    store.set("demoPaused", true);
    store.audit(
      s.id,
      "replay.import",
      b.synthetic ? "synthetic" : "consented recording",
    );
    return { imported: count };
  });
  app.get(
    "/api/topics/:id",
    { preHandler: owner },
    (req) => analysis.topics.find((t) => t.id === (req.params as any).id) ?? {},
  );
  app.patch("/api/topics/:id", (req) => {
    const b = z
      .object({
        label: z.string().trim().min(1).max(80).optional(),
        hidden: z.boolean().optional(),
        pinned: z.boolean().optional(),
      })
      .parse(req.body);
    const s = store.current();
    const id = (req.params as any).id;
    if (!s || !analysis.topics.some((t) => t.id === id))
      throw new Error("Topic not found");
    const prior = store.get(
      "SELECT * FROM topics WHERE session_id=? AND id=?",
      s.id,
      id,
    );
    store.run(
      "INSERT OR REPLACE INTO topics VALUES(?,?,?,?,?,?)",
      s.id,
      id,
      b.label ?? prior?.label ?? null,
      b.label ? 1 : (prior?.approved ?? 0),
      b.hidden === undefined ? (prior?.hidden ?? 0) : Number(b.hidden),
      b.pinned === undefined ? (prior?.pinned ?? 0) : Number(b.pinned),
    );
    store.audit(s.id, "topic.edit", id);
    refresh();
    return { ok: true };
  });
  app.post("/api/topics/merge", (req) => {
    const b = z
      .object({
        ids: z.array(z.string()).min(2).max(8),
        label: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    const s = store.current();
    if (!s || b.ids.some((id) => !analysis.topics.some((t) => t.id === id)))
      throw new Error("Select current topics to merge");
    const id = randomToken();
    store.transaction(() => {
      for (const old of b.ids) {
        for (const m of store.all(
          "SELECT message_id FROM topic_memberships WHERE session_id=? AND topic_id=?",
          s.id,
          old,
        ))
          store.run(
            "INSERT OR REPLACE INTO manual_memberships VALUES(?,?,?)",
            s.id,
            m.message_id,
            id,
          );
        store.run(
          "INSERT OR REPLACE INTO topics VALUES(?,?,NULL,0,1,0)",
          s.id,
          old,
        );
      }
      store.run("INSERT INTO topics VALUES(?,?,?,1,0,0)", s.id, id, b.label);
      store.audit(s.id, "topic.merge", JSON.stringify({ from: b.ids, to: id }));
    });
    analysis.reset();
    refresh();
    return { id };
  });
  app.post("/api/topics/:id/split", (req) => {
    const b = z
      .object({
        messageIds: z.array(z.string()).min(1).max(200),
        label: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    const s = store.current(),
      old = (req.params as any).id;
    if (!s) throw new Error("No session");
    const members = store
      .all(
        "SELECT message_id FROM topic_memberships WHERE session_id=? AND topic_id=?",
        s.id,
        old,
      )
      .map((m) => m.message_id);
    if (
      b.messageIds.some((id) => !members.includes(id)) ||
      b.messageIds.length >= members.length
    )
      throw new Error("Select some, but not all, messages from this topic");
    const id = randomToken();
    store.transaction(() => {
      for (const m of members)
        store.run(
          "INSERT OR REPLACE INTO manual_memberships VALUES(?,?,?)",
          s.id,
          m,
          b.messageIds.includes(m) ? id : old,
        );
      store.run("INSERT INTO topics VALUES(?,?,?,1,0,0)", s.id, id, b.label);
      store.audit(s.id, "topic.split", JSON.stringify({ from: old, to: id }));
    });
    analysis.reset();
    refresh();
    return { id };
  });
  app.post("/api/decisions", (req) =>
    idem(req, () => {
      const b = z
        .object({
          question: z.string().trim().min(3).max(180),
          options: z
            .array(z.string().trim().min(1).max(70))
            .min(2)
            .max(5)
            .refine(
              (a) => new Set(a.map((s) => s.toLowerCase())).size === a.length,
              "Options must be distinct",
            ),
          duration: z.number().int().min(30).max(300),
        })
        .parse(req.body);
      const s = store.current();
      if (!s) throw new Error("Start a session first");
      return store.createDecision(s.id, b.question, b.options, b.duration);
    }),
  );
  for (const action of ["open", "close", "cancel"])
    app.post("/api/decisions/:id/" + action, (req) =>
      idem(req, () => {
        const id = (req.params as any).id;
        const d = store.decision(id);
        if (d.sessionId !== store.current()?.id)
          throw new Error("Decision belongs to another session");
        return action === "open"
          ? store.open(id)
          : store.close(id, action === "cancel");
      }),
    );
  app.patch("/api/settings", (req) => {
    const b = z
      .object({
        paused: z.boolean().optional(),
        showEvidence: z.boolean().optional(),
        area: z.enum(["people", "messages"]).optional(),
      })
      .parse(req.body);
    for (const [k, v] of Object.entries(b)) store.set(k, v);
    store.audit(store.current()?.id ?? null, "settings.update");
    changed();
    return settings();
  });
  app.post("/api/moderate", (req) => {
    const b = z
      .object({
        messageId: z.string().optional(),
        userId: z.string().optional(),
      })
      .parse(req.body);
    const s = store.current();
    if (!s) throw new Error("No active session");
    store.moderate(s.id, b);
    analysis.reset();
    refresh();
    return { ok: true };
  });
  app.post("/api/overlay/rotate", () => {
    const token = randomToken();
    store.transaction(() => {
      store.run("DELETE FROM overlay_credentials");
      store.run("DELETE FROM dashboard_sessions WHERE role='overlay'");
      store.run(
        "INSERT INTO overlay_credentials VALUES(?,?)",
        hash(token),
        Date.now(),
      );
    });
    for (const [ws, role] of clients)
      if (role === "overlay") ws.close(4001, "Credential rotated");
    store.audit(store.current()?.id ?? null, "overlay.rotate");
    return { token };
  });
  const overlaySession = (req: any) =>
    req.cookies.chatlas_overlay &&
    store.get(
      "SELECT 1 FROM dashboard_sessions WHERE hash=? AND role='overlay' AND expires>?",
      hash(req.cookies.chatlas_overlay),
      Date.now(),
    );
  app.post("/api/overlay/bootstrap", async (req, reply) => {
    if (req.headers.origin !== config.APP_ORIGIN)
      return reply.code(403).send({ error: "Invalid overlay origin" });
    const b = z.object({ token: z.string().max(100) }).parse(req.body);
    if (
      !store.get(
        "SELECT 1 FROM overlay_credentials WHERE hash=?",
        hash(b.token),
      )
    )
      return reply
        .code(401)
        .send({ error: "Overlay credential expired or invalid" });
    const token = randomToken();
    store.run(
      "INSERT INTO dashboard_sessions VALUES(?,?,?)",
      hash(token),
      Date.now() + 86400000,
      "overlay",
    );
    cookie(reply, "chatlas_overlay", token);
    return { ok: true };
  });
  app.get("/api/overlay/snapshot", async (req, reply) => {
    if (!overlaySession(req))
      return reply.code(401).send({ error: "Overlay authentication required" });
    return snapshot("overlay");
  });
  auth.routes(
    app,
    async () => {
      if (store.current()?.source === "live") await twitch.start();
    },
    () => twitch.stop(),
  );
  app.post("/api/connection/connect", async () => {
    if (!auth.connection()) throw new Error("Authorize Twitch first");
    await twitch.start();
    return { ok: true };
  });
  app.post("/api/auth/disconnect", async (_req, reply) => {
    twitch.stop();
    store.end();
    auth.invalidate();
    analysis.reset();
    for (const ws of clients.keys()) ws.close(4001, "Disconnected");
    reply.clearCookie("chatlas", { path: "/" });
    reply.clearCookie("chatlas_overlay", { path: "/" });
    return { ok: true };
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  app.server.on("upgrade", (req, socket, head) => {
    if (
      !["/ws", "/ws/overlay"].includes(req.url ?? "") ||
      req.headers.origin !== config.APP_ORIGIN
    ) {
      socket.destroy();
      return;
    }
    const parsed = app.parseCookie(req.headers.cookie ?? "");
    const role = req.url === "/ws/overlay" ? "overlay" : "owner";
    const token = role === "overlay" ? parsed.chatlas_overlay : parsed.chatlas;
    const row =
      token &&
      store.get(
        "SELECT * FROM dashboard_sessions WHERE hash=? AND expires>? AND role=?",
        hash(token),
        Date.now(),
        role,
      );
    if (!row) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.set(ws, role);
      clientHashes.set(ws, hash(token!));
      ws.send(JSON.stringify({ type: "snapshot", ...snapshot(role) }));
      ws.on("message", () => ws.close(1008, "Read-only subscription"));
      ws.on("close", () => {
        clients.delete(ws);
        clientHashes.delete(ws);
      });
    });
  });
  const web = resolve(projectRoot, "apps/web/dist");
  if (existsSync(web)) {
    await app.register(staticFiles, { root: web });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found" })
        : reply.sendFile("index.html"),
    );
  }
  const timer = setInterval(() => {
    if (options.background === false) return;
    store.tick();
    if (tickReplay(store)) analysis.reset();
    const s = store.current();
    if (
      s?.source === "demo" &&
      !store.setting("demoPaused", false) &&
      store.setting("playback", null)?.sessionId !== s.id
    ) {
      const speed = store.setting("demoSpeed", 1);
      for (let i = 0; i < Math.ceil(speed * 2); i++)
        demoMessage(store, s.id, demoCounter++);
    }
    refresh();
    for (const [ws, role] of clients)
      if (ws.readyState === WebSocket.OPEN) {
        if (
          !store.get(
            "SELECT 1 FROM dashboard_sessions WHERE hash=? AND expires>?",
            clientHashes.get(ws)!,
            Date.now(),
          )
        ) {
          ws.close(4001, "Session expired");
          continue;
        }
        if (ws.bufferedAmount > 1000000) {
          ws.close(1013, "Slow consumer");
          continue;
        }
        ws.send(JSON.stringify({ type: "snapshot", ...snapshot(role) }));
      }
    if (Date.now() - lastPurge > 60000) {
      store.purge();
      lastPurge = Date.now();
    }
  }, 1000);
  timer.unref();
  const validation = setInterval(
    () =>
      auth.validate().catch(() => {
        twitch.stop();
        twitch.set(
          auth.connection() ? "disconnected" : "authorization required",
        );
      }),
    3600000,
  );
  validation.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    clearInterval(validation);
    twitch.stop();
    for (const ws of clients.keys()) ws.terminate();
    wss.close();
    await analysis.stop();
    store.db.close();
  });
  if (auth.connection()) {
    if (store.current()?.source === "live")
      store.audit(
        store.current()!.id,
        "ingestion.gap",
        "Process restarted; disconnected events are not replayed",
      );
    try {
      await auth.validate();
      if (store.current()?.source === "live") await twitch.start();
    } catch {
      twitch.set(auth.connection() ? "disconnected" : "authorization required");
    }
  }
  return { app, store, auth, analysis, twitch, snapshot, refresh };
}
