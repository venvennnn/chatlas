import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ArrowUpRight,
  Download,
  Sparkles,
  Vote,
  X,
} from "lucide-react";
import type {
  Message,
  Snapshot,
  Topic,
  SessionRecap as Recap,
  OverlayPreferences,
} from "../../../packages/shared/src/index";
import { defaultOverlayPreferences } from "../../../packages/shared/src/index";
import { api } from "./api";
import "./workspace-insights.css";

export interface EvidenceSelection {
  topic: Topic;
  bucket: number;
  windowEnd: number;
}
export function WorkspaceInsights({
  state,
  online,
  inspect,
  draft,
}: {
  state: Snapshot;
  online: boolean;
  inspect: (topic: Topic, bucket: number) => void;
  draft: (topic: Topic) => void;
}) {
  const contributorUnit = state.settings.testUniqueMessages
    ? "simulated contributors"
    : "people";
  const changes = state.topics
    .filter((t) => !t.hidden && t.periods && Math.abs(t.trend) >= 2)
    .toSorted((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
    .slice(0, 3);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = state.analysis.completedAt
    ? Math.max(0, clock - state.analysis.completedAt)
    : null;
  return (
    <section
      className="workspace-insights"
      aria-label="Conversation insights and analysis health"
    >
      <div className="health-strip">
        <span>
          <Activity size={15} />
          <strong>
            {!online
              ? "Feed disconnected"
              : age === null
                ? "Waiting for analysis"
                : age > 5000
                  ? "Analysis delayed"
                  : "Analysis current"}
          </strong>
        </span>
        <span>
          {age === null
            ? "No completed window"
            : `Updated ${(age / 1000).toFixed(0)}s ago`}
        </span>
        <span>{state.analysis.processingMs ?? "—"} ms processing</span>
        <span>{Math.round(state.analysis.coverage * 100)}% coverage</span>
        <span>{state.analysis.queue} queued messages</span>
        <span>{state.gaps.length} connection gaps</span>
        <small>{state.analysis.provider}</small>
      </div>
      <header>
        <div>
          <span className="feature-eyebrow">
            MEASURED CHANGES · LAST 60s VS PRIOR 60s
          </span>
          <h2>What changed?</h2>
        </div>
        <span className="insight-provenance">
          {state.session?.source?.toUpperCase() ?? "NO SESSION"}
          {state.settings.testUniqueMessages
            ? " · simulated contributors"
            : " · distinct contributors"}
        </span>
      </header>
      <div className="change-grid">
        {changes.length ? (
          changes.map((topic) => (
            <article key={topic.id}>
              <Sparkles size={17} />
              <h3>{topic.label}</h3>
              <p>
                {topic.periods!.previous === 0
                  ? `Emerging: ${topic.periods!.recent} ${contributorUnit} in the latest minute; none in the prior minute.`
                  : `${topic.periods!.previous} → ${topic.periods!.recent} ${contributorUnit} (${topic.trend > 0 ? "+" : ""}${topic.trend}) across consecutive minutes.`}
              </p>
              <div>
                <button
                  onClick={() =>
                    inspect(
                      topic,
                      topic.spark.indexOf(Math.max(...topic.spark)),
                    )
                  }
                  disabled={!state.analysis.windowEnd}
                >
                  Inspect activity <ArrowUpRight size={13} />
                </button>
                <button onClick={() => draft(topic)} disabled={!state.session}>
                  <Vote size={13} /> Draft vote
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="feature-muted">
            No changes of at least two contributors yet. Insights appear as the
            rolling window changes.
          </p>
        )}
      </div>
      <p className="feature-fine">
        Changes describe received messages, not sentiment or consensus.{" "}
        {state.gaps.length > 0
          ? "Activity may be incomplete because of connection gaps."
          : "Topic mentions are not votes."}
      </p>
    </section>
  );
}
export function EvidenceDialog({
  selection,
  close,
  draft,
}: {
  selection: EvidenceSelection | null;
  close: () => void;
  draft: (topic: Topic) => void;
}) {
  const [result, setResult] = useState<{
    start: number;
    end: number;
    total: number;
    people: number;
    messages: Message[];
    limited: boolean;
    simulated: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    if (selection)
      void api(
        `/topics/${encodeURIComponent(selection.topic.id)}/evidence?windowEnd=${selection.windowEnd}&bucket=${selection.bucket}`,
      )
        .then((r) => {
          if (active) setResult(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selection]);
  return (
    <Dialog.Root
      open={Boolean(selection)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="dialog evidence-dialog">
          <div className="dialog-top">
            <span className="feature-eyebrow">
              CHART EVIDENCE · PRIVATE TO OWNER
            </span>
            <Dialog.Close
              className="icon-button"
              aria-label="Close chart evidence"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Title>{selection?.topic.label}</Dialog.Title>
          <Dialog.Description>
            Messages assigned to the selected ten-second bucket. This view stays
            fixed while the live charts continue updating.
          </Dialog.Description>
          {error ? (
            <p role="alert" className="feature-error">
              {error}
            </p>
          ) : !result ? (
            <p>Loading evidence…</p>
          ) : (
            <>
              <div className="evidence-summary">
                {new Date(result.start).toLocaleTimeString()}–
                {new Date(result.end).toLocaleTimeString()} · {result.people}{" "}
                {result.simulated
                  ? "simulated contributors"
                  : "distinct people"}{" "}
                · {result.total} messages
              </div>
              <div className="bucket-messages">
                {result.messages.length ? (
                  result.messages.map((message) => (
                    <article key={message.id}>
                      <strong>{message.name}</strong>
                      <time>{new Date(message.at).toLocaleTimeString()}</time>
                      <p>{message.text}</p>
                    </article>
                  ))
                ) : (
                  <p>
                    No messages in this bucket. Deleted messages are excluded.
                  </p>
                )}
              </div>
              {result.limited && (
                <p className="feature-fine">
                  Showing the latest 100 messages in this bucket.
                </p>
              )}
            </>
          )}
          <div className="dialog-actions">
            <button
              className="button primary"
              onClick={() => {
                if (selection) {
                  draft(selection.topic);
                  close();
                }
              }}
            >
              <Vote size={15} /> Turn topic into a vote draft
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
const presets: Record<string, OverlayPreferences> = {
  cozy: defaultOverlayPreferences,
  gameplay: {
    scale: 0.8,
    opacity: 0.9,
    mascot: false,
    topicCount: 3,
    safeArea: 48,
    preset: "gameplay",
  },
  minimal: {
    scale: 0.65,
    opacity: 0.85,
    mascot: false,
    topicCount: 2,
    safeArea: 24,
    preset: "minimal",
  },
};
export function OverlayStyleControls({
  value,
  save,
  preview,
}: {
  value?: OverlayPreferences;
  save: (value: OverlayPreferences) => Promise<void>;
  preview: (value: OverlayPreferences) => void;
}) {
  const [draft, setDraft] = useState(value ?? defaultOverlayPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savedPreferences = JSON.stringify(value ?? defaultOverlayPreferences);
  useEffect(() => {
    setDraft(JSON.parse(savedPreferences));
  }, [savedPreferences]);

  function change(update: Partial<OverlayPreferences>) {
    const next = { ...draft, ...update, preset: "custom" as const };
    setDraft(next);
    preview(next);
  }
  return (
    <div className="overlay-style-controls">
      <h3>Make it fit your stream</h3>
      <label>
        Layout preset
        <select
          aria-label="Overlay style preset"
          value={draft.preset}
          onChange={(e) => {
            const next = presets[e.target.value];
            if (next) {
              setDraft(next);
              preview(next);
            }
          }}
        >
          <option value="cozy">Cozy studio</option>
          <option value="gameplay">Gameplay safe</option>
          <option value="minimal">Minimal</option>
          <option value="custom" disabled>
            Custom
          </option>
        </select>
      </label>
      <label>
        Size · {Math.round(draft.scale * 100)}%
        <input
          aria-label="Overlay size"
          type="range"
          min=".5"
          max="1.25"
          step=".05"
          value={draft.scale}
          onChange={(e) => change({ scale: Number(e.target.value) })}
        />
      </label>
      <label>
        Card opacity · {Math.round(draft.opacity * 100)}%
        <input
          aria-label="Overlay card opacity"
          type="range"
          min=".5"
          max="1"
          step=".05"
          value={draft.opacity}
          onChange={(e) => change({ opacity: Number(e.target.value) })}
        />
      </label>
      <label>
        Topics
        <select
          aria-label="Overlay topic count"
          value={draft.topicCount}
          onChange={(e) => change({ topicCount: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} topics
            </option>
          ))}
        </select>
      </label>
      <label>
        Safe margin · {draft.safeArea}px
        <input
          aria-label="Overlay safe margin"
          type="range"
          min="0"
          max="120"
          step="4"
          value={draft.safeArea}
          onChange={(e) => change({ safeArea: Number(e.target.value) })}
        />
      </label>
      <label className="toggle-row">
        <span>Show streamer character</span>
        <input
          aria-label="Show overlay character"
          type="checkbox"
          checked={draft.mascot}
          onChange={(e) => change({ mascot: e.target.checked })}
        />
      </label>
      <p className="feature-fine">
        Preview changes are local until applied. Safe margins and size apply to
        the OBS browser source. Cozy uses three topics in Compact and four in
        Expanded; changing Topics switches to Custom.
      </p>
      <button
        className="button primary"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError("");
          try {
            await save(draft);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Applying…" : "Apply overlay style"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function downloadFile(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function SessionRecap({ sessionId }: { sessionId: string }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRecap(null);
    setError("");
    void api<Recap>(`/sessions/${encodeURIComponent(sessionId)}/recap`)
      .then((r) => {
        if (active) setRecap(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);
  if (error) return <p role="alert">{error}</p>;
  if (!recap) return <p>Loading session recap…</p>;
  const peak = Math.max(1, ...recap.samples.map((s) => s.participants));
  const start = recap.samples[0]?.at ?? 0;
  const span = Math.max(1, (recap.samples.at(-1)?.at ?? 0) - start);
  const escape = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  function exportHtml() {
    if (!recap) return;
    downloadFile(
      `chatlas-recap-${sessionId}.html`,
      `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chatlas session recap</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:24px;color:#39204f;background:#fbf7ff}td,th{padding:12px;border-bottom:1px solid #eadcf6;text-align:left}table{width:100%}</style><h1>Chatlas session recap</h1><p>${escape(recap.session.source.toUpperCase())} · ${escape(new Date(recap.session.startedAt).toISOString())} · ${recap.sampleCount} sampled windows</p><p>Peaks are observed two-minute-window counts, not whole-session unique contributors. Labels are grouped; peaks are the largest observed cluster per label. Reports contain no raw chat or usernames. ${recap.samples.some((s) => s.simulated) ? "Some windows contain simulated contributor counts." : ""}</p><table><tr><th>Topic</th><th>Peak contributors</th><th>Peak messages</th></tr>${recap.topics.map((t) => `<tr><td>${escape(t.label)}</td><td>${t.peakPeople}</td><td>${t.peakMessages}</td></tr>`).join("")}</table><h2>Decisions</h2>${recap.decisions.map((d) => `<h3>${escape(d.question)}</h3><p>${escape(d.state)} · ${d.voters} voters</p><ul>${d.options.map((o, i) => `<li>${escape(o)}: ${d.counts[i]} approvals</li>`).join("")}</ul>`).join("")}<p>Sampled every 15 seconds while analysis runs. ${recap.truncated ? "Only the latest 2400 samples are retained." : "Samples may not cover the entire session."}</p></html>`,
      "text/html",
    );
  }
  return (
    <section className="recap-panel" aria-label="Session recap">
      <header>
        <div>
          <span className="feature-eyebrow">
            {recap.session.source.toUpperCase()} ·{" "}
            {recap.session.endedAt ? "COMPLETED SESSION" : "SESSION SO FAR"}
          </span>
          <h2>Your conversation, in perspective.</h2>
        </div>
        <button className="button" onClick={exportHtml}>
          <Download size={14} /> Shareable HTML
        </button>
        <button
          className="button"
          onClick={() =>
            downloadFile(
              `chatlas-recap-${sessionId}.json`,
              JSON.stringify(recap, null, 2),
              "application/json",
            )
          }
        >
          JSON
        </button>
      </header>
      <p className="feature-muted">
        {recap.sampleCount} sampled windows · peak{" "}
        {Math.max(0, ...recap.samples.map((s) => s.participants))} active
        contributors ·{" "}
        {recap.decisions.filter((d) => d.state === "closed").length} closed
        decisions
      </p>
      {recap.samples.length ? (
        <svg
          className="recap-trend"
          viewBox="0 0 600 130"
          role="img"
          aria-label="Sampled active participants in rolling two-minute windows"
        >
          <line x1="35" x2="575" y1="105" y2="105" stroke="#e7d8f4" />
          <polyline
            points={recap.samples
              .map(
                (s) =>
                  `${35 + ((s.at - start) / span) * 540},${105 - (s.participants / peak) * 80}`,
              )
              .join(" ")}
            stroke="#a15ae8"
            fill="none"
            strokeWidth="3"
          />
          <text x="8" y="28">
            {peak}
          </text>
          <text x="15" y="108">
            0
          </text>
          <text x="35" y="125">
            {new Date(start).toLocaleTimeString()}
          </text>
          <text x="575" y="125" textAnchor="end">
            {new Date(start + span).toLocaleTimeString()}
          </text>
        </svg>
      ) : (
        <p>
          No analysis samples yet. Start a session and allow an analysis window
          to complete.
        </p>
      )}
      <div className="feature-table">
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Peak contributors / 2 min</th>
              <th>Peak messages / 2 min</th>
            </tr>
          </thead>
          <tbody>
            {recap.topics.map((t) => (
              <tr key={t.id}>
                <td>{t.label}</td>
                <td>{t.peakPeople}</td>
                <td>{t.peakMessages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="feature-fine">
        {recap.samples.some((s) => s.simulated) &&
          "Includes simulated contributor windows. "}
        Sampled every 15s. Labels are grouped for the recap; peaks are the
        largest observed cluster per label. Peaks can occur in different
        windows; do not sum them as session totals. Topic identities may change
        after a reset.{" "}
        {recap.truncated
          ? "History is limited to the latest 2400 samples."
          : "Only samples recorded after this feature was installed are available."}{" "}
        Reports include aggregate data and decisions, not raw chat or usernames.
      </p>
    </section>
  );
}
export function ConnectionReadiness() {
  const [result, setResult] = useState<{
    configured: boolean;
    authorized: boolean;
    transport: string;
    liveReceived: boolean;
    overlayAvailable: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  async function refresh() {
    setError("");
    try {
      setResult(await api("/readiness"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <section className="readiness-panel">
      <h3>Twitch → Chatlas → OBS check</h3>
      <p className="feature-muted">
        Run these checks before your first real stream. Demo and Replay do not
        establish Live readiness.
      </p>
      {result && (
        <ul>
          <li>
            {result.configured ? "✓" : "○"} Twitch app credentials configured
          </li>
          <li>{result.authorized ? "✓" : "○"} Owner authorized</li>
          <li>
            {result.liveReceived ? "✓" : "○"} Actual Live chat received ·
            transport: {result.transport}
          </li>
          <li>
            {result.overlayAvailable ? "✓" : "○"} Read-only overlay link created
          </li>
          <li>○ OBS display: confirm in your local OBS preview</li>
        </ul>
      )}
      <button className="button" onClick={() => void refresh()}>
        Recheck connection
      </button>
      {error && <p role="alert">{error}</p>}
      <p className="feature-fine">
        In OBS, add your private overlay link as a 1920×1080 Browser Source.
        Send test messages and a replacement ballot from consenting accounts;
        check the result and reconnect recovery. Chatlas cannot detect your
        local OBS preview.
      </p>
    </section>
  );
}
