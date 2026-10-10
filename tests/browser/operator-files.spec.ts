import { writeFile, unlink } from 'node:fs/promises';
import { test, expect } from './helpers';

test('operator files are denied by the development server', async ({ request }) => {
  const file = '.local/operator-file-canary.txt';
  await writeFile(file, 'A disposable canary, not a private key.');
  try {
    const response = await request.head('/.local/operator-file-canary.txt');
    expect(response.status()).toBe(403);
    const absolute = await request.head(`/@fs/${process.cwd()}/.local/operator-file-canary.txt`);
    expect(absolute.status()).toBe(403);
  } finally {
    await unlink(file);
  }
});
