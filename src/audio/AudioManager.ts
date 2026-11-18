import { createAudioSettings, type AudioSettings } from "./AudioSettings.js";
import { AUDIO_EFFECTS, AUDIO_EFFECT_GAIN, AUDIO_MUSIC, type AudioEffect } from "./AudioAssetManifest.js";

export interface AudioSettingsRepository {
  load(): AudioSettings;
  save(settings: AudioSettings): void;
}

/** Injectable playback seam. Browser implementation owns HTMLAudioElement lifetimes. */
export interface AudioOutput {
  /** AudioContext resume must happen within the trusted user gesture. */
  onUserGesture?(): void;
  /** Suspend Web Audio and any effect fallback when hidden or advertising. */
  setEffectsActive?(active: boolean): void;
  playEffect(path: string, volume: number): void;
  startMusic(path: string, volume: number): void;
  setMusicVolume(volume: number): void;
  pauseMusic(): void;
  resumeMusic(): void;
  stopMusic(): void;
}

type MusicStatus = "idle" | "playing" | "paused";

/**
 * Game-wide controller, not tied to Phaser scenes.
 * No playback is attempted until a user gesture calls unlock().
 */
export class AudioManager {
  private settings: AudioSettings;
  private unlocked = false;
  private pageVisible = true;
  private adActive = false;
  private status: MusicStatus = "idle";
  private readonly lastEffectAt = new Map<AudioEffect, number>();
  private disposed = false;

  constructor(
    private readonly output: AudioOutput,
    private readonly repository: AudioSettingsRepository,
    private readonly now: () => number = () => Date.now(),
  ) {
    const saved = repository.load();
    this.settings = createAudioSettings(saved.musicVolume, saved.sfxVolume);
  }

  getSettings(): AudioSettings { return this.settings; }

  setMusicVolume(volume: number): void {
    if (this.disposed) return;
    this.settings = createAudioSettings(volume, this.settings.sfxVolume);
    this.repository.save(this.settings);
    this.syncMusic();
  }

  setSfxVolume(volume: number): void {
    if (this.disposed) return;
    this.settings = createAudioSettings(this.settings.musicVolume, volume);
    this.repository.save(this.settings);
    this.syncEffects();
  }

  unlock(): void {
    if (this.disposed) return;
    // Capture phase arms playback before the scene handles the gesture.
    const firstUnlock = !this.unlocked;
    this.unlocked = true;
    this.syncEffects();
    if (firstUnlock) {
      this.output.onUserGesture?.();
      this.syncMusic();
    } else {
      this.retryPlaybackFromGesture();
    }
  }

  /** Retry browser-blocked Web Audio and music within a user activation. */
  retryPlaybackFromGesture(): void {
    if (this.disposed || !this.unlocked || !this.pageVisible || this.adActive) return;
    this.output.onUserGesture?.();
    if (this.status === "playing" && this.settings.musicVolume > 0) this.output.resumeMusic();
  }

  setPageVisible(visible: boolean): void {
    if (this.disposed) return;
    this.pageVisible = visible;
    this.syncEffects();
    this.syncMusic();
  }

  setAdActive(active: boolean): void {
    if (this.disposed) return;
    this.adActive = active;
    this.syncEffects();
    this.syncMusic();
  }

  playEffect(effect: AudioEffect): void {
    if (this.disposed || !this.unlocked || !this.pageVisible || this.adActive || this.settings.sfxVolume === 0) return;
    const time = this.now();
    const previous = this.lastEffectAt.get(effect);
    // Reject rapid same-effect bursts without delaying the input or graphics.
    if (previous !== undefined && time >= previous && time - previous < 50) return;
    this.lastEffectAt.set(effect, time);
    this.output.playEffect(AUDIO_EFFECTS[effect], this.settings.sfxVolume * AUDIO_EFFECT_GAIN[effect]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.output.setEffectsActive?.(false);
    this.output.stopMusic();
    this.status = "idle";
  }

  private syncEffects(): void {
    this.output.setEffectsActive?.(
      !this.disposed && this.unlocked && this.pageVisible && !this.adActive && this.settings.sfxVolume > 0,
    );
  }

  private syncMusic(): void {
    const allowed = this.unlocked && this.pageVisible && !this.adActive && this.settings.musicVolume > 0;
    if (!allowed) {
      if (this.status === "playing") {
        this.output.pauseMusic();
        this.status = "paused";
      }
      return;
    }
    if (this.status === "idle") {
      this.status = "playing";
      this.output.startMusic(AUDIO_MUSIC, this.settings.musicVolume);
    } else {
      this.output.setMusicVolume(this.settings.musicVolume);
      if (this.status === "paused") {
        this.output.resumeMusic();
        this.status = "playing";
      }
    }
  }
}
