// The upstream npm wrapper does not forward child exit codes; CI must fail on a failing forge test.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
export function binary(tool) {
  const platform = process.platform === 'win32' ? 'win32' : process.platform;
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  return require.resolve(
    `@foundry-rs/${tool}-${platform}-${arch}/bin/${tool}${platform === 'win32' ? '.exe' : ''}`,
  );
}
if (process.argv[1]?.endsWith('/foundry.mjs')) {
  const result = spawnSync(binary(process.argv[2]), process.argv.slice(3), { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
