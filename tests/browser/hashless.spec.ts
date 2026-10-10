import { encodeFunctionData, type Hex } from 'viem';
import type { Page } from '@playwright/test';
import { abi } from '../../src/config/abi';
import { pack, preview } from '../../src/lib/rules';
import { test, expect, deployment, direct, injectWallet, open, rpc } from './helpers';

const PATH = 'DRRRRURRDDLDLLDDRDRR';

function serialize(value: unknown) {
  return JSON.stringify(value, (_, item) =>
    typeof item === 'bigint' ? { bigint: item.toString() } : item,
  );
}

async function seedLegacyHashless(page: Page, account: Hex) {
  const config = await deployment();
  const walls = 0xd053827900an;
  const editableMask = 0x1f9e7e1cf00n;
  const tile = 31;
  const packed = pack(PATH);
  const attempt = {
    id: 'legacy-hashless',
    run: {
      snapshot: {
        chainId: 421614,
        address: config.address,
        walls,
        revision: 0n,
        editableMask,
        blockNumber: 1n,
        blockHash: `0x${'11'.repeat(32)}`,
      },
      path: PATH,
      position: 48,
    },
    tile,
    account,
    calldata: encodeFunctionData({
      abi,
      functionName: 'completeAndMutate',
      args: [0n, packed, PATH.length, tile],
    }),
    expectedWalls: preview(walls, editableMask, tile).walls,
    state: 'unknown',
    hashes: [],
    observed: [],
    message: 'Check your wallet for this transaction.',
  };
  const key = `ruin-relay:v1:421614:${config.address.toLowerCase()}`;
  await page.addInitScript(([storageKey, value]) => localStorage.setItem(storageKey, value), [
    key,
    serialize({ version: 1, attempts: [attempt] }),
  ] as const);
}

test('a legacy hashless journal unlocks when another wallet has moved the revision', async ({
  page,
}) => {
  const accounts: Hex[] = await rpc('eth_accounts');
  await direct(0n, pack(PATH), PATH.length, 31, 1);
  await injectWallet(page);
  await seedLegacyHashless(page, accounts[0]);
  await open(page);
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText(
    'Your earlier commit was never applied, and the dungeon has moved on. Play latest to try again.',
  );
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.locator('.success')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Play latest', exact: true }).click();
  await expect(page.getByText('Playing revision 1 · Live revision 1')).toBeVisible();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
});

test('a legacy hashless journal is confirmed when the account mutated snapshot+1', async ({
  page,
}) => {
  const accounts: Hex[] = await rpc('eth_accounts');
  await direct(0n, pack(PATH), PATH.length, 31, 0);
  await injectWallet(page);
  await seedLegacyHashless(page, accounts[0]);
  await open(page);
  await expect(page.getByText('COMMIT ATTEMPT · CONFIRMED')).toBeVisible();
  await expect(page.locator('.success')).toContainText('Your edit created revision #1.');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('.success')).toContainText('Your edit created revision #1.');
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
});

test('a legacy hashless journal with the same revision unlocks when nothing is in flight', async ({
  page,
}) => {
  const accounts: Hex[] = await rpc('eth_accounts');
  await injectWallet(page);
  await seedLegacyHashless(page, accounts[0]);
  await open(page);
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText('This commit was never broadcast');
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry status', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
});

test('a legacy hashless journal stays locked while the account has a pending transaction', async ({
  page,
}) => {
  const accounts: Hex[] = await rpc('eth_accounts');
  await rpc('evm_setAutomine', [false]);
  const pending = await rpc('eth_sendTransaction', [
    { from: accounts[0], to: accounts[0], value: '0x0' },
  ]);
  await injectWallet(page);
  await seedLegacyHashless(page, accounts[0]);
  await open(page);
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText(
    'This commit has no transaction hash yet. It stays locked until the dungeon moves on or you recover a transaction hash.',
  );
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play latest', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  const unrelated = await rpc('eth_sendTransaction', [
    { from: accounts[1], to: accounts[1], value: '0x0' },
  ]);
  await page.getByLabel('Recover with transaction hash').fill(unrelated);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unrelated or linkage is ambiguous');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await rpc('anvil_dropTransaction', [pending]);
  await page.getByRole('button', { name: 'Retry status', exact: true }).click();
  await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
  await expect(page.locator('.transaction')).toContainText('This commit was never broadcast');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await rpc('anvil_dropTransaction', [unrelated]).catch(() => undefined);
});
