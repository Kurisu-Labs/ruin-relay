import { readFile, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
const artifact = JSON.parse(await readFile('contracts/out/RuinRelay.sol/RuinRelay.json', 'utf8'));
await writeFile(
  'src/config/abi.ts',
  await format(
    `// Generated from Solidity 0.8.24 by npm run abi.\nexport const abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
    { ...(await resolveConfig('src/config/abi.ts')), parser: 'typescript' },
  ),
);
