import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  Gamepad2,
  Music2,
  Coffee,
  Blocks,
  LockKeyhole,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  History,
  LayoutGrid,
  List,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Pin,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
  Vote,
  Waypoints,
  X,
} from "lucide-react";
import type {
  Snapshot,
  Decision,
  Topic,
  OverlayPreferences,
} from "../../../packages/shared/src/index";
import {
  voteHelp,
  testVoteHelp,
  defaultOverlayPreferences,
} from "../../../packages/shared/src/index";
import { api, ApiError, subscribe } from "./api";
import "./style.css";
import "./studio.css";
import "./twitch.css";
import "./overlay-clusters.css";
import { TopicAnalytics } from "./TopicAnalytics";
import {
  WorkspaceInsights,
  EvidenceDialog,
  OverlayStyleControls,
  SessionRecap,
  ConnectionReadiness,
  type EvidenceSelection,
} from "./WorkspaceInsights";
const colors = [
  "blue",
  "peach",
  "mint",
  "lavender",
  "sand",
  "pink",
  "blue",
  "mint",
];
const fmt = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: n > 9999 ? "compact" : "standard",
  }).format(n);
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark studio-mark">
        <i />
        <i />
        <i />
      </span>
      chatlas
    </div>
  );
}
function TwitchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 2 2 6v16h6v2l4-4h5l5-5V2H4Zm16 12-4 4h-5l-3 3v-3H5V4h15v10ZM10 7h2v6h-2V7Zm5 0h2v6h-2V7Z" />
    </svg>
  );
}
function FrontPage({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="front-page" aria-label="Discover Chatlas">
      <div className="front-page-inner">
        <nav className="front-nav" aria-label="Product navigation">
          <a href="#" aria-label="Chatlas home">
            <Brand />
          </a>
          <div className="front-nav-links">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#use-cases">Use cases</a>
            <a href="#workspace" onClick={onExplore}>
              Demo
            </a>
          </div>
          <div className="front-nav-actions">
            <a className="button front-login" href="/auth/twitch/start">
              Log in
            </a>
            <a className="button primary" href="/auth/twitch/start">
              <TwitchIcon /> Connect Twitch <ArrowRight size={17} />
            </a>
          </div>
        </nav>
        <div className="front-hero" id="product">
          <div className="front-copy">
            <span className="front-eyebrow">
              <Sparkles size={14} /> MADE FOR YOUR COMMUNITY
            </span>
            <h1>
              Big chat.
              <br />
              <span>Clear voices.</span>
            </h1>
            <p>
              Turn fast-moving Twitch chat into topics,
              <br className="desktop-break" /> fair votes, and moments everyone
              can join.
            </p>
            <div className="front-benefits" id="how-it-works">
              <span>
                <MessageCircle /> See the topics
              </span>
              <span>
                <Users /> Hear distinct voices
              </span>
              <span>
                <Vote /> Decide together
              </span>
            </div>
            <div className="front-cta">
              <a className="button primary" href="/auth/twitch/start">
                <TwitchIcon /> Connect Twitch <ArrowRight size={18} />
              </a>
              <a
                className="button demo-cta"
                href="#workspace"
                onClick={onExplore}
              >
                <Play size={15} fill="currentColor" /> Explore the demo
              </a>
            </div>
            <small>No viewer accounts needed. Just your chat, together.</small>
          </div>
          <div className="hero-conversations" aria-hidden="true">
            <div className="hero-cloud cloud-game">
              <span className="cloud-bubbles">✦ · · ✧ ·</span>
              <span>
                <Gamepad2 /> Next game
              </span>
              <small>valorant? &nbsp; minecraft!</small>
            </div>
            <div className="hero-cloud cloud-music">
              <span className="cloud-bubbles">♪ · ✦ · ♪</span>
              <span>
                <Music2 /> Music
              </span>
              <small>play lo-fi &nbsp; ♡</small>
            </div>
            <div className="hero-cloud cloud-break">
              <span className="cloud-bubbles">· ✧ · · ✦</span>
              <span>
                <Coffee /> Take a break
              </span>
              <small>stretch time &nbsp; grab water</small>
            </div>
          </div>
        </div>
      </div>
      <div className="front-caption" id="use-cases">
        <span>
          <MessageCircle size={15} /> Catch the conversation
        </span>
        <i />
        <span>
          <Vote size={15} /> Make the next move together
        </span>
        <i />
        <span>
          <Radio size={15} /> Bring your community on stream
        </span>
      </div>
    </section>
  );
}
function Spark({
  values,
  color = "currentColor",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <svg className="spark" viewBox="0 0 100 25" aria-label="Recent activity">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={values
          .map(
            (v, i) =>
              `${(i * 100) / Math.max(1, values.length - 1)},${23 - (v / max) * 20}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
function IslandArt({ seed, count }: { seed: number; count: number }) {
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    const r =
      42 + 3 * Math.sin(a * 3 + seed) + 2 * Math.cos(a * 5 + seed * 0.5);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  });
  const d =
    points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ") + "Z";
  return (
    <svg className="island-art" viewBox="0 0 100 100" aria-hidden="true">
      <path className="island-fill" d={d} />
      {[1, 0.93, 0.83, 0.71, 0.58].map((scale, i) => (
        <path
          key={i}
          className="contour"
          d={d}
          transform={`translate(${50 * (1 - scale)} ${50 * (1 - scale)}) scale(${scale})`}
          opacity={1 - i * 0.14}
        />
      ))}
      {Array.from({ length: Math.min(count * 8, 240) }, (_, i) => {
        const a = i * 2.399963 + seed;
        const radius = Math.sqrt((i + 0.5) / Math.min(count * 8, 240)) * 37;
        return (
          <circle
            key={i}
            cx={50 + Math.cos(a) * radius}
            cy={50 + Math.sin(a) * radius}
            r="1.2"
          />
        );
      })}
    </svg>
  );
}
function TopicGlyph({ label }: { label: string }) {
  const Icon = /minecraft/i.test(label)
    ? Blocks
    : /valorant|game/i.test(label)
      ? Gamepad2
      : /music/i.test(label)
        ? Music2
        : /break/i.test(label)
          ? Coffee
          : MessageCircle;
  return <Icon size={25} />;
}
function App() {
  const [state, setState] = useState<Snapshot | null>(null),
    [online, setOnline] = useState(false),
    [tab, setTab] = useState("Live room"),
    [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<"atlas" | "list">(
      window.matchMedia("(max-width: 600px)").matches ? "list" : "atlas",
    ),
    [composer, setComposer] = useState(false),
    [candidates, setCandidates] = useState<string[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [chat, setChat] = useState(""),
    [user, setUser] = useState("you"),
    [busy, setBusy] = useState(false),
    [contributorToggle, setContributorToggle] = useState<boolean | null>(null),
    [overlayUrl, setOverlayUrl] = useState(""),
    [overlayLayout, setOverlayLayout] = useState("compact"),
    [lightPreview, setLightPreview] = useState(false),
    [replayText, setReplayText] = useState(""),
    [syntheticReplay, setSyntheticReplay] = useState(true),
    [historyDetail, setHistoryDetail] = useState<{
      session: { id: string };
      decisions: Decision[];
    } | null>(null);
  const [evidenceSelection, setEvidenceSelection] =
    useState<EvidenceSelection | null>(null);
  const [voteSeed, setVoteSeed] = useState<{
    question: string;
    options: string[];
  } | null>(null);
  const [overlayDraft, setOverlayDraft] = useState<OverlayPreferences | null>(
    null,
  );
  function draftTopic(topic: Topic) {
    const choices = [
      ...new Set(
        (topic.highlights ?? []).map((item) => item.label.slice(0, 70)),
      ),
    ].slice(0, 5);
    const options =
      choices.length >= 2
        ? choices
        : [choices[0] ?? topic.label.slice(0, 70), "Another idea"];
    setVoteSeed({
      question:
        `What should we do about ${topic.label.replace(/ discussion$/i, "")}?`.slice(
          0,
          180,
        ),
      options,
    });
    setComposer(true);
  }
  const revision = useRef(-1);
  const accept = (s: Snapshot) => {
    if (s.revision >= revision.current) {
      revision.current = s.revision;
      setState(s);
    }
  };
  useEffect(() => {
    let cleanup = () => {};
    let active = true;
    (async () => {
      try {
        let s: Snapshot;
        try {
          s = await api("/snapshot");
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
          await api("/demo/bootstrap", {});
          s = await api("/snapshot");
        }
        if (!s.session && !s.sessions.length && !s.connection.channel) {
          await api("/sessions/start", { source: "demo" });
          s = await api("/snapshot");
        }
        if (active) {
          accept(s);
          cleanup = subscribe(false, accept, setOnline);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function act(fn: () => Promise<unknown>, success = "") {
    setError("");
    setBusy(true);
    try {
      await fn();
      accept(await api("/snapshot"));
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const paused = state?.playback.paused ?? false;
  const autoSelectSession = useRef<string | null>(null);
  useEffect(() => {
    if (
      state?.session &&
      state.topics.length &&
      autoSelectSession.current !== state.session.id
    ) {
      autoSelectSession.current = state.session.id;
      setSelected(state.topics[0].id);
    }
  }, [state]);
  const slots = useRef(new Map<string, number>());
  const topic = state?.topics.find((t) => t.id === selected) ?? null;
  const topics = (state?.topics ?? [])
    .filter((t) => t.label.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.contributors - a.contributors,
    );
  const visibleTopics = topics.slice(0, 4);
  for (const id of slots.current.keys())
    if (!visibleTopics.some((t) => t.id === id)) slots.current.delete(id);
  for (const t of visibleTopics)
    if (!slots.current.has(t.id)) {
      const used = new Set(slots.current.values());
      slots.current.set(t.id, [0, 1, 2, 3].find((n) => !used.has(n)) ?? 0);
    }
  const decision = state?.decision;
  const source = state?.session?.source ?? "demo";
  function rotate() {
    void act(async () => {
      const r = await api("/overlay/rotate", {});
      setOverlayUrl(`${location.origin}/overlay#${r.token}`);
    }, "Overlay link created. Keep it private.");
  }
  if (location.pathname === "/overlay") return <Overlay />;
  return (
    <>
      {tab === "Live room" && (
        <FrontPage onExplore={() => setTab("Live room")} />
      )}
      <div
        id="workspace"
        className={`app-shell studio ${tab === "Overlay" ? "overlay-settings-page" : ""} ${state?.settings.testUniqueMessages ? "testing-contributors" : ""}`}
      >
        <header className="studio-header">
          <Brand />
          <span className={`badge ${source === "live" ? "live" : "demo"}`}>
            {state?.session ? source.toUpperCase() : "READY"}
          </span>
          <span className="studio-channel">
            @{state?.connection.channel ?? "yourchannel"}
          </span>
          <div className="studio-header-spacer" />
          <button
            className="button primary"
            onClick={() => setComposer(true)}
            disabled={!state?.session}
          >
            <Plus size={20} />
            New decision
          </button>
          <div className="studio-status">
            <span className={`connection ${online ? "connected" : ""}`}>
              <i />
              {online ? "Workspace connected" : "Connecting to workspace"}
            </span>
            <small>
              {state?.session
                ? source === "demo"
                  ? "Synthetic demo data"
                  : source === "replay"
                    ? "Recorded conversation"
                    : state.connection.state
                : "Ready for a new session"}
            </small>
          </div>
          <button
            className="studio-owner"
            aria-label="Open settings"
            onClick={() => setTab("Settings")}
          >
            {(state?.connection.channel ?? "S").slice(0, 1).toUpperCase()}
          </button>
        </header>
        <aside className="sidebar">
          <Brand />
          <div className="workspace-label">YOUR WORKSPACE</div>
          <button className="workspace">
            <span className="avatar">V</span>
            <span>
              <strong>{state?.connection.channel ?? "Your channel"}</strong>
              <small>Streamer workspace</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <nav aria-label="Main navigation">
            {[
              ["Live room", Radio],
              ["Decisions", Vote],
              ["Session history", History],
              ["Overlay", Eye],
              ["Settings", Settings],
            ].map(([name, Icon]: any) => (
              <button
                key={name}
                className={tab === name ? "nav-item active" : "nav-item"}
                onClick={() => setTab(name)}
              >
                <Icon size={18} />
                {name}
                {name === "Live room" && <span className="nav-dot" />}
                {name === "Decisions" && candidates.length > 0 && (
                  <span className="nav-count">{candidates.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="side-note">
              <span className="tiny-orbit">
                <Sparkles size={17} />
              </span>
              <strong>A little clarity for your chat.</strong>
              <p>
                Find the conversation.
                <br />
                Let your community decide.
              </p>
            </div>
            <a
              className="help-link"
              href="https://dev.twitch.tv/docs/"
              target="_blank"
              rel="noreferrer"
            >
              <CircleHelp size={16} />
              Twitch documentation
              <ArrowUpRight size={14} />
            </a>
            <div className="profile">
              <span className="avatar small">V</span>
              <span>
                <strong>Channel owner</strong>
                <small>Local installation</small>
              </span>
              <ShieldCheck size={16} />
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <div>
              <span className="muted">Workspace</span>
              <ChevronRight size={14} />
              <span>{tab}</span>
            </div>
            <div className="topbar-right">
              <span className={`connection ${online ? "connected" : ""}`}>
                <i />
                {online ? "Connected to Chatlas" : "Reconnecting to Chatlas"}
              </span>
              <span className="top-divider" />
              <span className="local-label">
                <Globe size={14} />
                Local workspace
              </span>
            </div>
          </header>
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">THE CONVERSATION, AT A GLANCE</div>
                <h1>
                  {tab === "Live room"
                    ? "Live room"
                    : tab === "Decisions"
                      ? "Make the next move together."
                      : tab === "Session history"
                        ? "Every conversation has a story."
                        : tab === "Overlay"
                          ? "Your community, on stream."
                          : "Make Chatlas yours."}
                </h1>
                <p>
                  {tab === "Live room"
                    ? "The conversation, made clear."
                    : tab === "Decisions"
                      ? "Turn the conversation into a clear, explicit approval vote."
                      : tab === "Session history"
                        ? "Your sessions and decisions, saved on this installation."
                        : "Your connection, broadcast overlay, and privacy controls."}
                </p>
              </div>
              <div className="heading-actions">
                {tab === "Live room" && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setComposer(true);
                    }}
                    disabled={!state?.session}
                  >
                    <Plus size={16} />
                    New decision
                  </button>
                )}
              </div>
            </div>
            {state?.settings.testUniqueMessages && (
              <div role="status" className="test-contributors-notice">
                <Sparkles size={18} />
                <span>
                  <strong>TEST MODE — simulated contributors</strong>Every
                  message counts as a different contributor for topics. Each
                  valid vote message counts as a separate simulated voter.
                </span>
                <button
                  className="button small-button"
                  onClick={() =>
                    void act(() =>
                      api("/settings", { testUniqueMessages: false }, "PATCH"),
                    )
                  }
                >
                  Use real contributors
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="alert">
                <CircleHelp size={18} />
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {notice && (
              <div role="status" className="toast">
                <CheckCheck size={17} />
                {notice}
              </div>
            )}
            {!state ? (
              <div className="loading">
                <LoaderCircle className="spin" />
                Preparing your workspace…
                {error && (
                  <button
                    className="button"
                    onClick={() => (location.href = "/auth/twitch/start")}
                  >
                    Sign in with Twitch
                  </button>
                )}
              </div>
            ) : (
              <>
                <section className="session-strip" aria-label="Session status">
                  <div className="channel-icon">
                    <AudioLines size={20} />
                  </div>
                  <div className="session-channel">
                    <strong>
                      {state.connection.channel
                        ? "@" + state.connection.channel
                        : "Chatlas playground"}
                    </strong>
                    <span>
                      {state.session
                        ? "Session " + state.session.id.slice(0, 6)
                        : "No active session"}
                      <span className="strip-separator">·</span>
                      {state.session
                        ? new Date(state.session.startedAt).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "Ready when you are"}
                    </span>
                  </div>
                  <span
                    className={`badge ${source === "live" ? "live" : "demo"}`}
                  >
                    <i />
                    {state.session ? source.toUpperCase() : "READY"}
                  </span>
                  <span className="session-state">
                    {!state.session
                      ? "Start a session to begin"
                      : source === "live"
                        ? state.connection.state
                        : source === "replay"
                          ? "Consented recording"
                          : "Synthetic conversation"}
                  </span>
                  <div className="strip-spacer" />
                  {source !== "live" && state.session && (
                    <button
                      className="icon-button"
                      aria-label={paused ? "Resume demo" : "Pause demo"}
                      onClick={() =>
                        void act(async () => {
                          await api("/replay/control", { paused: !paused });
                        })
                      }
                    >
                      {paused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                  )}
                  <button
                    className="button small-button"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api(
                          state.session ? "/sessions/end" : "/sessions/start",
                          state.session
                            ? {}
                            : {
                                source: state.connection.channel
                                  ? "live"
                                  : "demo",
                              },
                        );
                        if (!state.session && state.connection.channel)
                          await api("/connection/connect", {});
                      })
                    }
                  >
                    {state.session ? (
                      <>
                        <Square size={12} />
                        End session
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        Start session
                      </>
                    )}
                  </button>
                </section>
                {tab === "Live room" && (
                  <>
                    <div className="live-layout">
                      <section className="atlas-card">
                        <div className="section-top">
                          <div>
                            <h2>
                              <span className="pulse-dot" />
                              Conversation atlas
                            </h2>
                            <p>Different threads. One shared conversation.</p>
                          </div>
                          <div className="segmented" aria-label="Atlas view">
                            <button
                              aria-label="Atlas view"
                              className={view === "atlas" ? "selected" : ""}
                              onClick={() => setView("atlas")}
                            >
                              <LayoutGrid size={15} />
                            </button>
                            <button
                              aria-label="List view"
                              className={view === "list" ? "selected" : ""}
                              onClick={() => setView("list")}
                            >
                              <List size={17} />
                            </button>
                          </div>
                        </div>
                        <div className="atlas-toolbar">
                          <div className="metric-inline">
                            <Users size={14} />
                            <strong>{fmt(state.participants)}</strong>
                            <span>
                              {state.settings.testUniqueMessages
                                ? "test contributors"
                                : "participants"}
                            </span>
                            <span className="dot-divider">·</span>
                            <MessageCircle size={14} />
                            <strong>{fmt(state.messageCount)}</strong>
                            <span>messages</span>
                          </div>
                          <select
                            aria-label="Size islands by"
                            value={state.settings.area}
                            onChange={(e) =>
                              void act(() =>
                                api(
                                  "/settings",
                                  { area: e.target.value },
                                  "PATCH",
                                ),
                              )
                            }
                          >
                            <option value="people">Size by people</option>
                            <option value="messages">Size by messages</option>
                          </select>
                        </div>
                        {view === "atlas" ? (
                          <div className="atlas-stage">
                            <div className="atlas-grid" />
                            <div className="atlas-window">
                              <span className="mini-dot" />
                              Last 2 minutes
                            </div>
                            <svg
                              className="atlas-connectors"
                              viewBox="0 0 800 480"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              <path d="M200 155 Q350 130 510 120 M200 155 Q220 300 350 320 M510 120 Q640 180 605 300 M350 320 Q480 380 605 300" />
                            </svg>
                            {visibleTopics.map((t, i) => {
                              const slot = slots.current.get(t.id) ?? i;
                              const value =
                                state.settings.area === "people"
                                  ? t.contributors
                                  : t.messages;
                              const max = Math.max(
                                1,
                                ...visibleTopics.map((t) =>
                                  state.settings.area === "people"
                                    ? t.contributors
                                    : t.messages,
                                ),
                              );
                              const size = 220 + Math.sqrt(value / max) * 85;
                              return (
                                <button
                                  key={t.id}
                                  className={`island ${colors[slot % 8]} ${selected === t.id ? "chosen" : ""} ${t.pinned ? "pinned" : ""}`}
                                  style={{
                                    left: [25, 73, 25, 73][slot] + "%",
                                    top: [27, 29, 73, 73][slot] + "%",
                                    width: size,
                                    height: size,
                                  }}
                                  onClick={() => setSelected(t.id)}
                                  aria-label={`${t.label}, ${t.contributors} people, ${t.messages} messages`}
                                >
                                  <IslandArt
                                    seed={slot + 1}
                                    count={t.contributors}
                                  />
                                  <span className="island-content">
                                    <span className="island-icon">
                                      <TopicGlyph label={t.label} />
                                    </span>
                                    <strong>{t.label}</strong>
                                    <span className="island-count">
                                      <b>{t.contributors}</b> people
                                    </span>
                                    <Spark values={t.spark} />
                                  </span>
                                  {t.pinned && (
                                    <Pin size={12} className="pin-mark" />
                                  )}
                                </button>
                              );
                            })}
                            {!topics.length && (
                              <div className="empty-atlas">
                                <Waypoints size={38} />
                                <h3>
                                  {state.session
                                    ? "Waiting for more conversation"
                                    : "A new conversation awaits"}
                                </h3>
                                <p>
                                  {state.session
                                    ? "Topics appear after several distinct people join a thread."
                                    : "Start a session to see chat take shape."}
                                </p>
                              </div>
                            )}
                            <div className="atlas-legend">
                              <span>
                                <i className="blue-dot" />
                                Area ={" "}
                                {state.settings.area === "people"
                                  ? "distinct people"
                                  : "message volume"}
                              </span>
                              {topics.length > 4 && (
                                <button
                                  className="text-button"
                                  onClick={() => setView("list")}
                                >
                                  View all {topics.length} topics{" "}
                                  <ArrowRight size={14} />
                                </button>
                              )}
                            </div>
                            <div className="atlas-hint">
                              <MousePointer2 size={13} />
                              Select a topic to explore
                            </div>
                          </div>
                        ) : (
                          <div className="topic-list">
                            <label className="search">
                              <Search size={16} />
                              <input
                                placeholder="Find a topic…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                              />
                            </label>
                            {topics.map((t, i) => (
                              <button
                                key={t.id}
                                className={`topic-row ${selected === t.id ? "selected" : ""}`}
                                onClick={() => setSelected(t.id)}
                              >
                                <span
                                  className={`topic-swatch ${colors[i % 8]}`}
                                >
                                  <MessageCircle size={17} />
                                </span>
                                <span>
                                  <strong>{t.label}</strong>
                                  <small>
                                    {t.messages} messages · {t.contributors}{" "}
                                    people
                                  </small>
                                </span>
                                <Spark values={t.spark} />
                                <ChevronRight size={15} />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="atlas-footer">
                          <span>
                            <span className="status-dot" />
                            {state.analysis.provider} ·{" "}
                            {Math.round(state.analysis.coverage * 100)}%
                            coverage
                          </span>
                          <span title="Each participant is counted once per topic. People can discuss multiple topics; shares need not sum to 100%.">
                            <CircleHelp size={13} />
                            Mentions are not votes
                          </span>
                        </div>
                      </section>
                      <aside className="inspector">
                        {topic ? (
                          <>
                            <div className="inspector-top">
                              <span className="eyebrow">TOPIC</span>
                              <button
                                aria-label="Close inspector"
                                className="icon-button"
                                onClick={() => setSelected(null)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div
                              className={`inspector-symbol ${colors[topics.findIndex((t) => t.id === topic.id) % 8]}`}
                            >
                              <MessageCircle size={23} />
                            </div>
                            <h2>{topic.label}</h2>
                            {!topic.approved &&
                              topic.labelSource === "extracted" && (
                                <div className="extracted-label-note">
                                  <p>
                                    Label extracted from recurring words, not a
                                    semantic summary. Review before showing it
                                    on stream.
                                  </p>
                                  <button
                                    className="button small-button"
                                    onClick={() =>
                                      void act(
                                        () =>
                                          api(
                                            "/topics/" + topic.id,
                                            { label: topic.label },
                                            "PATCH",
                                          ),
                                        "Topic label approved for the overlay",
                                      )
                                    }
                                  >
                                    Approve label for overlay
                                  </button>
                                </div>
                              )}

                            <p className="inspector-sub">
                              A thread in the last two minutes. Explore the
                              messages behind it.
                            </p>
                            <div className="topic-stats">
                              <div>
                                <strong>{topic.contributors}</strong>
                                <span>people</span>
                              </div>
                              <div>
                                <strong>{topic.messages}</strong>
                                <span>messages</span>
                              </div>
                              <div title="Distinct topic contributors divided by all active participants. Shares may total more than 100%.">
                                <strong>
                                  {Math.round(topic.share * 100)}%
                                </strong>
                                <span>of participants</span>
                              </div>
                            </div>
                            <div className="trend-row">
                              <Spark values={topic.spark} />
                              <span>
                                {topic.trend >= 0 ? (
                                  <ArrowUpRight size={13} />
                                ) : (
                                  <ArrowDown size={13} />
                                )}{" "}
                                {Math.abs(topic.trend)} people vs. previous
                                minute
                              </span>
                            </div>
                            <div className="inspector-rule" />
                            <div className="evidence-heading">
                              <h3>Example messages</h3>
                              <span>
                                <LockKeyhole size={12} />
                                Only visible to you
                              </span>
                            </div>
                            <div className="evidence-list">
                              {topic.evidence
                                .filter(
                                  (m, i, all) =>
                                    all.findIndex(
                                      (x) =>
                                        x.userId === m.userId &&
                                        x.text === m.text,
                                    ) === i,
                                )
                                .slice(0, 3)
                                .map((m) => (
                                  <div className="evidence" key={m.id}>
                                    <div>
                                      <span className="message-avatar">
                                        {m.name.slice(0, 1).toUpperCase()}
                                      </span>
                                      <strong>{m.name}</strong>
                                      <time>
                                        {new Date(m.at).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </time>
                                    </div>
                                    <p>{m.text}</p>
                                    <button
                                      className="delete-message"
                                      aria-label={"Remove message " + m.id}
                                      onClick={() =>
                                        void act(() =>
                                          api("/moderate", { messageId: m.id }),
                                        )
                                      }
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                            </div>
                            <div className="repetition-note">
                              <span>
                                {Math.round(topic.repetition * 100)}% repetition
                              </span>
                              <CircleHelp size={13} />
                              <p>
                                Message volume beyond one message per
                                contributor. This does not imply spam.
                              </p>
                            </div>
                            <button
                              className="button primary full"
                              onClick={() => draftTopic(topic)}
                            >
                              <Plus size={16} />
                              Create vote draft
                            </button>
                            <div className="topic-actions">
                              <button
                                onClick={() => {
                                  const label = prompt(
                                    "Neutral topic label",
                                    topic.label,
                                  );
                                  if (label)
                                    void act(() =>
                                      api(
                                        "/topics/" + topic.id,
                                        { label },
                                        "PATCH",
                                      ),
                                    );
                                }}
                              >
                                Rename
                              </button>
                              <button
                                onClick={() =>
                                  void act(() =>
                                    api(
                                      "/topics/" + topic.id,
                                      { pinned: !topic.pinned },
                                      "PATCH",
                                    ),
                                  )
                                }
                              >
                                <Pin size={12} />
                                {topic.pinned ? "Unpin" : "Pin"}
                              </button>
                              <button
                                onClick={() =>
                                  void act(() =>
                                    api(
                                      "/topics/" + topic.id,
                                      { hidden: true },
                                      "PATCH",
                                    ),
                                  )
                                }
                              >
                                <EyeOff size={12} />
                                Hide
                              </button>
                            </div>
                            <div className="topic-actions">
                              <button
                                onClick={() => {
                                  const target = prompt(
                                    "Merge with topic: enter its exact label",
                                  );
                                  const other = state.topics.find(
                                    (t) =>
                                      t.id !== topic.id &&
                                      t.label.toLowerCase() ===
                                        target?.toLowerCase(),
                                  );
                                  if (!other) {
                                    if (target)
                                      setError(
                                        "No matching topic. Use the exact label from the atlas.",
                                      );
                                    return;
                                  }
                                  const label = prompt(
                                    "Label for the merged topic",
                                    topic.label,
                                  );
                                  if (label)
                                    void act(() =>
                                      api("/topics/merge", {
                                        ids: [topic.id, other.id],
                                        label,
                                      }),
                                    );
                                }}
                              >
                                Merge topic
                              </button>
                              <button
                                onClick={() => {
                                  const text = prompt(
                                    "Split evidence: enter the exact message text to move",
                                  );
                                  const message = topic.evidence.find(
                                    (m) => m.text === text,
                                  );
                                  if (!message) {
                                    if (text)
                                      setError(
                                        "Choose a message shown in the evidence inspector.",
                                      );
                                    return;
                                  }
                                  const label = prompt(
                                    "Neutral label for the new topic",
                                  );
                                  if (label)
                                    void act(() =>
                                      api("/topics/" + topic.id + "/split", {
                                        messageIds: [message.id],
                                        label,
                                      }),
                                    );
                                }}
                              >
                                Split evidence
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="inspector-top">
                              <span className="eyebrow">A CLOSER LOOK</span>
                              <MoreHorizontal size={18} />
                            </div>
                            <div className="inspector-empty">
                              <div className="inspect-art">
                                <span />
                                <span />
                                <span />
                                <MousePointer2 size={26} />
                              </div>
                              <h2>Every topic has a story.</h2>
                              <p>
                                Select an island to see the messages behind it,
                                who's joining in, and how it's changing.
                              </p>
                              <div className="inspect-tip">
                                <MessageCircle size={16} />
                                <span>
                                  Real messages. Clear context.
                                  <br />
                                  No guessing what chat means.
                                </span>
                              </div>
                            </div>
                            <div className="decision-nudge">
                              <div>
                                <Vote size={19} />
                                <span>FROM PULSE TO DECIDE</span>
                              </div>
                              <h3>
                                Give the conversation
                                <br />a next step.
                              </h3>
                              <p>
                                Pick a few ideas from chat and let everyone
                                approve their favorites.
                              </p>
                              <button onClick={() => setComposer(true)}>
                                Create a decision
                                <ArrowRight size={15} />
                              </button>
                            </div>
                          </>
                        )}
                      </aside>
                    </div>
                    <WorkspaceInsights
                      state={state}
                      online={online}
                      inspect={(topic, bucket) =>
                        setEvidenceSelection({
                          topic,
                          bucket,
                          windowEnd: state.analysis.windowEnd ?? 0,
                        })
                      }
                      draft={draftTopic}
                    />
                    <TopicAnalytics
                      state={state}
                      online={online}
                      onInspect={(topic, bucket) =>
                        setEvidenceSelection({
                          topic,
                          bucket,
                          windowEnd: state.analysis.windowEnd ?? 0,
                        })
                      }
                      onDraft={draftTopic}
                    />
                    <section className="timeline-card">
                      <div className="timeline-title">
                        <Activity size={17} />
                        <strong>Conversation activity</strong>
                        <span>Last 2 minutes</span>
                      </div>
                      <div
                        className="timeline-bars"
                        aria-label="Messages over the last two minutes"
                      >
                        {state.timeline.map((n, i) => (
                          <span
                            key={i}
                            title={`${n} messages`}
                            style={{
                              height: Math.max(
                                4,
                                (n / Math.max(...state.timeline, 1)) * 43,
                              ),
                            }}
                          />
                        ))}
                        {state.gaps.length > 0 && (
                          <span
                            className="gap-marker"
                            title="Connection gaps: missed messages cannot be recovered"
                          />
                        )}
                      </div>
                      <div className="timeline-status">
                        <span className="pulse-dot" />
                        <strong>
                          {paused
                            ? "Demo paused"
                            : state.session
                              ? "Conversation flowing"
                              : "Session ended"}
                        </strong>
                        <small>
                          {source === "demo"
                            ? "Synthetic messages · never audience evidence"
                            : "Only received messages are shown"}
                        </small>
                      </div>
                    </section>
                    <div className="bottom-row">
                      <span>
                        <ShieldCheck size={14} />
                        Participating chatters, not all viewers. Every account
                        has equal vote weight outside test mode.
                      </span>
                      <button onClick={() => setTab("Settings")}>
                        Set up your overlay
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {source === "demo" && state.session && (
                      <section className="demo-console">
                        <div>
                          <span className="badge demo">DEMO LAB</span>
                          <strong>Try a message or cast a test ballot</strong>
                          <p>
                            These synthetic identities stay separate from Live
                            mode.
                          </p>
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (chat.trim())
                              void act(async () => {
                                await api("/demo/messages", {
                                  text: chat,
                                  userId: user,
                                });
                                setChat("");
                              }, "Demo message received");
                          }}
                        >
                          <input
                            aria-label="Demo participant"
                            value={user}
                            onChange={(e) => setUser(e.target.value)}
                            maxLength={100}
                          />
                          <input
                            aria-label="Demo chat message"
                            placeholder="Try !vote 1 3 or join the conversation…"
                            value={chat}
                            onChange={(e) => setChat(e.target.value)}
                            maxLength={500}
                          />
                          <button
                            className="icon-button"
                            aria-label="Send demo message"
                            disabled={!chat.trim()}
                          >
                            <Send size={17} />
                          </button>
                        </form>
                      </section>
                    )}
                    {decision && <DecisionCard decision={decision} act={act} />}
                  </>
                )}
                {tab === "Decisions" && (
                  <div className="decisions-page">
                    <div className="decision-intro">
                      <span className="round-icon">
                        <Vote size={27} />
                      </span>
                      <div>
                        <h2>Conversation is the starting point.</h2>
                        <p>
                          Voting is an explicit choice. Publish 2–5 options and
                          let each account approve more than one.
                        </p>
                      </div>
                      <button
                        className="button primary"
                        onClick={() => setComposer(true)}
                        disabled={!state.session}
                      >
                        <Plus size={16} />
                        Create decision
                      </button>
                    </div>
                    {candidates.length > 0 && (
                      <div className="candidate-bar">
                        <strong>From your atlas</strong>
                        {candidates.map((c) => (
                          <button
                            key={c}
                            onClick={() =>
                              setCandidates((v) => v.filter((x) => x !== c))
                            }
                          >
                            {c}
                            <X size={12} />
                          </button>
                        ))}
                        <button
                          className="text-button"
                          onClick={() => setComposer(true)}
                        >
                          Use in decision
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                    {state.decisions.length ? (
                      state.decisions.map((d) => (
                        <DecisionCard key={d.id} decision={d} act={act} />
                      ))
                    ) : (
                      <Empty
                        icon={<Vote size={34} />}
                        title="A decision starts with a question."
                        text="Choose a few options from your atlas, or write your own. Chat will vote with a simple command."
                      />
                    )}
                  </div>
                )}
                {tab === "Session history" && (
                  <section className="content-card">
                    <div className="section-top">
                      <div>
                        <h2>Your sessions</h2>
                        <p>
                          Stored locally. Delete a session to remove its
                          messages, votes, and topic data.
                        </p>
                      </div>
                      <History size={20} />
                    </div>
                    {state.sessions.map((s) => (
                      <div className="history-row" key={s.id}>
                        <span className="round-icon">
                          <Radio size={18} />
                        </span>
                        <div>
                          <strong>
                            {s.source.toUpperCase()} · {s.id.slice(0, 8)}
                          </strong>
                          <small>
                            {new Date(s.startedAt).toLocaleString()} ·{" "}
                            {s.endedAt ? "Ended" : "Active"}
                          </small>
                        </div>
                        <button
                          className="button"
                          onClick={() =>
                            void act(async () =>
                              setHistoryDetail(await api("/sessions/" + s.id)),
                            )
                          }
                        >
                          View recap & decisions
                        </button>
                        <button
                          className="button danger"
                          onClick={() => {
                            if (
                              confirm(
                                "Permanently delete this session and its data?",
                              )
                            )
                              void act(
                                () =>
                                  api("/sessions/" + s.id, undefined, "DELETE"),
                                "Session data deleted",
                              );
                          }}
                        >
                          <Trash2 size={14} />
                          Delete data
                        </button>
                      </div>
                    ))}
                    {historyDetail && (
                      <div className="history-detail">
                        <h2>Session {historyDetail.session.id.slice(0, 8)}</h2>
                        <SessionRecap sessionId={historyDetail.session.id} />
                        {historyDetail.decisions.length ? (
                          historyDetail.decisions.map((d) => (
                            <DecisionCard key={d.id} decision={d} act={act} />
                          ))
                        ) : (
                          <p>No decisions in this session.</p>
                        )}
                      </div>
                    )}
                  </section>
                )}
                {(tab === "Settings" || tab === "Overlay") && (
                  <div className="settings-grid">
                    <section className="content-card settings-card">
                      <div className="section-top">
                        <h2>
                          <Radio size={18} />
                          Twitch connection
                        </h2>
                        <span className="badge">
                          {state.connection.channel
                            ? "AUTHORIZED"
                            : "NOT CONNECTED"}
                        </span>
                      </div>
                      <p>
                        Connect your broadcaster account to read your own
                        channel's chat. Chatlas never automatically controls
                        your stream.
                      </p>
                      <div className="setting-value">
                        <span>Channel</span>
                        <strong>
                          {state.connection.channel ?? "Not authorized"}
                        </strong>
                      </div>
                      <div className="setting-value">
                        <span>Transport</span>
                        <strong>{state.connection.state}</strong>
                      </div>
                      {!state.connection.channel ? (
                        <a className="button primary" href="/auth/twitch/start">
                          <ExternalLink size={15} />
                          Connect Twitch
                        </a>
                      ) : (
                        <>
                          <button
                            className="button primary"
                            onClick={() =>
                              void act(async () => {
                                if (
                                  !state.session ||
                                  state.session.source !== "live"
                                )
                                  await api("/sessions/start", {
                                    source: "live",
                                  });
                                await api("/connection/connect", {});
                              })
                            }
                          >
                            Start live ingestion
                          </button>
                          <button
                            className="button danger"
                            onClick={() =>
                              void act(async () => {
                                await api("/auth/disconnect", {});
                                location.reload();
                              })
                            }
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                      <p className="settings-note">
                        {state.connection.configured
                          ? "Credentials configured. Real received events are required for Live status."
                          : "Requires TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, SESSION_SECRET, and TOKEN_ENCRYPTION_KEY on the server. See TWITCH_SETUP.md."}
                      </p>
                    </section>
                    <section className="content-card settings-card">
                      <div className="section-top">
                        <h2>
                          <Eye size={18} />
                          OBS overlay
                        </h2>
                        <button
                          className="button small-button"
                          onClick={rotate}
                        >
                          <RotateCcw size={14} />
                          {overlayUrl ? "Rotate link" : "Create link"}
                        </button>
                      </div>
                      <p>
                        A read-only view for your stream. Labels are safe
                        defaults or approved by you. Keep the browser-source
                        link private.
                      </p>
                      <label className="toggle-row">
                        <span>Pause public overlay</span>
                        <input
                          type="checkbox"
                          checked={state.settings.paused}
                          onChange={(e) =>
                            void act(() =>
                              api(
                                "/settings",
                                { paused: e.target.checked },
                                "PATCH",
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="toggle-row">
                        <span>Show verbatim messages and usernames</span>
                        <input
                          type="checkbox"
                          checked={state.settings.showEvidence}
                          onChange={(e) =>
                            void act(() =>
                              api(
                                "/settings",
                                { showEvidence: e.target.checked },
                                "PATCH",
                              ),
                            )
                          }
                        />
                      </label>
                      <OverlayStyleControls
                        value={state.settings.overlay}
                        preview={setOverlayDraft}
                        onReference={() => setOverlayLayout("compact")}
                        save={async (overlay) => {
                          await api("/settings", { overlay }, "PATCH");
                          setOverlayDraft(null);
                          accept(await api("/snapshot"));
                        }}
                      />
                      <div className="overlay-controls">
                        <select
                          aria-label="Overlay layout"
                          value={overlayLayout}
                          onChange={(e) => setOverlayLayout(e.target.value)}
                        >
                          <option value="compact">Compact Pulse</option>
                          <option value="atlas">Expanded Atlas</option>
                          <option value="voting">Voting</option>
                          <option value="results">Results</option>
                        </select>
                        <button
                          className="text-button"
                          onClick={() => setLightPreview((v) => !v)}
                        >
                          {lightPreview ? "Dark" : "Light"} backdrop
                        </button>
                      </div>
                      <div
                        className={`overlay-preview ${lightPreview ? "light" : ""}`}
                      >
                        <OverlayPanel
                          state={
                            overlayDraft
                              ? {
                                  ...state,
                                  settings: {
                                    ...state.settings,
                                    overlay: overlayDraft,
                                  },
                                }
                              : state
                          }
                          layout={overlayLayout}
                          preview
                        />
                        <span className="preview-label">
                          BROADCAST PREVIEW · {source.toUpperCase()}
                        </span>
                      </div>
                      {overlayUrl && (
                        <div className="overlay-link">
                          <code>
                            {overlayUrl.replace(
                              "#",
                              `?layout=${overlayLayout}#`,
                            )}
                          </code>
                          <button
                            className="icon-button"
                            aria-label="Copy overlay URL"
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(
                                  overlayUrl.replace(
                                    "#",
                                    `?layout=${overlayLayout}#`,
                                  ),
                                )
                                .then(() => setNotice("Overlay URL copied"))
                            }
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      )}
                      <p className="settings-note">
                        OBS Browser Source · 1920 × 1080 · transparent
                        background. Refresh to restore the current snapshot.
                        Rotating invalidates existing overlay sessions.
                      </p>
                    </section>
                    <section className="content-card settings-card">
                      <ConnectionReadiness />
                      <h2>
                        <ShieldCheck size={18} />
                        Data & analysis
                      </h2>
                      <p>
                        120-second discussion window. Raw messages expire after
                        24 hours. Vote revisions stay until their session is
                        deleted.
                      </p>
                      <label className="toggle-row contributor-toggle">
                        <span>
                          <strong>Each message is a unique contributor</strong>
                          <small>
                            Testing only. OFF: count real accounts. ON: simulate
                            a new contributor per message and a separate
                            simulated voter per valid vote message.
                          </small>
                        </span>
                        <input
                          type="checkbox"
                          checked={
                            contributorToggle ??
                            Boolean(state.settings.testUniqueMessages)
                          }
                          disabled={busy}
                          onChange={(e) => {
                            const value = e.target.checked;
                            setContributorToggle(value);
                            void act(() =>
                              api(
                                "/settings",
                                { testUniqueMessages: value },
                                "PATCH",
                              ),
                            ).finally(() => setContributorToggle(null));
                          }}
                        />
                      </label>
                      <p className="settings-note">
                        Test counts are labeled on the dashboard and OBS
                        overlay. Original authors are preserved. In test mode,
                        repeated valid vote messages add simulated voters; !vote
                        clear removes that account’s test ballots. Turning this
                        off recomputes open votes using each account’s latest
                        ballot. Closed results keep their original counting
                        mode. Turn this off for real audience measurements.
                      </p>
                      <div className="setting-value">
                        <span>Analysis</span>
                        <strong>{state.analysis.provider}</strong>
                      </div>
                      <p className="settings-note">
                        Semantic analysis requires cached MiniLM weights; run
                        npm run model:download to install them. Missing weights
                        use the explicitly labeled lexical fallback. Sarcasm and
                        sentiment are not inferred.
                      </p>
                      <button
                        className="button"
                        onClick={() =>
                          void act(
                            () => api("/demo/reset", {}),
                            "New synthetic session started",
                          )
                        }
                        disabled={source === "live"}
                      >
                        <RotateCcw size={15} />
                        Reset Demo
                      </button>
                    </section>
                    <section className="content-card settings-card">
                      <h2>
                        <History size={18} />
                        Replay a conversation
                      </h2>
                      <p>
                        Import timestamped JSONL through the same ingestion
                        pipeline. Synthetic fixtures stay labeled DEMO.
                        Consented recordings use REPLAY, with separate
                        participant identities.
                      </p>
                      <label className="field-label">
                        Source provenance
                        <select
                          value={syntheticReplay ? "synthetic" : "consented"}
                          onChange={(e) =>
                            setSyntheticReplay(e.target.value === "synthetic")
                          }
                        >
                          <option value="synthetic">
                            Synthetic fixture (DEMO)
                          </option>
                          <option value="consented">
                            Recording with participant consent (REPLAY)
                          </option>
                        </select>
                      </label>
                      <label className="field-label">
                        JSONL file
                        <input
                          type="file"
                          accept=".jsonl,.txt"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              if (f.size > 60000)
                                setError(
                                  "Replay file must be smaller than 60 KB",
                                );
                              else void f.text().then(setReplayText);
                            }
                          }}
                        />
                      </label>
                      <label className="field-label">
                        Or paste JSONL
                        <textarea
                          value={replayText}
                          onChange={(e) => setReplayText(e.target.value)}
                          placeholder={
                            '{"type":"message","id":"1","userId":"a","text":"Minecraft?","offset":0}'
                          }
                          maxLength={60000}
                        />
                      </label>
                      <button
                        className="button primary"
                        disabled={!replayText.trim() || source === "live"}
                        onClick={() =>
                          void act(async () => {
                            await api("/sessions/start", {
                              source: syntheticReplay ? "demo" : "replay",
                            });
                            await api("/replay/import", {
                              lines: replayText,
                              synthetic: syntheticReplay,
                            });
                            setTab("Live room");
                          }, "Replay loaded into a separate session")
                        }
                      >
                        <Play size={14} />
                        Start replay session
                      </button>
                      <label className="field-label">
                        Playback speed
                        <select
                          defaultValue="1"
                          onChange={(e) =>
                            void act(() =>
                              api("/replay/control", {
                                speed: Number(e.target.value),
                              }),
                            )
                          }
                        >
                          {[0.25, 0.5, 1, 2, 4].map((n) => (
                            <option key={n} value={n}>
                              {n}×
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="settings-note">
                        Use the session pause button to pause or resume.
                        Starting an import ends the previous session. Bundled
                        fixture: fixtures/deletion-race.jsonl (synthetic).
                      </p>
                    </section>
                  </div>
                )}
              </>
            )}
            <footer className="page-footer">
              <Brand />
              <span>See what chat is saying. Decide together.</span>
              <span>Made for the conversation.</span>
            </footer>
          </div>
        </main>
        <EvidenceDialog
          selection={evidenceSelection}
          close={() => setEvidenceSelection(null)}
          draft={draftTopic}
        />
        <Composer
          testMode={Boolean(state?.settings.testUniqueMessages)}
          seed={voteSeed}
          open={composer}
          onOpenChange={(open) => {
            setComposer(open);
            if (!open) setVoteSeed(null);
          }}
          candidates={candidates}
          onSubmit={async (question, options, duration) => {
            await act(async () => {
              const d = await api<Decision>("/decisions", {
                question,
                options,
                duration,
              });
              await api("/decisions/" + d.id + "/open", {});
              setComposer(false);
              setVoteSeed(null);
              setCandidates([]);
            }, "Decision published. Chat can vote now.");
          }}
        />
      </div>
    </>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function DecisionCard({
  decision: d,
  act,
}: {
  decision: Decision;
  act: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const simulated = d.countingMode === "message";
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil(((d.deadline ?? now) - now) / 1000));
  return (
    <section className="content-card decision-card">
      <div className="decision-header">
        <div>
          <span className={`badge ${d.state === "open" ? "live" : ""}`}>
            <i />
            {d.state.toUpperCase()}
          </span>
          <h2>{d.question}</h2>
          {simulated && (
            <p className="decision-test-note">
              TEST VOTE · each valid message is a simulated voter. These counts
              are not unique people.
            </p>
          )}
          <p>
            {d.state === "open"
              ? "Approve every option you would be happy with."
              : d.state === "closed"
                ? d.voters === 0
                  ? "No votes were cast. No winner."
                  : d.winners.length > 1
                    ? "A tie. The streamer chooses the next step."
                    : "The community has weighed in. The streamer chooses the next step."
                : "Options are frozen when the vote opens."}
          </p>
        </div>
        <div className="decision-clock">
          <strong>
            {d.state === "open"
              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
              : d.voters}
          </strong>
          <span>
            {d.state === "open"
              ? "remaining"
              : simulated
                ? "simulated voters"
                : "valid voters"}
          </span>
        </div>
      </div>
      <div className="result-options">
        {d.options.map((o, i) => (
          <div
            key={i}
            className={`result-row ${d.state === "closed" && d.winners.includes(i) ? "winner" : ""}`}
          >
            <span className="option-number">{i + 1}</span>
            <div className="option-result">
              <div>
                <strong>{o}</strong>
                <span>
                  {d.counts[i]} approvals{" "}
                  <b>
                    {d.voters ? Math.round((d.counts[i] / d.voters) * 100) : 0}%
                  </b>
                </span>
              </div>
              <div className="result-track">
                <span
                  style={{
                    width:
                      (d.voters ? (d.counts[i] / d.voters) * 100 : 0) + "%",
                  }}
                />
              </div>
            </div>
            {d.state === "closed" && d.winners.includes(i) && (
              <Check size={17} />
            )}
          </div>
        ))}
      </div>
      <div className="vote-command">
        <code>{simulated ? testVoteHelp : voteHelp}</code>
        <span>
          {d.voters} {simulated ? "simulated voters" : "valid voters"} ·
          percentages may total more than 100%
        </span>
      </div>
      {d.state === "open" && (
        <div className="decision-buttons">
          <button
            className="button primary"
            onClick={() =>
              void act(
                () => api("/decisions/" + d.id + "/close", {}),
                "Decision closed. Results saved.",
              )
            }
          >
            <CheckCheck size={16} />
            Close & show results
          </button>
          <button
            className="button"
            onClick={() =>
              void act(() => api("/decisions/" + d.id + "/cancel", {}))
            }
          >
            Cancel vote
          </button>
        </div>
      )}
      {d.state === "draft" && (
        <button
          className="button primary"
          onClick={() =>
            void act(() => api("/decisions/" + d.id + "/open", {}))
          }
        >
          Publish decision
        </button>
      )}
    </section>
  );
}
function Composer({
  testMode = false,
  seed,
  open,
  onOpenChange,
  candidates,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: string[];
  seed?: { question: string; options: string[] } | null;
  testMode?: boolean;
  onSubmit: (q: string, o: string[], d: number) => Promise<void>;
}) {
  const [q, setQ] = useState("What should we play next?"),
    [options, setOptions] = useState([
      "Minecraft",
      "Valorant",
      "Stardew Valley",
    ]),
    [duration, setDuration] = useState(60),
    [sending, setSending] = useState(false);
  useEffect(() => {
    if (open && seed) {
      setQ(seed.question);
      setOptions(seed.options);
    } else if (open && candidates.length)
      setOptions(
        candidates.length === 1 ? [candidates[0], "Another idea"] : candidates,
      );
  }, [open, candidates, seed]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content
          className="dialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document.querySelector<HTMLInputElement>(".dialog input")?.focus();
          }}
        >
          <div className="dialog-top">
            <span className="round-icon">
              <Vote size={22} />
            </span>
            <Dialog.Close
              className="icon-button"
              aria-label="Close decision composer"
            >
              <X size={19} />
            </Dialog.Close>
          </div>
          <Dialog.Title>Let chat decide.</Dialog.Title>
          <Dialog.Description>
            {seed &&
              "Drafted from recognized mentions, not endorsements. Review the question and options before publishing. "}
            {testMode
              ? "TEST MODE: each valid vote message counts as a separate simulated voter, even from the same account."
              : "One account, one current ballot. Approve as many options as you like. No extra accounts or extensions."}
          </Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSending(true);
              void onSubmit(q, options, duration).finally(() =>
                setSending(false),
              );
            }}
          >
            <label className="field-label">
              Your question
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                required
                minLength={3}
                maxLength={180}
              />
            </label>
            <div className="field-label">
              Options <span>2–5 choices</span>
            </div>
            {options.map((o, i) => (
              <div className="composer-option" key={i}>
                <span className="option-number">{i + 1}</span>
                <input
                  aria-label={"Option " + (i + 1)}
                  value={o}
                  required
                  maxLength={70}
                  onChange={(e) =>
                    setOptions((v) =>
                      v.map((x, j) => (i === j ? e.target.value : x)),
                    )
                  }
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Remove option " + (i + 1)}
                    onClick={() =>
                      setOptions((v) => v.filter((_, j) => j !== i))
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            {options.length < 5 && (
              <button
                type="button"
                className="text-button add-option"
                onClick={() => setOptions((v) => [...v, ""])}
              >
                <Plus size={14} />
                Add option
              </button>
            )}
            <label className="field-label">
              Voting duration
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[30, 60, 90, 120, 180, 300].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <div className="command-preview">
              <span>CHAT WILL USE</span>
              <code>!vote 1 3</code>
              <p>
                {testMode
                  ? "Repeated valid vote messages add test voters. !vote clear removes all prior test ballots from that account."
                  : "Repeated messages don't add weight. A new vote replaces the previous ballot."}
              </p>
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="button">
                  Keep exploring
                </button>
              </Dialog.Close>
              <button className="button primary" disabled={sending}>
                {sending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Radio size={16} />
                )}
                Publish vote
              </button>
            </div>
            <p className="form-note">
              Options cannot change after publication. Cancel to start a new
              vote.
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function OverlayPanel({
  state,
  layout,
  preview = false,
  stale = false,
}: {
  state: Snapshot;
  layout: string;
  preview?: boolean;
  stale?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1200);
  const panelRef = useRef<HTMLDivElement>(null);
  const [designHeight, setDesignHeight] = useState(700);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      setDesignHeight(panel.offsetHeight);
      setViewportHeight(window.innerHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const preferences = {
    ...defaultOverlayPreferences,
    ...state.settings.overlay,
  };
  const d = state.decision;
  const topics = state.topics
    .filter((t) => t.approved && !t.hidden)
    .toSorted(
      (a, b) =>
        b.contributors - a.contributors ||
        b.messages - a.messages ||
        a.id.localeCompare(b.id),
    )
    .slice(
      0,
      preferences.preset === "cozy"
        ? layout === "atlas"
          ? 4
          : 3
        : preferences.topicCount,
    );
  const isTopics = layout !== "voting" && layout !== "results";
  const displayLabel = (label: string) =>
    ({
      "Minecraft discussion": "Minecraft",
      "Valorant discussion": "Valorant",
      "Taking a break": "Take a break",
      "Music discussion": "Music",
    })[label] ?? label;
  const leadingCount = Math.max(
    0,
    ...topics.map((topic) => topic.contributors),
  );
  const noteworthy = topics
    .flatMap((topic) =>
      (topic.highlights ?? [])
        .filter(
          (item) =>
            item.label.toLowerCase() !==
            displayLabel(topic.label).toLowerCase(),
        )
        .map((item) => ({ ...item, topicId: topic.id })),
    )
    .toSorted(
      (a, b) =>
        b.contributors - a.contributors || a.label.localeCompare(b.label),
    )[0];
  const slotCount =
    preferences.preset === "cozy"
      ? layout === "atlas"
        ? 4
        : 3
      : preferences.topicCount;
  const designWidth = isTopics
    ? layout === "atlas"
      ? 1100
      : 1200
    : preferences.mascot
      ? 590
      : 420;
  const requestedScale = preview ? 1 : preferences.scale;
  const renderScale = Math.min(
    requestedScale,
    Math.max(0.1, availableWidth / designWidth),
    preview
      ? Infinity
      : Math.max(
          0.1,
          (viewportHeight - preferences.safeArea * 2) /
            Math.max(1, designHeight),
        ),
  );
  return (
    <div
      ref={frameRef}
      className="broadcast-frame"
      data-overlay-design="conversation-glance-v2"
    >
      <div
        ref={panelRef}
        className={`broadcast-panel broadcast-${layout} ${layout === "atlas" ? "expanded" : ""} ${isTopics ? "broadcast-glance" : ""} ${preferences.mascot ? "" : "without-mascot"}`}
        style={
          {
            background: `rgba(255,252,255,${preferences.opacity})`,
            width: designWidth,
            maxWidth: "none",
            zoom: renderScale,
            "--topic-columns":
              layout === "atlas" ? Math.min(2, slotCount) : slotCount,
          } as React.CSSProperties
        }
      >
        {preferences.mascot && (
          <img
            className="broadcast-mascot"
            src="/images/overlay-streamer.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
        <div className="broadcast-heading">
          <Brand />
          {isTopics && (
            <h2 className="broadcast-glance-title">
              The conversation, at a glance
            </h2>
          )}
          {(isTopics
            ? state.settings.testUniqueMessages
            : d?.countingMode === "message") && (
            <span className="test-counts-label">TEST COUNTS</span>
          )}
          <span>
            {state.session?.source === "live"
              ? "CHAT PULSE"
              : (state.session?.source ?? "demo").toUpperCase()}
          </span>
          {isTopics && <span className="broadcast-window">Last 2 min</span>}
          {stale && <span className="stale-label">STALE · reconnecting</span>}
        </div>
        {state.settings.paused ? (
          <p className="broadcast-empty">Overlay paused</p>
        ) : layout === "voting" || layout === "results" ? (
          d ? (
            <>
              <div
                className={`broadcast-state ${d.state === "open" ? "is-open" : ""}`}
              >
                <span />
                {d.state === "open"
                  ? "VOTE OPEN"
                  : d.state === "closed"
                    ? "VOTE CLOSED"
                    : d.state.toUpperCase()}
              </div>
              <h2>{d.question}</h2>
              <div className="broadcast-votes">
                {d.options.map((o, i) => (
                  <div
                    key={i}
                    className={
                      d.state === "closed" && d.winners.includes(i)
                        ? "broadcast-winner"
                        : ""
                    }
                  >
                    <span>{i + 1}</span>
                    <strong>
                      {o}
                      <span className="broadcast-approval-track">
                        <i
                          style={{
                            width:
                              (d.voters ? (d.counts[i] / d.voters) * 100 : 0) +
                              "%",
                          }}
                        />
                      </span>
                    </strong>
                    <b>{d.counts[i]}</b>
                  </div>
                ))}
              </div>
              <p>
                {stale
                  ? "Connection lost. Voting status unavailable."
                  : d.state === "open" && layout === "voting"
                    ? d.countingMode === "message"
                      ? "TEST VOTE · each message adds a simulated voter: !vote 1 3"
                      : "Approve your favorites: !vote 1 3"
                    : d.state === "cancelled"
                      ? "Vote cancelled"
                      : d.voters === 0
                        ? "No votes. No winner."
                        : `${d.voters} ${d.countingMode === "message" ? "simulated voters" : "valid voters"} · ${d.winners.length > 1 ? "Tie" : "Approval results"}`}
              </p>
            </>
          ) : (
            <p className="broadcast-empty">Waiting for a decision</p>
          )
        ) : (
          <>
            <div className="broadcast-clusters">
              {topics.map((topic, index) => (
                <article
                  className={`broadcast-topic-cluster ${colors[index]}`}
                  key={topic.id}
                  aria-label={`${topic.label} cluster`}
                >
                  <div className="broadcast-cluster-pill">
                    <TopicGlyph label={topic.label} />
                    <strong>{displayLabel(topic.label)}</strong>
                  </div>
                  <div className="glance-counts">
                    <strong>{topic.contributors}</strong>
                    <span>
                      {state.settings.testUniqueMessages
                        ? "test contributors"
                        : "people"}
                    </span>
                    <small>{topic.messages} messages</small>
                  </div>
                  <p className="glance-metric-label">
                    Distinct{" "}
                    {state.settings.testUniqueMessages
                      ? "test contributors"
                      : "people"}{" "}
                    per topic
                  </p>
                  <div
                    className="glance-comparison"
                    role="meter"
                    aria-label={`${topic.label}: contributors relative to the leading displayed topic`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(1, leadingCount)}
                    aria-valuenow={topic.contributors}
                    aria-valuetext={`${topic.contributors} people; leading topic has ${leadingCount}`}
                  >
                    <i
                      style={{
                        width: `${leadingCount ? (topic.contributors / leadingCount) * 100 : 0}%`,
                      }}
                    />
                    <span>
                      {leadingCount
                        ? `${topic.contributors}/${leadingCount}`
                        : "No activity"}
                    </span>
                  </div>
                  {topic.highlights?.some(
                    (item) =>
                      item.label.toLowerCase() !==
                      displayLabel(topic.label).toLowerCase(),
                  ) ? (
                    <ol
                      className="broadcast-highlights"
                      aria-label="Top mentions by distinct contributors"
                    >
                      {topic.highlights
                        .filter(
                          (item) =>
                            item.label.toLowerCase() !==
                            displayLabel(topic.label).toLowerCase(),
                        )
                        .slice(0, 2)
                        .map((highlight) => (
                          <li key={highlight.label}>
                            <span>
                              {highlight.label === "Playing with friends"
                                ? "With friends"
                                : highlight.label}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <b>{highlight.contributors}</b>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="broadcast-no-highlights">
                      No further common mentions yet
                    </p>
                  )}
                  {state.settings.showEvidence && topic.evidence[0] && (
                    <blockquote className="broadcast-cluster-quote">
                      <p>“{topic.evidence[0].text}”</p>
                      <cite>{topic.evidence[0].name}</cite>
                    </blockquote>
                  )}
                </article>
              ))}
              {Array.from(
                { length: Math.max(0, slotCount - topics.length) },
                (_, index) => (
                  <article
                    className={`broadcast-topic-placeholder ${colors[topics.length + index]}`}
                    key={`waiting-${index}`}
                    aria-label="Waiting for another approved topic"
                  >
                    <MessageCircle size={30} />
                    <strong>Waiting for another topic</strong>
                    <p>
                      Qualifying, approved topics appear here as the
                      conversation grows.
                    </p>
                    <span>Not enough data yet</span>
                  </article>
                ),
              )}
            </div>
            {!state.settings.paused && topics.length > 0 && (
              <>
                <div className="glance-notice">
                  <Sparkles size={25} />
                  <strong>
                    {stale
                      ? "Connection interrupted. Showing the last received conversation."
                      : noteworthy
                        ? `Worth noticing: ${noteworthy.contributors} ${state.settings.testUniqueMessages ? "test contributors" : noteworthy.contributors === 1 ? "person" : "people"} mentioned ${noteworthy.label.toLowerCase()}.`
                        : `Worth noticing: ${displayLabel(topics[0].label)} leads with ${topics[0].contributors} distinct ${state.settings.testUniqueMessages ? "test contributors" : "people"}.`}
                  </strong>
                </div>
                <p className="glance-scale-note">
                  Bars compare each topic with the leading displayed topic (
                  {leadingCount} people).
                </p>
              </>
            )}
            <p className="glance-footer">
              People may appear in multiple topics · Mentions are not votes
            </p>
          </>
        )}
      </div>
    </div>
  );
}
function Overlay() {
  const bootstrap = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [online, setOnline] = useState(false);
  const revision = useRef(-1);
  useEffect(() => {
    document.body.classList.add("overlay-body");
    document.documentElement.classList.add("overlay-root");
    let cleanup = () => {};
    let active = true;
    (async () => {
      try {
        if (!bootstrap.current)
          bootstrap.current = (async () => {
            const token = location.hash.slice(1);
            history.replaceState(null, "", location.pathname + location.search);
            if (token) await api("/overlay/bootstrap", { token });
          })();
        await bootstrap.current;
        const s = await api<Snapshot>("/overlay/snapshot");
        if (!active) return;
        setState(s);
        cleanup = subscribe(
          true,
          (next) => {
            if (next.revision >= revision.current) {
              revision.current = next.revision;
              setState(next);
            }
          },
          setOnline,
        );
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
      cleanup();
      document.body.classList.remove("overlay-body");
      document.documentElement.classList.remove("overlay-root");
    };
  }, []);
  const layout =
    new URLSearchParams(location.search).get("layout") ?? "compact";
  return (
    <div
      className="overlay-canvas"
      style={{ padding: state?.settings.overlay?.safeArea ?? 40 }}
    >
      {error ? (
        <div className="overlay-error">
          Chatlas overlay unavailable. Refresh with a current browser-source
          link.
        </div>
      ) : state ? (
        <OverlayPanel state={state} layout={layout} stale={!online} />
      ) : (
        <div className="overlay-error">Connecting to Chatlas…</div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname === "/overlay" ? <Overlay /> : <App />}
  </React.StrictMode>,
);
