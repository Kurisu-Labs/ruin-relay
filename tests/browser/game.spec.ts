import { test, expect } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
test('wallet-free escape opens a one-tile editor with a bounded solvability preview', async ({
  page,
}) => {
  await page.goto('/play');
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('application').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
  for (const direction of fixture.revisions[0].path)
    await page.keyboard.press(
      { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' }[direction]!,
    );
  await expect(page.getByText('Dungeon Escaped!')).toBeVisible();
  await page.getByRole('button', { name: 'Tile 8:' }).click();
  await expect(page.getByText('That edit blocks every route to the exit.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
});
