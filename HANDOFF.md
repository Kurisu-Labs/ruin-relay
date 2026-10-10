# Ruin Relay — Developer / Coding Agent Handoff

**Goal:** Ship one playable 7×7 evolving dungeon on Arbitrum Sepolia. One local escape permits one onchain edit that cannot make the next board unsolvable.

## Read in this order

1. `PRD.md` — product concept, UX flow, scope, demo acceptance criteria.
2. `ADR.md`, its linked amendments in `docs/adr/`, and `GLOSSARY.md` — architecture, accepted decisions, shared vocabulary, and bounded path/BFS specifications.
3. `reference/fixtures.json` — canonical seed and expected two successive edits.
4. `reference/IRuinRelay.sol` — minimal public contract interface (NOT implementation).
5. `TEST_PLAN.md` — unit, fuzz, invariant, frontend and E2E acceptance cases.
6. `IMPLEMENTATION_PLAN.md` — staged build plan and evidence checklist.

## Do NOT invent product scope

- One shared board only: 7×7, START=0, EXIT=48, immutable editable mask.
- No ERC20/NFT/rewards, no multiplayer realtime, no backend authority, no editor admin.
- One `completeAndMutate` transaction validates path on old board and BFS on toggled candidate.
- Revision compares against player's snapshot; transaction race must fail safely.
- No claims of bot-resistance or verified human play.

## Engineering handshake

Before coding, check the rules and ADR match. Implementation must pass `fixtures.json` exactly. Prioritize Foundry contract tests, TS parity tests, then game and wallet. After deployment, verify the contract source/address and record two real mutation tx hashes in English README.

## Nonnegotiable demo

Player A: revision 0 → solution → tile 31 → successful Sepolia tx → revision 1.  
Player B: loads revision 1 → solution → tile 38 → successful Sepolia tx → revision 2.  
State after each must match reference hex masks. Show visible board differences and explorer links.

## Important limitation

This package documents **requirements and decisions**. It includes sample fixture and contract ABI specification, **not** a working smart contract, production backend, security audit, measured gas report or verified deployment.
