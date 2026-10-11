import { isHash, type Address, type Hash } from 'viem';
import fixture from '../../reference/fixtures.json';
import { abi } from '../config/abi';
import { configured, deployment } from '../config/deployment';
import {
  calldata,
  client,
  commitFeeCap,
  readDungeon,
  readHistory,
  sameAction,
  transaction,
  originalEvidence,
  observeReceipt,
} from './chain';
import { Journal } from './journal';
import {
  SIGNING_STATUS,
  sameDungeon,
  unresolved,
  type Attempt,
  type Mutation,
  type Run,
  type Snapshot,
} from './model';
import { EXIT, MAX_MOVES, move, pack, preview, type Direction } from './rules';
import { explain, isDeploymentChain, notBroadcast, switchNetwork, wallet } from './wallet';

interface Prepared {
  account: Address;
  gas: bigint;
  fee: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
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

function invalidateObservations(attempts: Attempt[], message?: string): Attempt[] {
  return attempts.map((attempt) =>
    attempt.state === 'rejected'
      ? attempt
      : {
          ...attempt,
          state: 'unknown',
          mutation: undefined,
          ...(message === undefined ? {} : { message }),
        },
  );
}

export class Relay {
  private journal = new Journal();
  private listeners = new Set<() => void>();
  private refreshing?: Promise<void>;
  private queuedRefresh?: Promise<void>;
  private requestInFlight = false;
  private signingId?: string;
  private watching = new Set<string>();
  private historyTask?: Promise<void>;
  private historySnapshot?: Snapshot;
  private historyStale = false;
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
      const cached = invalidateObservations(this.journal.read());
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
  refresh = (): Promise<void> => {
    if (!configured) return Promise.resolve();
    if (this.refreshing) {
      this.queuedRefresh ??= this.refreshing.then(() => {
        this.queuedRefresh = undefined;
        return this.refresh();
      });
      return this.queuedRefresh;
    }
    this.refreshing = this.refreshNow().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  };
  private keepOpenSigning(attempts: Attempt[]) {
    if (!this.signingId) return attempts;
    const id = this.signingId;
    const local = this.state.attempts.find((attempt) => attempt.id === id);
    const synced = attempts.find((attempt) => attempt.id === id);
    if (local && local.state !== 'signing') {
      if (!synced || (synced.state === 'signing' && !synced.activeHash))
        return [...attempts.filter((attempt) => attempt.id !== id), local];
      return attempts;
    }
    const source = synced ?? local;
    if (!source || source.activeHash) return attempts;
    return [
      ...attempts.filter((attempt) => attempt.id !== id),
      { ...source, state: 'signing' as const, mutation: undefined, message: SIGNING_STATUS },
    ];
  }
  private loadHistory(live: Snapshot) {
    if (this.historyTask) {
      if (this.historySnapshot && !sameDungeon(this.historySnapshot, live))
        this.historyStale = true;
      return;
    }
    this.historySnapshot = live;
    this.historyTask = readHistory(live)
      .then((history) => {
        // A newer head block is not a new dungeon. Keep the read when the
        // revision and walls still match, and refetch only when they do not.
        if (this.state.live && sameDungeon(this.state.live, live))
          this.set({ history, historyError: false });
        else this.historyStale = true;
      })
      .catch(() => this.set({ history: [], historyError: true }))
      .finally(() => {
        this.historyTask = undefined;
        const next = this.state.live;
        if (this.historyStale && next) {
          this.historyStale = false;
          this.loadHistory(next);
        }
      });
  }
  private async refreshNow() {
    try {
      const live = await readDungeon();
      let attempts = this.state.attempts;
      try {
        attempts = await this.journal.sync(live, this.signingId);
        this.set({ recoveryError: undefined });
      } catch {
        this.set({
          recoveryError:
            'Recovery storage could not be read. Commit is disabled; local play remains available.',
        });
        attempts = invalidateObservations(attempts);
      }
      attempts = this.keepOpenSigning(attempts);
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
              prepared: undefined,
            }
          : {}),
      });
      for (const attempt of attempts)
        if (unresolved(attempt) && attempt.activeHash) this.watch(attempt.activeHash, attempt.id);
      this.loadHistory(live);
    } catch {
      this.set({
        online: false,
        history: [],
        historyError: true,
        attempts: this.keepOpenSigning(
          invalidateObservations(
            this.state.attempts,
            'Observation unavailable. Still checking your transaction.',
          ),
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
  private eligible(prepared?: Pick<Prepared, 'run' | 'tile'>) {
    const { run, live, tile, online } = this.state;
    return (
      !this.state.recoveryError &&
      run &&
      (!prepared || (prepared.run === run && prepared.tile === tile)) &&
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
      if (!isDeploymentChain(await connected.getChainId())) throw new Error('Wrong network');
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
      const fees = await commitFeeCap();
      // Another tab may have replaced the draft while the wallet/RPC quote
      // was pending. Its late result must not restore the old preview.
      if (!this.eligible({ run, tile }) || this.state.attempts.some(unresolved)) return;
      this.set({
        prepared: { run, tile, account, gas, fee: gas * fees.maxFeePerGas, ...fees },
      });
    } catch (error) {
      this.set({ error: explain(error) });
    } finally {
      this.set({ busy: false });
    }
  }
  async send() {
    const prepared = this.state.prepared;
    if (this.locked || !prepared || !this.eligible(prepared)) return;
    this.set({ busy: true, error: '' });
    let attempt: Attempt | undefined;
    let issued = false;
    try {
      const connected = await wallet();
      const [account] = await connected.getAddresses();
      if (
        account.toLowerCase() !== prepared.account.toLowerCase() ||
        !isDeploymentChain(await connected.getChainId())
      )
        throw new Error('Account or network changed before signing');
      const live = await readDungeon();
      this.set({ live });
      if (this.state.run !== prepared.run || this.state.tile !== prepared.tile) {
        this.set({ prepared: undefined });
        return;
      }
      if (!this.eligible()) throw new Error('Stale run');
      const { run, tile } = prepared;
      await client.simulateContract({
        address: run.snapshot.address,
        abi,
        functionName: 'completeAndMutate',
        args: [run.snapshot.revision, pack(run.path), run.path.length, tile],
        account,
      });
      const [pendingNonce, latestNonce] = await Promise.all([
        client.getTransactionCount({ address: account, blockTag: 'pending' }),
        client.getTransactionCount({ address: account, blockTag: 'latest' }),
      ]);
      const fees = await commitFeeCap();
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
        requestedNonce: pendingNonce,
        nonceAtSign: { pending: pendingNonce, latest: latestNonce },
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        message: SIGNING_STATUS,
      };
      if (!(await this.journal.beginInflight()))
        throw new Error(
          'An edit is already in progress for this dungeon. Check its status before submitting another.',
        );
      const claimed = await this.journal.claim(attempt, live);
      this.signingId = attempt.id;
      this.requestInFlight = true;
      this.set({ attempts: claimed, prepared: undefined });
      // Recheck immediately before the request; subsequent wallet events cannot change this attempt.
      const [activeAccount] = await connected.getAddresses();
      if (
        activeAccount.toLowerCase() !== account.toLowerCase() ||
        !isDeploymentChain(await connected.getChainId())
      )
        throw new Error('Account or network changed before signing');
      if (this.state.run !== run || this.state.tile !== tile)
        throw new Error('Run or edit changed before signing. Review your edit again.');
      issued = true;
      const hash = await connected.sendTransaction({
        account,
        chain: connected.chain,
        to: run.snapshot.address,
        value: 0n,
        data: attempt.calldata,
        gas: prepared.gas,
        nonce: pendingNonce,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
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
      // `issued` means the wallet request was sent, not that a transaction was
      // accepted. Only a definitive pre-broadcast rejection releases the journal.
      const beforeBroadcast = !issued || notBroadcast(error);
      if (attempt)
        this.set({
          attempts: await this.journal.update(attempt.id, (a) => ({
            ...a,
            state: beforeBroadcast ? 'rejected' : 'unknown',
            message: beforeBroadcast
              ? explain(error)
              : 'Check your wallet for this transaction. Recover with transaction hash if available.',
          })),
        });
      this.set({ error: explain(error) });
    } finally {
      this.journal.endInflight();
      this.signingId = undefined;
      this.requestInFlight = false;
      this.set({ busy: false });
      await this.refresh();
    }
  }
  private watch(hash: Hash, id: string) {
    const key = `${id}:${hash}`;
    if (this.watching.has(key)) return;
    this.watching.add(key);
    void observeReceipt(
      hash,
      () => this.state.attempts.find((attempt) => attempt.id === id),
      (replacement) => this.recover(replacement, id),
    )
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
