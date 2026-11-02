import { useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Users,
} from "lucide-react";
import type { Snapshot, Topic } from "../../../packages/shared/src/index";
import "./analytics.css";

const palette = ["#9550e9", "#e45a9a", "#25a988", "#6886df"];
const number = (value: number) => new Intl.NumberFormat("en").format(value);

export function TopicAnalytics({
  state,
  online,
  onInspect,
  onDraft,
}: {
  state: Snapshot;
  online: boolean;
  onInspect?: (topic: Topic, bucket: number) => void;
  onDraft?: (topic: Topic) => void;
}) {
  const [rankBy, setRankBy] = useState<"contributors" | "messages">(
    "contributors",
  );
  const [activeBin, setActiveBin] = useState<number | null>(null);
  const topics = state.topics
    .filter((topic) => !topic.hidden)
    .toSorted((a, b) => b[rankBy] - a[rankBy] || a.id.localeCompare(b.id))
    .slice(0, 4);
  const windowSeconds = state.analysis.windowSeconds;
  const binCount = Math.max(1, ...topics.map((topic) => topic.spark.length));
  const bucketSeconds = windowSeconds / binCount;
  // One shared, zero-based scale makes the four panels directly comparable.
  const peak = Math.max(1, ...topics.flatMap((topic) => topic.spark));
  const step = Math.max(1, Math.ceil(peak / 4));
  const ceiling = step * 4;
  const x = (index: number) => 34 + (index / Math.max(1, binCount - 1)) * 300;
  const y = (value: number) => 118 - (value / ceiling) * 92;
  const bucketLabel = (index: number) =>
    `${windowSeconds - index * bucketSeconds}–${windowSeconds - (index + 1) * bucketSeconds}s ago`;
  const mode = state.session?.source ?? "demo";
  const simulated = state.settings.testUniqueMessages;
  const feedLabel = !online
    ? "Reconnecting · last received data"
    : !state.session || state.session.endedAt
      ? "Session ended"
      : state.playback.paused
        ? "Playback paused · window still rolls"
        : "Updating every second";

  function download() {
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      [
        "source",
        "simulated_contributors",
        "topic_id",
        "topic",
        "seconds_ago_start",
        "seconds_ago_end",
        "bucket_distinct_contributors",
        "window_distinct_contributors",
        "window_messages",
      ],
      ...topics.flatMap((topic) =>
        topic.spark.map((count, index) => [
          mode,
          simulated,
          topic.id,
          topic.label,
          windowSeconds - index * bucketSeconds,
          windowSeconds - (index + 1) * bucketSeconds,
          count,
          topic.contributors,
          topic.messages,
        ]),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [
          rows
            .map((row) => row.map((cell) => quote(String(cell))).join(","))
            .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `chatlas-top-topics-${mode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="topic-analytics" aria-labelledby="analytics-title">
      <header className="analytics-header">
        <div>
          <span className="analytics-eyebrow">
            <Activity size={14} /> CONVERSATION INTELLIGENCE
          </span>
          <h2 id="analytics-title">Four topics. The whole pulse.</h2>
          <p>
            Top {topics.length || 4} topics by{" "}
            {rankBy === "contributors"
              ? "distinct contributors"
              : "message volume"}{" "}
            · rolling {windowSeconds}s window
          </p>
        </div>
        <div className="analytics-controls">
          <span className={`analytics-feed ${online ? "is-connected" : ""}`}>
            <i />
            {feedLabel}
          </span>
          <label>
            Rank by
            <select
              aria-label="Rank top topics by"
              value={rankBy}
              onChange={(event) =>
                setRankBy(event.target.value as typeof rankBy)
              }
            >
              <option value="contributors">People</option>
              <option value="messages">Messages</option>
            </select>
          </label>
          <button
            className="button analytics-export"
            onClick={download}
            disabled={!topics.length}
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </header>
      <div className="analytics-context">
        <span className="analytics-source">
          {mode.toUpperCase()}
          {mode === "demo"
            ? " · synthetic data"
            : mode === "replay"
              ? " · recorded chat"
              : " · received chat"}
        </span>
        <span>
          <Users size={13} /> {number(state.participants)}{" "}
          {simulated ? "simulated contributors" : "active participants"}
        </span>
        <span>
          Analysis coverage {Math.round(state.analysis.coverage * 100)}%
        </span>
        <span>Shared y-axis · people / {bucketSeconds}s</span>
      </div>
      {simulated && (
        <p className="analytics-warning">
          Test mode: each message is counted as a separate contributor. These
          are simulated counts.
        </p>
      )}
      {state.gaps.length > 0 && (
        <p className="analytics-warning">
          Connection gaps detected. Charts cover received messages only; missing
          activity cannot be reconstructed.
        </p>
      )}
      {topics.length ? (
        <div className="analytics-grid">
          {topics.map((topic, rank) => {
            const color = palette[rank];
            const points = topic.spark
              .map((value, index) => `${x(index)},${y(value)}`)
              .join(" ");
            const selectedValue =
              activeBin === null ? null : topic.spark[activeBin];
            const share = state.participants
              ? (topic.contributors / state.participants) * 100
              : 0;
            return (
              <article
                key={topic.id}
                className="topic-chart-card"
                style={{ "--chart-color": color } as React.CSSProperties}
                aria-label={`${topic.label} analytics`}
              >
                <div className="topic-chart-heading">
                  <span className="topic-chart-rank">0{rank + 1}</span>
                  <h3>{topic.label}</h3>
                  <span className="topic-chart-share">
                    {share.toFixed(1)}% of participants
                  </span>
                </div>
                <div className="topic-chart-metrics">
                  <div>
                    <strong>{number(topic.contributors)}</strong>
                    <span>
                      {simulated ? "simulated contributors" : "distinct people"}
                    </span>
                  </div>
                  <div>
                    <strong>{number(topic.messages)}</strong>
                    <span>messages</span>
                  </div>
                  <span
                    className={`topic-chart-delta ${topic.trend < 0 ? "is-down" : ""}`}
                  >
                    {topic.trend < 0 ? (
                      <ArrowDownRight size={14} />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    {topic.trend > 0 ? "+" : ""}
                    {topic.trend} people<small>last 60s vs. prior 60s</small>
                  </span>
                </div>
                <div className="topic-chart-caption">
                  <span>Distinct contributors per {bucketSeconds}s</span>
                  <strong>
                    {selectedValue === null || selectedValue === undefined
                      ? "Hover or focus to inspect"
                      : `${bucketLabel(activeBin!)} · ${selectedValue} people`}
                  </strong>
                </div>
                <svg
                  viewBox="0 0 356 145"
                  role="group"
                  aria-label={`${topic.label}: distinct contributors per ${bucketSeconds}-second bucket, shared scale 0 to ${ceiling}`}
                  onMouseLeave={() => setActiveBin(null)}
                >
                  {[0, 1, 2, 3, 4].map((tick) => (
                    <g key={tick}>
                      <line
                        x1="34"
                        x2="334"
                        y1={y(tick * step)}
                        y2={y(tick * step)}
                        className="chart-gridline"
                      />
                      <text
                        x="25"
                        y={y(tick * step) + 3}
                        textAnchor="end"
                        className="chart-axis-label"
                      >
                        {tick * step}
                      </text>
                    </g>
                  ))}
                  {points && (
                    <>
                      <polygon
                        points={`${x(0)},118 ${points} ${x(topic.spark.length - 1)},118`}
                        fill={color}
                        opacity=".09"
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                  {activeBin !== null && (
                    <line
                      x1={x(activeBin)}
                      x2={x(activeBin)}
                      y1="21"
                      y2="118"
                      stroke={color}
                      strokeDasharray="3 4"
                      opacity=".5"
                    />
                  )}
                  {topic.spark.map((value, index) => (
                    <g key={index}>
                      <circle
                        cx={x(index)}
                        cy={y(value)}
                        r={activeBin === index ? 4.5 : 2.5}
                        fill={color}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                      <rect
                        x={x(index) - 12}
                        y="18"
                        width="24"
                        height="105"
                        fill="transparent"
                        tabIndex={0}
                        role="button"
                        aria-label={`${bucketLabel(index)}: ${value} distinct contributors`}
                        onClick={() => onInspect?.(topic, index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onInspect?.(topic, index);
                          }
                        }}
                        onMouseEnter={() => setActiveBin(index)}
                        onFocus={() => setActiveBin(index)}
                        onBlur={() => setActiveBin(null)}
                      >
                        <title>
                          {bucketLabel(index)}: {value} people
                        </title>
                      </rect>
                    </g>
                  ))}
                  <text x="34" y="138" className="chart-axis-label">
                    −{windowSeconds}s
                  </text>
                  <text
                    x="184"
                    y="138"
                    textAnchor="middle"
                    className="chart-axis-label"
                  >
                    −{windowSeconds / 2}s
                  </text>
                  <text
                    x="334"
                    y="138"
                    textAnchor="end"
                    className="chart-axis-label"
                  >
                    Now
                  </text>
                </svg>
                {onDraft && (
                  <div className="chart-actions">
                    <button
                      className="text-button"
                      disabled={!state.session}
                      onClick={() => onDraft(topic)}
                    >
                      Create vote draft
                    </button>
                    <button
                      className="text-button"
                      disabled={!state.analysis.windowEnd}
                      onClick={() =>
                        onInspect?.(
                          topic,
                          topic.spark.indexOf(Math.max(...topic.spark)),
                        )
                      }
                    >
                      Inspect peak evidence
                    </button>
                  </div>
                )}
                {topic.intent && (
                  <p className="intent-labels">
                    Language patterns · {topic.intent.suggestions} suggestions ·{" "}
                    {topic.intent.disagreement} disagreements ·{" "}
                    {topic.intent.questions} questions
                  </p>
                )}
                <div className="topic-chart-foot">
                  <span>Repeat-message share</span>
                  <strong>{(topic.repetition * 100).toFixed(1)}%</strong>
                  <div className="topic-repetition-track">
                    <i style={{ width: `${topic.repetition * 100}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="analytics-empty">
          <Activity size={28} />
          <h3>Waiting for conversation to take shape</h3>
          <p>Charts appear as topics qualify. No activity is fabricated.</p>
        </div>
      )}
      {topics.length > 0 && topics.length < 4 && (
        <p className="analytics-note">
          {topics.length} qualifying {topics.length === 1 ? "topic" : "topics"}{" "}
          so far. More panels appear as new topics emerge.
        </p>
      )}
      <footer className="analytics-footer">
        <p>
          People can participate in multiple topics, so shares may total more
          than 100%. A person is counted once per bucket; bucket counts cannot
          be summed into unique people for the whole window. Repeat-message
          share is (messages − contributors) / messages.
        </p>
        <details>
          <summary>View exact chart data</summary>
          <div className="analytics-table-wrap">
            <table>
              <caption>
                Distinct contributors per {bucketSeconds}-second bucket ·
                relative to the latest analysis window
              </caption>
              <thead>
                <tr>
                  <th scope="col">Window</th>
                  {topics.map((topic) => (
                    <th scope="col" key={topic.id}>
                      {topic.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: binCount }, (_, index) => (
                  <tr key={index}>
                    <th scope="row">{bucketLabel(index)}</th>
                    {topics.map((topic) => (
                      <td key={topic.id}>{topic.spark[index] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </footer>
    </section>
  );
}
