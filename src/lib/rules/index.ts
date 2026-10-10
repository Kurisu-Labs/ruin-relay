/** The single client rules boundary. Coordinates and masks never use JS bitwise numbers. */
export type Direction = 'U' | 'R' | 'D' | 'L';
export const BOARD_SIZE = 7;
export const EXIT = 48;
export const MAX_MOVES = 96;
const directions = 'URDL';
const limit = (1n << 49n) - 1n;
export const bit = (tile: number) => 1n << BigInt(tile);
export const wallAt = (walls: bigint, tile: number) => (walls & bit(tile)) !== 0n;
export const editable = (mask: bigint, tile: number) =>
  Number.isInteger(tile) && tile > 0 && tile < EXIT && wallAt(mask, tile);

export function pack(path: string): bigint {
  if (path.length < 1 || path.length > MAX_MOVES || [...path].some((d) => !directions.includes(d)))
    throw new Error('Invalid path');
  return [...path].reduce(
    (value, d, i) => value | (BigInt(directions.indexOf(d)) << BigInt(2 * i)),
    0n,
  );
}

export function unpack(value: bigint, count: number): string {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_MOVES ||
    value < 0n ||
    value >> BigInt(count * 2) !== 0n
  )
    throw new Error('Noncanonical directions');
  return Array.from(
    { length: count },
    (_, i) => directions[Number((value >> BigInt(i * 2)) & 3n)],
  ).join('');
}

export function move(walls: bigint, pos: number, direction: Direction): number | null {
  const x = pos % BOARD_SIZE;
  const y = Math.floor(pos / BOARD_SIZE);
  if (
    (direction === 'U' && y === 0) ||
    (direction === 'R' && x === 6) ||
    (direction === 'D' && y === 6) ||
    (direction === 'L' && x === 0)
  )
    return null;
  const next = pos + { U: -7, R: 1, D: 7, L: -1 }[direction];
  return wallAt(walls, next) ? null : next;
}

export function validatePath(walls: bigint, value: bigint, count: number): boolean {
  try {
    const path = unpack(value, count);
    let pos = 0;
    for (let i = 0; i < path.length; i++) {
      const next = move(walls, pos, path[i] as Direction);
      if (next === null || (next === EXIT && i !== path.length - 1)) return false;
      pos = next;
    }
    return pos === EXIT;
  } catch {
    return false;
  }
}

export function isSolvable(walls: bigint): boolean {
  if (walls < 0n || walls > limit || wallAt(walls, 0) || wallAt(walls, EXIT)) return false;
  const queue = [0];
  const visited = new Set([0]);
  for (let head = 0; head < queue.length; head++) {
    const pos = queue[head];
    if (pos === EXIT) return true;
    for (const d of directions) {
      const next = move(walls, pos, d as Direction);
      if (next !== null && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export function preview(walls: bigint, mask: bigint, tile: number) {
  if (!editable(mask, tile)) throw new Error('Tile is not editable');
  const next = walls ^ bit(tile);
  return { walls: next, solvable: isSolvable(next) };
}

export function asciiMask(rows: string[]): bigint {
  if (rows.length !== 7 || rows.some((row) => row.length !== 7)) throw new Error('Expected 7 × 7');
  return [...rows.join('')].reduce(
    (mask, tile, index) => (tile === '#' ? mask | bit(index) : mask),
    0n,
  );
}
