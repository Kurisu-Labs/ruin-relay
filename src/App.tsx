import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { formatEther, formatGwei } from 'viem';
import { configured, deployment } from './config/deployment';
import { Board3D } from './game3d/Board3D';
import { Relay } from './lib/relay';
import { SIGNING_STATUS, ownConfirmedRevision, sameDungeon, unresolved } from './lib/model';
import { editable, EXIT, MAX_MOVES, preview, wallAt } from './lib/rules';

import { usePage, navigate } from './navigation';
import { warmDungeon } from './game3d/preload';
import { GameDialog } from './ui/GameDialog';
import { FullscreenButton } from './ui/FullscreenButton';
import { GameIcon } from './ui/GameIcon';
import { Brand } from './ui/Brand';
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
export default function App({ initialPath = '/' }: { initialPath?: string } = {}) {
  const state = useSyncExternalStore(relay.subscribe, relay.snapshot);
  const path = usePage(initialPath);
  const route = path.split(/[?#]/)[0].replace(/\/$/, '');
  const playing = route === '/play' || route === '/play/3d';
  useEffect(() => {
    if (route !== '/play/3d') return;
    // Keep links to the former alternative view working without a document reload.
    window.history.replaceState(null, '', `/play${window.location.search}${window.location.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [route]);
  const screen = useRef<HTMLDivElement>(null);
  const focusAfterNavigation = useRef(false);
  const [menu, setMenu] = useState<'history' | 'about'>();
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
  const hasRun = Boolean(state.run);
  useEffect(() => {
    focusAfterNavigation.current = playing;
    setMenu(undefined);
    document.title = playing ? 'Play — Ruin Relay' : 'Ruin Relay — Leave a way out';
    if (playing) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [playing, hasRun]);
  useEffect(() => {
    // A route change can close a modal: wait until that cleanup removes its inert backdrop.
    if (playing && menu === undefined && focusAfterNavigation.current) {
      document.querySelector<HTMLElement>('[role="application"]')?.focus({ preventScroll: true });
      focusAfterNavigation.current = false;
    }
  }, [playing, hasRun, menu]);
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href')!;
    if (document.fullscreenElement && href === '/')
      void document.exitFullscreen().catch(() => undefined);
    navigate(href);
  };
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
  const network = !configured ? 'Practice' : deployment.local ? 'Local Anvil' : 'Arbitrum Sepolia';
  const editing = Boolean(escaped || active || state.prepared);
  const history = (
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
  );
  const about = (
    <section id="about">
      <p className="eyebrow">A SMALL WORLD, SHAPED TOGETHER</p>
      <h2>
        Win a way out.
        <br />
        Give the next player a new way in.
      </h2>
      <section className="movement-guide" aria-label="3D movement guide">
        <h3>Find your way in 3D.</h3>
        <p>
          You start facing south. Use <kbd>W</kbd> / <kbd>↑</kbd> to step forward and <kbd>S</kbd> /{' '}
          <kbd>↓</kbd> to step backward, relative to the direction you face.
        </p>
        <p>
          <kbd>A</kbd> / <kbd>←</kbd> and <kbd>D</kbd> / <kbd>→</kbd> sidestep left and right
          without turning. <kbd>Q</kbd> turns left; <kbd>E</kbd> turns right. Turning uses no steps.
        </p>
        <p>
          The buttons below the dungeon work with a mouse or touch. Reach the rune gate to open the
          map and choose one tile to change.
        </p>
      </section>
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
            Connect a wallet only when contributing. The contract checks your old route and the new
            dungeon in one transaction.
          </p>
        </article>
      </div>
      <p className="muted">
        Testnet only. No tokens, NFTs, or monetary rewards. Public solutions can be reused and
        scripts can solve the puzzle. Wallets identify addresses, not unique humans. UI confirmation
        is subject to chain reorganizations and does not claim Ethereum L1 finality. Recovery
        depends on this browser’s site data; clearing it removes the local journal.
      </p>
    </section>
  );
  const notices = (
    <>
      {run && run.path.length >= MAX_MOVES && !escaped && (
        <p role="status">Move limit reached. Restart to try again.</p>
      )}
      {stale && ownRevision !== undefined && (
        <p className="notice" role="status">
          Your edit created revision #{ownRevision.toString()}. Play latest to try the new dungeon.
        </p>
      )}
      {stale && ownRevision === undefined && (
        <p className="notice">
          Someone changed the dungeon first. Finish this run as practice, or play the new revision.
          Commit is disabled.
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
    </>
  );
  const editPanel = (
    <aside className="panel edit-panel" aria-label="Run and edit controls" tabIndex={-1}>
      <p className="eyebrow">LEAVE SOMETHING BEHIND</p>
      <h2>{escaped ? 'Dungeon Escaped!' : 'Your contribution'}</h2>
      {escaped && (
        <div className="editor">
          <p>
            You escaped Revision #{run.snapshot.revision.toString()}. Select one highlighted floor
            to add a wall, or a wall to turn it into floor. Dim tiles are fixed. Leave at least one
            escape route open.
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
                Tile {tile}: {wallAt(run.snapshot.walls, tile!) ? 'Wall → Floor' : 'Floor → Wall'}
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
            completeAndMutate · revision {state.prepared.run.snapshot.revision.toString()} · tile{' '}
            {state.prepared.tile}
          </p>
          <p>
            Gas limit {state.prepared.gas.toString()}
            <br />
            Max fee per gas {formatGwei(state.prepared.maxFeePerGas)} gwei, twice the latest base
            fee plus the priority fee. This cap is refreshed when you submit.
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
        <button onClick={() => void relay.switchNetwork()}>Switch to Arbitrum Sepolia</button>
      )}
      {state.storageWarning && (
        <p role="alert" className="notice">
          {state.storageWarning}
        </p>
      )}
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
    </aside>
  );
  const gameControls = (
    <>
      <a className="game-home" href="/" aria-label="Back to home" onClick={follow}>
        <GameIcon name="home" />
        <span className="control-label">Home</span>
      </a>
      <button disabled={!run || relay.locked} onClick={() => relay.restart()} aria-label="Restart">
        <GameIcon name="restart" />
        <span className="control-label">Restart</span>
      </button>
      <a
        href="#history"
        aria-label="History"
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setMenu('history');
        }}
      >
        <GameIcon name="history" />
        <span className="control-label">History</span>
      </a>
      <FullscreenButton target={screen} />
      <button aria-label="Game menu" aria-haspopup="dialog" onClick={() => setMenu('about')}>
        <GameIcon name="menu" />
        <span className="control-label">Menu</span>
      </button>
      <button
        disabled={relay.locked || !configured}
        onClick={() => void relay.latest()}
        aria-label="Play latest"
      >
        <GameIcon name="latest" />
        <span className="control-label">Play latest</span>
      </button>
      <button
        disabled={!configured}
        onClick={() => void relay.refresh()}
        aria-label="Refresh status"
      >
        <GameIcon name="refresh" />
        <span className="control-label">Refresh</span>
      </button>
    </>
  );
  if (playing)
    return (
      <div className={`play-screen ${editing ? 'is-editing' : ''}`} ref={screen}>
        <header className="play-header">
          <Brand />
          <span className="network">● {network}</span>
        </header>
        <div className="run-hud" aria-label="Run status">
          <div>
            <span className="steps">Steps {run?.path.length ?? 0} / 96</span>
            <p className="run-revision">
              {run ? (
                <>
                  Playing revision {run.snapshot.revision.toString()}
                  {live && ` · Live revision ${live.revision}`}
                </>
              ) : (
                'Reading the dungeon…'
              )}
            </p>
          </div>
        </div>
        <div className="play-banner">
          {notices}
          {!editing && state.error && !state.error.startsWith('Practice seed') && (
            <p className="notice" role="alert">
              {state.error}
            </p>
          )}
          {!editing && state.storageWarning && (
            <p className="notice" role="alert">
              {state.storageWarning}
            </p>
          )}
        </div>
        <main className="game-layout play-workspace" aria-label="Dungeon game">
          <div className={`board-shell${run ? '' : ' board-pending'}`}>
            {run ? (
              <Board3D
                run={run}
                tile={tile}
                locked={relay.locked}
                contribution={
                  latestAttempt?.state === 'confirmed' ? latestAttempt.mutation : undefined
                }
                attemptState={latestAttempt?.state}
                onMove={(direction) => relay.move(direction)}
                onRestart={() => relay.restart()}
                onSelect={(index) => relay.select(index)}
                controls={gameControls}
              />
            ) : (
              <>
                <div className="board-placeholder" role="status">
                  <span className="board-rune">◈</span>
                  <p>{state.online ? 'Preparing dungeon…' : 'Reading the shared dungeon…'}</p>
                  <p className="muted">The room opens when its current revision is ready.</p>
                  <button onClick={() => void relay.refresh()}>Retry connection</button>
                </div>
                <nav className="game-toolbar pending-controls" aria-label="Game controls">
                  {gameControls}
                </nav>
              </>
            )}
          </div>
          {editing && editPanel}
        </main>
        <GameDialog page={menu} onClose={() => setMenu(undefined)} onPage={setMenu}>
          <div hidden={menu !== 'history'}>{history}</div>
          <div hidden={menu !== 'about'}>{about}</div>
        </GameDialog>
      </div>
    );
  return (
    <div className="landing-page">
      <header>
        <a className="brand-link" href="/" onClick={follow} aria-label="Ruin Relay home">
          <Brand />
        </a>
        <nav aria-label="Main">
          <a
            href="/play"
            onClick={follow}
            onMouseEnter={warmDungeon}
            onFocus={warmDungeon}
            onPointerDown={warmDungeon}
          >
            Dungeon
          </a>
          <a href="#history">History</a>
          <a href="#about">How it works</a>
        </nav>
        <span className="network">● {network}</span>
      </header>
      <main>
        <section className="hero lobby-hero">
          <div className="hero-copy">
            <p className="eyebrow">ONE DUNGEON. EVERYONE AFTER YOU.</p>
            <h1>
              Escape it.
              <br />
              <em>Change it.</em>
              <br />
              Leave a way out.
            </h1>
            <p>One shared dungeon. Every verified escape can reshape one tile.</p>
            <div className="hero-actions">
              <a
                className="button primary"
                href="/play"
                onClick={follow}
                onMouseEnter={warmDungeon}
                onFocus={warmDungeon}
                onPointerDown={warmDungeon}
              >
                {run && run.path.length > 0 ? 'Resume your run' : 'Play without a wallet'}{' '}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <span className="hero-note">
              WASD to move · Q/E to turn · Mouse or touch · Wallet only when contributing
            </span>
            {run && run.path.length > 0 && (
              <p className="resume-note">
                Your run is waiting · {run.path.length} steps · revision{' '}
                {run.snapshot.revision.toString()}
              </p>
            )}
          </div>
          <a
            className="dungeon-preview"
            href="/play"
            aria-label="Enter the dungeon"
            onClick={follow}
            onMouseEnter={warmDungeon}
            onFocus={warmDungeon}
            onPointerDown={warmDungeon}
          >
            <div className="preview-art" aria-hidden="true">
              <div className="preview-floor" />
              <div className="preview-arch">
                <span>◈</span>
              </div>
              <i className="preview-torch torch-left" />
              <i className="preview-torch torch-right" />
              <div className="preview-wanderer">✦</div>
              <span className="preview-vignette" />
            </div>
            <div className="preview-caption">
              <span>THE RUINS ARE WAITING</span>
              <strong>
                Enter the dungeon <span aria-hidden="true">↗</span>
              </strong>
              <small>Explore freely. Leave one change behind.</small>
            </div>
          </a>
        </section>
        {about}
        {history}
      </main>
      <footer>
        <Brand />
        <span>Escape the dungeon. Change one tile. Challenge everyone after you.</span>
      </footer>
    </div>
  );
}
