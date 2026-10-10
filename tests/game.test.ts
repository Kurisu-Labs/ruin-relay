import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import fixture from '../reference/fixtures.json';
import type { Run, Snapshot } from '../src/lib/model';
import { ATLAS, HERO, FX, criticalFrames } from '../src/game/assets';
import { keyIntent } from '../src/game/input';
import { continuousRun, newSteps } from '../src/game/presentation';
import {
  cameraFit,
  cameraView,
  depth,
  facing,
  pickTile,
  project,
  TILE_SIZE,
  WORLD_SIZE,
} from '../src/game/projection';

const snapshot: Snapshot = {
  chainId: 421614,
  address: '0x0000000000000000000000000000000000000001',
  walls: BigInt(fixture.initialWallsHex),
  revision: 0n,
  editableMask: BigInt(fixture.editableMaskHex),
  blockNumber: 1n,
  blockHash: `0x${'ab'.repeat(32)}`,
};
const run = (path = '', position = 0): Run => ({ snapshot, path, position });

describe('screen-aligned camera and picking', () => {
  it.each([
    [0, -288, -288],
    [6, 288, -288],
    [42, -288, 288],
    [48, 288, 288],
    [24, 0, 0],
    [31, 0, 96],
    [38, 0, 192],
  ])('projects canonical tile %i to (%i, %i)', (tile, x, y) => {
    expect(project(tile)).toEqual({ x, y });
  });
  it('round trips every tile center and interior', () => {
    for (let tile = 0; tile < 49; tile++) {
      const center = project(tile);
      for (const [x, y] of [
        [0, 0],
        [-40, -40],
        [40, 40],
        [0, 44],
      ])
        expect(pickTile({ x: center.x + x, y: center.y + y })).toBe(tile);
    }
  });
  it('resolves shared boundaries and rejects the perimeter and non-finite pointers', () => {
    expect(pickTile({ x: -240, y: -288 })).toBe(1);
    expect(pickTile({ x: -288, y: -240 })).toBe(7);
    expect(pickTile({ x: -336, y: -288 })).toBe(0);
    for (const point of [
      { x: -337, y: 0 },
      { x: 336, y: 0 },
      { x: 0, y: -337 },
      { x: 0, y: 336 },
      { x: NaN, y: 0 },
      { x: 0, y: Infinity },
    ])
      expect(pickTile(point)).toBeUndefined();
  });
  it('makes all four keyboard directions agree with their screen direction', () => {
    expect(facing).toEqual({ U: 'n', R: 'e', D: 's', L: 'w' });
    expect(project(17)).toEqual({ x: 0, y: -TILE_SIZE });
    expect(project(25)).toEqual({ x: TILE_SIZE, y: 0 });
    expect(project(31)).toEqual({ x: 0, y: TILE_SIZE });
    expect(project(23)).toEqual({ x: -TILE_SIZE, y: 0 });
    expect(depth(project(17).y)).toBeLessThan(depth(project(24).y));
    expect(depth(project(24).y)).toBeLessThan(depth(project(31).y));
  });
  it('keeps the actor visible in a closer following camera at every corner and viewport', () => {
    for (const [width, height] of [
      [280, 236],
      [640, 540],
      [1280, 900],
    ]) {
      for (let tile = 0; tile < 49; tile++) {
        const p = project(tile),
          close = cameraView(width, height, p, false);
        expect(close.zoom).toBeGreaterThan(cameraFit(width, height) * 1.5);
        const x = width / 2 + (p.x - close.x) * close.zoom;
        const y = height / 2 + (p.y - close.y) * close.zoom;
        expect(x).toBeGreaterThan(40 * close.zoom);
        expect(x).toBeLessThan(width - 40 * close.zoom);
        expect(y).toBeGreaterThan(75 * close.zoom);
        expect(y).toBeLessThan(height - 20 * close.zoom);
      }
    }
  });
  it('follows the actor in the middle and fits the entire ruin in map mode', () => {
    expect(cameraView(640, 540, project(25), false).x).toBe(96);
    expect(cameraView(640, 540, project(31), false).y).toBe(96);
    for (const [width, height] of [
      [280, 236],
      [640, 540],
      [1280, 900],
    ]) {
      const map = cameraView(width, height, project(48), true);
      expect(map).toEqual({ zoom: cameraFit(width, height), x: 0, y: 0 });
      expect((WORLD_SIZE + 32) * map.zoom).toBeLessThanOrEqual(Math.min(width, height) + 1e-8);
    }
  });
});

describe('input policy', () => {
  const key = (value: string, extra = {}) => ({
    key: value,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...extra,
  });
  it('maps keys without rotating the onchain path alphabet', () => {
    for (const [keys, direction] of [
      ['wW', 'U'],
      ['dD', 'R'],
      ['sS', 'D'],
      ['aA', 'L'],
    ]) {
      for (const value of keys) expect(keyIntent(key(value))).toBe(direction);
    }
    for (const [value, direction] of [
      ['ArrowUp', 'U'],
      ['ArrowRight', 'R'],
      ['ArrowDown', 'D'],
      ['ArrowLeft', 'L'],
    ]) {
      expect(keyIntent(key(value))).toBe(direction);
    }
    expect(keyIntent(key('R'))).toBe('restart');
    expect(keyIntent(key('Tab'))).toBeUndefined();
  });
  it('ignores held keys, browser shortcuts and IME composition', () => {
    for (const flag of ['repeat', 'ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
      expect(keyIntent(key('d', { [flag]: true }))).toBeUndefined();
      expect(keyIntent(key('r', { [flag]: true }))).toBeUndefined();
    }
  });
});

describe('authoritative run reconciliation', () => {
  it('retains every accepted move when React batches multiple inputs', () => {
    expect(newSteps(run(), run('DRR', 9))).toEqual([
      { tile: 7, direction: 'D' },
      { tile: 8, direction: 'R' },
      { tile: 9, direction: 'R' },
    ]);
    const final = run(fixture.revisions[0].path, 48);
    expect(newSteps(run(), final)).toHaveLength(20);
    expect(newSteps(final, final)).toEqual([]);
  });
  it('invalidates old motion on restart, changed path, revision, mask or deployment', () => {
    const previous = run('DR', 8);
    for (const next of [
      run(),
      run('DU', 0),
      { ...previous, snapshot: { ...snapshot, revision: 1n } },
      { ...previous, snapshot: { ...snapshot, walls: snapshot.walls ^ (1n << 31n) } },
      { ...previous, snapshot: { ...snapshot, chainId: 31337 } },
      {
        ...previous,
        snapshot: { ...snapshot, address: '0x0000000000000000000000000000000000000002' as const },
      },
    ]) {
      expect(continuousRun(previous, next)).toBe(false);
      expect(newSteps(previous, next)).toEqual([]);
    }
  });
  it('does not reset for a fresh observation of the same frozen dungeon', () => {
    const next = { ...run('DR', 8), snapshot: { ...snapshot, blockNumber: 2n } };
    expect(continuousRun(run('D', 7), next)).toBe(true);
    expect(newSteps(run('D', 7), next)).toEqual([{ tile: 8, direction: 'R' }]);
  });
  it('never animates an inconsistent path as a legal move', () => {
    expect(newSteps(run(), run('R', 1))).toEqual([]);
    expect(newSteps(run(), run('DR', 9))).toEqual([]);
  });
});

it('ships every environment, animation and effect frame with verified source hashes', () => {
  const root = new URL('../public/assets/game/v2/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  const atlases: Record<string, any> = {};
  let bytes = 0;
  for (const [index, entry] of manifest.atlases.entries()) {
    const png = readFileSync(new URL(entry.image, root));
    bytes += png.byteLength;
    expect(createHash('sha256').update(png).digest('hex')).toBe(entry.sha256);
    atlases[index === 0 ? ATLAS : HERO] = JSON.parse(
      readFileSync(new URL(entry.metadata, root), 'utf8'),
    );
  }
  atlases[FX] = JSON.parse(
    readFileSync(new URL('../public/assets/game/v1/dungeon.json', import.meta.url), 'utf8'),
  );
  expect(criticalFrames()).toHaveLength(48);
  for (const { texture, frame: key } of criticalFrames()) {
    const atlas = atlases[texture],
      frame = atlas.frames[key];
    expect(frame).toBeDefined();
    expect(frame.trimmed).toBe(false);
    expect(frame.rotated).toBe(false);
    expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(atlas.meta.size.w);
    expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(atlas.meta.size.h);
    expect(frame.pivot.x).toBeGreaterThanOrEqual(0);
    expect(frame.pivot.y).toBeLessThanOrEqual(1);
  }
  expect(bytes).toBeLessThan(4 * 1024 * 1024);
});
