import { createPublicClient, decodeEventLog, encodeFunctionData, http, type Hash } from 'viem';
import { abi } from '../config/abi';
import { chain, deployment } from '../config/deployment';
import fixture from '../../reference/fixtures.json';
import type { Attempt, Mutation, ObservedTransaction, Snapshot } from './model';
export const client = createPublicClient({
  chain,
  transport: http(deployment.rpc, { timeout: 8000, retryCount: 0 }),
  pollingInterval: 1000,
});

export async function readDungeon(): Promise<Snapshot> {
  if (!deployment.address)
    throw new Error('Deployment is not configured. You can play the practice seed.');
  if ((await client.getChainId()) !== chain.id) throw new Error('RPC is on the wrong network.');
  const block = await client.getBlock();
  const [walls, revision, editableMask] = await client.readContract({
    address: deployment.address,
    abi,
    functionName: 'getDungeon',
    blockNumber: block.number,
  });
  const constants = await Promise.all(
    (['START', 'EXIT', 'BOARD_SIZE', 'MAX_MOVES'] as const).map((functionName) =>
      client.readContract({
        address: deployment.address!,
        abi,
        functionName,
        blockNumber: block.number,
      }),
    ),
  );
  if (
    constants.join(',') !== '0,48,7,96' ||
    editableMask !== BigInt(fixture.editableMaskHex) ||
    walls >> 49n !== 0n ||
    (walls & ((1n << 48n) | 1n)) !== 0n
  )
    throw new Error('Unsupported dungeon configuration.');
  if ((await client.getBlock({ blockNumber: block.number })).hash !== block.hash)
    throw new Error('Chain observation changed. Refreshing is required.');
  return {
    chainId: chain.id,
    address: deployment.address,
    walls,
    revision,
    editableMask,
    blockNumber: block.number,
    blockHash: block.hash,
  };
}

export function calldata(run: { snapshot: Snapshot; path: string }, packed: bigint, tile: number) {
  return encodeFunctionData({
    abi,
    functionName: 'completeAndMutate',
    args: [run.snapshot.revision, packed, run.path.length, tile],
  });
}

export async function transaction(
  hash: Hash,
  linkage: ObservedTransaction['linkage'],
): Promise<ObservedTransaction> {
  const tx = await client.getTransaction({ hash });
  if (tx.hash.toLowerCase() !== hash.toLowerCase())
    throw new Error('RPC returned a different transaction hash.');
  if (tx.chainId !== undefined && tx.chainId !== chain.id)
    throw new Error('Transaction is on another chain.');
  return {
    hash: tx.hash,
    sender: tx.from,
    nonce: tx.nonce,
    target: tx.to,
    value: tx.value,
    calldata: tx.input,
    linkage,
  };
}
export function sameAction(attempt: Attempt, tx: ObservedTransaction) {
  return (
    tx.sender.toLowerCase() === attempt.account.toLowerCase() &&
    tx.target?.toLowerCase() === attempt.run.snapshot.address.toLowerCase() &&
    tx.value === 0n &&
    tx.calldata.toLowerCase() === attempt.calldata.toLowerCase()
  );
}

export function originalEvidence(attempt: Attempt) {
  return attempt.observed.find(
    (tx) =>
      tx.linkage === 'wallet-response' &&
      tx.hash === attempt.originalHash &&
      sameAction(attempt, tx),
  );
}

export async function verify(attempt: Attempt, live: Snapshot): Promise<Attempt> {
  if (attempt.state === 'rejected') return attempt;
  const result = { ...attempt, mutation: undefined };
  if (attempt.inclusion) {
    const block = await client.getBlock({ blockNumber: attempt.inclusion.blockNumber });
    if (block.hash !== attempt.inclusion.blockHash) {
      result.state = 'unknown';
      result.inclusion = undefined;
      result.message = "Your edit's confirmation changed. Checking again.";
    }
  }
  if (!attempt.activeHash)
    return {
      ...result,
      state: 'unknown',
      message:
        'Check your wallet for this transaction. Recover with transaction hash if available.',
    };
  let receipt;
  let activeHash = attempt.activeHash;
  for (const hash of new Set([attempt.activeHash, ...attempt.hashes])) {
    try {
      const candidate = await client.getTransactionReceipt({ hash });
      if (candidate.transactionHash.toLowerCase() !== hash.toLowerCase())
        throw new Error('RPC returned a receipt for a different transaction.');
      const canonical = await client.getBlock({ blockNumber: candidate.blockNumber });
      if (canonical.hash !== candidate.blockHash) continue;
      receipt = candidate;
      activeHash = hash;
      break;
    } catch (error) {
      if (!(error instanceof Error && error.name === 'TransactionReceiptNotFoundError'))
        throw error;
    }
  }
  if (!receipt)
    return {
      ...result,
      state: 'pending',
      message: 'Waiting for your transaction to confirm. Your edit is not confirmed yet.',
    };
  result.activeHash = activeHash;
  result.inclusion = { blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
  const tx = await transaction(
    activeHash,
    activeHash === attempt.originalHash ? 'wallet-response' : 'same-nonce',
  );
  const original = originalEvidence(attempt);
  const linked =
    (tx.hash === attempt.originalHash && sameAction(attempt, tx)) ||
    (tx.sender.toLowerCase() === attempt.account.toLowerCase() && original?.nonce === tx.nonce);
  if (!linked)
    return {
      ...result,
      state: 'unknown',
      message: 'Transaction linkage is ambiguous. The attempt remains locked.',
    };
  if (tx.hash === attempt.originalHash && sameAction(attempt, tx))
    result.observed = [...attempt.observed.filter((item) => item.hash !== tx.hash), tx];
  if (!sameAction(attempt, tx)) {
    const cancelled =
      tx.target?.toLowerCase() === tx.sender.toLowerCase() &&
      tx.value === 0n &&
      tx.calldata === '0x';
    return {
      ...result,
      state: cancelled ? 'cancelled' : 'replaced',
      message: cancelled
        ? 'Cancellation confirmed. No dungeon edit was made by this attempt.'
        : 'A different action replaced this edit. No contribution is claimed.',
    };
  }
  if (receipt.status === 'reverted')
    return {
      ...result,
      state: 'reverted',
      message: 'Transaction reverted. The dungeon may have changed first. Play the new revision.',
    };
  const mutations: Mutation[] = [];
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() !== attempt.run.snapshot.address.toLowerCase() ||
      log.transactionHash !== receipt.transactionHash ||
      log.blockHash !== receipt.blockHash
    )
      continue;
    try {
      const event = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
        eventName: 'DungeonMutated',
        strict: true,
      });
      mutations.push({
        ...event.args,
        hash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        logIndex: log.logIndex,
      });
    } catch {
      /* Other logs do not prove this mutation. */
    }
  }
  const event = mutations.length === 1 ? mutations[0] : undefined;
  if (
    !event ||
    event.editor.toLowerCase() !== attempt.account.toLowerCase() ||
    event.tileIndex !== attempt.tile ||
    event.revision !== attempt.run.snapshot.revision + 1n ||
    event.wallMask !== attempt.expectedWalls ||
    event.becameWall !== ((attempt.expectedWalls & (1n << BigInt(attempt.tile))) !== 0n)
  ) {
    return {
      ...result,
      state: 'syncing',
      message: 'Confirmation syncing: receipt event does not yet match this attempt.',
    };
  }
  if (
    live.revision < event.revision ||
    (live.revision === event.revision && live.walls !== event.wallMask)
  )
    return {
      ...result,
      state: 'syncing',
      message: 'Confirmation syncing: waiting for consistent live dungeon state.',
    };
  return {
    ...result,
    state: 'confirmed',
    mutation: event,
    message: `Your edit created revision #${event.revision}.`,
  };
}

export async function readHistory(live: Snapshot): Promise<Mutation[]> {
  if (deployment.block === undefined) return [];
  const entries = new Map<string, Mutation>();
  let to = live.blockNumber;
  while (to >= deployment.block && entries.size < 10) {
    const from: bigint = to - deployment.block > 1999n ? to - 1999n : deployment.block;
    const logs = await client.getContractEvents({
      address: live.address,
      abi,
      eventName: 'DungeonMutated',
      fromBlock: from,
      toBlock: to,
      strict: true,
    });
    const canonical = new Map<bigint, Hash>();
    for (const log of logs) {
      if (
        log.removed ||
        log.blockNumber === null ||
        log.blockHash === null ||
        log.transactionHash === null ||
        log.logIndex === null
      )
        continue;
      if (!canonical.has(log.blockNumber))
        canonical.set(
          log.blockNumber,
          (await client.getBlock({ blockNumber: log.blockNumber })).hash,
        );
      if (canonical.get(log.blockNumber) !== log.blockHash) continue;
      entries.set(`${live.chainId}:${log.transactionHash}:${log.logIndex}`, {
        ...log.args,
        hash: log.transactionHash,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        logIndex: log.logIndex,
      });
    }
    if (from === deployment.block) break;
    to = from - 1n;
  }
  return [...entries.values()].sort((a, b) => (a.revision > b.revision ? -1 : 1)).slice(0, 10);
}
