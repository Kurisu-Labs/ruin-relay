import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  // Software WebGL needs more time than the former sprite renderer.
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    // Functional flows use static rendering; three.spec also covers ordinary animation.
    reducedMotion: 'reduce',
    // Continuous trace screencasts stall software WebGL. Preserve DOM/network evidence.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run local',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
