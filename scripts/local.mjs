import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { binary } from './foundry.mjs';

const build = spawnSync(binary('forge'), ['build', '--root', 'contracts'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const port = Number(process.env.ANVIL_PORT ?? 8545);
const rpc = `http://127.0.0.1:${port}`;
const anvil = spawn(
  binary('anvil'),
  ['--port', String(port), '--chain-id', '421614', '--order', 'fifo', '--silent'],
  { stdio: 'inherit' },
);
let vite;
const stop = () => {
  vite?.kill();
  anvil.kill();
};
process.on('SIGINT', () => {
  stop();
  process.exit();
});
process.on('SIGTERM', () => {
  stop();
  process.exit();
});
anvil.on('exit', (code) => {
  if (code) {
    stop();
    process.exit(code);
  }
});
const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(rpc, { retryCount: 0 }),
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await client.getBlockNumber();
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error('Anvil did not start');
  const [account] = await client.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) });
  const artifact = JSON.parse(await readFile('contracts/out/RuinRelay.sol/RuinRelay.json', 'utf8'));
  const fixture = JSON.parse(await readFile('reference/fixtures.json', 'utf8'));
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [BigInt(fixture.initialWallsHex), BigInt(fixture.editableMaskHex)],
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  await mkdir('.local', { recursive: true });
  await writeFile(
    '.local/deployment.json',
    JSON.stringify({ address: receipt.contractAddress, block: String(receipt.blockNumber), rpc }),
  );
  vite = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      process.env.PORT ?? '4173',
      '--strictPort',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_RPC_URL: rpc,
        VITE_CONTRACT_ADDRESS: receipt.contractAddress,
        VITE_DEPLOYMENT_BLOCK: String(receipt.blockNumber),
        VITE_LOCAL: 'true',
      },
    },
  );
  vite.on('exit', (code) => {
    anvil.kill();
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error);
  stop();
  process.exit(1);
}
