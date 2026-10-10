import { test, expect, open, walk, direct } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
import { cameraView, project } from '../../src/game/projection';
import type { Page } from '@playwright/test';

async function tilePoint(page: Page, tile: number) {
  const bounds = await page.locator('.board canvas').boundingBox();
  if (!bounds) throw new Error('Dungeon canvas is missing');
  const point = project(tile);
  const board = page.getByRole('application');
  const label = await board.getAttribute('aria-label');
  const position = Number(label?.match(/Player at tile (\d+)/)?.[1] ?? 0);
  const overview = (await board.getAttribute('data-view')) === 'map';
  const view = cameraView(bounds.width, bounds.height, project(position), overview);
  return {
    x: bounds.x + bounds.width / 2 + (point.x - view.x) * view.zoom,
    y: bounds.y + bounds.height / 2 + (point.y - view.y) * view.zoom,
  };
}

test('canvas floor picking previews the same edit as the DOM without selecting on hover', async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-close.png') });
  const start = await tilePoint(page, 7);
  await page.mouse.click(start.x, start.y);
  await expect(page.locator('.editor')).toHaveCount(0);
  await walk(page, fixture.revisions[0].path);
  const target = await tilePoint(page, 31);
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
  const wall = await tilePoint(page, 16);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.getByRole('button', { name: 'Tile 16:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const invalid = await tilePoint(page, 8);
  await page.mouse.click(invalid.x, invalid.y);
  await expect(page.getByText('That edit blocks every route to the exit.')).toBeVisible();
  await page
    .locator('.game-layout')
    .screenshot({ path: testInfo.outputPath('dungeon-editor.png') });
});

test('restart cancels visual motion and view preferences never reset a run', async ({ page }) => {
  await open(page);
  await page.getByRole('application').focus();
  await page.keyboard.press('s');
  await page.keyboard.press('d');
  await page.keyboard.press('r');
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
  await page.getByRole('button', { name: 'Reduced motion' }).click();
  await page.getByRole('application').focus();
  await page.keyboard.press('s');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await page.getByRole('button', { name: 'Tile numbers' }).click();
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await expect(page.locator('.board canvas')).toHaveCount(1);
  // A shortcut or a key outside the board must not move the character.
  await page.keyboard.press('d');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
  await page.getByRole('application').focus();
  await page.keyboard.press('Control+d');
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
  const target = await tilePoint(page, 38);
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

test('failed artwork can be retried without losing domain state or duplicating the canvas', async ({
  page,
}) => {
  await page.route('**/assets/game/v2/environment.png', (route) => route.abort());
  await page.goto('/play');
  await expect(page.getByRole('button', { name: 'Retry dungeon view' })).toBeVisible();
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
  await page.unroute('**/assets/game/v2/environment.png');
  await page.getByRole('button', { name: 'Retry dungeon view' }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.board canvas')).toHaveCount(1);
  await page.getByRole('application').focus();
  await page.keyboard.press('s');
  await expect(page.locator('.steps')).toHaveText('Steps 1 / 96');
});

test('live updates keep the existing run and its editable preview frozen', async ({ page }) => {
  await open(page);
  await walk(page, fixture.revisions[0].path);
  await direct();
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(
    page.getByText('Someone changed the dungeon first.', { exact: false }),
  ).toBeVisible();
  const target = await tilePoint(page, 31);
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
    const first = new KeyboardEvent('keydown', { key: 's', bubbles: true });
    board.dispatchEvent(first);
    board.dispatchEvent(first);
    for (const key of ['r', 's', 'd'])
      board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 's', repeat: true, bubbles: true }));
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
  });
  await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Player at tile 8\./);
});

test('ten graphics retries preserve the run, one canvas and one keyboard listener', async ({
  page,
}) => {
  await open(page);
  await walk(page, 'DR');
  for (let retry = 0; retry < 10; retry++) {
    await page.locator('.board canvas').evaluate((canvas) => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await expect(page.getByRole('button', { name: 'Retry dungeon view' })).toBeVisible();
    await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
    await page.getByRole('button', { name: 'Retry dungeon view' }).click();
    await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.board canvas')).toHaveCount(1);
  }
  await page.getByRole('application').focus();
  await page.keyboard.press('d');
  await expect(page.locator('.steps')).toHaveText('Steps 3 / 96');
});

test('unavailable WebGL leaves DOM controls readable and retry builds only the view', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.includes('webgl') && document.documentElement.dataset.graphics !== 'allowed')
        return null;
      return (original as any).call(this, type, ...args);
    } as typeof original;
  });
  await page.goto('/play');
  await expect(
    page.getByText('This browser could not start WebGL.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeVisible();
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
  await page.evaluate(() => {
    document.documentElement.dataset.graphics = 'allowed';
  });
  await page.getByRole('button', { name: 'Retry dungeon view' }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.board canvas')).toHaveCount(1);
});

test('close camera stays in play until escape opens the edit map', async ({ page }, testInfo) => {
  await open(page);
  const board = page.getByRole('application');
  await expect(board).toHaveAttribute('data-view', 'follow');
  await expect(page.getByRole('button', { name: 'Full dungeon', exact: true })).toHaveCount(0);
  await walk(page, 'D');
  await page.keyboard.press('w');
  await expect(board).toHaveAttribute('aria-label', /Player at tile 0\./);
  await expect(page.locator('.steps')).toHaveText('Steps 2 / 96');
  await expect(board).toHaveAttribute('data-view', 'follow');
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-close.png') });
  await board.focus();
  await page.keyboard.press('r');
  await walk(page, fixture.revisions[0].path);
  await expect(board).toHaveAttribute('data-view', 'map');
  await expect(page.getByRole('button', { name: 'Full dungeon', exact: true })).toHaveCount(0);
  await page.locator('.board-shell').screenshot({ path: testInfo.outputPath('dungeon-map.png') });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(board).toHaveAttribute('data-view', 'follow');
  await expect(page.locator('.steps')).toHaveText('Steps 0 / 96');
});
