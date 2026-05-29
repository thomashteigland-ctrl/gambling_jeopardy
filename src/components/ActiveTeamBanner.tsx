import type { GamePhase, GameState, Team, TeamId } from "../types";
import { otherTeam } from "../gameLogic";

export type ActiveTurn =
  | { kind: "team"; teamId: TeamId; team: Team; action: string }
  | { kind: "host"; action: string };

export function getActiveTurn(game: GameState): ActiveTurn {
  const leader = game.teams[game.leadingTeam];
  const follower = game.teams[otherTeam(game.leadingTeam)];

  switch (game.phase) {
    case "choose_category":
      return {
        kind: "team",
        teamId: game.leadingTeam,
        team: leader,
        action: "Choose a category",
      };
    case "leading_bet":
      return {
        kind: "team",
        teamId: game.leadingTeam,
        team: leader,
        action: "Place your bet",
      };
    case "call_or_fold":
      return {
        kind: "team",
        teamId: otherTeam(game.leadingTeam),
        team: follower,
        action: "Call or fold",
      };
    case "showdown":
      return { kind: "host", action: "Record who got it right" };
    default:
      return { kind: "host", action: "" };
  }
}

export function teamCardState(
  game: GameState,
  teamId: TeamId,
): "active" | "waiting" | "idle" {
  const turn = getActiveTurn(game);
  if (turn.kind !== "team") {
    if (game.phase === "showdown") {
      return "idle";
    }
    return "waiting";
  }
  if (turn.teamId === teamId) return "active";
  return "waiting";
}

export function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case "setup":
      return "Setup";
    case "choose_category":
      return "Choose category";
    case "leading_bet":
      return "Place bet";
    case "call_or_fold":
      return "Call or fold";
    case "showdown":
      return "Showdown";
    case "game_over":
      return "Game over";
  }
}
