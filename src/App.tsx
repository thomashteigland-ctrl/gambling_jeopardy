import { useState } from "react";
import { CategoryBar } from "./components/CategoryBar";
import {
  getActiveTurn,
  phaseLabel,
  teamCardState,
} from "./components/ActiveTeamBanner";
import { PeekMascot } from "./components/PeekMascot";
import { QuestionManager } from "./components/QuestionManager";
import {
  endGameByHost,
  getCategoryStats,
  getCurrentQuestion,
  getMinLeadingBet,
  getShowdownPot,
  handleAllIn,
  handleCall,
  handleFold,
  hasAvailableQuestions,
  lockLeadingBet,
  otherTeam,
  resolveShowdown,
  selectCategory,
} from "./gameLogic";
import type {
  GameState,
  Question,
  ShowdownAnswers,
  Team,
  TeamId,
} from "./types";
import { getInitialQuestions } from "./utils/questionStorage";

const DEFAULT_BALANCE = 2000;
const DEFAULT_ANTE = 100;
const QUICK_BETS = [50, 100, 250, 500, 1000] as const;

function createInitialState(
  teamAName: string,
  teamBName: string,
  startingBalance: number,
  ante: number,
  questions: Question[],
): GameState {
  return {
    phase: "setup",
    teams: {
      teamA: { id: "teamA", name: teamAName, balance: startingBalance },
      teamB: { id: "teamB", name: teamBName, balance: startingBalance },
    },
    questions,
    questionIndex: -1,
    leadingTeam: "teamA",
    potBet: 0,
    followerCommit: 0,
    startingBalance,
    ante,
    lastRound: null,
    gameOverReason: null,
    usedQuestionIds: [],
  };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function showdownAnswersForTeamWin(
  winnerId: TeamId,
  leadingTeamId: TeamId,
): ShowdownAnswers {
  if (winnerId === leadingTeamId) {
    return { leadingCorrect: true, followingCorrect: false };
  }
  return { leadingCorrect: false, followingCorrect: true };
}

export default function App() {
  const [questions, setQuestions] = useState<Question[]>(getInitialQuestions);
  const [game, setGame] = useState<GameState>(() =>
    createInitialState("Team 1", "Team 2", DEFAULT_BALANCE, DEFAULT_ANTE, questions),
  );
  const [setup, setSetup] = useState({
    teamA: "Team 1",
    teamB: "Team 2",
    balance: String(DEFAULT_BALANCE),
    ante: String(DEFAULT_ANTE),
  });
  const [draftBet, setDraftBet] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  const activeTurn = getActiveTurn(game);
  const currentQuestion = getCurrentQuestion(game);
  const leadingTeam = game.teams[game.leadingTeam];
  const respondingTeam = game.teams[otherTeam(game.leadingTeam)];
  const roundNumber =
    game.usedQuestionIds.length + (currentQuestion ? 1 : 0);

  const minLeadingBet = getMinLeadingBet(game.ante, leadingTeam.balance);

  const canLockBet =
    game.phase === "leading_bet" &&
    draftBet >= minLeadingBet &&
    draftBet <= leadingTeam.balance;

  const canCall =
    game.phase === "call_or_fold" &&
    respondingTeam.balance >= game.potBet;

  const canAllIn =
    game.phase === "call_or_fold" &&
    respondingTeam.balance > 0 &&
    respondingTeam.balance < game.potBet;

  const showdownPot = getShowdownPot(game);

  const canFold =
    game.phase === "call_or_fold" &&
    respondingTeam.balance >= Math.min(game.ante, respondingTeam.balance);

  const syncQuestions = (next: Question[]) => {
    setQuestions(next);
    setGame((prev) => ({ ...prev, questions: next }));
  };

  const startGame = () => {
    if (questions.length === 0) {
      alert("Add at least one question before starting.");
      return;
    }
    const balance = Math.max(
      100,
      Number.parseInt(setup.balance, 10) || DEFAULT_BALANCE,
    );
    const ante = Math.max(
      10,
      Number.parseInt(setup.ante, 10) || DEFAULT_ANTE,
    );
    setGame({
      ...createInitialState(
        setup.teamA.trim() || "Team 1",
        setup.teamB.trim() || "Team 2",
        balance,
        ante,
        questions,
      ),
      phase: "choose_category",
    });
    setDraftBet(0);
    setShowAnswer(false);
    setShowQuestions(false);
  };

  const onSelectCategory = (categoryName: string) => {
    setGame((prev) => {
      const next = selectCategory(prev, categoryName) ?? prev;
      if (next.phase === "leading_bet") {
        const min = getMinLeadingBet(next.ante, next.teams[next.leadingTeam].balance);
        setDraftBet(min);
      } else {
        setDraftBet(0);
      }
      return next;
    });
    setShowAnswer(false);
  };

  const onLockBet = () => {
    setGame((prev) => lockLeadingBet(prev, draftBet) ?? prev);
    setShowAnswer(false);
  };

  const onFold = () => {
    setGame((prev) => handleFold(prev));
    setShowAnswer(false);
  };

  const onCall = () => {
    setGame((prev) => handleCall(prev) ?? prev);
    setShowAnswer(false);
  };

  const onAllIn = () => {
    setGame((prev) => handleAllIn(prev) ?? prev);
    setShowAnswer(false);
  };

  const onShowdown = (answers: ShowdownAnswers) => {
    setGame((prev) => resolveShowdown(prev, answers));
    setShowAnswer(false);
  };

  const onEndGame = () => {
    setGame((prev) => endGameByHost(prev));
  };

  const onReset = () => {
    setGame(
      createInitialState(
        setup.teamA,
        setup.teamB,
        game.startingBalance,
        game.ante,
        questions,
      ),
    );
    setDraftBet(0);
    setShowAnswer(false);
    setShowQuestions(false);
  };

  if (game.phase === "setup") {
    return (
      <div className="app setup-layout">
        <header className="hero">
          <p className="eyebrow">Local game host</p>
          <h1>Gambling Charades</h1>
          <p className="subtitle">
            Poker-style quiz betting. The leading team bets on knowing the answer;
            the other team calls or folds. Folding costs the ante.
          </p>
        </header>

        <div className="setup-columns">
          <section className="panel setup-panel">
            <h2>Game setup</h2>
            <div className="setup-grid">
              <label>
                Team 1 name
                <input
                  value={setup.teamA}
                  onChange={(e) =>
                    setSetup((s) => ({ ...s, teamA: e.target.value }))
                  }
                />
              </label>
              <label>
                Team 2 name
                <input
                  value={setup.teamB}
                  onChange={(e) =>
                    setSetup((s) => ({ ...s, teamB: e.target.value }))
                  }
                />
              </label>
              <label>
                Starting balance (each)
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={setup.balance}
                  onChange={(e) =>
                    setSetup((s) => ({ ...s, balance: e.target.value }))
                  }
                />
              </label>
              <label>
                Fold ante
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={setup.ante}
                  onChange={(e) =>
                    setSetup((s) => ({ ...s, ante: e.target.value }))
                  }
                />
              </label>
            </div>
            <p className="setup-note">
              Team 1 leads on the first question. Teams alternate each round.
              Between questions, the leading team picks a category — the question
              stays hidden until then.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startGame}
              disabled={questions.length === 0}
            >
              Start game ({questions.length} questions)
            </button>
          </section>

          <QuestionManager questions={questions} onChange={syncQuestions} />
        </div>
      </div>
    );
  }

  if (game.phase === "game_over") {
    return (
      <GameOverScreen
        game={game}
        onReset={() => {
          setGame(
            createInitialState(
              setup.teamA,
              setup.teamB,
              game.startingBalance,
              game.ante,
              questions,
            ),
          );
        }}
      />
    );
  }

  return (
    <div className="game-shell">
      <div className="app game-layout">
      <header className="top-bar">
        <div>
          <p className="eyebrow">
            {game.phase === "choose_category"
              ? "Pick a category"
              : `Question ${roundNumber}`}
          </p>
          <h1>Gambling Charades</h1>
        </div>
        <div className="top-actions">
          <span className="phase-pill">{phaseLabel(game.phase)}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowQuestions(true)}
          >
            Questions ({questions.length})
          </button>
          <button type="button" className="btn btn-ghost" onClick={onEndGame}>
            End game
          </button>
        </div>
      </header>

      <div className="rules-strip">
        <span>Ante on fold: {formatMoney(game.ante)}</span>
        <span>·</span>
        <span>Play until one team is broke or the host ends the game</span>
      </div>

      <div className="scoreboard">
        <TeamCard team={game.teams.teamA} state={teamCardState(game, "teamA")} />
        <div className="vs">VS</div>
        <TeamCard team={game.teams.teamB} state={teamCardState(game, "teamB")} />
      </div>

      <CategoryBar
        categories={getCategoryStats(game)}
        activeCategory={
          game.phase === "choose_category" ? undefined : currentQuestion?.category
        }
        selectable={game.phase === "choose_category"}
        onSelectCategory={onSelectCategory}
      />

      <main className="play-area">
        <section
          className={[
            "panel",
            "question-panel",
            activeTurn.kind === "team" && `question-panel--${activeTurn.teamId}`,
            game.phase === "choose_category" && "question-panel--awaiting",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="question-panel__body">
          {game.phase === "choose_category" ? (
            <>
              <div className="question-meta">
                <span className="category">Category hidden</span>
              </div>
              <h2 className="question-prompt question-prompt--placeholder">
                {hasAvailableQuestions(game)
                  ? `${leadingTeam.name} — pick a category above to reveal the question`
                  : "All questions have been played"}
              </h2>
            </>
          ) : (
            <>
              <div className="question-meta">
                <span className="category">{currentQuestion?.category}</span>
              </div>
              <h2 className="question-prompt">
                {currentQuestion?.prompt ?? "No questions in deck"}
              </h2>

              <div
                className={[
                  "answer-block",
                  "answer-block--reserved",
                  game.phase !== "showdown" && "answer-block--empty",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {game.phase === "showdown" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAnswer((v) => !v)}
                    >
                      {showAnswer ? "Hide answer" : "Reveal answer"}
                    </button>
                    {showAnswer && (
                      <p className="answer-text">{currentQuestion?.answer}</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          </div>
        </section>

        <aside
          className={[
            "panel",
            "betting-panel",
            activeTurn.kind === "team" && `betting-panel--${activeTurn.teamId}`,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="betting-panel__body">
          <ActionPanel
            game={game}
            draftBet={draftBet}
            setDraftBet={setDraftBet}
            minLeadingBet={minLeadingBet}
            leadingTeam={leadingTeam}
            respondingTeam={respondingTeam}
            canLockBet={canLockBet}
            canCall={canCall}
            canAllIn={canAllIn}
            canFold={canFold}
            showdownPot={showdownPot}
            onLockBet={onLockBet}
            onFold={onFold}
            onCall={onCall}
            onAllIn={onAllIn}
            onShowdown={onShowdown}
          />
          </div>
        </aside>
      </main>

      {game.lastRound && game.phase === "choose_category" && (
        <div className="round-banner" role="status">
          {game.lastRound.summary}
        </div>
      )}

      <footer className="host-footer">
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset to setup
        </button>
        <span className="footer-hint">
          Host view · {questions.length} questions in deck
        </span>
      </footer>

      {showQuestions && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Manage questions"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQuestions(false);
          }}
        >
          <div className="modal panel">
            <div className="modal__header">
              <h2>Manage questions</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowQuestions(false)}
              >
                Close
              </button>
            </div>
            <QuestionManager questions={questions} onChange={syncQuestions} />
          </div>
        </div>
      )}
      </div>
      <PeekMascot />
    </div>
  );
}

function GameOverScreen({
  game,
  onReset,
}: {
  game: GameState;
  onReset: () => void;
}) {
  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Game over</p>
        <h1>Gambling Charades</h1>
        <p className="subtitle">{game.gameOverReason}</p>
      </header>
      <div className="scoreboard game-over-board">
        <TeamCard team={game.teams.teamA} state="idle" />
        <div className="vs">VS</div>
        <TeamCard team={game.teams.teamB} state="idle" />
      </div>
      <button type="button" className="btn btn-primary setup-panel" onClick={onReset}>
        Back to setup
      </button>
    </div>
  );
}

function ActionPanel({
  game,
  draftBet,
  setDraftBet,
  minLeadingBet,
  leadingTeam,
  respondingTeam,
  canLockBet,
  canCall,
  canAllIn,
  canFold,
  showdownPot,
  onLockBet,
  onFold,
  onCall,
  onAllIn,
  onShowdown,
}: {
  game: GameState;
  draftBet: number;
  setDraftBet: (n: number) => void;
  minLeadingBet: number;
  leadingTeam: Team;
  respondingTeam: Team;
  canLockBet: boolean;
  canCall: boolean;
  canAllIn: boolean;
  canFold: boolean;
  showdownPot: number;
  onLockBet: () => void;
  onFold: () => void;
  onCall: () => void;
  onAllIn: () => void;
  onShowdown: (answers: ShowdownAnswers) => void;
}) {
  if (game.phase === "choose_category") {
    return (
      <>
        <TeamActionHeader team={leadingTeam} action="Choose a category" />
        <p className="hint">
          Discuss which category you want, then click it in the bar above. The
          question stays hidden until a category is picked.
        </p>
        {!hasAvailableQuestions(game) && (
          <p className="warning-note">
            No questions left in any category. End the game or add more
            questions.
          </p>
        )}
      </>
    );
  }

  if (game.phase === "leading_bet") {
    return (
      <>
        <TeamActionHeader team={leadingTeam} action="Place your bet" />
        <p className="hint">
          Discuss the question, then bet how much you&apos;re willing to risk that
          you know the answer. Minimum bet is {formatMoney(minLeadingBet)}
          {minLeadingBet < game.ante ? " (your full stack)" : " (ante)"}.
        </p>
        <BetControls
          balance={leadingTeam.balance}
          minBet={minLeadingBet}
          value={draftBet}
          onChange={setDraftBet}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canLockBet}
          onClick={onLockBet}
        >
          Lock bet — {formatMoney(draftBet || 0)}
        </button>
      </>
    );
  }

  if (game.phase === "call_or_fold") {
    return (
      <>
        <TeamActionHeader team={respondingTeam} action="Call, all-in, or fold" />
        <p className="hint">
          {leadingTeam.name} bet {formatMoney(game.potBet)}. Match the bet to
          challenge, go all-in with less, or fold and pay {formatMoney(game.ante)}{" "}
          ante.
        </p>
        <div className="pot-callout">
          <span className="bet-label">Bet to call</span>
          <span className="bet-amount">{formatMoney(game.potBet)}</span>
        </div>
        <div className="resolve-actions">
          <button
            type="button"
            className="btn btn-success"
            disabled={!canCall}
            onClick={onCall}
          >
            Call — match {formatMoney(game.potBet)}
          </button>
          {canAllIn && (
            <button
              type="button"
              className="btn btn-all-in"
              onClick={onAllIn}
            >
              All-in — {formatMoney(respondingTeam.balance)}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canFold}
            onClick={onFold}
          >
            Fold — pay {formatMoney(Math.min(game.ante, respondingTeam.balance))} ante
          </button>
        </div>
        {canAllIn && (
          <p className="hint">
            All-in puts in {formatMoney(respondingTeam.balance)}. Uncalled chips
            return to {leadingTeam.name}. Showdown pot:{" "}
            {formatMoney(respondingTeam.balance * 2)}.
          </p>
        )}
      </>
    );
  }

  if (game.phase === "showdown") {
    const allInActive =
      game.followerCommit > 0 && game.followerCommit < game.potBet;
    const teamA = game.teams.teamA;
    const teamB = game.teams.teamB;

    return (
      <>
        <div className="host-action-header">
          <span className="host-action-header__label">Host</span>
          <span className="host-action-header__action">Record results</span>
        </div>
        <p className="hint">
          Pot is {formatMoney(showdownPot)}
          {allInActive
            ? ` (${formatMoney(game.followerCommit)} all-in vs ${formatMoney(game.potBet)} bet)`
            : ""}
          . Pick the outcome below.
        </p>
        <div className="showdown-grid">
          <ShowdownButton
            answers={showdownAnswersForTeamWin("teamA", game.leadingTeam)}
            label={`${teamA.name} wins`}
            teamAccent="teamA"
            onShowdown={onShowdown}
          />
          <ShowdownButton
            answers={showdownAnswersForTeamWin("teamB", game.leadingTeam)}
            label={`${teamB.name} wins`}
            teamAccent="teamB"
            onShowdown={onShowdown}
          />
          <ShowdownButton
            answers={{ leadingCorrect: true, followingCorrect: true }}
            label="Both right"
            sublabel="Split pot"
            onShowdown={onShowdown}
          />
          <ShowdownButton
            answers={{ leadingCorrect: false, followingCorrect: false }}
            label="Both wrong"
            sublabel="Split pot"
            onShowdown={onShowdown}
          />
        </div>
      </>
    );
  }

  return null;
}

function TeamActionHeader({ team, action }: { team: Team; action: string }) {
  return (
    <div className={`team-action-header team-action-header--${team.id}`}>
      <span className="team-action-header__badge">Your move</span>
      <h3 className="team-action-header__name">{team.name}</h3>
      <p className="team-action-header__action">{action}</p>
    </div>
  );
}

function BetControls({
  balance,
  minBet,
  value,
  onChange,
}: {
  balance: number;
  minBet: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const setBet = (amount: number) => {
    onChange(Math.min(Math.max(minBet, amount), balance));
  };

  return (
    <>
      <div className="bet-display">
        <span className="bet-label">Your bet</span>
        <span className="bet-amount">{formatMoney(value)}</span>
      </div>
      <div className="quick-bets">
        {QUICK_BETS.map((amount) => (
          <button
            key={amount}
            type="button"
            className="btn btn-chip"
            disabled={amount > balance || amount < minBet}
            onClick={() => setBet(amount)}
          >
            {formatMoney(amount)}
          </button>
        ))}
      </div>
      <label className="custom-bet">
        Custom amount
        <input
          type="number"
          min={minBet}
          max={balance}
          value={value || ""}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            if (Number.isNaN(parsed)) {
              onChange(0);
              return;
            }
            onChange(Math.min(Math.max(0, parsed), balance));
          }}
        />
      </label>
    </>
  );
}

function ShowdownButton({
  answers,
  label,
  sublabel,
  teamAccent,
  onShowdown,
}: {
  answers: ShowdownAnswers;
  label: string;
  sublabel?: string;
  teamAccent?: TeamId;
  onShowdown: (answers: ShowdownAnswers) => void;
}) {
  return (
    <button
      type="button"
      className={[
        "btn",
        "showdown-btn",
        teamAccent ? `showdown-btn--${teamAccent}` : "showdown-btn--neutral",
      ].join(" ")}
      onClick={() => onShowdown(answers)}
    >
      <span className="showdown-btn__label">{label}</span>
      {sublabel && <span className="showdown-btn__sublabel">{sublabel}</span>}
    </button>
  );
}

function TeamCard({
  team,
  state,
}: {
  team: Team;
  state: "active" | "waiting" | "idle";
}) {
  return (
    <article
      className={[
        "team-card",
        `team-card--${team.id}`,
        state === "active" && "team-card--active",
        state === "waiting" && "team-card--waiting",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h3>{team.name}</h3>
      <p className="team-balance">{formatMoney(team.balance)}</p>
      {state === "active" && (
        <span className="team-badge team-badge--move">Your move</span>
      )}
      {state === "waiting" && (
        <span className="team-badge team-badge--wait">Waiting</span>
      )}
    </article>
  );
}
