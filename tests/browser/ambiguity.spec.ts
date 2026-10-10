import { test, expect, injectWallet, open, walk, submit, rpc } from './helpers';

test('a gapped nonce substitution is not an in-flight commit on the sequencer nonce', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'lost';
  wallet.overrideNonce = 7;
  try {
    await open(page);
    await walk(page);
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
    await expect(page.locator('.transaction')).toContainText('This commit was never broadcast');
    await expect(page.locator('.success')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
    expect(wallet.requests).toHaveLength(1);
  } finally {
    if (wallet.hash) await rpc('anvil_dropTransaction', [wallet.hash]).catch(() => undefined);
  }
});
