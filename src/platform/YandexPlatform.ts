import type { PlatformService } from "./PlatformService.js";
import type { YandexSdk } from "./YandexSdkTypes.js";

/** SDK lifecycle listeners are attached before the game and audio are constructed. */
export class YandexPlatform implements PlatformService {
  readonly id = "yandex" as const;
  readonly displayName = "Yandex Games";
  readonly locale: string;
  private readySent = false;
  private gameplayActive = false;
  private paused = false;
  private readonly pauseListeners = new Set<() => void>();
  private readonly resumeListeners = new Set<() => void>();

  constructor(private readonly sdk: YandexSdk) {
    this.locale = sdk.environment?.i18n?.lang ?? "ru";
    sdk.on("game_api_pause", this.handlePause);
    sdk.on("game_api_resume", this.handleResume);
  }

  get isPaused(): boolean { return this.paused; }

  ready(): void {
    if (this.readySent) return;
    this.readySent = true;
    this.sdk.features?.LoadingAPI?.ready();
  }

  setGameplayActive(active: boolean): void {
    if (this.gameplayActive === active) return;
    this.gameplayActive = active;
    if (active) this.sdk.features?.GameplayAPI?.start();
    else this.sdk.features?.GameplayAPI?.stop();
  }

  showInterstitial(onOpen?: () => void): Promise<boolean> {
    if (!this.sdk.adv?.showFullscreenAdv) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let callbacksDone = false;
      let wasShown = false;
      let watchdog: ReturnType<typeof setTimeout> | null = null;

      const clearWatchdog = (): void => {
        if (watchdog !== null) clearTimeout(watchdog);
        watchdog = null;
      };
      const settle = (): void => {
        if (settled || !callbacksDone) return;
        settled = true;
        clearWatchdog();
        console.info("[Block SDK] interstitial_navigation_unblocked");
        resolve(wasShown);
      };
      // Advertising callbacks own navigation completion. SDK pause/resume
      // independently controls game input, timers, tweens and audio.
      // Delaying this promise until game_api_resume traps the user's chosen
      // action on Complete even after the advertisement visibly closes.
      const finishCallbacks = (shown: boolean): void => {
        if (callbacksDone) return;
        callbacksDone = true;
        wasShown = shown;
        clearWatchdog();
        if (this.paused) {
          console.info("[Block SDK] interstitial_closed_sdk_still_paused");
        }
        settle();
      };

      watchdog = setTimeout(() => {
        console.warn("[Block SDK] interstitial_no_callback");
        finishCallbacks(false);
      }, 15000);
      try {
        this.sdk.adv!.showFullscreenAdv({
          callbacks: {
          onOpen: () => {
            if (callbacksDone) return;
            console.info("[Block SDK] interstitial_open");
            // Tell the game only when a real ad starts, not on button press.
            try { onOpen?.(); } catch (error) {
              console.warn("[Block SDK] interstitial_open_listener_failed", error);
            }
            clearWatchdog();
            watchdog = setTimeout(() => {
              console.warn("[Block SDK] interstitial_close_timeout");
              finishCallbacks(false);
            }, 120000);
          },
          onClose: (shown) => {
            console.info("[Block SDK] interstitial_close", shown);
            finishCallbacks(shown === true);
          },
          onError: (error) => {
            console.warn("[Block SDK] interstitial_error", error);
            finishCallbacks(false);
          },
          },
        });
      } catch (error) {
        console.warn("[Block SDK] interstitial_throw", error);
        finishCallbacks(false);
      }
    });
  }

  showRewarded(): Promise<boolean> {
    if (!this.sdk.adv?.showRewardedVideo) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let rewarded = false;
      let watchdog: ReturnType<typeof setTimeout> | null = null;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (watchdog !== null) clearTimeout(watchdog);
        console.info("[Block SDK] rewarded_hint_complete", rewarded);
        resolve(rewarded);
      };
      watchdog = setTimeout(() => {
        console.warn("[Block SDK] rewarded_hint_timeout");
        finish();
      }, 120000);
      try {
        this.sdk.adv!.showRewardedVideo({
          callbacks: {
            onOpen: () => console.info("[Block SDK] rewarded_hint_open"),
            onRewarded: () => {
              if (settled) return;
              rewarded = true;
              console.info("[Block SDK] rewarded_hint_granted");
            },
            onClose: finish,
            onError: (error) => {
              console.warn("[Block SDK] rewarded_hint_error", error);
              finish();
            },
          },
        });
      } catch (error) {
        console.warn("[Block SDK] rewarded_hint_throw", error);
        finish();
      }
    });
  }

  onPause(listener: () => void): () => void {
    this.pauseListeners.add(listener);
    if (this.paused) listener();
    return () => { this.pauseListeners.delete(listener); };
  }

  onResume(listener: () => void): () => void {
    this.resumeListeners.add(listener);
    return () => { this.resumeListeners.delete(listener); };
  }

  destroy(): void {
    this.setGameplayActive(false);
    this.sdk.off("game_api_pause", this.handlePause);
    this.sdk.off("game_api_resume", this.handleResume);
    this.pauseListeners.clear();
    this.resumeListeners.clear();
  }

  private readonly handlePause = (): void => {
    if (this.paused) return;
    this.paused = true;
    for (const listener of this.pauseListeners) listener();
  };

  private readonly handleResume = (): void => {
    if (!this.paused) return;
    this.paused = false;
    for (const listener of this.resumeListeners) listener();
  };
}
