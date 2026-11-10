export type PlatformId = "web" | "yandex";

export interface PlatformService {
  readonly id: PlatformId;
  readonly displayName: string;
  readonly locale: string;
  readonly isPaused: boolean;
  /** Signals that a playable scene has finished its first render. */
  ready(): void;
  setGameplayActive(active: boolean): void;
  /** Resolves true only when a fullscreen interstitial was actually shown. */
  showInterstitial(onOpen?: () => void): Promise<boolean>;
  /** True only when the video explicitly granted its reward. */
  showRewarded(): Promise<boolean>;
  onPause(handler: () => void): () => void;
  onResume(handler: () => void): () => void;
}
