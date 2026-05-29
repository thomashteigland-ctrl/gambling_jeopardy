export type TeamId = "teamA" | "teamB";

export type GamePhase =
  | "setup"
  | "choose_category"
  | "leading_bet"
  | "call_or_fold"
  | "showdown"
  | "game_over";

export interface ShowdownAnswers {
  leadingCorrect: boolean;
  followingCorrect: boolean;
}

export type RoundOutcome =
  | "fold"
  | "call_split"
  | "call_following_wins"
  | "call_leading_wins";

export interface Team {
  id: TeamId;
  name: string;
  balance: number;
}

export interface Question {
  id: string;
  category: string;
  prompt: string;
  answer: string;
}

export interface RoundResult {
  outcome: RoundOutcome;
  summary: string;
  potAmount: number;
  antePaid: number;
}

export interface GameState {
  phase: GamePhase;
  teams: Record<TeamId, Team>;
  questions: Question[];
  /** Index into questions[], or -1 when no question is active yet */
  questionIndex: number;
  /** Team that sees the question first and places the opening bet */
  leadingTeam: TeamId;
  /** Locked opening bet for the current round */
  potBet: number;
  /** Following team's matched commitment (full call or all-in amount) */
  followerCommit: number;
  startingBalance: number;
  ante: number;
  lastRound: RoundResult | null;
  /** Set when a team hits $0 or the host ends the game */
  gameOverReason: string | null;
  /** Question ids already played this session */
  usedQuestionIds: string[];
}

export interface CategoryStat {
  name: string;
  total: number;
  remaining: number;
}
