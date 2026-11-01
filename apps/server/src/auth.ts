import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config, twitchConfigured } from "./config.ts";
import { Store, hash } from "./store.ts";
export const randomToken = () => randomBytes(32).toString("base64url");
export function encrypt(value: unknown, key = config.TOKEN_ENCRYPTION_KEY!) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}
export function decrypt(value: string, key = config.TOKEN_ENCRYPTION_KEY!) {
  const b = Buffer.from(value, "base64"),
    c = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      b.subarray(0, 12),
    );
  c.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(),
  );
}
export function cookie(
  reply: FastifyReply,
  name: string,
  value: string,
  maxAge = 86400,
) {
  reply.setCookie(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.APP_ORIGIN.startsWith("https:"),
    path: "/",
    maxAge,
  });
}
export class Auth {
  refreshPromise: Promise<any> | null = null;
  constructor(public store: Store) {}
  session(req: FastifyRequest) {
    const token = req.cookies.chatlas;
    return token
      ? this.store.get(
          "SELECT * FROM dashboard_sessions WHERE hash=? AND expires>?",
          hash(token),
          Date.now(),
        )
      : null;
  }
  create(reply: FastifyReply, role = "owner") {
    const token = randomToken();
    this.store.run(
      "INSERT INTO dashboard_sessions VALUES(?,?,?)",
      hash(token),
      Date.now() + 86400000,
      role,
    );
    cookie(reply, "chatlas", token);
  }
  requireOwner(req: FastifyRequest) {
    if (this.session(req)?.role !== "owner")
      throw Object.assign(new Error("Owner authentication required"), {
        statusCode: 401,
      });
  }
  csrf(req: FastifyRequest) {
    if (
      req.headers.origin !== config.APP_ORIGIN ||
      req.headers["x-chatlas-client"] !== "dashboard"
    )
      throw Object.assign(new Error("Invalid request origin"), {
        statusCode: 403,
      });
  }
  connection() {
    const c = this.store.get("SELECT * FROM channel_connections LIMIT 1");
    return c ? { ...c, tokens: decrypt(c.tokens) } : null;
  }
  async token() {
    const c = this.connection();
    if (!c) throw new Error("Twitch authorization required");
    if (c.tokens.expiresAt > Date.now() + 60000) return c.tokens.access_token;
    if (!this.refreshPromise)
      this.refreshPromise = this.refresh(c).finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }
  async refresh(c: any) {
    const r = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: c.tokens.refresh_token,
        client_id: config.TWITCH_CLIENT_ID!,
        client_secret: config.TWITCH_CLIENT_SECRET!,
      }),
    });
    if (!r.ok) {
      this.invalidate();
      throw new Error("Twitch authorization expired");
    }
    const tokens = (await r.json()) as any;
    this.store.run(
      "UPDATE channel_connections SET tokens=? WHERE id=?",
      encrypt({ ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 }),
      c.id,
    );
    return tokens.access_token;
  }
  invalidate() {
    this.store.run("DELETE FROM channel_connections");
    this.store.run("DELETE FROM dashboard_sessions");
    this.store.run("DELETE FROM overlay_credentials");
  }
  async validate() {
    const c = this.connection();
    if (!c) return;
    const token = await this.token();
    const r = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: "OAuth " + token },
    });
    if (!r.ok) {
      this.invalidate();
      throw new Error("Twitch token validation failed");
    }
    const identity = (await r.json()) as any;
    if (
      identity.user_id !== c.id ||
      identity.client_id !== config.TWITCH_CLIENT_ID ||
      !identity.scopes.includes("user:read:chat")
    ) {
      this.invalidate();
      throw new Error("Twitch identity or required scope mismatch");
    }
  }
  routes(
    app: FastifyInstance,
    onConnect: () => Promise<void>,
    onDisconnect: () => void,
  ) {
    app.get("/auth/twitch/start", async (req, reply) => {
      if (this.connection()) this.requireOwner(req);
      if (!twitchConfigured)
        return reply.code(503).send({
          error:
            "Configure Twitch credentials, SESSION_SECRET and TOKEN_ENCRYPTION_KEY in environment settings first.",
        });
      const state = randomToken(),
        browser = randomToken();
      this.store.run(
        "INSERT INTO oauth_states VALUES(?,?,?)",
        hash(state),
        hash(browser),
        Date.now() + 600000,
      );
      cookie(reply, "chatlas_oauth", browser, 600);
      const url = new URL("https://id.twitch.tv/oauth2/authorize");
      url.search = new URLSearchParams({
        client_id: config.TWITCH_CLIENT_ID!,
        redirect_uri: config.APP_ORIGIN + "/auth/twitch/callback",
        response_type: "code",
        scope: "user:read:chat",
        state,
      }).toString();
      return reply.redirect(url.toString());
    });
    app.get("/auth/twitch/callback", async (req, reply) => {
      const q = req.query as any;
      const row =
        typeof q.state === "string"
          ? this.store.get(
              "SELECT * FROM oauth_states WHERE hash=?",
              hash(q.state),
            )
          : null;
      if (
        !row ||
        row.expires < Date.now() ||
        !req.cookies.chatlas_oauth ||
        row.browser_hash !== hash(req.cookies.chatlas_oauth)
      )
        return reply.code(400).send({
          error: "Invalid or expired OAuth state. Start authorization again.",
        });
      this.store.run("DELETE FROM oauth_states WHERE hash=?", hash(q.state));
      reply.clearCookie("chatlas_oauth", { path: "/" });
      if (typeof q.code !== "string")
        return reply
          .code(400)
          .send({ error: "Twitch authorization was not completed" });
      const r = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: config.TWITCH_CLIENT_ID!,
          client_secret: config.TWITCH_CLIENT_SECRET!,
          code: q.code,
          grant_type: "authorization_code",
          redirect_uri: config.APP_ORIGIN + "/auth/twitch/callback",
        }),
      });
      if (!r.ok) throw new Error("Twitch code exchange failed");
      const tokens = (await r.json()) as any;
      const v = await fetch("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: "OAuth " + tokens.access_token },
      });
      if (!v.ok) throw new Error("Twitch identity validation failed");
      const identity = (await v.json()) as any;
      if (
        (this.store.setting("ownerId", null) &&
          this.store.setting("ownerId", null) !== identity.user_id) ||
        identity.client_id !== config.TWITCH_CLIENT_ID ||
        !identity.scopes?.includes("user:read:chat")
      )
        throw new Error("Twitch did not grant user:read:chat");
      this.store.set("ownerId", identity.user_id);
      onDisconnect();
      this.store.end();
      this.store.run("DELETE FROM channel_connections");
      this.store.run("DELETE FROM dashboard_sessions");
      this.store.run("DELETE FROM overlay_credentials");
      this.store.run(
        "INSERT INTO channel_connections VALUES(?,?,?)",
        identity.user_id,
        identity.login,
        encrypt({
          ...tokens,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
      );
      this.create(reply);
      await onConnect();
      return reply.redirect(config.APP_ORIGIN);
    });
  }
}
