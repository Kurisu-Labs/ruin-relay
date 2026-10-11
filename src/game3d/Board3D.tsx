import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AttemptState, Mutation, Run } from '../lib/model';
import { editable, EXIT, MAX_MOVES, move, wallAt, type Direction } from '../lib/rules';
import { continuousRun, type GameFrame } from './presentation';
import { GameSound } from './sound';
import { GameIcon } from '../ui/GameIcon';
import { loadDungeon3D } from './preload';
import { keyIntent3D, travelDirection, turn, type Heading, type Intent3D } from './spatial';
import type { ThreeBridge } from './ThreeBridge';
import './controls.css';
import './game3d.css';

interface Props {
  run: Run;
  tile?: number;
  locked: boolean;
  contribution?: Mutation;
  attemptState?: AttemptState;
  onMove: (direction: Direction) => void;
  onRestart: () => void;
  onSelect: (tile: number) => void;
  controls?: ReactNode;
}

function initialMotion() {
  try {
    const saved = localStorage.getItem('ruin-relay:motion');
    return saved === null
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : saved === 'reduced';
  } catch {
    return false;
  }
}

const bearings = ['North', 'East', 'South', 'West'];
const buttons = [
  {
    intent: 'turnLeft',
    label: 'Turn left',
    key: 'Q',
    path: 'M7 10V4m0 0H1m6 0-5 5m5-5a10 10 0 0 1 13 10v6',
  },
  { intent: 'forward', label: 'Step forward', key: 'W', path: 'M12 20V4m-7 7 7-7 7 7' },
  {
    intent: 'turnRight',
    label: 'Turn right',
    key: 'E',
    path: 'M17 10V4m0 0h6m-6 0 5 5m-5-5A10 10 0 0 0 4 14v6',
  },
  { intent: 'left', label: 'Sidestep left', key: 'A', path: 'M20 12H4m7-7-7 7 7 7M2 4v16' },
  { intent: 'backward', label: 'Step backward', key: 'S', path: 'M12 4v16m-7-7 7 7 7-7' },
  { intent: 'right', label: 'Sidestep right', key: 'D', path: 'M4 12h16m-7-7 7 7-7 7M22 4v16' },
] as const;

/** The Relay intents; the first-person heading belongs only to this view. */
export function Board3D(props: Props) {
  const { run, tile, locked, contribution, attemptState } = props;
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<ThreeBridge | undefined>(undefined);
  const sound = useRef<GameSound | undefined>(undefined);
  const heading = useRef<Heading>(2);
  const [bearing, setBearing] = useState<Heading>(2);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [hover, setHover] = useState<number>();
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(initialMotion);
  const [showLabels, setShowLabels] = useState(false);
  const previousRun = useRef(run);
  const overview = run.position === EXIT;
  const frame: GameFrame = {
    run,
    tile,
    locked,
    contribution,
    attemptState,
    reducedMotion,
    showLabels,
    overview,
  };
  const current = useRef({ props, frame, ready, error, muted });
  current.current = { props, frame, ready, error, muted };

  const face = (next: Heading) => {
    heading.current = next;
    setBearing(next);
    bridge.current?.setHeading(next);
  };
  const sendIntent = (intent: Intent3D) => {
    const { props: latest, ready: isReady, error: viewError } = current.current;
    if (!isReady || viewError || latest.locked) return;
    if (intent === 'restart') {
      face(2);
      bridge.current?.resetMotion();
      latest.onRestart();
      return;
    }
    if (latest.run.position === EXIT || latest.run.path.length >= MAX_MOVES) return;
    if (intent === 'turnLeft' || intent === 'turnRight') {
      face(turn(heading.current, intent === 'turnLeft' ? -1 : 1));
      return;
    }
    const direction = travelDirection(heading.current, intent);
    if (move(latest.run.snapshot.walls, latest.run.position, direction) === null) {
      sound.current?.play('blocked');
      bridge.current?.blocked();
    }
    // The Relay accepts/rejects synchronously; camera tweens never gate another legal step.
    latest.onMove(direction);
  };

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      try {
        if (localStorage.getItem('ruin-relay:motion') !== null) return;
      } catch {
        /* Session preference. */
      }
      setReducedMotion(media.matches);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let disposed = false;
    let engine: ThreeBridge | undefined;
    let booted = false;
    setReady(false);
    setError(undefined);
    setHover(undefined);
    sound.current ??= new GameSound();
    const fail = (message: string) => {
      if (disposed) return;
      booted = true;
      setReady(false);
      setError(message);
    };
    void loadDungeon3D()
      .then(({ ThreeBridge }) => {
        if (disposed || !host.current) return;
        try {
          engine = new ThreeBridge(host.current, current.current.frame, heading.current, {
            onSelect: (index) => {
              if (!disposed) current.current.props.onSelect(index);
            },
            onHover: (index) => {
              if (!disposed) setHover(index);
            },
            onReady: () => {
              if (!disposed) {
                booted = true;
                setReady(true);
                setError(undefined);
              }
            },
            onError: fail,
            onCue: (cue) => {
              if (!disposed) sound.current?.play(cue);
            },
          });
          bridge.current = engine;
        } catch {
          fail(
            'This 3D view needs WebGL 2. Enable hardware acceleration or use a compatible browser, then retry.',
          );
        }
      })
      .catch(() => fail('The 3D engine could not load. Check the connection and retry.'));
    const timeout = setTimeout(() => {
      if (!booted && !disposed)
        fail('The 3D view is taking too long to load. Retry to reopen the dungeon.');
    }, 20000);
    const element = host.current;
    const keydown = (event: KeyboardEvent) => {
      if (!element || document.activeElement !== element || event.target !== element) return;
      const intent = keyIntent3D(event);
      if (!intent || !current.current.ready || current.current.error) return;
      event.preventDefault();
      sendIntent(intent);
    };
    const blur = () => bridge.current?.clearHover();
    const visibility = () => {
      if (document.hidden) void sound.current?.enable(false);
      else if (!current.current.muted) void sound.current?.enable(true);
    };
    element?.addEventListener('keydown', keydown);
    element?.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      element?.removeEventListener('keydown', keydown);
      element?.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      if (bridge.current === engine) bridge.current = undefined;
      engine?.destroy();
    };
  }, [retry]);

  useEffect(() => {
    if (
      !continuousRun(previousRun.current, run) ||
      (run !== previousRun.current && run.path === '')
    )
      face(2);
    previousRun.current = run;
    bridge.current?.setFrame(frame);
  }, [run, tile, locked, contribution, attemptState, reducedMotion, showLabels, overview]);
  useEffect(
    () => () => {
      sound.current?.destroy();
      sound.current = undefined;
    },
    [],
  );

  const inspected = tile ?? hover;
  const inspectedText =
    inspected === undefined
      ? undefined
      : `Tile ${inspected} · ${wallAt(run.snapshot.walls, inspected) ? 'Wall' : 'Floor'} · ${editable(run.snapshot.editableMask, inspected) ? 'Editable after escape' : 'Fixed'}`;
  const phase = locked
    ? 'Transaction in progress · controls locked'
    : overview
      ? 'Escaped · choose one highlighted tile'
      : run.path.length >= MAX_MOVES
        ? 'Move limit reached · restart to try again'
        : 'Find the rune gate';
  const movementDisabled = !ready || !!error || locked || overview || run.path.length >= MAX_MOVES;

  return (
    <div className={`dungeon-board dungeon-three${overview ? ' is-overview' : ''}`}>
      <div className="board-viewport">
        <div className="board-stage">
          <div
            className="board board3d"
            ref={host}
            role="application"
            aria-busy={!ready}
            data-view={overview ? 'map' : 'first-person'}
            aria-describedby="board3d-instructions"
            aria-keyshortcuts="W A S D Q E ArrowUp ArrowRight ArrowDown ArrowLeft R"
            tabIndex={0}
            aria-label={`3D dungeon. Player at tile ${run.position}. Facing ${bearings[bearing]}. W and S to walk; A and D to sidestep; Q and E to turn.`}
            onPointerDown={() => host.current?.focus({ preventScroll: true })}
          />
          {ready && !overview && (
            <>
              <div className="board3d-bearing" aria-hidden="true">
                <span>◈</span> {bearings[bearing]}
              </div>
              <div className="board3d-reticle" aria-hidden="true" />
              <p className="board3d-key-hint" aria-hidden="true">
                W S <span>walk</span> · A D <span>sidestep</span> · Q E <span>turn</span>
              </p>
            </>
          )}
          {!ready && (
            <div className="board-message" role={error ? 'alert' : 'status'}>
              <span className="board-rune" aria-hidden="true">
                ◈
              </span>
              <p>{error || 'Lighting the vault…'}</p>
              {error && (
                <button onClick={() => setRetry((n) => n + 1)}>Retry 3D dungeon view</button>
              )}
            </div>
          )}
        </div>
        <div className="board-controls">
          <div className="board-dpad board3d-dpad" role="group" aria-label="Movement controls">
            {buttons.map(({ intent, label, key, path }) => (
              <button
                key={intent}
                type="button"
                className="board-direction"
                aria-label={label}
                title={`${label} (${key})`}
                aria-describedby="board3d-instructions"
                disabled={movementDisabled}
                onClick={() => sendIntent(intent)}
                onKeyDown={(event) => {
                  if (event.repeat && (event.key === 'Enter' || event.key === ' '))
                    event.preventDefault();
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={path} />
                </svg>
                <span aria-hidden="true">{key}</span>
              </button>
            ))}
          </div>
          <nav className="game-toolbar" aria-label="Game controls">
            {props.controls}
            <details
              className="board-settings"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                  event.stopPropagation();
                }
              }}
            >
              <summary aria-label="View settings">
                <GameIcon name="settings" />
                <span className="control-label">Settings</span>
              </summary>
              <div className="board-options" aria-label="Dungeon view preferences">
                <button
                  aria-pressed={!muted}
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    void sound.current?.enable(!next);
                  }}
                >
                  Sound {muted ? 'off' : 'on'}
                </button>
                <button
                  aria-pressed={reducedMotion}
                  onClick={() => {
                    const next = !reducedMotion;
                    setReducedMotion(next);
                    try {
                      localStorage.setItem('ruin-relay:motion', next ? 'reduced' : 'full');
                    } catch {
                      /* Session preference. */
                    }
                  }}
                >
                  Reduced motion
                </button>
                <button aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}>
                  Tile numbers on map
                </button>
              </div>
            </details>
          </nav>
          <div className="board-status" role="status" aria-live="polite" aria-atomic="true">
            {locked ? phase : inspectedText || phase}
          </div>
          <p id="board3d-instructions" className="board-instructions">
            {overview
              ? 'Choose a highlighted floor to preview a wall, or a wall to preview a floor.'
              : 'W / up: forward. S / down: backward. A / left: sidestep left. D / right: sidestep right. Q: turn left. E: turn right. R: restart. Each on-screen button is one step or turn.'}
          </p>
        </div>
      </div>
    </div>
  );
}
