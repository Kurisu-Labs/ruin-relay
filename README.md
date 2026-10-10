# Ruin Relay

**Escape the dungeon. Change one tile. Challenge everyone after you.**

A desktop browser puzzle with one shared 7×7 dungeon. Play locally without a wallet; a valid escape lets you toggle one allowed tile through a single Solidity transaction. The contract verifies the path against the old dungeon and checks that the new dungeon still has an escape route.

The application and local test harness are implemented. **The Sepolia release gate is pending:** no public deployment, verified explorer source, real mutation hashes, or release videos are claimed here. See [release evidence](docs/release-evidence.md).

## Run locally

Use Node.js 22.12+ (tested with 26.11.1) and npm. The lockfile pins React, Phaser 3, viem/wagmi, Vite, Foundry 1.7.1, and the test tools. Foundry downloads Solidity 0.8.24 on first use.

```sh
npm ci
npx playwright install chromium
npm run local
```

Open http://127.0.0.1:4173/play. This command starts a fresh Anvil chain with ID 421614, deploys the canonical seed, and starts Vite with the deployment metadata. Stop it with Ctrl+C. Local chain state is disposable. The UI labels this environment **Local Anvil** and does not present its hashes as public Sepolia transactions.

For frontend work without Anvil, `npm run dev` serves the practice seed when deployment metadata is absent. Practice has no live-chain or commit claims. `npm run build` generates the static site in `dist/`. Any static host must fall back to `index.html` for `/play`, `/history`, and `/about`.

Focus the board and use WASD or arrow keys. Illegal moves do not add steps. Reach EXIT within 96 moves, choose one highlighted editable tile, and review the wall/floor change. **Restart** repeats the same snapshot; **Play latest** starts on the freshly observed live dungeon. A stale run remains playable as practice and cannot commit.

## Tests

```sh
npm run typecheck
npm run test:contract
npm run test:rules
npm run test:browser
npm test
node scripts/foundry.mjs forge snapshot --root contracts
node scripts/foundry.mjs forge test --root contracts --gas-report
```

Browser tests launch their own Anvil and Vite instances on ports 8545 and 4173; stop `npm run local` first. Tests use the actual public contract ABI, the public TypeScript rules API, and browser UI with wallet/RPC/storage boundary fault injection. No production test controls are embedded in the app. `npm run abi` regenerates the checked-in ABI after a contract build. The Foundry runner preserves exit codes that the upstream npm wrapper currently drops.

The fixture is `reference/fixtures.json`: revision 0 → tile 31 → `0xd05b827900a`; revision 1 → tile 38 → `0xd45b827900a`. These are deterministic expectations, not deployment evidence.

## Sepolia setup

```sh
node scripts/setup-wallets.mjs
node scripts/sepolia.mjs balance
# After funding the generated test wallets:
node scripts/sepolia.mjs deploy
node scripts/sepolia.mjs verify
npm run dev
```

The two generated wallets are stored in `.local/sepolia-wallets.json`, with directory mode 700 and file mode 600, and are excluded from Git. They are **throwaway testnet wallets**. Keys are plaintext local operator secrets; protect the machine and never use them for mainnet. They never enter the Vite bundle, and the development server denies requests into `.local/`. Re-running setup preserves the wallets. The deploy script checks the network, records the intended nonce before broadcast, and resumes a recorded deployment instead of silently deploying again. A lost hash requires explicit recovery from wallet/explorer evidence.

Fund wallet A and B with **Arbitrum Sepolia ETH**, chain ID **421614**. Arbitrum's [chain information and faucet list](https://docs.arbitrum.io/chain-info#faucet-list) identifies public RPCs and faucets. The checked faucet requires address eligibility/BringID verification; obtaining test ETH can require a human wallet/login step. No funds have been acquired automatically. Public wallet addresses are in [release evidence](docs/release-evidence.md).

Public frontend config is documented in `.env.example`: RPC, contract address, deployment block, and local-environment flag. Deployment writes `.env.local`. Never put private keys into `VITE_*` variables. Source verification uses Blockscout; confirm the explorer visibly reports success and record the link before marking the gate complete. An Arbiscan verification can additionally use the operator's own Etherscan API key through Foundry.

For a CLI fixture rehearsal on a fresh deployment, `node scripts/sepolia.mjs fixture-demo` submits both canonical edits with the generated wallets and records receipts. **This does not replace the required browser-wallet demonstration.** For the release video, import the throwaway A/B keys locally into two separate wallet/browser profiles and perform both runs through the UI on a fresh deployment. Never record the import, keys, or seed phrases.

## Recovery and integrity

React owns the run, edit draft, and fixed commit attempt; Phaser renders and captures focused keyboard input. Polling updates the live dungeon without replacing a run snapshot. The client simulates and estimates gas before showing a separate Sign and submit action, then repeats state/account/network checks before requesting the signature.

An origin/profile/deployment-scoped Web Lock protects the durable local journal across all accounts and tabs. The journal is saved before signing. A known hash stays tracked in memory if a later storage write fails. Pending, unknown, and syncing attempts lock edits, Restart, Play latest, and new commits. Retry status and manual hash recovery perform reads only. Recovery requires the original returned hash or a previously observed original sender/nonce. A requested nonce is recorded for diagnostics, but is not proof of the broadcast nonce: wallets may change it. Matching payload alone, including after a lost response before any original hash/linkage is known, leaves the attempt unresolved. Retain wallet/explorer evidence; the app does not guess to unlock an ambiguous attempt.

Confirmation verifies the captured sender, contract, transaction, event revision/tile/wall mask/direction of change, canonical receipt block, and separately read live state. A contribution can create revision N even when another mutation has already created N+1 in the same block. Terminal inclusions are rechecked; a reorg withdraws success and orphaned history, and reopens the related attempt. RPC failure blocks fresh commits without claiming a reorg. Cached success is revalidated after reload. Clearing site data removes the recovery guarantee.

Speed-up observation can reuse previously verified original transaction metadata if the RPC stops returning that original hash. This supplies historical nonce evidence only; receipts and canonical inclusion are always checked afresh. A replacement mined before the observer's first available block can require **Recover with transaction hash**. Automatic discovery of every historical replacement is not guaranteed.

The contract has no owner, proxy, admin mutation, external call, asset custody, payable function, or token approval. Its bounded path/BFS checks preserve one-bit edits, open endpoints, 49-bit masks, and solvability. This is not an independent security audit.

## Limitations and credits

Testnet only. No tokens, NFTs, or monetary rewards. Public solutions can be reused; scripts can solve the puzzle. Wallet addresses do not establish unique humans or manual play. UI confirmation does not mean Ethereum L1 finality. Mobile layout supports spectators; touch controls are deferred. No authoritative game backend or PII analytics is used. Business and retention hypotheses remain unvalidated.

MIT-licensed project code; geometric dungeon artwork is original code. React, Phaser, viem, wagmi, Vite, Vitest, Playwright, and Foundry retain their respective upstream licenses. Typography uses Google Fonts DM Sans and Space Grotesk (SIL Open Font License), with system fallbacks.

Prior work: the PRD, ADRs, glossary, interface, and fixtures existed before this implementation; the application, contract, and executable harness were added for issue [#1](https://github.com/Kurisu-Labs/ruin-relay/issues/1). Record the actual development window and completed release evidence before submission. Product demo target: ≤3 minutes; separate presentation target: 2–3 minutes. Check current competition rules before submitting.

Draft English recording plans are provided for the [product demo](docs/demo-script.md) and [presentation](docs/presentation.md). They require actual Sepolia evidence before recording.
