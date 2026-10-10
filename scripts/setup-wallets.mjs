import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const directory = new URL('../.local/', import.meta.url);
const file = new URL('sepolia-wallets.json', directory);
await mkdir(directory, { recursive: true, mode: 0o700 });
let wallets;
try {
  wallets = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  wallets = ['A', 'B'].map((name) => {
    const privateKey = generatePrivateKey();
    return { name, address: privateKeyToAccount(privateKey).address, privateKey };
  });
  await writeFile(file, JSON.stringify(wallets, null, 2), { mode: 0o600, flag: 'wx' });
}
for (const wallet of wallets) console.log(`Sepolia wallet ${wallet.name}: ${wallet.address}`);
console.log('Private keys stay in .local/sepolia-wallets.json (mode 600, excluded from Git).');
