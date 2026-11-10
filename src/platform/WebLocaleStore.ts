import { DEFAULT_LOCALE, type SupportedLocale } from "../app/Localization.js";

export const UI_LOCALE_STORAGE_KEY = "block-workshop:ui-locale";
type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

export class WebLocaleStore {
  constructor(
    private readonly getStorage: () => LocaleStorage | null =
      () => typeof localStorage !== "undefined" ? localStorage : null,
  ) {}

  load(): SupportedLocale | null {
    try {
      const saved = this.getStorage()?.getItem(UI_LOCALE_STORAGE_KEY);
      return saved === "ru" || saved === "en" ? saved : null;
    } catch {
      return null;
    }
  }

  /** Returns false if storage is unavailable; never claim a persisted change then. */
  save(locale: SupportedLocale): boolean {
    try {
      const storage = this.getStorage();
      if (!storage) return false;
      storage.setItem(UI_LOCALE_STORAGE_KEY, locale);
      return true;
    } catch {
      return false;
    }
  }
}

/** Respect saved language before the platform locale. */
export const resolveStartupLocale = (
  storedLocale: SupportedLocale | null, platformLanguage?: string,
): SupportedLocale => {
  // Respect a manually saved language. On Yandex, an unsupported portal
  // language uses English as the available international fallback.
  const sdkLanguage = platformLanguage?.trim().toLowerCase().split(/[-_]/, 1)[0];
  const sdkLocale = sdkLanguage === "ru" ? "ru" : sdkLanguage ? "en" : null;
  return storedLocale ?? sdkLocale ?? DEFAULT_LOCALE;
};
