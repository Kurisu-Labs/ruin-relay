import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from '../reference/fixtures.json';
import type { Relay } from '../src/lib/relay';

const harness = vi.hoisted(() => ({ relay: undefined as Relay | undefined, configured: false }));

vi.mock('../src/config/deployment', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/config/deployment')>();
  return {
    ...original,
    get configured() {
      return harness.configured;
    },
  };
});
vi.mock('../src/lib/relay', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/relay')>();
  return {
    ...original,
    Relay: class extends original.Relay {
      constructor() {
        super();
        harness.relay = this;
      }
    },
  };
});
vi.mock('../src/lib/wallet', () => ({
  wallet: vi.fn(),
  switchNetwork: vi.fn(),
  explain: (error: unknown) => String(error),
  rejected: () => false,
}));
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    // Supply the same store snapshot to React's server renderer; the production hook is unchanged.
    useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, snapshot: () => T) =>
      original.useSyncExternalStore(subscribe, snapshot, snapshot),
  };
});

import App from '../src/App';
import { wallet } from '../src/lib/wallet';

function renderCommit(initialPath = '/play') {
  const html = renderToStaticMarkup(createElement<{ initialPath?: string }>(App, { initialPath }));
  const button = html.match(/<button\b[^>]*>Commit one change<\/button>/)?.[0];
  return { html, button };
}

function connectedDungeon() {
  harness.configured = true;
  vi.stubGlobal('navigator', { locks: { request: vi.fn() } });
  const relay = harness.relay!;
  relay.state = { ...relay.state, live: relay.state.run!.snapshot, online: true };
  return relay;
}

beforeEach(async () => {
  harness.configured = false;
  vi.clearAllMocks();
  vi.mocked(wallet).mockReset();
  harness.relay!.state = {
    online: false,
    busy: false,
    error: '',
    attempts: [],
    history: [],
    historyError: false,
    storageWarning: '',
  };
  await harness.relay!.start();
  for (const direction of fixture.revisions[0].path)
    harness.relay!.move(direction as 'U' | 'R' | 'D' | 'L');
  harness.relay!.select(31);
});
afterEach(() => vi.unstubAllGlobals());

it('shows a resumable lobby by default and keeps the editor on the dedicated play route', () => {
  const run = harness.relay!.state.run;
  const lobby = renderToStaticMarkup(createElement(App));
  expect(lobby).toContain('Resume your run');
  expect(lobby).toContain('href="/play"');
  expect(lobby).not.toContain('Explore in 3D');
  expect(lobby).not.toContain('href="/play/3d"');
  expect(lobby).not.toContain('role="application"');
  expect(lobby).not.toContain('Commit one change');
  expect(renderCommit().button).toBeDefined();
  expect(harness.relay!.state.run).toBe(run);
  expect(harness.relay!.state.tile).toBe(31);
});

it('uses the same 3D run, selected edit and commit gates on both supported URLs', () => {
  const relay = connectedDungeon();
  const run = relay.state.run;
  const canonical = renderCommit();
  const threeD = renderCommit('/play/3d');
  expect(threeD.html).toContain('3D dungeon. Player at tile 48.');
  expect(threeD.html).toContain('data-view="map"');
  expect(threeD.html).not.toContain('Switch to 2D');
  expect(canonical.html).toContain('3D dungeon. Player at tile 48.');
  expect(threeD.html).toContain('Tile 31:');
  expect(threeD.button).toBe(canonical.button);
  expect(threeD.button).not.toContain('disabled');
  expect(relay.state.run).toBe(run);
  expect(relay.state.tile).toBe(31);
  expect(wallet).not.toHaveBeenCalled();
});

it('explains why a valid wall preview cannot be committed in practice, without asking for a wallet', async () => {
  const { html, button } = renderCommit();
  expect(button).toContain('disabled=""');
  expect(button).toContain('aria-describedby="commit-help"');
  expect(html).toContain(
    'This is a practice dungeon. You can preview one edit, but saving it needs a connected dungeon.',
  );
  await harness.relay!.prepare();
  expect(wallet).not.toHaveBeenCalled();
  expect(harness.relay!.state.run!.snapshot.walls).toBe(BigInt(fixture.initialWallsHex));
});

it('enables a valid connected edit before wallet connection and requests the wallet only on prepare', async () => {
  const relay = connectedDungeon();
  const { html, button } = renderCommit();
  expect(button).not.toContain('disabled');
  expect(html).toContain('Ready to review. Commit one change connects your wallet');
  expect(html).toContain('Preview only · your change has not been saved.');
  expect(wallet).not.toHaveBeenCalled();
  vi.mocked(wallet).mockRejectedValueOnce(new Error('Wallet not connected'));
  await relay.prepare();
  expect(wallet).toHaveBeenCalledTimes(1);
  expect(relay.state.run!.snapshot.walls).toBe(BigInt(fixture.initialWallsHex));
  expect(relay.state.tile).toBe(31);
});

it('explains that an own confirmed edit is saved and needs a new escape for another change', () => {
  const relay = connectedDungeon();
  const run = relay.state.run!;
  const walls = run.snapshot.walls ^ (1n << 31n);
  const account = '0x0000000000000000000000000000000000000001' as const;
  const hash = `0x${'ab'.repeat(32)}` as const;
  relay.state = {
    ...relay.state,
    live: { ...run.snapshot, revision: 1n, walls },
    attempts: [
      {
        id: 'confirmed-editor-change',
        run,
        tile: 31,
        account,
        calldata: '0x',
        expectedWalls: walls,
        state: 'confirmed',
        hashes: [hash],
        observed: [],
        mutation: {
          revision: 1n,
          editor: account,
          tileIndex: 31,
          becameWall: true,
          wallMask: walls,
          hash,
          blockNumber: 1n,
          blockHash: hash,
          logIndex: 0,
        },
      },
    ],
  };
  const { html, button } = renderCommit();
  expect(button).toContain('disabled=""');
  expect(html).toContain(
    'Your edit is saved in revision #1. Choose Play latest and escape again to make another change.',
  );
  expect(html).not.toContain('Someone changed the dungeon first');
  expect(wallet).not.toHaveBeenCalled();
});

it.each([
  {
    condition: 'no selected tile',
    change: (relay: Relay) => relay.select(undefined),
    message: 'Choose a highlighted floor to add a wall, or a highlighted wall to remove it.',
  },
  {
    condition: 'a wall that blocks the only escape route',
    change: (relay: Relay) => relay.select(8),
    message: 'Choose a different tile. At least one route from START to EXIT must stay open.',
  },
  {
    condition: 'an unavailable live dungeon',
    change: (relay: Relay) => {
      relay.state = { ...relay.state, online: false };
    },
    message: 'The shared dungeon is unavailable. Choose Refresh status to reconnect before saving.',
  },
  {
    condition: 'a stale run',
    change: (relay: Relay) => {
      relay.state = { ...relay.state, live: { ...relay.state.live!, revision: 1n } };
    },
    message:
      'The dungeon changed during your run. Choose Play latest and escape the new revision to save an edit.',
  },
  {
    condition: 'an edit already being prepared',
    change: (relay: Relay) => {
      relay.state = { ...relay.state, busy: true };
    },
    message: 'An edit is being prepared or checked. Wait for its status before committing again.',
  },
  {
    condition: 'unavailable tab coordination',
    change: () => {
      vi.stubGlobal('navigator', { locks: undefined });
    },
    message: 'This browser cannot safely coordinate edits across tabs.',
  },
])('explains the disabled Commit button for $condition', ({ change, message }) => {
  const relay = connectedDungeon();
  change(relay);
  const { html, button } = renderCommit();
  expect(button).toContain('disabled=""');
  expect(button).toContain('aria-describedby="commit-help"');
  expect(html).toContain(message);
  expect(wallet).not.toHaveBeenCalled();
});

it('keeps the full map unavailable during play and opens it only for the escaped editor', () => {
  const relay = harness.relay!;
  relay.restart();
  expect(renderCommit().html).toContain('data-view="first-person"');
  expect(renderCommit().html).not.toContain('Full dungeon');
  for (const direction of fixture.revisions[0].path) relay.move(direction as 'U' | 'R' | 'D' | 'L');
  expect(renderCommit().html).toContain('data-view="map"');
  expect(renderCommit().html).not.toContain('Full dungeon');
  relay.restart();
  expect(renderCommit().html).toContain('data-view="first-person"');
});
