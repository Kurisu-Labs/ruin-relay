import { createPublicClient, http, encodeFunctionData } from 'viem';
import { abi } from '../../src/config/abi';
import { isSolvable } from '../../src/lib/rules';
import { test, expect, direct, injectWallet, open, walk, submit, rpc, deployment } from './helpers';

test('history failure leaves current-state play usable and duplicate logs produce one row', async ({
  page,
}) => {
  await direct();
  let unavailable = true;
  await page.route('http://127.0.0.1:8545/**', async (route) => {
    if (route.request().postDataJSON().method !== 'eth_getLogs') return route.continue();
    if (unavailable)
      return route.fulfill({
        json: {
          jsonrpc: '2.0',
          id: route.request().postDataJSON().id,
          error: { code: -32000, message: 'History unavailable' },
        },
      });
    const response = await route.fetch();
    const json = await response.json();
    json.result = [...json.result, ...json.result];
    await route.fulfill({ response, json });
  });
  await open(page);
  await walk(page, 'D');
  await expect(page.getByText('History unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByText('Steps 1 / 96')).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('.history-list article')).toHaveCount(1);
});

test('offline local play remains available but cannot commit until fresh observation', async ({
  page,
}) => {
  await open(page);
  await walk(page, 'D');
  await page.route('http://127.0.0.1:8545/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByText('Offline / stale observation.', { exact: false })).toBeVisible();
  await walk(page, 'RRRRURRDDLDLLDDRDRR');
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await page.unroute('http://127.0.0.1:8545/**');
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
});

test('cached success is checked again before displaying a current confirmation', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toHaveCount(1);
  let receipts = 0;
  await page.route('http://127.0.0.1:8545/**', (route) => {
    if (route.request().postDataJSON().method === 'eth_getTransactionReceipt') receipts++;
    return route.continue();
  });
  await page.reload();
  await expect(page.locator('.success')).toHaveCount(1);
  expect(receipts).toBeGreaterThan(0);
  expect(wallet.requests).toHaveLength(1);
});

test('a pending edit that loses the revision race has a reverted receipt and no contribution', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  // Remove this transaction from the pool, let another profile win, then re-broadcast the original fixed payload.
  await rpc('anvil_dropTransaction', [wallet.hash]);
  await rpc('evm_setAutomine', [true]);
  await direct(0n, 0x59afba5156n, 20, 31, 1);
  const original = wallet.requests[0].params[0];
  const hash = await rpc('eth_sendTransaction', [original]);
  await page.getByLabel('Recover with transaction hash').fill(hash);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText(
    'Someone changed the dungeon first. Play latest to try the new revision.',
  );
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play latest', exact: true }).click();
  await expect(page.getByText('Playing revision 1 · Live revision 1')).toBeVisible();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
});

test('cached success stays unverified when atomic coordination disappears', async ({ page }) => {
  await injectWallet(page);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toHaveCount(1);
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.route('http://127.0.0.1:8545/**', (route) =>
    route.request().postDataJSON().method === 'eth_getTransactionReceipt'
      ? route.abort()
      : route.continue(),
  );
  await page.reload();
  await expect(page.locator('.revision')).toHaveText('Live revision 1');
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.locator('.success')).toHaveCount(0);
});

for (const mismatch of ['receipt', 'transaction']) {
  test(`a mismatched ${mismatch} hash cannot confirm the requested edit`, async ({ page }) => {
    await injectWallet(page);
    await page.route('http://127.0.0.1:8545/**', async (route) => {
      const method = route.request().postDataJSON().method;
      if (
        method !==
        (mismatch === 'receipt' ? 'eth_getTransactionReceipt' : 'eth_getTransactionByHash')
      )
        return route.continue();
      const response = await route.fetch();
      const json = await response.json();
      const wrong = `0x${'1'.repeat(64)}`;
      if (json.result) {
        if (mismatch === 'transaction') json.result.hash = wrong;
        else {
          json.result.transactionHash = wrong;
          for (const log of json.result.logs) log.transactionHash = wrong;
        }
      }
      await route.fulfill({ response, json });
    });
    await open(page);
    await walk(page);
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
    await expect(page.locator('.success')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  });
}

test('the move cap freezes exploration and keyboard controls remain reachable', async ({
  page,
}) => {
  await open(page);
  await walk(page, 'DU'.repeat(48));
  await expect(page.getByText('Move limit reached.', { exact: false })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText('Steps 96 / 96')).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
  await walk(page, 'D');
  await page.keyboard.press('r');
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
});

test('a narrow mobile viewport keeps the board and critical controls within the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/mobile.png', fullPage: true });
});

test('public rules API agrees with Solidity on random masks and direct unsolvable edits revert', async () => {
  const config = await deployment();
  const client = createPublicClient({ transport: http(config.rpc) });
  let random = 123n;
  for (let i = 0; i < 80; i++) {
    random = (random * 6364136223846793005n + 1n) % (1n << 64n);
    const walls = i % 4 === 0 ? random : random & ((1n << 49n) - 1n) & ~((1n << 48n) | 1n);
    expect(
      await client.readContract({
        address: config.address,
        abi,
        functionName: 'isSolvable',
        args: [walls],
      }),
    ).toBe(isSolvable(walls));
  }
  const accounts = await rpc('eth_accounts');
  const hash = await rpc('eth_sendTransaction', [
    {
      from: accounts[0],
      to: config.address,
      gas: '0xf4240',
      data: encodeFunctionData({
        abi,
        functionName: 'completeAndMutate',
        args: [0n, 0x59afba5156n, 20, 8],
      }),
    },
  ]);
  const receipt = await client.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('reverted');
  expect(receipt.logs).toHaveLength(0);
  const [walls, revision] = await client.readContract({
    address: config.address,
    abi,
    functionName: 'getDungeon',
  });
  expect(walls).toBe(0xd053827900an);
  expect(revision).toBe(0n);
});
