import { test, expect, open } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
test('rapid keys are applied once even when animation frames pause', async ({ page }) => {
  await open(page);
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole('application').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Player at tile 8\./);
  await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
  await page.keyboard.press('r');
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
});
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
  await expect(page.locator('#commit-help')).toHaveText(
    'Choose a highlighted floor to add a wall, or a highlighted wall to remove it.',
  );
  await page.getByRole('button', { name: 'Tile 8:' }).click();
  await expect(page.getByText('That edit blocks every route to the exit.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await expect(page.locator('#commit-help')).toHaveText(
    'Choose a different tile. At least one route from START to EXIT must stay open.',
  );
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  await expect(page.getByText('Preview only · your change has not been saved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
  await expect(page.locator('#commit-help')).toContainText('Ready to review.');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByText('Steps 0 / 96')).toBeVisible();
});
