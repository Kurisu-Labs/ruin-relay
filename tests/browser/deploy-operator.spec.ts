import { spawn, type ChildProcess } from 'node:child_process';
import { test, expect } from './helpers';
import type { Page } from '@playwright/test';

const url = 'http://127.0.0.1:4180';
let server: ChildProcess;
let config: any;
test.beforeAll(async () => {
  server = spawn(process.execPath, [
    'scripts/browser-deploy.mjs',
    '--account',
    '0x37714b787066ce967d027B752D045e13b8b64A84',
    '--port',
    '4180',
    '--rpc',
    'http://127.0.0.1:8545',
    '--recover-rejected-nonce',
    '0',
  ]);
  let output = '';
  server.stdout?.on('data', (data) => {
    output += data;
  });
  server.stderr?.on('data', (data) => {
    output += data;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(url + '/unsigned-deployment.json');
      if (response.ok) {
        config = await response.json();
        return;
      }
    } catch {
      /* Startup is bounded below. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Operator server did not start: ' + output);
});
test.afterAll(() => {
  server?.kill();
});

async function wallet(page: Page, scenario = 'success', seed?: Record<string, unknown>) {
  const calls: { method: string; params?: any[] }[] = [];
  await page.exposeBinding('recordWalletCall', (_, call) => {
    calls.push(call);
  });
  await page.addInitScript(
    ({ scenario, config, seed }) => {
      const tx = config.walletRequest.params[0];
      if (seed) {
        const key = `ruin-relay:operator-deploy:${config.chainId}:${tx.from.toLowerCase()}:${config.constructor.initialWalls}:${config.constructor.editableMask}`;
        localStorage.setItem(
          key,
          JSON.stringify({
            account: tx.from,
            chainId: config.chainId,
            data: tx.data,
            state: 'signing',
            ...seed,
          }),
        );
      }
      let blockReads = 0;
      (window as any).ethereum = {
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          await (window as any).recordWalletCall({ method, params });
          if (method === 'eth_accounts' || method === 'eth_requestAccounts')
            return [
              scenario === 'wrong-account' ? '0x4Cc38D7C18C0EB53662d2D3FA382C3a82B2e7ad9' : tx.from,
            ];
          if (method === 'eth_chainId') return scenario === 'wrong-network' ? '0x1' : '0x66eee';
          if (method === 'eth_getTransactionCount')
            return scenario === 'pending' && params?.[1] === 'pending' ? '0x1' : '0x0';
          if (method === 'eth_estimateGas') return '0x94a60';
          if (method === 'eth_gasPrice') return '0x' + 39042000n.toString(16);
          if (method === 'eth_getBlockByNumber')
            return {
              baseFeePerGas:
                '0x' +
                (scenario === 'rising-base' && ++blockReads > 1 ? 45000000n : 39186000n).toString(
                  16,
                ),
            };
          if (method === 'eth_maxPriorityFeePerGas') return '0x0';
          if (method === 'eth_sendTransaction') {
            const cap = BigInt(params?.[0].maxFeePerGas ?? '39042000');
            const base = scenario === 'rising-base' ? 45000000n : 39186000n;
            if (cap < base)
              throw new Error(
                `RPC 0x66eee Custom eth_sendRawTransaction: max fee per gas less than block base fee: maxFeePerGas: ${cap} baseFee: ${base}`,
              );
            return `0x${'2'.repeat(64)}`;
          }
          throw new Error(method);
        },
      };
      if (scenario === 'storage-failure')
        Storage.prototype.setItem = () => {
          throw new DOMException('Storage denied');
        };
    },
    { scenario, config, seed },
  );
  await page.goto(url);
  return calls;
}

for (const scenario of ['success', 'rising-base']) {
  test(`operator deployment buffers a stale gas-price quote and refreshes before signing: ${scenario}`, async ({
    page,
  }) => {
    const calls = await wallet(page, scenario);
    if (scenario === 'success')
      await page.screenshot({ path: '.local/operator-deploy.png', fullPage: true });
    await page.getByRole('button', { name: '1. Connect wallet A' }).click();
    await page.getByRole('button', { name: '2. Estimate deployment' }).click();
    await page.getByRole('button', { name: '3. Sign and deploy' }).click();
    await expect(page.getByRole('status')).toContainText('Transaction hash received.');
    const sent = calls.filter((call) => call.method === 'eth_sendTransaction');
    expect(sent).toHaveLength(1);
    const tx = sent[0].params![0];
    expect(BigInt(tx.maxFeePerGas)).toBeGreaterThanOrEqual(
      2n * (scenario === 'rising-base' ? 45000000n : 39186000n),
    );
    expect(BigInt(tx.maxPriorityFeePerGas)).toBeLessThanOrEqual(BigInt(tx.maxFeePerGas));
    expect(tx.gasPrice).toBeUndefined();
    expect(tx.nonce).toBe('0x0');
    await page.reload();
    await expect(page.getByRole('status')).toContainText(
      'A transaction hash was already returned.',
    );
    await expect(page.getByRole('button', { name: '3. Sign and deploy' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reset rejected fee request' })).toBeHidden();
    expect(calls.filter((call) => call.method === 'eth_sendTransaction')).toHaveLength(1);
  });
}

for (const scenario of ['wrong-account', 'wrong-network', 'storage-failure']) {
  test(`operator deployment blocks unsafe signing: ${scenario}`, async ({ page }) => {
    const calls = await wallet(page, scenario);
    await page.getByRole('button', { name: '1. Connect wallet A' }).click();
    if (scenario === 'storage-failure') {
      await page.getByRole('button', { name: '2. Estimate deployment' }).click();
      await page.getByRole('button', { name: '3. Sign and deploy' }).click();
      await expect(page.getByRole('status')).toContainText('No signing request sent.');
    } else {
      await expect(page.getByRole('status')).toContainText(
        scenario === 'wrong-account' ? 'Select wallet A' : 'Switch the wallet',
      );
      await expect(page.getByRole('button', { name: '3. Sign and deploy' })).toBeDisabled();
    }
    expect(calls.filter((call) => call.method === 'eth_sendTransaction')).toHaveLength(0);
  });
}

test('operator manual fee recovery preserves the failed intent and never resends', async ({
  page,
}) => {
  const calls = await wallet(page, 'success', {});
  await expect(page.getByRole('status')).toContainText(
    'An earlier signing request has an unknown outcome.',
  );
  await page.getByRole('button', { name: 'Reset rejected fee request' }).click();
  await expect(page.getByRole('status')).toContainText('Rejected fee attempt preserved.');
  await expect(page.getByRole('button', { name: '2. Estimate deployment' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '3. Sign and deploy' })).toBeDisabled();
  expect(calls.filter((call) => call.method === 'eth_sendTransaction')).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => key.includes(':rejected-fee:')),
    ),
  ).toBe(true);
});

test('operator manual fee recovery remains locked when the nonce is in flight', async ({
  page,
}) => {
  const calls = await wallet(page, 'pending', {});
  await page.getByRole('button', { name: 'Reset rejected fee request' }).click();
  await expect(page.getByRole('status')).toContainText('The rejected nonce is no longer unused.');
  await expect(page.getByRole('button', { name: '3. Sign and deploy' })).toBeDisabled();
  expect(calls.filter((call) => call.method === 'eth_sendTransaction')).toHaveLength(0);
});

test('operator legacy recovery cannot clear a new unresolved signing request', async ({ page }) => {
  const calls = await wallet(page, 'success', {
    nonce: '0x0',
    fees: { maxFeePerGas: '0x5000000', maxPriorityFeePerGas: '0x0' },
  });
  await expect(page.getByRole('status')).toContainText(
    'An earlier signing request has an unknown outcome.',
  );
  await expect(page.getByRole('button', { name: 'Reset rejected fee request' })).toBeHidden();
  await expect(page.getByRole('button', { name: '3. Sign and deploy' })).toBeDisabled();
  expect(calls.filter((call) => call.method === 'eth_sendTransaction')).toHaveLength(0);
});

test('operator server serves only public deployment artifacts', async ({ request }) => {
  expect((await request.get(url + '/unsigned-deployment.json')).status()).toBe(200);
  expect((await request.get(url + '/sepolia-wallets.json')).status()).toBe(404);
  expect((await request.get(url + '/..%2fsepolia-wallets.json')).status()).toBe(404);
});
