# Release evidence

Status: local implementation, automated checks, and code review completed. The Sepolia release is **not complete**.

## Issue #1 completion checklist

The implementation is already on `main` at `3019097`. This release follow-up tracks the remaining acceptance evidence for [issue #1](https://github.com/Kurisu-Labs/ruin-relay/issues/1).

- [x] Implement the contract, wallet-free game, fixed run snapshots, edit drafts, durable commit attempts, recovery, and public history.
- [x] Record local contract, rules, browser, build, and formatting validation, and address the code-review findings.
- [x] Fund both selected release wallets with Arbitrum Sepolia ETH and verify their balances on chain ID 421614.
- [ ] Connect wallet A through its Firefox extension and approve the deployment request.
- [ ] Deploy a fresh canonical dungeon and record the address, deployment block/hash, compiler settings, and successful public source/ABI verification.
- [ ] In browser profile A, submit tile 31 from revision 0 and record its real receipt, explorer link, and resulting walls `0xd05b827900a`.
- [ ] In separate browser profile B, submit tile 38 against the same deployment at revision 1 and record its real receipt, explorer link, and resulting walls `0xd45b827900a`.
- [ ] Record gas used for deployment and both real mutations, plus visible board changes and public history.
- [ ] Include a safety-rejection demonstration and the keyboard/mobile inspection evidence in the release materials.
- [ ] Record the English product demo (at most three minutes) and separate presentation (two to three minutes).

Keep issue #1 open until the unchecked release requirements have verifiable evidence. Keep the release PR in draft while these gates are pending. Local Anvil hashes, a CLI rehearsal, and recording scripts do not satisfy the real two-profile browser demonstration. The commands and canonical routes are documented below and in the README.

## Public test-wallet setup

### Selected release wallets

Provided by the operator on 10 October 2026 (Asia/Jakarta). Funding was verified at 23:30:01 WIB on chain 421614, block `317791963`, hash `0x69a78fd952457622c9d28a33eab2890997027776a8b0292a3c6bec0558bc07e2`:

| Purpose             | Address                                      | Test ETH |
| ------------------- | -------------------------------------------- | -------- |
| Deployer / player A | `0x37714b787066ce967d027B752D045e13b8b64A84` | 0.05     |
| Player B            | `0x4Cc38D7C18C0EB53662d2D3FA382C3a82B2e7ad9` | 0.05     |

The operator reports an existing Firefox wallet extension. Firefox is unavailable through this session's browser-control connection, so wallet approvals require operator interaction. The real A/B demonstration requires separate Firefox profiles. Funding is complete; deployment signing is pending. The CLI signer remains configured for the generated local wallets. These addresses and balances are not deployment or mutation evidence.

### Generated local wallets

Generated on 10 October 2026 (Asia/Jakarta):

| Purpose             | Address                                      |
| ------------------- | -------------------------------------------- |
| Deployer / player A | `0xF7A09917313f2740990de8AA236077Be198ccD69` |
| Player B            | `0x1b75EB514FAEE2E788D313001A41b1D0bd59ea0F` |

Local private keys are excluded from Git and blocked by the development server. Both addresses had a balance of **0 Arbitrum Sepolia ETH** when checked. Test ETH funding remains pending. These addresses are not deployment or mutation evidence.

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
| Deployed contract / source verification | Pending funding and deployment                                                                               |
| Deployment transaction                  | Pending                                                                                                      |
| Real UI mutation A, revision 0→1        | Pending                                                                                                      |
| Real UI mutation B, revision 1→2        | Pending                                                                                                      |
| Sepolia gas estimates / receipts        | Pending                                                                                                      |
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

1. Fund the selected release wallets via a faucet listed by Arbitrum, connect their browser-wallet or local-keystore signing setup, and verify their balances on chain 421614. The existing `scripts/sepolia.mjs` commands use the generated local wallets until a different signing setup is configured.
2. Deploy a fresh canonical dungeon and verify its source. Record the public address, deployment block/hash, compiler settings, and explorer verification result.
3. Configure the browser using that deployment. In profile A, play route `DRRRRURRDDLDLLDDRDRR`, toggle 31, sign, and verify revision 1 / walls `0xd05b827900a`.
4. In a separate wallet profile B, play `DRRRRURRDDLDLLLDDRRDRR`, toggle 38, sign, and verify revision 2 / walls `0xd45b827900a`.
5. Record both real hashes, gas used, visible board differences, public history, and one safety rejection. Use a fresh deployment if a CLI rehearsal already consumed the canonical two revisions.
6. Capture the English product demo and separate presentation. Describe business/retention ideas as hypotheses until observed evidence exists.

One mutation, a CLI-only rehearsal, or a local Anvil recording does not meet the two-profile Sepolia browser release gate.

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
- **Partial release requirement:** verified Sepolia deployment, two real browser-wallet mutations, measured Sepolia gas, and release videos remain pending, as disclosed above. The required “two distinct wallets in separate browser profiles against the same fresh deployment” remains an external release gate.

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

Both generated Sepolia wallets were rechecked and still held 0 test ETH. The public deployment, verification, real browser-wallet mutations, and recording gate remain pending.
