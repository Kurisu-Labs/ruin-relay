import * as THREE from 'three';
import { editable, EXIT, wallAt } from '../lib/rules';
import { continuousRun, newSteps, type GameActions, type GameFrame } from './presentation';
import {
  CELL,
  EYE_HEIGHT,
  headingAngle,
  tileAt,
  tilePosition,
  WALL_HEIGHT,
  WORLD_WIDTH,
  type Heading,
} from './spatial';
import { createWorld, type DungeonWorld } from './world';

interface Segment {
  from: THREE.Vector3;
  to: THREE.Vector3;
  elapsed: number;
}

/** Owns graphics and transient motion, never a Run, wallet, RPC or transaction. */
export class ThreeBridge {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.07, 65);
  private mapCamera = new THREE.OrthographicCamera(-15, 15, 15, -15, 0.1, 100);
  private world!: DungeonWorld;
  private frame: GameFrame;
  private heading: Heading;
  private targetAngle: number;
  private resize?: ResizeObserver;
  private raf = 0;
  private initialized = false;
  private destroyed = false;
  private failed = false;
  private lastTime = 0;
  private seconds = 0;
  private queue: THREE.Vector3[] = [];
  private segment?: Segment;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();
  private hover?: number;
  private overlays = new THREE.Group();
  private marks: THREE.Mesh[] = [];
  private markGeometry = new THREE.PlaneGeometry(CELL * 0.88, CELL * 0.88);
  private markMaterial = new THREE.MeshBasicMaterial({
    color: 0xb7ac70,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  private selectionMaterial = new THREE.MeshBasicMaterial({
    color: 0xf4cf82,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private hoverMaterial = new THREE.MeshBasicMaterial({
    color: 0xf5e6af,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  private confirmedMaterial = new THREE.MeshBasicMaterial({
    color: 0x74e5bd,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  private labels = new THREE.Group();
  private labelTexture?: THREE.CanvasTexture;
  private labelMaterials: THREE.SpriteMaterial[] = [];
  private contributionId?: string;

  constructor(
    private host: HTMLDivElement,
    frame: GameFrame,
    heading: Heading,
    private actions: GameActions,
  ) {
    this.frame = frame;
    this.heading = heading;
    this.targetAngle = headingAngle(heading);
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'low-power',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;
      this.scene.background = new THREE.Color(0x111719);
      this.scene.fog = new THREE.FogExp2(0x111719, 0.027);
      this.world = createWorld(frame.run.snapshot.walls, frame.run.snapshot.editableMask);
      this.scene.add(this.world.root, this.overlays, this.labels);
      this.camera.rotation.order = 'YXZ';
      this.mapCamera.position.set(0, 40, 0);
      this.mapCamera.up.set(0, 0, -1);
      this.mapCamera.lookAt(0, 0, 0);
      for (let tile = 0; tile < 49; tile++) {
        const mark = new THREE.Mesh(this.markGeometry, this.markMaterial);
        const position = tilePosition(tile);
        mark.position.set(position.x, 0.035, position.z);
        mark.rotation.x = -Math.PI / 2;
        mark.renderOrder = 2;
        this.overlays.add(mark);
        this.marks.push(mark);
      }
      this.createLabels();
      this.resetMotion();
      this.updatePresentation();
      const canvas = this.renderer.domElement;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.addEventListener('webglcontextlost', this.contextLost);
      canvas.addEventListener('webglcontextrestored', this.contextRestored);
      canvas.addEventListener('pointermove', this.pointerMove);
      canvas.addEventListener('pointerleave', this.clearHover);
      canvas.addEventListener('pointerup', this.pointerUp);
      this.host.append(canvas);
      this.resize = new ResizeObserver(this.fit);
      this.resize.observe(host);
      document.addEventListener('visibilitychange', this.visibility);
      this.fit();
      this.world.update(0, frame.reducedMotion, this.camera.position);
      this.render();
      this.initialized = true;
      this.actions.onReady();
      if (!frame.reducedMotion && !frame.overview) this.start();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  setFrame(next: GameFrame) {
    if (this.destroyed || this.failed) return;
    const previous = this.frame;
    const steps = newSteps(previous.run, next.run);
    const changedWorld =
      previous.run.snapshot.walls !== next.run.snapshot.walls ||
      previous.run.snapshot.editableMask !== next.run.snapshot.editableMask;
    this.frame = next;
    if (changedWorld) {
      this.scene.remove(this.world.root);
      this.world.dispose();
      this.world = createWorld(next.run.snapshot.walls, next.run.snapshot.editableMask);
      this.scene.add(this.world.root);
    }
    if (
      !continuousRun(previous.run, next.run) ||
      next.reducedMotion ||
      next.overview ||
      document.hidden
    ) {
      this.resetMotion();
    } else if (steps.length) {
      if (this.queue.length + steps.length + (this.segment ? 1 : 0) > 4) this.resetMotion();
      else
        for (const step of steps) {
          const position = tilePosition(step.tile);
          this.queue.push(new THREE.Vector3(position.x, EYE_HEIGHT, position.z));
        }
    }
    if (steps.length) this.actions.onCue(next.run.position === EXIT ? 'escape' : 'step');
    const contribution = next.contribution;
    const contributionId = contribution
      ? `${contribution.hash}:${contribution.blockHash}:${contribution.logIndex}`
      : undefined;
    if (contributionId && contributionId !== this.contributionId) this.actions.onCue('confirmed');
    this.contributionId = contributionId;
    this.updatePresentation();
  }

  setHeading(heading: Heading) {
    this.heading = heading;
    this.targetAngle = headingAngle(heading);
    if (this.frame.reducedMotion) this.camera.rotation.y = this.targetAngle;
    this.start();
  }

  resetMotion() {
    this.queue = [];
    this.segment = undefined;
    const position = tilePosition(this.frame.run.position);
    this.camera.position.set(position.x, EYE_HEIGHT, position.z);
    this.camera.rotation.set(0, headingAngle(this.heading), 0);
    this.targetAngle = headingAngle(this.heading);
    this.lastTime = 0;
    this.start();
  }

  blocked() {
    // Collision feedback stays outside camera position: no motion through canonical walls.
    if (this.frame.reducedMotion) return;
    this.host.classList.remove('is-blocked');
    void this.host.offsetWidth;
    this.host.classList.add('is-blocked');
  }

  clearHover = () => {
    if (this.hover === undefined) return;
    this.hover = undefined;
    this.host.style.cursor = '';
    this.actions.onHover(undefined);
    this.updatePresentation();
  };

  private updatePresentation() {
    const { run, overview, tile: selected, contribution, showLabels } = this.frame;
    this.world.setOverview(overview);
    this.scene.fog = overview ? null : new THREE.FogExp2(0x111719, 0.027);
    this.overlays.visible = overview;
    this.labels.visible = overview && showLabels;
    for (let tile = 0; tile < 49; tile++) {
      const canonicalWall = wallAt(run.snapshot.walls, tile);
      const draft = overview && selected === tile && editable(run.snapshot.editableMask, tile);
      const group = this.world.walls.get(tile);
      if (group) {
        group.visible = canonicalWall || draft;
        group.scale.y = draft && canonicalWall ? 0.035 : 1;
      }
      const mark = this.marks[tile];
      mark.visible = editable(run.snapshot.editableMask, tile);
      const visibleWall = canonicalWall ? !draft : draft;
      mark.position.y = visibleWall ? WALL_HEIGHT + 0.04 : 0.15;
      mark.material =
        contribution?.tileIndex === tile
          ? this.confirmedMaterial
          : draft
            ? this.selectionMaterial
            : this.hover === tile
              ? this.hoverMaterial
              : this.markMaterial;
    }
    this.start();
  }

  private createLabels() {
    // A tiny, original text atlas, allocated once rather than one texture per tile.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 30px monospace';
    for (let tile = 0; tile < 49; tile++) {
      const x = (tile % 8) * 64,
        y = Math.floor(tile / 8) * 64;
      context.fillStyle = '#101918e6';
      context.fillRect(x + 5, y + 12, 54, 40);
      context.fillStyle = '#f0e0b6';
      context.fillText(String(tile), x + 32, y + 34);
    }
    this.labelTexture = new THREE.CanvasTexture(canvas);
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    for (let tile = 0; tile < 49; tile++) {
      const texture = this.labelTexture.clone();
      texture.repeat.set(1 / 8, 1 / 8);
      texture.offset.set((tile % 8) / 8, 1 - (Math.floor(tile / 8) + 1) / 8);
      texture.needsUpdate = true;
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
      });
      this.labelMaterials.push(material);
      const label = new THREE.Sprite(material);
      const position = tilePosition(tile);
      label.position.set(position.x, WALL_HEIGHT + 0.2, position.z);
      label.scale.set(1, 1, 1);
      label.renderOrder = 3;
      this.labels.add(label);
    }
  }

  private picked(event: PointerEvent) {
    if (!this.frame.overview || this.frame.run.position !== EXIT || this.frame.locked) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.mapCamera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    return tileAt(this.hit.x, this.hit.z);
  }

  private pointerMove = (event: PointerEvent) => {
    const tile = this.picked(event);
    if (tile === this.hover) return;
    this.hover = tile;
    this.host.style.cursor =
      tile !== undefined && editable(this.frame.run.snapshot.editableMask, tile) ? 'pointer' : '';
    this.actions.onHover(tile);
    this.updatePresentation();
  };

  private pointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const tile = this.picked(event);
    if (tile !== undefined && editable(this.frame.run.snapshot.editableMask, tile))
      this.actions.onSelect(tile);
  };

  private fit = () => {
    if (this.destroyed || this.failed) return;
    const width = Math.max(this.host.clientWidth, 1),
      height = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(width, height);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Preserve a useful horizontal view on narrow phones without extreme fisheye.
    this.camera.fov = aspect < 0.8 ? 85 : 70;
    this.camera.updateProjectionMatrix();
    const span = WORLD_WIDTH * 0.54;
    this.mapCamera.left = -span * Math.max(1, aspect);
    this.mapCamera.right = -this.mapCamera.left;
    this.mapCamera.top = span * Math.max(1, 1 / aspect);
    this.mapCamera.bottom = -this.mapCamera.top;
    this.mapCamera.updateProjectionMatrix();
    this.mapCamera.updateMatrixWorld();
    this.start();
  };

  private render() {
    this.renderer.render(this.scene, this.frame.overview ? this.mapCamera : this.camera);
  }

  private start() {
    if (this.initialized && !this.raf && !this.destroyed && !this.failed && !document.hidden)
      this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.destroyed || this.failed || document.hidden) return;
    const elapsed = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    this.seconds += elapsed;
    if (!this.frame.overview && !this.frame.reducedMotion) {
      if (!this.segment && this.queue.length)
        this.segment = { from: this.camera.position.clone(), to: this.queue.shift()!, elapsed: 0 };
      if (this.segment) {
        this.segment.elapsed += elapsed;
        const progress = Math.min(this.segment.elapsed / 0.18, 1);
        this.camera.position.lerpVectors(
          this.segment.from,
          this.segment.to,
          progress * progress * (3 - 2 * progress),
        );
        if (progress === 1) this.segment = undefined;
      }
      const difference = Math.atan2(
        Math.sin(this.targetAngle - this.camera.rotation.y),
        Math.cos(this.targetAngle - this.camera.rotation.y),
      );
      this.camera.rotation.y += difference * Math.min(1, elapsed * 18);
    }
    try {
      this.world.update(this.seconds, this.frame.reducedMotion, this.camera.position);
      this.render();
    } catch {
      this.fail('The 3D view was interrupted. Retry to reopen the dungeon.');
    }
    // Static views redraw on input, selection, resize or visibility changes only.
    // Yielding here keeps browser controls responsive on software WebGL as well.
    if (!this.frame.reducedMotion && !this.frame.overview) this.start();
  };

  private visibility = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resetMotion();
    this.clearHover();
    this.start();
  };

  private fail(message: string) {
    if (this.destroyed || this.failed) return;
    this.failed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.actions.onError(message);
  }

  private contextLost = (event: Event) => {
    event.preventDefault();
    this.fail('The graphics connection was interrupted. Retry to reopen the dungeon.');
  };
  private contextRestored = () => {
    if (!this.destroyed)
      this.actions.onError('Graphics are available again. Retry the 3D dungeon view.');
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resize?.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    const canvas = this.renderer?.domElement;
    canvas?.removeEventListener('webglcontextlost', this.contextLost);
    canvas?.removeEventListener('webglcontextrestored', this.contextRestored);
    canvas?.removeEventListener('pointermove', this.pointerMove);
    canvas?.removeEventListener('pointerleave', this.clearHover);
    canvas?.removeEventListener('pointerup', this.pointerUp);
    this.world?.dispose();
    this.markGeometry.dispose();
    for (const material of [
      this.markMaterial,
      this.selectionMaterial,
      this.hoverMaterial,
      this.confirmedMaterial,
    ])
      material.dispose();
    for (const material of this.labelMaterials) {
      material.map?.dispose();
      material.dispose();
    }
    this.labelTexture?.dispose();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    canvas?.remove();
    this.host.style.cursor = '';
    this.host.classList.remove('is-blocked');
  }
}
