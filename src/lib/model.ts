import type { Address, Hash, Hex, Transaction } from 'viem';
export interface Snapshot {
  chainId: number;
  address: Address;
  walls: bigint;
  revision: bigint;
  editableMask: bigint;
  blockNumber: bigint;
  blockHash: Hash;
}
export interface Run {
  snapshot: Snapshot;
  path: string;
  position: number;
}
export type AttemptState =
  | 'signing'
  | 'pending'
  | 'unknown'
  | 'syncing'
  | 'confirmed'
  | 'rejected'
  | 'reverted'
  | 'cancelled'
  | 'replaced';
export interface ObservedTransaction {
  hash: Hash;
  sender: Address;
  nonce: number;
  target: Address | null;
  value: bigint;
  calldata: Hex;
  linkage: 'wallet-response' | 'same-nonce';
  rpcTransaction?: Transaction;
}
export interface Mutation {
  revision: bigint;
  editor: Address;
  tileIndex: number;
  becameWall: boolean;
  wallMask: bigint;
  hash: Hash;
  blockNumber: bigint;
  blockHash: Hash;
  logIndex: number;
}
export interface Attempt {
  id: string;
  run: Run;
  tile: number;
  account: Address;
  calldata: Hex;
  expectedWalls: bigint;
  state: AttemptState;
  originalHash?: Hash;
  activeHash?: Hash;
  hashes: Hash[];
  observed: ObservedTransaction[];
  inclusion?: { blockNumber: bigint; blockHash: Hash };
  requestedNonce?: number;
  mutation?: Mutation;
  message?: string;
}
export const unresolved = (attempt: Attempt) =>
  ['signing', 'pending', 'unknown', 'syncing'].includes(attempt.state);
export const sameDungeon = (a: Snapshot, b: Snapshot) =>
  a.chainId === b.chainId &&
  a.address.toLowerCase() === b.address.toLowerCase() &&
  a.revision === b.revision &&
  a.walls === b.walls &&
  a.editableMask === b.editableMask;
export const SIGNING_STATUS =
  'Waiting for wallet confirmation… Approve or reject the request in your wallet.';

/** Revision created by this run when that verified mutation is the whole live dungeon. */
export function ownConfirmedRevision(run: Run, live: Snapshot, attempts: Attempt[]) {
  return attempts.find((attempt) => {
    const mutation = attempt.mutation;
    return (
      attempt.state === 'confirmed' &&
      mutation !== undefined &&
      sameDungeon(attempt.run.snapshot, run.snapshot) &&
      mutation.revision === run.snapshot.revision + 1n &&
      live.chainId === run.snapshot.chainId &&
      live.address.toLowerCase() === run.snapshot.address.toLowerCase() &&
      live.editableMask === run.snapshot.editableMask &&
      live.revision === mutation.revision &&
      live.walls === mutation.wallMask
    );
  })?.mutation?.revision;
}
