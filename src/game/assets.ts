import type Phaser from 'phaser';
import type { Facing } from './projection';

export const ATLAS = 'ruin-environment-v2';
export const HERO = 'ruin-adventurer-v2';
export const FX = 'ruin-dungeon-v1';
export const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/game/v2/`;
export const FACINGS: Facing[] = ['n', 'e', 's', 'w'];
export const ENVIRONMENT_FRAMES = [
  'floor/stone-01',
  'floor/stone-02',
  'floor/stone-03',
  'floor/stone-04',
  'wall/stone-01',
  'wall/stone-02',
  'wall/stone-03',
  'wall/stone-04',
  'decor/pillar',
  'decor/brazier',
  'decor/urn',
  'decor/bones',
  'endpoint/start',
  'endpoint/exit',
  'decor/guardian',
  'decor/fern',
];

export function createAnimations(scene: Phaser.Scene) {
  for (const direction of FACINGS) {
    const key = `walk-${direction}`;
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: [0, 1, 2, 3].map((i) => ({ key: HERO, frame: `player/${direction}/${i}` })),
        frameRate: 10,
        repeat: -1,
      });
  }
  for (const kind of ['build', 'break']) {
    if (!scene.anims.exists(kind))
      scene.anims.create({
        key: kind,
        frames: Array.from({ length: 8 }, (_, i) => ({
          key: FX,
          frame: `fx/${kind}/${String(i).padStart(2, '0')}`,
        })),
        frameRate: 18,
        repeat: 0,
      });
  }
}

export function criticalFrames() {
  return [
    ...ENVIRONMENT_FRAMES.map((frame) => ({ texture: ATLAS, frame })),
    ...FACINGS.flatMap((direction) =>
      [0, 1, 2, 3].map((i) => ({ texture: HERO, frame: `player/${direction}/${i}` })),
    ),
    ...['build', 'break'].flatMap((kind) =>
      Array.from({ length: 8 }, (_, i) => ({
        texture: FX,
        frame: `fx/${kind}/${String(i).padStart(2, '0')}`,
      })),
    ),
  ];
}
