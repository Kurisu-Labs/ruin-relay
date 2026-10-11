# Release evidence

Status: local implementation, automated checks, and code review completed. The fresh acceptance contract is deployed and Sourcify-verified. The required two-wallet browser sequence and release recordings remain **pending**.

## Issue #1 completion checklist

The latest contributor implementation is on `main` at `08e01b5`; PRs #15, #16, and #17 are merged. This release follow-up tracks the remaining acceptance evidence for [issue #1](https://github.com/Kurisu-Labs/ruin-relay/issues/1).

- [x] Implement the contract, wallet-free game, fixed run snapshots, edit drafts, durable commit attempts, recovery, and public history.
- [x] Record local contract, rules, browser, build, and formatting validation, and address the code-review findings.
- [x] Fund both selected release wallets with Arbitrum Sepolia ETH and verify their balances on chain ID 421614.
- [x] Independently verify the contributor deployment, canonical receipts, and Sourcify exact source match.
- [x] Approve a fresh acceptance deployment from wallet A in Firefox: `0x793c8ad958d6768533bd42412b69173c6b96b3d36a67861462113d04330cbc3b`.
- [x] Verify the fresh canonical dungeon and record the address, deployment block/hash, compiler settings, and successful public source/ABI verification.
- [ ] In browser profile A, submit tile 31 from revision 0 and record its real receipt, explorer link, and resulting walls `0xd05b827900a`.
- [ ] In separate browser profile B, submit tile 38 against the same deployment at revision 1 and record its real receipt, explorer link, and resulting walls `0xd45b827900a`.
- [ ] Record gas used for deployment and both real mutations, plus visible board changes and public history.
- [ ] Include a safety-rejection demonstration and the keyboard/mobile inspection evidence in the release materials.
- [ ] Record the English product demo (at most three minutes) and separate presentation (two to three minutes).

Keep issue #1 open until the unchecked release requirements have verifiable evidence. Keep the release PR in draft while these gates are pending. Local Anvil hashes, a CLI rehearsal, and recording scripts do not satisfy the real two-profile browser demonstration. The commands and canonical routes are documented below and in the README.

## Public test-wallet setup

### Prepared acceptance wallets

Provided by the operator on 10 October 2026 (Asia/Jakarta). Funding was verified at 23:30:01 WIB on chain 421614, block `317791963`, hash `0x69a78fd952457622c9d28a33eab2890997027776a8b0292a3c6bec0558bc07e2`:

| Purpose             | Address                                      | Test ETH |
| ------------------- | -------------------------------------------- | -------- |
| Deployer / player A | `0x37714b787066ce967d027B752D045e13b8b64A84` | 0.05     |
| Player B            | `0x4Cc38D7C18C0EB53662d2D3FA382C3a82B2e7ad9` | 0.05     |

The operator reports an existing Firefox wallet extension. Firefox is unavailable through this session's browser-control connection, so wallet approvals require operator interaction. The real A/B demonstration requires separate Firefox profiles. Funding is complete; deployment signing is pending. The CLI signer remains configured for the generated local wallets. These addresses and balances are not deployment or mutation evidence.

| Purpose             | Address                                      |
| ------------------- | -------------------------------------------- |
| Deployer / player A | `0x39A2862c0c8A1feF97644960F873B8cBa7f58dAa` |
| Player B            | `0x9Bd92C5A3A164c6488bbBff842F9500b4DA47b7a` |

Local private keys are excluded from Git and blocked by the development server. Wallet A deployed the official contract. Wallet B is the second public testnet account for the pending browser gate.

## Fresh acceptance deployment — 11 October 2026

Wallet A deployed the new canonical dungeon through its Firefox wallet. Receipt, sender, nonce, creation bytecode/constructor, creation address, canonical block hash, and initial state were independently checked. Source verification was already available through Sourcify v2 and was confirmed read-only, with exact matches to both repository source files.

| Field                  | Evidence                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain                  | Arbitrum Sepolia, 421614                                                                                                                                                  |
| Contract               | [`0xf1ee7e1d9814e0ac2ddc3dd180a58f9698cc0d79`](https://sepolia.arbiscan.io/address/0xf1ee7e1d9814e0ac2ddc3dd180a58f9698cc0d79)                                            |
| Deployment transaction | [`0x793c8ad958d6768533bd42412b69173c6b96b3d36a67861462113d04330cbc3b`](https://sepolia.arbiscan.io/tx/0x793c8ad958d6768533bd42412b69173c6b96b3d36a67861462113d04330cbc3b) |
| Deployer / nonce       | `0x37714b787066ce967d027b752d045e13b8b64a84` / 0                                                                                                                          |
| Deployment block       | 317967651                                                                                                                                                                 |
| Gas used               | 602912                                                                                                                                                                    |
| Initial state          | revision 0; walls `0xd053827900a`; editable mask `0x1f9e7e1cf00`                                                                                                          |
| Compiler               | Solidity 0.8.24, optimizer 200, Cancun                                                                                                                                    |
| Source verification    | [Sourcify](https://repo.sourcify.dev/421614/0xf1ee7e1d9814e0ac2ddc3dd180a58f9698cc0d79): creation/runtime `exact_match`                                                   |
| Receipt/source proof   | [acceptance-deployment.json](acceptance-deployment.json)                                                                                                                  |

The browser A/B acceptance sequence uses this address. `.env.example` and the Vercel build command pin the same address/block; the older contributor contract remains historical evidence below. A verified deployment alone does not complete the two-profile mutation or recording gates.

## Previous contributor deployment

Chain 421614 (Arbitrum Sepolia).

| Field                  | Evidence                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract               | [`0xDaFc851910D91D54916349EECB8d320a5a56b988`](https://sepolia.arbiscan.io/address/0xDaFc851910D91D54916349EECB8d320a5a56b988)                                                                                                               |
| Deployment transaction | [`0xaf9a8e77b68c1b9d9e1952abab04fdc2584ac1b56bc2c0c3169f128fc4b87d1d`](https://sepolia.arbiscan.io/tx/0xaf9a8e77b68c1b9d9e1952abab04fdc2584ac1b56bc2c0c3169f128fc4b87d1d)                                                                    |
| Deployment block       | 317783571                                                                                                                                                                                                                                    |
| Deployer               | `0x39A2862c0c8A1feF97644960F873B8cBa7f58dAa`                                                                                                                                                                                                 |
| Source verification    | Sourcify `exact_match`, chain 421614 ([Sourcify contract](https://repo.sourcify.dev/421614/0xDaFc851910D91D54916349EECB8d320a5a56b988), [v2 API](https://sourcify.dev/server/v2/contract/421614/0xDaFc851910D91D54916349EECB8d320a5a56b988)) |

The required two-wallet browser acceptance sequence remains pending; the live mutations audited below already advanced this contract to revision 3. `scripts/sepolia.mjs` previously sent verification to Blockscout at `https://arbitrum-sepolia.blockscout.com/api/`. Cloudflare blocks that API. The match above is the Sourcify result, and `verify` now uses Foundry's Sourcify verifier.

## Independent contributor audit — 11 October 2026

The public RPC confirmed the official deployment receipt as successful and canonical: block 317783571, 602,912 gas. Sourcify v2 reports both creation and runtime `exact_match`, Solidity `0.8.24+commit.e11b9ed9`, optimizer 200, Cancun. The old `/contracts/full_match/.../metadata.json` URL returns 404; the current lookup is the v2 API linked above.

At 11:35:37 WIB, the live dungeon was revision **3**, walls `0xc05f827900a`, with the canonical editable mask `0x1f9e7e1cf00`. All three current mutations have successful canonical receipts and the same editor, `0x072483f4c3208a4115e8263358FC71c79Cd9D86D`:

| Revision | Tile | Walls           | Gas used | Transaction                                                                                                                                                               |
| -------- | ---- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | 31   | `0xd05b827900a` | 110473   | [`0xd46006bf58dd6603aa1f1ca4c6a25fe835ba0b26e679596f39eb9c723c737ee6`](https://sepolia.arbiscan.io/tx/0xd46006bf58dd6603aa1f1ca4c6a25fe835ba0b26e679596f39eb9c723c737ee6) |
| 2        | 40   | `0xc05b827900a` | 97567    | [`0x6a08095397a41a221789e7c28d5a512ae6bccd9083c9c938ac20c3860ced0cf9`](https://sepolia.arbiscan.io/tx/0x6a08095397a41a221789e7c28d5a512ae6bccd9083c9c938ac20c3860ced0cf9) |
| 3        | 30   | `0xc05f827900a` | 94173    | [`0xd6fb25ebfa272876b5e1532d3502bebd5850efcd41e38f5110951e455e77907b`](https://sepolia.arbiscan.io/tx/0xd6fb25ebfa272876b5e1532d3502bebd5850efcd41e38f5110951e455e77907b) |

The [machine-readable audit](official-chain-audit.json) retains transaction inputs, senders, inclusion blocks/hashes, events, and gas. The required separate-profile, two-wallet, tile 31 → tile 38 sequence on a fresh deployment remains pending. Existing live revisions cannot be reset; the prepared acceptance wallets must use a fresh canonical deployment for that sequence. Browser-profile provenance and release videos cannot be inferred from chain receipts.

### Firefox operator helper

The first local helper delegated fee selection to the wallet. A deterministic browser replay reproduced the reported rejection (`maxFeePerGas: 39042000`, `baseFee: 39186000`). The maintained helper now sends explicit buffered EIP-1559 caps, refreshed immediately before signing. It does not depend on the earlier gas-price quote. The operator confirmed the failed deployment had no pending wallet transaction; nonce 0 was also unused at both `latest` and `pending` when checked.

Nine focused operator-browser regressions passed on 11 October 2026: stale/rising base fees, wrong account/network, initial storage failure, hash persistence across reload, manual legacy recovery without resubmission, refusal to recover an in-flight nonce or a new unknown signing request, and private-file isolation. Wallet responses in these tests are simulated boundary responses; no real deployment is claimed by those tests. The helper and restart/recovery commands are documented in the README.

## Rehearsal copy

Measured on a separate Arbitrum Sepolia copy, [`0x57b7461dc06dda9e11159c0e75306e1655545a64`](https://sepolia.arbiscan.io/address/0x57b7461dc06dda9e11159c0e75306e1655545a64). **Label: rehearsal.** These receipts are rehearsal evidence. The browser release gate requires both mutations on the fresh acceptance deployment above.

| Step                 | Evidence                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player A, tile 31    | [`0xeb0bfc1eb368237ed9cb743919bb990532c1e0c52b78b3e76957e9f87180d219`](https://sepolia.arbiscan.io/tx/0xeb0bfc1eb368237ed9cb743919bb990532c1e0c52b78b3e76957e9f87180d219), 110,473 gas. Receipt matched revision 1 and walls `0xd05b827900a`. |
| Player B, tile 38    | [`0x961e107f0dc2b1a0b2fdc8b7957fba4715d7d286d4e5525e1245de428737a673`](https://sepolia.arbiscan.io/tx/0x961e107f0dc2b1a0b2fdc8b7957fba4715d7d286d4e5525e1245de428737a673), 109,803 gas. Receipt matched revision 2 and walls `0xd45b827900a`. |
| Tile 8 at revision 0 | `eth_call` reverted with `UnsolvableMutation`.                                                                                                                                                                                                |

## Verification record

| Field                                   | Evidence                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Source baseline                         | `bda73e4d68599aa8537088dd6985c6d126cc7e52`                                                                        |
| Original complete-suite commit          | `d087cdf1f33176ce9857910f29dc4984b0c7d9ba`                                                                        |
| Development-server guard commit         | `0d379d2912ef89fcebcc3efb18f7d4618e158032`                                                                        |
| Implementation / test date              | 10 October 2026, Asia/Jakarta; design handoff predates implementation                                             |
| Runtime                                 | Node.js 26.11.1, npm 11.20.0                                                                                      |
| Solidity compiler                       | 0.8.24, optimizer 200, Cancun                                                                                     |
| Foundry                                 | 1.7.1                                                                                                             |
| Fuzz configuration                      | 256 cases per fuzz test; 12 actions per mutation sequence                                                         |
| Typechecking / build                    | Passed; `npm test` includes typechecking, and `npm run build` passed at the guard commit                          |
| Formatting                              | Prettier, Foundry formatting, and Git whitespace checks passed                                                    |
| Rules / independent oracle              | 6 rules tests passed; independent Solidity fuzz oracle and 80 browser TS/Solidity random-mask comparisons         |
| Contract tests / gas snapshot           | 11 tests passed; [focused gas snapshot](../.gas-snapshot), with measurement limits below                          |
| Browser scenarios                       | 45 passed in the complete suite; 1 additional guard scenario passed with a repeated wallet-free escape smoke      |
| Keyboard / mobile inspection            | Agent inspected desktop WASD/R and the 375px mobile layout; separate human acceptance remains pending             |
| Screenshots                             | [Desktop](screenshots/desktop.png), [375px mobile](screenshots/mobile.png); both local Anvil                      |
| Performance benchmark                   | First-play latency and FPS not measured; build chunk-size warning recorded below                                  |
| Sepolia chain                           | 421614                                                                                                            |
| Deployed contract / source verification | Acceptance `0xf1ee7e1D9814E0ac2ddC3dd180a58f9698cc0d79`, block 317967651; Sourcify creation/runtime `exact_match` |
| Deployment transaction                  | `0x793c8ad958d6768533bd42412b69173c6b96b3d36a67861462113d04330cbc3b`                                              |
| Real UI mutation A, revision 0→1        | Pending on a fresh acceptance deployment                                                                          |
| Real UI mutation B, revision 1→2        | Pending on a fresh acceptance deployment                                                                          |
| Sepolia gas estimates / receipts        | Deployment 602,912 gas; fresh A/B browser mutation receipts pending                                               |
| Product demo ≤3 minutes                 | [English script ready](demo-script.md); recording pending                                                         |
| Presentation 2–3 minutes                | [English script ready](presentation.md); recording pending                                                        |

The [complete test log](test-results.log) records a successful `npm test` exit: 11 contract tests, 6 rules tests, and 45 browser scenarios. After adding the development-server deny rule and its regression, `npm run test:browser -- --grep 'operator files are denied|wallet-free escape'` passed both selected tests ([guard log](operator-files-test.log)). This is **46 distinct browser scenarios** across the two runs, not a claim that the complete suite was rerun with 46 tests. At the guard-test commit, application and contract source were unchanged from the complete-suite commit. The subsequent observation-helper refactor is covered by the focused validation below.

The guard test uses a harmless canary, never a private key. Both its normal URL and `/@fs/` URL returned HTTP 403. The rule preserves Vite's default deny patterns and also denies `**/.local/**`. Re-review found no concrete issue in this guard or the English recording drafts.

Local EVM gas reporting for `testGasOpenBoard96Steps|testTwoContributors` measured deployment at **602,912 gas** and `completeAndMutate` across three sampled calls at **109,803 / 144,674 / 110,473 / 213,746 gas** (minimum / mean / median / maximum). These are local samples, not Sepolia receipts or a theoretical maximum. The snapshot records whole test-function gas, including setup, so its numbers must not be presented as transaction gas. Reproduce with:

```sh
node scripts/foundry.mjs forge snapshot --root contracts --match-test 'testGasOpenBoard96Steps|testTwoContributors'
node scripts/foundry.mjs forge test --root contracts --match-test 'testGasOpenBoard96Steps|testTwoContributors' --gas-report
```

The Vite build passed with a large-chunk warning: main JavaScript 568.07 kB (174.16 kB gzip), dynamically loaded Phaser 1,196.46 kB (318.59 kB gzip). A successful build is not a latency or FPS benchmark.

Session history was split into atomic commits before publication. The complete-suite and guard-test commits above have exactly the same Git trees as the originally tested local commits `9e2e886` and `b30278a`, respectively. The reviewed implementation tree `75a98fc` likewise matches original commit `98e97b8`. Changing commit boundaries did not change application, contract, or test content.

## Current integrated validation — 11 October 2026

Tested commit: `35b1d6e56672eaa4146058576aa90a660ba22ae8`, including contributor PRs #15–17, the Firefox operator helper, and the review fixes. `npm test` passed **11 Foundry tests, 16 Vitest tests, and 72 Playwright scenarios** (99 named tests/scenarios total). The [full log](release-final-tests.log) records the complete run. The [operator log](operator-deploy-tests.log) and [focused recovery log](release-recovery-tests.log) record the targeted checks used before the final suite.

Typechecking, the release build, formatting, and Git whitespace checks passed. The built bundle contains the fresh acceptance address/block and excludes the prior live address. A read-only live browser check loaded the real Sepolia dungeon at revision 0 with the board ready. The main JavaScript bundle is now 576.68 kB (176.74 kB gzip); the Phaser chunk remains 1,196.46 kB (318.59 kB gzip). The chunk warning remains; no new FPS/first-play benchmark is claimed.

The [Vercel release preview](https://ruin-relay-git-codex-issue-1-release-aryas-projects-63ba0614.vercel.app/play) build succeeded for this commit; an unauthenticated HTTP read returned 200 and the served JavaScript contained the correct fresh address/block. The static release preview is also available locally at `http://127.0.0.1:4175/play`, backed by the verified real contract. The remaining release steps need access to the operator's wallet-enabled browser, two real mutations from separate profiles, and the recordings. Computer-use inventory currently reports no connected applications or browsers; the operator's Firefox session is outside this connection.

### Standards follow-up

The integrated review found two P2 documented breaches: recovery queried an unbounded log span and did not deduplicate canonical recovery events. Both are resolved in `d2cdc34`: queries use at most 2,000 blocks from the outset; history and recovery share canonical normalization keyed by chain/hash/log index. Failed or incomplete scans cannot prove absence. The associated duplicated-normalization smell is also resolved. Re-review found no introduced defect.

### Spec follow-up

One P2 code defect is resolved in `739a1ce`: `nonce too low`/already-used nonce remains ambiguous because a wallet/provider retry may report it after a successful broadcast. Fresh event/nonce/receipt checks can recover the actual result. A regression broadcasts through the actual Anvil contract, returns only the nonce error at the wallet boundary, and confirms recovery across reload with one signing request. Re-review found no introduced defect. The P1 two-profile A/B and recording gate remains pending.

Current review totals: Standards two breaches plus one optional smell resolved (original worst P2); Spec one code finding resolved and one acceptance gap pending (worst P1).

## Release procedure

The fresh acceptance deployment above starts at revision 0. The prior contributor contract is already revision 3, and the CLI rehearsal copy already consumed revisions 1 and 2.

1. Configure the browser with the verified fresh acceptance address and block. In profile A, play route `DRRRRURRDDLDLLDDRDRR`, toggle 31, sign, and verify revision 1 / walls `0xd05b827900a`.
2. In a separate wallet profile B, play `DRRRRURRDDLDLLLDDRRDRR`, toggle 38, sign, and verify revision 2 / walls `0xd45b827900a`.
3. Record both real hashes, gas used, visible board differences, public history, and one safety rejection from that acceptance contract.
4. Capture the English product demo and separate presentation. Describe business/retention ideas as hypotheses until observed evidence exists.

One mutation, a CLI-only rehearsal (including the copy above), or a local Anvil recording does not meet the two-profile Sepolia browser release gate.

## Standards

Reviewed implementation commit `75a98fc` against baseline `bda73e4` with an independent standards reviewer. The reviewer identified two documented-standard breaches of ADR §C.7:

- **P1, journal evidence preservation:** an unsaved entry replaced a fresh durable record wholesale. A temporary storage failure in one tab could erase a hash or replacement recorded by another tab. **Resolved:** merge known hashes and transaction metadata, preserve durable updates, and check all retained hashes for canonical inclusion. A two-tab regression covers transient storage failure followed by manual cancellation recovery.
- **P1, original nonce evidence:** transaction metadata was accepted as original evidence without checking its captured sender/action. **Resolved:** the shared `originalEvidence` helper requires the original hash and matching sender, destination, value, and calldata. A wrong-sender RPC metadata regression verifies that an unrelated consumed nonce cannot unlock the attempt.

The reviewer also noted possible duplicated original-evidence selection, a judgment heuristic resolved by the shared helper. Re-review found no concrete defect introduced by these fixes.

Standards findings: two breaches and one associated duplication concern, all resolved; the highest original severity was P1.

## Spec

An independent spec reviewer compared the same diff with GitHub issue #1 and the normative documents:

- **P2, cached success without atomic coordination:** a reload could restore a cached confirmation without receipt verification when Web Locks were unavailable. This contradicted “cached success is not fresh proof.” **Resolved:** synchronization verifies outcomes read-only even without Web Locks; signing remains disabled. A reload regression keeps success withdrawn when receipt reads fail.
- **P2, receipt identity:** returned transaction and receipt hashes were not explicitly compared with the requested hash, contrary to “verify the attempt’s transaction and DungeonMutated event.” **Resolved:** bind returned hashes to requested hashes before interpreting receipts, with two RPC-response mismatch regressions.
- **Partial release requirement:** the official Sepolia deployment and Sourcify exact match are recorded above. Two real browser-wallet mutations on that contract, official Sepolia gas receipts, and release videos remain pending. The required “two distinct wallets in separate browser profiles against the same fresh deployment” remains an external release gate. The rehearsal copy is rehearsal evidence.

No material unasked scope creep was found. Re-review found the two code findings corrected and no concrete introduced defect.

Spec findings: two code findings resolved (highest original severity P2), one release gap remains pending.

## Follow-up validation

The first complete suite run passed the 11 contract tests and 6 rules tests, but exposed three browser failures. Two shared a duplicated-keyboard-event cause; the third exposed speed-up observation after the original transaction disappeared from RPC indexing. These were fixed before the final run:

- Each queued keyboard event is handled once. A deterministic test pauses animation frames and checks the visible position and step count after rapid input.
- The receipt observer can use a complete, previously verified original RPC transaction only on `TransactionNotFoundError`, with matching hash, sender, nonce, action, and chain. It does not reuse cached receipts or infer success. A deterministic boundary test returns original metadata once and then removes it from RPC responses.

The spec reviewer checked both follow-up fixes and found no concrete introduced defect. Historical replacements outside the observer's available block range can still require manual hash recovery, as described in the README.

## Post-review fix

The fresh review of `bda73e4…2f18a91` found no documented standards breach or additional concrete implementation defect, but identified optional P3 duplication in three observation-invalidation branches. These now use one internal `invalidateObservations` helper. Rejected attempts remain rejected; other attempts lose cached mutation confirmation and become unknown. Existing messages are preserved unless the caller supplies the RPC-failure explanation.

Typechecking and formatting passed. Five existing browser regressions passed on 10 October 2026 (Asia/Jakarta): explicit wallet rejection, reload confirmation revalidation, revalidation without Web Locks, storage-read failure after broadcast, and offline confirmation withdrawal. See the [focused test log](review-fix-tests.log). Reproduce with:

```sh
npm run test:browser -- --grep 'cached success|offline observation|storage reads failing after broadcast|explicit wallet rejection'
```

At that review, the throwaway wallets then configured still held 0 test ETH. The public addresses above have since deployed the official contract, and Sourcify verification is recorded. Real browser-wallet mutations on that contract, and the recording gate, remain pending.
