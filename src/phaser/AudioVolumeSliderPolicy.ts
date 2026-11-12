/** Pure slider geometry, shared by Pause and Main Menu settings overlays. */
export const AUDIO_SLIDER_TRACK_INSET = 20;
export const AUDIO_SLIDER_TOUCH_HEIGHT = 48;

export const clampAudioSliderValue = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export const audioSliderValueAtX = (pointerX: number, centerX: number, width: number): number => {
  const usable = width - 2 * AUDIO_SLIDER_TRACK_INSET;
  if (!Number.isFinite(pointerX) || !Number.isFinite(centerX)
    || !Number.isFinite(usable) || usable <= 0) return 0;
  const start = centerX - usable / 2;
  return Math.round(clampAudioSliderValue((pointerX - start) / usable) * 100) / 100;
};
