# Release evidence

Status: local implementation under verification. The Sepolia release is **not complete**.

## Public test-wallet setup

Generated on 10 October 2026 (Asia/Jakarta):

| Purpose             | Address                                      |
| ------------------- | -------------------------------------------- |
| Deployer / player A | `0xF7A09917313f2740990de8AA236077Be198ccD69` |
| Player B            | `0x1b75EB514FAEE2E788D313001A41b1D0bd59ea0F` |

Local private keys are excluded from Git. Test ETH funding remains pending. These addresses are not deployment or mutation evidence.

## Verification record

| Field                                   | Evidence                                                  |
| --------------------------------------- | --------------------------------------------------------- |
| Source baseline                         | `bda73e4d68599aa8537088dd6985c6d126cc7e52`                |
| Test commit                             | Pending final commit                                      |
| Test date                               | 10 October 2026, Asia/Jakarta                             |
| Solidity compiler                       | 0.8.24, optimizer 200, Cancun                             |
| Foundry                                 | 1.7.1                                                     |
| Fuzz configuration                      | 256 cases per fuzz test; 12 actions per mutation sequence |
| Typechecking / build                    | Pending final run                                         |
| Rules / independent oracle              | Pending final run                                         |
| Contract tests / gas snapshot           | Pending final run                                         |
| Browser scenarios                       | Pending final run                                         |
| Sepolia chain                           | 421614                                                    |
| Deployed contract / source verification | Pending funding and deployment                            |
| Deployment transaction                  | Pending                                                   |
| Real UI mutation A, revision 0→1        | Pending                                                   |
| Real UI mutation B, revision 1→2        | Pending                                                   |
| Sepolia gas estimates / receipts        | Pending                                                   |
| Product demo ≤3 minutes                 | Pending                                                   |
| Presentation 2–3 minutes                | Pending                                                   |
| Human keyboard / mobile inspection      | Pending                                                   |

## Release procedure

1. Fund the generated throwaway wallets via a faucet listed by Arbitrum, then run the balance command.
2. Deploy a fresh canonical dungeon and verify its source. Record the public address, deployment block/hash, compiler settings, and explorer verification result.
3. Configure the browser using that deployment. In profile A, play route `DRRRRURRDDLDLLDDRDRR`, toggle 31, sign, and verify revision 1 / walls `0xd05b827900a`.
4. In a separate wallet profile B, play `DRRRRURRDDLDLLLDDRRDRR`, toggle 38, sign, and verify revision 2 / walls `0xd45b827900a`.
5. Record both real hashes, gas used, visible board differences, public history, and one safety rejection. Use a fresh deployment if a CLI rehearsal already consumed the canonical two revisions.
6. Capture the English product demo and separate presentation. Describe business/retention ideas as hypotheses until observed evidence exists.

One mutation, a CLI-only rehearsal, or a local Anvil recording does not meet the two-profile Sepolia browser release gate.

## Standards review

Reviewed implementation commit `98e97b8` against baseline `bda73e4` with an independent standards reviewer. The reviewer identified two documented-standard breaches of ADR §C.7:

- **P1, journal evidence preservation:** an unsaved entry replaced a fresh durable record wholesale. A temporary storage failure in one tab could erase a hash or replacement recorded by another tab. **Resolved:** merge known hashes and transaction metadata, preserve durable updates, and check all retained hashes for canonical inclusion. A two-tab regression covers transient storage failure followed by manual cancellation recovery.
- **P1, original nonce evidence:** transaction metadata was accepted as original evidence without checking its captured sender/action. **Resolved:** the shared `originalEvidence` helper requires the original hash and matching sender, destination, value, and calldata. A wrong-sender RPC metadata regression verifies that an unrelated consumed nonce cannot unlock the attempt.

The reviewer also noted possible duplicated original-evidence selection, a judgment heuristic resolved by the shared helper. Re-review found no concrete defect introduced by these fixes.

Standards findings: two breaches and one associated duplication concern, all resolved; the highest original severity was P1.

## Spec review

An independent spec reviewer compared the same diff with GitHub issue #1 and the normative documents:

- **P2, cached success without atomic coordination:** a reload could restore a cached confirmation without receipt verification when Web Locks were unavailable. This contradicted “cached success is not fresh proof.” **Resolved:** synchronization verifies outcomes read-only even without Web Locks; signing remains disabled. A reload regression keeps success withdrawn when receipt reads fail.
- **P2, receipt identity:** returned transaction and receipt hashes were not explicitly compared with the requested hash, contrary to “verify the attempt’s transaction and DungeonMutated event.” **Resolved:** bind returned hashes to requested hashes before interpreting receipts, with two RPC-response mismatch regressions.
- **Partial release requirement:** verified Sepolia deployment, two real browser-wallet mutations, measured Sepolia gas, and release videos remain pending, as disclosed above. The required “two distinct wallets in separate browser profiles against the same fresh deployment” remains an external release gate.

No material unasked scope creep was found. Re-review found the two code findings corrected and no concrete introduced defect.

Spec findings: two code findings resolved (highest original severity P2), one release gap remains pending.
