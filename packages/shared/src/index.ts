export type Source = "demo" | "live" | "replay";
export type ConnectionState =
  | "disconnected"
  | "authorizing"
  | "connecting"
  | "subscribing"
  | "live"
  | "reconnecting"
  | "authorization required";
export interface Message {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
  arrival: number;
  sequence: number;
  emotes: string[];
  deleted?: boolean;
}
export interface OverlayPreferences {
  scale: number;
  opacity: number;
  mascot: boolean;
  topicCount: number;
  safeArea: number;
  preset: "cozy" | "gameplay" | "minimal" | "custom";
}
export const defaultOverlayPreferences: OverlayPreferences = {
  scale: 1,
  opacity: 0.98,
  mascot: true,
  topicCount: 3,
  safeArea: 40,
  preset: "cozy",
};
export interface TopicIntent {
  suggestions: number;
  disagreement: number;
  questions: number;
}
export interface SessionRecap {
  session: {
    id: string;
    source: Source;
    startedAt: number;
    endedAt: number | null;
  };
  samples: {
    at: number;
    participants: number;
    messages: number;
    coverage: number;
    simulated?: boolean;
  }[];
  topics: {
    id: string;
    label: string;
    peakPeople: number;
    peakMessages: number;
    samples: number;
  }[];
  decisions: Decision[];
  sampleCount: number;
  truncated: boolean;
}
export interface Topic {
  id: string;
  label: string;
  approved: boolean;
  pinned: boolean;
  hidden: boolean;
  messages: number;
  contributors: number;
  share: number;
  repetition: number;
  trend: number;
  spark: number[];
  evidence: Message[];
  highlights?: { label: string; contributors: number }[];
  periods?: { recent: number; previous: number };
  intent?: TopicIntent;
  kind: "discussion" | "question" | "suggestion" | "emote";
  x: number;
  y: number;
}
export interface Decision {
  id: string;
  sessionId: string;
  question: string;
  options: string[];
  state: "draft" | "open" | "closed" | "cancelled";
  duration: number;
  openedAt: number | null;
  deadline: number | null;
  counts: number[];
  voters: number;
  winners: number[];
  createdAt: number;
}
export interface Snapshot {
  schemaVersion: 1;
  revision: number;
  session: {
    id: string;
    source: Source;
    startedAt: number;
    endedAt: number | null;
  } | null;
  connection: {
    state: ConnectionState;
    channel: string | null;
    configured: boolean;
  };
  analysis: {
    provider: string;
    coverage: number;
    queue: number;
    windowSeconds: number;
    windowEnd?: number;
    completedAt?: number;
    processingMs?: number;
    ageMs?: number | null;
  };
  topics: Topic[];
  decision: Decision | null;
  decisions: Decision[];
  participants: number;
  messageCount: number;
  timeline: number[];
  gaps: number[];
  settings: {
    paused: boolean;
    showEvidence: boolean;
    testUniqueMessages: boolean;
    area: "people" | "messages";
    overlay?: OverlayPreferences;
  };
  playback: { paused: boolean; speed: number; positionMs: number | null };
  overlayStale?: boolean;
  sessions: {
    id: string;
    source: Source;
    startedAt: number;
    endedAt: number | null;
  }[];
}
export const voteHelp =
  "Approve one or more options: !vote 1 3 · Replace by voting again · !vote clear";
export function parseVote(text: string, count: number): number[] | null {
  const t = text.trim();
  if (/^!vote clear$/i.test(t)) return [];
  if (!/^!vote(?: [1-5]){1,5}$/i.test(t)) return null;
  const nums = t.split(" ").slice(1).map(Number);
  if (nums.some((n) => n > count)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}
export function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
