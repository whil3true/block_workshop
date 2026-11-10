const base = import.meta.env.BASE_URL + 'audio/';
export const AUDIO_EFFECTS = {
 pickup: base + 'pickup.wav', place: base + 'place.wav', reject: base + 'reject.wav',
 clear: base + 'clear.wav', combo: base + 'combo.wav', perfect: base + 'perfect.wav', gameover: base + 'gameover.wav',
} as const;
export type AudioEffect = keyof typeof AUDIO_EFFECTS;
export const AUDIO_EFFECT_GAIN: Record<AudioEffect, number> = { pickup: 0.5, place: 0.8, reject: 0.5, clear: 0.8, combo: 0.8, perfect: 0.8, gameover: 0.6 };
export const AUDIO_MUSIC = [{ path: base + 'workshop.wav' }] as const;
