// Operator-only tooling. This module is never imported by the browser bundle.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { binary } from './foundry.mjs';

const command = process.argv[2] ?? 'balance';
const rpc = process.env.SEPOLIA_RPC_URL ?? arbitrumSepolia.rpcUrls.default.http[0];
const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(rpc, { timeout: 15_000, retryCount: 0 }),
});
if ((await client.getChainId()) !== 421614)
  throw new Error('Refusing operation: RPC must be Arbitrum Sepolia (421614).');
const wallets = JSON.parse(await readFile('.local/sepolia-wallets.json', 'utf8'));
const accounts = wallets.map((wallet) => privateKeyToAccount(wallet.privateKey));
const balances = await Promise.all(
  accounts.map((account) => client.getBalance({ address: account.address })),
);
for (let i = 0; i < accounts.length; i++)
  console.log(`${wallets[i].name}: ${accounts[i].address} — ${formatEther(balances[i])} test ETH`);
if (command === 'balance') process.exit();
if (!['deploy', 'verify', 'fixture-demo'].includes(command))
  throw new Error('Use balance, deploy, verify, or fixture-demo.');
const build = spawnSync(binary('forge'), ['build', '--root', 'contracts'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const artifact = JSON.parse(await readFile('contracts/out/RuinRelay.sol/RuinRelay.json', 'utf8'));
const fixture = JSON.parse(await readFile('reference/fixtures.json', 'utf8'));
await mkdir('.local', { recursive: true, mode: 0o700 });
const file = '.local/sepolia-deployment.json';
let record;
try {
  record = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const save = () =>
  writeFile(
    file,
    JSON.stringify(record, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2),
    { mode: 0o600 },
  );
const walletClient = (index) =>
  createWalletClient({
    account: accounts[index],
    chain: arbitrumSepolia,
    transport: http(rpc, { retryCount: 0 }),
  });
if (command === 'deploy') {
  if (!record) {
    if (balances[0] === 0n)
      throw new Error('Fund wallet A with Arbitrum Sepolia test ETH before deploying.');
    // Save the intended nonce before broadcast; a lost response must be recovered, never blindly retried.
    const nonce = await client.getTransactionCount({
      address: accounts[0].address,
      blockTag: 'pending',
    });
    record = {
      chainId: 421614,
      rpc,
      account: accounts[0].address,
      nonce,
      state: 'signing',
      mutations: [],
    };
    await save();
    record.deploymentHash = await walletClient(0).deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode.object,
      args: [BigInt(fixture.initialWallsHex), BigInt(fixture.editableMaskHex)],
      nonce,
    });
    record.state = 'pending';
    await save();
  }
  if (!record.deploymentHash)
    throw new Error(
      'Deployment response was lost. Recover the transaction hash in .local/sepolia-deployment.json before continuing; no new deployment was sent.',
    );
  const receipt = await client.waitForTransactionReceipt({
    hash: record.deploymentHash,
    timeout: 60_000,
  });
  if (receipt.status !== 'success' || !receipt.contractAddress)
    throw new Error('Deployment failed; retain its record and inspect the receipt.');
  record.address = receipt.contractAddress;
  record.block = String(receipt.blockNumber);
  record.state = 'deployed';
  record.gasUsed = String(receipt.gasUsed);
  await save();
  await writeFile(
    '.env.local',
    `VITE_RPC_URL=${rpc}\nVITE_CONTRACT_ADDRESS=${record.address}\nVITE_DEPLOYMENT_BLOCK=${record.block}\nVITE_LOCAL=false\n`,
    { mode: 0o600 },
  );
  console.log(`Deployed: https://sepolia.arbiscan.io/address/${record.address}`);
  console.log(`Deployment tx: https://sepolia.arbiscan.io/tx/${record.deploymentHash}`);
  console.log('Public frontend configuration written to .env.local. Restart Vite.');
} else if (command === 'verify') {
  if (!record?.address) throw new Error('Deploy first.');
  const args = encodeAbiParameters(
    [{ type: 'uint64' }, { type: 'uint64' }],
    [BigInt(fixture.initialWallsHex), BigInt(fixture.editableMaskHex)],
  );
  // Blockscout's Arbitrum Sepolia API is blocked by Cloudflare. Sourcify verified the release.
  const result = spawnSync(
    binary('forge'),
    [
      'verify-contract',
      '--root',
      'contracts',
      '--chain',
      '421614',
      '--verifier',
      'sourcify',
      '--constructor-args',
      args,
      '--watch',
      record.address,
      'src/RuinRelay.sol:RuinRelay',
    ],
    { stdio: 'inherit' },
  );
  process.exit(result.status ?? 1);
} else {
  if (!record?.address || !balances.every((balance) => balance > 0n))
    throw new Error('A deployed contract and funded A/B wallets are required.');
  record.mutations ??= [];
  for (const [index, step] of fixture.revisions.entries()) {
    let mutation = record.mutations[index];
    if (!mutation) {
      const [walls, revision] = await client.readContract({
        address: record.address,
        abi: artifact.abi,
        functionName: 'getDungeon',
      });
      if (walls !== BigInt(step.beforeWallsHex) || revision !== BigInt(step.revision))
        throw new Error('Fixture requires a fresh deployment at the expected state.');
      const nonce = await client.getTransactionCount({
        address: accounts[index].address,
        blockTag: 'pending',
      });
      mutation = { nonce, account: accounts[index].address, state: 'signing' };
      record.mutations.push(mutation);
      await save();
      mutation.hash = await walletClient(index).writeContract({
        address: record.address,
        abi: artifact.abi,
        functionName: 'completeAndMutate',
        args: [
          BigInt(step.revision),
          BigInt(step.packedDirectionsHex),
          step.moveCount,
          step.toggleTileIndex,
        ],
        nonce,
      });
      mutation.state = 'pending';
      await save();
    }
    if (!mutation.hash)
      throw new Error('Lost response: recover the recorded nonce’s hash before continuing.');
    const receipt = await client.waitForTransactionReceipt({
      hash: mutation.hash,
      timeout: 60_000,
    });
    if (receipt.status !== 'success') throw new Error('Mutation reverted.');
    const [walls, revision] = await client.readContract({
      address: record.address,
      abi: artifact.abi,
      functionName: 'getDungeon',
      blockNumber: receipt.blockNumber,
    });
    if (walls !== BigInt(step.afterWallsHex) || revision !== BigInt(step.expectedNextRevision))
      throw new Error('Observed state differs from the fixture.');
    Object.assign(mutation, {
      state: 'confirmed',
      block: String(receipt.blockNumber),
      blockHash: receipt.blockHash,
      gasUsed: String(receipt.gasUsed),
    });
    await save();
    console.log(
      `Revision ${revision}: https://sepolia.arbiscan.io/tx/${mutation.hash} (${receipt.gasUsed} gas)`,
    );
  }
  console.log(
    'CLI rehearsal completed. A recorded two-profile browser-wallet demo is still required for release.',
  );
}
