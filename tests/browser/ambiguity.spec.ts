import { test, expect, injectWallet, open, walk, submit, rpc } from './helpers';

test('a requested nonce is not proof of the original nonce when the wallet response is lost', async ({
  page,
}) => {
  const wallet = await injectWallet(page);
  wallet.mode = 'lost';
  wallet.overrideNonce = 2;
  await open(page);
  await walk(page);
  await submit(page);
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  const requested = wallet.requests[0].params[0];
  const cancellation = await rpc('eth_sendTransaction', [
    {
      from: requested.from,
      to: requested.from,
      value: '0x0',
      nonce: requested.nonce,
      gas: '0x5208',
    },
  ]);
  await page.getByLabel('Recover with transaction hash').fill(cancellation);
  await page.getByRole('button', { name: 'Verify hash', exact: true }).click();
  await expect(page.getByText('COMMIT ATTEMPT · UNKNOWN')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.locator('.success')).toHaveCount(0);
});
