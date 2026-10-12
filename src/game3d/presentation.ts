import type { AttemptState, Mutation, Run } from '../lib/model';
import { sameDungeon } from '../lib/model';
import { move, type Direction } from '../lib/rules';

export interface GameFrame {
  run: Run;
  tile?: number;
  locked: boolean;
  reducedMotion: boolean;
  showLabels: boolean;
  overview: boolean;
  contribution?: Mutation;
  attemptState?: AttemptState;
}
export interface GameActions {
  onSelect: (tile: number) => void;
  onHover: (tile?: number) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onCue: (cue: 'step' | 'blocked' | 'escape' | 'confirmed') => void;
}

/** A changed snapshot or non-prefix path invalidates every old visual callback. */
export function continuousRun(previous: Run, next: Run) {
  return sameDungeon(previous.snapshot, next.snapshot) && next.path.startsWith(previous.path);
}

export function newSteps(previous: Run, next: Run): { tile: number; direction: Direction }[] {
  if (!continuousRun(previous, next)) return [];
  let position = previous.position;
  const result: { tile: number; direction: Direction }[] = [];
  for (const direction of next.path.slice(previous.path.length)) {
    const tile = move(next.snapshot.walls, position, direction as Direction);
    if (tile === null) return [];
    position = tile;
    result.push({ tile, direction: direction as Direction });
  }
  return position === next.position ? result : [];
}
