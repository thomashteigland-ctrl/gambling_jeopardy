import type { Question } from "../types";

function newQuestionId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Minimal CSV row parser (handles quoted fields). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      if (ch === "\r") i++;
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

const HEADER_ALIASES: Record<string, keyof Omit<Question, "id">> = {
  category: "category",
  cat: "category",
  prompt: "prompt",
  question: "prompt",
  answer: "answer",
  answers: "answer",
};

export type CsvParseResult =
  | { ok: true; questions: Question[] }
  | { ok: false; error: string };

export function parseQuestionsCsv(text: string): CsvParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "CSV file is empty." };
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) {
    return { ok: false, error: "No rows found in CSV." };
  }

  const header = rows[0].map(normalizeHeader);
  const hasHeader = header.some((h) => h in HEADER_ALIASES);

  if (!hasHeader) {
    return {
      ok: false,
      error:
        "CSV must start with a header row: category, prompt, answer",
    };
  }

  const dataRows = rows.slice(1);

  const categoryIdx = header.findIndex((h) => HEADER_ALIASES[h] === "category");
  const promptIdx = header.findIndex((h) => HEADER_ALIASES[h] === "prompt");
  const answerIdx = header.findIndex((h) => HEADER_ALIASES[h] === "answer");

  if (categoryIdx < 0 || promptIdx < 0 || answerIdx < 0) {
    return {
      ok: false,
      error:
        "CSV headers must include category, prompt, and answer columns.",
    };
  }

  const questions: Question[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, i) => {
    const line = i + 2;
    const category = row[categoryIdx]?.trim() ?? "";
    const prompt = row[promptIdx]?.trim() ?? "";
    const answer = row[answerIdx]?.trim() ?? "";

    if (!category && !prompt && !answer) return;

    if (!category || !prompt || !answer) {
      errors.push(`Row ${line}: missing category, prompt, or answer.`);
      return;
    }

    questions.push({
      id: newQuestionId(),
      category,
      prompt,
      answer,
    });
  });

  if (questions.length === 0) {
    return {
      ok: false,
      error: errors[0] ?? "No valid questions found in CSV.",
    };
  }

  return { ok: true, questions };
}

export const CSV_TEMPLATE = `category,prompt,answer
Pop culture,Which 1997 film features a doomed luxury liner?,Titanic
Science,What gas do plants absorb during photosynthesis?,Carbon dioxide
`;
