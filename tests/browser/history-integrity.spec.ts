import { encodeAbiParameters } from 'viem';
import { test, expect, direct, open, walk } from './helpers';

for (const fault of ['empty', 'missing-latest', 'missing-earlier', 'wrong-mask'] as const) {
  test(`successful RPC responses with ${fault} history are unavailable, not empty or complete`, async ({
    page,
  }) => {
    await direct();
    await direct(1n, 0x596bfba5156n, 22, 38, 1);
    let incomplete = true;
    await page.route('http://127.0.0.1:8545/**', async (route) => {
      if (route.request().postDataJSON().method !== 'eth_getLogs' || !incomplete)
        return route.continue();
      const response = await route.fetch();
      const json = await response.json();
      if (fault === 'empty') json.result = [];
      else if (fault === 'wrong-mask') {
        for (const log of json.result)
          if (BigInt(log.topics[1]) === 2n)
            log.data = encodeAbiParameters([{ type: 'bool' }, { type: 'uint64' }], [true, 0n]);
      } else {
        const missing = fault === 'missing-latest' ? 2n : 1n;
        json.result = json.result.filter(
          (log: { topics: string[] }) => BigInt(log.topics[1]) !== missing,
        );
      }
      await route.fulfill({ response, json });
    });
    await open(page);
    await expect(page.locator('.revision')).toHaveText('Live revision 2');
    await walk(page, 'D');
    await expect(page.getByText('History unavailable.', { exact: false })).toBeVisible();
    await expect(page.locator('.history-list article')).toHaveCount(0);
    await expect(page.getByText('Steps 1 / 96')).toBeVisible();
    incomplete = false;
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.locator('.history-list article')).toHaveCount(2);
    await expect(page.getByText('History unavailable.', { exact: false })).toHaveCount(0);
  });
}

test('complete history keeps only the ten newest revisions', async ({ page }) => {
  for (let revision = 0; revision < 12; revision++) {
    const wall31 = revision % 2 === 1;
    await direct(BigInt(revision), wall31 ? 0x596bfba5156n : 0x59afba5156n, wall31 ? 22 : 20, 31);
  }
  await open(page);
  await expect(page.locator('.revision')).toHaveText('Live revision 12');
  const rows = page.locator('.history-list article');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('#12');
  await expect(rows.last()).toContainText('#3');
  await expect(page.getByText('History unavailable.', { exact: false })).toHaveCount(0);
});
