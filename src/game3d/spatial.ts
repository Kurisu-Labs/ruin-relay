import { BOARD_SIZE, type Direction } from '../lib/rules';

export const CELL = 3.2;
export const WALL_HEIGHT = 3.1;
export const EYE_HEIGHT = 1.62;
export const WORLD_WIDTH = (BOARD_SIZE + 2) * CELL;
export type Heading = 0 | 1 | 2 | 3;
export type Travel = 'forward' | 'backward' | 'left' | 'right';
export type Intent3D = Travel | 'turnLeft' | 'turnRight' | 'restart';
const directions: Direction[] = ['U', 'R', 'D', 'L'];

export function tilePosition(tile: number) {
  return { x: ((tile % BOARD_SIZE) - 3) * CELL, z: (Math.floor(tile / BOARD_SIZE) - 3) * CELL };
}

export function tileAt(x: number, z: number): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  const column = Math.floor(x / CELL + BOARD_SIZE / 2);
  const row = Math.floor(z / CELL + BOARD_SIZE / 2);
  if (column < 0 || column >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return;
  return row * BOARD_SIZE + column;
}

export function turn(heading: Heading, delta: -1 | 1): Heading {
  return ((heading + delta + 4) % 4) as Heading;
}

export function travelDirection(heading: Heading, travel: Travel): Direction {
  const offset = { forward: 0, right: 1, backward: 2, left: 3 }[travel];
  return directions[(heading + offset) % 4];
}

/** Three's camera faces -Z at rotation zero; world north is also -Z. */
export function headingAngle(heading: Heading) {
  return (-heading * Math.PI) / 2;
}

export function keyIntent3D(
  event: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>,
): Intent3D | undefined {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  return (
    {
      w: 'forward',
      ArrowUp: 'forward',
      s: 'backward',
      ArrowDown: 'backward',
      a: 'left',
      ArrowLeft: 'left',
      d: 'right',
      ArrowRight: 'right',
      q: 'turnLeft',
      e: 'turnRight',
      r: 'restart',
    } as Record<string, Intent3D>
  )[event.key.startsWith('Arrow') ? event.key : event.key.toLowerCase()];
}
