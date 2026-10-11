// Local operator helper. Signing stays in the operator's browser wallet.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createPublicClient, encodeDeployData, getAddress, http, toHex } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { binary } from './foundry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: {
    account: { type: 'string' },
    port: { type: 'string', default: '4174' },
    rpc: { type: 'string', default: arbitrumSepolia.rpcUrls.default.http[0] },
    'recover-rejected-nonce': { type: 'string' },
  },
});
if (!values.account) throw new Error('Pass --account <public deployer address>.');
const account = getAddress(values.account);
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
const build = spawnSync(binary('forge'), ['build', '--root', 'contracts'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);
const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(values.rpc, { timeout: 15000, retryCount: 0 }),
});
if ((await client.getChainId()) !== 421614)
  throw new Error('RPC must be Arbitrum Sepolia (421614).');
const artifact = JSON.parse(
  await readFile(new URL('../contracts/out/RuinRelay.sol/RuinRelay.json', import.meta.url), 'utf8'),
);
const fixture = JSON.parse(
  await readFile(new URL('../reference/fixtures.json', import.meta.url), 'utf8'),
);
const config = {
  chainId: 421614,
  compiler: '0.8.24',
  optimizerRuns: 200,
  evmVersion: 'cancun',
  constructor: { initialWalls: fixture.initialWallsHex, editableMask: fixture.editableMaskHex },
  walletRequest: {
    method: 'eth_sendTransaction',
    params: [
      {
        from: account,
        chainId: toHex(421614),
        value: '0x0',
        data: encodeDeployData({
          abi: artifact.abi,
          bytecode: artifact.bytecode.object,
          args: [BigInt(fixture.initialWallsHex), BigInt(fixture.editableMaskHex)],
        }),
      },
    ],
  },
};
if (values['recover-rejected-nonce'] !== undefined) {
  if (!/^\d+$/.test(values['recover-rejected-nonce'])) throw new Error('Invalid rejected nonce.');
  const nonce = Number(values['recover-rejected-nonce']);
  if (!Number.isSafeInteger(nonce)) throw new Error('Invalid rejected nonce.');
  const [latest, pending] = await Promise.all([
    client.getTransactionCount({ address: account, blockTag: 'latest' }),
    client.getTransactionCount({ address: account, blockTag: 'pending' }),
  ]);
  if (latest !== nonce || pending !== nonce)
    throw new Error(
      'Rejected nonce is no longer unused. Inspect wallet/explorer evidence; recovery remains locked.',
    );
  config.recovery = {
    nonce,
    reason: 'Operator confirmed a fee-below-base-fee rejection with no pending transaction.',
  };
}
const html = await readFile(new URL('./browser-deploy.html', import.meta.url));
const server = createServer((request, response) => {
  const routes = {
    '/': ['text/html', html],
    '/unsigned-deployment.json': ['application/json', JSON.stringify(config)],
  };
  const route = Object.hasOwn(routes, request.url) && routes[request.url];
  if (request.method !== 'GET' || !route) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': route[0] + '; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
  });
  response.end(route[1]);
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Firefox deployment page: http://127.0.0.1:${port}/`),
);
