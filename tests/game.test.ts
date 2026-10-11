import { describe, expect, it } from 'vitest';
import fixture from '../reference/fixtures.json';
import type { Run, Snapshot } from '../src/lib/model';
import { continuousRun, newSteps } from '../src/game3d/presentation';

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
