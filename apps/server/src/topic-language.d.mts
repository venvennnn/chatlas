export const synonyms: Record<string, string>;
export function intentOf(text: string): {
  suggestions: boolean;
  disagreement: boolean;
  questions: boolean;
};
