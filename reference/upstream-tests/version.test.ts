import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { APP_VERSION, createVersionBadge } from '../src/version';
import { readCss } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));

describe('APP_VERSION', () => {
  it('is "v" + iteration, optionally + a minor patch', () => {
    expect(APP_VERSION).toMatch(/^v\d+(?:\.\d+)?$/);
  });

  it('its iteration component matches the latest docs/iterations entry', () => {
    const iterDir = resolve(here, '../docs/iterations');
    const latest = readdirSync(iterDir)
      .map((f) => /^(\d+)-/.exec(f)?.[1])
      .filter((n): n is string => n != null)
      .map(Number)
      .reduce((a, b) => Math.max(a, b), 0);
    const iteration = Number(/^v(\d+)/.exec(APP_VERSION)?.[1]);
    expect(iteration).toBe(latest);
  });
});

describe('createVersionBadge()', () => {
  it('renders a decorative .version element showing APP_VERSION', () => {
    const el = createVersionBadge();
    expect(el.classList.contains('version')).toBe(true);
    expect(el.textContent).toBe(APP_VERSION);
    // Decorative + never a touch obstacle.
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('version.css — safe-area placement', () => {
  let css = '';
  beforeAll(() => {
    css = readCss('version.css');
  });

  it('anchors within the safe box (bottom/right fold env insets)', () => {
    expect(css).toMatch(
      /bottom:\s*max\(\s*var\(--screen-pad\)\s*,\s*env\(safe-area-inset-bottom\)\s*\)/,
    );
    expect(css).toMatch(
      /right:\s*max\(\s*var\(--screen-pad\)\s*,\s*env\(safe-area-inset-right\)\s*\)/,
    );
  });

  it('never blocks pointer input', () => {
    expect(css).toMatch(/pointer-events:\s*none/);
  });
});
