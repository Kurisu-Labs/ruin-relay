import * as THREE from 'three';
import { BOARD_SIZE, editable, EXIT, wallAt } from '../lib/rules';
import { CELL, WALL_HEIGHT, WORLD_WIDTH, tilePosition } from './spatial';

export interface DungeonWorld {
  root: THREE.Group;
  ceiling: THREE.Group;
  /** All 49 cells exist; only canonical walls start visible. Children use local coordinates. */
  walls: Map<number, THREE.Group>;
  setOverview(overview: boolean): void;
  update(timeSeconds: number, reducedMotion: boolean, cameraPosition: THREE.Vector3): void;
  dispose(): void;
}

interface StoneTransform {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  turn?: number;
  roll?: number;
  shade?: number;
}

/** Stable art variation, unrelated to the canonical board or movement rules. */
function grain(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Small original, tileable stone maps: mineral grain, pores, fine fissures and damp moss. */
function stoneTextures() {
  const size = 256;
  const albedo = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(size * size * 4);
  const noiseLayer = (frequency: number, salt: number) => {
    const stride = frequency + 1;
    const lattice = new Float32Array(stride * stride);
    for (let y = 0; y <= frequency; y++)
      for (let x = 0; x <= frequency; x++) {
        let value =
          Math.imul((x % frequency) + salt, 374761393) ^
          Math.imul((y % frequency) + salt, 668265263);
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        lattice[y * stride + x] = ((value ^ (value >>> 16)) >>> 0) / 4294967295;
      }
    return (u: number, v: number) => {
      const x = u * frequency,
        y = v * frequency,
        left = Math.floor(x),
        top = Math.floor(y),
        fx = x - left,
        fy = y - top,
        sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy),
        offset = top * stride + left,
        a = lattice[offset] * (1 - sx) + lattice[offset + 1] * sx,
        b = lattice[offset + stride] * (1 - sx) + lattice[offset + stride + 1] * sx;
      return a * (1 - sy) + b * sy;
    };
  };
  const broadNoise = noiseLayer(4, 17),
    mineralNoise = noiseLayer(19, 41),
    fineNoise = noiseLayer(83, 97),
    poreNoise = noiseLayer(113, 131),
    mossNoise = noiseLayer(5, 211);
  const fissures = [
    [
      [0.08, 0.19],
      [0.21, 0.25],
      [0.27, 0.38],
      [0.37, 0.42],
      [0.46, 0.58],
      [0.52, 0.72],
    ],
    [
      [0.27, 0.38],
      [0.19, 0.48],
      [0.12, 0.54],
    ],
    [
      [0.66, 0.79],
      [0.72, 0.69],
      [0.86, 0.64],
      [0.91, 0.53],
    ],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        broad = broadNoise(u, v),
        mineral = mineralNoise(u, v),
        fine = fineNoise(u, v),
        pores = Math.max(0, poreNoise(u, v) - 0.66) * 3,
        moss = Math.max(0, mossNoise(u, v) - 0.58) * 1.2;
      let nearestCrack = 1;
      for (const stroke of fissures) {
        for (let index = 1; index < stroke.length; index++) {
          const [ax, ay] = stroke[index - 1],
            [bx, by] = stroke[index],
            dx = bx - ax,
            dy = by - ay,
            along = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy))),
            ex = u - ax - along * dx,
            ey = v - ay - along * dy;
          nearestCrack = Math.min(nearestCrack, ex * ex + ey * ey);
        }
      }
      const crack = Math.exp(-nearestCrack / 0.000012),
        tone =
          0.83 +
          (broad - 0.5) * 0.3 +
          (mineral - 0.5) * 0.18 +
          (fine - 0.5) * 0.15 -
          pores * 0.14 -
          crack * 0.38,
        offset = (y * size + x) * 4;
      albedo[offset] = (160 - moss * 30) * tone;
      albedo[offset + 1] = (165 + moss * 8) * tone;
      albedo[offset + 2] = (158 - moss * 22) * tone;
      albedo[offset + 3] = 255;
      // BumpMap reads red; roughnessMap reads green, sharing one surface texture.
      relief[offset] =
        137 +
        (broad - 0.5) * 36 +
        (mineral - 0.5) * 35 +
        (fine - 0.5) * 24 -
        pores * 48 -
        crack * 63;
      relief[offset + 1] = 220 + mineral * 28 + moss * 8;
      relief[offset + 2] = 255;
      relief[offset + 3] = 255;
    }
  }
  const color = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  color.name = 'original-procedural-stone-albedo';
  color.colorSpace = THREE.SRGBColorSpace;
  const surface = new THREE.DataTexture(relief, size, size, THREE.RGBAFormat);
  surface.name = 'original-procedural-stone-relief';
  for (const texture of [color, surface]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }
  return { color, surface };
}

/** One real beveled block, shared by every stone instance. */
function stoneGeometry() {
  const outline = new THREE.Shape();
  outline.moveTo(-0.42, -0.46);
  outline.lineTo(0.42, -0.46);
  outline.lineTo(0.46, -0.42);
  outline.lineTo(0.46, 0.42);
  outline.lineTo(0.42, 0.46);
  outline.lineTo(-0.42, 0.46);
  outline.lineTo(-0.46, 0.42);
  outline.lineTo(-0.46, -0.42);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: 0.88,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.04,
    bevelThickness: 0.06,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -0.44);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index),
      y = positions.getY(index),
      z = positions.getZ(index);
    // Equal source vertices receive equal offsets: seams stay closed and bounded.
    const erosion = 0.004 + grain(x * 73 + y * 31 + z * 97) * 0.015;
    positions.setXYZ(index, x * (1 - erosion), y * (1 - erosion), z * (1 - erosion));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Torn silhouette and folded cloth, with weathering painted into vertex colours. */
function bannerGeometry(seed: number) {
  const columns = 12,
    rows = 20;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rust = new THREE.Color(seed % 2 ? 0x704439 : 0x686550);
  const faded = new THREE.Color(0xa3916a);
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns,
        v = row / rows,
        hem = 0.08 + grain(column * 13 + seed) * 0.15,
        x = (u - 0.5) * 0.78,
        y = -v * (1.48 - hem),
        fold = Math.sin(u * Math.PI * 6 + v * 0.8) * 0.024 * (0.25 + v);
      positions.push(x, y, fold);
      const border = u < 0.1 || u > 0.9 || (v > 0.09 && v < 0.15);
      const diamond = Math.abs(u - 0.5) * 1.7 + Math.abs(v - 0.43);
      const crest = diamond > 0.22 && diamond < 0.29;
      const color = rust
        .clone()
        .lerp(faded, border || crest ? 0.76 : grain(row * 37 + column + seed) * 0.32);
      color.multiplyScalar(0.78 + grain(column * 11 + row + seed) * 0.24);
      colors.push(color.r, color.g, color.b);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column,
          b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A curved flame profile instead of a rigid cone; shared by every sconce. */
function torchFlameGeometry() {
  const profile = [
    [0, 0],
    [0.07, 0.025],
    [0.105, 0.12],
    [0.075, 0.24],
    [0.042, 0.36],
    [0, 0.54],
  ];
  const geometry = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    9,
  );
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    positions.setX(index, positions.getX(index) + Math.sin(y * 7) * y * 0.13);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function archStoneGeometry() {
  const half = Math.PI / 18 - 0.006;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1.65, -half, half, false);
  shape.absarc(0, 0, 1.39, half, -half, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    steps: 1,
    curveSegments: 2,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.15);
  return geometry;
}

/** A presentation-only model. Relay remains the authority for walls, movement and mutations. */
export function createWorld(wallMask: bigint, editableMask: bigint): DungeonWorld {
  const root = new THREE.Group();
  root.name = 'ruin-relay-procedural-dungeon';
  const ceiling = new THREE.Group();
  ceiling.name = 'removable-stone-ceiling';
  root.add(ceiling);
  const dressing = new THREE.Group();
  dressing.name = 'corridor-details';
  root.add(dressing);
  const walls = new Map<number, THREE.Group>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <T extends THREE.Material>(material: T): T => {
    materials.add(material);
    return material;
  };
  const stone = ownGeometry(stoneGeometry());
  const cube = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const shaft = ownGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  const mossShape = ownGeometry(new THREE.IcosahedronGeometry(1, 0));
  const archStone = ownGeometry(archStoneGeometry());
  const stoneMaps = stoneTextures();
  textures.add(stoneMaps.color);
  textures.add(stoneMaps.surface);
  const stoneMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xc9c2b5,
      map: stoneMaps.color,
      bumpMap: stoneMaps.surface,
      bumpScale: 0.095,
      roughnessMap: stoneMaps.surface,
      roughness: 0.93,
      metalness: 0.025,
      flatShading: true,
    }),
  );
  const mortarMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ color: 0x252d2b, roughness: 1 }),
  );
  const floorMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xa7aaa1,
      map: stoneMaps.color,
      bumpMap: stoneMaps.surface,
      bumpScale: 0.045,
      roughnessMap: stoneMaps.surface,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
    }),
  );
  const ceilingMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xc4cdc6,
      map: stoneMaps.color,
      bumpMap: stoneMaps.surface,
      bumpScale: 0.035,
      roughnessMap: stoneMaps.surface,
      roughness: 1,
      flatShading: true,
    }),
  );
  const ironMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x393933,
      roughness: 0.67,
      metalness: 0.7,
    }),
  );
  const mossMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x405542,
      roughness: 1,
      flatShading: true,
    }),
  );
  const runeMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({ color: 0x66e7d0, toneMapped: false }),
  );
  const startMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xd1af66,
      emissive: 0x665021,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.45,
    }),
  );
  const trimMaterial = ownMaterial(stoneMaterial.clone());
  trimMaterial.color.set(0xd4c7ad);
  trimMaterial.bumpScale = 0.055;
  const bronzeMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ color: 0x76634b, roughness: 0.74, metalness: 0.62 }),
  );
  const barkMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ color: 0x4c4031, roughness: 1 }),
  );
  const clothMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  );
  const matrix = new THREE.Object3D();
  const tint = new THREE.Color();
  const batch = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    name: string,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.receiveShadow = true;
    parent.add(mesh);
    instances.add(mesh);
    return mesh;
  };
  const put = (mesh: THREE.InstancedMesh, index: number, transform: StoneTransform) => {
    matrix.position.set(transform.x, transform.y, transform.z);
    matrix.rotation.set(0, transform.turn ?? 0, transform.roll ?? 0);
    matrix.scale.set(transform.width, transform.height, transform.depth);
    matrix.updateMatrix();
    mesh.setMatrixAt(index, matrix.matrix);
    const shade = transform.shade ?? 1;
    tint.setRGB(shade, shade * 0.99, shade * 0.98);
    mesh.setColorAt(index, tint);
  };
  const finish = (mesh: THREE.InstancedMesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  };
  const box = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Small mortar gaps and chamfers make the ground read as laid stone at eye level.
  box(root, mortarMaterial, 0, -0.18, 0, WORLD_WIDTH, 0.28, WORLD_WIDTH);
  const slabs = batch(root, stone, floorMaterial, 9 * 9 * 4, 'instanced-floor-slabs');
  const roof = batch(ceiling, stone, ceilingMaterial, 9 * 9, 'instanced-ceiling-slabs');
  let slabIndex = 0,
    roofIndex = 0;
  for (let row = -1; row <= BOARD_SIZE; row++) {
    for (let column = -1; column <= BOARD_SIZE; column++) {
      const x = (column - 3) * CELL,
        z = (row - 3) * CELL;
      for (let part = 0; part < 4; part++) {
        put(slabs, slabIndex, {
          x: x + (((part % 2) - 0.5) * CELL) / 2,
          y: -0.025,
          z: z + ((Math.floor(part / 2) - 0.5) * CELL) / 2,
          width: CELL / 2 - 0.025,
          height: 0.1,
          depth: CELL / 2 - 0.025,
          turn: ((part % 2) * Math.PI) / 2,
          shade: 0.58 + grain(slabIndex + 19) * 0.26,
        });
        slabIndex++;
      }
      put(roof, roofIndex, {
        x,
        y: WALL_HEIGHT + 0.09,
        z,
        width: CELL - 0.025,
        height: 0.18,
        depth: CELL - 0.025,
        shade: 0.6 + grain(roofIndex + 191) * 0.25,
      });
      roofIndex++;
    }
  }
  finish(slabs);
  finish(roof);

  const wallSides = [
    { x: 0, z: 1 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
  ];
  const fixedWall = (column: number, row: number) =>
    column < 0 ||
    row < 0 ||
    column >= BOARD_SIZE ||
    row >= BOARD_SIZE ||
    (wallAt(wallMask, row * BOARD_SIZE + column) &&
      !editable(editableMask, row * BOARD_SIZE + column));
  const fixedFloor = (tile: number) => !wallAt(wallMask, tile) && !editable(editableMask, tile);
  const faceKey = (seed: number, side: number) => `${seed}:${side}`;
  // Reserve a whole wall face for each featured ornament. Mounts and adjacent
  // floors must be permanent, so player edits cannot relocate or bury fixtures.
  const reservedFaces = new Set<string>();
  const torchCandidates: {
    floor: number;
    seed: number;
    side: number;
    x: number;
    z: number;
    angle: number;
  }[] = [];
  for (let tile = 0; tile < BOARD_SIZE * BOARD_SIZE; tile++) {
    if (!fixedFloor(tile) || tile === EXIT) continue;
    const position = tilePosition(tile);
    wallSides.forEach((normal, side) => {
      const column = (tile % BOARD_SIZE) + normal.x,
        row = Math.floor(tile / BOARD_SIZE) + normal.z;
      if (!fixedWall(column, row)) return;
      const perimeter = column < 0 || row < 0 || column >= BOARD_SIZE || row >= BOARD_SIZE;
      torchCandidates.push({
        floor: tile,
        seed: perimeter ? 100 + (row + 1) * 9 + column + 1 : row * BOARD_SIZE + column,
        side: (side + 2) % 4,
        x: position.x + normal.x * (CELL / 2 - 0.18),
        z: position.z + normal.z * (CELL / 2 - 0.18),
        angle: Math.atan2(-normal.x, -normal.z),
      });
    });
  }
  const torchMounts: (typeof torchCandidates)[number][] = [];
  const litFloors = new Set<number>();
  for (const target of [7, 13, 45]) {
    const position = tilePosition(target);
    let nearest = Infinity,
      chosen: (typeof torchCandidates)[number] | undefined;
    for (const candidate of torchCandidates) {
      if (litFloors.has(candidate.floor)) continue;
      const distance = (candidate.x - position.x) ** 2 + (candidate.z - position.z) ** 2;
      if (distance < nearest) {
        nearest = distance;
        chosen = candidate;
      }
    }
    if (!chosen) continue;
    torchMounts.push(chosen);
    litFloors.add(chosen.floor);
    reservedFaces.add(faceKey(chosen.seed, chosen.side));
  }
  const agedFaces: { x: number; z: number; side: number; seed: number; floor: number }[] = [];
  const reliefRing = ownGeometry(new THREE.TorusGeometry(0.25, 0.023, 4, 14));
  const carveNiche = (parent: THREE.Group, side: number) => {
    const niche = new THREE.Group();
    niche.name = 'recessed-stone-relief';
    niche.rotation.y = (side * Math.PI) / 2;
    parent.add(niche);
    const frame = batch(niche, stone, trimMaterial, 15, 'inset-arch-stones');
    let index = 0;
    for (const direction of [-1, 1]) {
      for (let level = 0; level < 3; level++) {
        put(frame, index++, {
          x: direction * 0.66,
          y: 0.84 + level * 0.34,
          z: 1.435,
          width: 0.33,
          height: 0.33,
          depth: 0.26,
          shade: 0.72 + level * 0.035,
        });
      }
    }
    for (let segment = 0; segment < 7; segment++) {
      const angle = ((segment + 0.5) * Math.PI) / 7;
      put(frame, index++, {
        x: Math.cos(angle) * 0.64,
        y: 1.7 + Math.sin(angle) * 0.64,
        z: 1.435,
        width: 0.31,
        height: 0.3,
        depth: 0.26,
        roll: angle - Math.PI / 2,
        shade: 0.79,
      });
    }
    put(frame, index++, {
      x: 0,
      y: 0.62,
      z: 1.36,
      width: 1.58,
      height: 0.15,
      depth: 0.45,
      shade: 0.8,
    });
    put(frame, index, {
      x: 0,
      y: 2.39,
      z: 1.435,
      width: 0.3,
      height: 0.26,
      depth: 0.27,
      shade: 0.86,
    });
    finish(frame);
    // The back of the recess is solid stone, with a shallow compass rose carved into it.
    const seal = new THREE.Mesh(reliefRing, trimMaterial);
    seal.position.set(0, 1.46, 1.315);
    niche.add(seal);
    const rays = batch(niche, cube, trimMaterial, 8, 'carved-compass-rays');
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray * Math.PI) / 4;
      put(rays, ray, {
        x: Math.sin(angle) * 0.14,
        y: 1.46 + Math.cos(angle) * 0.14,
        z: 1.31,
        width: 0.035,
        height: ray % 2 ? 0.1 : 0.17,
        depth: 0.025,
        roll: -angle,
        shade: 0.67,
      });
    }
    finish(rays);
  };
  const hangBanner = (parent: THREE.Group, side: number, seed: number) => {
    const banner = new THREE.Group();
    banner.name = 'weathered-wall-banner';
    banner.rotation.y = (side * Math.PI) / 2;
    parent.add(banner);
    const fabric = new THREE.Mesh(ownGeometry(bannerGeometry(seed)), clothMaterial);
    fabric.position.set(0.66, 2.68, 1.555);
    banner.add(fabric);
    const rod = new THREE.Mesh(shaft, bronzeMaterial);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0.66, 2.73, 1.55);
    rod.scale.set(0.055, 1.02, 0.055);
    banner.add(rod);
    for (const x of [0.17, 1.15]) box(banner, ironMaterial, x, 2.74, 1.46, 0.07, 0.15, 0.2);
  };

  const makeWall = (x: number, z: number, seed: number, canEdit = false) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = `masonry-cell-${seed}`;
    root.add(group);
    const column = Math.round(x / CELL + 3),
      row = Math.round(z / CELL + 3);
    const faces = wallSides
      .flatMap((normal, side) => {
        const nextColumn = column + normal.x,
          nextRow = row + normal.z;
        if (nextColumn < 0 || nextColumn >= BOARD_SIZE || nextRow < 0 || nextRow >= BOARD_SIZE)
          return [];
        const floor = nextRow * BOARD_SIZE + nextColumn;
        return fixedFloor(floor) ? [{ side, floor }] : [];
      })
      .sort((a, b) => a.floor - b.floor);
    const fixed = !canEdit && (seed >= 100 || wallAt(wallMask, seed));
    const nicheSide =
      fixed && ([1, 12, 27, 42].includes(seed) || (seed >= 100 && seed % 7 === 0))
        ? faces.find((face) => !reservedFaces.has(faceKey(seed, face.side)))?.side
        : undefined;
    if (nicheSide !== undefined) reservedFaces.add(faceKey(seed, nicheSide));
    const bannerSide =
      fixed && [109, 135, 178].includes(seed)
        ? faces.find((face) => !reservedFaces.has(faceKey(seed, face.side)))?.side
        : undefined;
    if (bannerSide !== undefined) reservedFaces.add(faceKey(seed, bannerSide));
    if (fixed)
      for (const face of faces)
        if (!reservedFaces.has(faceKey(seed, face.side))) agedFaces.push({ x, z, seed, ...face });
    // A recessed core gives the masonry joints and sculpted niches real depth.
    box(group, mortarMaterial, 0, WALL_HEIGHT / 2, 0, CELL - 0.64, WALL_HEIGHT - 0.02, CELL - 0.64);
    // Five staggered courses, four faces. Every brick stays within the canonical footprint.
    const bricks = batch(group, stone, stoneMaterial, 70, 'beveled-stone-courses');
    let index = 0;
    for (let side = 0; side < 4; side++) {
      const normal = wallSides[side];
      // Faces against immutable walls (including the outside of the perimeter)
      // can never be exposed by an edit. Keep faces beside editable cells so
      // previewing a removal cannot reveal missing masonry on its neighbour.
      if (fixedWall(column + normal.x, row + normal.z)) continue;
      const angle = (side * Math.PI) / 2,
        sin = Math.sin(angle),
        cos = Math.cos(angle);
      for (let row = 0; row < 5; row++) {
        const columns = row % 2 === 0 ? 3 : 4;
        for (let column = 0; column < columns; column++) {
          const across = -CELL / 2 + ((column + 0.5) * CELL) / columns,
            front = side === bannerSide ? CELL / 2 - 0.2 : CELL / 2 - 0.12;
          if (side === nicheSide && row > 0 && row < 4 && Math.abs(across) < 0.9) continue;
          put(bricks, index, {
            x: across * cos + front * sin,
            y: ((row + 0.5) * WALL_HEIGHT) / 5,
            z: front * cos - across * sin,
            width: CELL / columns - 0.025,
            height: WALL_HEIGHT / 5 - 0.035 - grain(index + seed * 31) * 0.018,
            depth: 0.24,
            turn: angle,
            shade: 0.58 + grain(seed * 101 + index * 3) * 0.3,
          });
          index++;
        }
      }
    }
    for (const y of [0.1, WALL_HEIGHT - 0.1]) {
      put(bricks, index++, {
        x: 0,
        y,
        z: 0,
        width: CELL,
        height: 0.19,
        depth: CELL,
        shade: 0.61 + grain(seed * 23) * 0.14,
      });
    }
    bricks.count = index;
    finish(bricks);
    if (nicheSide !== undefined) carveNiche(group, nicheSide);
    if (bannerSide !== undefined) hangBanner(group, bannerSide, seed);
    if (seed % 3 === 0) {
      const pillars = batch(group, shaft, stoneMaterial, 4, 'attached-corner-pilasters');
      for (let corner = 0; corner < 4; corner++) {
        put(pillars, corner, {
          x: (corner % 2 === 0 ? -1 : 1) * (CELL / 2 - 0.17),
          y: WALL_HEIGHT / 2,
          z: (corner < 2 ? -1 : 1) * (CELL / 2 - 0.17),
          width: 0.32,
          height: WALL_HEIGHT - 0.35,
          depth: 0.32,
          shade: 0.84,
        });
      }
      finish(pillars);
    }
    if (seed % 4 === 1) {
      const moss = batch(group, mossShape, mossMaterial, 3, 'stone-moss-clusters');
      for (let patch = 0; patch < 3; patch++) {
        put(moss, patch, {
          x: -0.85 + patch * 0.8,
          y: WALL_HEIGHT - 0.09,
          z: (grain(seed + patch) - 0.5) * 2.1,
          width: 0.26,
          height: 0.07,
          depth: 0.2,
          shade: 0.72 + grain(seed + patch) * 0.2,
        });
      }
      finish(moss);
    }
    return group;
  };
  for (let tile = 0; tile < BOARD_SIZE * BOARD_SIZE; tile++) {
    const { x, z } = tilePosition(tile);
    const group = makeWall(x, z, tile, editable(editableMask, tile));
    group.visible = wallAt(wallMask, tile);
    group.userData.tile = tile;
    walls.set(tile, group);
  }
  for (let row = -1; row <= BOARD_SIZE; row++) {
    for (let column = -1; column <= BOARD_SIZE; column++) {
      if (row !== -1 && row !== BOARD_SIZE && column !== -1 && column !== BOARD_SIZE) continue;
      makeWall((column - 3) * CELL, (row - 3) * CELL, 100 + (row + 1) * 9 + column + 1);
    }
  }

  const solid = (column: number, row: number) =>
    column < 0 ||
    row < 0 ||
    column >= BOARD_SIZE ||
    row >= BOARD_SIZE ||
    wallAt(wallMask, row * BOARD_SIZE + column);
  // Real wedge-shaped voussoirs join the roof. They never descend into the walking space.
  for (const tile of [0, 8, 13, 22, 25, 36]) {
    if (wallAt(wallMask, tile)) continue;
    const column = tile % BOARD_SIZE,
      row = Math.floor(tile / BOARD_SIZE);
    const northSouth = solid(column - 1, row) && solid(column + 1, row);
    if (!northSouth && !(solid(column, row - 1) && solid(column, row + 1))) continue;
    const position = tilePosition(tile);
    const rib = new THREE.Group();
    rib.name = 'vaulted-ceiling-rib';
    rib.position.set(position.x, 2.25, position.z);
    rib.rotation.y = northSouth ? 0 : Math.PI / 2;
    rib.scale.y = 0.5;
    ceiling.add(rib);
    const voussoirs = batch(rib, archStone, trimMaterial, 9, 'vault-rib-stones');
    for (let segment = 0; segment < 9; segment++)
      put(voussoirs, segment, {
        x: 0,
        y: 0,
        z: 0,
        width: 1,
        height: 1,
        depth: 1,
        roll: ((segment + 0.5) * Math.PI) / 9,
        shade: 0.62 + grain(tile + segment) * 0.14,
      });
    finish(voussoirs);
  }

  const rootSegments: { from: THREE.Vector3; to: THREE.Vector3; radius: number }[] = [];
  const leaves: StoneTransform[] = [],
    chips: StoneTransform[] = [];
  const dampTiles = new Set<number>();
  let planted = 0;
  for (const face of agedFaces) {
    if (planted >= 6 || (face.seed % 3 !== 1 && face.floor !== 7 && face.floor !== 0)) continue;
    const angle = (face.side * Math.PI) / 2,
      sin = Math.sin(angle),
      cos = Math.cos(angle);
    const onFace = (across: number, y: number, outward: number) =>
      new THREE.Vector3(
        face.x + across * cos + outward * sin,
        y,
        face.z + outward * cos - across * sin,
      );
    const side = planted % 2 ? -1 : 1;
    let previous = onFace(side * 1.1, 3.08, 1.64);
    for (let node = 1; node <= 7; node++) {
      const point = onFace(
        side * (1.05 + Math.sin(node * 1.6 + face.seed) * 0.12),
        3.08 - node * 0.39,
        1.64 + grain(face.seed + node) * 0.035,
      );
      rootSegments.push({ from: previous, to: point, radius: 0.024 - node * 0.002 });
      if (node === 2 || node === 4 || node === 6) {
        const tip = onFace(
          side * (0.76 + grain(face.seed + node * 3) * 0.14),
          point.y - 0.18,
          1.66,
        );
        rootSegments.push({ from: point, to: tip, radius: 0.012 });
        leaves.push({
          x: tip.x,
          y: tip.y,
          z: tip.z,
          width: 0.11,
          height: 0.16,
          depth: 0.05,
          turn: angle,
          roll: side * 0.5,
          shade: 0.6 + grain(node + face.seed) * 0.2,
        });
      }
      previous = point;
    }
    for (let chip = 0; chip < 5; chip++) {
      const point = onFace(
        (grain(face.seed * 7 + chip) - 0.5) * 2.45,
        0.04,
        1.74 + grain(chip + face.seed) * 0.28,
      );
      chips.push({
        x: point.x,
        y: 0.04 + (chip % 2) * 0.02,
        z: point.z,
        width: 0.09 + grain(chip * 3 + face.seed) * 0.16,
        height: 0.07 + (chip % 2) * 0.04,
        depth: 0.1 + grain(chip + 17) * 0.14,
        turn: grain(chip + face.seed) * Math.PI,
        shade: 0.51 + grain(chip + face.seed) * 0.28,
      });
    }
    if (dampTiles.size < 4 && face.floor !== 0 && face.floor !== EXIT) dampTiles.add(face.floor);
    planted++;
  }
  const roots = batch(dressing, shaft, barkMaterial, rootSegments.length, 'roots-in-stone-joints');
  const up = new THREE.Vector3(0, 1, 0),
    delta = new THREE.Vector3();
  rootSegments.forEach(({ from, to, radius }, index) => {
    delta.subVectors(to, from);
    matrix.position.copy(from).add(to).multiplyScalar(0.5);
    matrix.quaternion.setFromUnitVectors(up, delta.clone().normalize());
    matrix.scale.set(radius * 2, delta.length(), radius * 2);
    matrix.updateMatrix();
    roots.setMatrixAt(index, matrix.matrix);
  });
  finish(roots);
  const ivy = batch(dressing, mossShape, mossMaterial, leaves.length, 'sparse-ivy-leaves');
  leaves.forEach((leaf, index) => put(ivy, index, leaf));
  finish(ivy);
  const rubble = batch(dressing, stone, floorMaterial, chips.length, 'low-edge-stone-chips');
  chips.forEach((chip, index) => put(rubble, index, chip));
  finish(rubble);

  const puddleOutline = new THREE.Shape();
  for (let point = 0; point < 20; point++) {
    const angle = (point * Math.PI * 2) / 20,
      radius = 0.8 + grain(point * 13) * 0.2;
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    if (point === 0) puddleOutline.moveTo(x, y);
    else puddleOutline.lineTo(x, y);
  }
  puddleOutline.closePath();
  const puddleGeometry = ownGeometry(new THREE.ShapeGeometry(puddleOutline));
  puddleGeometry.rotateX(-Math.PI / 2);
  const wetMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x273d3c,
      roughness: 0.17,
      metalness: 0.24,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    }),
  );
  const puddles = batch(
    dressing,
    puddleGeometry,
    wetMaterial,
    dampTiles.size,
    'shallow-damp-patches',
  );
  let puddleIndex = 0;
  for (const tile of dampTiles) {
    const position = tilePosition(tile);
    put(puddles, puddleIndex++, {
      x: position.x + 0.5,
      y: 0.032,
      z: position.z - 0.3,
      width: 0.53,
      height: 1,
      depth: 0.32,
      turn: grain(tile) * Math.PI,
      shade: 0.85,
    });
  }
  finish(puddles);

  // START is a brass inlay, EXIT a physical arch with glowing stone-set runes.
  const ring = ownGeometry(new THREE.RingGeometry(0.66, 0.73, 48));
  const start = tilePosition(0),
    exit = tilePosition(EXIT);
  const startMark = new THREE.Mesh(ring, startMaterial);
  startMark.rotation.x = -Math.PI / 2;
  startMark.position.set(start.x, 0.04, start.z);
  root.add(startMark);
  const portal = new THREE.Group();
  portal.name = 'teal-exit-arch';
  portal.position.set(exit.x, 0, exit.z);
  portal.rotation.y = Math.PI / 4;
  root.add(portal);
  const arch = batch(portal, stone, trimMaterial, 12, 'exit-arch-columns');
  let archIndex = 0;
  for (const side of [-1, 1]) {
    for (let level = 0; level < 4; level++) {
      put(arch, archIndex++, {
        x: side * 1.14,
        y: 0.225 + level * 0.45,
        z: 1.1,
        width: 0.4,
        height: 0.435,
        depth: 0.7,
        shade: 0.96,
      });
    }
    for (const y of [0.12, 1.74])
      put(arch, archIndex++, {
        x: side * 1.14,
        y,
        z: 1.1,
        width: 0.55,
        height: 0.2,
        depth: 0.76,
        shade: 0.9,
      });
  }
  finish(arch);
  const crown = batch(portal, archStone, trimMaterial, 9, 'exit-vault-stones');
  for (let segment = 0; segment < 9; segment++) {
    const angle = ((segment + 0.5) * Math.PI) / 9;
    put(crown, segment, {
      x: 0,
      y: 1.79,
      z: 1.1,
      width: 0.76,
      height: 0.76,
      depth: 2.1,
      roll: angle,
      shade: 0.94,
    });
  }
  finish(crown);
  const glyphs = batch(portal, cube, runeMaterial, 12, 'stone-set-exit-glyphs');
  let glyphIndex = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const y = 0.55 + row * 0.43;
      put(glyphs, glyphIndex++, {
        x: side * 1.14,
        y,
        z: 0.744,
        width: 0.025,
        height: 0.2,
        depth: 0.012,
      });
      put(glyphs, glyphIndex++, {
        x: side * 1.1,
        y: y + 0.03,
        z: 0.744,
        width: 0.025,
        height: 0.13,
        depth: 0.012,
        roll: (side * Math.PI) / 4,
      });
    }
  }
  finish(glyphs);
  const exitMark = new THREE.Mesh(ring, runeMaterial);
  exitMark.rotation.x = -Math.PI / 2;
  exitMark.position.set(0, 0.045, 0);
  portal.add(exitMark);
  const sealMarks = batch(portal, cube, bronzeMaterial, 8, 'exit-floor-inlay');
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray * Math.PI) / 4;
    put(sealMarks, ray, {
      x: Math.sin(angle) * 0.87,
      y: 0.035,
      z: Math.cos(angle) * 0.87,
      width: 0.035,
      height: 0.01,
      depth: 0.14,
      turn: angle,
    });
  }
  finish(sealMarks);
  const runeShape = ownGeometry(new THREE.OctahedronGeometry(0.11, 0));
  const crest = new THREE.Mesh(runeShape, runeMaterial);
  crest.position.set(0, 2.72, 0.79);
  crest.scale.set(1, 1.5, 0.25);
  portal.add(crest);

  const hemisphere = new THREE.HemisphereLight(0xc3d9d0, 0x45473b, 1.2);
  const daylight = new THREE.DirectionalLight(0xe5e4d5, 0.62);
  daylight.position.set(-7, 13, 5);
  root.add(hemisphere, daylight);
  const exitLight = new THREE.PointLight(0x63dfc9, 6.5, 8, 2);
  exitLight.position.set(exit.x, 1.45, exit.z + 0.3);
  const fill = new THREE.PointLight(0xf4e0bf, 2.8, 7, 2);
  root.add(exitLight, fill);

  const torchGroup = new THREE.Group();
  torchGroup.name = 'overhead-iron-sconces';
  root.add(torchGroup);
  const bowlGeometry = ownGeometry(
    new THREE.LatheGeometry(
      [
        [0, -0.17],
        [0.07, -0.17],
        [0.1, -0.09],
        [0.15, -0.06],
        [0.21, 0.07],
        [0.2, 0.095],
        [0.18, 0.07],
        [0.11, -0.04],
        [0, -0.06],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      12,
    ),
  );
  const flameGeometry = ownGeometry(torchFlameGeometry());
  const rimGeometry = ownGeometry(new THREE.TorusGeometry(0.203, 0.017, 5, 12));
  const rivetGeometry = ownGeometry(new THREE.SphereGeometry(0.025, 6, 4));
  const bracketGeometry = ownGeometry(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.27, -0.19),
        new THREE.Vector3(0, -0.31, -0.02),
        new THREE.Vector3(0, -0.22, 0.1),
        new THREE.Vector3(0, -0.12, 0.03),
      ]),
      8,
      0.025,
      5,
      false,
    ),
  );
  const flameMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffad50,
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  const flameCoreMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({ color: 0xffebaf, toneMapped: false }),
  );
  const torches: {
    flame: THREE.Group;
    light: THREE.PointLight;
    phase: number;
  }[] = [];
  for (const candidate of torchMounts) {
    const sconce = new THREE.Group();
    sconce.name = 'iron-torch-sconce';
    sconce.position.set(candidate.x, 2.02, candidate.z);
    sconce.rotation.y = candidate.angle;
    torchGroup.add(sconce);
    box(sconce, ironMaterial, 0, -0.1, -0.17, 0.18, 0.48, 0.065);
    sconce.add(new THREE.Mesh(bracketGeometry, ironMaterial));
    for (const y of [-0.28, 0.09]) {
      const rivet = new THREE.Mesh(rivetGeometry, bronzeMaterial);
      rivet.position.set(0, y, -0.127);
      sconce.add(rivet);
    }
    const bowl = new THREE.Mesh(bowlGeometry, ironMaterial);
    sconce.add(bowl);
    const rim = new THREE.Mesh(rimGeometry, bronzeMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    sconce.add(rim);
    const flame = new THREE.Group();
    flame.position.y = 0.075;
    const outerFlame = new THREE.Mesh(flameGeometry, flameMaterial);
    const innerFlame = new THREE.Mesh(flameGeometry, flameCoreMaterial);
    innerFlame.scale.set(0.58, 0.65, 0.58);
    innerFlame.position.y = 0.015;
    flame.add(outerFlame, innerFlame);
    sconce.add(flame);
    const light = new THREE.PointLight(0xffa85a, 9.5, 9, 2);
    light.position.y = 0.3;
    sconce.add(light);
    torches.push({ flame, light, phase: torches.length * 1.73 });
  }

  let overview = false,
    disposed = false;
  root.updateMatrixWorld(true);
  return {
    root,
    ceiling,
    walls,
    setOverview(value) {
      if (disposed) return;
      overview = value;
      ceiling.visible = !value;
      dressing.visible = !value;
      torchGroup.visible = !value;
      exitLight.visible = !value;
      fill.visible = !value;
      hemisphere.intensity = value ? 2.1 : 1.2;
    },
    update(timeSeconds, reducedMotion, cameraPosition) {
      if (disposed) return;
      fill.position.copy(cameraPosition);
      fill.position.y += 0.15;
      if (overview) return;
      const time = reducedMotion ? 0 : timeSeconds;
      for (const torch of torches) {
        const flicker = reducedMotion
          ? 1
          : 1 +
            Math.sin(time * 8.1 + torch.phase) * 0.06 +
            Math.sin(time * 13.7 + torch.phase) * 0.025;
        torch.light.intensity = 9.5 * flicker;
        torch.flame.scale.set(1 / flicker, flicker, 1 / flicker);
      }
      exitLight.intensity = reducedMotion ? 6.5 : 6.5 + Math.sin(time * 1.6) * 0.3;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const mesh of instances) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      instances.clear();
      geometries.clear();
      materials.clear();
      textures.clear();
      walls.clear();
      root.clear();
    },
  };
}
