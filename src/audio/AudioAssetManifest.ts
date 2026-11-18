const base = import.meta.env.BASE_URL + 'audio/';

export const AUDIO_EFFECTS = {
 click: base + 'click_003.ogg',
 pickup: base + 'drop_003.ogg',
 place: base + 'drop_002.ogg',
 clear: base + 'drop_004.ogg',
 reject: base + 'bong_001.ogg',
 orderComplete: base + 'jingles_PIZZI10.ogg',
} as const;

export type AudioEffect = keyof typeof AUDIO_EFFECTS;
export const AUDIO_EFFECT_GAIN: Record<AudioEffect, number> = {
 click: 0.5, pickup: 0.5, place: 0.8, clear: 0.8, reject: 0.5, orderComplete: 0.8,
};
export const AUDIO_MUSIC = base + 'forget_me_not_in_f_major_looped.ogg';
