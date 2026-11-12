import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "./AudioSettings.js";
import type { AudioEffect } from "./AudioAssetManifest.js";
import type { AudioManager } from "./AudioManager.js";

/** Bootstrap-owned service, intentionally accessed without rebuilding every Phaser Scene. */
let activeManager: AudioManager | null = null;

export const configureAudioRuntime = (manager: AudioManager | null): void => {
  activeManager = manager;
};

/** An absent audio service is silent, never a gameplay error (e.g. isolated scene tests). */
export const playAudioEffect = (effect: AudioEffect): void => {
  activeManager?.playEffect(effect);
};

/** Shared across all scenes; the manager retains changes if browser storage is blocked. */
export const getAudioSettings = (): AudioSettings =>
  activeManager?.getSettings() ?? DEFAULT_AUDIO_SETTINGS;

export const setMusicVolume = (value: number): void => { activeManager?.setMusicVolume(value); };
export const setSfxVolume = (value: number): void => { activeManager?.setSfxVolume(value); };
