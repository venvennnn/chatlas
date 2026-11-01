import { randomUUID } from "node:crypto";
import type { Store } from "./store.ts";
const groups = [
  [
    "Minecraft sounds good for tonight",
    "Please play Minecraft next",
    "I prefer Minecraft survival",
    "Not Minecraft again, try something else",
    "Minecraft with chat would be fun",
    "Minecraft building stream?",
  ],
  [
    "Valorant ranked tonight?",
    "Please play Valorant",
    "I would watch Valorant",
    "No more Valorant ranked please",
    "Valorant with friends sounds fun",
  ],
  [
    "Should we take a water break?",
    "Please hydrate, take a break",
    "A short break would be good",
    "Water break before the next game",
  ],
  [
    "Is the sound too loud?",
    "The stream audio sounds great",
    "Please lower the volume a little",
    "Sound is fine for me",
  ],
  [
    "What music is this?",
    "Love this music playlist",
    "Can we get the music playlist?",
    "The music is so good",
  ],
  ["KEKW", "KEKW", "KEKW"],
];
export function seedDemo(store: Store, session: string) {
  const now = Date.now();
  for (let g = 0; g < groups.length; g++)
    for (let i = 0; i < 28 - g * 3; i++) {
      const text = groups[g][i % groups[g].length];
      store.ingest(session, {
        id: randomUUID(),
        userId: "demo-" + (i % (18 - g * 2)),
        name: [
          "pixelpilot",
          "cozycomet",
          "mossybyte",
          "lunaloop",
          "orbitfox",
          "softstatic",
          "rivercat",
          "tinyplanet",
        ][i % 8],
        text,
        at: now - 110000 + i * 3300,
        arrival: now - 110000 + i * 3300,
        emotes: g === 5 ? ["emotesv2_demo"] : [],
      });
    }
}
export function demoMessage(store: Store, session: string, n: number) {
  const g = n % groups.length;
  store.ingest(session, {
    id: randomUUID(),
    userId: "demo-" + (n % 26),
    name: [
      "pixelpilot",
      "cozycomet",
      "mossybyte",
      "lunaloop",
      "orbitfox",
      "softstatic",
    ][n % 6],
    text: groups[g][n % groups[g].length],
    at: Date.now(),
    arrival: Date.now(),
    emotes: g === 5 ? ["emotesv2_demo"] : [],
  });
}
