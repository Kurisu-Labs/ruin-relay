import { useEffect, useRef, useState } from 'react';
import type { AttemptState, Mutation, Run } from '../lib/model';
import { editable, EXIT, MAX_MOVES, move, wallAt, type Direction } from '../lib/rules';
import type { GameBridge } from './GameBridge';
import { keyIntent } from './input';
import type { GameFrame } from './presentation';
import { GameSound } from './sound';

interface Props {
  run: Run;
  tile?: number;
  locked: boolean;
  contribution?: Mutation;
  attemptState?: AttemptState;
  onMove: (direction: Direction) => void;
  onRestart: () => void;
  onSelect: (tile: number) => void;
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

export function Board(props: Props) {
  const { run, tile, locked, contribution, attemptState } = props;
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<GameBridge | undefined>(undefined);
  const sound = useRef<GameSound | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [hover, setHover] = useState<number>();
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(initialMotion);
  const [showLabels, setShowLabels] = useState(false);
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
    let engine: GameBridge | undefined;
    setReady(false);
    setError(undefined);
    setHover(undefined);
    sound.current ??= new GameSound();
    const fail = (message: string) => {
      if (disposed) return;
      setReady(false);
      setError(message);
    };
    void import('./GameBridge')
      .then(({ GameBridge }) => {
        if (disposed || !host.current) return;
        try {
          engine = new GameBridge(host.current, current.current.frame, {
            onSelect: (index) => {
              if (!disposed) current.current.props.onSelect(index);
            },
            onHover: (index) => {
              if (!disposed) setHover(index);
            },
            onReady: () => {
              if (!disposed) {
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
            'This browser could not start WebGL. Enable hardware acceleration, then retry the dungeon view.',
          );
        }
      })
      .catch(() => fail('The game engine could not load. Check the connection and retry.'));
    const timeout = setTimeout(() => {
      if (!current.current.ready && !current.current.error)
        fail('The dungeon view is taking too long to load. Retry to reconnect.');
    }, 20000);
    const element = host.current;
    const handled = new WeakSet<KeyboardEvent>();
    const keydown = (event: KeyboardEvent) => {
      if (
        handled.has(event) ||
        !element ||
        document.activeElement !== element ||
        event.target !== element
      )
        return;
      const intent = keyIntent(event);
      if (!intent || !current.current.ready || current.current.error) return;
      handled.add(event);
      event.preventDefault();
      const { props: latest } = current.current;
      if (intent === 'restart') {
        if (!latest.locked) bridge.current?.resetMotion();
        latest.onRestart();
        return;
      }
      if (
        !latest.locked &&
        latest.run.position !== EXIT &&
        latest.run.path.length < MAX_MOVES &&
        move(latest.run.snapshot.walls, latest.run.position, intent) === null
      ) {
        sound.current?.play('blocked');
        bridge.current?.blocked();
      }
      // Relay reads its current state synchronously, even before React has rendered a preceding reset.
      latest.onMove(intent);
    };
    const blur = () => bridge.current?.clearHover();
    element?.addEventListener('keydown', keydown);
    element?.addEventListener('blur', blur);
    const visibility = () => {
      if (document.hidden) {
        bridge.current?.clearHover();
        void sound.current?.enable(false);
      } else if (!current.current.muted) void sound.current?.enable(true);
    };
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
    : run.position === EXIT
      ? 'Escaped · choose one highlighted tile'
      : run.path.length >= MAX_MOVES
        ? 'Move limit reached · restart to try again'
        : 'Reach the glowing exit';

  return (
    <>
      <div className="board-heading" aria-hidden="true">
        <span>THE RUINS</span>
        <span>{overview ? 'CHOOSE YOUR CHANGE' : 'EXPLORING THE RUINS'}</span>
      </div>
      <div className="board-viewport">
        <div
          className="board"
          ref={host}
          role="application"
          aria-busy={!ready}
          data-view={overview ? 'map' : 'follow'}
          aria-describedby="board-instructions"
          aria-keyshortcuts="W A S D ArrowUp ArrowRight ArrowDown ArrowLeft R"
          tabIndex={0}
          aria-label={`Dungeon board. Player at tile ${run.position}. Use WASD or arrow keys.`}
          onPointerDown={() => host.current?.focus({ preventScroll: true })}
        />
        <div className="board-compass" aria-hidden="true">
          N ↑
        </div>
        <div className="board-camera-note" aria-hidden="true">
          {overview ? 'Escape complete · choose one edit' : 'Close view · camera follows you'}
        </div>
        {!ready && (
          <div className="board-message" role={error ? 'alert' : 'status'}>
            <span className="board-rune" aria-hidden="true">
              ◈
            </span>
            <p>{error || 'Lighting the dungeon…'}</p>
            {error && <button onClick={() => setRetry((n) => n + 1)}>Retry dungeon view</button>}
          </div>
        )}
      </div>
      <div className="board-status" role="status" aria-live="polite" aria-atomic="true">
        {locked ? phase : inspectedText || phase}
      </div>
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
          Tile numbers
        </button>
      </div>
      <p id="board-instructions" className="board-instructions">
        Focus the dungeon to play. <kbd>W ↑</kbd> up · <kbd>A ←</kbd> left · <kbd>S ↓</kbd> down ·{' '}
        <kbd>D →</kbd> right · <kbd>R</kbd> restart. After escape, the edit map opens. Choose a
        highlighted floor to preview a new wall, or use the tile buttons.
      </p>
    </>
  );
}
