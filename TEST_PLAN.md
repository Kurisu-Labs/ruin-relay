# Ruin Relay — Test Plan & Acceptance Matrix

> **v1.0 | 10 October 2026** · Seluruh kasus di bawah adalah **test specification**, bukan hasil tes yang sudah dijalankan pada kontrak live.

## 1. Test strategy

- **Unit (Solidity/Foundry):** constructor, mask, path decoding, safety, error, event.
- **Property/fuzz/invariant (Foundry):** arbitrary 49-bit boards dan sequence mutasi; reference TS oracle.
- **Cross-language parity (Vitest):** codec dan BFS cocok dengan Solidity/fixture.
- **Integration (Anvil dan Sepolia):** frontend, wallet, race, logs, explorer.
- **End-to-end (Playwright/manual):** game feel, flow tanpa wallet, dua-player-sequential demo, states.

**Oracles:** fixture yang diverifikasi secara independen `reference/fixtures.json`, state reader `getDungeon`, event `DungeonMutated`, `isSolvable` dan independent BFS TypeScript/Python. Jangan menganggap test yang memanggil fungsi helper implementasi yang sama sebagai bukti independen.

## 2. Test vector utama

Initial board:

```text
S#.#...
.....#.
.####..
#.....#
##..#.#
.....#.
##....E
```

- Seed wall mask: `0xd053827900a`, revision `0`, edit mask `0x1f9e7e1cf00`.
- Player A: `DRRRRURRDDLDLLDDRDRR` → 20 moves → packed `0x59afba5156`; toggle 31 → expected rev 1, walls `0xd05b827900a`.
- Player B: `DRRRRURRDDLDLLLDDRRDRR` → 22 moves → packed `0x596bfba5156`; toggle 38 → expected rev 2, walls `0xd45b827900a`.
- At rev0: toggle **tile 8** is **UNSOLVABLE** (should revert even with correct path).
- At rev0: toggle **tile 15** (wall→floor) is **SOLVABLE**.
- Editable index **31** is **SOLVABLE** (floor→wall), as used by Player A.
- Noneditable index **7**, endpoints **0 and 48**, out-of-range **49** are rejected.

## 3. Contract unit test cases

| Test ID | Scenario / input | Expected result | Priority |
|---|---|---|---|
| C-01 | Deploy canonical seed/edit mask | Contract initialized rev0; mask matches fixture; reachable=true | P0 |
| C-02 | Deploy with wall bit 49 set | Constructor revert | P0 |
| C-03 | Deploy with START=wall | Constructor revert | P0 |
| C-04 | Deploy with EXIT=wall | Constructor revert | P0 |
| C-05 | Deploy with START or EXIT editable | Constructor revert | P0 |
| C-06 | Deploy with out-of-range edit bit | Constructor revert | P0 |
| C-07 | Deploy with edit mask 0 | Constructor revert | P0 |
| C-08 | Deploy seed with no route | Constructor revert | P0 |
| C-09 | Valid Player A fixture call | rev=1; walls A; exactly one event; actor=msg.sender | P0 |
| C-10 | Valid Player B fixture after A | rev=2; walls B; event tile 38 | P0 |
| C-11 | Wrong expectedRevision | `StaleRevision`; walls/revision unchanged | P0 |
| C-12 | Two calls same rev from different addresses | Only first included succeeds; second reverts; exactly one revision increment | P0 |
| C-13 | zero moveCount | `InvalidMoveCount`; state unchanged | P0 |
| C-14 | moveCount = 97 | `InvalidMoveCount`; state unchanged | P0 |
| C-15 | Valid path but bit above `2*moveCount` set | `NonCanonicalDirections`; unchanged | P0 |
| C-16 | Step from (0,0) UP or LEFT | `InvalidStep`/bounds; unchanged | P0 |
| C-17 | Attempt to step onto wall index 1 from START | `InvalidStep`/wall; unchanged | P0 |
| C-18 | Partial path does not reach EXIT | `PathDoesNotReachExit`; unchanged | P0 |
| C-19 | Valid path reaches EXIT then moves away and returns | `ExitReachedEarly`; unchanged | P0 |
| C-20 | Valid route with legal revisit, length ≤96 | Accepted if end is EXIT | P0 |
| C-21 | Valid route + tile 8 edit rev0 | `UnsolvableMutation`; unchanged | P0 |
| C-22 | Valid route + tile 15 rev0 | Wall bit15 toggled to floor; still solvable | P0 |
| C-23 | Valid route + tile 31 rev0 | Floor bit31 toggled to wall; still solvable | P0 |
| C-24 | Valid route + tile 0 or 48 | `TileNotEditable`; unchanged | P0 |
| C-25 | Valid route + tile 7 or 49 | `TileNotEditable`; unchanged | P0 |
| C-26 | Revert mutation | No emitted `DungeonMutated` persisted | P0 |
| C-27 | Success mutation | Event revision/editor/tile/becameWall/wallMask exactly matches storage | P0 |
| C-28 | Caller sends ETH value | Nonpayable revert | P0 |
| C-29 | No external payable/transfer/upgrade/admin mutation functions | ABI/bytecode manual review | P0 |
| C-30 | `isSolvable` on all-floor board | true | P0 |
| C-31 | `isSolvable` on valid disconnected board | false | P0 |
| C-32 | isSolvable with START wall, EXIT wall, or any bit 49..63 set | Returns false without reverting; constructor/mutation rejection remains unchanged | P0 |
| C-33 | 96-step valid path with loops followed by EXIT | Accepted if one can be constructed against board | P1 |
| C-34 | Rev increments repeated valid actions | strictly N,N+1,... with no gaps | P0 |

## 4. Fuzz & invariant test cases

| Test ID | Property | Strategy | Priority |
|---|---|---|---|
| F-01 | `walls` never leaks into bits 49..63 | Stateful handler generates valid edits | P0 |
| F-02 | START/EXIT remain floor | After every accepted action | P0 |
| F-03 | Accepted state always reachable | Independent BFS oracle on final mask | P0 |
| F-04 | Every success toggles one bit | `popcount(prev^next)==1` | P0 |
| F-05 | Revert changes no storage | Snapshot wall/revision before arbitrary invalid call | P0 |
| F-06 | Successful action increments revision exactly once | Stateful call sequence | P0 |
| F-07 | Solidity and TS direction packing agree | Property-based sequences length 1..96 | P0 |
| F-08 | Solvability parity on random masks | Random 49-bit boards with endpoint constraints, independent oracle | P0 |
| F-09 | BFS memory queue never writes beyond 49 | Fuzz maps incl. all-open, many branches | P0 |
| F-10 | Only a caller valid at current revision changes board | Fuzz `expectedRevision` including UINT64_MAX | P0 |
| F-11 | No shift / truncation bug at 96 steps | Fuzz packedDirections high-bits and steps | P0 |
| F-12 | Gas bounded for worst-case loop/map | `forge snapshot`, recorded max, Sepolia estimate | P0 |

**Nota:** Test `isSolvable(randomMask)` versus implementation lain yang mengimpor kode produksi sama **bukan oracle independen**. Gunakan BFS terpisah sebagai test oracle.

## 5. TypeScript/game/client tests

| Test ID | Scenario | Expected result | Priority |
|---|---|---|---|
| W-01 | Visit `/play` without wallet | Board visible; WASD works | P0 |
| W-02 | WASD and arrow keys movement | Correct x/y, wall/border blocked | P0 |
| W-03 | Restart after 10 moves | Back at START, path empty | P0 |
| W-04 | Reach EXIT after valid route | Victory only once; path freezes | P0 |
| W-05 | Click edit before EXIT | Commit/Edit not available | P0 |
| W-06 | Select tile 8 on seed | Preview says no route, Commit disabled | P0 |
| W-07 | Select tile 31 on seed | Preview valid, shows correct before/after | P0 |
| W-08 | Local pack route A and B | Exact fixture hex values | P0 |
| W-09 | Wrong chain | Block transaction, prompt switch to 421614 | P0 |
| W-10 | Wallet rejected | Return to editor with no "success" | P0 |
| W-11 | Invalid proof simulation | Error decoded, no signed write | P0 |
| W-12 | Transaction pending | Show hash/tx link; no fake permanent edit | P0 |
| W-13 | Transaction has a canonical reverted receipt | Mark attempt reverted without mutation success; refetch latest and permit recovery subject to stale rules | P0 |
| W-14 | Stale mutation race | Show stale revision explanation; require replay | P0 |
| W-15 | Success receipt + valid event | Show revision increment only after reconciliation | P0 |
| W-16 | Same page on second browser/device | Reads current board directly from contract | P0 |
| W-17 | History RPC getLogs fails | Current board/play continues; history error | P0 |
| W-18 | Duplicate logs returned | Dedupe by `(chainId, txHash, logIndex)` | P0 |
| W-19 | RPC offline | Offline/stale indicator, disabled commitment | P0 |
| W-20 | Narrow mobile screen | No clipped critical text; playable touch P1 only | P0 |
| W-21 | Keyboard-only flow | Restart and informational dialogs reachable | P0 |
| W-22 | Explorer link | Correct chain 421614 and verified contract/address | P0 |
| W-23 | Source & content licenses | Open source license, attribution, no unlicensed art | P0 |
| W-24 | Live revision advances while playing or editing | Run snapshot/path/position stay unchanged; HUD distinguishes playing/live revisions; stale Commit disabled | P0 |
| W-25 | Restart a stale run | START and empty path on the same snapshot; old edit draft cleared; Commit remains disabled | P0 |
| W-26 | Play latest from a stale run | New run starts at START on the fetched live dungeon; old path and edit draft discarded | P0 |
| W-27 | Own valid mutation creates N+1; live dungeon is already N+2, including a later mutation in the same block | Own receipt/event matches the captured attempt; contribution succeeds at N+1; live N+2 is shown separately without requiring equal masks | P0 |
| W-28 | Receipt event mismatches captured account, contract, revision, tile, resulting mask, or becameWall | No contribution success; show reconciliation problem | P0 |
| W-29 | Tile change, Restart, Play latest, or duplicate Commit during signing/pending | Controls disabled; captured attempt unchanged; history remains available | P0 |
| W-30 | Wallet rejects a locked attempt | Return to preserved run and edit draft; unlock controls; stale snapshot still blocks Commit | P0 |
| W-31 | Receipt timeout, RPC error, or receipt not found after submission | Pending/unknown remains unresolved; preserve attempt and hashes; keep run/edit/new-commit controls locked; Retry status performs reads only | P0 |
| W-32 | Reload/reopen with a persisted unresolved attempt and known hash | Restore the fixed attempt, run and edit; resume reads on its original chain/contract; do not resubmit or unlock from cached state | P0 |
| W-33 | Wallet speed-up preserves sender, nonce, target, value and calldata | Follow replacement hash, retain original hash, and verify the replacement receipt/event against the same attempt | P0 |
| W-34 | Canonical cancellation or different-action replacement consumes the original nonce | End original attempt without claiming mutation success; refetch dungeon and unlock editor subject to stale rules | P0 |
| W-35 | Previously confirmed contribution has an orphaned receipt block | Withdraw success and orphaned history, return attempt to verification, and block new commits until outcomes are verified again | P0 |
| W-36 | Reorg yields the same revision number with different walls | Preserve old run only as stale practice; Commit disabled; Play latest required for a new eligible run | P0 |
| W-37 | Reload a cached successful contribution | Revalidate receipt inclusion, matching event and live state before displaying current confirmation | P0 |
| W-38 | RPC unavailable while checking a previously confirmed receipt | Report stale observation; do not infer reorg or failure from a read error; block new commits until state is verified | P0 |
| W-39 | Wallet account/network changes before or after a signing request is issued | Before request: abort mismatched preflight without write; after request: preserve original attempt, lock, and chain tracking, then process the actual late outcome | P0 |
| W-40 | Initial attempt journal cannot be saved | No wallet signing request; local play remains available with an explanation that commit recovery is unavailable | P0 |
| W-41 | Hash persistence fails after broadcast | Continue tracking known hash in memory, expose it for copying, and retain the previously saved unresolved attempt; do not resubmit | P0 |
| W-42 | Wallet response is lost before a hash is known | Restore/retain unknown attempt; offer wallet/explorer guidance and Recover with transaction hash; verified linkage resumes read-only tracking without resubmission | P0 |
| W-43 | Supplied recovery hash has wrong chain/sender/known nonce, or different target/value/payload without proven replacement linkage | Reject association; keep original attempt and lock unchanged | P0 |
| W-44 | Original nonce is unknown and supplied cancellation/duplicate transaction cannot be linked conclusively | Keep unresolved; empty wallet history or matching account/payload alone is not proof that the original attempt ended | P0 |
| W-45 | Two same-origin tabs in one browser profile submit to the same deployment simultaneously, including with different wallet accounts | Exactly one atomic attempt claim and wallet signing request; other tab observes the active attempt and blocks a new commit | P0 |
| W-46 | Originating tab closes or wallet account changes while attempt is unresolved | Remaining/reopened tabs consult the persisted deployment-scoped journal; closing a tab or changing accounts does not unlock submission | P0 |
| W-47 | Atomic coordination across tabs is unavailable | No signing request; explain commit unavailability and retain local play | P0 |
| W-48 | Supplied recovery hash is a canonical cancellation/different-action replacement with verified original sender+nonce linkage | Use persisted linkage evidence; classify under replacement rules, end the original attempt without mutation success, and refetch before permitting another commit | P0 |

## 6. End-to-end demo rehearsal

**E2E-01 — Proven canonical demo**

1. Open fresh deployment at revision 0, verify seed walls.
2. Browser A without wallet plays route A and enters victory state.
3. Preview tile 31 passes local BFS; then wallet A submits `completeAndMutate(0, 0x59afba5156, 20, 31)`.
4. Check receipt status successful and event contract address = configured contract; expected rev 1, walls `0xd05b827900a`.
5. Browser B opens fresh page; board is revision 1 and visibly differs.
6. Browser B plays route B and edits tile 38; wallet B submits `completeAndMutate(1, 0x596bfba5156, 22, 38)`.
7. Check event and current board revision 2, walls `0xd45b827900a`.
8. History shows both editor addresses and links to genuine Sepolia txs.
9. Capture and archive screen recordings, deploy address, transaction hashes, test run outputs.

**E2E-02 — Stale race**

1. Open rev N simultaneously in browser A/B and start runs.
2. Both solve and prepare legal edits.
3. A wins transaction for N → N+1.
4. B preflight reruns and catches stale (or tx reverts if race hits between preflight and inclusion).
5. B sees explanation and reloads rev N+1; its old route is not silently applied.

**E2E-03 — Safety failure**

1. Complete valid run rev0.
2. Choose tile 8 and attempt direct contract call bypassing UI.
3. Assert revert `UnsolvableMutation`; `walls` and `revision` unchanged.

**E2E-04 — Usability under poor network**

1. Load valid board and disconnect/reject wallet.
2. Local movement continues; mutation unavailable/offline safely.
3. Reconnect and refetch; latest revision displayed.

## 7. Go/no-go criteria

**No-go** bila salah satu hal berikut terjadi:

- Puzzle bisa menjadi unsolvable dari mutasi yang sukses.
- Kontrak mengizinkan noneditable/endpoint edit.
- Mismatched path codec antara TS dan Solidity.
- UI menyatakan transaksi sukses sebelum receipt/state reconciliation.
- Tidak ada transaksi onchain nyata yang dapat diverifikasi.
- Dokumen submission mengklaim keunikan absolut, anti-bot, atau angka traction yang tidak terbukti.

**Go minimal untuk hackathon:** kontrak verified Sepolia, E2E-01 dengan dua akun wallet berbeda dan dua mutation berurutan berhasil, seluruh tes P0 Solidity/property/parity/frontend/E2E lulus, frontend tanpa wallet playable, demo product video ≤3 menit dan pitch 2–3 menit, repo dan README English. Bukti satu mutation saja adalah submission belum lengkap, bukan MVP yang memenuhi gate ini.

## 8. Dokumentasi bukti tes yang perlu diisi setelah implementasi

Gunakan format berikut di repo, **jangan diisi "PASS" sebelum menjalankan tes**:

```text
Test suite: ____________________
Git commit: ____________________
Chain ID / contract: ____________
Test date/time UTC: _____________
Forge test summary: _____________
Fuzz/invariant run config: ______
Gas snapshot & Sepolia receipt: _
E2E-01 TX A: ___________________
E2E-01 TX B: ___________________
Reviewer / issues: _____________
```

---

**Refs:** `PRD.md` sections 5–15; `ADR.md` sections A–G; `reference/fixtures.json`.
