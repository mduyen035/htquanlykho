import { defineConfig } from '@playwright/test';
const port = Number(process.env.E2E_PORT || 5173);
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
  reporter: 'list',
});
