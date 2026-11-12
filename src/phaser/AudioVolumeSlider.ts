import Phaser from 'phaser';
import { audioSliderValueAtX, AUDIO_SLIDER_TOUCH_HEIGHT, AUDIO_SLIDER_TRACK_INSET, clampAudioSliderValue } from "./AudioVolumeSliderPolicy.js";
import { createUiText } from "./UiPrimitives.js";
import { VISUAL_COLORS } from "./VisualTokens.js";

export interface AudioVolumeSliderOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** A pointer-capturing 48px touch slider; its input listeners are removed on destruction. */
export const createAudioVolumeSlider = (
  scene: Phaser.Scene, renderScale: number, options: AudioVolumeSliderOptions,
): Phaser.GameObjects.Container => {
  const { x, y, width } = options;
  const trackWidth = width - AUDIO_SLIDER_TRACK_INSET * 2;
  const graphics = scene.add.graphics();
  const label = createUiText(scene, renderScale, -width / 2 + 10, -25, options.label, "caption")
    .setOrigin(0, 0.5);
  const percent = createUiText(scene, renderScale, width / 2 - 10, -25, "", "caption", {
    color: VISUAL_COLORS.text.secondary.hex, align: "right",
  }).setOrigin(1, 0.5);
  const touch = scene.add.zone(0, 12, width, AUDIO_SLIDER_TOUCH_HEIGHT)
    .setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [graphics, label, percent, touch]);
  let value = clampAudioSliderValue(options.value);
  let activePointer: number | null = null;

  const redraw = (): void => {
    graphics.clear();
    const left = -trackWidth / 2;
    const filled = trackWidth * value;
    graphics.fillStyle(VISUAL_COLORS.divider.phaser)
      .fillRoundedRect(left, 6, trackWidth, 12, 6);
    if (filled > 0) graphics.fillStyle(VISUAL_COLORS.accent.gold.phaser)
      .fillRoundedRect(left, 6, filled, 12, Math.min(6, filled / 2));
    const thumbX = left + filled;
    graphics.fillStyle(VISUAL_COLORS.surface.elevated.phaser).fillCircle(thumbX, 12, 12);
    graphics.lineStyle(3, VISUAL_COLORS.accent.gold.phaser).strokeCircle(thumbX, 12, 12);
    percent.setText(`${Math.round(value * 100)}%`);
  };
  const update = (pointer: Phaser.Input.Pointer): void => {
    // Convert screen coordinates through the active camera (HiDPI / EXPAND safe).
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const next = audioSliderValueAtX(world.x, x, width);
    if (next === value) return;
    value = next;
    redraw();
    options.onChange(next);
  };
  const move = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === activePointer) update(pointer);
  };
  const release = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== activePointer) return;
    update(pointer);
    activePointer = null;
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", release);
    scene.input.off("pointerupoutside", release);
  };
  touch.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (activePointer !== null) return;
    activePointer = pointer.id;
    update(pointer);
    scene.input.on("pointermove", move);
    scene.input.on("pointerup", release);
    scene.input.on("pointerupoutside", release);
  });
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    activePointer = null;
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", release);
    scene.input.off("pointerupoutside", release);
  });
  redraw();
  return container;
};
