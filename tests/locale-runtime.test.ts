import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleRuntime } from '../src/app/LocaleRuntime';
import { DEFAULT_LOCALE } from '../src/app/Localization';
import { UI_LOCALE_STORAGE_KEY, WebLocaleStore } from '../src/platform/WebLocaleStore';
import { createPlatform } from '../src/platform/createPlatform';
import type { YandexSdk } from '../src/platform/YandexSdkTypes';

afterEach(() => vi.restoreAllMocks());

function storage(saved: string | null = null) {
 const values = new Map<string, string>();
 if (saved !== null) values.set(UI_LOCALE_STORAGE_KEY, saved);
 const io = { getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
 return { values, io, store: new WebLocaleStore(() => io) };
}

describe('SDK language is a startup default, not a saved preference', () => {
 it.each([['ru', 'en'], ['en', 'ru']] as const)('follows SDK %s → %s across launches without writing storage', (first, next) => {
  const f = storage();
  expect(new LocaleRuntime(first, f.store).locale).toBe(first);
  expect(new LocaleRuntime(next, f.store).locale).toBe(next);
  expect(f.io.setItem).not.toHaveBeenCalled();
  expect(f.values.size).toBe(0);
 });
 it.each([
  ['RU-ru', 'ru'], ['en_US', 'en'], ['de', 'en'], ['unknown', 'en'],
  ['', DEFAULT_LOCALE], ['   ', DEFAULT_LOCALE], [undefined, DEFAULT_LOCALE],
 ] as const)('resolves SDK %s to %s without persisting fallback', (language, expected) => {
  const f = storage();
  expect(new LocaleRuntime(language, f.store).locale).toBe(expected);
  expect(f.io.setItem).not.toHaveBeenCalled();
 });
 it('passes the initialized SDK language through createPlatform on each startup', async () => {
  const f = storage();
  for (const language of ['ru', 'en', 'ru']) {
   const sdk: YandexSdk = { environment: { i18n: { lang: language } }, on: vi.fn(), off: vi.fn() };
   const platform = await createPlatform({ isStandalone: false, loadSdk: async () => sdk, fallback: vi.fn() });
   expect(new LocaleRuntime(platform.locale, f.store).locale).toBe(language);
   if ('destroy' in platform) (platform as { destroy(): void }).destroy();
  }
  expect(f.io.setItem).not.toHaveBeenCalled();
 });
});

describe('only a real manual change persists', () => {
 it.each([['ru', 'en'], ['en', 'ru']] as const)('switches %s → %s live, once, and overrides SDK on reload', (initial, selected) => {
  const f = storage(), runtime = new LocaleRuntime(initial, f.store), changed = vi.fn();
  runtime.subscribe(changed);
  runtime.set(initial);
  expect(f.io.setItem).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  runtime.set(selected);
  expect(runtime.locale).toBe(selected);
  expect(runtime.t('settings')).toBe(selected === 'ru' ? 'Настройки' : 'Settings');
  expect(f.io.setItem).toHaveBeenCalledTimes(1);
  expect(f.io.setItem).toHaveBeenCalledWith(UI_LOCALE_STORAGE_KEY, selected);
  expect(changed).toHaveBeenCalledOnce();
  runtime.set(selected);
  expect(f.io.setItem).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(new LocaleRuntime(initial, f.store).locale).toBe(selected);
 });
 it.each(['ru', 'en'] as const)('preserves historical %s without guessing its origin or rewriting it', saved => {
  const f = storage(saved), before = new Map(f.values);
  const runtime = new LocaleRuntime(saved === 'ru' ? 'en' : 'ru', f.store);
  expect(runtime.locale).toBe(saved);
  runtime.set(saved);
  expect(f.values).toEqual(before);
  expect(f.io.setItem).not.toHaveBeenCalled();
 });
 it.each(['fr', '{"locale":"ru"}', 'null', ''])('ignores invalid historical value %s without destructive migration', saved => {
  const f = storage(saved);
  expect(new LocaleRuntime('en', f.store).locale).toBe('en');
  expect(f.values.get(UI_LOCALE_STORAGE_KEY)).toBe(saved);
  expect(f.io.setItem).not.toHaveBeenCalled();
 });
 it('changes only the locale key and preserves classic, orders, audio and unrelated entries', () => {
  const f = storage('ru');
  for (const key of ['block-workshop:lastGame', 'block-workshop:bestScore', 'block-workshop:campaign:v2', 'block-workshop:audio-settings', 'other-app'])
   f.values.set(key, 'unchanged');
  const before = new Map(f.values);
  new LocaleRuntime('en', f.store).set('en');
  before.set(UI_LOCALE_STORAGE_KEY, 'en');
  expect(f.values).toEqual(before);
 });
});

describe('unavailable browser storage', () => {
 it.each(['null', 'getter', 'read', 'write'] as const)('keeps startup and live language usable on %s failure', failure => {
  const f = storage();
  if (failure === 'read') f.io.getItem.mockImplementation(() => { throw Error('denied'); });
  if (failure === 'write') f.io.setItem.mockImplementation(() => { throw Error('quota'); });
  const store = new WebLocaleStore(() => {
   if (failure === 'getter') throw Error('denied');
   return failure === 'null' ? null : f.io;
  });
  const runtime = new LocaleRuntime('en', store), changed = vi.fn();
  runtime.subscribe(changed);
  expect(runtime.locale).toBe('en');
  expect(f.io.setItem).not.toHaveBeenCalled();
  expect(() => runtime.set('ru')).not.toThrow();
  expect(runtime.locale).toBe('ru');
  expect(changed).toHaveBeenCalledOnce();
 });
});
