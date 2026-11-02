// Conservative lexical rules: these describe language patterns, not sentiment or consensus.
export const synonyms = {
  mc: "minecraft",
  crafting: "minecraft",
  mining: "minecraft",
  blocks: "minecraft",
  valo: "valorant",
  val: "valorant",
  ranked: "valorant",
  breaks: "break",
  hydrate: "break",
  hydration: "break",
  water: "break",
  stretching: "break",
  stretch: "break",
  audio: "sound",
  volume: "sound",
  loud: "sound",
  microphone: "sound",
  mic: "sound",
  lagging: "lag",
  buffering: "lag",
  fps: "lag",
  songs: "music",
  song: "music",
  playlist: "music",
  lofi: "music",
};
export function intentOf(text) {
  return {
    suggestions:
      /\b(should|suggest|let'?s|please\s+(?:play|try|take|change|switch)|how about|could we)\b/i.test(
        text,
      ),
    disagreement:
      /\b(no more|not again|don'?t|do not|disagree|rather not|not\s+\w+\s+again)\b/i.test(
        text,
      ) || /^no\b/i.test(text),
    questions: /\?/.test(text),
  };
}
