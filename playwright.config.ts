import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/e2e', fullyParallel: false, workers: 1,
 // Software WebGL on hosted Chromium makes a multi-reload user journey exceed 30s.
 // Individual assertions retain their normal short polling deadlines.
 timeout: 60_000,
 forbidOnly: !!process.env['CI'], retries: process.env['CI'] ? 1 : 0, reporter: 'list',
 use: { baseURL: 'http://127.0.0.1:4180', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
 projects: [
  { name: 'chromium', use: { browserName: 'chromium' } },
  { name: 'firefox', use: { browserName: 'firefox' } },
  { name: 'webkit', use: { browserName: 'webkit' } },
 ],
 webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4180', url:'http://127.0.0.1:4180',reuseExistingServer:!process.env['CI'], timeout:30000 },
});
