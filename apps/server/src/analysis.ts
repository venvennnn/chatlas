import { config, projectRoot } from "./config.ts";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import type { Message, Topic } from "../../../packages/shared/src/index.ts";
import type { Store } from "./store.ts";
export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}
export class Analysis {
  worker: Worker;
  busy = false;
  topics: Topic[] = [];
  provider = "Limited semantic grouping · lexical TF-IDF";
  queue = 0;
  coverage = 1;
  sampleCoverage = 1;
  resetPending = false;
  windowEnd = 0;
  completedAt = 0;
  processingMs = 0;
  private requestedAt = 0;
  private evidenceWindows = new Map<
    number,
    { sessionId: string; topics: Map<string, string[]>; simulated: boolean }
  >();
  generation = 0;
  constructor(
    private store: Store,
    model = config.EMBEDDING_MODEL,
  ) {
    if (model !== "lexical") this.provider = "Loading cached embedding model…";
    this.worker = new Worker(
      new URL("./analysis-worker.mjs", import.meta.url),
      {
        workerData: {
          model,
          cacheDir: resolve(projectRoot, config.MODEL_CACHE_DIR),
        },
      },
    );
    this.worker.on("message", (r) => {
      if (!r.sessionId || !Array.isArray(r.topics)) return;
      this.busy = false;
      if (
        r.generation !== this.generation ||
        this.store.current()?.id !== r.sessionId
      )
        return;
      this.windowEnd = r.windowEnd ?? Date.now();
      this.completedAt = Date.now();
      this.processingMs = Math.max(0, this.completedAt - this.requestedAt);
      this.evidenceWindows.set(this.windowEnd, {
        sessionId: r.sessionId,
        simulated: this.store.setting("testUniqueMessages", false),
        topics: new Map(r.topics.map((t: any) => [t.id, t.memberIds])),
      });
      for (const key of this.evidenceWindows.keys())
        if (key < this.windowEnd - 60000) this.evidenceWindows.delete(key);
      this.provider = r.provider;
      this.coverage = this.sampleCoverage * r.coverage;
      this.queue = r.queue;
      this.store.transaction(() => {
        this.store.run(
          "DELETE FROM topic_memberships WHERE session_id=?",
          r.sessionId,
        );
        for (const t of r.topics)
          for (const mid of t.memberIds)
            this.store.run(
              "INSERT OR REPLACE INTO topic_memberships VALUES(?,?,?)",
              r.sessionId,
              mid,
              t.id,
            );
      });
      this.topics = r.topics.map((t: any) => {
        const override = this.store.get(
          "SELECT * FROM topics WHERE session_id=? AND id=?",
          r.sessionId,
          t.id,
        );
        const { memberIds: _ids, ...topic } = t;
        return {
          ...topic,
          ...(override
            ? {
                label: override.label ?? t.label,
                approved: Boolean(override.approved || t.approved),
                hidden: Boolean(override.hidden),
                pinned: Boolean(override.pinned),
              }
            : {}),
        };
      });
      this.store.saveSample(
        r.sessionId,
        this.windowEnd,
        this.topics,
        r.participants ?? 0,
        r.messageCount ?? 0,
        this.coverage,
      );
    });
    this.worker.on("error", (e) => {
      this.busy = false;
      this.provider = "Analysis unavailable: " + e.message;
    });
  }
  update(sessionId: string, messages: Message[], now = Date.now()) {
    if (this.busy) {
      this.queue = messages.length;
      return;
    }
    this.busy = true;
    this.requestedAt = Date.now();
    const cap = 12000;
    this.sampleCoverage = Math.min(1, cap / Math.max(messages.length, 1));
    this.coverage = this.sampleCoverage;
    this.worker.postMessage({
      sessionId,
      messages: messages.slice(-cap),
      now,
      reset: this.resetPending,
      generation: this.generation,
      testUniqueMessages: this.store.setting("testUniqueMessages", false),
      manual: this.store.all(
        "SELECT message_id,topic_id FROM manual_memberships WHERE session_id=?",
        sessionId,
      ),
    });
    this.resetPending = false;
  }
  evidence(topicId: string, windowEnd: number, bucket: number) {
    const window = this.evidenceWindows.get(windowEnd);
    if (!window || window.sessionId !== this.store.current()?.id)
      throw Object.assign(
        new Error("This analysis window has expired. Select a recent point."),
        { statusCode: 410 },
      );
    if (!window.topics.has(topicId))
      throw Object.assign(new Error("Topic not found in this window"), {
        statusCode: 404,
      });
    const ids = new Set(window.topics.get(topicId)!);
    const start = windowEnd - 120000 + bucket * 10000;
    const messages = this.store
      .messages(window.sessionId, windowEnd)
      .filter((m) => ids.has(m.id) && m.at >= start && m.at < start + 10000);
    return {
      start,
      end: start + 10000,
      total: messages.length,
      people: new Set(messages.map((m) => (window.simulated ? m.id : m.userId)))
        .size,
      messages: messages.slice(-100),
      limited: messages.length > 100,
      simulated: window.simulated,
    };
  }
  reset() {
    this.topics = [];
    this.evidenceWindows.clear();
    this.windowEnd = 0;
    this.completedAt = 0;
    this.resetPending = true;
    this.generation++;
    this.worker.postMessage({ clear: true });
  }
  async stop() {
    await this.worker.terminate();
  }
}
