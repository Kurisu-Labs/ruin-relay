import { describe, expect, it } from 'vitest';
import fixture from '../reference/fixtures.json';
import { pack, unpack, validatePath, isSolvable, preview, asciiMask } from '../src/lib/rules';

describe('canonical escape and one-tile edit', () => {
  it.each(fixture.revisions)('matches revision $revision across the public rules API', (step) => {
    const walls = BigInt(step.beforeWallsHex);
    expect(pack(step.path)).toBe(BigInt(step.packedDirectionsHex));
    expect(unpack(pack(step.path), step.moveCount)).toBe(step.path);
    expect(validatePath(walls, pack(step.path), step.moveCount)).toBe(true);
    expect(preview(walls, BigInt(fixture.editableMaskHex), step.toggleTileIndex)).toEqual({
      walls: BigInt(step.afterWallsHex),
      solvable: true,
    });
  });
});

it('maps the seed, rejects blocked edits and protects immutable tiles', () => {
  const walls = asciiMask(fixture.seedAscii);
  expect(walls).toBe(BigInt(fixture.initialWallsHex));
  expect(preview(walls, BigInt(fixture.editableMaskHex), 8).solvable).toBe(false);
  expect(preview(walls, BigInt(fixture.editableMaskHex), 15).solvable).toBe(true);
  for (const tile of [0, 7, 48, 49, -1])
    expect(() => preview(walls, BigInt(fixture.editableMaskHex), tile)).toThrow();
});

it('rejects borders, walls, early exit, incomplete paths and noncanonical encodings', () => {
  const walls = BigInt(fixture.initialWallsHex);
  for (const path of ['U', 'L', 'R', 'D', fixture.revisions[0].path + 'LR'])
    expect(validatePath(walls, pack(path), path.length)).toBe(false);
  expect(validatePath(walls, 0n, 0)).toBe(false);
  expect(validatePath(walls, 1n << 192n, 96)).toBe(false);
  expect(
    validatePath(walls, BigInt(fixture.revisions[0].packedDirectionsHex) | (1n << 40n), 20),
  ).toBe(false);
  const revisits = 'DU'.repeat(38) + fixture.revisions[0].path;
  expect(validatePath(walls, pack(revisits), 96)).toBe(true);
  expect(() => pack(revisits + 'U')).toThrow();
});

it('packs all lengths 1–96 with the independent base-four encoding', () => {
  let random = 42;
  for (let length = 1; length <= 96; length++) {
    const path = Array.from({ length }, () => {
      random = (random * 1664525 + 1013904223) >>> 0;
      return 'URDL'[random >>> 30];
    }).join('');
    const digits = [...path]
      .reverse()
      .map((d) => String('URDL'.indexOf(d)))
      .join('');
    let expected = 0n;
    for (const digit of digits) expected = expected * 4n + BigInt(digit);
    expect(pack(path)).toBe(expected);
    expect(unpack(expected, length)).toBe(path);
    expect(() => unpack(expected | (1n << BigInt(2 * length)), length)).toThrow();
  }
});

// Independent coordinate DFS. It neither calls move() nor uses the production queue.
function oracle(walls: bigint) {
  if (walls < 0n || walls >= 2n ** 49n) return false;
  const grid = Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => (walls / 2n ** BigInt(7 * y + x)) % 2n === 0n),
  );
  const seen = new Set<string>();
  function visit(x: number, y: number): boolean {
    if (x < 0 || x > 6 || y < 0 || y > 6 || !grid[y][x] || seen.has(`${x},${y}`)) return false;
    if (x === 6 && y === 6) return true;
    seen.add(`${x},${y}`);
    return visit(x - 1, y) || visit(x + 1, y) || visit(x, y - 1) || visit(x, y + 1);
  }
  return visit(0, 0);
}

it('matches an independent reachability oracle across random and malformed masks', () => {
  let random = 123456789n;
  for (let i = 0; i < 500; i++) {
    random = (random * 6364136223846793005n + 1n) % (1n << 64n);
    const walls = i % 5 === 0 ? random : random & ((1n << 49n) - 1n) & ~((1n << 48n) | 1n);
    expect(isSolvable(walls)).toBe(oracle(walls));
  }
  expect(isSolvable(0n)).toBe(true);
  expect(isSolvable(0x7fn << 7n)).toBe(false);
});
