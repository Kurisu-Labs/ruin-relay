import { test, expect, injectWallet, open, prepare, walk, movementControls } from './helpers';
import fixture from '../../reference/fixtures.json' with { type: 'json' };
import type { Page } from '@playwright/test';

// Continuous trace screencasts stall software WebGL. Keep DOM/network tracing
// and the explicit screenshots that verify each finished view.
test.use({
  trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
});

const engineRequest = /(?:ThreeBridge|three)(?:[./?_-]|$)/i;

async function expectPosition(page: Page, tile: number, steps: number) {
  await expect(page.getByRole('application', { includeHidden: true })).toHaveAttribute(
    'aria-label',
    new RegExp(`Player at tile ${tile}\\.`),
  );
  await expect(page.locator('.steps')).toHaveText(`Steps ${steps} / 96`);
}

function measureViewport(page: Page) {
  // One browser read avoids a separate protocol/layout round trip for every rectangle.
  return page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element || !element.getClientRects().length) return null;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const viewport = document.querySelector('.board-viewport');
    const nav = Array.from(
      viewport?.querySelectorAll<HTMLElement>(
        '.game-toolbar > a, .game-toolbar > button, .fullscreen-control > button, .board-settings > summary',
      ) ?? [],
      (element) => ({
        name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
        text: element.textContent ?? '',
        bounds: rect(element),
      }),
    );
    const directions = Array.from(
      viewport?.querySelectorAll<HTMLButtonElement>('.board-dpad button') ?? [],
      (element) => ({
        name: element.getAttribute('aria-label'),
        bounds: rect(element),
        disabled: element.disabled,
        svgCount: element.querySelectorAll('svg').length,
      }),
    );
    return {
      dimensions: {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      screen: rect(document.querySelector('.play-screen')),
      frame: rect(viewport),
      stage: rect(document.querySelector('.board-stage')),
      canvas: rect(document.querySelector('.board canvas')),
      dock: rect(document.querySelector('.board-controls')),
      movement: rect(viewport?.querySelector('[aria-label="Movement controls"]') ?? null),
      movementCount: viewport?.querySelectorAll('[aria-label="Movement controls"]').length ?? 0,
      overview:
        viewport?.querySelector('[role="application"]')?.getAttribute('data-view') === 'map',
      fullscreenEnabled: document.fullscreenEnabled,
      nav,
      directions,
      headerButtons: document.querySelectorAll('.play-header button, .play-header [role="button"]')
        .length,
      headerLinks: document.querySelectorAll('.play-header a[href], .play-header [role="link"]')
        .length,
      obsoleteCameraNote:
        document.body.textContent?.includes('Close view · camera follows you') ?? false,
    };
  });
}

async function expectViewportFit(page: Page) {
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
  const {
    dimensions,
    screen,
    frame,
    stage,
    canvas,
    dock,
    movement: controls,
    overview,
    movementCount,
    fullscreenEnabled,
    nav,
    directions,
    headerButtons,
    headerLinks,
    obsoleteCameraNote,
  } = measured!;
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  expect(screen).not.toBeNull();
  expect(screen!.x).toBeGreaterThanOrEqual(0);
  expect(screen!.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(screen!.height - dimensions.height)).toBeLessThanOrEqual(2);
  const hideDirections = overview && dimensions.width <= 850;
  expect(movementCount).toBe(1);
  expect(directions).toHaveLength(6);
  expect(frame).not.toBeNull();
  expect(stage).not.toBeNull();
  expect(canvas).not.toBeNull();
  expect(dock).not.toBeNull();
  if (hideDirections) {
    expect(controls).toBeNull();
    expect(stage!.height).toBeGreaterThanOrEqual(dimensions.width <= 380 ? 80 : 70);
  } else {
    expect(controls).not.toBeNull();
  }
  const gameAreas = [stage!, canvas!, dock!, ...(controls ? [controls] : [])];
  for (const bounds of [frame!, ...gameAreas]) {
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(dimensions.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(dimensions.height + 1);
  }
  // Both the actual camera stage and the bottom dock belong to the game frame.
  for (const bounds of gameAreas) {
    expect(bounds.x).toBeGreaterThanOrEqual(frame!.x - 1);
    expect(bounds.y).toBeGreaterThanOrEqual(frame!.y - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  }
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(dock!.y + 1);
  const home = nav.find((control) => control.name === 'Back to home');
  expect(home).toBeDefined();
  expect(home!.text).toContain('Home');
  for (const name of [
    'Back to home',
    'History',
    'Restart',
    'Play latest',
    'Refresh status',
    'Game menu',
  ])
    expect(
      nav.some((control) => control.name === name),
      `bottom toolbar includes ${name}`,
    ).toBe(true);
  if (fullscreenEnabled)
    expect(nav.some((control) => /^(Enter|Exit) fullscreen$/.test(control.name))).toBe(true);
  for (const { name, bounds } of nav) {
    expect(bounds, `${name} is visible`).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(0);
    expect(bounds!.height).toBeGreaterThan(0);
    expect(bounds!.x).toBeGreaterThanOrEqual(dock!.x - 1);
    expect(bounds!.y).toBeGreaterThanOrEqual(dock!.y - 1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(dock!.x + dock!.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(dock!.y + dock!.height + 1);
  }
  expect(headerButtons).toBe(0);
  expect(headerLinks).toBe(0);
  expect(obsoleteCameraNote).toBe(false);

  let buttonSize: number | undefined;
  for (const direction of movementControls) {
    const button = directions.find((control) => control.name === direction);
    expect(button, `direction ${direction} exists`).toBeDefined();
    const bounds = button!.bounds;
    if (hideDirections) {
      expect(bounds).toBeNull();
      expect(button!.disabled).toBe(true);
      continue;
    }
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(1);
    buttonSize ??= bounds!.width;
    expect(Math.abs(bounds!.width - buttonSize)).toBeLessThanOrEqual(1);
    expect(button!.svgCount).toBe(1);
  }
}

test('the lobby loads without a game engine or canvas and warms the game on Play intent', async ({
  page,
}) => {
  const engineRequests: string[] = [];
  page.on('request', (request) => {
    if (engineRequest.test(request.url())) engineRequests.push(request.url());
  });
  await page.goto('/');
  const play = page.getByRole('link', { name: 'Play without a wallet', exact: true });
  await expect(play).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter the dungeon', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(engineRequests).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('application')).toHaveCount(0);

  await Promise.all([
    page.waitForRequest((request) => engineRequest.test(request.url())),
    play.focus(),
  ]);
  await expect(page.locator('canvas')).toHaveCount(0);
  await play.click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.board canvas')).toHaveCount(1);
});

test('the former 3D route redirects in place and retains query and fragment', async ({ page }) => {
  const navigations: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigations.push(request.url());
  });
  await page.goto('/play/3d?source=shared#dungeon');
  await expect(page).toHaveURL(/\/play\?source=shared#dungeon$/);
  await expect(page).toHaveTitle('Play — Ruin Relay');
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Switch to [23]D/ })).toHaveCount(0);
  expect(navigations).toHaveLength(1);
});

test('Play, home, Back and Forward preserve a run within the same browser document', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as Window & { ruinNavigationSentinel?: string }).ruinNavigationSentinel = 'same-page';
  });
  const navigations: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigations.push(request.url());
  });
  await page.getByRole('link', { name: 'Play without a wallet', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await walk(page, 'DR');
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Resume your run', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expectPosition(page, 8, 2);
  await expect(page.locator('.board canvas')).toHaveCount(1);
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expectPosition(page, 8, 2);
  await expect(page.locator('.board canvas')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => (window as Window & { ruinNavigationSentinel?: string }).ruinNavigationSentinel,
    ),
  ).toBe('same-page');
  expect(navigations).toEqual([]);
});

test('mouse directions respect walls and bounds and can alternate with focused keyboard input', async ({
  page,
}, testInfo) => {
  await open(page);
  await expectViewportFit(page);
  await page.getByRole('button', { name: 'Step backward', exact: true }).click();
  await page.getByRole('button', { name: 'Sidestep left', exact: true }).click();
  await expectPosition(page, 0, 0);
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await expectPosition(page, 7, 1);
  await page.getByRole('button', { name: 'Sidestep left', exact: true }).click();
  await expectPosition(page, 8, 2);
  await page.getByRole('application').focus();
  await page.keyboard.press('a');
  await expectPosition(page, 9, 3);
  await page.getByRole('button', { name: 'Sidestep right', exact: true }).click();
  await expectPosition(page, 8, 4);
  // A direction key focused on another control must not become a second move.
  await page.keyboard.press('ArrowLeft');
  await expectPosition(page, 8, 4);
  await page.screenshot({ path: testInfo.outputPath('game-desktop.png') });
});

test('on-screen directions stop at EXIT while the one-tile editor stays usable', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await open(page);
  await walk(page, fixture.revisions[0].path, 'mouse');
  await expectPosition(page, 48, fixture.revisions[0].moveCount);
  await expect(page.getByText('Dungeon Escaped!', { exact: true })).toBeVisible();
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
  for (const name of movementControls)
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('game-desktop-editor.png') });
});

test('Home and Resume preserve both the selected edit and its unsigned transaction preview', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const wallet = await injectWallet(page);
  await open(page);
  await walk(page, fixture.revisions[0].path);
  await page.getByRole('button', { name: 'Tile 31:' }).click();
  const draft = await page.locator('.editor .mask').innerText();
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit one change' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expectPosition(page, 48, 20);
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.editor .mask')).toHaveText(draft, { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Commit one change' })).toBeEnabled();

  await prepare(page, 31);
  const preview = page.getByRole('region', { name: 'Transaction preview' });
  const unsignedPreview = await preview.innerText();
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await page.getByRole('link', { name: 'Resume your run', exact: true }).click();
  await expect(page.getByRole('application')).toHaveAttribute('aria-busy', 'false');
  await expectPosition(page, 48, 20);
  await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
  await expect(page.getByRole('button', { name: 'Tile 31:' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(preview).toHaveText(unsignedPreview, { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Sign and submit edit' })).toBeEnabled();
  await expect(page.locator('.transaction')).toHaveCount(0);
  expect(wallet.requests).toHaveLength(0);
});

test('native browser fullscreen expands the entire game and preserves the run on exit', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  test.skip(browserName !== 'chromium', 'Native browser fullscreen is checked in Chromium.');
  await open(page);
  test.skip(
    !(await page.evaluate(() => document.fullscreenEnabled)),
    'This browser does not expose native fullscreen.',
  );
  await walk(page, 'DR');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.fullscreenElement === document.querySelector('.play-screen')),
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expectPosition(page, 8, 2);
  await expectViewportFit(page);
  await expect(page.getByRole('button', { name: 'Game menu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expectPosition(page, 8, 2);
  await expect(page.locator('.board canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sidestep left', exact: true }).click();
  await expectPosition(page, 9, 3);
});

test('the movement limit disables the D-pad and Restart starts a new local attempt', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page);
  // Reach the boundary through real keyboard input; the final two steps use the D-pad.
  await page.getByRole('application').focus();
  for (let loop = 0; loop < 47; loop++) {
    await page.keyboard.press('w');
    await page.keyboard.press('s');
  }
  await expectPosition(page, 0, 94);
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await expectPosition(page, 7, 95);
  await page.getByRole('button', { name: 'Step backward', exact: true }).click();
  await expectPosition(page, 0, 96);
  for (const name of movementControls)
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expectPosition(page, 0, 0);
  await page.getByRole('button', { name: 'Step forward', exact: true }).click();
  await expectPosition(page, 7, 1);
});

test('the menu traps focus, blocks movement, closes with Escape and restores its trigger', async ({
  page,
}) => {
  await open(page);
  await walk(page, 'D');
  const menu = page.getByRole('button', { name: 'Game menu', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expectPosition(page, 7, 1);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await page.getByRole('application').focus();
  await page.keyboard.press('ArrowLeft');
  await expectPosition(page, 8, 2);

  const history = page.getByRole('link', { name: 'History', exact: true });
  await history.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Every change leaves a trace.' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to game', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(history).toBeFocused();
  await expectPosition(page, 8, 2);
});

for (const viewport of [
  { name: 'small portrait', width: 320, height: 568 },
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 800, height: 1000 },
]) {
  test.describe(`mobile ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true });
    test('fits the viewport through touch exploration and an editable escape', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await open(page);
      await expectViewportFit(page);
      await page.getByRole('button', { name: 'Step forward', exact: true }).tap();
      await expectPosition(page, 7, 1);
      await page.getByRole('button', { name: 'Sidestep left', exact: true }).tap();
      await expectPosition(page, 8, 2);
      await expectViewportFit(page);
      await page.screenshot({ path: testInfo.outputPath(`game-${viewport.name}.png`) });

      await walk(page, fixture.revisions[0].path.slice(2), 'touch');
      await expectPosition(page, 48, 20);
      await expect(page.getByRole('application')).toHaveAttribute('data-view', 'map');
      await expect(page.getByText('Dungeon Escaped!', { exact: true })).toBeVisible();
      for (const name of movementControls)
        await expect(
          page.getByRole('button', { name, exact: true, includeHidden: true }),
        ).toBeDisabled();
      await expectViewportFit(page);
      const tile = page.getByRole('button', { name: 'Tile 31:' });
      await tile.tap();
      await expect(tile).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('Your edit keeps an escape route open.')).toBeVisible();
      const commit = page.getByRole('button', { name: 'Commit one change' });
      await commit.scrollIntoViewIfNeeded();
      await expect(commit).toBeInViewport();
      await expect(commit).toBeEnabled();
      await expectViewportFit(page);
      await page.screenshot({ path: testInfo.outputPath(`game-${viewport.name}-editor.png`) });
      await page.getByRole('button', { name: 'Restart', exact: true }).tap();
      await expectPosition(page, 0, 0);
      await expect(page.getByRole('application')).toHaveAttribute('data-view', 'first-person');
      await expectViewportFit(page);
    });
  });
}
