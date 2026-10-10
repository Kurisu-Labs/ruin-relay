import { BOARD_SIZE, type Direction } from '../lib/rules';

export interface Point {
  x: number;
  y: number;
}
export const TILE_SIZE = 96;
export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 540;
export const WORLD_SIZE = (BOARD_SIZE + 2) * TILE_SIZE;
export type Facing = 'n' | 'e' | 's' | 'w';
export const facing: Record<Direction, Facing> = { U: 'n', R: 'e', D: 's', L: 'w' };

/** Screen up is domain up. The contract's indices and path alphabet stay unchanged. */
export function project(tile: number): Point {
  return {
    x: ((tile % BOARD_SIZE) - 3) * TILE_SIZE,
    y: (Math.floor(tile / BOARD_SIZE) - 3) * TILE_SIZE,
  };
}

/** Half-open footprints make every pixel select one tile, including shared boundaries. */
export function pickTile(point: Point): number | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const x = Math.floor(point.x / TILE_SIZE + BOARD_SIZE / 2);
  const y = Math.floor(point.y / TILE_SIZE + BOARD_SIZE / 2);
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return;
  return y * BOARD_SIZE + x;
}

export function footprint(center: Point, inset = 0): Point[] {
  const r = TILE_SIZE / 2 - inset;
  return [
    { x: center.x - r, y: center.y - r },
    { x: center.x + r, y: center.y - r },
    { x: center.x + r, y: center.y + r },
    { x: center.x - r, y: center.y + r },
  ];
}

export function depth(groundY: number, priority = 0, tile = 0) {
  return 5000 + groundY * 10 + priority + tile / 1000;
}

export function cameraFit(width: number, height: number) {
  return Math.min(width, height) / (WORLD_SIZE + 32);
}

/** Close view follows the visual actor and clamps to the outer ruin walls. */
export function cameraView(width: number, height: number, player: Point, overview: boolean) {
  const zoom = overview
    ? cameraFit(width, height)
    : Math.min(width / (TILE_SIZE * 4), height / (TILE_SIZE * 3.4)) * 0.9;
  if (overview) return { zoom, x: 0, y: 0 };
  const clamp = (value: number, viewport: number) => {
    const limit = Math.max(0, WORLD_SIZE / 2 + 16 - viewport / (2 * zoom));
    return Math.max(-limit, Math.min(limit, value));
  };
  return { zoom, x: clamp(player.x, width), y: clamp(player.y, height) };
}
