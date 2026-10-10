import {
  connect,
  createConfig,
  getConnection,
  getWalletClient,
  http,
  switchChain,
} from '@wagmi/core';
import { injected } from '@wagmi/connectors';
import { chain, deployment } from '../config/deployment';

const config = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: http(deployment.rpc) },
  multiInjectedProviderDiscovery: true,
  storage: null,
});
export async function wallet() {
  if (getConnection(config).status !== 'connected')
    await connect(config, { connector: config.connectors[0] });
  return getWalletClient(config);
}
export async function switchNetwork() {
  await switchChain(config, { chainId: chain.id });
}

/**
 * Wagmi already parses `eth_chainId` with `Number`, so a hex id such as
 * `0x66eee` is 421614 before we compare it. Accept either form so a raw
 * provider id cannot be treated as a different chain.
 */
export function isDeploymentChain(chainId: unknown) {
  if (typeof chainId === 'number' || typeof chainId === 'bigint')
    return BigInt(chainId) === BigInt(deployment.chainId);
  if (typeof chainId !== 'string' || chainId.trim() === '') return false;
  try {
    return BigInt(chainId.trim()) === BigInt(deployment.chainId);
  } catch {
    return false;
  }
}

interface ErrorFacts {
  text: string;
  codes: number[];
  names: string[];
}

function facts(error: unknown): ErrorFacts {
  const texts: string[] = [];
  const codes: number[] = [];
  const names: string[] = [];
  const seen = new Set<unknown>();
  const visit = (current: unknown) => {
    if (typeof current === 'string') {
      texts.push(current);
      return;
    }
    if (!current || typeof current !== 'object' || seen.has(current)) return;
    seen.add(current);
    const record = current as Record<string, unknown>;
    for (const key of ['message', 'details', 'shortMessage'] as const) {
      if (typeof record[key] === 'string') texts.push(record[key]);
    }
    if (typeof record.name === 'string') names.push(record.name);
    if (typeof record.code === 'number') codes.push(record.code);
    else if (typeof record.code === 'string' && /^-?\d+$/.test(record.code))
      codes.push(Number(record.code));
    visit(record.cause);
    visit(record.data);
    visit(record.error);
  };
  visit(error);
  return { text: texts.join('\n'), codes, names };
}

/**
 * A timeout or a lost wallet response is not proof that the node rejected the
 * transaction. "already known" means a transaction with this payload is already
 * in the pool. The error itself leaves the attempt unresolved; a later nonce
 * or event read can still end a hashless attempt when the chain shows it
 * cannot land.
 */
const AMBIGUOUS =
  /timed out|timeout|took too long|response lost|failed to fetch|network request failed|socket hang up|econnreset|already known|transaction already imported/i;

/**
 * The node returned these from eth_sendRawTransaction / eth_sendTransaction
 * and did not accept the transaction. A bare "Internal JSON-RPC error" is not
 * in this list: MetaMask uses it as a wrapper, and without a nested reason the
 * response may have been lost after broadcast.
 */
const NODE_REJECTED =
  /max fee per gas less than block base fee|fee cap less than block base fee|cannot be lower than the block base fee|insufficient funds|exceeds transaction sender account balance|nonce too low|nonce too high|replacement transaction underpriced|transaction underpriced|intrinsic gas too low|intrinsic gas too high|gas limit reached|exceeds block gas limit|gas required exceeds allowance|tip higher than fee cap|max priority fee per gas higher than max fee per gas/i;

const SIMULATION_REVERT =
  /execution reverted|StaleRevision|UnsolvableMutation|InvalidStep|InvalidMoveCount|NonCanonicalDirections|PathDoesNotReachExit|ExitReachedEarly|TileNotEditable/i;

function userRejected(info: ErrorFacts) {
  return (
    info.codes.includes(4001) ||
    info.names.includes('UserRejectedRequestError') ||
    /user rejected the request|user denied transaction signature|user rejected request/i.test(
      info.text,
    )
  );
}

/**
 * True only when this signing request was refused before a transaction was
 * accepted. Generic timeouts, lost responses, and internal errors with no
 * rejection reason return false. That is not a time-based unlock: chain
 * evidence in verify() is a separate read.
 */
export function notBroadcast(error: unknown) {
  const info = facts(error);
  if (AMBIGUOUS.test(info.text)) return false;
  if (userRejected(info)) return true;
  if (NODE_REJECTED.test(info.text) || SIMULATION_REVERT.test(info.text)) return true;
  if (info.codes.includes(4901) || info.codes.includes(4902)) return true;
  return false;
}

function explicitWrongNetwork(info: ErrorFacts) {
  if (info.codes.includes(4901) || info.codes.includes(4902)) return true;
  return /wrong network|chain mismatch|unrecognized chain|failed to switch chain/i.test(info.text);
}

export function explain(error: unknown) {
  const info = facts(error);
  if (AMBIGUOUS.test(info.text))
    return 'The request could not be verified. Check your wallet and connection, then retry status.';
  if (userRejected(info)) return 'Wallet request rejected. Your run and edit are preserved.';
  if (
    /max fee per gas less than block base fee|fee cap less than block base fee|cannot be lower than the block base fee/i.test(
      info.text,
    )
  )
    return 'The fee was rejected before broadcast: max fee per gas was below the block base fee. Your run and edit are preserved.';
  if (/insufficient funds|exceeds transaction sender account balance/i.test(info.text))
    return 'Not enough test ETH for gas. The transaction was not broadcast. Fund your wallet on Arbitrum Sepolia, then try again.';
  if (/nonce too low|nonce too high/i.test(info.text))
    return 'The nonce was rejected before broadcast. Your run and edit are preserved.';
  if (/underpriced/i.test(info.text))
    return 'The transaction was underpriced and was not broadcast. Your run and edit are preserved.';
  if (
    /intrinsic gas too low|intrinsic gas too high|gas limit reached|exceeds block gas limit|gas required exceeds allowance/i.test(
      info.text,
    )
  )
    return 'The gas limit was rejected before broadcast. Your run and edit are preserved.';
  if (/StaleRevision|^Stale run\b/im.test(info.text))
    return 'Someone changed the dungeon first. Play latest to try the new revision.';
  if (/account.*changed/i.test(info.text))
    return 'Wallet account changed before signing. Review your edit again with the intended account.';
  if (explicitWrongNetwork(info))
    return 'Wrong network. Switch your wallet to Arbitrum Sepolia (421614).';
  if (/UnsolvableMutation/i.test(info.text))
    return 'That edit blocks every route to the exit. The transaction was not broadcast.';
  if (/InvalidStep|PathDoesNotReachExit|NonCanonical|ExitReachedEarly/i.test(info.text))
    return 'The contract rejected this path. The transaction was not broadcast.';
  if (/TileNotEditable/i.test(info.text))
    return 'Choose an editable tile. The transaction was not broadcast.';
  if (
    /journal|recovery|coordination|already in progress|ambiguous|unrelated|configured/i.test(
      info.text,
    )
  )
    return info.text.split('\n')[0];
  if (notBroadcast(error))
    return 'The transaction was not broadcast. Your run and edit are preserved.';
  return 'The request could not be verified. Check your wallet and connection, then retry status.';
}
