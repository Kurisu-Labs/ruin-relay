import { decodeFunctionData } from 'viem';
import { abi } from '../../src/config/abi';
import { test, expect, injectWallet, open, walk, submit, rpc } from './helpers';

test('independent profiles racing after simulation produce one mutation and a stale loser', async ({
  page,
  browser,
}) => {
  const otherContext = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    const other = await otherContext.newPage();
    const winner = await injectWallet(page, 0);
    const loser = await injectWallet(other, 1);
    winner.mode = 'hold';
    loser.mode = 'hold';
    await open(page);
    await other.goto(new URL('/play', page.url()).href);
    await expect(other.getByRole('application')).toHaveAttribute('aria-busy', 'false');
    await walk(page);
    await walk(other);
    await rpc('evm_setAutomine', [false]);

    // Both real UI preflights succeed on revision 0 before either transaction is included.
    // FIFO mining gives the first submitted edit the win, independently of browser timing.
    await submit(page);
    await expect(page.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
    await submit(other);
    await expect(other.getByText('COMMIT ATTEMPT · SIGNING')).toBeVisible();
    for (const wallet of [winner, loser]) {
      expect(wallet.requests).toHaveLength(1);
      expect(decodeFunctionData({ abi, data: wallet.requests[0].params[0].data })).toEqual({
        functionName: 'completeAndMutate',
        args: [0n, 0x59afba5156n, 20, 31],
      });
    }
    expect(winner.requests[0].params[0].from).not.toBe(loser.requests[0].params[0].from);
    winner.release?.();
    await expect(page.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    loser.release?.();
    await expect(other.getByText('COMMIT ATTEMPT · PENDING')).toBeVisible();
    await rpc('evm_mine');
    await rpc('evm_setAutomine', [true]);
    await expect(page.locator('.success')).toContainText('Your edit created revision #1.');
    await expect(other.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
    await expect(other.locator('.transaction')).toContainText(
      'Someone changed the dungeon first. Play latest to try the new revision.',
    );
    await expect(other.locator('.success')).toHaveCount(0);
    await expect(other.getByText('Playing revision 0 · Live revision 1')).toBeVisible();
    await expect(other.locator('.steps')).toHaveText('Steps 20 / 96');
    await expect(other.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(other.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
    for (const player of [page, other]) {
      await expect(player.locator('.history-list article')).toHaveCount(1);
    }

    await other.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await other.reload();
    await expect(other.getByText('COMMIT ATTEMPT · REVERTED')).toBeVisible();
    await expect(other.getByText('Playing revision 0 · Live revision 1')).toBeVisible();
    await other.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(other.getByText('Playing revision 0 · Live revision 1')).toBeVisible();
    await expect(other.locator('.steps')).toHaveText('Steps 0 / 96');
    await other.getByRole('button', { name: 'Play latest', exact: true }).click();
    await expect(other.getByText('Playing revision 1 · Live revision 1')).toBeVisible();
    await expect(other.getByRole('application')).toHaveAttribute(
      'aria-label',
      /Player at tile 0\./,
    );
    await expect(other.getByRole('button', { name: 'Tile 31:' })).toHaveCount(0);
    expect(winner.requests).toHaveLength(1);
    expect(loser.requests).toHaveLength(1);
  } finally {
    await otherContext.close();
  }
});
