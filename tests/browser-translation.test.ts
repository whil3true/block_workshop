import { describe, it, expect } from 'vitest';
import { readSrc } from './helpers';

describe('browser translation protection', () => {
  const html = new DOMParser().parseFromString(readSrc('index.html'), 'text/html');

  it('opts out of automated translation for the HTML document', () => {
    expect(html.documentElement.getAttribute('lang')).toBe('ru');
    expect(html.documentElement.getAttribute('translate')).toBe('no');
    expect(html.documentElement.classList.contains('notranslate')).toBe(true);
    expect(html.querySelector('meta[name="google"]')?.getAttribute('content')).toBe('notranslate');
  });

  it('protects the localized game UI including dynamically added buttons', () => {
    const app = html.querySelector('#app');
    expect(app?.getAttribute('translate')).toBe('no');
    expect(app?.classList.contains('notranslate')).toBe(true);
  });
});
