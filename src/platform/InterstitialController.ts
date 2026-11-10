import type { PlatformService } from "./PlatformService.js";

export const INTERSTITIAL_COOLDOWN_MS = 90_000;
export const INTERSTITIAL_RETRY_MS = 15_000;

/** Keeps adverts tied to an intentional level boundary, never to a timer. */
export class InterstitialController {
  private lastShownAt: number;
  private lastAttemptAt: number | null = null;
  private pending = false;

  constructor(
    private readonly platform: Pick<PlatformService, "id" | "showInterstitial">,
    private readonly now: () => number = () => Date.now(),
  ) {
    // The portal may have shown a non-queryable automatic startup advert.
    this.lastShownAt = this.now();
  }

  async tryShow(onOpen?: () => void): Promise<boolean> {
    const time = this.now();
    if (this.platform.id !== "yandex") return false;
    if (this.pending) return false;
    if (time - this.lastShownAt < INTERSTITIAL_COOLDOWN_MS) {
      console.info("[Block SDK] interstitial_skipped:cooldown", INTERSTITIAL_COOLDOWN_MS - (time - this.lastShownAt));
      return false;
    }
    if (this.lastAttemptAt !== null && time - this.lastAttemptAt < INTERSTITIAL_RETRY_MS) {
      console.info("[Block SDK] interstitial_skipped:retry", INTERSTITIAL_RETRY_MS - (time - this.lastAttemptAt));
      return false;
    }
    this.lastAttemptAt = time;
    this.pending = true;
    console.info("[Block SDK] interstitial_request");
    try {
      const shown = await this.platform.showInterstitial(onOpen);
      if (shown) this.lastShownAt = this.now();
      else console.info("[Block SDK] interstitial_not_shown");
      return shown;
    } catch (error) {
      console.warn("[Block SDK] interstitial_request_failed", error);
      return false;
    } finally {
      this.pending = false;
    }
  }
}
