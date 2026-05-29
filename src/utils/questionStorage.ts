import type { Question } from "../types";

const STORAGE_KEY = "gambling-charades-questions";

/** IDs from the removed built-in sample deck. */
const LEGACY_SAMPLE_IDS = new Set(["q1", "q2", "q3", "q4", "q5"]);

function stripLegacySamples(questions: Question[]): Question[] {
  return questions.filter((q) => !LEGACY_SAMPLE_IDS.has(q.id));
}

export function loadStoredQuestions(): Question[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Question[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const withoutSamples = stripLegacySamples(parsed);
    if (withoutSamples.length !== parsed.length) {
      if (withoutSamples.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutSamples));
    }

    return withoutSamples;
  } catch {
    return null;
  }
}

export function saveQuestions(questions: Question[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

export function getInitialQuestions(): Question[] {
  return loadStoredQuestions() ?? [];
}
