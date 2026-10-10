# Presentation recording script

Draft English narration for a separate **two-to-three-minute** presentation. Record and time it after the Sepolia evidence is complete. Replace the bracketed evidence cue with the actual verified deployment and two receipts. This script is not evidence that those steps have happened.

“Most puzzle levels end when the player escapes. Ruin Relay asks a different question: what if solving the puzzle changed the challenge for everyone after you?

There is one shared seven-by-seven dungeon. Anyone can open it and play without a wallet. Reach the exit within ninety-six moves, then preview a toggle of one allowed wall or floor. A contribution is optional, and the editor explains whether the proposed board still has an escape route.

The shared state lives in a small Solidity contract on Arbitrum Sepolia. One transaction checks the submitted path against the old board, checks the selected tile, searches the edited board for reachability, and advances the revision once. It has no owner override, upgrade proxy, token reward, or custody of player funds.

The browser keeps the playing snapshot separate from the live dungeon. If another player edits first, you can finish your old run as practice, but it cannot commit. A pending or unknown submission retains its fixed identity and blocks overlapping submissions across tabs. Reloads, wallet speed-ups, RPC failures, and reorganizations are treated as evidence problems: the app verifies the outcome instead of guessing or resubmitting.

[Show the source-verified contract and real A/B receipts.] The demonstration follows two distinct wallets: tile 31 creates revision one, then tile 38 creates revision two. The resulting masks match the published fixtures. Automated checks exercise the public contract, independent reachability oracles, shared rules, and browser behavior against Anvil.

The integrity limits are explicit. Public solutions can be copied, scripts can solve the maze, and a wallet address does not prove a unique human. This is a testnet collaboration experiment, not a fairness or financial product.

Our hypothesis is that inheriting another person's edit gives players a reason to return and invite someone else. Retention and business value remain unvalidated. The next step is observing real play and learning whether that relay creates a compelling loop.”

Credit the existing design handoff as prior work. Show only test results and deployment claims supported by the final evidence record; do not describe this implementation as an independent security audit.
