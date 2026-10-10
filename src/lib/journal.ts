import { configured, deployment } from '../config/deployment';
import { calldata, verify } from './chain';
import { pack, preview, validatePath } from './rules';
import { SIGNING_STATUS, unresolved, type Attempt, type Snapshot } from './model';

const key = `ruin-relay:v1:${deployment.chainId}:${deployment.address?.toLowerCase() ?? 'practice'}`;
const serialize = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === 'bigint' ? { bigint: item.toString() } : item,
  );
function parse(raw: string): Attempt[] {
  const data = JSON.parse(raw, (_, item) =>
    item &&
    typeof item === 'object' &&
    Object.keys(item).length === 1 &&
    typeof item.bigint === 'string'
      ? BigInt(item.bigint)
      : item,
  );
  if (data.version !== 1 || !Array.isArray(data.attempts))
    throw new Error(
      'Recovery journal is unreadable. Commit is blocked; retain your transaction evidence.',
    );
  for (const attempt of data.attempts as Attempt[]) {
    const snapshot = attempt.run?.snapshot;
    if (
      !snapshot ||
      snapshot.chainId !== deployment.chainId ||
      snapshot.address.toLowerCase() !== deployment.address?.toLowerCase() ||
      typeof attempt.id !== 'string' ||
      !/^0x[\da-f]{40}$/i.test(attempt.account) ||
      !Array.isArray(attempt.hashes) ||
      !Array.isArray(attempt.observed) ||
      ![
        'signing',
        'pending',
        'unknown',
        'syncing',
        'confirmed',
        'rejected',
        'reverted',
        'cancelled',
        'replaced',
      ].includes(attempt.state) ||
      !validatePath(snapshot.walls, pack(attempt.run.path), attempt.run.path.length) ||
      preview(snapshot.walls, snapshot.editableMask, attempt.tile).walls !==
        attempt.expectedWalls ||
      calldata(attempt.run, pack(attempt.run.path), attempt.tile) !== attempt.calldata
    )
      throw new Error('Recovery journal is inconsistent. Commit is blocked.');
  }
  return data.attempts;
}

/** All read/check/write operations share a Web Lock. Storage events only notify views. */
export class Journal {
  private unsaved = new Map<string, Attempt>();
  private cached?: Attempt[];
  warning = '';
  get available() {
    return configured && Boolean(navigator.locks?.request);
  }
  read(): Attempt[] {
    const raw = localStorage.getItem(key);
    const saved = raw ? parse(raw) : [];
    this.cached = saved
      .map((attempt) => {
        const memory = this.unsaved.get(attempt.id);
        if (!memory) return attempt;
        const hashes = [...new Set([...attempt.hashes, ...memory.hashes])];
        return {
          ...memory,
          ...attempt,
          originalHash: attempt.originalHash ?? memory.originalHash,
          activeHash: attempt.activeHash ?? memory.activeHash,
          hashes,
          observed: [
            ...new Map(
              [...memory.observed, ...attempt.observed].map((tx) => [tx.hash, tx]),
            ).values(),
          ],
          state:
            memory.state === 'rejected' && hashes.length === 0
              ? ('rejected' as const)
              : attempt.state,
        };
      })
      .concat([...this.unsaved.values()].filter((a) => !saved.some((s) => s.id === a.id)));
    return this.cached;
  }
  async locked<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.available)
      throw new Error(
        'Atomic coordination across tabs is unavailable. Local play works; Commit is disabled.',
      );
    return navigator.locks.request(key, operation);
  }
  private save(attempts: Attempt[], required = false) {
    try {
      localStorage.setItem(key, serialize({ version: 1, attempts }));
      this.unsaved.clear();
      this.warning = '';
    } catch {
      if (required)
        throw new Error(
          'Commit recovery is unavailable: the initial journal could not be saved. No signing request was sent.',
        );
      for (const attempt of attempts) this.unsaved.set(attempt.id, attempt);
      this.warning =
        'Recovery storage failed. Keep a copy of your transaction hash. Tracking continues in this tab.';
    }
    this.cached = attempts;
  }
  async sync(live: Snapshot, activeSigningId?: string): Promise<Attempt[]> {
    const coordinated = this.available;
    const check = async () => {
      const checked: Attempt[] = [];
      for (const attempt of this.read()) {
        const openSigning =
          attempt.id === activeSigningId && attempt.state === 'signing' && !attempt.activeHash;
        try {
          checked.push(await verify(attempt, live, openSigning));
        } catch {
          checked.push(
            openSigning
              ? { ...attempt, state: 'signing', message: SIGNING_STATUS }
              : {
                  ...attempt,
                  state: 'unknown',
                  mutation: undefined,
                  message: 'Observation unavailable. Still checking your transaction.',
                },
          );
        }
      }
      if (coordinated && checked.length) this.save(checked);
      return checked;
    };
    return coordinated ? this.locked(check) : check();
  }
  async claim(attempt: Attempt, live: Snapshot): Promise<Attempt[]> {
    return this.locked(async () => {
      const attempts: Attempt[] = [];
      for (const old of this.read()) attempts.push(await verify(old, live));
      if (attempts.some(unresolved))
        throw new Error(
          'An edit is already in progress for this dungeon. Check its status before submitting another.',
        );
      attempts.push(attempt);
      this.save(attempts, true);
      return attempts;
    });
  }
  async update(id: string, change: (attempt: Attempt) => Attempt) {
    return this.locked(async () => {
      let saved: Attempt[];
      try {
        saved = this.read();
      } catch (error) {
        if (!this.cached) throw error;
        const attempts = this.cached.map((attempt) =>
          attempt.id === id ? change(attempt) : attempt,
        );
        const updated = attempts.find((attempt) => attempt.id === id);
        if (updated) this.unsaved.set(id, updated);
        this.cached = attempts;
        // Do not overwrite the durable journal without reading other tabs' entries first.
        this.warning =
          'Recovery storage failed. Keep a copy of your transaction hash. Tracking continues in this tab.';
        return attempts;
      }
      if (!saved.some((attempt) => attempt.id === id)) return saved;
      const attempts = saved.map((attempt) => (attempt.id === id ? change(attempt) : attempt));
      this.save(attempts);
      return attempts;
    });
  }
}
