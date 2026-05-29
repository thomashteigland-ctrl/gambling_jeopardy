import { useRef, useState } from "react";
import type { Question } from "../types";
import { CSV_TEMPLATE, parseQuestionsCsv } from "../utils/parseQuestionsCsv";
import { saveQuestions } from "../utils/questionStorage";

function newQuestionId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function QuestionManager({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({
    category: "",
    prompt: "",
    answer: "",
  });
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const update = (next: Question[]) => {
    onChange(next);
    saveQuestions(next);
  };

  const addQuestion = () => {
    const category = draft.category.trim();
    const prompt = draft.prompt.trim();
    const answer = draft.answer.trim();
    if (!category || !prompt || !answer) return;

    update([
      ...questions,
      { id: newQuestionId(), category, prompt, answer },
    ]);
    setDraft({ category: "", prompt: "", answer: "" });
  };

  const removeQuestion = (id: string) => {
    update(questions.filter((q) => q.id !== id));
  };

  const handleCsvFile = async (file: File) => {
    setCsvMessage(null);
    const text = await file.text();
    const result = parseQuestionsCsv(text);

    if (!result.ok) {
      setCsvMessage(result.error);
      return;
    }

    const mode = questions.length > 0 ? "append" : "replace";
    const next =
      mode === "append" ? [...questions, ...result.questions] : result.questions;
    update(next);
    setCsvMessage(
      `Imported ${result.questions.length} question${result.questions.length === 1 ? "" : "s"} (${mode === "append" ? "appended" : "replaced list"}).`,
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel question-manager">
      <div className="question-manager__header">
        <div>
          <h2>Questions</h2>
          <p className="hint">{questions.length} in deck</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <>
          <form
            className="question-form"
            onSubmit={(e) => {
              e.preventDefault();
              addQuestion();
            }}
          >
            <label>
              Category
              <input
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value }))
                }
                placeholder="e.g. Science"
              />
            </label>
            <label className="question-form__full">
              Question
              <textarea
                rows={2}
                value={draft.prompt}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, prompt: e.target.value }))
                }
                placeholder="What is the question?"
              />
            </label>
            <label className="question-form__full">
              Answer
              <input
                value={draft.answer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, answer: e.target.value }))
                }
                placeholder="Correct answer"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary question-form__submit"
              disabled={
                !draft.category.trim() ||
                !draft.prompt.trim() ||
                !draft.answer.trim()
              }
            >
              Add question
            </button>
          </form>

          <div className="csv-section">
            <h3>Import from CSV</h3>
            <p className="hint">
              Required header row: <code>category</code>, <code>prompt</code>,{" "}
              <code>answer</code>. Each row is one question in that category.
              New imports append if you already have questions.
            </p>
            <div className="csv-actions">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="csv-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvFile(file);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => fileRef.current?.click()}
              >
                Upload CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={downloadTemplate}
              >
                Download template
              </button>
            </div>
            {csvMessage && (
              <p
                className={
                  csvMessage.startsWith("Imported")
                    ? "csv-message csv-message--ok"
                    : "csv-message csv-message--err"
                }
              >
                {csvMessage}
              </p>
            )}
          </div>

          <ul className="question-list">
            {questions.length === 0 ? (
              <li className="question-list__empty">
                No questions yet — add one or upload a CSV.
              </li>
            ) : (
              questions.map((q, i) => (
                <li key={q.id} className="question-list__item">
                  <div className="question-list__meta">
                    <span className="question-list__num">{i + 1}</span>
                    <span className="category">{q.category}</span>
                  </div>
                  <p className="question-list__prompt">{q.prompt}</p>
                  <p className="question-list__answer">Answer: {q.answer}</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm question-list__remove"
                    onClick={() => removeQuestion(q.id)}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </section>
  );
}
