import { test, expect, injectWallet, open, walk, submit, rpc, direct } from './helpers';

test('a verified speed-up is followed automatically through its replacement hash', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  const original = await rpc('eth_getTransactionByHash', [wallet.hash]);
  const hash = await rpc('eth_sendTransaction', [
    {
      ...wallet.requests[0].params[0],
      maxFeePerGas: `0x${(BigInt(original.maxFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
      maxPriorityFeePerGas: `0x${(BigInt(original.maxPriorityFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
    },
  ]);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await expect(page.locator('.success')).toHaveCount(1);
  await expect(page.locator('.transaction')).toContainText(hash);
  await expect(page.locator('.transaction')).toContainText(wallet.hash!);
  expect(wallet.requests).toHaveLength(1);
});

for (const kind of ['cancellation', 'different action']) {
  test(`a manually recovered ${kind} ends the original attempt only after canonical inclusion`, async ({
    page,
  }) => {
    const wallet = await injectWallet(page);
    await rpc('evm_setAutomine', [false]);
    await open(page);
    await walk(page);
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    const original = await rpc('eth_getTransactionByHash', [wallet.hash]);
    const accounts = await rpc('eth_accounts');
    const hash = await rpc('eth_sendTransaction', [
      {
        from: original.from,
        to: kind === 'cancellation' ? original.from : accounts[2],
        value: '0x0',
        data: '0x',
        nonce: original.nonce,
        gas: '0x5208',
        maxFeePerGas: `0x${(BigInt(original.maxFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
        maxPriorityFeePerGas: `0x${(BigInt(original.maxPriorityFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
      },
    ]);
    await page.getByLabel('Recover with transaction hash').fill(hash);
    await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
    await rpc('evm_mine');
    await rpc('evm_setAutomine', [true]);
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(
      page.getByText(`COMMIT ATTEMPT · ${kind === 'cancellation' ? 'CANCELLED' : 'REPLACED'}`),
    ).toBeVisible();
    await expect(page.locator('.success')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  });
}

test('an unrelated or duplicate-payload hash with another nonce does not resolve a lost response', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'lost';
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  const wrongHash = await direct(1n, 0x596bfba5156n, 22, 38, 1);
  await page.getByLabel('Recover with transaction hash').fill(wrongHash);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unrelated or linkage is ambiguous');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.locator('.success')).toHaveCount(0);
});

test('closing the signing tab retains the deployment lock across wallet accounts', async ({
  page,
  context,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'hold';
  await open(page);
  await walk(page);
  await submit(page);
  await expect.poll(() => wallet.requests.length).toBe(1);
  await page.close();
  const other = await context.newPage();
  const secondWallet = await injectWallet(other, 1);
  await open(other);
  await expect(other.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  expect(secondWallet.requests).toHaveLength(0);
});

test('a tab with unsaved status preserves replacement evidence recorded by another tab', async ({
  page,
  context,
}) => {
  const wallet = await injectWallet(page);
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('ruin-relay:') && !(window as any).allowRecoveryWrites)
        throw new DOMException('Storage denied');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByText('Recovery storage failed.', { exact: false })).toBeVisible();
  const other = await context.newPage();
  await injectWallet(other);
  await open(other);
  const original = await rpc('eth_getTransactionByHash', [wallet.hash]);
  const hash = await rpc('eth_sendTransaction', [
    {
      from: original.from,
      to: original.from,
      value: '0x0',
      data: '0x',
      nonce: original.nonce,
      gas: '0x5208',
      maxFeePerGas: `0x${(BigInt(original.maxFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
      maxPriorityFeePerGas: `0x${(BigInt(original.maxPriorityFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
    },
  ]);
  await other.getByLabel('Recover with transaction hash').fill(hash);
  await other.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(other.locator('.transaction')).toContainText(hash);
  await page.evaluate(() => {
    (window as any).allowRecoveryWrites = true;
  });
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.locator('.transaction')).toContainText(hash);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await other.reload();
  await expect(other.getByText('COMMIT ATTEMPT · CANCELLED')).toBeVisible();
  await expect(other.locator('.transaction')).toContainText(hash);
  await expect(other.locator('.transaction')).toContainText(wallet.hash!);
  expect(wallet.requests).toHaveLength(1);
});
