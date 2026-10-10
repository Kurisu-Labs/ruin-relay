import { describe, expect, it } from 'vitest';
import {
  ownConfirmedRevision,
  type Attempt,
  type Mutation,
  type Run,
  type Snapshot,
} from '../src/lib/model';

const address = '0x0000000000000000000000000000000000000001';
const editor = '0x0000000000000000000000000000000000000002';
function snapshot(revision: bigint, walls: bigint): Snapshot {
  return {
    chainId: 421614,
    address,
    walls,
    revision,
    editableMask: 1n,
    blockNumber: revision,
    blockHash: `0x${revision.toString(16).padStart(64, '0')}`,
  };
}
function confirmed(before: bigint, after: bigint, state: Attempt['state'] = 'confirmed'): Attempt {
  const mutation: Mutation = {
    revision: before + 1n,
    editor,
    tileIndex: 31,
    becameWall: false,
    wallMask: after,
    hash: `0x${'ab'.repeat(32)}`,
    blockNumber: before + 1n,
    blockHash: `0x${'cd'.repeat(32)}`,
    logIndex: 0,
  };
  const run: Run = { snapshot: snapshot(before, 1n), path: 'D', position: 48 };
  return {
    id: 'attempt',
    run,
    tile: 31,
    account: editor,
    calldata: '0x',
    expectedWalls: after,
    state,
    hashes: [],
    observed: [],
    ...(state === 'confirmed' ? { mutation } : {}),
  };
}

describe('own confirmed revision', () => {
  const run: Run = { snapshot: snapshot(0n, 1n), path: 'D', position: 48 };
  const attempt = confirmed(0n, 2n);

  it('names the revision when the live dungeon is that verified mutation', () => {
    expect(ownConfirmedRevision(run, snapshot(1n, 2n), [attempt])).toBe(1n);
  });

  it('leaves a later or different dungeon unexplained', () => {
    expect(ownConfirmedRevision(run, snapshot(2n, 3n), [attempt])).toBeUndefined();
    expect(ownConfirmedRevision(run, snapshot(1n, 9n), [attempt])).toBeUndefined();
    expect(
      ownConfirmedRevision(
        { snapshot: snapshot(0n, 5n), path: 'D', position: 48 },
        snapshot(1n, 2n),
        [attempt],
      ),
    ).toBeUndefined();
  });

  it('ignores an attempt that is not a confirmed mutation', () => {
    expect(ownConfirmedRevision(run, snapshot(1n, 2n), [confirmed(0n, 2n, 'pending')])).toBe(
      undefined,
    );
    expect(ownConfirmedRevision(run, snapshot(1n, 2n), [])).toBeUndefined();
  });
});
