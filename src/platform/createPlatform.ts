import type { PlatformService } from "./PlatformService.js";
import { WebPlatform } from "./WebPlatform.js";
import { YandexPlatform } from "./YandexPlatform.js";
import type { YandexGamesGlobal, YandexSdk } from "./YandexSdkTypes.js";

export const YANDEX_SDK_PATH = "/sdk.js";
export const SDK_SCRIPT_TIMEOUT_MS = 7000;
export const SDK_INIT_TIMEOUT_MS = 12000;

/** Only known standalone hosts may launch without the required platform SDK. */
export const isStandaloneHost = (hostname: string, explicitDevHosts: readonly string[] = []): boolean => {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
    || host === "whil3true.github.io" || explicitDevHosts.some(value => value.trim().toLowerCase() === host);
};

/** Load the official SDK from the hosting portal before calling YaGames.init(). */
export const loadYandexSdk = async (
  win: Window = window, doc: Document = document,
): Promise<YandexSdk> => {
  const global = win as Window & { YaGames?: YandexGamesGlobal };
  if (!global.YaGames) {
    await new Promise<void>((resolve, reject) => {
      const script = doc.createElement("script");
      script.src = YANDEX_SDK_PATH;
      script.async = true;
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve();
      };
      const timer = setTimeout(() => finish(Error("Yandex SDK script load timed out")), SDK_SCRIPT_TIMEOUT_MS);
      script.onload = () => finish();
      script.onerror = () => finish(Error("Yandex SDK script unavailable"));
      (doc.head ?? doc.body).appendChild(script);
    });
  }
  if (!global.YaGames) throw Error("Yandex SDK loaded but YaGames is missing");

  return await new Promise<YandexSdk>((resolve, reject) => {
    let settled = false;
    const finish = (sdk?: YandexSdk, error?: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (sdk) resolve(sdk);
      else reject(error ?? Error("Yandex SDK init returned no instance"));
    };
    const timer = setTimeout(() => finish(undefined, Error("Yandex SDK initialization timed out")), SDK_INIT_TIMEOUT_MS);
    try {
      void global.YaGames!.init().then(
        (sdk) => finish(sdk),
        (error: unknown) => finish(undefined, error),
      );
    } catch (error) { finish(undefined, error); }
  });
};

export interface CreatePlatformOptions {
  readonly isStandalone: boolean;
  readonly loadSdk: () => Promise<YandexSdk>;
  readonly fallback: () => PlatformService;
}

export const createPlatform = async (options: CreatePlatformOptions = {
  isStandalone: isStandaloneHost(window.location.hostname,
    import.meta.env.DEV ? (import.meta.env.VITE_STANDALONE_HOSTS ?? "").split(",") : []),
  loadSdk: () => loadYandexSdk(),
  fallback: () => new WebPlatform(),
}): Promise<PlatformService> => {
  if (options.isStandalone) return options.fallback();
  return new YandexPlatform(await options.loadSdk());
};
