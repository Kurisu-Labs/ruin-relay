import { test, expect, injectWallet, open, walk, submit, rpc } from './helpers';

for (const kind of ['speed-up', 'cancellation'] as const) {
  test(`a manually linked pending ${kind} survives reload and resolves from canonical inclusion`, async ({
    page,
  }) => {
    const wallet = await injectWallet(page);
    let originalAvailable = false;
    await page.route('http://127.0.0.1:8545/**', async (route) => {
      const request = route.request().postDataJSON();
      if (request.method !== 'eth_getTransactionByHash' || request.params[0] !== wallet.hash)
        return route.continue();
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({ response, json });
      originalAvailable ||= Boolean(json.result);
    });
    await rpc('evm_setAutomine', [false]);
    await open(page);
    await walk(page);
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await expect.poll(() => originalAvailable).toBe(true);
    const original = await rpc('eth_getTransactionByHash', [wallet.hash]);
    const hash = await rpc('eth_sendTransaction', [
      {
        ...(kind === 'speed-up'
          ? wallet.requests[0].params[0]
          : { from: original.from, to: original.from, value: '0x0', data: '0x', gas: '0x5208' }),
        nonce: original.nonce,
        maxFeePerGas: `0x${(BigInt(original.maxFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
        maxPriorityFeePerGas: `0x${(BigInt(original.maxPriorityFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
      },
    ]);
    await page.getByLabel('Recover with transaction hash').fill(hash);
    await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
    await expect(page.locator('.transaction')).toContainText(hash);
    await page.reload();
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await expect(page.locator('.transaction')).toContainText(hash);
    await expect(page.locator('.transaction')).toContainText(wallet.hash!);
    await expect(page.locator('.steps')).toHaveText('Steps 20 / 96');
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
    await expect(page.locator('.success')).toHaveCount(0);
    await rpc('evm_mine');
    await rpc('evm_setAutomine', [true]);
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    if (kind === 'speed-up') {
      await expect(page.locator('.success')).toContainText('Your edit created revision #1');
      await expect(page.locator('.history-list article')).toHaveCount(1);
    } else {
      await expect(page.getByText('COMMIT ATTEMPT · CANCELLED')).toBeVisible();
      await expect(page.locator('.success')).toHaveCount(0);
      await expect(page.locator('.history-list article')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
    }
    expect(wallet.requests).toHaveLength(1);
  });
}

test('a same-sender cancellation cannot supply missing original nonce evidence', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  // The wallet returns a hash, but its original transaction metadata is unavailable.
  // Preflight's requested nonce is not evidence of the nonce the wallet actually used.
  await page.route('http://127.0.0.1:8545/**', async (route) => {
    const request = route.request().postDataJSON();
    if (request.method === 'eth_getTransactionByHash' && request.params[0] === wallet.hash)
      return route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result: null } });
    return route.continue();
  });
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  const original = await rpc('eth_getTransactionByHash', [wallet.hash]);
  const hash = await rpc('eth_sendTransaction', [
    {
      from: original.from,
      to: original.from,
      nonce: original.nonce,
      value: '0x0',
      data: '0x',
      gas: '0x5208',
      maxFeePerGas: `0x${(BigInt(original.maxFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
      maxPriorityFeePerGas: `0x${(BigInt(original.maxPriorityFeePerGas ?? original.gasPrice) * 2n + 1n).toString(16)}`,
    },
  ]);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await page.getByLabel('Recover with transaction hash').fill(hash);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unrelated or linkage is ambiguous');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.locator('.transaction')).not.toContainText(hash);
  expect(wallet.requests).toHaveLength(1);
});
