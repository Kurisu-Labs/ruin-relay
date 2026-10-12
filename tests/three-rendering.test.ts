import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Scene } from 'three';
import fixture from '../reference/fixtures.json';
import type { GameFrame } from '../src/game3d/presentation';
import { ThreeBridge } from '../src/game3d/ThreeBridge';
import { headingAngle, tilePosition } from '../src/game3d/spatial';

// Keep the real world, cameras and bridge. Replace only the unavailable GPU boundary.
const graphics = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('three', async (original) => {
  const actual = await original<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = Object.assign(new EventTarget(), {
        setAttribute: vi.fn(),
        remove: vi.fn(),
      });
      camera?: Camera;
      render = vi.fn((_scene: Scene, camera: Camera) => {
        this.camera = camera.clone();
      });
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      constructor() {
        graphics.instances.push(this);
      }
    },
  };
});

const initial: GameFrame = {
  run: {
    snapshot: {
      chainId: 421614,
      address: '0x0000000000000000000000000000000000000001',
      walls: BigInt(fixture.initialWallsHex),
      revision: 0n,
      editableMask: BigInt(fixture.editableMaskHex),
      blockNumber: 1n,
      blockHash: `0x${'ab'.repeat(32)}`,
    },
    path: '',
    position: 0,
  },
  locked: false,
  reducedMotion: true,
  showLabels: false,
  overview: false,
};

let frames: Map<number, FrameRequestCallback>;
let clock: number;
let resize: () => void;
let documentStub: EventTarget & { hidden: boolean };
let mounted: ThreeBridge[];

beforeEach(() => {
  frames = new Map();
  clock = 100;
  mounted = [];
  graphics.instances = [];
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  documentStub = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: () => ({ getContext: () => null }),
  });
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  for (const bridge of mounted) bridge.destroy();
  vi.unstubAllGlobals();
});

function advance() {
  clock += 50;
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(clock);
}

function mount(frame = initial) {
  const host = {
    clientWidth: 640,
    clientHeight: 480,
    append: vi.fn(),
    style: { cursor: '' },
    classList: { remove: vi.fn() },
  };
  const actions = {
    onReady: vi.fn(),
    onError: vi.fn(),
    onSelect: vi.fn(),
    onHover: vi.fn(),
    onCue: vi.fn(),
  };
  const bridge = new ThreeBridge(host as unknown as HTMLDivElement, frame, 2, actions);
  mounted.push(bridge);
  return { bridge, host, actions, renderer: graphics.instances.at(-1)! };
}

describe('3D rendering yields the browser when the scene is static', () => {
  it('stops in reduced motion and redraws the latest accepted move and turn once', () => {
    const { bridge, renderer, actions } = mount();
    advance();
    const count = renderer.render.mock.calls.length;
    advance();
    advance();
    expect(renderer.render).toHaveBeenCalledTimes(count);
    expect(frames.size).toBe(0);
    expect(actions.onReady).toHaveBeenCalledTimes(1);

    bridge.setHeading(1);
    bridge.setFrame({ ...initial, run: { ...initial.run, path: 'D', position: 7 } });
    expect(frames.size).toBe(1);
    advance();
    expect(renderer.render).toHaveBeenCalledTimes(count + 1);
    expect(renderer.camera.position.x).toBe(tilePosition(7).x);
    expect(renderer.camera.position.z).toBe(tilePosition(7).z);
    expect(renderer.camera.rotation.y).toBeCloseTo(headingAngle(1));
    expect(actions.onCue).toHaveBeenCalledWith('step');
    expect(frames.size).toBe(0);
  });

  it('stops on the EXIT map and redraws tile selection and a resized canvas', () => {
    const frame = {
      ...initial,
      reducedMotion: false,
      overview: true,
      run: { ...initial.run, path: fixture.revisions[0].path, position: 48 },
    };
    const { bridge, host, renderer } = mount(frame);
    advance();
    const count = renderer.render.mock.calls.length;
    advance();
    expect(renderer.render).toHaveBeenCalledTimes(count);
    expect(frames.size).toBe(0);

    bridge.setFrame({ ...frame, tile: 31 });
    advance();
    expect(renderer.render).toHaveBeenCalledTimes(count + 1);
    host.clientWidth = 800;
    resize();
    advance();
    expect(renderer.render).toHaveBeenCalledTimes(count + 2);
    expect(renderer.setSize).toHaveBeenLastCalledWith(800, 480);
    expect(frames.size).toBe(0);
  });

  it('animates ordinary movement and resumes safely after tab visibility changes', () => {
    const frame = { ...initial, reducedMotion: false };
    const { bridge, renderer } = mount(frame);
    advance();
    bridge.setFrame({ ...frame, run: { ...initial.run, path: 'D', position: 7 } });
    advance();
    expect(renderer.camera.position.z).toBeGreaterThan(tilePosition(0).z);
    expect(renderer.camera.position.z).toBeLessThan(tilePosition(7).z);
    for (let index = 0; index < 5; index++) advance();
    expect(renderer.camera.position.z).toBe(tilePosition(7).z);
    expect(frames.size).toBe(1);
    documentStub.hidden = true;
    documentStub.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    documentStub.hidden = false;
    documentStub.dispatchEvent(new Event('visibilitychange'));
    advance();
    expect(renderer.camera.position.z).toBe(tilePosition(7).z);
    expect(frames.size).toBe(1);
    bridge.destroy();
    expect(frames.size).toBe(0);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
