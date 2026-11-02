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
