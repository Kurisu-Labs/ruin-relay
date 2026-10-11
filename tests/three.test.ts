import { describe, expect, it } from 'vitest';
import {
  Box3,
  BufferGeometry,
  InstancedMesh,
  Material,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Texture,
  Vector3,
} from 'three';
import fixture from '../reference/fixtures.json';
import { editable, move, wallAt, type Direction } from '../src/lib/rules';
import { createWorld } from '../src/game3d/world';
import {
  CELL,
  headingAngle,
  keyIntent3D,
  tileAt,
  tilePosition,
  travelDirection,
  turn,
  type Heading,
} from '../src/game3d/spatial';

const walls = BigInt(fixture.initialWallsHex);

describe('first-person controls preserve canonical grid paths', () => {
  it('faces the initial open corridor and converts left turns and strafing correctly', () => {
    let heading: Heading = 2;
    let position = move(walls, 0, travelDirection(heading, 'forward'))!;
    expect(position).toBe(7);
    heading = turn(heading, -1);
    expect(position).toBe(7); // Turning never contributes a movement intent.
    position = move(walls, position, travelDirection(heading, 'forward'))!;
    expect(position).toBe(8);
    expect(move(walls, position, travelDirection(heading, 'left'))).toBeNull();
    expect(move(walls, position, travelDirection(heading, 'backward'))).toBe(7);
    expect(move(walls, position, travelDirection(heading, 'right'))).toBeNull();
  });

  it('walks both canonical revisions with relative forward movement and zero extra steps for turns', () => {
    const compass: Direction[] = ['U', 'R', 'D', 'L'];
    let mask = walls;
    for (const revision of fixture.revisions) {
      let heading: Heading = 2;
      let position = 0,
        recorded = '';
      for (const desired of revision.path) {
        while (compass[heading] !== desired) heading = turn(heading, 1);
        const direction = travelDirection(heading, 'forward');
        const next = move(mask, position, direction);
        expect(next).not.toBeNull();
        position = next!;
        recorded += direction;
      }
      expect(position).toBe(48);
      expect(recorded).toBe(revision.path);
      expect(recorded.length).toBe(revision.moveCount);
      mask ^= 1n << BigInt(revision.toggleTileIndex);
      expect(mask).toBe(BigInt(revision.afterWallsHex));
    }
  });

  it('points the Three camera in the same world direction as each forward move', () => {
    for (let heading = 0; heading < 4; heading++) {
      const h = heading as Heading;
      const direction = travelDirection(h, 'forward');
      const tile = move(0n, 24, direction)!;
      const target = tilePosition(tile);
      const look = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), headingAngle(h));
      expect(look.x).toBeCloseTo(target.x / CELL);
      expect(look.z).toBeCloseTo(target.z / CELL);
      expect(turn(turn(h, 1), -1)).toBe(h);
      expect(travelDirection(turn(turn(h, 1), 1), 'backward')).toBe(direction);
    }
  });

  it('ignores held keys, shortcuts and composition, and distinguishes turns from sidesteps', () => {
    const key = (value: string, extra = {}) => ({
      key: value,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      isComposing: false,
      ...extra,
    });
    expect(keyIntent3D(key('W'))).toBe('forward');
    expect(keyIntent3D(key('ArrowUp'))).toBe('forward');
    expect(keyIntent3D(key('s'))).toBe('backward');
    expect(keyIntent3D(key('ArrowDown'))).toBe('backward');
    expect(keyIntent3D(key('a'))).toBe('left');
    expect(keyIntent3D(key('ArrowLeft'))).toBe('left');
    expect(keyIntent3D(key('D'))).toBe('right');
    expect(keyIntent3D(key('ArrowRight'))).toBe('right');
    expect(keyIntent3D(key('Q'))).toBe('turnLeft');
    expect(keyIntent3D(key('e'))).toBe('turnRight');
    expect(keyIntent3D(key('r'))).toBe('restart');
    expect(keyIntent3D(key('Tab'))).toBeUndefined();
    for (const flag of ['repeat', 'ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
      expect(keyIntent3D(key('w', { [flag]: true }))).toBeUndefined();
      expect(keyIntent3D(key('r', { [flag]: true }))).toBeUndefined();
    }
  });
});

describe('overhead editing uses the same 49 canonical cells', () => {
  it('round trips interiors without selecting the surrounding architecture', () => {
    for (let tile = 0; tile < 49; tile++) {
      const p = tilePosition(tile);
      for (const [dx, dz] of [
        [0, 0],
        [-1.4, -1.4],
        [1.4, 1.4],
      ]) {
        expect(tileAt(p.x + dx, p.z + dz)).toBe(tile);
      }
    }
    for (const [x, z] of [
      [-11.201, 0],
      [11.2, 0],
      [0, -11.201],
      [0, 11.2],
      [NaN, 0],
      [0, Infinity],
    ]) {
      expect(tileAt(x, z)).toBeUndefined();
    }
  });
});

describe('procedural dungeon respects collision footprints and owns its resources', () => {
  it('keeps every wall inside its canonical cell, including newly previewed walls', () => {
    const world = createWorld(walls, BigInt(fixture.editableMaskHex));
    try {
      expect(world.walls.size).toBe(49);
      for (let tile = 0; tile < 49; tile++) {
        const group = world.walls.get(tile)!;
        expect(group.visible).toBe(wallAt(walls, tile));
        const bounds = new Box3().setFromObject(group);
        const position = tilePosition(tile);
        expect(bounds.min.x).toBeGreaterThanOrEqual(position.x - CELL / 2 - 1e-6);
        expect(bounds.max.x).toBeLessThanOrEqual(position.x + CELL / 2 + 1e-6);
        expect(bounds.min.z).toBeGreaterThanOrEqual(position.z - CELL / 2 - 1e-6);
        expect(bounds.max.z).toBeLessThanOrEqual(position.z + CELL / 2 + 1e-6);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
        if (editable(BigInt(fixture.editableMaskHex), tile)) {
          expect(group.getObjectByName('recessed-stone-relief')).toBeUndefined();
          expect(group.getObjectByName('weathered-wall-banner')).toBeUndefined();
        }
      }
      expect(world.walls.get(0)!.visible).toBe(false);
      expect(world.walls.get(48)!.visible).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it('opens the editor ceiling, caps point lights, freezes flicker and disposes shared resources once', () => {
    const world = createWorld(walls, BigInt(fixture.editableMaskHex));
    const geometries = new Set<BufferGeometry>(),
      materials = new Set<Material>(),
      textures = new Set<Texture>(),
      instances = new Set<InstancedMesh>();
    const lights: PointLight[] = [];
    world.root.traverse((object) => {
      if (object instanceof PointLight) lights.push(object);
      if (object instanceof Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
          if (material instanceof MeshStandardMaterial) {
            for (const texture of [material.map, material.bumpMap, material.roughnessMap]) {
              if (texture) textures.add(texture);
            }
          }
        }
      }
      if (object instanceof InstancedMesh) instances.add(object);
    });
    expect(lights.length).toBeLessThanOrEqual(6);
    expect(lights.length).toBeGreaterThan(0);
    expect(textures.size).toBe(2);
    expect(world.ceiling.visible).toBe(true);
    const dressing = world.root.getObjectByName('corridor-details')!;
    expect(dressing.visible).toBe(true);
    world.setOverview(true);
    expect(world.ceiling.visible).toBe(false);
    expect(dressing.visible).toBe(false);
    world.setOverview(false);
    expect(world.ceiling.visible).toBe(true);
    expect(dressing.visible).toBe(true);
    const camera = new Vector3(0, 1.62, 0);
    world.update(1, true, camera);
    const frozen = lights.map((light) => light.intensity);
    world.update(100, true, camera);
    expect(lights.map((light) => light.intensity)).toEqual(frozen);
    let disposed = 0;
    const resources = [...geometries, ...materials, ...instances, ...textures];
    const onDispose = () => {
      disposed++;
    };
    geometries.forEach((geometry) => geometry.addEventListener('dispose', onDispose));
    materials.forEach((material) => material.addEventListener('dispose', onDispose));
    instances.forEach((instance) => instance.addEventListener('dispose', onDispose));
    textures.forEach((texture) => texture.addEventListener('dispose', onDispose));
    world.dispose();
    world.dispose();
    expect(disposed).toBe(resources.length);
    expect(world.root.children).toHaveLength(0);
    expect(world.walls.size).toBe(0);
  });
});
