import { test, expect, injectWallet, prepare, mapTilePoint, movementControls } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
import type { Page } from '@playwright/test';

// Continuous trace screencasts stall software WebGL. Keep DOM/network tracing
// and the explicit screenshots that verify each finished view.
test.use({
  trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
  // Functional paths use the supported static view; animated rendering has its own case below.
  reducedMotion: 'reduce',
});

const compass = ['U', 'R', 'D', 'L'] as const;
type Heading = (typeof compass)[number];
async function open3D(page: Page) {
  await page.goto('/play');
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
}

async function position(page: Page, tile: number, steps: number) {
  await expect(page.getByRole('application')).toHaveAttribute(
    'aria-label',
    new RegExp(`Player at tile ${tile}\\.`),
  );
  await expect(page.locator('.steps')).toHaveText(`Steps ${steps} / 96`);
}

/** Drive the fixture through visible relative controls, without calling the game model. */
async function walk3D(
  page: Page,
  path = fixture.revisions[0].path,
  heading: Heading = 'D',
  touch = false,
) {
  let facing = compass.indexOf(heading);
  let moves = Number((await page.locator('.steps').innerText()).match(/Steps (\d+)/)![1]);
  if (!touch) await page.getByRole('application').focus();
  const turn = async (left: boolean) => {
    if (touch)
      await page
        .getByRole('button', { name: left ? 'Turn left' : 'Turn right', exact: true })
        .tap();
    else await page.keyboard.press(left ? 'q' : 'e');
  };
  for (const direction of path) {
    const target = compass.indexOf(direction as Heading);
    const clockwise = (target - facing + 4) % 4;
    if (clockwise === 3) await turn(true);
    else for (let turns = 0; turns < clockwise; turns++) await turn(false);
    facing = target;
    if (touch) await page.getByRole('button', { name: 'Step forward', exact: true }).tap();
    else await page.keyboard.press('w');
    await expect(page.locator('.steps')).toHaveText(`Steps ${++moves} / 96`);
  }
}

function measureViewport(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element || !element.getClientRects().length) return null;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.game-toolbar > a, .game-toolbar > button, .fullscreen-control > button, .board-settings > summary, .board-dpad button',
      ),
      (element) => ({
        name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
        movement: element.matches('.board-dpad button'),
        bounds: rect(element),
      }),
    );
    const canvases = document.querySelectorAll('[role="application"] canvas');
    return {
      dimensions: {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      screen: rect(document.querySelector('.play-screen')),
      stage: rect(document.querySelector('.board-stage')),
      canvas: rect(canvases.item(0)),
      canvasCount: canvases.length,
      controls,
    };
  });
}

async function fitsViewport(page: Page) {
  let measured: Awaited<ReturnType<typeof measureViewport>> | undefined;
  await expect
    .poll(async () => {
      measured = await measureViewport(page);
      const { stage, canvas } = measured;
      return stage && canvas
        ? Math.max(Math.abs(stage.width - canvas.width), Math.abs(stage.height - canvas.height))
        : Infinity;
    })
    .toBeLessThanOrEqual(2);
  const { dimensions, screen, canvas: bounds, canvasCount, controls } = measured!;
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  expect(screen).not.toBeNull();
  expect(Math.abs(screen!.height - dimensions.height)).toBeLessThanOrEqual(2);
  expect(canvasCount).toBe(1);
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThan(70);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(dimensions.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(dimensions.height + 1);

  for (const name of ['Back to home', 'Restart', 'Game menu', ...movementControls])
    expect(
      controls.some((control) => control.name === name),
      `${name} exists`,
    ).toBe(true);
  for (const { name, movement, bounds: target } of controls) {
    // The inactive movement pad is deliberately hidden on the narrow EXIT map.
    if (movement && target === null) continue;
    expect(target, `${name} is visible`).not.toBeNull();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    expect(target!.x).toBeGreaterThanOrEqual(0);
    expect(target!.y).toBeGreaterThanOrEqual(0);
    expect(target!.x + target!.width).toBeLessThanOrEqual(dimensions.width + 1);
    expect(target!.y + target!.height).toBeLessThanOrEqual(dimensions.height + 1);
    const overlapsCanvas =
      target!.x < bounds!.x + bounds!.width - 1 &&
      target!.x + target!.width > bounds!.x + 1 &&
      target!.y < bounds!.y + bounds!.height - 1 &&
      target!.y + target!.height > bounds!.y + 1;
    expect(overlapsCanvas, `${name} does not obscure the dungeon`).toBe(false);
  }
}

test('Play opens 3D in the same application without requesting the retired renderer', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const threeRequests: string[] = [];
  const phaserRequests: string[] = [];
  page.on('request', (request) => {
    if (/ThreeBridge|\/three(?:[./?_-]|$)/i.test(request.url())) threeRequests.push(request.url());
    if (/GameBridge|DungeonScene|\/phaser(?:[./?_-]|$)|\/assets\/game\//i.test(request.url()))
      phaserRequests.push(request.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('link', { name: 'Play without a wallet', exact: true }),
  ).toHaveAttribute('href', '/play');
  const play = page.getByRole('link', { name: 'Play without a wallet', exact: true });
  await expect(page.getByRole('link', { name: /Switch to 2D|Explore in 3D/ })).toHaveCount(0);
  expect(threeRequests).toEqual([]);
  expect(phaserRequests).toEqual([]);
  await page.evaluate(() => {
    (window as Window & { ruin3DSentinel?: string }).ruin3DSentinel = 'same-document';
  });
  await play.click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page).toHaveTitle('Play — Ruin Relay');
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
  await position(page, 0, 0);
  expect(threeRequests.length).toBeGreaterThan(0);
  expect(phaserRequests).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /attack|inventory|loot|fight/i })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('dungeon-3d-desktop.png') });

  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Play without a wallet', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(phaserRequests).toEqual([]);
  expect(
    await page.evaluate(() => (window as Window & { ruin3DSentinel?: string }).ruin3DSentinel),
  ).toBe('same-document');
});

test('relative movement records steps, turning is free and Home preserves the run', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open3D(page);
  await page.getByRole('application').focus();
  await page.keyboard.press('w');
  await position(page, 7, 1);
  // Both intents arrive before React can render the changed bearing.
  await page.getByRole('application').evaluate((host) => {
    for (const key of ['q', 'w'])
      host.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  await position(page, 8, 2);
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing East\./);
  await page.keyboard.press('e');
  await position(page, 8, 2);
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing South\./);
  await page.keyboard.press('a');
  await position(page, 9, 3);
  await page.keyboard.press('d');
  await position(page, 8, 4);
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing South\./);
  await page.keyboard.press('s');
  await position(page, 8, 4); // North is the wall at tile 1.
  await page.keyboard.press('q');
  await page.keyboard.press('s');
  await position(page, 7, 5);

  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page).toHaveTitle('Play — Ruin Relay');
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toBeFocused();
  await position(page, 7, 5);
  // A reopened view begins facing South; the frozen run stays at its last tile.
  await page.keyboard.press('a');
  await position(page, 8, 6);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const guide = page.getByRole('region', { name: '3D movement guide' });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('relative to the direction you face');
  await expect(guide).toContainText('Turning uses no steps');
  await expect(guide).toContainText('sidestep left and right without turning');
  await page.keyboard.press('w');
  await expect(page.locator('.steps')).toHaveText('Steps 6 / 96');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Game menu', exact: true })).toBeFocused();
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
  await position(page, 8, 6);
});

test.describe('animated 3D view', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 640, height: 480 } });
  test('ordinary motion accepts turns, movement and restart', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await open3D(page);
    await page.getByRole('application').focus();
    await page.keyboard.press('w');
    await position(page, 7, 1);
    await page.keyboard.press('q');
    await page.keyboard.press('w');
    await position(page, 8, 2);
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing East\./);
    await page.screenshot({ path: testInfo.outputPath('dungeon-3d-animated.png') });
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await position(page, 0, 0);
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing South\./);
  });
});

test('an unavailable WebGL 2 view can retry or return Home without losing the run', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const state = window as Window & { blockDungeonWebGL?: boolean };
    state.blockDungeonWebGL = true;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === 'webgl2' && state.blockDungeonWebGL) return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof original;
  });
  await page.goto('/play');
  await expect(page.getByRole('alert')).toContainText('This 3D view needs WebGL 2');
  await expect(page.locator('canvas')).toHaveCount(0);
  await position(page, 0, 0);
  for (const name of movementControls)
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Switch to 2D', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { blockDungeonWebGL?: boolean }).blockDungeonWebGL = false;
  });
  await page.getByRole('button', { name: 'Retry 3D dungeon view', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await position(page, 7, 1);
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => {
    (window as Window & { blockDungeonWebGL?: boolean }).blockDungeonWebGL = true;
  });
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This 3D view needs WebGL 2');
  await position(page, 7, 1);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => {
    (window as Window & { blockDungeonWebGL?: boolean }).blockDungeonWebGL = false;
  });
  await page.getByRole('button', { name: 'Retry 3D dungeon view', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
  await position(page, 7, 1);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('alert')).not.toBeVisible();
  await page.getByRole('button', { name: 'Turn left', exact: true }).click();
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await position(page, 8, 2);
});

test('context loss retries keep the run and bearing without retaining old canvases', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open3D(page);
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await page.getByRole('button', { name: 'Turn left', exact: true }).click();
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await position(page, 8, 2);
  for (let retry = 0; retry < 3; retry++) {
    await page
      .getByRole('application')
      .locator('canvas')
      .evaluate((canvas) => {
        canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      });
    await expect(page.getByRole('alert')).toContainText('The graphics connection was interrupted');
    await expect(page.getByRole('button', { name: 'Step forward', exact: true })).toBeDisabled();
    await page.getByRole('application').focus();
    await page.keyboard.press('w');
    await position(page, 8, 2);
    await page.getByRole('button', { name: 'Retry 3D dungeon view', exact: true }).click();
    await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing East\./);
    await expect(page.locator('canvas')).toHaveCount(1);
    await position(page, 8, 2);
  }
  await page.getByRole('application').focus();
  await page.keyboard.press('w');
  await position(page, 9, 3);
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('canvas')).toHaveCount(1);
  await position(page, 9, 3);
});

test('a 3D escape opens the same one-tile editor and preserves an unsigned preview through Home and Resume', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const wallet = await injectWallet(page);
  await open3D(page);
  await walk3D(page);
  await position(page, 48, 20);
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
  await expect(page.getByText('Dungeon Escaped!', { exact: true })).toBeVisible();
  for (const name of movementControls)
    await expect(
      page.getByRole('button', { name, exact: true, includeHidden: true }),
    ).toBeDisabled();
  const floor = await mapTilePoint(page, 31);
  await page.mouse.click(floor.x, floor.y);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Tile 31: Floor → Wall', { exact: true })).toBeVisible();
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  const wall = await mapTilePoint(page, 15);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.getByRole('button', { name: 'Tile 15:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Tile 15: Wall → Floor', { exact: true })).toBeVisible();
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  await page.getByRole('button', { name: 'Tile 8:' }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeDisabled();
  await expect(page.getByText('That edit blocks every route to the exit.')).toBeVisible();
  await prepare(page, 31);
  const preview = page.getByRole('region', { name: 'Transaction preview' });
  const unsigned = await preview.innerText();
  await page.screenshot({ path: testInfo.outputPath('dungeon-3d-editor.png') });
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await position(page, 48, 20);
  await expect(preview).toHaveText(unsigned, { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Sign and submit edit' })).toBeEnabled();
  await expect(page.locator('.transaction')).toHaveCount(0);
  expect(wallet.requests).toHaveLength(0);
});

test('dungeon artwork is readable from the corridor, relief and EXIT approaches', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await open3D(page);
  await page.getByRole('application').focus();
  await page.keyboard.press('q');
  await position(page, 0, 0);
  await page.screenshot({ path: testInfo.outputPath('dungeon-relief.png') });
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /Facing West\./);
  await page.screenshot({ path: testInfo.outputPath('dungeon-banner.png') });
  await page.keyboard.press('q');
  await page.keyboard.press('w');
  await page.keyboard.press('e');
  await position(page, 7, 1);
  await page.screenshot({ path: testInfo.outputPath('dungeon-sconce.png') });
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await page.keyboard.press('w');
  await position(page, 8, 2);
  await page.screenshot({ path: testInfo.outputPath('dungeon-vaulted-corridor.png') });
  await walk3D(page, fixture.revisions[0].path.slice(2, -1), 'R');
  await position(page, 47, 19);
  await page.screenshot({ path: testInfo.outputPath('dungeon-exit-approach.png') });
  await page.keyboard.press('w');
  await position(page, 48, 20);
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
});

for (const viewport of [
  { name: 'small-portrait', width: 320, height: 568 },
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
]) {
  test.describe(`3D mobile ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true });
    test('touch controls and the escaped editor fit without obscuring the dungeon', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await open3D(page);
      await fitsViewport(page);
      await page.getByRole('button', { name: 'Step forward', exact: true }).tap();
      await position(page, 7, 1);
      await page.getByRole('button', { name: 'Turn left', exact: true }).tap();
      await position(page, 7, 1);
      await page.getByRole('button', { name: 'Step forward', exact: true }).tap();
      await position(page, 8, 2);
      await page.screenshot({ path: testInfo.outputPath(`three-${viewport.name}-play.png`) });
      await walk3D(page, fixture.revisions[0].path.slice(2), 'R', true);
      await position(page, 48, 20);
      await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
      await page.getByRole('button', { name: 'Tile 31:' }).tap();
      await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
      const commit = page.getByRole('button', { name: 'Commit one change' });
      await commit.scrollIntoViewIfNeeded();
      await expect(commit).toBeInViewport();
      await expect(commit).toBeEnabled();
      await fitsViewport(page);
      await page.screenshot({ path: testInfo.outputPath(`three-${viewport.name}-editor.png`) });
    });
  });
}
