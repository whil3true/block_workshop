import {
  DEFAULT_AUDIO_SETTINGS, parseAudioSettings, serializeAudioSettings, type AudioSettings,
} from "../audio/AudioSettings.js";

/** Separate key: resetting or saving campaign progress must not touch audio preferences. */
export const AUDIO_SETTINGS_STORAGE_KEY = "block-workshop:audio-settings";

export interface AudioSettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class WebAudioSettingsStore {
  constructor(private readonly getStorage: () => AudioSettingsStorageLike = () => window.localStorage) {}

  load(): AudioSettings {
    try {
      const raw = this.getStorage().getItem(AUDIO_SETTINGS_STORAGE_KEY);
      return raw === null ? DEFAULT_AUDIO_SETTINGS : parseAudioSettings(raw);
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  }

  save(settings: AudioSettings): void {
    try {
      this.getStorage().setItem(AUDIO_SETTINGS_STORAGE_KEY, serializeAudioSettings(settings));
    } catch {
      // Browser storage can be unavailable; changes should still work for the current session.
    }
  }
}
