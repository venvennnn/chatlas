export const synonyms: Record<string, string>;
export function intentOf(text: string): {
  suggestions: boolean;
  disagreement: boolean;
  questions: boolean;
};
export function inferTopicLabel(
  messages: { text: string; userId: string; id?: string }[],
  identity?: (message: { text: string; userId: string; id?: string }) => string,
  known?: Record<string, string>,
): {
  label: string;
  source: "fallback" | "recognized" | "extracted";
  approved: boolean;
};
