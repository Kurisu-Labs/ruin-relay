import { useEffect, useState, useSyncExternalStore } from 'react';
import { formatEther, formatGwei } from 'viem';
import { configured, deployment } from './config/deployment';
import { Board } from './game/Board';
import { Relay } from './lib/relay';
import { SIGNING_STATUS, ownConfirmedRevision, sameDungeon, unresolved } from './lib/model';
import { editable, EXIT, MAX_MOVES, preview, wallAt } from './lib/rules';

const relay = new Relay();
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
function TxLink({ hash }: { hash: string }) {
  return deployment.local ? (
    <code className="hash">{hash}</code>
  ) : (
    <a className="hash" href={`${deployment.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
      {hash} ↗
    </a>
  );
}
export default function App() {
  const state = useSyncExternalStore(relay.subscribe, relay.snapshot);
  const [recoveryHash, setRecoveryHash] = useState('');
  const [shared, setShared] = useState(false);
  useEffect(() => {
    void relay.start();
    const interval = setInterval(() => void relay.refresh(), 5000);
    const refresh = () => void relay.refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const { run, live, tile } = state;
  const active = state.attempts.find(unresolved);
  const latestAttempt = active ?? state.attempts.at(-1);
  const escaped = run?.position === EXIT;
  const stale = Boolean(run && live && !sameDungeon(run.snapshot, live));
  const ownRevision = run && live ? ownConfirmedRevision(run, live, state.attempts) : undefined;
  const draft =
    run && tile !== undefined
      ? preview(run.snapshot.walls, run.snapshot.editableMask, tile)
      : undefined;
  const commitBlocker = !configured
    ? 'This is a practice dungeon. You can preview one edit, but saving it needs a connected dungeon.'
    : relay.locked
      ? 'An edit is being prepared or checked. Wait for its status before committing again.'
      : stale
        ? ownRevision !== undefined
          ? `Your edit is saved in revision #${ownRevision}. Choose Play latest and escape again to make another change.`
          : 'The dungeon changed during your run. Choose Play latest and escape the new revision to save an edit.'
        : !state.online || !live
          ? 'The shared dungeon is unavailable. Choose Refresh status to reconnect before saving.'
          : !relay.coordinationAvailable
            ? state.recoveryError ||
              'This browser cannot safely coordinate edits across tabs. Use a browser with Web Locks on HTTPS or localhost.'
            : tile === undefined
              ? 'Choose a highlighted floor to add a wall, or a highlighted wall to remove it.'
              : !draft?.solvable
                ? 'Choose a different tile. At least one route from START to EXIT must stay open.'
                : undefined;
  const canCommit = escaped && !commitBlocker;
  return (
    <>
      <header>
        <a className="brand" href="/">
          ◈ RUIN RELAY
        </a>
        <nav aria-label="Main">
          <a href="#play">Dungeon</a>
          <a href="#history">History</a>
          <a href="#about">How it works</a>
        </nav>
        <span className="network">
          ● {!configured ? 'Practice' : deployment.local ? 'Local Anvil' : 'Arbitrum Sepolia'}
        </span>
      </header>
      <main>
        <section className="hero">
          <p className="eyebrow">ONE DUNGEON. EVERYONE AFTER YOU.</p>
          <h1>
            Escape it.
            <br />
            <em>Change it.</em>
            <br />
            Leave a way out.
          </h1>
          <p>One shared dungeon. Every verified escape can reshape one tile.</p>
          <a
            className="button primary"
            href="#play"
            onClick={() =>
              setTimeout(
                () => document.querySelector<HTMLElement>('[role="application"]')?.focus(),
                50,
              )
            }
          >
            Play without a wallet <span>↘</span>
          </a>
          <span className="hero-note">7 × 7 tiles · One change · The next player inherits it</span>
          <div className="hero-mark" aria-hidden="true">
            ↳
          </div>
        </section>
        <section id="play" className="game-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE SHARED DUNGEON</p>
              <h2>Find your way through.</h2>
            </div>
            <span className="revision">
              {live
                ? `Live revision ${live.revision}`
                : configured
                  ? 'Reading chain…'
                  : 'Practice seed'}
            </span>
          </div>
          <div className="game-layout">
            <div className="board-shell">
              {run ? (
                <Board
                  run={run}
                  tile={tile}
                  locked={relay.locked}
                  contribution={
                    latestAttempt?.state === 'confirmed' ? latestAttempt.mutation : undefined
                  }
                  attemptState={latestAttempt?.state}
                  onMove={(d) => relay.move(d)}
                  onRestart={() => relay.restart()}
                  onSelect={(index) => relay.select(index)}
                />
              ) : (
                <div className="board-placeholder">
                  {state.online
                    ? 'Preparing dungeon…'
                    : 'Waiting for the dungeon. Check the RPC connection and refresh.'}
                </div>
              )}
            </div>
            <aside className="panel" aria-label="Run and edit controls">
              <p className="eyebrow">YOUR RUN</p>
              <h3>{escaped ? 'Dungeon Escaped!' : 'Leave something behind.'}</h3>
              {run && (
                <>
                  <p className="steps">Steps {run.path.length} / 96</p>
                  <p>
                    Playing revision {run.snapshot.revision.toString()}
                    {live && ` · Live revision ${live.revision}`}
                  </p>
                </>
              )}
              {!escaped && (
                <p className="muted">
                  Focus the board. Move with <kbd>WASD</kbd> or the arrow keys. <kbd>R</kbd>{' '}
                  restarts. W moves up, A left, S down, and D right. Reach EXIT to choose one edit.
                </p>
              )}
              {run && run.path.length >= MAX_MOVES && !escaped && (
                <p role="status">Move limit reached. Restart to try again.</p>
              )}
              {stale && ownRevision !== undefined && (
                <p className="notice" role="status">
                  Your edit created revision #{ownRevision.toString()}. Play latest to try the new
                  dungeon.
                </p>
              )}
              {stale && ownRevision === undefined && (
                <p className="notice">
                  Someone changed the dungeon first. Finish this run as practice, or play the new
                  revision. Commit is disabled.
                </p>
              )}
              {configured && !state.online && (
                <p className="notice" role="status">
                  Offline / stale observation. Local play can continue; Commit is disabled.
                </p>
              )}
              {!configured && (
                <p className="notice">
                  Practice dungeon · play and preview edits here. Saving a change is unavailable.
                </p>
              )}
              {configured && !relay.coordinationAvailable && (
                <p className="notice">
                  {state.recoveryError ||
                    'Atomic coordination across tabs is unavailable. Local play works; Commit is disabled.'}
                </p>
              )}
              <div className="actions">
                <button disabled={!run || relay.locked} onClick={() => relay.restart()}>
                  Restart
                </button>
                <button disabled={relay.locked || !configured} onClick={() => void relay.latest()}>
                  Play latest
                </button>
                <button disabled={!configured} onClick={() => void relay.refresh()}>
                  Refresh status
                </button>
              </div>
              {escaped && (
                <div className="editor">
                  <p>
                    You escaped Revision #{run.snapshot.revision.toString()}. Select one highlighted
                    floor to add a wall, or a wall to turn it into floor. Dim tiles are fixed. Leave
                    at least one escape route open.
                  </p>
                  <div className="tile-picker" aria-label="Editable tiles">
                    {Array.from({ length: 49 }, (_, i) => (
                      <button
                        key={i}
                        aria-label={`Tile ${i}: ${wallAt(run.snapshot.walls, i) ? 'wall to floor' : 'floor to wall'}`}
                        aria-pressed={tile === i}
                        disabled={relay.locked || !editable(run.snapshot.editableMask, i)}
                        className={`${wallAt(run.snapshot.walls, i) ? 'wall' : 'floor'} ${tile === i ? 'selected' : ''}`}
                        onClick={() => relay.select(i)}
                      >
                        {i === 0 ? 'S' : i === 48 ? 'E' : i}
                      </button>
                    ))}
                  </div>
                  {draft && (
                    <div aria-live="polite">
                      <p className="draft-change">
                        Tile {tile}:{' '}
                        {wallAt(run.snapshot.walls, tile!) ? 'Wall → Floor' : 'Floor → Wall'}
                      </p>
                      <p className="muted">Preview only · your change has not been saved.</p>
                      <p className={draft.solvable ? 'valid' : 'notice'}>
                        {draft.solvable
                          ? 'Your edit keeps an escape route open.'
                          : 'That edit blocks every route to the exit.'}
                      </p>
                      <p className="mask">
                        Before {`0x${run.snapshot.walls.toString(16)}`}
                        <br />
                        After {`0x${draft.walls.toString(16)}`}
                      </p>
                    </div>
                  )}
                  <button
                    className="primary wide"
                    disabled={!canCommit}
                    aria-describedby="commit-help"
                    onClick={() => void relay.prepare()}
                  >
                    Commit one change
                  </button>
                  <p id="commit-help" className="commit-help" role="status">
                    {commitBlocker ||
                      'Ready to review. Commit one change connects your wallet and estimates the transaction. Nothing is submitted until you choose Sign and submit edit.'}
                  </p>
                  <button
                    disabled={relay.locked || tile === undefined}
                    onClick={() => relay.select(undefined)}
                  >
                    Cancel edit
                  </button>
                </div>
              )}
              {state.prepared && (
                <section className="sign-summary" aria-label="Transaction preview">
                  <h4>Review your change</h4>
                  <p>Arbitrum Sepolia · Chain 421614</p>
                  <p>Account {state.prepared.account}</p>
                  <p>Contract {deployment.address}</p>
                  <p>
                    completeAndMutate · revision {state.prepared.run.snapshot.revision.toString()} ·
                    tile {state.prepared.tile}
                  </p>
                  <p>
                    Gas limit {state.prepared.gas.toString()}
                    <br />
                    Max fee per gas {formatGwei(state.prepared.maxFeePerGas)} gwei, twice the latest
                    base fee plus the priority fee. This cap is refreshed when you submit.
                    <br />
                    Maximum fee at that cap: {formatEther(state.prepared.fee)} test ETH
                  </p>
                  <button
                    className="primary wide"
                    disabled={relay.locked || !canCommit}
                    onClick={() => void relay.send()}
                  >
                    Sign and submit edit
                  </button>
                </section>
              )}
              {state.busy && <p role="status">Preparing your transaction / waiting for wallet…</p>}
              {state.error && (
                <p className="notice" role="alert">
                  {state.error}
                </p>
              )}
              {state.error.startsWith('Wrong network.') && (
                <button onClick={() => void relay.switchNetwork()}>
                  Switch to Arbitrum Sepolia
                </button>
              )}
              {state.storageWarning && (
                <p role="alert" className="notice">
                  {state.storageWarning}
                </p>
              )}
            </aside>
          </div>
          {latestAttempt && (
            <section className="transaction" aria-label="Commit attempt">
              <p className="eyebrow">COMMIT ATTEMPT · {latestAttempt.state.toUpperCase()}</p>
              <p role="status">
                {latestAttempt.message ||
                  (latestAttempt.state === 'signing'
                    ? SIGNING_STATUS
                    : 'Still checking your transaction.')}
              </p>
              {latestAttempt.hashes.map((hash) => (
                <TxLink key={hash} hash={hash} />
              ))}
              {active && (
                <>
                  <p>
                    {active.state === 'signing'
                      ? 'The run and edit stay locked until you approve or reject this wallet request. Retry status only rechecks.'
                      : 'The run and edit are locked until this attempt has a verified outcome. Check your wallet activity or explorer; Retry status performs reads only.'}
                  </p>
                  <button onClick={() => void relay.refresh()}>Retry status</button>
                  {active.state !== 'signing' && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void relay.recover(recoveryHash.trim());
                      }}
                    >
                      <label htmlFor="recovery">Recover with transaction hash</label>
                      <div className="recovery">
                        <input
                          id="recovery"
                          value={recoveryHash}
                          onChange={(event) => setRecoveryHash(event.target.value)}
                          placeholder="0x…"
                          autoComplete="off"
                        />
                        <button type="submit">Verify hash</button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </section>
          )}
          {state.attempts
            .filter((a) => a.mutation)
            .map((a) => (
              <p className="success" key={a.id}>
                Your edit created revision #{a.mutation!.revision.toString()}.{' '}
                {live && `The dungeon is now at revision #${live.revision}.`}{' '}
                <TxLink hash={a.mutation!.hash} />
              </p>
            ))}
          <p className="public-meta">
            {configured
              ? `Chain ID 421614 · ${deployment.local ? 'Local test deployment' : 'Arbitrum Sepolia testnet'}`
              : 'Practice seed · no blockchain deployment connected'}
            {deployment.address && (
              <>
                {' '}
                · <code>{deployment.address}</code>
                {!deployment.local && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={`${deployment.explorer}/address/${deployment.address}#code`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Contract source ↗
                    </a>
                  </>
                )}
              </>
            )}
          </p>
        </section>
        <section id="history">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE RELAY SO FAR</p>
              <h2>Every change leaves a trace.</h2>
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${location.origin}/play`);
                  setShared(true);
                } catch {
                  setShared(false);
                }
              }}
            >
              {shared ? 'Link copied' : 'Share current dungeon ↗'}
            </button>
          </div>
          <p className="muted">
            The ten most recent available mutations. Public links open the current dungeon.
          </p>
          {state.historyError ? (
            <p className="notice">
              History unavailable. Current dungeon reads and local play remain available.
            </p>
          ) : state.history.length ? (
            <div className="history-list">
              {state.history.map((event) => (
                <article key={`${event.hash}:${event.logIndex}`}>
                  <strong>#{event.revision.toString()}</strong>
                  <span>
                    Tile {event.tileIndex} · {event.becameWall ? 'Floor → Wall' : 'Wall → Floor'}
                  </span>
                  <span title={event.editor}>{short(event.editor)}</span>
                  <TxLink hash={event.hash} />
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">
              {configured
                ? 'No mutations observed yet. The first change could be yours.'
                : 'Connect a deployment to read its history.'}
            </p>
          )}
        </section>
        <section id="about">
          <p className="eyebrow">A SMALL WORLD, SHAPED TOGETHER</p>
          <h2>
            Win a way out.
            <br />
            Give the next player a new way in.
          </h2>
          <div className="how-grid">
            <article>
              <span>01 / ESCAPE</span>
              <h3>Play freely.</h3>
              <p>
                Follow the stone paths to the exit. Your run stays on the same snapshot even when
                someone else changes the live dungeon.
              </p>
            </article>
            <article>
              <span>02 / RESHAPE</span>
              <h3>Change one tile.</h3>
              <p>
                Choose an allowed wall or floor after escaping. The preview checks whether a route
                remains open.
              </p>
            </article>
            <article>
              <span>03 / PASS IT ON</span>
              <h3>Leave a public trace.</h3>
              <p>
                Connect a wallet only when contributing. The contract checks your old route and the
                new dungeon in one transaction.
              </p>
            </article>
          </div>
          <p className="muted">
            Testnet only. No tokens, NFTs, or monetary rewards. Public solutions can be reused and
            scripts can solve the puzzle. Wallets identify addresses, not unique humans. UI
            confirmation is subject to chain reorganizations and does not claim Ethereum L1
            finality. Recovery depends on this browser’s site data; clearing it removes the local
            journal.
          </p>
        </section>
      </main>
      <footer>
        <span>◈ RUIN RELAY</span>
        <span>Escape the dungeon. Change one tile. Challenge everyone after you.</span>
      </footer>
    </>
  );
}
