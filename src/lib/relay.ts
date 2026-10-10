import { isHash, type Address, type Hash } from 'viem';
import fixture from '../../reference/fixtures.json';
import { abi } from '../config/abi';
import { configured, deployment } from '../config/deployment';
import {
  calldata,
  client,
  readDungeon,
  readHistory,
  sameAction,
  transaction,
  originalEvidence,
} from './chain';
import { Journal } from './journal';
import {
  sameDungeon,
  unresolved,
  type Attempt,
  type Mutation,
  type Run,
  type Snapshot,
} from './model';
import { EXIT, MAX_MOVES, move, pack, preview, type Direction } from './rules';
import { explain, rejected, switchNetwork, wallet } from './wallet';

interface Prepared {
  account: Address;
  gas: bigint;
  fee: bigint;
  run: Run;
  tile: number;
}
interface View {
  live?: Snapshot;
  run?: Run;
  tile?: number;
  online: boolean;
  busy: boolean;
  error: string;
  attempts: Attempt[];
  history: Mutation[];
  historyError: boolean;
  prepared?: Prepared;
  storageWarning: string;
  recoveryError?: string;
}
export class Relay {
  private journal = new Journal();
  private listeners = new Set<() => void>();
  private refreshing?: Promise<void>;
  private requestInFlight = false;
  private watching = new Set<string>();
  private historyTask?: Promise<void>;
  state: View = {
    online: false,
    busy: false,
    error: '',
    attempts: [],
    history: [],
    historyError: false,
    storageWarning: '',
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private set(next: Partial<View>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  get locked() {
    return this.state.busy || this.state.attempts.some(unresolved);
  }
  get coordinationAvailable() {
    return this.journal.available && !this.state.recoveryError;
  }
  async start() {
    if (!configured) {
      const snapshot: Snapshot = {
        chainId: deployment.chainId,
        address: '0x0000000000000000000000000000000000000000',
        walls: BigInt(fixture.initialWallsHex),
        revision: 0n,
        editableMask: BigInt(fixture.editableMaskHex),
        blockNumber: 0n,
        blockHash: `0x${'0'.repeat(64)}`,
      };
      this.set({
        run: { snapshot, path: '', position: 0 },
        error: 'Practice seed · deployment not configured. Commits are unavailable.',
      });
      return;
    }
    try {
      const cached = this.journal
        .read()
        .map((a) =>
          a.state === 'rejected' ? a : { ...a, state: 'unknown' as const, mutation: undefined },
        );
      const restore = cached.find(unresolved) ?? cached.at(-1);
      this.set({ attempts: cached, ...(restore ? { run: restore.run, tile: restore.tile } : {}) });
    } catch {
      this.set({
        recoveryError:
          'Recovery storage could not be read. Commit is disabled; local play remains available.',
      });
    }
    await this.refresh();
  }
  refresh = () => {
    if (this.refreshing || !configured) return this.refreshing ?? Promise.resolve();
    this.refreshing = this.refreshNow().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  };
  private async refreshNow() {
    try {
      const live = await readDungeon();
      let attempts = this.state.attempts;
      try {
        attempts = this.journal.available ? await this.journal.sync(live) : this.journal.read();
        this.set({ recoveryError: undefined });
      } catch {
        this.set({
          recoveryError:
            'Recovery storage could not be read. Commit is disabled; local play remains available.',
        });
        attempts = attempts.map((a) =>
          a.state === 'rejected' ? a : { ...a, state: 'unknown', mutation: undefined },
        );
      }
      const restored = attempts.find(unresolved);
      this.set({
        live,
        online: true,
        attempts,
        storageWarning: this.journal.warning,
        ...(!this.state.run ||
        (restored && this.state.run.snapshot !== restored.run.snapshot && !this.requestInFlight)
          ? {
              run: restored?.run ?? { snapshot: live, path: '', position: 0 },
              tile: restored?.tile,
            }
          : {}),
      });
      for (const attempt of attempts)
        if (unresolved(attempt) && attempt.activeHash) this.watch(attempt.activeHash, attempt.id);
      if (!this.historyTask) {
        this.historyTask = readHistory(live)
          .then((history) => {
            if (this.state.live?.blockHash === live.blockHash)
              this.set({ history, historyError: false });
          })
          .catch(() => this.set({ history: [], historyError: true }))
          .finally(() => {
            this.historyTask = undefined;
          });
      }
    } catch {
      this.set({
        online: false,
        history: [],
        historyError: true,
        attempts: this.state.attempts.map((a) =>
          a.state === 'rejected'
            ? a
            : {
                ...a,
                state: 'unknown',
                mutation: undefined,
                message: 'Observation unavailable. Still checking your transaction.',
              },
        ),
      });
    }
  }
  move(direction: Direction) {
    const run = this.state.run;
    if (!run || this.locked || run.position === EXIT || run.path.length >= MAX_MOVES) return;
    const position = move(run.snapshot.walls, run.position, direction);
    if (position !== null)
      this.set({
        run: { ...run, position, path: run.path + direction },
        error: '',
        prepared: undefined,
      });
  }
  restart() {
    if (this.locked || !this.state.run) return;
    this.set({
      run: { snapshot: this.state.run.snapshot, path: '', position: 0 },
      tile: undefined,
      prepared: undefined,
      error: '',
    });
  }
  async latest() {
    if (this.locked) return;
    await this.refresh();
    if (this.locked || !this.state.online || !this.state.live) return;
    this.set({
      run: { snapshot: this.state.live, path: '', position: 0 },
      tile: undefined,
      prepared: undefined,
      error: '',
    });
  }
  select(tile?: number) {
    if (this.locked || this.state.run?.position !== EXIT) return;
    if (tile !== undefined) {
      try {
        preview(this.state.run.snapshot.walls, this.state.run.snapshot.editableMask, tile);
      } catch {
        return;
      }
    }
    this.set({ tile, prepared: undefined, error: '' });
  }
  private eligible() {
    const { run, live, tile, online } = this.state;
    return (
      !this.state.recoveryError &&
      run &&
      run.position === EXIT &&
      live &&
      online &&
      sameDungeon(run.snapshot, live) &&
      tile !== undefined &&
      preview(run.snapshot.walls, run.snapshot.editableMask, tile).solvable
    );
  }
  async prepare() {
    if (this.locked || !this.eligible()) return;
    this.set({ busy: true, error: '' });
    try {
      if (!this.journal.available)
        throw new Error(
          'Atomic coordination across tabs is unavailable. Local play works; Commit is disabled.',
        );
      const connected = await wallet();
      if ((await connected.getChainId()) !== deployment.chainId) throw new Error('Wrong network');
      const live = await readDungeon();
      this.set({ live, online: true });
      if (!this.eligible()) throw new Error('Stale run');
      const run = this.state.run!;
      const tile = this.state.tile!;
      const account = connected.account.address;
      const args = [run.snapshot.revision, pack(run.path), run.path.length, tile] as const;
      await client.simulateContract({
        address: run.snapshot.address,
        abi,
        functionName: 'completeAndMutate',
        args,
        account,
      });
      const gas = await client.estimateContractGas({
        address: run.snapshot.address,
        abi,
        functionName: 'completeAndMutate',
        args,
        account,
      });
      const fee = gas * (await client.getGasPrice());
      this.set({ prepared: { run, tile, account, gas, fee } });
    } catch (error) {
      this.set({ error: explain(error) });
    } finally {
      this.set({ busy: false });
    }
  }
  async send() {
    const prepared = this.state.prepared;
    if (this.locked || !prepared || !this.eligible()) return;
    this.set({ busy: true, error: '' });
    let attempt: Attempt | undefined;
    let issued = false;
    try {
      const connected = await wallet();
      const [account] = await connected.getAddresses();
      if (
        account.toLowerCase() !== prepared.account.toLowerCase() ||
        (await connected.getChainId()) !== deployment.chainId
      )
        throw new Error('Account or network changed before signing');
      const live = await readDungeon();
      this.set({ live });
      if (!this.eligible()) throw new Error('Stale run');
      const { run, tile } = prepared;
      await client.simulateContract({
        address: run.snapshot.address,
        abi,
        functionName: 'completeAndMutate',
        args: [run.snapshot.revision, pack(run.path), run.path.length, tile],
        account,
      });
      const requestedNonce = await client.getTransactionCount({
        address: account,
        blockTag: 'pending',
      });
      attempt = {
        id: crypto.randomUUID(),
        run,
        tile,
        account,
        calldata: calldata(run, pack(run.path), tile),
        expectedWalls: preview(run.snapshot.walls, run.snapshot.editableMask, tile).walls,
        state: 'signing',
        hashes: [],
        observed: [],
        requestedNonce,
      };
      this.set({ attempts: await this.journal.claim(attempt, live), prepared: undefined });
      // Recheck immediately before the request; subsequent wallet events cannot change this attempt.
      const [activeAccount] = await connected.getAddresses();
      if (
        activeAccount.toLowerCase() !== account.toLowerCase() ||
        (await connected.getChainId()) !== deployment.chainId
      )
        throw new Error('Account or network changed before signing');
      issued = true;
      this.requestInFlight = true;
      const hash = await connected.sendTransaction({
        account,
        chain: connected.chain,
        to: run.snapshot.address,
        value: 0n,
        data: attempt.calldata,
        gas: prepared.gas,
        nonce: requestedNonce,
      });
      const id = attempt.id;
      this.set({
        attempts: await this.journal.update(id, (a) => ({
          ...a,
          originalHash: hash,
          activeHash: hash,
          hashes: [...new Set([...a.hashes, hash])],
          state: 'pending',
        })),
        storageWarning: this.journal.warning,
      });
      try {
        const observed = await transaction(hash, 'wallet-response');
        if (!sameAction(attempt, observed))
          throw new Error('Original transaction does not match the attempt.');
        this.set({
          attempts: await this.journal.update(id, (a) => ({
            ...a,
            observed: [...a.observed.filter((t) => t.hash !== hash), observed],
          })),
        });
      } catch {
        /* The original returned hash remains evidence; a requested nonce alone is insufficient. */
      }
      this.watch(hash, id);
    } catch (error) {
      if (attempt)
        this.set({
          attempts: await this.journal.update(attempt.id, (a) => ({
            ...a,
            state: !issued || rejected(error) ? 'rejected' : 'unknown',
            message:
              !issued || rejected(error)
                ? 'Wallet request rejected. Your run and edit are preserved.'
                : 'Check your wallet for this transaction. Recover with transaction hash if available.',
          })),
        });
      this.set({ error: explain(error) });
    } finally {
      this.requestInFlight = false;
      this.set({ busy: false });
      await this.refresh();
    }
  }
  private watch(hash: Hash, id: string) {
    const key = `${id}:${hash}`;
    if (this.watching.has(key)) return;
    this.watching.add(key);
    void client
      .waitForTransactionReceipt({
        hash,
        timeout: 20_000,
        pollingInterval: 1000,
        onReplaced: async ({ transaction: replacement }) => {
          await this.recover(replacement.hash, id);
        },
      })
      .then(() => this.refresh())
      .catch(() => this.refresh())
      .finally(() => this.watching.delete(key));
  }
  async recover(hashText: string, id?: string) {
    const attempt = id
      ? this.state.attempts.find((a) => a.id === id)
      : this.state.attempts.find(unresolved);
    if (!attempt || !isHash(hashText)) {
      this.set({ error: 'Enter a valid transaction hash.' });
      return;
    }
    try {
      const tx = await transaction(hashText, 'same-nonce');
      let original = originalEvidence(attempt);
      if (!original && attempt.originalHash) {
        try {
          const observed = await transaction(attempt.originalHash, 'wallet-response');
          if (sameAction(attempt, observed)) original = observed;
        } catch {
          /* A requested nonce cannot substitute for missing original transaction evidence. */
        }
      }
      const knownNonce = original?.nonce;
      const linked =
        hashText === attempt.originalHash ||
        (knownNonce !== undefined &&
          tx.sender.toLowerCase() === attempt.account.toLowerCase() &&
          tx.nonce === knownNonce);
      if (!linked)
        throw new Error(
          'Transaction is unrelated or linkage is ambiguous. The original attempt remains locked.',
        );
      if (hashText === attempt.originalHash && !sameAction(attempt, tx))
        throw new Error('Transaction does not match the original action.');
      const evidence = original;
      this.set({
        attempts: await this.journal.update(attempt.id, (a) => ({
          ...a,
          activeHash: hashText,
          hashes: [...new Set([...a.hashes, hashText])],
          observed: [
            ...a.observed.filter((t) => t.hash !== hashText && t.hash !== evidence?.hash),
            ...(evidence ? [evidence] : []),
            { ...tx, linkage: hashText === a.originalHash ? 'wallet-response' : 'same-nonce' },
          ],
          state: 'pending',
          mutation: undefined,
        })),
        error: '',
        storageWarning: this.journal.warning,
      });
      await this.refresh();
    } catch (error) {
      this.set({ error: explain(error) });
    }
  }
  async switchNetwork() {
    try {
      await switchNetwork();
      this.set({ error: '' });
    } catch (error) {
      this.set({ error: explain(error) });
    }
  }
}
