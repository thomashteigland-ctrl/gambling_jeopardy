# Gambling Charades

A local host screen for a two-team quiz / charades game where each team starts with a shared bank (default **$2,000**) and bets on how confident they are in each answer.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Rules (implemented)

1. **Team 1 leads** on the first question; teams **alternate** who leads each round.
2. The **leading team** sees the question, discusses, and **locks a bet** (e.g. $500) that they know the answer.
3. The **other team** chooses **call** (match the bet) or **fold**.
4. **Fold** — pay the **ante** (default $100) to the leading team; round ends. The opening bet is not collected.
5. **Call** — both teams put in the bet; **showdown**. Host marks each team right or wrong:

   | Leading | Following | Result |
   |---------|-----------|--------|
   | ✓ | ✓ | Split pot |
   | ✗ | ✓ | Following team wins |
   | ✓ | ✗ | Leading team wins |
   | ✗ | ✗ | Split pot |
6. Questions **cycle forever** until the host ends the game or a team hits **$0**.

### Questions

On the setup screen (or **Questions** during a game):

- Add questions manually (category, question, answer)
- **Upload CSV** with columns `category`, `prompt`, `answer`
- **Download template** for the CSV format
- Questions are saved in your browser (`localStorage`)

Game logic lives in `src/gameLogic.ts`.
