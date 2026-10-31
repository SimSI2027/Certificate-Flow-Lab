import { defineConfig } from '@playwright/test';

// Uses the locally installed Microsoft Edge (no browser download required).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5183', channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npx vite --port 5183 --strictPort', url: 'http://127.0.0.1:5183', reuseExistingServer: true, timeout: 60000 }
});
