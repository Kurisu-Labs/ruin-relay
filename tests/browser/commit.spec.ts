import { test, expect, direct, injectWallet, open, walk, prepare, submit, rpc } from './helpers';

test('two wallet profiles contribute the exact canonical revisions and public history', async ({
  page,
  browser,
}) => {
  const walletA = await injectWallet(page);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toContainText(
    'Your edit created revision #1. The dungeon is now at revision #1.',
  );
  expect(walletA.requests).toHaveLength(1);
  expect(walletA.requests[0].params[0].value).toBe('0x0');
  const contextB = await browser.newContext({ reducedMotion: 'reduce' });
  const pageB = await contextB.newPage();
  const walletB = await injectWallet(pageB, 1);
  await pageB.goto('http://127.0.0.1:4173/play');
  await expect(pageB.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await walk(pageB, 'DRRRRURRDDLDLLLDDRRDRR');
  await submit(pageB, 38);
  await expect(pageB.locator('.success')).toContainText(
    'Your edit created revision #2. The dungeon is now at revision #2.',
  );
  expect(walletB.requests).toHaveLength(1);
  await pageB.getByRole('link', { name: 'History', exact: true }).click();
  await expect(pageB.locator('#history')).toBeVisible();
  await expect(pageB.locator('.history-list article')).toHaveCount(2);
  await contextB.close();
});

test('a stale run stays frozen, Restart repeats it, and Play latest adopts the live dungeon', async ({
  page,
}) => {
  await open(page);
  await walk(page, 'DRRR');
  await direct();
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByText('Playing revision 0 · Live revision 1')).toBeVisible();
  await expect(page.getByText('Steps 4 / 96')).toBeVisible();
  await walk(page, 'RURRDDLDLLDDRDRR');
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByText('Playing revision 0 · Live revision 1')).toBeVisible();
  await page.getByRole('button', { name: 'Play latest', exact: true }).click();
  await expect(page.getByText('Playing revision 1 · Live revision 1')).toBeVisible();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
});

test('explicit wallet rejection restores the run and tile without a success claim', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'reject';
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.locator('.success')).toHaveCount(0);
  expect(wallet.requests).toHaveLength(1);
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('#history')).toBeVisible();
});

test('pending attempts survive reload and status reads never resubmit', async ({ page }) => {
  const wallet = await injectWallet(page);
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  await expect(page.getByText('Steps 20 / 96')).toBeVisible();
  await page.getByRole('button', { name: 'Retry status', exact: true }).click();
  expect(wallet.requests).toHaveLength(1);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await expect(page.locator('.success')).toHaveCount(1);
  expect(wallet.requests).toHaveLength(1);
});

test('a lost wallet response is confirmed when its mined event matches the attempt', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'lost';
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toContainText('Your edit created revision #1.');
  await expect(page.getByText('COMMIT ATTEMPT · CONFIRMED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('.success')).toContainText('Your edit created revision #1.');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  expect(wallet.requests).toHaveLength(1);
});

test('atomic same-profile claim allows one signing request across two accounts', async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  const a = await injectWallet(page);
  const b = await injectWallet(other, 1);
  a.mode = 'hold';
  b.mode = 'hold';
  await open(page);
  await open(other);
  await walk(page);
  await walk(other);
  await prepare(page);
  await prepare(other);
  await Promise.all([
    page.getByRole('button', { name: 'Sign and submit edit' }).click(),
    other.getByRole('button', { name: 'Sign and submit edit' }).click(),
  ]);
  await expect.poll(() => a.requests.length + b.requests.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(other.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  (a.release ?? b.release)?.();
  await expect(page.locator('.success')).toHaveCount(1);
});
