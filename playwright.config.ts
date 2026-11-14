import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/e2e', fullyParallel: false, workers: 1,
 // Hosted Chromium software WebGL is slower with all raster surfaces enabled.
 // Preserve assertion limits; budget only complete browser journeys.
 timeout: 90_000,
 forbidOnly: !!process.env['CI'], retries: process.env['CI'] ? 1 : 0, reporter: 'list',
 use: {
  baseURL: 'http://127.0.0.1:4180',
  // Recording a screenshot after every simulated pointer step forces expensive
  // software-WebGL readbacks on hosted Chromium with the complete raster pack.
  // Capture an actionable trace on retry; retain failure screenshots separately.
  trace: { mode: 'on-first-retry', screenshots: false, snapshots: true },
  screenshot: 'only-on-failure',
 },
 projects: [
  { name: 'chromium', use: { browserName: 'chromium' } },
  { name: 'firefox', use: { browserName: 'firefox' } },
  { name: 'webkit', use: { browserName: 'webkit' } },
 ],
 webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4180', url:'http://127.0.0.1:4180',reuseExistingServer:!process.env['CI'], timeout:30000 },
});
