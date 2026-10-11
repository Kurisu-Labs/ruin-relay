import { test, expect, injectWallet, open, walk, submit, rpc } from './helpers';

test('reorg and reinclusion synchronize contribution, history, and attempt locks across tabs and reload', async ({
  page,
  context,
}) => {
  const wallet = await injectWallet(page);
  const before = await rpc('evm_snapshot');
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.locator('.success')).toHaveCount(1);
  const raw = await rpc('eth_getRawTransactionByHash', [wallet.hash]);
  const other = await context.newPage();
  const otherWallet = await injectWallet(other, 1);
  await open(other);
  for (const tab of [page, other]) {
    await expect(tab.locator('.success')).toContainText('Your edit created revision #1.');
    await expect(tab.locator('.history-list article')).toHaveCount(1);
  }

  await rpc('evm_revert', [before]);
  await rpc('evm_mine');
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  for (const tab of [page, other]) {
    await expect(tab.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await expect(tab.locator('.success')).toHaveCount(0);
    await expect(tab.locator('.history-list article')).toHaveCount(0);
    await expect(tab.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
    await expect(tab.getByRole('button', { name: 'Play latest', exact: true })).toBeDisabled();
    await expect(tab.getByText('Steps 20 / 96')).toBeVisible();
  }
  await other.reload();
  await expect(other.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  await expect(other.locator('.transaction')).toContainText(wallet.hash!);
  await expect(other.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();

  expect(await rpc('eth_sendRawTransaction', [raw])).toBe(wallet.hash);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  for (const tab of [page, other]) {
    await expect(tab.locator('.success')).toContainText('Your edit created revision #1.');
    await expect(tab.locator('.history-list article')).toHaveCount(1);
    await expect(tab.locator('.history-list article')).toContainText(wallet.hash!);
    await expect(tab.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  }
  expect(wallet.requests).toHaveLength(1);
  expect(otherWallet.requests).toHaveLength(0);
});

for (const kind of ['cancellation', 'different action']) {
  const outcome = kind === 'cancellation' ? 'CANCELLED' : 'REPLACED';
  test(`a ${kind} survives reload, loses its terminal outcome on reorg, and verifies reinclusion`, async ({
    page,
  }) => {
    const wallet = await injectWallet(page);
    const before = await rpc('evm_snapshot');
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
    const raw = await rpc('eth_getRawTransactionByHash', [hash]);
    await page.getByLabel('Recover with transaction hash').fill(hash);
    await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
    await rpc('evm_mine');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByText(`COMMIT ATTEMPT · ${outcome}`)).toBeVisible();
    await page.reload();
    await expect(page.getByText(`COMMIT ATTEMPT · ${outcome}`)).toBeVisible();

    await rpc('evm_revert', [before]);
    await rpc('evm_mine');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await expect(page.locator('.transaction')).toContainText(hash);
    await expect(page.locator('.transaction')).toContainText(wallet.hash!);
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();

    expect(await rpc('eth_sendRawTransaction', [raw])).toBe(hash);
    await rpc('evm_mine');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByText(`COMMIT ATTEMPT · ${outcome}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
    await expect(page.locator('.success')).toHaveCount(0);
    await expect(page.locator('.history-list article')).toHaveCount(0);
    expect(wallet.requests).toHaveLength(1);
  });
}
