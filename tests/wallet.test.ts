import { TransactionExecutionError } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { describe, expect, it } from 'vitest';
import { explain, isDeploymentChain, notBroadcast } from '../src/lib/wallet';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'json-rpc',
} as const;

function wrapped(cause: Error) {
  return new TransactionExecutionError(cause as never, {
    account,
    chain: arbitrumSepolia,
  });
}

describe('pre-broadcast failures', () => {
  it('parses hex and decimal chain ids as the deployment chain', () => {
    expect(isDeploymentChain('0x66eee')).toBe(true);
    expect(isDeploymentChain(421614)).toBe(true);
    expect(isDeploymentChain('0x1')).toBe(false);
  });

  it('explains an explicit chain mismatch and a stale preflight', () => {
    expect(explain(new Error('Wrong network'))).toMatch(/^Wrong network/);
    expect(explain(new Error('RPC is on the wrong network.'))).toMatch(/^Wrong network/);
    expect(explain(new Error('Stale run'))).toMatch(/Play latest/);
  });

  it('treats a nested fee rejection as not broadcast, even when viem names the chain', () => {
    const cause = Object.assign(new Error('Internal JSON-RPC error.'), {
      code: -32603,
      data: {
        code: -32000,
        message:
          'RPC error eth_sendRawTransaction: max fee per gas less than block base fee: address 0x1, maxFeePerGas: 1, baseFee: 2',
      },
    });
    const error = wrapped(cause);
    expect(error.message).toMatch(/chain:\s+Arbitrum Sepolia/);
    expect(notBroadcast(error)).toBe(true);
    expect(explain(error)).toMatch(/below the block base fee/);
    expect(explain(error)).not.toMatch(/Wrong network/);
  });

  it('treats insufficient funds, underpriced, and intrinsic gas as not broadcast', () => {
    for (const message of [
      'insufficient funds for gas * price + value',
      'replacement transaction underpriced',
      'intrinsic gas too low',
    ]) {
      const error = wrapped(
        Object.assign(new Error('Internal JSON-RPC error.'), { data: { message } }),
      );
      expect(notBroadcast(error), message).toBe(true);
      expect(explain(error), message).not.toMatch(/Wrong network/);
    }
  });

  it('keeps nonce consumption ambiguous until transaction evidence is read', () => {
    for (const message of ['nonce too low', 'nonce has already been used']) {
      const error = wrapped(
        Object.assign(new Error('Internal JSON-RPC error.'), { data: { message } }),
      );
      expect(notBroadcast(error), message).toBe(false);
      expect(explain(error), message).not.toMatch(
        /not broadcast|rejected before broadcast|preserved/,
      );
    }
  });

  it('treats an EIP-1193 rejection as not broadcast', () => {
    const error = Object.assign(new Error('User rejected the request.'), {
      code: 4001,
      name: 'UserRejectedRequestError',
    });
    expect(notBroadcast(error)).toBe(true);
    expect(explain(error)).toMatch(/preserved/);
  });

  it('keeps a timeout, a lost response, already known, and a bare internal error unresolved', () => {
    for (const message of [
      'Request timed out',
      'Wallet response lost after broadcast',
      'already known',
      'Internal JSON-RPC error.',
    ]) {
      const error = wrapped(Object.assign(new Error(message), { code: -32603 }));
      expect(error.message).toMatch(/chain:\s+Arbitrum Sepolia/);
      expect(notBroadcast(error), message).toBe(false);
      expect(explain(error), message).not.toMatch(/Wrong network/);
      expect(explain(error), message).not.toMatch(/preserved/);
    }
  });
});
