import { deployment } from '../config/deployment';

const journalKey = `ruin-relay:v1:${deployment.chainId}:${deployment.address?.toLowerCase() ?? 'practice'}`;
export const inflightKey = `${journalKey}:inflight`;

let observedClientId: string | undefined;

async function ownClientId() {
  if (observedClientId || !navigator.locks?.request || !navigator.locks.query)
    return observedClientId;
  const probe = `ruin-relay:probe:${crypto.randomUUID()}`;
  await navigator.locks.request(probe, async () => {
    const snapshot = await navigator.locks.query();
    observedClientId = snapshot.held?.find((lock) => lock.name === probe)?.clientId;
  });
  return observedClientId;
}

/** True when some other document holds the open-wallet lock for this deployment. */
export async function anotherDocumentIsSigning() {
  if (typeof navigator === 'undefined' || !navigator.locks?.query) return false;
  const mine = await ownClientId();
  if (!mine) return false;
  const snapshot = await navigator.locks.query();
  return Boolean(
    snapshot.held?.some((lock) => lock.name === inflightKey && lock.clientId !== mine),
  );
}
