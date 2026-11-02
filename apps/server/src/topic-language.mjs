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

// Extractive labels name recurring subjects without inventing context about them.
const labelStop = new Set(
  "a an the is are was were i you we they it this that to for of and or but on in with be have has had been being my your our their so just can do does did doing should would could lets let what how when where who why next play playing want think please really long time tonight today again more much very good great nice love like now here there about from not no yes its im ive dont hey chat stream streamer thing things some any all say said watching watch youtube twitch video videos lol lmao omg thanks thank hello everyone someone something".split(
    " ",
  ),
);
export function inferTopicLabel(
  messages,
  identity = (message) => message.userId,
  known = {},
) {
  const words = new Map();
  const phrases = new Map();
  const spellings = new Map();
  const people = new Set(messages.map(identity)).size;
  const remember = (map, key, person) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(person);
  };
  for (const message of messages) {
    const text = message.text
      .normalize("NFKC")
      .replace(/https?:\/\/\S+|www\.\S+|\S+@\S+|@[\p{L}\p{N}_]+/gu, " ");
    const raw = text.match(/[\p{L}][\p{L}\p{N}'’-]{1,29}/gu) ?? [];
    const person = identity(message);
    for (const token of raw) {
      const lower = token.toLowerCase();
      if (labelStop.has(lower)) continue;
      const key = Object.hasOwn(synonyms, lower) ? synonyms[lower] : lower;
      remember(words, key, person);
      const previous = spellings.get(key);
      if (!previous || /[A-Z].*[A-Z]/.test(token)) spellings.set(key, token);
    }
    for (let size = 2; size <= 3; size++)
      for (let index = 0; index <= raw.length - size; index++) {
        const group = raw.slice(index, index + size);
        if (group.some((word) => labelStop.has(word.toLowerCase()))) continue;
        const key = group.map((word) => word.toLowerCase()).join(" ");
        remember(phrases, key, person);
        if (!spellings.has(key)) spellings.set(key, group.join(" "));
      }
  }
  const ranked = [...words]
    .filter(
      ([, supporters]) =>
        supporters.size >= 2 && supporters.size / Math.max(1, people) >= 0.4,
    )
    .sort(
      (a, b) =>
        b[1].size - a[1].size ||
        Number(Object.hasOwn(known, b[0])) -
          Number(Object.hasOwn(known, a[0])) ||
        a[0].localeCompare(b[0]),
    );
  if (!ranked.length)
    return { label: "Other discussion", source: "fallback", approved: false };
  const [word, supporters] = ranked[0];
  if (Object.hasOwn(known, word))
    return { label: known[word], source: "recognized", approved: true };
  const phrase = [...phrases]
    .filter(
      ([key, support]) =>
        key.split(" ").includes(word) &&
        support.size >= 2 &&
        support.size >= supporters.size * 0.8,
    )
    .sort(
      (a, b) =>
        b[1].size - a[1].size ||
        b[0].split(" ").length - a[0].split(" ").length ||
        a[0].localeCompare(b[0]),
    )[0]?.[0];
  const subject = (spellings.get(phrase ?? word) ?? word).slice(0, 48);
  const display = subject[0].toLocaleUpperCase() + subject.slice(1);
  return {
    label: `${display} discussion`,
    source: "extracted",
    approved: false,
  };
}
