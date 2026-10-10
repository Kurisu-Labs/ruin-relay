import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { abi } from '../../src/config/abi';

export const test = base.extend<{ resetChain: void }>({
  resetChain: [
    async ({}, use) => {
      const snapshot = await rpc('evm_snapshot');
      try {
        await use();
      } finally {
        await rpc('evm_setAutomine', [true]);
        await rpc('evm_revert', [snapshot]);
      }
    },
    { auto: true },
  ],
});
export { expect };
export async function deployment() {
  return JSON.parse(await readFile('.local/deployment.json', 'utf8')) as {
    address: Hex;
    block: string;
    rpc: string;
  };
}
export async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
export async function direct(
  revision = 0n,
  path = 0x59afba5156n,
  count = 20,
  tile = 31,
  accountIndex = 0,
) {
  const config = await deployment();
  const accounts: Hex[] = await rpc('eth_accounts');
  const wallet = createWalletClient({
    account: accounts[accountIndex],
    chain: arbitrumSepolia,
    transport: http(config.rpc),
  });
  const hash = await wallet.writeContract({
    address: config.address,
    abi,
    functionName: 'completeAndMutate',
    args: [revision, path, count, tile],
  });
  await createPublicClient({ transport: http(config.rpc) }).waitForTransactionReceipt({ hash });
  return hash;
}
export interface WalletSendError {
  code: number;
  message: string;
  data?: { code?: number; message?: string };
}
export interface WalletControl {
  mode: 'normal' | 'reject' | 'hold' | 'lost';
  account: number;
  chain: string;
  requests: { method: string; params: any[] }[];
  release?: () => void;
  hash?: Hex;
  overrideNonce?: number;
  /** Returned from eth_sendTransaction instead of broadcasting. */
  sendError?: WalletSendError;
}
export async function injectWallet(page: Page, account = 0) {
  const accounts: Hex[] = await rpc('eth_accounts');
  const control: WalletControl = { mode: 'normal', account, chain: '0x66eee', requests: [] };
  await page.exposeFunction('walletRpc', async (request: { method: string; params?: any[] }) => {
    const { method, params = [] } = request;
    if (method === 'eth_requestAccounts' || method === 'eth_accounts')
      return { result: [accounts[control.account]] };
    if (method === 'eth_chainId') return { result: control.chain };
    if (method === 'wallet_switchEthereumChain') {
      control.chain = params[0].chainId;
      return { result: null };
    }
    if (method === 'wallet_requestPermissions')
      return { result: [{ parentCapability: 'eth_accounts' }] };
    if (method === 'wallet_getCapabilities') return { result: {} };
    if (method === 'wallet_sendTransaction')
      return { error: { code: -32601, message: 'Method not found' } };
    if (method === 'eth_sendTransaction') {
      control.requests.push({ method, params });
      if (control.mode === 'reject')
        return { error: { code: 4001, message: 'User rejected request' } };
      if (control.sendError) return { error: control.sendError };
      if (control.mode === 'hold')
        await new Promise<void>((resolve) => {
          control.release = resolve;
        });
      try {
        const actual =
          control.overrideNonce === undefined
            ? params
            : [{ ...params[0], nonce: `0x${control.overrideNonce.toString(16)}` }];
        control.hash = await rpc(method, actual);
        if (control.mode === 'lost')
          return { error: { code: -32000, message: 'Wallet response lost after broadcast' } };
        return { result: control.hash };
      } catch (error) {
        return { error: { code: -32000, message: String(error) } };
      }
    }
    try {
      return { result: await rpc(method, params) };
    } catch (error) {
      return { error: { code: -32000, message: String(error) } };
    }
  });
  await page.addInitScript(() => {
    const listeners = new Map<string, Function[]>();
    (window as any).ethereum = {
      isMetaMask: true,
      request: async (request: unknown) => {
        const response = await (window as any).walletRpc(request);
        if (response.error)
          throw Object.assign(new Error(response.error.message), {
            code: response.error.code,
            data: response.error.data,
          });
        return response.result;
      },
      on: (name: string, callback: Function) => {
        listeners.set(name, [...(listeners.get(name) ?? []), callback]);
      },
      removeListener: (name: string, callback: Function) => {
        listeners.set(
          name,
          (listeners.get(name) ?? []).filter((f) => f !== callback),
        );
      },
      emit: (name: string, data: unknown) => {
        for (const listener of listeners.get(name) ?? []) listener(data);
      },
    };
  });
  return control;
}
export async function open(page: Page) {
  await page.goto('/play');
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
}
export async function walk(page: Page, path = 'DRRRRURRDDLDLLDDRDRR') {
  await page.bringToFront();
  await page.getByRole('application').focus();
  let steps = Number((await page.locator('.steps').innerText()).match(/Steps (\d+)/)![1]);
  for (const direction of path) {
    const key = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' }[direction]!;
    await page.keyboard.press(key);
    await expect(page.locator('.steps')).toHaveText(`Steps ${++steps} / 96`);
  }
}
export async function prepare(page: Page, tile = 31) {
  await page.getByRole('button', { name: `Tile ${tile}:` }).click();
  await page.getByRole('button', { name: 'Commit one change' }).click();
  await expect(page.getByRole('region', { name: 'Transaction preview' })).toBeVisible();
}
export async function submit(page: Page, tile = 31) {
  await prepare(page, tile);
  await page.getByRole('button', { name: 'Sign and submit edit' }).click();
}
