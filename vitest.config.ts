import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
    environmentOptions: {
      // jsdom only initialises a real Storage when given an http(s) URL.
      // The default ("about:blank") produces a stub without prototype
      // methods — see https://github.com/jsdom/jsdom/issues/2304.
      jsdom: { url: 'http://localhost/' },
    },
  },
});
