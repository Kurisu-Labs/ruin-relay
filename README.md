# Ruin Relay

**Escape the dungeon. Change one tile. Challenge everyone after you.**

A browser puzzle with one shared 7×7 dungeon. Play locally without a wallet using keyboard, mouse, or the touch D-pad; a valid escape lets you toggle one allowed tile through a single Solidity transaction. The contract verifies the path against the old dungeon and checks that the new dungeon still has an escape route.

The application and local test harness are implemented. The upstream Arbitrum Sepolia acceptance contract is deployed at `0xf1ee7e1D9814E0ac2ddC3dd180a58f9698cc0d79` and Sourcify-verified (`exact_match`, chain 421614). The canonical two-wallet sequence is verified through revision 2, and the operator confirmed separate profiles. The operator deferred hackathon recordings on 11 October 2026 to prioritize product development and correctness. See [product validation](docs/product-validation.md) for the current technical review; hackathon materials remain tracked separately in [#13](https://github.com/Kurisu-Labs/ruin-relay/issues/13). The prior live contract is already revision 3; its receipts and the separate CLI rehearsal remain historical evidence. See the [completion checklist](docs/release-evidence.md#issue-1-completion-checklist) and [deployment evidence](docs/release-evidence.md#fresh-acceptance-deployment--11-october-2026).

The game in this branch uses **Three.js only**. Play opens the first-person dungeon at `/play`; `/play/3d` remains a compatible link. The committed 2D baseline is preserved in [`feat/phaser4-dungeon`](https://github.com/Kurisu-Labs/ruin-relay/tree/feat/phaser4-dungeon). The latest uncommitted 2D snapshot is also backed up locally; see [renderer migration and recovery](gameplan/RENDERER_MIGRATION.md).

The public-chain evidence above belongs to the upstream acceptance run. Validation of this 3D presentation is tracked separately in the migration record; it does not claim that the 3D UI performed those historical transactions.

## Run locally

Use Node.js 22.12+ and npm (checked with Node 22.23.3). The lockfile pins React, Three.js 0.186.1, viem/wagmi, Vite, Foundry 1.7.1, and the test tools. Foundry downloads Solidity 0.8.24 on first use.

For a quick visual preview without a wallet or local blockchain:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/ for the landing page, then choose **Play without a wallet**. The `/play` route opens the first-person 3D dungeon and fills the browser viewport by default. Play, Home, Resume, and browser Back/Forward switch views within the same document, retaining the run, selected edit, and any transaction in progress. A full reload still follows the existing journal recovery rules; an ordinary unfinished run is held in memory. The optional **Fullscreen** button hides browser controls when supported. History and instructions open in an in-game dialog; Escape or **Back to game** closes it.

The landing page uses a lightweight CSS illustration. Hovering, focusing, or touching a Play link warms the shared engine import; no canvas or GPU resources are created until entering the game. Speculative loading is skipped when the browser reports data-saving or a slow connection.

Three.js is the only game renderer. The former `/play/3d` URL redirects in place to `/play`, preserving query and fragment. Only one canvas exists at a time. WebGL 2 is required; loading or graphics failures offer Retry while Home remains available. The retired 2D implementation can be recovered from its Git history or the verified local snapshot; see [migration and recovery](gameplan/RENDERER_MIGRATION.md).

In **3D**, W/↑ steps forward, S/↓ steps backward, A/← and D/→ sidestep left/right without turning, and Q/E turn 90° left/right. The six matching buttons support mouse and touch. Turning costs no steps; the starting direction is south. Restart or re-entering the 3D view resets the heading. Movement still uses the canonical four-direction grid, with no automatic walking or pointer lock. After EXIT, the ceiling opens and an overhead map appears alongside the existing one-tile editor. Reduced motion removes camera interpolation and torch flicker. Original procedural artwork includes recessed stone reliefs, vaulted ribs, weathered banners, roots, ivy, detailed sconces and a stone EXIT arch with inset glyphs. Editable walls keep ordinary stone courses. The experience adds no enemies, combat, loot or inventory. See [3D scope, provenance and validation](gameplan/THREE_DUNGEON.md).

**Home** in the bottom game dock returns to the landing page. The dock also holds direction buttons, Restart, History, Fullscreen, Menu, Play latest, Refresh, and Settings. Settings contains sound, reduced motion and tile numbers. All six movement and turn buttons have matching square targets. The canvas has its own space above the dock so controls cannot cover the dungeon or editable tiles.

Without active deployment metadata this uses the practice seed; no transaction can be submitted. Each click or tap performs one step or turn. Keyboard controls apply while the dungeon has focus. The full map and edit panel open after reaching EXIT. Sound is off by default; reduced motion follows the operating system unless overridden. Tile numbers are optional, and the DOM tile editor remains available after escape.

After EXIT, select a highlighted **floor** to preview a wall, or a highlighted **wall** to preview floor. Dim tiles are fixed. Exactly one tile can change and an escape route must remain. The preview is not saved until a transaction is confirmed. **Commit one change** connects the wallet and prepares a review; **Sign and submit edit** is a separate action. The explanation below Commit identifies why it is disabled. Practice mode supports previews only; connecting a wallet does not enable saving on a practice board.

For the full local blockchain rehearsal and browser tests:

```sh
npm ci
npx playwright install chromium
npm run local
```

Open http://127.0.0.1:4173/play. This command starts a fresh Anvil chain with ID 421614, deploys the canonical seed, and starts Vite with the deployment metadata. Stop it with Ctrl+C. Local chain state is disposable. The UI labels this environment **Local Anvil** and does not present its hashes as public Sepolia transactions.

For frontend work without Anvil, `npm run dev` serves the practice seed when deployment metadata is absent. Practice has no live-chain or commit claims. `npm run build` generates the static site in `dist/` and inlines public `VITE_*` variables from the environment present at build time. `vercel.json` pins the verified acceptance address/block and `VITE_LOCAL=false` in its build command, publishes `dist`, and rewrites `/play`, `/history`, `/about`, and every other path to `/index.html`. Vercel serves files that already exist in `dist` before those rewrites, so hashed assets stay assets.

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

Wallet A’s real [Sepolia mutation](https://sepolia.arbiscan.io/tx/0xd2657acdce42c3b8560f757c1aa7a275ae55b412a74b87fbaa6729b82fa20521) is verified: tile 31, revision 0 → 1, walls `0xd05b827900a`, 110473 gas. [Decoded receipt and state evidence](docs/acceptance-mutation-a.json) are recorded. Wallet B’s real [Sepolia mutation](https://sepolia.arbiscan.io/tx/0x08647c14c04e4c3732c2641664f301261977cffd3abe52e12d4bc08627b0c16f) is also verified: tile 38, revision 1 → 2, walls `0xd45b827900a`, 109803 gas. [Decoded B evidence](docs/acceptance-mutation-b.json) records the receipt and the operator’s confirmation of separate profiles. Complete release recordings remain pending.

## Sepolia setup

To connect the frontend to the existing official deployment, copy `.env.example` to `.env.local` and start or restart `npm run dev`. The header should show **Arbitrum Sepolia**. After escaping, select a valid editable tile and choose **Commit one change** to connect the wallet and review the transaction. The wallet needs Arbitrum Sepolia test ETH for gas; **Sign and submit edit** sends the transaction after review.

For an operator deploying a new contract, the CLI commands below use generated local wallets. The operator-provided Firefox acceptance wallets and their verified funding are recorded in [release evidence](docs/release-evidence.md#prepared-acceptance-wallets); those signing requests require operator interaction.

```sh
node scripts/setup-wallets.mjs
node scripts/sepolia.mjs balance
# After funding the generated test wallets:
node scripts/sepolia.mjs deploy
node scripts/sepolia.mjs verify
npm run dev
```

For a wallet already installed in Firefox, run the local operator helper with its public address:

```sh
node scripts/browser-deploy.mjs --account 0x37714b787066ce967d027B752D045e13b8b64A84
```

Open `http://127.0.0.1:4174/` in that Firefox profile. Connect, estimate, and deliberately approve the deployment in the wallet. The helper checks the account and chain, refreshes an EIP-1559 cap of twice the latest base fee plus priority immediately before signing, and saves the intent before requesting a signature. It never reads wallet keys or automatically resubmits. Keep the returned hash for receipt/source verification.

If the operator confirmed that an earlier request failed with a fee-below-base-fee rejection and no pending transaction, the known rejected nonce can enable a separate read-only recovery action:

```sh
node scripts/browser-deploy.mjs --account 0x37714b787066ce967d027B752D045e13b8b64A84 --recover-rejected-nonce 0
```

Startup and the manual **Reset rejected fee request** action both require that nonce to remain unused at `latest` and `pending`. Reset archives the failed intent and sends no transaction. It applies to the confirmed legacy rejection or a recorded fee rejection; a new unknown signing request or known hash stays locked. Re-estimate and sign only as a separate deliberate action. This is an operator-only localhost tool, separate from the game.

The two generated wallets are stored in `.local/sepolia-wallets.json`, with directory mode 700 and file mode 600, and are excluded from Git. They are **throwaway testnet wallets**. Keys are plaintext local operator secrets; protect the machine and never use them for mainnet. They never enter the Vite bundle, and the development server denies requests into `.local/`. Re-running setup preserves the wallets. The deploy script checks the network, records the intended nonce before broadcast, and resumes a recorded deployment instead of silently deploying again. A lost hash requires explicit recovery from wallet/explorer evidence.

Fund wallet A and B with **Arbitrum Sepolia ETH**, chain ID **421614**, before a new deploy or browser mutation. Arbitrum's [chain information and faucet list](https://docs.arbitrum.io/chain-info#faucet-list) identifies public RPCs and faucets. The checked faucet requires address eligibility/BringID verification; obtaining test ETH can require a human wallet/login step. Public wallet addresses and the recorded deployment are in [release evidence](docs/release-evidence.md).

Public frontend config is documented in `.env.example`: RPC, acceptance contract `0xf1ee7e1D9814E0ac2ddC3dd180a58f9698cc0d79`, deployment block `317967651`, and local-environment flag. Deployment writes `.env.local`. Never put private keys into `VITE_*` variables. `node scripts/sepolia.mjs verify` submits the artifact to Sourcify. Blockscout's Arbitrum Sepolia API is blocked by Cloudflare. An Arbiscan verification can additionally use the operator's own Etherscan API key through Foundry.

For a CLI fixture rehearsal on a fresh deployment, `node scripts/sepolia.mjs fixture-demo` submits both canonical edits with the generated wallets and records receipts. **This does not replace the required browser-wallet demonstration.** One such rehearsal already ran on contract `0x57b7461dc06dda9e11159c0e75306e1655545a64` and is labeled rehearsal in the release evidence. For the release video, import the throwaway A/B keys locally into two separate wallet/browser profiles and perform both runs through the UI on a fresh canonical acceptance deployment. Never record the import, keys, or seed phrases.

## Recovery and integrity

React/Relay owns the run, edit draft, and fixed commit attempt; the Three.js renderer presents that snapshot; its React host captures focused keyboard intent synchronously. Animation never delays accepted domain moves. Polling updates the live dungeon without replacing a run snapshot. The client simulates and estimates gas before showing a separate Sign and submit action, then repeats state/account/network checks before requesting the signature.

An origin/profile/deployment-scoped Web Lock protects the durable local journal across all accounts and tabs. The journal is saved before signing. A known hash stays tracked in memory if a later storage write fails. Pending, unknown, and syncing attempts lock edits, Restart, Play latest, and new commits. History, status reads, and Recover with transaction hash stay available. Retry status and manual hash recovery perform reads only. Recovery of a supplied hash requires the original returned hash or a previously observed original sender and nonce. A requested nonce is recorded for diagnostics, but is not proof of the broadcast nonce: wallets may change it. Matching payload alone does not link a different hash. Before the signing request, the journal also records the account's pending and latest nonce. On load and on Retry status, a hashless unresolved attempt can end from chain evidence alone. A failed nonce or log read leaves it locked. Retain wallet/explorer evidence; the app does not guess from a timeout or a lost response.

The commit transaction sets `maxFeePerGas` to at least twice the latest base fee plus the priority fee, instead of leaving the cap to the wallet. A wallet or node error that proves the transaction was not accepted — user rejection, fee below base fee, insufficient funds, nonce too high, underpriced, intrinsic gas, or a simulation revert — ends the attempt, drops the lock, and restores the run and edit. A timeout, a lost response, "already known", "nonce too low"/already-used nonce, or an internal error with no rejection reason is not itself proof of non-broadcast. A canonical reverted receipt for the attempt's own transaction is also terminal: a moved revision is explained as a stale race, and any other revert is explained without claiming a mutation. The wrong-network prompt is only for an explicit chain mismatch. A viem error that mentions `chain:` in its request arguments is not a chain mismatch.

A hashless unresolved attempt is released only by those reads. `completeAndMutate` checks `expectedRevision`, so the contract accepts at most one mutation per revision. If the live revision is already past the attempt's snapshot, that attempt can no longer mutate. A canonical `DungeonMutated` event at snapshot+1 whose editor, tile, walls, and transaction match the attempt is confirmed through the normal receipt check. Any other canonical event at that revision ends the attempt and restores the run: the earlier commit was never applied, and Play latest starts the new revision. If the live revision is unchanged, the attempt is treated as never sent only when the account's pending nonce equals its latest nonce, any nonce recorded before signing is still the latest nonce, and no `DungeonMutated` event exists for snapshot+1. An open wallet prompt in another tab holds a document lock, so that equality is not proof while the prompt is still open. Older journals have no recorded nonce; those use pending equal to latest and the missing event. The journal does not store the attempt's creation time, so the app does not scan for an included transaction after that time. The worst case after this release is that a late copy lands and reverts `StaleRevision`, which a canonical reverted receipt already ends as a proven outcome.

Confirmation verifies the captured sender, contract, transaction, event revision/tile/wall mask/direction of change, canonical receipt block, and separately read live state. A contribution can create revision N even when another mutation has already created N+1 in the same block. Terminal inclusions are rechecked; a reorg withdraws success and orphaned history, and reopens the related attempt. RPC failure blocks fresh commits without claiming a reorg. Cached success is revalidated after reload. Clearing site data removes the recovery guarantee.

Speed-up observation can reuse previously verified original transaction metadata if the RPC stops returning that original hash. This supplies historical nonce evidence only; receipts and canonical inclusion are always checked afresh. A replacement mined before the observer's first available block can require **Recover with transaction hash**. Automatic discovery of every historical replacement is not guaranteed.

The contract has no owner, proxy, admin mutation, external call, asset custody, payable function, or token approval. Its bounded path/BFS checks preserve one-bit edits, open endpoints, 49-bit masks, and solvability. This is not an independent security audit.

## Limitations and credits

Testnet only. No tokens, NFTs, or monetary rewards. Public solutions can be reused; scripts can solve the puzzle. Wallet addresses do not establish unique humans or manual play. UI confirmation does not mean Ethereum L1 finality. Responsive mouse/touch controls are implemented; build, contract and unit checks passed; integrated 3D browser validation remains pending (see [validation evidence](gameplan/THREEJS_RELEASE_CHECK.md)). Real-device mobile FPS has not been measured. Browser fullscreen depends on browser support; the viewport layout works without it. No authoritative game backend or PII analytics is used. Business and retention hypotheses remain unvalidated.

MIT-licensed project code and original procedural dungeon artwork. The stonework, banners, sconces, roots, textures and EXIT arch are generated in [`src/game3d/world.ts`](src/game3d/world.ts); [asset provenance](src/game3d/README.md) describes their construction. No Keep Out models, textures, audio or code are included. Three.js retains its [MIT license notice](public/assets/game3d/THREE-LICENSE.txt). React, viem, wagmi, Vite, Vitest, Playwright and Foundry retain their upstream licenses. Typography uses Google Fonts DM Sans and Space Grotesk (SIL Open Font License), with system fallbacks. Earlier Phaser plans and validation remain in `gameplan/` as history; their assets are no longer shipped.

Prior work: the PRD, ADRs, glossary, interface, and fixtures existed before this implementation; the application, contract, and executable harness were added for issue [#1](https://github.com/Kurisu-Labs/ruin-relay/issues/1). Record the actual development window and completed release evidence before submission. Product demo target: ≤3 minutes; separate presentation target: 2–3 minutes. Check current competition rules before submitting.

Draft English recording plans are provided for the [product demo](docs/demo-script.md) and [presentation](docs/presentation.md). They require actual Sepolia evidence before recording.
