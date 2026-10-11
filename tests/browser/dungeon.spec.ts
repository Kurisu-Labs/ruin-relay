import { test, expect, open, walk, direct, mapTilePoint } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
test('canvas floor picking previews the same edit as the DOM without selecting on hover', async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-close.png') });
  await page.locator('.board canvas').click();
  await expect(page.locator('.editor')).toHaveCount(0);
  await walk(page, fixture.revisions[0].path);
  const target = await mapTilePoint(page, 31);
  await page.mouse.move(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  const wall = await mapTilePoint(page, 16);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.getByRole('button', { name: 'Tile 16:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const invalid = await mapTilePoint(page, 8);
  await page.mouse.click(invalid.x, invalid.y);
  await expect(page.getByText('That edit blocks every route to the exit.')).toBeVisible();
  await page
    .locator('.game-layout')
    .screenshot({ path: testInfo.outputPath('dungeon-editor.png') });
});

test('restart cancels visual motion and view preferences never reset a run', async ({ page }) => {
  await open(page);
  await page.getByRole('application').focus();
  await page.keyboard.press('w');
  await page.keyboard.press('a');
  await page.keyboard.press('r');
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
  const preferences = page.getByLabel('View settings', { exact: true });
  await preferences.click();
  await page.getByRole('button', { name: 'Reduced motion' }).click();
  await preferences.click();
  await page.getByRole('application').focus();
  await page.keyboard.press('w');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await preferences.click();
  await page.getByRole('button', { name: 'Tile numbers on map' }).click();
  await preferences.click();
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await expect(page.locator('.board canvas')).toHaveCount(1);
  // A shortcut or a key outside the board must not move the character.
  await page.keyboard.press('a');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await page.getByRole('application').focus();
  await page.keyboard.press('Control+a');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
});

test('resize preserves the frozen run and camera picking on a narrow viewport', async ({
  page,
}, testInfo) => {
  await open(page);
  await walk(page, fixture.revisions[0].path);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.steps')).toHaveText('Steps 20 / 96');
  await expect
    .poll(async () => {
      const canvas = await page.locator('.board canvas').boundingBox();
      const host = await page.locator('.board').boundingBox();
      return canvas && host ? Math.abs(canvas.width - host.width) : Infinity;
    })
    .toBeLessThan(2);
  const target = await mapTilePoint(page, 38);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Tile 38:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.board canvas')).toHaveCount(1);
  await page
    .locator('.board-shell')
    .screenshot({ path: testInfo.outputPath('dungeon-mobile.png') });
});

test('live updates keep the existing run and its editable preview frozen', async ({ page }) => {
  await open(page);
  await walk(page, fixture.revisions[0].path);
  await direct();
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(
    page.getByText('Someone changed the dungeon first.', { exact: false }),
  ).toBeVisible();
  const target = await mapTilePoint(page, 31);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Tile 31: floor to wall' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play latest' }).click();
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Player at tile 0\./);
});

test('distinct inputs and restart in one task are applied once without waiting for a render', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('application').focus();
  await page.evaluate(() => {
    const board = document.querySelector('[role="application"]')!;
    const first = new KeyboardEvent('keydown', { key: 'w', bubbles: true });
    board.dispatchEvent(first);
    board.dispatchEvent(first);
    for (const key of ['r', 'w', 'a'])
      board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', repeat: true, bubbles: true }));
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true }));
  });
  await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Player at tile 8\./);
});

test('first-person camera stays in play until escape opens the edit map', async ({
  page,
}, testInfo) => {
  await open(page);
  const board = page.getByRole('application');
  await expect(board).toHaveAttribute('data-view', 'first-person');
  await expect(page.getByRole('button', { name: 'Full dungeon', exact: true })).toHaveCount(0);
  await walk(page, 'D');
  await page.keyboard.press('s');
  await expect(board).toHaveAttribute('aria-label', /Player at tile 0\./);
  await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
  await expect(board).toHaveAttribute('data-view', 'first-person');
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-close.png') });
  await board.focus();
  await page.keyboard.press('r');
  await walk(page, fixture.revisions[0].path);
  await expect(board).toHaveAttribute('data-view', 'map');
  await expect(page.getByRole('button', { name: 'Full dungeon', exact: true })).toHaveCount(0);
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-map.png') });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(board).toHaveAttribute('data-view', 'first-person');
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
});
