# Product validation — 11 October 2026

The operator explicitly deferred hackathon recording work to focus on product development and correctness. The recording/presentation checklist remains in [issue #13](https://github.com/Kurisu-Labs/ruin-relay/issues/13). No recording is claimed complete, and the verified acceptance deployment does not need another mutation or redeployment.

## Review scope

Reviewed the implemented product against the original implementation baseline `bda73e4d68599aa8537088dd6985c6d126cc7e52`, issue #1, PRD, ADRs 001–032, fixtures, glossary, and test plan. Standards and Spec reviewers worked independently. Accepted ADR-032 semantics were preserved.

| Axis      | Finding                                                                                                                              | Fix and verification                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standards | P2: a successful but incomplete log response was shown as trustworthy history despite the live revision proving events were missing. | `50f3600`: require the newest `min(10, live.revision)` contiguous revisions and the latest wall mask to match the observed dungeon. Missing/inconsistent history uses the existing unavailable notice while play remains usable. |
| Spec      | P2: restoring a different tab’s draft retained an older prepared transaction, including a late RPC estimate.                         | `eb8b103`: discard preparation on draft restoration; ignore obsolete estimates; recheck draft identity before wallet submission.                                                                                                 |

Both findings were reproduced before fixes. Four history regressions failed for empty results, missing newest/earlier events, and a mismatched latest mask. Two draft regressions failed for an already prepared quote and a delayed estimate. After fixes, all six pass; a seventh positive test verifies the ten-entry history limit with twelve actual local mutations. The draft tests re-prepare and submit the restored tile15 and decode the outgoing transaction to verify it matches the editor. Neither reviewer found a remaining actionable defect in the final fix delta.

An initial delayed-estimate harness run also hit a route-unregistration race. The harness was corrected to release its intercepted request before subsequent requests, and the regression was rerun against unchanged product code: it then failed only on the stale preview. The clean failing run is retained separately: [initial red cases](product-regressions-red.log), [clean delayed-estimate red case](product-regressions-estimating-red.log), and [all seven green regressions](product-regressions-green.log).

## Automated validation

Tested product commit: `eb8b103` (later documentation-only commits do not change the tested implementation).

Final full-suite result: **106 named tests/scenarios passed** — 11 Foundry tests (including three fuzz tests with 256 cases each), 16 Vitest tests, and 79 Playwright browser scenarios. Typecheck, production build, formatting, and whitespace checks passed. The preceding unchanged baseline passed 99 tests/scenarios; the seven additions cover the review findings.

Logs: [complete test run](product-validation-tests.log), [production build](product-validation-build.log), [formatting](product-validation-format.log).

Configuration: Node.js 26.11.1, pinned dependencies, Solidity 0.8.24/Cancun with optimizer 200, 256 cases per configured Foundry fuzz test, Playwright Chromium with one worker against local Anvil/Vite. Browser tests are run sequentially, with no application edits during a run. Wallet/RPC fault injection occurs at test boundaries; production has no debug mutation controls.

## Actual public-chain and UI evidence

- The fresh source-verified Arbitrum Sepolia contract remains `0xf1ee7e1D9814E0ac2ddC3dd180a58f9698cc0d79`.
- Real wallet A [created revision 1](https://sepolia.arbiscan.io/tx/0xd2657acdce42c3b8560f757c1aa7a275ae55b412a74b87fbaa6729b82fa20521), tile31, walls `0xd05b827900a`, 110473 gas.
- Real wallet B [created revision 2](https://sepolia.arbiscan.io/tx/0x08647c14c04e4c3732c2641664f301261977cffd3abe52e12d4bc08627b0c16f), tile38, walls `0xd45b827900a`, 109803 gas. The operator confirmed separate profiles. See the decoded receipts and [history screenshot](screenshots/sepolia-two-wallet-history.png).
- A read-only/local-play inspection of the hosted UI at revision2 completed the route `DRRRRURRDDLDLLLDDDRRRR` using keyboard input: 22 moves, EXIT reached, with no wallet or new transaction.
- Selecting tile8 showed “That edit blocks every route to the exit.” and a disabled Commit button. The focused Cancel control and text-based status are visible in the [safety screenshot](screenshots/product-safety-revision2.png).
- The mobile-sized browser inspection measured a 325px CSS viewport and 312px document width, with board and content inside the page. [Mobile screenshot](screenshots/product-mobile-revision2.png). The automated suite also checks a 375×812 viewport. The temporary browser size override was reset afterward.

These hosted UI screenshots were captured before the two fixes were deployed; the changed fault paths are covered by the local regression tests. No extra public-chain mutation was submitted during this validation.

## Limits

This is execution and review evidence, not a guarantee that no undiscovered bug exists or an independent security audit. First-play time and 60 FPS targets were not benchmarked. The existing build warning about large application/Phaser chunks remains a performance consideration. Wallet-extension side-panel support is a limitation of the in-app browser used by the agent; the operator’s two real wallet transactions succeeded through their separate profiles. Hackathon recording and submission work is explicitly deferred.
