import type { PlatformService } from "./PlatformService.js";

export const INTERSTITIAL_COOLDOWN_MS = 90_000;
export const INTERSTITIAL_RETRY_MS = 15_000;

/** Shares frequency limits across navigation and completed-placement boundaries. */
export class InterstitialController {
  private lastShownAt: number;
  private lastAttemptAt: number | null = null;
  private pending = false;
  private revision = 0;
  get shownRevision(): number { return this.revision; }
  /** Fullscreen and rewarded completion share the same frequency window. */
  recordShown(): void { this.lastShownAt = this.now(); this.revision++; }
  get eligible(): boolean {
    const time = this.now();
    return this.platform.id === 'yandex' && !this.pending
      && time - this.lastShownAt >= INTERSTITIAL_COOLDOWN_MS
      && (this.lastAttemptAt === null || time - this.lastAttemptAt >= INTERSTITIAL_RETRY_MS);
  }

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
      let opened = false;
      const shown = await this.platform.showInterstitial(() => { if (opened) return; opened = true; onOpen?.(); });
      if (shown || opened) this.recordShown();
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
