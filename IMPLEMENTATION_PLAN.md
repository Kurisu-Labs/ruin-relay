# Ruin Relay — Implementation Plan & Backlog

> v1.0 / 10 October 2026. Time estimates are planning targets, not guaranteed completion times.

**Renderer amendment, 11 October 2026:** [ADR-042](docs/adr/0042-threejs-only-dungeon.md) replaces the original Phaser work items below with the sole Three.js presentation in `src/game3d/`. Current scope and migration evidence are in [the renderer migration](gameplan/RENDERER_MIGRATION.md); the domain, contract, and release gates still apply.

## Milestones / internal deadlines (WIB)

| Milestone | Target | Done when |
|---|---|---|
| M0 — Rules locked | Saturday night, Oct 10 | PRD/ADR/fixture agreed; repository structure created |
| M1 — Contract verified locally | Sunday Oct 11, midday | Foundry seed/revision/path/BFS/stale tests pass |
| M2 — Playable locally | Sunday Oct 11, night | Phaser movement, victory, editable preview, fixture parity |
| M3 — Real Sepolia loop | Monday Oct 12, afternoon | Rev 0→1→2 via wallet and current state UI |
| M4 — Submission freeze | Monday Oct 12, night | No P0 blockers, demo recorded, README and videos English |
| M5 — Buffer submission | Tuesday Oct 13, 09:00 WIB | Portal completed; ensure before official 13:59 WIB |

## Backlog by dependency

| Task | Priority | Needs | Output / evidence |
|---|---|---|---|
| T-01 Create Foundry scaffold | P0 | None | `contracts/` builds |
| T-02 Constructor + seed validation | P0 | T-01 | Unit tests C01–C08 |
| T-03 Path 2-bit decoder + validation | P0 | T-02 | C13–C20, fixture path parity |
| T-04 Candidate edit & BFS | P0 | T-03 | C21–C25, C30–C32, F01–F11; malformed candidate query returns false |
| T-05 Revision CAS + event | P0 | T-04 | C09–C12, C26–C27 |
| T-06 Solidity gas + security QA | P0 | T-05 | Forge gas report, fuzz, invariant |
| T-07 Root Vite app + Phaser board/movement | P0 | Fixture | Deterministic frozen run, Restart/Play latest, live/stale status per ADR-029 |
| T-08 React UI/victory/edit preview | P0 | T-07 | Readable geometric dungeon, play/edit/preview, gated Commit controls |
| T-09 TS codec/BFS tests | P0 | T-07 | Fixture parity tests |
| T-10 Wallet connect/wrong network | P0 | T-05, T-08 | Sepolia connect UX |
| T-11 Simulate & recoverable commit attempts | P0 | T-10 | Fixed attempts, journal/reload/hash recovery, wallet replacements, atomic coordination across tabs per ADR-030/031 |
| T-12 Real Sepolia deploy & verify | P0 | T-06 | Explorer verified source/ABI |
| T-13 Read state & log history | P0 | T-11,T-12 | Separate live/contribution state, recent edits, reorg reconciliation per ADR-030/031 |
| T-14 Real E2E demo txs | P0 | T-13 | rev0/1/2 tx hashes, video footage |
| T-15 Readme + team + prior art & business | P0 | T-14 | English documentation/submission |
| T-16 Pitch and product videos | P0 | T-14 | 2–3m pitch and ≤3m demo |
| T-17 Mobile D-pad | P1 | T-08 | Touch navigation |
| T-18 Full historical replay | P1 | T-13 | Paginated history viewer |
| T-19 Stats & visuals | P1 | T-08 | Additional game feel |

T-07–T-13 harus memenuhi acceptance W-24–W-48 pada `TEST_PLAN.md`, selain kasus awal; rincian perilaku berasal dari `ADR.md` §C.5/§C.7 dan ADR-029–031. P0 recovery termasuk outcome unknown dan berlaku pada satu origin/profil browser; profil atau perangkat lain tetap memakai concurrency check kontrak.

## Workstream splitting

- **Contract owner:** T-01–T-06, T-12, security & gas; contract interface and fixture are locked first.
- **Game/UI owner:** T-07–T-11, T-13, T-17–T-19; start with local mock fixture to unblock frontend.
- **Demo/product owner:** T-14–T-16, usability tests, business hypothesis, official submission; can be combined with frontend or contract role.

## Feature cut order (if schedule slips)

1. Remove leaderboard/stats, replay viewer, procedural aesthetics, animations beyond basic feedback.
2. Remove mobile touch controls; keep mobile readable.
3. Limit history to 10 recent events and simple explorer links.
4. Keep exactly one global board and single mutation route; do not add new game modes.
5. Never remove path validation, BFS, revision concurrency, wallet statuses, or real Sepolia evidence.

## Demo operational checklist

- [ ] Browser A and Browser B profiles ready (two wallets with Sepolia ETH).
- [ ] Known contract address, chainId, RPC fallback, explorer links displayed.
- [ ] Contract freshly seeded rev0 for scripted reference case (deploy dedicated demo contract).
- [ ] A valid route ready for human execution; onchain path verified rather than pasted via debug button.
- [ ] Screen recorder captures wallet signing, tx hash, board update, second player run.
- [ ] Audio/video English, no private keys/secrets, no fabricated claims.
- [ ] E2E-01 plus one safety rejection clip are reproducible.
- [ ] Repo license and dependency/asset licenses checked.
- [ ] Actual development work window and any reused owned code disclosed as required.
