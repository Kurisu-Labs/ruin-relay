# Ruin Relay

**Escape the dungeon. Change one tile. Challenge everyone after you.**

A desktop browser puzzle with one shared 7×7 dungeon. Play locally without a wallet; a valid escape lets you toggle one allowed tile through a single Solidity transaction. The contract verifies the path against the old dungeon and checks that the new dungeon still has an escape route.

The application and local test harness are implemented. The official Arbitrum Sepolia contract is deployed and Sourcify-verified (`exact_match`, chain 421614). **The Sepolia release gate is pending:** browser-wallet mutations on that official contract, and the release videos, are still outstanding. A separate rehearsal copy is recorded only as rehearsal. See [release evidence](docs/release-evidence.md).

## Run locally

Use Node.js 22.12+ (tested with 26.11.1) and npm. The lockfile pins React, Phaser 3, viem/wagmi, Vite, Foundry 1.7.1, and the test tools. Foundry downloads Solidity 0.8.24 on first use.

```sh
npm ci
npx playwright install chromium
npm run local
```

Open http://127.0.0.1:4173/play. This command starts a fresh Anvil chain with ID 421614, deploys the canonical seed, and starts Vite with the deployment metadata. Stop it with Ctrl+C. Local chain state is disposable. The UI labels this environment **Local Anvil** and does not present its hashes as public Sepolia transactions.

For frontend work without Anvil, `npm run dev` serves the practice seed when deployment metadata is absent. Practice has no live-chain or commit claims. `npm run build` generates the static site in `dist/` and inlines public `VITE_*` variables from the environment present at build time. `vercel.json` runs that command, publishes `dist`, and rewrites `/play`, `/history`, `/about`, and every other path to `/index.html`. Vercel serves files that already exist in `dist` before those rewrites, so hashed assets stay assets.

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

Fund wallet A and B with **Arbitrum Sepolia ETH**, chain ID **421614**, before a new deploy or browser mutation. Arbitrum's [chain information and faucet list](https://docs.arbitrum.io/chain-info#faucet-list) identifies public RPCs and faucets. The checked faucet requires address eligibility/BringID verification; obtaining test ETH can require a human wallet/login step. Public wallet addresses and the recorded deployment are in [release evidence](docs/release-evidence.md).

Public frontend config is documented in `.env.example`: RPC, official contract `0xDaFc851910D91D54916349EECB8d320a5a56b988`, deployment block `317783571`, and local-environment flag. Deployment writes `.env.local`. Never put private keys into `VITE_*` variables. `node scripts/sepolia.mjs verify` submits the artifact to Sourcify. Blockscout's Arbitrum Sepolia API is blocked by Cloudflare. An Arbiscan verification can additionally use the operator's own Etherscan API key through Foundry.

For a CLI fixture rehearsal on a fresh deployment, `node scripts/sepolia.mjs fixture-demo` submits both canonical edits with the generated wallets and records receipts. **This does not replace the required browser-wallet demonstration.** One such rehearsal already ran on contract `0x57b7461dc06dda9e11159c0e75306e1655545a64` and is labeled rehearsal in the release evidence. For the release video, import the throwaway A/B keys locally into two separate wallet/browser profiles and perform both runs through the UI on the official deployment. Never record the import, keys, or seed phrases.

## Recovery and integrity

React owns the run, edit draft, and fixed commit attempt; Phaser renders and captures focused keyboard input. Polling updates the live dungeon without replacing a run snapshot. The client simulates and estimates gas before showing a separate Sign and submit action, then repeats state/account/network checks before requesting the signature.

An origin/profile/deployment-scoped Web Lock protects the durable local journal across all accounts and tabs. The journal is saved before signing. A known hash stays tracked in memory if a later storage write fails. Pending, unknown, and syncing attempts lock edits, Restart, Play latest, and new commits. History, status reads, and Recover with transaction hash stay available. Retry status and manual hash recovery perform reads only. Recovery of a supplied hash requires the original returned hash or a previously observed original sender and nonce. A requested nonce is recorded for diagnostics, but is not proof of the broadcast nonce: wallets may change it. Matching payload alone does not link a different hash. Before the signing request, the journal also records the account's pending and latest nonce. On load and on Retry status, a hashless unresolved attempt can end from chain evidence alone. A failed nonce or log read leaves it locked. Retain wallet/explorer evidence; the app does not guess from a timeout or a lost response.

The commit transaction sets `maxFeePerGas` to at least twice the latest base fee plus the priority fee, instead of leaving the cap to the wallet. A wallet or node error that proves the transaction was not accepted — user rejection, fee below base fee, insufficient funds, nonce too low or too high, underpriced, intrinsic gas, or a simulation revert — ends the attempt, drops the lock, and restores the run and edit. A timeout, a lost response, "already known", or an internal error with no rejection reason is not itself proof of non-broadcast. A canonical reverted receipt for the attempt's own transaction is also terminal: a moved revision is explained as a stale race, and any other revert is explained without claiming a mutation. The wrong-network prompt is only for an explicit chain mismatch. A viem error that mentions `chain:` in its request arguments is not a chain mismatch.

A hashless unresolved attempt is released only by those reads. `completeAndMutate` checks `expectedRevision`, so the contract accepts at most one mutation per revision. If the live revision is already past the attempt's snapshot, that attempt can no longer mutate. A canonical `DungeonMutated` event at snapshot+1 whose editor, tile, walls, and transaction match the attempt is confirmed through the normal receipt check. Any other canonical event at that revision ends the attempt and restores the run: the earlier commit was never applied, and Play latest starts the new revision. If the live revision is unchanged, the attempt is treated as never sent only when the account's pending nonce equals its latest nonce, any nonce recorded before signing is still the latest nonce, and no `DungeonMutated` event exists for snapshot+1. An open wallet prompt in another tab holds a document lock, so that equality is not proof while the prompt is still open. Older journals have no recorded nonce; those use pending equal to latest and the missing event. The journal does not store the attempt's creation time, so the app does not scan for an included transaction after that time. The worst case after this release is that a late copy lands and reverts `StaleRevision`, which a canonical reverted receipt already ends as a proven outcome.

Confirmation verifies the captured sender, contract, transaction, event revision/tile/wall mask/direction of change, canonical receipt block, and separately read live state. A contribution can create revision N even when another mutation has already created N+1 in the same block. Terminal inclusions are rechecked; a reorg withdraws success and orphaned history, and reopens the related attempt. RPC failure blocks fresh commits without claiming a reorg. Cached success is revalidated after reload. Clearing site data removes the recovery guarantee.

Speed-up observation can reuse previously verified original transaction metadata if the RPC stops returning that original hash. This supplies historical nonce evidence only; receipts and canonical inclusion are always checked afresh. A replacement mined before the observer's first available block can require **Recover with transaction hash**. Automatic discovery of every historical replacement is not guaranteed.

The contract has no owner, proxy, admin mutation, external call, asset custody, payable function, or token approval. Its bounded path/BFS checks preserve one-bit edits, open endpoints, 49-bit masks, and solvability. This is not an independent security audit.

## Limitations and credits

Testnet only. No tokens, NFTs, or monetary rewards. Public solutions can be reused; scripts can solve the puzzle. Wallet addresses do not establish unique humans or manual play. UI confirmation does not mean Ethereum L1 finality. Mobile layout supports spectators; touch controls are deferred. No authoritative game backend or PII analytics is used. Business and retention hypotheses remain unvalidated.

MIT-licensed project code; geometric dungeon artwork is original code. React, Phaser, viem, wagmi, Vite, Vitest, Playwright, and Foundry retain their respective upstream licenses. Typography uses Google Fonts DM Sans and Space Grotesk (SIL Open Font License), with system fallbacks.

Prior work: the PRD, ADRs, glossary, interface, and fixtures existed before this implementation; the application, contract, and executable harness were added for issue [#1](https://github.com/Kurisu-Labs/ruin-relay/issues/1). Record the actual development window and completed release evidence before submission. Product demo target: ≤3 minutes; separate presentation target: 1–3 minutes. Check current competition rules before submitting.

Draft English recording plans are provided for the [product demo](docs/demo-script.md) and [presentation](docs/presentation.md). They require actual Sepolia evidence before recording.
