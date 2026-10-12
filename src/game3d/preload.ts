type DungeonModule = typeof import('./ThreeBridge');
let dungeonModule: Promise<DungeonModule> | undefined;

/** Share a lazy import between Play intent and the mounted view; only the view creates WebGL. */
export function loadDungeon3D(): Promise<DungeonModule> {
  dungeonModule ??= import('./ThreeBridge').catch((error: unknown) => {
    dungeonModule = undefined;
    throw error;
  });
  return dungeonModule;
}

/** Prepare code only; the board owns the canvas, engine lifecycle. */
export function warmDungeon() {
  if (typeof navigator === 'undefined') return;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    (connection?.effectiveType && ['slow-2g', '2g', '3g'].includes(connection.effectiveType))
  )
    return;
  void loadDungeon3D().catch(() => {
    // A speculative download must not interrupt navigation; Board exposes explicit retry.
  });
}
