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
export function rejected(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (
    let current = error;
    current && typeof current === 'object' && !seen.has(current);
    current = (current as { cause?: unknown }).cause
  ) {
    seen.add(current);
    if (
      (current as { code?: number }).code === 4001 ||
      (current as { name?: string }).name === 'UserRejectedRequestError'
    )
      return true;
  }
  return false;
}
export function explain(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/StaleRevision|stale/i.test(message))
    return 'Someone changed the dungeon first. Try the new revision.';
  if (/insufficient funds/i.test(message))
    return 'Not enough test ETH for gas. Fund your wallet on Arbitrum Sepolia, then try again.';
  if (/account.*changed/i.test(message))
    return 'Wallet account changed before signing. Review your edit again with the intended account.';
  if (/chain|network/i.test(message))
    return 'Wrong network. Switch your wallet to Arbitrum Sepolia (421614).';
  if (/UnsolvableMutation/i.test(message)) return 'That edit blocks every route to the exit.';
  if (/InvalidStep|PathDoesNotReachExit|NonCanonical|ExitReachedEarly/i.test(message))
    return 'The contract rejected this path. Restart the run and try again.';
  if (/TileNotEditable/i.test(message)) return 'Choose an editable tile.';
  if (
    /journal|recovery|coordination|already in progress|ambiguous|unrelated|nonce|configured/i.test(
      message,
    )
  )
    return message.split('\n')[0];
  if (/rejected|denied/i.test(message))
    return 'Wallet request rejected. Your run and edit are preserved.';
  return 'The request could not be verified. Check your wallet and connection, then retry status.';
}
