import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Mesh, PointLight, type Object3D } from 'three';
import fixture from '../reference/fixtures.json';
import { createWorld } from '../src/game3d/world';
import { isSolvable } from '../src/lib/rules';

const seedWalls = BigInt(fixture.initialWallsHex);
const editableMask = BigInt(fixture.editableMaskHex);
const ornamentNames = ['iron-torch-sconce', 'weathered-wall-banner', 'recessed-stone-relief'];

function placement(walls: bigint) {
  const world = createWorld(walls, editableMask);
  try {
    const positions: { name: string; matrix: number[] }[] = [];
    world.root.traverseVisible((object) => {
      if (ornamentNames.includes(object.name))
        positions.push({ name: object.name, matrix: object.matrixWorld.toArray() });
    });
    return positions;
  } finally {
    world.dispose();
  }
}

describe('dungeon ornament spacing', () => {
  it('leaves a visible gap between torch sconces and featured wall decorations', () => {
    const world = createWorld(seedWalls, editableMask);
    try {
      const ornaments: Object3D[] = [];
      world.root.traverseVisible((object) => {
        if (['weathered-wall-banner', 'recessed-stone-relief'].includes(object.name))
          ornaments.push(object);
      });
      const torches = world.root.getObjectByName('overhead-iron-sconces')!.children;
      expect(torches.length).toBeGreaterThan(0);
      expect(ornaments.length).toBeGreaterThan(0);
      const crowded: string[] = [];
      for (const torch of torches) {
        // Include a modest visual gap, not just the absence of intersecting triangles.
        const clearance = new Box3().setFromObject(torch).expandByScalar(0.24);
        for (const ornament of ornaments) {
          if (clearance.intersectsBox(new Box3().setFromObject(ornament)))
            crowded.push(
              `${torch.position.toArray()} / ${ornament.parent!.name} / ${ornament.name}`,
            );
        }
      }
      expect(crowded).toEqual([]);
    } finally {
      world.dispose();
    }
  });

  it('keeps mounted ornaments in place through legal player edits and both fixture revisions', () => {
    const original = placement(seedWalls);
    expect(original.some((item) => item.name === 'iron-torch-sconce')).toBe(true);
    const revisions = new Set(fixture.revisions.map((revision) => BigInt(revision.afterWallsHex)));
    for (const tile of fixture.editableIndices) {
      const next = seedWalls ^ (1n << BigInt(tile));
      if (isSolvable(next)) revisions.add(next);
    }
    for (const revision of revisions) expect(placement(revision)).toEqual(original);
  });

  it('keeps the seed scene within its geometry and local-light budget', () => {
    const world = createWorld(seedWalls, editableMask);
    try {
      let triangles = 0,
        lights = 0;
      world.root.traverseVisible((object) => {
        if (object instanceof PointLight) lights++;
        if (object instanceof Mesh) {
          const count = object.geometry.index?.count ?? object.geometry.attributes.position.count;
          triangles += (count / 3) * (object instanceof InstancedMesh ? object.count : 1);
        }
      });
      // Regression budget with headroom: the previous scene submitted 253,284
      // triangles before frustum culling, largely hidden perimeter wall faces.
      expect(triangles).toBeLessThan(150_000);
      expect(lights).toBeLessThanOrEqual(5);
    } finally {
      world.dispose();
    }
  });
});
