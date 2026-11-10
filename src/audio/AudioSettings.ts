/** Persistent, scene-independent mixer preferences. Values use a normalized 0..1 range. */
export interface AudioSettings {
  readonly version: 1;
  readonly musicVolume: number;
  readonly sfxVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  version: 1, musicVolume: 0.4, sfxVolume: 0.65,
});

const clampVolume = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export const createAudioSettings = (musicVolume: number, sfxVolume: number): AudioSettings =>
  Object.freeze({
    version: 1,
    musicVolume: clampVolume(musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clampVolume(sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
  });

export const parseAudioSettings = (serialized: string): AudioSettings => {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { return DEFAULT_AUDIO_SETTINGS; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_AUDIO_SETTINGS;
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1
    || typeof candidate.musicVolume !== "number" || !Number.isFinite(candidate.musicVolume)
    || typeof candidate.sfxVolume !== "number" || !Number.isFinite(candidate.sfxVolume)) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  return createAudioSettings(candidate.musicVolume, candidate.sfxVolume);
};

export const serializeAudioSettings = (settings: AudioSettings): string =>
  JSON.stringify(createAudioSettings(settings.musicVolume, settings.sfxVolume));
