import Phaser from 'phaser';
import { editable, EXIT, preview, wallAt, type Direction } from '../lib/rules';
import { ATLAS, HERO, FX, ASSET_ROOT, createAnimations, criticalFrames } from './assets';
import { continuousRun, newSteps, type GameActions, type GameFrame } from './presentation';
import {
  cameraView,
  depth,
  footprint,
  facing,
  pickTile,
  project,
  TILE_SIZE,
  WORLD_SIZE,
  type Facing,
  type Point,
} from './projection';

const vectors = (points: Point[]) => points.map(({ x, y }) => new Phaser.Math.Vector2(x, y));

/** Presentation only. Relay owns every move, edit and transaction outcome. */
export class DungeonScene extends Phaser.Scene {
  private frame: GameFrame;
  private actions: GameActions;
  private initialized = false;
  private failed = false;
  private walls: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private decorations: { tile: number; image: Phaser.GameObjects.Image }[] = [];
  private masonry!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Graphics;
  private light!: Phaser.GameObjects.Graphics;
  private portal!: Phaser.GameObjects.Image;
  private rings!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private effect!: Phaser.GameObjects.Sprite;
  private hover?: number;
  private direction: Facing = 's';
  private queue: { tile: number; direction: Direction }[] = [];
  private tween?: Phaser.Tweens.Tween;
  private generation = 0;
  private seenContribution?: string;
  private drawnMasonry?: string;

  constructor(frame: GameFrame, actions: GameActions) {
    super('dungeon');
    this.frame = frame;
    this.actions = actions;
  }

  preload() {
    this.load.on('loaderror', () => {
      this.failed = true;
      this.actions.onError('Dungeon assets could not load. Check the connection and retry.');
    });
    this.load.atlas(ATLAS, `${ASSET_ROOT}environment.png`, `${ASSET_ROOT}environment.json`);
    this.load.atlas(HERO, `${ASSET_ROOT}adventurer.png`, `${ASSET_ROOT}adventurer.json`);
    const fxRoot = `${import.meta.env.BASE_URL}assets/game/v1/`;
    this.load.atlas(FX, `${fxRoot}dungeon.png`, `${fxRoot}dungeon.json`);
  }

  create() {
    if (
      this.failed ||
      criticalFrames().some(
        ({ texture, frame }) =>
          !this.textures.exists(texture) || !this.textures.get(texture).has(frame),
      )
    ) {
      this.actions.onError('The dungeon atlas is incomplete. Retry to reload the artwork.');
      return;
    }
    createAnimations(this);
    this.drawFoundation();
    this.masonry = this.add.graphics().setDepth(2);
    for (let tile = 0; tile < 49; tile++) {
      const p = project(tile);
      const variant = tile % 13 === 4 ? 3 : tile % 11 === 7 ? 4 : tile % 3 === 0 ? 2 : 1;
      this.add
        .image(p.x, p.y, ATLAS, `floor/stone-0${variant}`)
        .setDisplaySize(TILE_SIZE + 1, TILE_SIZE + 1)
        .setDepth(0)
        .setTint(0xb7c3bf);
      this.walls.push(
        this.add
          .image(p.x, p.y, ATLAS, `wall/stone-0${1 + ((tile * 3) % 4)}`)
          .setDisplaySize(TILE_SIZE + 1, TILE_SIZE + 1)
          .setDepth(depth(p.y, 2, tile)),
      );
      this.labels.push(
        this.add
          .text(p.x, p.y, String(tile).padStart(2, '0'), {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#e2e8da',
            backgroundColor: '#142320',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(15000),
      );
    }
    this.drawDecorations();
    const start = project(0),
      exit = project(EXIT);
    this.add.image(start.x, start.y, ATLAS, 'endpoint/start').setDisplaySize(82, 82).setDepth(3);
    this.portal = this.add
      .image(exit.x, exit.y, ATLAS, 'endpoint/exit')
      .setDisplaySize(92, 92)
      .setDepth(3);
    for (const [p, name, color] of [
      [start, 'START', '#b1d5bc'],
      [exit, 'EXIT', '#f3d493'],
    ] as const) {
      this.add
        .text(p.x, p.y + 37, name, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color,
          backgroundColor: '#101c1c',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(15000);
    }
    this.rings = this.add.graphics().setDepth(14000);
    this.ghost = this.add
      .image(0, 0, ATLAS, 'wall/stone-01')
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setVisible(false);
    this.effect = this.add
      .sprite(0, 0, FX, 'fx/build/00')
      .setOrigin(0.5, 64 / 96)
      .setScale(1.6)
      .setDepth(16000)
      .setVisible(false);
    this.effect.on('animationcomplete', () => this.effect.setVisible(false));
    this.light = this.add.graphics().setDepth(1);
    this.glow(this.light, TILE_SIZE * 1.9, 0xe9b775, 0.012);
    this.shadow = this.add.graphics().setDepth(4);
    this.shadow.fillStyle(0x060d10, 0.38).fillEllipse(0, 0, 40, 18);
    this.shadow.fillStyle(0x060d10, 0.2).fillEllipse(0, 1, 52, 24);
    this.player = this.add.sprite(0, 0, HERO, 'player/s/0');
    this.player.setScale((TILE_SIZE * 0.92) / this.player.width);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.point(pointer));
    this.input.on('gameout', () => this.clearHover());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tile = pickTile(this.cameras.main.getWorldPoint(pointer.x, pointer.y));
      if (pointer.leftButtonDown() && tile !== undefined && this.canSelect(tile))
        this.actions.onSelect(tile);
    });
    this.scale.on('resize', this.resized, this);
    this.events.once('shutdown', () => {
      this.generation++;
      this.scale.off('resize', this.resized, this);
      this.initialized = false;
    });
    this.initialized = true;
    this.snap();
    this.renderFrame();
    this.actions.onReady();
  }

  setFrame(frame: GameFrame) {
    const previous = this.frame;
    this.frame = frame;
    if (!this.initialized) return;
    if (previous.overview !== frame.overview) this.clearHover();
    const steps = newSteps(previous.run, frame.run);
    if (
      !continuousRun(previous.run, frame.run) ||
      (previous.run.path === frame.run.path && previous.run.position !== frame.run.position) ||
      (previous.run.path !== frame.run.path && steps.length === 0) ||
      frame.reducedMotion ||
      (frame.tile !== undefined && this.tween)
    ) {
      this.snap();
    } else if (steps.length) {
      this.queue.push(...steps);
      if (this.queue.length + (this.tween ? 1 : 0) > 4) this.snap();
      else this.nextStep();
    }
    this.renderFrame();
    if (previous.run.position !== EXIT && frame.run.position === EXIT) this.actions.onCue('escape');
  }

  resetMotion() {
    if (this.initialized) this.snap();
  }
  blocked() {
    if (!this.initialized || this.frame.reducedMotion) return;
    this.player.setTint(0xeac98b);
    const generation = this.generation;
    this.time.delayedCall(100, () => {
      if (generation === this.generation) this.player.clearTint();
    });
  }
  clearHover() {
    if (this.initialized) this.game.canvas.style.cursor = 'default';
    if (this.hover === undefined) return;
    this.hover = undefined;
    this.actions.onHover(undefined);
    if (this.initialized) this.drawOverlays();
  }
  private resized() {
    this.clearHover();
    this.fit();
  }
  private fit() {
    const view = cameraView(
      this.scale.width,
      this.scale.height,
      this.player ? { x: this.player.x, y: this.player.y } : project(this.frame.run.position),
      this.frame.overview,
    );
    this.cameras.main.setZoom(view.zoom).centerOn(view.x, view.y);
  }

  private glow(
    graphics: Phaser.GameObjects.Graphics,
    radius: number,
    color: number,
    alpha: number,
  ) {
    for (let step = 16; step > 0; step--)
      graphics.fillStyle(color, alpha).fillCircle(0, 0, (radius * step) / 16);
  }
  private drawFoundation() {
    const g = this.add.graphics().setDepth(-2);
    g.fillStyle(0x0a1115).fillRect(-1200, -1200, 2400, 2400);
    g.fillStyle(0x28302d).fillRoundedRect(
      -WORLD_SIZE / 2,
      -WORLD_SIZE / 2,
      WORLD_SIZE,
      WORLD_SIZE,
      18,
    );
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        if (x !== -1 && x !== 7 && y !== -1 && y !== 7) continue;
        this.add
          .image(
            (x - 3) * TILE_SIZE,
            (y - 3) * TILE_SIZE,
            ATLAS,
            `wall/stone-0${1 + (Math.abs(x + y) % 2)}`,
          )
          .setDisplaySize(TILE_SIZE + 2, TILE_SIZE + 2)
          .setTint(0x8d9c98)
          .setDepth(3);
      }
    for (const [x, y] of [
      [-384, -288],
      [-192, -384],
      [384, 192],
      [192, 384],
    ]) {
      const glow = this.add.graphics().setPosition(x, y).setDepth(5);
      this.glow(glow, 82, 0xffa644, 0.018);
      this.add.image(x, y, ATLAS, 'decor/brazier').setDisplaySize(56, 56).setDepth(6);
    }
    for (const [x, y] of [
      [-384, -384],
      [384, -384],
      [-384, 384],
      [384, 384],
    ])
      this.add
        .image(x, y - 10, ATLAS, 'decor/guardian')
        .setDisplaySize(100, 100)
        .setDepth(7);
  }

  private drawDecorations() {
    for (const [tile, key] of [
      [1, 'pillar'],
      [3, 'brazier'],
      [16, 'fern'],
      [21, 'guardian'],
      [28, 'urn'],
      [40, 'brazier'],
    ] as const) {
      const p = project(tile);
      const image = this.add
        .image(p.x + 22, p.y - 22, ATLAS, `decor/${key}`)
        .setDisplaySize(46, 46)
        .setDepth(depth(p.y, 3, tile));
      this.decorations.push({ tile, image });
    }
    for (const [tile, key] of [
      [14, 'bones'],
      [35, 'fern'],
      [6, 'fern'],
      [32, 'bones'],
    ] as const) {
      const p = project(tile);
      this.add
        .image(p.x - 30, p.y + 26, ATLAS, `decor/${key}`)
        .setDisplaySize(26, 26)
        .setDepth(1)
        .setAlpha(0.72);
    }
  }

  private drawMasonry() {
    const walls = this.frame.run.snapshot.walls;
    const key = `${walls}:${this.frame.tile ?? ''}`;
    if (key === this.drawnMasonry) return;
    this.drawnMasonry = key;
    const g = this.masonry.clear();
    for (let tile = 0; tile < 49; tile++) {
      if (!wallAt(walls, tile)) continue;
      const p = project(tile),
        r = TILE_SIZE / 2;
      g.fillStyle(0x283734, tile === this.frame.tile ? 0.2 : 1).fillRect(
        p.x - r,
        p.y - r,
        TILE_SIZE,
        TILE_SIZE,
      );
      // Exposed edges belong to the wall footprint; no false collision on a floor neighbor.
      const x = tile % 7,
        y = Math.floor(tile / 7);
      g.lineStyle(5, 0x0b1519, 0.55);
      if (x === 0 || !wallAt(walls, tile - 1)) g.lineBetween(p.x - r, p.y - r, p.x - r, p.y + r);
      if (x === 6 || !wallAt(walls, tile + 1)) g.lineBetween(p.x + r, p.y - r, p.x + r, p.y + r);
      if (y === 0 || !wallAt(walls, tile - 7)) g.lineBetween(p.x - r, p.y - r, p.x + r, p.y - r);
      if (y === 6 || !wallAt(walls, tile + 7)) g.lineBetween(p.x - r, p.y + r, p.x + r, p.y + r);
    }
  }
  private canSelect(tile: number) {
    return (
      !this.frame.locked &&
      this.frame.run.position === EXIT &&
      editable(this.frame.run.snapshot.editableMask, tile)
    );
  }
  private point(pointer: Phaser.Input.Pointer) {
    const tile = pickTile(this.cameras.main.getWorldPoint(pointer.x, pointer.y));
    if (tile === this.hover) return;
    this.hover = tile;
    this.actions.onHover(tile);
    this.drawOverlays();
    this.game.canvas.style.cursor =
      tile !== undefined && this.canSelect(tile) ? 'pointer' : 'default';
  }
  private snap() {
    this.generation++;
    this.tween?.stop();
    this.tween = undefined;
    this.queue = [];
    const last = this.frame.run.path.at(-1) as Direction | undefined;
    this.direction = last ? facing[last] : 's';
    const p = project(this.frame.run.position);
    this.player.setPosition(p.x, p.y).clearTint();
    this.idle();
    this.updatePosition();
  }
  private idle() {
    this.player.stop().setFrame(`player/${this.direction}/0`);
  }
  private nextStep() {
    if (this.tween) return;
    const step = this.queue.shift();
    if (!step) {
      this.idle();
      return;
    }
    this.direction = facing[step.direction];
    this.player.play(`walk-${this.direction}`, true);
    const p = project(step.tile),
      generation = this.generation;
    this.actions.onCue('step');
    this.tween = this.tweens.add({
      targets: this.player,
      x: p.x,
      y: p.y,
      duration: 120,
      ease: 'Linear',
      onUpdate: () => {
        if (generation === this.generation) this.updatePosition();
      },
      onComplete: () => {
        if (generation !== this.generation) return;
        this.tween = undefined;
        this.updatePosition();
        this.nextStep();
      },
    });
  }
  private updatePosition() {
    this.shadow.setPosition(this.player.x, this.player.y - 3);
    this.light.setPosition(this.player.x, this.player.y - 20);
    this.player.setDepth(depth(this.player.y, 4));
    this.fit();
  }
  private renderFrame() {
    this.drawMasonry();
    for (let tile = 0; tile < 49; tile++) {
      this.walls[tile]
        .setVisible(wallAt(this.frame.run.snapshot.walls, tile))
        .setAlpha(tile === this.frame.tile ? 0.25 : 1);
      this.labels[tile].setVisible(this.frame.showLabels);
    }
    for (const { tile, image } of this.decorations)
      image
        .setVisible(wallAt(this.frame.run.snapshot.walls, tile))
        .setAlpha(tile === this.frame.tile ? 0.25 : 1);
    this.portal.setTint(this.frame.run.position === EXIT ? 0xffebbb : 0xffffff);
    this.fit();
    this.drawOverlays();
    if (this.frame.reducedMotion) this.effect.stop().setVisible(false);
    const contribution = this.frame.contribution;
    if (!contribution) {
      this.seenContribution = undefined;
      this.effect.stop().setVisible(false);
      return;
    }
    const id = `${this.frame.run.snapshot.chainId}:${this.frame.run.snapshot.address.toLowerCase()}:${contribution.hash}:${contribution.logIndex}:${contribution.blockHash}`;
    if (id === this.seenContribution) return;
    this.seenContribution = id;
    this.actions.onCue('confirmed');
    if (!this.frame.reducedMotion) {
      const p = project(contribution.tileIndex);
      this.effect
        .setPosition(p.x, p.y)
        .setVisible(true)
        .play(contribution.becameWall ? 'build' : 'break');
    }
  }
  private drawOverlays() {
    this.rings.clear();
    this.ghost.setVisible(false);
    if (this.frame.run.position === EXIT && !this.frame.locked)
      for (let tile = 0; tile < 49; tile++) {
        if (editable(this.frame.run.snapshot.editableMask, tile))
          this.rings
            .lineStyle(1.5, 0xa7c6ad, 0.3)
            .strokePoints(vectors(footprint(project(tile), 5)), true);
      }
    if (this.hover !== undefined && this.frame.run.position === EXIT)
      this.rings
        .lineStyle(2, 0xe7ead7, 0.7)
        .strokePoints(vectors(footprint(project(this.hover), 4)), true);
    const tile = this.frame.tile;
    if (tile === undefined || !editable(this.frame.run.snapshot.editableMask, tile)) return;
    const p = project(tile),
      valid = preview(
        this.frame.run.snapshot.walls,
        this.frame.run.snapshot.editableMask,
        tile,
      ).solvable;
    const color = valid ? 0xf1cd8b : 0xee9a85;
    this.rings.fillStyle(color, 0.2).fillPoints(vectors(footprint(p, 4)), true);
    this.rings.lineStyle(3, color, 1).strokePoints(vectors(footprint(p, 4)), true);
    if (!wallAt(this.frame.run.snapshot.walls, tile))
      this.ghost
        .setPosition(p.x, p.y)
        .setDepth(depth(p.y, 3, tile))
        .setTint(color)
        .setAlpha(0.5)
        .setVisible(true);
  }
}
