import { isAddress, type Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
export const chain = arbitrumSepolia;
const address = import.meta.env.VITE_CONTRACT_ADDRESS;
const block = import.meta.env.VITE_DEPLOYMENT_BLOCK;
export const deployment = {
  chainId: chain.id,
  address:
    address && isAddress(address) && !/^0x0{40}$/i.test(address) ? (address as Address) : undefined,
  block: block && /^\d+$/.test(block) ? BigInt(block) : undefined,
  rpc: import.meta.env.VITE_RPC_URL || chain.rpcUrls.default.http[0],
  local: import.meta.env.VITE_LOCAL === 'true',
  explorer: chain.blockExplorers.default.url,
};
export const configured = Boolean(deployment.address && deployment.block !== undefined);
