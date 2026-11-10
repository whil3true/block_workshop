import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

let indexHtml = '';
let viteConfig = '';

beforeAll(() => {
  indexHtml = readFileSync(resolve(root, 'index.html'), 'utf-8');
  viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf-8');
});

describe('PWA — index.html', () => {
  it('declares an apple-touch-icon for iOS home screen', () => {
    expect(indexHtml).toMatch(
      /<link\s+rel="apple-touch-icon"\s+href="\/icons\/apple-touch-icon\.png"/,
    );
  });

  it('declares theme-color #0F172A', () => {
    expect(indexHtml).toMatch(
      /<meta\s+name="theme-color"\s+content="#0F172A"/i,
    );
  });

  it('declares apple-mobile-web-app-capable so iOS launches full-screen', () => {
    expect(indexHtml).toMatch(/apple-mobile-web-app-capable/);
  });

  it('uses viewport-fit=cover so env() safe-area insets resolve (SPEC §8.9)', () => {
    expect(indexHtml).toMatch(/viewport-fit\s*=\s*cover/);
  });
});

describe('PWA — vite.config.ts', () => {
  it('imports VitePWA from vite-plugin-pwa', () => {
    expect(viteConfig).toMatch(/from\s+['"]vite-plugin-pwa['"]/);
    expect(viteConfig).toMatch(/VitePWA\(/);
  });

  it('registers as autoUpdate', () => {
    expect(viteConfig).toMatch(/registerType:\s*['"]autoUpdate['"]/);
  });

  it('names the app "10Block"', () => {
    expect(viteConfig).toMatch(/name:\s*['"]10Block['"]/);
  });

  it('declares both 192 and 512 icons', () => {
    expect(viteConfig).toMatch(/icon-192\.png/);
    expect(viteConfig).toMatch(/icon-512\.png/);
  });

  it('uses theme_color and background_color #0F172A', () => {
    expect(viteConfig).toMatch(/theme_color:\s*['"]#0F172A['"]/);
    expect(viteConfig).toMatch(/background_color:\s*['"]#0F172A['"]/);
  });

  it('Workbox glob includes mp3 so the SFX precache for offline play', () => {
    expect(viteConfig).toMatch(/globPatterns/);
    expect(viteConfig).toMatch(/mp3/);
  });
});

describe('PWA — icon files', () => {
  it('has a source SVG', () => {
    expect(existsSync(resolve(root, 'public/icons/icon.svg'))).toBe(true);
  });

  for (const file of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    it(`has a generated ${file}`, () => {
      const path = resolve(root, 'public/icons', file);
      expect(existsSync(path), `${file} should exist`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);
    });
  }
});
