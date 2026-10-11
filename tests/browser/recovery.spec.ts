import { encodeAbiParameters, encodeEventTopics, encodeFunctionData } from 'viem';
import { abi } from '../../src/config/abi';
import {
  test,
  expect,
  direct,
  injectWallet,
  open,
  walk,
  prepare,
  submit,
  rpc,
  deployment,
} from './helpers';

test('initial journal failure blocks signing while keeping the local escape', async ({ page }) => {
  const wallet = await injectWallet(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('ruin-relay:')) throw new DOMException('Storage denied');
      original.call(this, key, value);
    };
  });
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('initial journal could not be saved');
  expect(wallet.requests).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
});

test('unreadable recovery storage blocks signing while current dungeon play remains available', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('ruin-relay:')) throw new DOMException('Storage access denied');
      return original.call(this, key);
    };
  });
  await open(page);
  await walk(page);
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  expect(wallet.requests).toHaveLength(0);
});

test('missing atomic coordination blocks Commit and preserves local gameplay', async ({ page }) => {
  const wallet = await injectWallet(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
  });
  await open(page);
  await walk(page);
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(
    page.getByText('Atomic coordination across tabs is unavailable.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  expect(wallet.requests).toHaveLength(0);
});

test('a post-broadcast storage failure keeps the hash visible and the earlier journal locked on reload', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('ruin-relay:') && value.includes('originalHash'))
        throw new DOMException('Storage denied');
      original.call(this, key, value);
    };
  });
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('Recovery storage failed.', { exact: false })).toBeVisible();
  await expect(page.locator('.transaction .hash')).toContainText('0x');
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  expect(wallet.requests).toHaveLength(1);
});

test('a wrong network requires switching before requesting a signature', async ({ page }) => {
  const wallet = await injectWallet(page);
  wallet.chain = '0x1';
  await open(page);
  await walk(page);
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await page.getByRole('button', { name: 'Commit one change' }).click();
  await expect(
    page.getByRole('button', { name: 'Switch to Arbitrum Sepolia', exact: true }),
  ).toBeVisible();
  expect(wallet.requests).toHaveLength(0);
});

test('storage reads failing after broadcast retain the returned hash in memory', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'hold';
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect.poll(() => wallet.requests.length).toBe(1);
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('ruin-relay:')) throw new DOMException('Storage access denied');
      return original.call(this, key);
    };
  });
  wallet.release?.();
  await expect.poll(() => wallet.hash).toBeTruthy();
  await expect(page.locator('.transaction .hash')).toHaveText(wallet.hash!);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  expect(wallet.requests).toHaveLength(1);
});

test('wallet account changes before signing abort; changes after issue preserve the fixed attempt', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await open(page);
  await walk(page);
  await prepare(page);
  wallet.account = 1;
  await page.getByRole('button', { name: 'Sign and submit edit' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(wallet.requests).toHaveLength(0);
  wallet.account = 0;
  await prepare(page);
  wallet.mode = 'hold';
  await page.getByRole('button', { name: 'Sign and submit edit' }).click();
  await expect.poll(() => wallet.requests.length).toBe(1);
  wallet.account = 1;
  wallet.chain = '0x1';
  await page.evaluate(() =>
    (window as any).ethereum.emit('accountsChanged', [
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ]),
  );
  await page.evaluate(() => (window as any).ethereum.emit('chainChanged', '0x1'));
  wallet.release?.();
  await expect(page.locator('.success')).toHaveCount(1);
  expect(wallet.requests).toHaveLength(1);
});

test('own contribution reconciles with a later mutation in the same block', async ({ page }) => {
  const wallet = await injectWallet(page);
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  const config = await deployment();
  const accounts = await rpc('eth_accounts');
  await rpc('eth_sendTransaction', [
    {
      from: accounts[1],
      to: config.address,
      data: encodeFunctionData({
        abi,
        functionName: 'completeAndMutate',
        args: [1n, 0x596bfba5156n, 22, 38],
      }),
      gas: '0xf4240',
    },
  ]);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('.success')).toContainText(
    'Your edit created revision #1. The dungeon is now at revision #2.',
  );
  expect(wallet.requests).toHaveLength(1);
});

for (const mismatch of [
  'editor',
  'contract',
  'revision',
  'tile',
  'mask',
  'becameWall',
  'missing',
]) {
  test(`receipt ${mismatch} mismatch cannot claim contribution success`, async ({ page }) => {
    await injectWallet(page);
    await page.route('http://127.0.0.1:8545/**', async (route) => {
      const request = route.request().postDataJSON();
      if (request.method !== 'eth_getTransactionReceipt') return route.continue();
      const response = await route.fetch();
      const json = await response.json();
      if (json.result?.logs?.length) {
        const log = json.result.logs[0];
        if (mismatch === 'missing') json.result.logs = [];
        else {
          log.topics = encodeEventTopics({
            abi,
            eventName: 'DungeonMutated',
            args: {
              revision: mismatch === 'revision' ? 99n : 1n,
              editor:
                mismatch === 'editor'
                  ? '0x0000000000000000000000000000000000000001'
                  : log.topics[2].replace(/^0x0{24}/, '0x'),
              tileIndex: mismatch === 'tile' ? 15 : 31,
            },
          });
          log.data = encodeAbiParameters(
            [{ type: 'bool' }, { type: 'uint64' }],
            [mismatch !== 'becameWall', mismatch === 'mask' ? 0n : 0xd05b827900an],
          );
          if (mismatch === 'contract') log.address = '0x0000000000000000000000000000000000000001';
        }
      }
      await route.fulfill({ response, json });
    });
    await open(page);
    await walk(page);
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · SYNCING')).toBeVisible();
    await expect(page.locator('.success')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  });
}

test('orphaned confirmation is withdrawn, locks the attempt, and removes orphaned history', async ({
  page,
}) => {
  await injectWallet(page);
  const before = await rpc('evm_snapshot');
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toHaveCount(1);
  await rpc('evm_revert', [before]);
  await rpc('evm_mine');
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('#history')).toBeVisible();
  await expect(page.locator('.history-list article')).toHaveCount(0);
});

test('same revision with a different layout is stale while the run remains frozen', async ({
  page,
}) => {
  const before = await rpc('evm_snapshot');
  await direct();
  await open(page);
  await walk(page, 'DRRR');
  await rpc('evm_revert', [before]);
  await direct(0n, 0x59afba5156n, 20, 15);
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(
    page.getByText('Someone changed the dungeon first.', { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText('Playing revision 1 · Live revision 1')).toBeVisible();
  await expect(page.getByText('Steps 4 / 96')).toBeVisible();
});

test('offline observation withdraws cached success and keeps local play separate from history failure', async ({
  page,
}) => {
  await injectWallet(page);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toHaveCount(1);
  await page.route('http://127.0.0.1:8545/**', (route) => route.abort());
  await page.reload();
  await expect(page.getByText('Offline / stale observation.', { exact: false })).toBeVisible();
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
});
