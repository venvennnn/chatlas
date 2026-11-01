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
    const cap = 12000;
    this.sampleCoverage = Math.min(1, cap / Math.max(messages.length, 1));
    this.coverage = this.sampleCoverage;
    this.worker.postMessage({
      sessionId,
      messages: messages.slice(-cap),
      now,
      reset: this.resetPending,
      generation: this.generation,
      manual: this.store.all(
        "SELECT message_id,topic_id FROM manual_memberships WHERE session_id=?",
        sessionId,
      ),
    });
    this.resetPending = false;
  }
  reset() {
    this.topics = [];
    this.resetPending = true;
    this.generation++;
    this.worker.postMessage({ clear: true });
  }
  async stop() {
    await this.worker.terminate();
  }
}
