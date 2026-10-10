# Release evidence

Status: local implementation, automated checks, and code review completed. The official Arbitrum Sepolia contract is deployed and Sourcify-verified. Browser-wallet mutations on that contract, and the release recordings, remain **pending**.

## Public test-wallet setup

| Purpose             | Address                                      |
| ------------------- | -------------------------------------------- |
| Deployer / player A | `0x39A2862c0c8A1feF97644960F873B8cBa7f58dAa` |
| Player B            | `0x9Bd92C5A3A164c6488bbBff842F9500b4DA47b7a` |

Local private keys are excluded from Git and blocked by the development server. Wallet A deployed the official contract. Wallet B is the second public testnet account for the pending browser gate.

## Official deployment

Chain 421614 (Arbitrum Sepolia).

| Field                  | Evidence                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract               | [`0xDaFc851910D91D54916349EECB8d320a5a56b988`](https://sepolia.arbiscan.io/address/0xDaFc851910D91D54916349EECB8d320a5a56b988)                                            |
| Deployment transaction | [`0xaf9a8e77b68c1b9d9e1952abab04fdc2584ac1b56bc2c0c3169f128fc4b87d1d`](https://sepolia.arbiscan.io/tx/0xaf9a8e77b68c1b9d9e1952abab04fdc2584ac1b56bc2c0c3169f128fc4b87d1d) |
| Deployment block       | 317783571                                                                                                                                                                 |
| Deployer               | `0x39A2862c0c8A1feF97644960F873B8cBa7f58dAa`                                                                                                                              |
| Source verification    | Sourcify `exact_match`, chain 421614 ([full match](https://repo.sourcify.dev/contracts/full_match/421614/0xDaFc851910D91D54916349EECB8d320a5a56b988/))                    |

Browser-wallet mutations on this contract remain pending. `scripts/sepolia.mjs` previously sent verification to Blockscout at `https://arbitrum-sepolia.blockscout.com/api/`. Cloudflare blocks that API. The match above is the Sourcify result, and `verify` now uses Foundry's Sourcify verifier.

## Rehearsal copy

Measured on a separate Arbitrum Sepolia copy, [`0x57b7461dc06dda9e11159c0e75306e1655545a64`](https://sepolia.arbiscan.io/address/0x57b7461dc06dda9e11159c0e75306e1655545a64). **Label: rehearsal.** These receipts are rehearsal evidence. The browser release gate still requires both mutations on the official contract above.

| Step                 | Evidence                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player A, tile 31    | [`0xeb0bfc1eb368237ed9cb743919bb990532c1e0c52b78b3e76957e9f87180d219`](https://sepolia.arbiscan.io/tx/0xeb0bfc1eb368237ed9cb743919bb990532c1e0c52b78b3e76957e9f87180d219), 110,473 gas. Receipt matched revision 1 and walls `0xd05b827900a`. |
| Player B, tile 38    | [`0x961e107f0dc2b1a0b2fdc8b7957fba4715d7d286d4e5525e1245de428737a673`](https://sepolia.arbiscan.io/tx/0x961e107f0dc2b1a0b2fdc8b7957fba4715d7d286d4e5525e1245de428737a673), 109,803 gas. Receipt matched revision 2 and walls `0xd45b827900a`. |
| Tile 8 at revision 0 | `eth_call` reverted with `UnsolvableMutation`.                                                                                                                                                                                                |

## Verification record

| Field                                   | Evidence                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Source baseline                         | `bda73e4d68599aa8537088dd6985c6d126cc7e52`                                                                   |
| Complete-suite commit                   | `d087cdf1f33176ce9857910f29dc4984b0c7d9ba`                                                                   |
| Development-server guard commit         | `0d379d2912ef89fcebcc3efb18f7d4618e158032`                                                                   |
| Implementation / test date              | 10 October 2026, Asia/Jakarta; design handoff predates implementation                                        |
| Runtime                                 | Node.js 26.11.1, npm 11.20.0                                                                                 |
| Solidity compiler                       | 0.8.24, optimizer 200, Cancun                                                                                |
| Foundry                                 | 1.7.1                                                                                                        |
| Fuzz configuration                      | 256 cases per fuzz test; 12 actions per mutation sequence                                                    |
| Typechecking / build                    | Passed; `npm test` includes typechecking, and `npm run build` passed at the guard commit                     |
| Formatting                              | Prettier, Foundry formatting, and Git whitespace checks passed                                               |
| Rules / independent oracle              | 6 rules tests passed; independent Solidity fuzz oracle and 80 browser TS/Solidity random-mask comparisons    |
| Contract tests / gas snapshot           | 11 tests passed; [focused gas snapshot](../.gas-snapshot), with measurement limits below                     |
| Browser scenarios                       | 45 passed in the complete suite; 1 additional guard scenario passed with a repeated wallet-free escape smoke |
| Keyboard / mobile inspection            | Agent inspected desktop WASD/R and the 375px mobile layout; separate human acceptance remains pending        |
| Screenshots                             | [Desktop](screenshots/desktop.png), [375px mobile](screenshots/mobile.png); both local Anvil                 |
| Performance benchmark                   | First-play latency and FPS not measured; build chunk-size warning recorded below                             |
| Sepolia chain                           | 421614                                                                                                       |
| Deployed contract / source verification | Official `0xDaFc851910D91D54916349EECB8d320a5a56b988`, block 317783571; Sourcify `exact_match`, chain 421614 |
| Deployment transaction                  | `0xaf9a8e77b68c1b9d9e1952abab04fdc2584ac1b56bc2c0c3169f128fc4b87d1d`                                         |
| Real UI mutation A, revision 0→1        | Pending on the official contract                                                                             |
| Real UI mutation B, revision 1→2        | Pending on the official contract                                                                             |
| Sepolia gas estimates / receipts        | Rehearsal copy only (110,473 and 109,803 gas). Official browser receipts pending                             |
| Product demo ≤3 minutes                 | [English script ready](demo-script.md); recording pending                                                    |
| Presentation 2–3 minutes                | [English script ready](presentation.md); recording pending                                                   |

The [complete test log](test-results.log) records a successful `npm test` exit: 11 contract tests, 6 rules tests, and 45 browser scenarios. After adding the development-server deny rule and its regression, `npm run test:browser -- --grep 'operator files are denied|wallet-free escape'` passed both selected tests ([guard log](operator-files-test.log)). This is **46 distinct browser scenarios** across the two runs, not a claim that the complete suite was rerun with 46 tests. At the guard-test commit, application and contract source were unchanged from the complete-suite commit. The subsequent observation-helper refactor is covered by the focused validation below.

The guard test uses a harmless canary, never a private key. Both its normal URL and `/@fs/` URL returned HTTP 403. The rule preserves Vite's default deny patterns and also denies `**/.local/**`. Re-review found no concrete issue in this guard or the English recording drafts.

Local EVM gas reporting for `testGasOpenBoard96Steps|testTwoContributors` measured deployment at **602,912 gas** and `completeAndMutate` across three sampled calls at **109,803 / 144,674 / 110,473 / 213,746 gas** (minimum / mean / median / maximum). These are local samples, not Sepolia receipts or a theoretical maximum. The snapshot records whole test-function gas, including setup, so its numbers must not be presented as transaction gas. Reproduce with:

```sh
node scripts/foundry.mjs forge snapshot --root contracts --match-test 'testGasOpenBoard96Steps|testTwoContributors'
node scripts/foundry.mjs forge test --root contracts --match-test 'testGasOpenBoard96Steps|testTwoContributors' --gas-report
```

The Vite build passed with a large-chunk warning: main JavaScript 568.07 kB (174.16 kB gzip), dynamically loaded Phaser 1,196.46 kB (318.59 kB gzip). A successful build is not a latency or FPS benchmark.

Session history was split into atomic commits before publication. The complete-suite and guard-test commits above have exactly the same Git trees as the originally tested local commits `9e2e886` and `b30278a`, respectively. The reviewed implementation tree `75a98fc` likewise matches original commit `98e97b8`. Changing commit boundaries did not change application, contract, or test content.

## Release procedure

The official contract above is the release deployment. The rehearsal copy already consumed fixture revisions 1 and 2.

1. Configure the browser with the official address and block. In profile A, play route `DRRRRURRDDLDLLDDRDRR`, toggle 31, sign, and verify revision 1 / walls `0xd05b827900a`.
2. In a separate wallet profile B, play `DRRRRURRDDLDLLLDDRRDRR`, toggle 38, sign, and verify revision 2 / walls `0xd45b827900a`.
3. Record both real hashes, gas used, visible board differences, public history, and one safety rejection from that official contract.
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
