import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  parseVote,
  type Decision,
  type Message,
  type Source,
  type Topic,
  type SessionRecap,
} from "../../../packages/shared/src/index.ts";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export class Store {
  db: DatabaseSync;
  sequence = 0;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(
      readFileSync(
        new URL("../migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    this.db.exec(
      readFileSync(
        new URL("../migrations/002_insights.sql", import.meta.url),
        "utf8",
      ),
    );
    if (
      !this.all("PRAGMA table_info(analysis_samples)").some(
        (column) => column.name === "simulated",
      )
    )
      this.db.exec(
        "ALTER TABLE analysis_samples ADD COLUMN simulated INTEGER NOT NULL DEFAULT 0",
      );
    this.sequence = Number(
      (
        this.db
          .prepare("SELECT MAX(sequence) n FROM chat_messages")
          .get() as any
      )?.n ?? 0,
    );
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  all(sql: string, ...args: any[]): any[] {
    return this.db.prepare(sql).all(...args);
  }
  get(sql: string, ...args: any[]): any {
    return this.db.prepare(sql).get(...args);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(session: string | null, action: string, detail = "") {
    this.run(
      "INSERT INTO audit_events(session_id,action,at,detail) VALUES(?,?,?,?)",
      session,
      action,
      Date.now(),
      detail,
    );
  }
  sessions() {
    return this.all(
      "SELECT id,source,started_at AS startedAt,ended_at AS endedAt FROM analysis_sessions ORDER BY started_at DESC",
    );
  }
  current() {
    return this.sessions().find((s) => s.endedAt === null) ?? null;
  }
  start(source: Source) {
    this.end();
    const id = randomUUID();
    this.run(
      "INSERT INTO analysis_sessions VALUES(?,?,?,NULL)",
      id,
      source,
      Date.now(),
    );
    this.audit(id, "session.start", source);
    return this.current();
  }
  end() {
    const s = this.current();
    if (!s) return;
    for (const d of this.all(
      "SELECT id FROM decisions WHERE state='open' AND session_id=?",
      s.id,
    ))
      this.close(d.id);
    this.run(
      "UPDATE analysis_sessions SET ended_at=? WHERE id=?",
      Date.now(),
      s.id,
    );
    this.audit(s.id, "session.end");
  }
  ingest(
    session: string,
    input: Omit<Message, "sequence">,
    deliveryId = input.id,
  ) {
    return this.transaction(() => {
      if (this.get("SELECT 1 FROM deliveries WHERE id=?", deliveryId))
        return false;
      this.run("INSERT INTO deliveries VALUES(?,?)", deliveryId, Date.now());
      const tomb = this.get(
        "SELECT 1 FROM tombstones WHERE session_id=? AND message_id=?",
        session,
        input.id,
      );
      const clear = this.get(
        "SELECT MAX(before_at) at FROM clears WHERE session_id=? AND user_id IN (?,?)",
        session,
        input.userId,
        "*",
      );
      const deleted = Boolean(tomb || clear?.at >= input.at);
      const seq = ++this.sequence;
      const inserted = this.run(
        "INSERT OR IGNORE INTO chat_messages VALUES(?,?,?,?,?,?,?,?,?,?)",
        input.id,
        session,
        input.userId,
        input.name,
        input.text,
        input.at,
        input.arrival,
        seq,
        JSON.stringify(input.emotes),
        deleted ? 1 : 0,
      ).changes;
      if (!inserted || deleted) return false;
      const d = this.all(
        "SELECT * FROM decisions WHERE session_id=? AND state='open'",
        session,
      )[0];
      if (
        d &&
        input.arrival < d.deadline &&
        input.at >= d.opened_at &&
        input.at < d.deadline
      ) {
        const choices = parseVote(input.text, JSON.parse(d.options).length);
        if (choices !== null)
          this.run(
            "INSERT INTO vote_revisions VALUES(?,?,?,?,?,?,?,0)",
            session,
            d.id,
            input.id,
            input.userId,
            JSON.stringify(choices),
            input.at,
            seq,
          );
      }
      return true;
    });
  }
  messages(session: string, now = Date.now(), window = 120000): Message[] {
    return this.all(
      "SELECT id,user_id AS userId,name,text,source_at AS at,arrival,sequence,emotes FROM chat_messages WHERE session_id=? AND deleted=0 AND source_at>=? ORDER BY sequence",
      session,
      now - window,
    ).map((m) => ({ ...m, emotes: JSON.parse(m.emotes) }));
  }
  createDecision(
    session: string,
    question: string,
    options: string[],
    duration: number,
  ) {
    const id = randomUUID();
    this.run(
      "INSERT INTO decisions VALUES(?,?,?,?,'draft',?,NULL,NULL,NULL,?)",
      id,
      session,
      question,
      JSON.stringify(options),
      duration,
      Date.now(),
    );
    this.audit(session, "decision.draft", id);
    return this.decision(id);
  }
  result(id: string) {
    const d = this.get("SELECT options FROM decisions WHERE id=?", id);
    if (!d) throw new Error("Decision not found");
    const ballots = new Map<string, number[]>();
    for (const r of this.all(
      "SELECT * FROM vote_revisions WHERE decision_id=? AND deleted=0 ORDER BY source_at,arrival_seq,message_id",
      id,
    ))
      ballots.set(r.user_id, JSON.parse(r.choices));
    const counts = Array(JSON.parse(d.options).length).fill(0);
    let voters = 0;
    for (const choices of ballots.values()) {
      if (choices.length) voters++;
      for (const n of choices) counts[n - 1]++;
    }
    const max = Math.max(...counts);
    return {
      counts,
      voters,
      winners: max > 0 ? counts.flatMap((n, i) => (n === max ? [i] : [])) : [],
    };
  }
  decision(id: string): Decision {
    const d = this.get("SELECT * FROM decisions WHERE id=?", id);
    if (!d) throw new Error("Decision not found");
    return {
      id: d.id,
      sessionId: d.session_id,
      question: d.question,
      options: JSON.parse(d.options),
      state: d.state,
      duration: d.duration,
      openedAt: d.opened_at,
      deadline: d.deadline,
      createdAt: d.created_at,
      ...(d.result ? JSON.parse(d.result) : this.result(id)),
    };
  }
  decisions(session: string) {
    return this.all(
      "SELECT id FROM decisions WHERE session_id=? ORDER BY created_at DESC",
      session,
    ).map((d) => this.decision(d.id));
  }
  open(id: string, now = Date.now()) {
    return this.transaction(() => {
      const d = this.decision(id);
      if (d.state !== "draft") throw new Error("Only a draft can be opened");
      if (this.get("SELECT 1 FROM decisions WHERE state='open'"))
        throw new Error("A decision is already open");
      this.run(
        "UPDATE decisions SET state='open',opened_at=?,deadline=? WHERE id=?",
        now,
        now + d.duration * 1000,
        id,
      );
      this.audit(d.sessionId, "decision.open", id);
      return this.decision(id);
    });
  }
  close(id: string, cancel = false, now = Date.now()) {
    return this.transaction(() => {
      const d = this.decision(id);
      if (!["draft", "open"].includes(d.state))
        throw new Error("Decision is already final");
      this.run(
        "UPDATE decisions SET state=?,result=?,deadline=MIN(COALESCE(deadline,?),?) WHERE id=?",
        cancel ? "cancelled" : "closed",
        JSON.stringify(this.result(id)),
        now,
        now,
        id,
      );
      this.audit(
        d.sessionId,
        cancel ? "decision.cancel" : "decision.close",
        id,
      );
      return this.decision(id);
    });
  }
  tick(now = Date.now()) {
    for (const d of this.all(
      "SELECT id FROM decisions WHERE state='open' AND deadline<=?",
      now,
    ))
      this.close(d.id, false, now);
  }
  moderate(
    session: string,
    {
      messageId,
      userId,
      at = Date.now(),
    }: { messageId?: string; userId?: string; at?: number },
  ) {
    this.transaction(() => {
      if (messageId) {
        this.run(
          "INSERT OR IGNORE INTO tombstones VALUES(?,?)",
          session,
          messageId,
        );
        this.run(
          "UPDATE chat_messages SET deleted=1,text='',name='' WHERE session_id=? AND id=?",
          session,
          messageId,
        );
        this.run(
          "UPDATE vote_revisions SET deleted=1 WHERE session_id=? AND message_id=?",
          session,
          messageId,
        );
      } else {
        const user = userId ?? "*";
        this.run(
          "INSERT INTO clears VALUES(?,?,?) ON CONFLICT(session_id,user_id) DO UPDATE SET before_at=MAX(before_at,excluded.before_at)",
          session,
          user,
          at,
        );
        const rows = this.all(
          "SELECT id FROM chat_messages WHERE session_id=? AND source_at<=?" +
            (userId ? " AND user_id=?" : ""),
          ...[session, at, ...(userId ? [userId] : [])],
        );
        for (const r of rows) {
          this.run(
            "UPDATE chat_messages SET deleted=1,text='',name='' WHERE session_id=? AND id=?",
            session,
            r.id,
          );
          this.run(
            "UPDATE vote_revisions SET deleted=1 WHERE session_id=? AND message_id=?",
            session,
            r.id,
          );
        }
      }
      this.run("DELETE FROM topic_memberships WHERE session_id=?", session);
      this.run(
        "UPDATE topics SET label=NULL,approved=0 WHERE session_id=?",
        session,
      );
      this.audit(
        session,
        "moderation",
        messageId ? "message" : userId ? "user" : "room",
      );
    });
  }
  purge(now = Date.now()) {
    this.run("DELETE FROM chat_messages WHERE source_at<?", now - 86400000);
    this.run(
      "DELETE FROM topic_memberships WHERE NOT EXISTS(SELECT 1 FROM chat_messages m WHERE m.session_id=topic_memberships.session_id AND m.id=message_id AND m.deleted=0 AND m.source_at>=?)",
      now - 120000,
    );
    this.run("DELETE FROM deliveries WHERE at<?", now - 86400000);
    this.run("DELETE FROM dashboard_sessions WHERE expires<?", now);
    this.run("DELETE FROM oauth_states WHERE expires<?", now);
    this.run("DELETE FROM idempotency WHERE at<?", now - 86400000);
  }
  saveSample(
    sessionId: string,
    at: number,
    topics: Topic[],
    participants: number,
    messages: number,
    coverage: number,
  ) {
    const last =
      this.get(
        "SELECT MAX(at) at FROM analysis_samples WHERE session_id=?",
        sessionId,
      )?.at ?? 0;
    if (at - last < 15000) return;
    this.run(
      "INSERT OR IGNORE INTO analysis_samples(session_id,at,topics,participants,messages,coverage,simulated) VALUES(?,?,?,?,?,?,?)",
      sessionId,
      at,
      JSON.stringify(
        topics
          .filter((t) => !t.hidden)
          .map((t) => ({
            id: t.id,
            label: t.label,
            contributors: t.contributors,
            messages: t.messages,
          })),
      ),
      participants,
      messages,
      coverage,
      this.setting("testUniqueMessages", false) ? 1 : 0,
    );
    // Bounded retained aggregates: raw messages and usernames are never copied here.
    this.run(
      "DELETE FROM analysis_samples WHERE session_id=? AND at NOT IN (SELECT at FROM analysis_samples WHERE session_id=? ORDER BY at DESC LIMIT 2400)",
      sessionId,
      sessionId,
    );
  }
  recap(sessionId: string): SessionRecap {
    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session)
      throw Object.assign(new Error("Session not found"), { statusCode: 404 });
    const rows = this.all(
      "SELECT * FROM analysis_samples WHERE session_id=? ORDER BY at",
      sessionId,
    );
    const topics = new Map<string, SessionRecap["topics"][number]>();
    for (const row of rows) {
      const seen = new Set<string>();
      for (const item of JSON.parse(row.topics)) {
        const key = item.label.normalize("NFKC").toLowerCase().trim();
        const old = topics.get(key) ?? {
          id: item.id,
          label: item.label,
          peakPeople: 0,
          peakMessages: 0,
          samples: 0,
        };
        old.label = item.label;
        // Across re-clustering, labels can have new IDs. Keep peak clusters; never sum overlapping people.
        old.peakPeople = Math.max(old.peakPeople, item.contributors);
        old.peakMessages = Math.max(old.peakMessages, item.messages);
        if (!seen.has(key)) old.samples++;
        seen.add(key);
        topics.set(key, old);
      }
    }
    return {
      session,
      samples: rows.map((r) => ({
        at: r.at,
        participants: r.participants,
        messages: r.messages,
        coverage: r.coverage,
        simulated: Boolean(r.simulated),
      })),
      topics: [...topics.values()]
        .sort((a, b) => b.peakPeople - a.peakPeople)
        .slice(0, 20),
      decisions: this.decisions(sessionId),
      sampleCount: rows.length,
      truncated: rows.length >= 2400,
    };
  }
  setting(key: string, fallback: any) {
    const r = this.get("SELECT value FROM settings WHERE key=?", key);
    return r ? JSON.parse(r.value) : fallback;
  }
  set(key: string, value: any) {
    this.run(
      "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      JSON.stringify(value),
    );
  }
}
