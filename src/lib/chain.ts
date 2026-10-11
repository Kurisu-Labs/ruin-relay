import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  type Address,
  type Hash,
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { abi } from '../config/abi';
import { chain, deployment } from '../config/deployment';
import { anotherDocumentIsSigning } from './inflight';
import fixture from '../../reference/fixtures.json';
import {
  SIGNING_STATUS,
  type Attempt,
  type Mutation,
  type ObservedTransaction,
  type Snapshot,
} from './model';
export const client = createPublicClient({
  chain,
  transport: http(deployment.rpc, { timeout: 8000, retryCount: 0 }),
  pollingInterval: 1000,
});

/**
 * Cap the commit at twice the latest base fee plus the priority fee.
 * MetaMask's own estimate can sit under Arbitrum's base fee and the node then
 * rejects eth_sendRawTransaction before anything is broadcast.
 */
export async function commitFeeCap() {
  const estimated = await client.estimateFeesPerGas({ type: 'eip1559' });
  const block = await client.getBlock();
  const base = block.baseFeePerGas ?? 0n;
  const priority = estimated.maxPriorityFeePerGas;
  const headroom = base * 2n + priority;
  return {
    maxFeePerGas: estimated.maxFeePerGas > headroom ? estimated.maxFeePerGas : headroom,
    maxPriorityFeePerGas: priority,
  };
}

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
    rpcTransaction: tx,
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

export function observeReceipt(
  hash: Hash,
  getAttempt: () => Attempt | undefined,
  onReplacement: (hash: Hash) => Promise<void>,
) {
  const observer = client.extend(() => ({
    getTransaction: (async (parameters: Parameters<typeof client.getTransaction>[0]) => {
      try {
        return await client.getTransaction(parameters);
      } catch (error) {
        const attempt = getAttempt();
        const evidence = attempt && originalEvidence(attempt);
        const cached = evidence?.rpcTransaction;
        if (
          error instanceof Error &&
          error.name === 'TransactionNotFoundError' &&
          attempt &&
          evidence &&
          cached &&
          'hash' in parameters &&
          parameters.hash === evidence.hash &&
          cached.hash === evidence.hash &&
          cached.nonce === evidence.nonce &&
          (cached.chainId === undefined || cached.chainId === chain.id) &&
          sameAction(attempt, {
            ...evidence,
            sender: cached.from,
            target: cached.to,
            value: cached.value,
            calldata: cached.input,
          })
        )
          return cached;
        throw error;
      }
      // Cached data is the same normalized RPC response; viem's generic block-tag
      // nullability cannot express a historical pending response from a hash lookup.
    }) as typeof client.getTransaction,
  }));
  // The action must receive the extended client; the decorated method closes over the original.
  return waitForTransactionReceipt(observer, {
    hash,
    timeout: 20_000,
    pollingInterval: 1000,
    onReplaced: ({ transaction: replacement }) => onReplacement(replacement.hash),
  });
}

const NEVER_BROADCAST = 'This commit was never broadcast. Your run and edit are preserved.';
const NEVER_APPLIED =
  'Your earlier commit was never applied, and the dungeon has moved on. Play latest to try again.';
const HASHLESS_LOCKED =
  'This commit has no transaction hash yet. It stays locked until the dungeon moves on or you recover a transaction hash. Retry status only rechecks.';

function lockedHashless(attempt: Attempt): Attempt {
  return { ...attempt, state: 'unknown', mutation: undefined, message: HASHLESS_LOCKED };
}

/** Included-nonce cursor from before signing. Older journals may only have stored the pending count. */
function recordedIncludedNonce(attempt: Attempt) {
  return attempt.nonceAtSign?.latest ?? attempt.requestedNonce;
}

function sameMutation(attempt: Attempt, event: Mutation) {
  return (
    event.editor.toLowerCase() === attempt.account.toLowerCase() &&
    event.tileIndex === attempt.tile &&
    event.revision === attempt.run.snapshot.revision + 1n &&
    event.wallMask === attempt.expectedWalls &&
    event.becameWall === ((attempt.expectedWalls & (1n << BigInt(attempt.tile))) !== 0n)
  );
}

function mutationLogs(address: Address, fromBlock: bigint, toBlock: bigint, revision?: bigint) {
  return client.getContractEvents({
    address,
    abi,
    eventName: 'DungeonMutated',
    args: revision === undefined ? undefined : { revision },
    fromBlock,
    toBlock,
    strict: true,
  });
}

async function canonicalMutations(
  address: Address,
  logs: Awaited<ReturnType<typeof mutationLogs>>,
): Promise<Mutation[]> {
  const found = new Map<string, Mutation>();
  const canonical = new Map<bigint, Hash>();
  for (const log of logs) {
    if (
      log.address.toLowerCase() !== address.toLowerCase() ||
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
    found.set(`${chain.id}:${log.transactionHash}:${log.logIndex}`, {
      ...log.args,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      logIndex: log.logIndex,
    });
  }
  return [...found.values()];
}

async function mutationsAt(address: Address, revision: bigint): Promise<Mutation[]> {
  if (deployment.block === undefined) throw new Error('Deployment block is not configured.');
  const latest = await client.getBlockNumber();
  for (let from = deployment.block; from <= latest; from += 2_000n) {
    const to = from + 1_999n > latest ? latest : from + 1_999n;
    const found = await canonicalMutations(
      address,
      await mutationLogs(address, from, to, revision),
    );
    // This contract emits at most one canonical mutation for a revision.
    if (found.length) return found;
  }
  // Any failed window throws; a partial scan never proves event absence.
  return [];
}

async function adoptObservedMutation(
  attempt: Attempt,
  event: Mutation,
): Promise<Attempt | undefined> {
  const observed = await transaction(event.hash, 'wallet-response');
  if (!sameAction(attempt, observed)) return undefined;
  return {
    ...attempt,
    originalHash: event.hash,
    activeHash: event.hash,
    hashes: [...new Set([...attempt.hashes, event.hash])],
    observed: [...attempt.observed.filter((item) => item.hash !== event.hash), observed],
  };
}

/**
 * A hashless attempt can end only from reads.
 * The contract accepts at most one mutation per revision, so a late copy cannot
 * double-mutate: the worst case is a later commit that reverts StaleRevision.
 * Journals do not store a creation time, so there is no cheap bound for an
 * included transaction after the attempt was created. Legacy journals stop at
 * pending==latest and the absence of a snapshot+1 event.
 * Any failed read throws and the caller keeps the attempt locked.
 */
async function settleHashless(attempt: Attempt, live: Snapshot): Promise<Attempt> {
  const snapshotRevision = attempt.run.snapshot.revision;
  if (live.revision < snapshotRevision) return lockedHashless(attempt);
  const events = await mutationsAt(attempt.run.snapshot.address, snapshotRevision + 1n);
  const own = events.filter((event) => sameMutation(attempt, event));
  if (own.length > 1) return lockedHashless(attempt);
  if (own.length === 1) {
    const adopted = await adoptObservedMutation(attempt, own[0]);
    if (adopted) return verify(adopted, live);
  }
  if (live.revision > snapshotRevision) {
    // A moved revision with no visible snapshot+1 event is an incomplete read.
    // A visible event that is not this attempt's action cannot be applied later.
    if (events.length === 0) return lockedHashless(attempt);
    return { ...attempt, state: 'rejected', mutation: undefined, message: NEVER_APPLIED };
  }
  if (events.length > 0) return lockedHashless(attempt);
  const [pending, latest] = await Promise.all([
    client.getTransactionCount({ address: attempt.account, blockTag: 'pending' }),
    client.getTransactionCount({ address: attempt.account, blockTag: 'latest' }),
  ]);
  const recorded = recordedIncludedNonce(attempt);
  const nothingIncluded = recorded === undefined || latest === recorded;
  if (pending === latest && nothingIncluded)
    return { ...attempt, state: 'rejected', mutation: undefined, message: NEVER_BROADCAST };
  return lockedHashless(attempt);
}

export async function verify(
  attempt: Attempt,
  live: Snapshot,
  preserveSigning = false,
): Promise<Attempt> {
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
  if (!attempt.activeHash) {
    // An open wallet request on this page has no hash yet. Keep it signing.
    // A restored hashless attempt is settled from chain reads: a moved revision,
    // or nonce evidence that nothing was sent. A failed read stays locked.
    if (preserveSigning && attempt.state === 'signing')
      return { ...result, state: 'signing', message: SIGNING_STATUS };
    if (attempt.hashes.length === 0 && !attempt.originalHash) {
      // A live wallet prompt has not broadcast yet, so pending==latest is not
      // evidence. The document that opened it holds the inflight lock.
      if (await anotherDocumentIsSigning())
        return attempt.state === 'signing'
          ? { ...result, state: 'signing', message: SIGNING_STATUS }
          : lockedHashless(result);
      return settleHashless(result, live);
    }
    return {
      ...result,
      state: 'unknown',
      message:
        'Check your wallet for this transaction. Recover with transaction hash if available.',
    };
  }
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
      message:
        live.revision !== attempt.run.snapshot.revision
          ? 'Someone changed the dungeon first. Play latest to try the new revision.'
          : 'The transaction reverted. This attempt did not change the dungeon.',
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
    const mutations = await canonicalMutations(
      live.address,
      await mutationLogs(live.address, from, to),
    );
    for (const mutation of mutations)
      entries.set(`${live.chainId}:${mutation.hash}:${mutation.logIndex}`, mutation);
    if (from === deployment.block) break;
    to = from - 1n;
  }
  const history = [...entries.values()]
    .sort((a, b) => (a.revision > b.revision ? -1 : 1))
    .slice(0, 10);
  const expectedCount = Number(live.revision < 10n ? live.revision : 10n);
  // A successful RPC response can still be missing logs. The observed dungeon
  // determines which recent revisions must exist before history is complete.
  if (
    history.length !== expectedCount ||
    history.some((entry, index) => entry.revision !== live.revision - BigInt(index)) ||
    (history.length > 0 && history[0].wallMask !== live.walls)
  )
    throw new Error('History is incomplete or inconsistent with the live dungeon.');
  return history;
}
