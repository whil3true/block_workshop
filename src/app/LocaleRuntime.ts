import { resolveStartupLocale, WebLocaleStore } from '../platform/WebLocaleStore';
import { words, type SupportedLocale, type Word } from './Localization';
export class LocaleRuntime {
 private listeners = new Set<() => void>();
 locale: SupportedLocale;
 constructor(language?: string, private store = new WebLocaleStore()) { this.locale = resolveStartupLocale(store.load(), language); }
 t(key: Word): string { return words[this.locale][key]; }
 set(locale: SupportedLocale): void { this.locale = locale; this.store.save(locale); for (const f of this.listeners) f(); }
 subscribe(f: () => void): () => void { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
}
