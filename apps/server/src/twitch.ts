import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { validateNotification } from "./normalization.ts";
import type { ConnectionState } from "../../../packages/shared/src/index.ts";
import { config } from "./config.ts";
import type { Auth } from "./auth.ts";
import type { Store } from "./store.ts";
export class Twitch {
  state: ConnectionState = "disconnected";
  socket: WebSocket | null = null;
  pending: WebSocket | null = null;
  watchdog: NodeJS.Timeout | null = null;
  retry: NodeJS.Timeout | null = null;
  stopped = true;
  gaps: number[] = [];
  lastSeen = 0;
  hasReceived = false;
  timeout = 20000;
  constructor(
    private store: Store,
    private auth: Auth,
    private changed: () => void,
    private moderated: () => void = () => {},
    private makeSocket: (url: string) => WebSocket = (url) => {
      const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
      return new WebSocket(
        url,
        proxy ? { agent: new HttpsProxyAgent(proxy) } : {},
      );
    },
  ) {}
  set(state: ConnectionState) {
    this.state = state;
    this.changed();
  }
  async start() {
    if (!this.auth.connection()) return;
    this.stop();
    this.stopped = false;
    this.hasReceived = false;
    this.gaps = this.store
      .all(
        "SELECT at FROM audit_events WHERE session_id=? AND action='ingestion.gap' ORDER BY at DESC LIMIT 100",
        this.store.current()?.id ?? "",
      )
      .map((r) => r.at);
    this.set("connecting");
    await this.connect("wss://eventsub.wss.twitch.tv/ws", false);
  }
  async connect(url: string, migrating: boolean) {
    if (this.stopped) return;
    const parsed = new URL(url);
    if (
      parsed.protocol !== "wss:" ||
      parsed.hostname !== "eventsub.wss.twitch.tv"
    )
      throw new Error("Rejected EventSub reconnect URL");
    const ws = this.makeSocket(url);
    const welcomeTimer = setTimeout(() => ws.terminate(), 10000);
    if (migrating) this.pending = ws;
    else this.socket = ws;
    ws.on("message", async (raw) => {
      try {
        const event = JSON.parse(raw.toString());
        this.lastSeen = Date.now();
        const type = event.metadata?.message_type;
        if (type === "session_welcome") {
          clearTimeout(welcomeTimer);
          this.timeout =
            (event.payload.session.keepalive_timeout_seconds ?? 10) * 1000 +
            5000;
          if (migrating) {
            const old = this.socket;
            this.socket = ws;
            this.pending = null;
            old?.close();
            this.set(this.hasReceived ? "live" : "subscribing");
          } else {
            this.set("subscribing");
            await this.subscribe(event.payload.session.id);
          }
          this.arm();
        } else if (type === "session_keepalive") this.arm();
        else if (type === "session_reconnect") {
          this.set("reconnecting");
          await this.connect(event.payload.session.reconnect_url, true);
        } else if (type === "revocation") {
          this.stop();
          this.auth.invalidate();
          this.set("authorization required");
          this.store.audit(
            this.store.current()?.id ?? null,
            "twitch.revocation",
            event.payload.subscription?.status ?? "revoked",
          );
        } else if (type === "notification") {
          this.notification(event);
          this.arm();
        }
      } catch {
        if (this.stopped) return;
        this.set("reconnecting");
        ws.close();
      }
    });
    ws.on("error", () => ws.close());
    ws.on("close", () => {
      clearTimeout(welcomeTimer);
      if (ws === this.pending) this.pending = null;
      if (this.stopped || ws !== this.socket) return;
      this.gaps.push(Date.now());
      this.store.audit(
        this.store.current()?.id ?? null,
        "ingestion.gap",
        "Disconnected events are not replayed",
      );
      this.set("reconnecting");
      if (this.watchdog) clearTimeout(this.watchdog);
      this.retry = setTimeout(
        () => void this.connect("wss://eventsub.wss.twitch.tv/ws", false),
        2000,
      );
    });
  }
  arm() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => this.socket?.terminate(), this.timeout);
  }
  async subscribe(id: string) {
    const c = this.auth.connection();
    if (!c) throw new Error("No authorization");
    const token = await this.auth.token();
    for (const type of [
      "channel.chat.message",
      "channel.chat.message_delete",
      "channel.chat.clear_user_messages",
      "channel.chat.clear",
    ]) {
      const r = await fetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Client-Id": config.TWITCH_CLIENT_ID!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            version: "1",
            condition: { broadcaster_user_id: c.id, user_id: c.id },
            transport: { method: "websocket", session_id: id },
          }),
        },
      );
      if (!r.ok) {
        if ([401, 403].includes(r.status)) {
          this.stop();
          this.set("authorization required");
        }
        throw new Error("EventSub subscription failed: " + r.status);
      }
    }
  }
  notification(input: unknown) {
    const envelope = validateNotification(input);
    if (!envelope) return;
    const s = this.store.current();
    if (!s || s.source !== "live") return;
    const e: any = envelope.payload.event,
      type = envelope.payload.subscription.type;
    const delivery = envelope.metadata.message_id;
    const at = Date.parse(envelope.metadata.message_timestamp);
    if (!Number.isFinite(at)) return;
    if (this.store.get("SELECT 1 FROM deliveries WHERE id=?", delivery)) return;
    if (type === "channel.chat.message") {
      if (
        e.source_broadcaster_user_id &&
        e.source_broadcaster_user_id !== e.broadcaster_user_id
      )
        return;
      const fragments = e.message?.fragments ?? [];
      this.hasReceived = true;
      this.set("live");
      this.store.ingest(
        s.id,
        {
          id: e.message_id,
          userId: e.chatter_user_id,
          name: e.chatter_user_name,
          text: String(e.message?.text ?? "").slice(0, 2000),
          at,
          arrival: Date.now(),
          emotes: fragments
            .filter((f: any) => f.type === "emote" && f.emote?.id)
            .map((f: any) => f.emote.id),
        },
        delivery,
      );
    } else {
      this.store.transaction(() => {
        this.store.run(
          "INSERT INTO deliveries VALUES(?,?)",
          delivery,
          Date.now(),
        );
      });
      if (type === "channel.chat.message_delete")
        this.store.moderate(s.id, { messageId: e.message_id, at });
      if (type === "channel.chat.clear_user_messages")
        this.store.moderate(s.id, { userId: e.target_user_id, at });
      if (type === "channel.chat.clear") this.store.moderate(s.id, { at });
      this.moderated();
    }
    this.changed();
  }
  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.socket?.close();
    this.pending?.close();
    this.socket = null;
    this.pending = null;
    this.set("disconnected");
  }
}
