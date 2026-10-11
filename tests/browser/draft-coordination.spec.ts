import { decodeFunctionData } from 'viem';
import { abi } from '../../src/config/abi';
import { test, expect, injectWallet, open, walk, prepare } from './helpers';

for (const stage of ['ready', 'estimating'] as const) {
  test(`adopting another tab draft discards a ${stage} transaction preview after wallet rejection`, async ({
    page,
    context,
  }) => {
    const other = await context.newPage();
    const wallet = await injectWallet(page);
    await injectWallet(other, 1);
    await open(page);
    await open(other);
    await walk(page);
    await walk(other);
    let releaseEstimate: (() => void) | undefined;
    if (stage === 'ready') await prepare(page, 31);
    else {
      let holdEstimate = true;
      await page.route('http://127.0.0.1:8545/**', async (route) => {
        if (route.request().postDataJSON().method === 'eth_estimateGas' && holdEstimate) {
          holdEstimate = false;
          await new Promise<void>((resolve) => {
            releaseEstimate = resolve;
          });
        }
        await route.continue();
      });
      await page.getByRole('button', { name: 'Tile 31:' }).click();
      await page.getByRole('button', { name: 'Commit one change' }).click();
      await expect.poll(() => Boolean(releaseEstimate)).toBe(true);
    }
    await prepare(other, 15);
    await other.evaluate(() => {
      const provider = (window as any).ethereum;
      const request = provider.request.bind(provider);
      provider.request = (input: { method: string }) =>
        input.method === 'eth_sendTransaction'
          ? new Promise((_, reject) => {
              (window as any).rejectHeldWrite = () =>
                reject(Object.assign(new Error('User rejected request'), { code: 4001 }));
            })
          : request(input);
    });
    await other.getByRole('button', { name: 'Sign and submit edit' }).click();
    await expect(other.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tile 15:' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(() => other.evaluate(() => typeof (window as any).rejectHeldWrite))
      .toBe('function');
    await other.evaluate(() => (window as any).rejectHeldWrite());
    await expect(page.getByText('COMMIT ATTEMPT · REJECTED')).toBeVisible();
    releaseEstimate?.();
    await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Transaction preview' })).toHaveCount(0);
    expect(wallet.requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Commit one change' }).click();
    await expect(page.getByRole('region', { name: 'Transaction preview' })).toContainText(
      'tile 15',
    );
    await page.getByRole('button', { name: 'Sign and submit edit' }).click();
    await expect(page.locator('.success')).toHaveCount(1);
    expect(wallet.requests).toHaveLength(1);
    const decoded = decodeFunctionData({ abi, data: wallet.requests[0].params[0].data });
    expect(decoded.args?.[3]).toBe(15);
  });
}
