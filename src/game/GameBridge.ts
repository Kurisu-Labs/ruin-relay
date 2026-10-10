import Phaser from 'phaser';
import { DungeonScene } from './DungeonScene';
import type { GameActions, GameFrame } from './presentation';
import { VIEW_HEIGHT, VIEW_WIDTH } from './projection';

/** Owns one engine instance; no wallet, RPC, journal or mutable domain state. */
export class GameBridge {
  private game: Phaser.Game;
  private scene: DungeonScene;
  private destroyed = false;
  private canvas: HTMLCanvasElement;
  private resize: ResizeObserver;
  private lost: (event: Event) => void;
  private restored: () => void;

  constructor(host: HTMLDivElement, frame: GameFrame, actions: GameActions) {
    this.scene = new DungeonScene(frame, actions);
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!context || context.isContextLost()) throw new Error('WebGL unavailable');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.lost = (event) => {
      event.preventDefault();
      this.scene.resetMotion();
      actions.onError(
        'The graphics connection was interrupted. Retry the dungeon view to reconnect.',
      );
    };
    this.restored = () => actions.onError('Graphics are available again. Retry the dungeon view.');
    this.canvas.addEventListener('webglcontextlost', this.lost);
    this.canvas.addEventListener('webglcontextrestored', this.restored);
    this.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: host,
      canvas: this.canvas,
      width: host.clientWidth || VIEW_WIDTH,
      height: host.clientHeight || VIEW_HEIGHT,
      transparent: true,
      pixelArt: false,
      antialias: true,
      roundPixels: true,
      scene: this.scene,
      input: { keyboard: false },
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      banner: false,
      callbacks: {
        postBoot: () => {
          if (this.destroyed) this.canvas.remove();
        },
      },
    });
    this.resize = new ResizeObserver(() => {
      if (!this.destroyed && this.game.isBooted && host.clientWidth && host.clientHeight) {
        this.game.scale.resize(host.clientWidth, host.clientHeight);
      }
    });
    this.resize.observe(host);
  }
  setFrame(frame: GameFrame) {
    if (!this.destroyed) this.scene.setFrame(frame);
  }
  resetMotion() {
    if (!this.destroyed) this.scene.resetMotion();
  }
  blocked() {
    if (!this.destroyed) this.scene.blocked();
  }
  clearHover() {
    if (!this.destroyed) this.scene.clearHover();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resize.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.lost);
    this.canvas.removeEventListener('webglcontextrestored', this.restored);
    this.canvas.remove();
    this.game.destroy(true);
  }
}
