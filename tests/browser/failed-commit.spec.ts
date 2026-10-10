import type { Page } from '@playwright/test';
import {
  test,
  expect,
  deployment,
  injectWallet,
  open,
  prepare,
  rpc,
  submit,
  walk,
  type WalletSendError,
} from './helpers';

async function restoredDraft(page: Page, reason: RegExp) {
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(reason);
  await expect(page.getByRole('button', { name: 'Switch to Arbitrum Sepolia' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('#history')).toBeVisible();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch to Arbitrum Sepolia' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByText(reason)).toBeVisible();
  await page.getByRole('button', { name: 'Commit one change' }).click();
  await expect(page.getByRole('region', { name: 'Transaction preview' })).toBeVisible();
}

test('a node fee rejection before broadcast restores the draft and survives reload', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.sendError = {
    code: -32603,
    message: 'Internal JSON-RPC error.',
    data: {
      code: -32000,
      message:
        'RPC error eth_sendRawTransaction: max fee per gas less than block base fee: address 0x1, maxFeePerGas: 1, baseFee: 2',
    },
  };
  await open(page);
  await walk(page);
  await prepare(page);
  await expect(page.getByText('Max fee per gas', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Sign and submit edit' }).click();
  await restoredDraft(page, /below the block base fee/);
  expect(wallet.requests).toHaveLength(1);
  const sent = wallet.requests[0].params[0];
  expect(sent.maxFeePerGas).toMatch(/^0x[0-9a-f]+$/i);
  expect(sent.maxPriorityFeePerGas).toMatch(/^0x[0-9a-f]+$/i);
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  const base = BigInt(block.baseFeePerGas ?? '0x0');
  const cap = BigInt(sent.maxFeePerGas);
  const priority = BigInt(sent.maxPriorityFeePerGas);
  expect(cap).toBeGreaterThanOrEqual(base * 2n + priority);
});

for (const failure of [
  {
    name: 'insufficient funds',
    error: {
      code: -32000,
      message: 'insufficient funds for gas * price + value',
    } satisfies WalletSendError,
    reason: /not broadcast/,
  },
  {
    name: 'simulation revert',
    error: {
      code: 3,
      message: 'execution reverted: UnsolvableMutation()',
    } satisfies WalletSendError,
    reason: /blocks every route/,
  },
] as const) {
  test(`a ${failure.name} error before broadcast restores the draft and survives reload`, async ({
    page,
  }) => {
    const wallet = await injectWallet(page);
    wallet.sendError = failure.error;
    await open(page);
    await walk(page);
    await submit(page);
    await restoredDraft(page, failure.reason);
    expect(wallet.requests).toHaveLength(1);
    expect(wallet.hash).toBeUndefined();
  });
}

test('a reverted receipt for another cause releases the lock and survives reload', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  const config = await deployment();
  await rpc('evm_setAutomine', [false]);
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
  const walls = 0xd053827900an | (1n << 7n);
  await rpc('anvil_setStorageAt', [
    config.address,
    '0x0',
    `0x${walls.toString(16).padStart(64, '0')}`,
  ]);
  await rpc('evm_mine');
  await rpc('evm_setAutomine', [true]);
  await expect(page.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText(
    'The transaction reverted. This attempt did not change the dungeon.',
  );
  await expect(page.locator('.transaction')).not.toContainText(
    'Play latest to try the new revision',
  );
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.locator('.transaction')).toContainText('did not change the dungeon');
  await page.getByRole('button', { name: 'Play latest', exact: true }).click();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  expect(wallet.requests).toHaveLength(1);
});

test('a timeout with no rejection reason stays unknown across reload', async ({ page }) => {
  const wallet = await injectWallet(page);
  wallet.sendError = { code: -32603, message: 'Request timed out' };
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to Arbitrum Sepolia' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await expect(page.getByLabel('Recover with transaction hash')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry status', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('#history')).toBeVisible();
  await page.getByLabel('Recover with transaction hash').fill(`0x${'ab'.repeat(32)}`);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unrelated or linkage is ambiguous');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Recover with transaction hash')).toBeEnabled();
  expect(wallet.requests).toHaveLength(1);
  expect(wallet.hash).toBeUndefined();
});
