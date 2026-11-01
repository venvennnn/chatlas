import { z } from "zod";
import type { Store } from "./store.ts";
const event = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    id: z.string().min(1).max(100),
    userId: z.string().min(1).max(100),
    text: z.string().max(2000),
    offset: z.number().int().min(0).max(3600000),
  }),
  z.object({
    type: z.literal("delete"),
    id: z.string().min(1).max(100),
    messageId: z.string().min(1).max(100),
    offset: z.number().int().min(0).max(3600000),
  }),
]);
export function importReplay(store: Store, sessionId: string, lines: string) {
  const events = lines
    .trim()
    .split("\n")
    .map((l) => event.parse(JSON.parse(l)));
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new Error("Replay event IDs must be unique");
  store.transaction(() => {
    store.run("DELETE FROM replay_events WHERE session_id=?", sessionId);
    for (const e of events)
      store.run(
        "INSERT INTO replay_events VALUES(?,?,?,?,0)",
        sessionId,
        e.id,
        e.offset,
        JSON.stringify(e),
      );
    store.set("playback", {
      sessionId,
      cursor: 0,
      wallAt: Date.now(),
      paused: false,
      speed: 1,
    });
  });
  return events.length;
}
export function controlReplay(
  store: Store,
  change: { paused?: boolean; speed?: number },
) {
  const p = store.setting("playback", null);
  if (!p) return;
  const now = Date.now();
  if (!p.paused) p.cursor += (now - p.wallAt) * p.speed;
  store.set("playback", { ...p, ...change, wallAt: now });
}
export function tickReplay(store: Store) {
  const p = store.setting("playback", null),
    s = store.current();
  if (!p || !s || s.source === "live" || p.sessionId !== s.id || p.paused)
    return;
  const now = Date.now(),
    cursor = p.cursor + (now - p.wallAt) * p.speed;
  const events = store.all(
    "SELECT * FROM replay_events WHERE session_id=? AND played=0 AND offset_ms<=? ORDER BY offset_ms,event_id LIMIT 500",
    s.id,
    cursor,
  );
  for (const row of events) {
    const e = JSON.parse(row.payload);
    if (e.type === "delete")
      store.moderate(s.id, { messageId: "replay:" + e.messageId });
    else
      store.ingest(
        s.id,
        {
          id: "replay:" + e.id,
          userId: "replay:" + e.userId,
          name: "Replay participant",
          text: e.text,
          at: now,
          arrival: now,
          emotes: [],
        },
        "replay:" + s.id + ":" + e.id,
      );
    store.run(
      "UPDATE replay_events SET played=1 WHERE session_id=? AND event_id=?",
      s.id,
      e.id,
    );
  }
  return events.some((e) => JSON.parse(e.payload).type === "delete");
}
