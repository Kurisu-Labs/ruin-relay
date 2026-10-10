import { test, expect, direct, injectWallet, open, rpc, walk, submit } from './helpers';

test('an open wallet request stays signing and does not offer hash recovery', async ({ page }) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'hold';
  await open(page);
  await walk(page);
  await submit(page);
  await expect.poll(() => wallet.requests.length).toBe(1);
  await expect(page.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
  await expect(page.getByText('Waiting for wallet confirmation', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Approve or reject the request in your wallet.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Recover with transaction hash')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
  await page.waitForTimeout(5_500);
  await expect(page.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByLabel('Recover with transaction hash')).toHaveCount(0);
  wallet.release?.();
  await expect(page.locator('.success')).toHaveCount(1);
  expect(wallet.requests).toHaveLength(1);
});

test('reloading while the wallet request is open releases it when nothing was broadcast', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'hold';
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText('This commit was never broadcast');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(wallet.requests).toHaveLength(1);
  wallet.release?.();
});

test('own confirmation explains the new revision and history updates without a status refresh', async ({
  page,
}) => {
  await injectWallet(page);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toContainText(
    'Your edit created revision #1. The dungeon is now at revision #1.',
  );
  await expect(page.getByText('Someone changed the dungeon first.')).toHaveCount(0);
  await expect(
    page.getByText('Play latest to try the new dungeon.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await expect(page.locator('.history-list article')).toHaveCount(1);
  await direct(1n, 0x596bfba5156n, 22, 38, 1);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(
    page.getByText('Someone changed the dungeon first.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.success')).toContainText(
    'Your edit created revision #1. The dungeon is now at revision #2.',
  );
  await expect(page.locator('.history-list article')).toHaveCount(2);
});

test('a verified contribution stays in history when the head block moves during the log read', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await open(page);
  let releaseLogs = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseLogs = resolve;
  });
  let held = false;
  await page.route('http://127.0.0.1:8545/**', async (route) => {
    const request = route.request().postDataJSON();
    if (request?.method === 'eth_getLogs' && wallet.hash && !held) {
      held = true;
      await gate;
    }
    return route.continue();
  });
  await walk(page);
  const pending = submit(page);
  await expect.poll(() => held).toBe(true);
  await rpc('evm_mine');
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  releaseLogs();
  await pending;
  await expect(page.locator('.history-list article')).toHaveCount(1);
  await expect(page.locator('.history-list')).toContainText('Tile 31');
});
