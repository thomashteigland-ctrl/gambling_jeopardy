import type {
  CategoryStat,
  GameState,
  RoundResult,
  ShowdownAnswers,
  TeamId,
} from "./types";

export function otherTeam(teamId: TeamId): TeamId {
  return teamId === "teamA" ? "teamB" : "teamA";
}

export function normalizeCategory(category: string): string {
  return category.trim() || "General";
}

export function getCurrentQuestion(state: GameState) {
  if (state.questionIndex < 0 || state.phase === "choose_category") {
    return null;
  }
  if (state.questions.length === 0) return null;
  return state.questions[state.questionIndex] ?? null;
}

export function canAfford(teamBalance: number, amount: number): boolean {
  return teamBalance >= amount;
}

/** Minimum opening bet: at least the ante, or full stack if shorter. */
export function getMinLeadingBet(ante: number, balance: number): number {
  if (balance <= 0) return 0;
  return Math.min(ante, balance);
}

/** Amount both teams contest at showdown (handles all-in with less than the opening bet). */
export function getEffectiveBet(state: GameState): number {
  if (state.followerCommit > 0) {
    return Math.min(state.potBet, state.followerCommit);
  }
  return state.potBet;
}

export function getShowdownPot(state: GameState): number {
  return getEffectiveBet(state) * 2;
}

export function transfer(
  teams: GameState["teams"],
  from: TeamId,
  to: TeamId,
  amount: number,
): GameState["teams"] {
  const safeAmount = Math.min(amount, teams[from].balance);
  return {
    ...teams,
    [from]: { ...teams[from], balance: teams[from].balance - safeAmount },
    [to]: { ...teams[to], balance: teams[to].balance + safeAmount },
  };
}

export function checkElimination(
  teams: GameState["teams"],
): { eliminated: TeamId | null; reason: string | null } {
  const broke = (["teamA", "teamB"] as TeamId[]).filter((id) => teams[id].balance <= 0);
  if (broke.length === 0) return { eliminated: null, reason: null };
  if (broke.length === 2) {
    return { eliminated: broke[0], reason: "Both teams are out of money." };
  }
  const winner = otherTeam(broke[0]);
  return {
    eliminated: broke[0],
    reason: `${teams[broke[0]].name} is out of money. ${teams[winner].name} wins!`,
  };
}

function withEliminationCheck(state: GameState): GameState {
  const { eliminated, reason } = checkElimination(state.teams);
  if (eliminated) {
    return {
      ...state,
      phase: "game_over",
      gameOverReason: reason,
    };
  }
  return state;
}

function markCurrentQuestionUsed(state: GameState): string[] {
  const current = getCurrentQuestion(state);
  if (!current || state.usedQuestionIds.includes(current.id)) {
    return state.usedQuestionIds;
  }
  return [...state.usedQuestionIds, current.id];
}

export function getCategoryStats(state: GameState): CategoryStat[] {
  const used = new Set(state.usedQuestionIds);
  const byCategory = new Map<string, { total: number; remaining: number }>();

  for (const q of state.questions) {
    const name = normalizeCategory(q.category);
    const entry = byCategory.get(name) ?? { total: 0, remaining: 0 };
    entry.total += 1;
    if (!used.has(q.id)) entry.remaining += 1;
    byCategory.set(name, entry);
  }

  return [...byCategory.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function hasAvailableQuestions(state: GameState): boolean {
  const used = new Set(state.usedQuestionIds);
  return state.questions.some((q) => !used.has(q.id));
}

function transitionToCategoryPick(state: GameState): GameState {
  const usedQuestionIds = markCurrentQuestionUsed(state);
  const nextLeading =
    state.questionIndex >= 0 ? otherTeam(state.leadingTeam) : state.leadingTeam;

  const next = withEliminationCheck({
    ...state,
    phase: "choose_category",
    leadingTeam: nextLeading,
    potBet: 0,
    followerCommit: 0,
    lastRound: state.lastRound,
    usedQuestionIds,
    questionIndex: -1,
  });

  if (!hasAvailableQuestions(next)) {
    return {
      ...next,
      phase: "game_over",
      gameOverReason: "All questions have been played.",
    };
  }

  return next;
}

export function selectCategory(
  state: GameState,
  categoryName: string,
): GameState | null {
  if (state.phase !== "choose_category") return null;

  const normalized = normalizeCategory(categoryName);
  const used = new Set(state.usedQuestionIds);
  const available = state.questions.filter(
    (q) => normalizeCategory(q.category) === normalized && !used.has(q.id),
  );

  if (available.length === 0) return null;

  const picked = available[Math.floor(Math.random() * available.length)];
  const questionIndex = state.questions.findIndex((q) => q.id === picked.id);
  if (questionIndex < 0) return null;

  return withEliminationCheck({
    ...state,
    phase: "leading_bet",
    questionIndex,
    lastRound: null,
  });
}

export function lockLeadingBet(state: GameState, amount: number): GameState | null {
  const team = state.teams[state.leadingTeam];
  const minBet = getMinLeadingBet(state.ante, team.balance);
  if (minBet <= 0) return null;

  const bet = Math.min(Math.max(minBet, amount), team.balance);
  if (bet < minBet) return null;

  return {
    ...state,
    phase: "call_or_fold",
    potBet: bet,
    followerCommit: 0,
  };
}

export function handleFold(state: GameState): GameState {
  const folder = otherTeam(state.leadingTeam);
  const leader = state.leadingTeam;
  const antePaid = Math.min(state.ante, state.teams[folder].balance);

  const teams = transfer(state.teams, folder, leader, antePaid);
  const lastRound: RoundResult = {
    outcome: "fold",
    summary: `${state.teams[folder].name} folded and paid ${formatAmt(antePaid)} ante to ${state.teams[leader].name}.`,
    potAmount: 0,
    antePaid,
  };

  return transitionToCategoryPick({
    ...state,
    teams,
    lastRound,
  });
}

export function handleCall(state: GameState): GameState | null {
  const responder = otherTeam(state.leadingTeam);
  const bet = state.potBet;

  if (!canAfford(state.teams[responder].balance, bet)) return null;

  return {
    ...state,
    phase: "showdown",
    followerCommit: bet,
  };
}

export function handleAllIn(state: GameState): GameState | null {
  const responder = otherTeam(state.leadingTeam);
  const leader = state.leadingTeam;
  const commit = state.teams[responder].balance;

  if (commit <= 0) return null;

  if (commit >= state.potBet) {
    return handleCall(state);
  }

  const uncalled = state.potBet - commit;

  return {
    ...state,
    teams: {
      ...state.teams,
      [leader]: {
        ...state.teams[leader],
        balance: state.teams[leader].balance + uncalled,
      },
    },
    phase: "showdown",
    followerCommit: commit,
  };
}

function splitPot(
  teams: GameState["teams"],
  leader: TeamId,
  follower: TeamId,
  bet: number,
): GameState["teams"] {
  return {
    ...teams,
    [leader]: { ...teams[leader], balance: teams[leader].balance + bet },
    [follower]: { ...teams[follower], balance: teams[follower].balance + bet },
  };
}

export function resolveShowdown(
  state: GameState,
  answers: ShowdownAnswers,
): GameState {
  const follower = otherTeam(state.leadingTeam);
  const leader = state.leadingTeam;
  const bet = getEffectiveBet(state);
  const pot = bet * 2;
  const leaderName = state.teams[leader].name;
  const followerName = state.teams[follower].name;
  const { leadingCorrect, followingCorrect } = answers;
  const wasAllIn = state.followerCommit > 0 && state.followerCommit < state.potBet;
  const allInNote = wasAllIn
    ? ` (${followerName} all-in ${formatAmt(state.followerCommit)})`
    : "";

  let teams: GameState["teams"] = {
    ...state.teams,
    [leader]: {
      ...state.teams[leader],
      balance: state.teams[leader].balance - bet,
    },
    [follower]: {
      ...state.teams[follower],
      balance: state.teams[follower].balance - bet,
    },
  };

  let lastRound: RoundResult;

  if (leadingCorrect && followingCorrect) {
    teams = splitPot(teams, leader, follower, bet);
    lastRound = {
      outcome: "call_split",
      summary: `Both correct — pot split. Each gets ${formatAmt(bet)} back.`,
      potAmount: pot,
      antePaid: 0,
    };
  } else if (!leadingCorrect && followingCorrect) {
    teams[follower] = {
      ...teams[follower],
      balance: teams[follower].balance + pot,
    };
    lastRound = {
      outcome: "call_following_wins",
      summary: `${leaderName} wrong, ${followerName} right — ${followerName} wins ${formatAmt(pot)}.${allInNote}`,
      potAmount: pot,
      antePaid: 0,
    };
  } else if (leadingCorrect && !followingCorrect) {
    teams[leader] = { ...teams[leader], balance: teams[leader].balance + pot };
    lastRound = {
      outcome: "call_leading_wins",
      summary: `${leaderName} right, ${followerName} wrong — ${leaderName} wins ${formatAmt(pot)}.${allInNote}`,
      potAmount: pot,
      antePaid: 0,
    };
  } else {
    teams = splitPot(teams, leader, follower, bet);
    lastRound = {
      outcome: "call_split",
      summary: `Both wrong — pot split. Each gets ${formatAmt(bet)} back.`,
      potAmount: pot,
      antePaid: 0,
    };
  }

  return transitionToCategoryPick({
    ...state,
    teams,
    lastRound,
  });
}

export function endGameByHost(state: GameState): GameState {
  const leader =
    state.teams.teamA.balance === state.teams.teamB.balance
      ? null
      : state.teams.teamA.balance > state.teams.teamB.balance
        ? "teamA"
        : "teamB";

  const reason = leader
    ? `Game ended by host. ${state.teams[leader].name} leads on balance.`
    : "Game ended by host.";

  return {
    ...state,
    phase: "game_over",
    gameOverReason: reason,
  };
}

function formatAmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
