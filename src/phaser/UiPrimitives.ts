import Phaser from 'phaser';
import { paperSurface, rasterSliceTexture } from './CozyAssets';
import { playAudioEffect } from "../audio/AudioRuntime.js";
import { LOGICAL_GAME_HEIGHT, LOGICAL_GAME_WIDTH, setHiDpiTextResolution } from "./Display.js";
import { createButtonHitArea, resolveButtonVisual, type ButtonKind, type ButtonState } from "./UiPolicy.js";
import {
  BORDERS, COMPONENT_RADII, FONT_DISPLAY_FAMILY, FONT_UI_FAMILY, SPACING, TYPOGRAPHY, VISUAL_COLORS,
  type TypographyRole,
} from "./VisualTokens.js";

export interface TextOptions {
  readonly color?: string;
  readonly align?: "left" | "center" | "right" | "justify";
}

export const createUiText = (
  scene: Phaser.Scene,
  renderScale: number,
  x: number,
  y: number,
  value: string,
  role: TypographyRole,
  options: TextOptions = {},
): Phaser.GameObjects.Text => {
  const token = TYPOGRAPHY[role];
  const text = scene.add.text(x, y, value, {
    color: options.color ?? VISUAL_COLORS.text.primary.hex,
    fontFamily: token.family === "display" ? FONT_DISPLAY_FAMILY : FONT_UI_FAMILY,
    fontSize: `${token.size}px`,
    fontStyle: String(token.weight),
    lineSpacing: token.lineHeight - token.size,
    align: options.align ?? token.align,
  });
  text.setLetterSpacing(token.tracking);
  return setHiDpiTextResolution(text, renderScale);
};

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height?: number;
  readonly label: string;
  readonly onActivate: () => void;
  readonly disabled?: boolean;
  readonly borderless?: boolean;
  readonly tone?: "default" | "modalSecondary" | "rewardLight";
}

/** Small focus seam: callers may connect setFocused() to a future keyboard-navigation owner. */
export interface UiButton {
  readonly container: Phaser.GameObjects.Container;
  setDisabled(disabled: boolean): void;
  setFocused(focused: boolean): void;
}

const createButton = (
  scene: Phaser.Scene,
  renderScale: number,
  kind: ButtonKind,
  options: ButtonOptions,
  icon = false,
): UiButton => {
  const minimumHeight = SPACING.minimumTouchTarget;
  const width = Math.max(options.width, SPACING.minimumTouchTarget);
  const height = Math.max(options.height ?? (kind === "primary" ? SPACING.primaryButtonHeight : 52), minimumHeight);
  const radius = icon ? COMPONENT_RADII.iconButton : kind === "tertiary" ? COMPONENT_RADII.tile : COMPONENT_RADII.button;
  const graphics = scene.add.graphics();
  const label = createUiText(scene, renderScale, 0, 0, options.label,
    kind === "primary" ? "buttonPrimary" : "buttonSecondary", { align: "center" }).setOrigin(0.5);
  const artKey = kind === 'primary' || kind === 'danger' ? 'button-primary' : 'button-secondary';
  const art = scene.textures.exists(`cozy-${artKey}`) ? scene.add.image(0,0,rasterSliceTexture(scene,`cozy-${artKey}`,width+8,height+8)).setDisplaySize(width+8,height+8) : null;
  const visualContent = scene.add.container(0, 0, art ? [graphics, art, label] : [graphics, label]);
  const container = scene.add.container(options.x, options.y, [visualContent]);
  let disabled = options.disabled ?? false;
  let focused = false;
  let hovered = false;
  let armed = false;

  const render = (state?: ButtonState): void => {
    const resolvedState = disabled ? "disabled" : state ?? (focused ? "focus" : hovered ? "hover" : "default");
    const visual = resolveButtonVisual(kind, resolvedState);
    graphics.clear();
    if (visual.focusRing) {
      graphics.lineStyle(BORDERS.emphasized, VISUAL_COLORS.route.halo.phaser, 1)
        .strokeRoundedRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10, radius + 5);
      graphics.lineStyle(BORDERS.structural, VISUAL_COLORS.text.primary.phaser, 1)
        .strokeRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, radius + 2);
    }
    const fill = options.tone === "rewardLight" && kind === "primary"
      // Only the reward screen gets this flat ivory button. No border.
      ? resolvedState === "pressed" ? VISUAL_COLORS.secondaryHover.phaser
        : resolvedState === "hover" ? VISUAL_COLORS.gallery.soonFill.phaser
          : VISUAL_COLORS.surface.elevated.phaser
      : options.tone === "modalSecondary" && kind === "secondary"
        ? resolvedState === "pressed" ? VISUAL_COLORS.secondaryPressed.phaser
          : resolvedState === "hover" ? VISUAL_COLORS.secondaryHover.phaser
            : VISUAL_COLORS.state.pressedFill.phaser
        : visual.fill;
    if (art) {
      const key = resolvedState === 'disabled' ? 'button-disabled' : resolvedState === 'pressed' ? 'button-pressed' : artKey;
      if (scene.textures.exists(`cozy-${key}`)) art.setTexture(rasterSliceTexture(scene,`cozy-${key}`,width+8,height+8));
    } else graphics.fillStyle(fill, visual.fillAlpha).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    if (!options.borderless && visual.borderWidth > 0) graphics.lineStyle(visual.borderWidth, visual.border, 1)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    label.setColor(visual.label);
    visualContent.setY(visual.offsetY);
  };

  const hitArea = createButtonHitArea(width, height);
  const phaserHitArea = new Phaser.Geom.Rectangle(
    hitArea.left, hitArea.top, hitArea.width, hitArea.height,
  );
  container.setSize(width, height);
  const syncInput = (): void => {
    if (disabled) container.disableInteractive();
    else container.setInteractive(
      phaserHitArea, Phaser.Geom.Rectangle.Contains,
    ).input!.cursor = "pointer";
  };
  container.on("pointerover", () => { if (!disabled) { hovered = true; render(); } });
  container.on("pointerout", () => { hovered = false; armed = false; render(); });
  container.on("pointerdown", () => {
    if (!disabled) {
      armed = true;
      render("pressed");
      playAudioEffect("pickup");
    }
  });
  container.on("pointerup", () => {
    if (disabled || !armed) return;
    armed = false;
    render();
    options.onActivate();
  });
  render();
  syncInput();
  return {
    container,
    setDisabled(value: boolean): void { disabled = value; armed = false; syncInput(); render(); },
    setFocused(value: boolean): void { focused = value; render(); },
  };
};

export const createPrimaryButton = (scene: Phaser.Scene, renderScale: number, options: ButtonOptions): UiButton =>
  createButton(scene, renderScale, "primary", options);
export const createSecondaryButton = (scene: Phaser.Scene, renderScale: number, options: ButtonOptions): UiButton =>
  createButton(scene, renderScale, "secondary", options);
export const createDangerButton = (scene: Phaser.Scene, renderScale: number, options: ButtonOptions): UiButton =>
  createButton(scene, renderScale, "danger", options);
export const createTertiaryButton = (scene: Phaser.Scene, renderScale: number, options: ButtonOptions): UiButton =>
  createButton(scene, renderScale, "tertiary", options);
export const createIconButton = (scene: Phaser.Scene, renderScale: number, options: ButtonOptions): UiButton =>
  createButton(scene, renderScale, "secondary", { ...options, width: Math.max(options.width, 48), height: Math.max(options.height ?? 48, 48) }, true);

export interface PanelOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly borderRole?: "strong" | "soft" | "none";
}

export const createCard = (scene: Phaser.Scene, options: PanelOptions): Phaser.GameObjects.Graphics => {
  const graphics = scene.add.graphics().fillStyle(VISUAL_COLORS.surface.card.phaser)
    .fillRoundedRect(options.x - options.width / 2, options.y - options.height / 2, options.width, options.height, COMPONENT_RADII.chapterBanner);
  if (options.borderRole === "strong" || options.borderRole === "soft") graphics.lineStyle(
    BORDERS.structural,
    VISUAL_COLORS.border[options.borderRole].phaser,
  ).strokeRoundedRect(
    options.x - options.width / 2, options.y - options.height / 2,
    options.width, options.height, COMPONENT_RADII.chapterBanner,
  );
  return graphics;
};

/** The sole dim source: a Canvas rectangle covering the complete browser viewport. */
export const createViewportBackdrop = (
  scene: Phaser.Scene,
  color: number,
  alpha = 1,
): Phaser.GameObjects.Rectangle => {
  const backdrop = scene.add.rectangle(
    LOGICAL_GAME_WIDTH / 2, LOGICAL_GAME_HEIGHT / 2, 1, 1, color, alpha,
  ).setName('viewport-backdrop');
  const syncSize = (): void => {
    const { zoom, scrollX, scrollY, width, height } = scene.cameras.main;
    backdrop.setPosition(scrollX + width/2, scrollY + height/2);
    backdrop.setSize(scene.scale.gameSize.width / zoom, scene.scale.gameSize.height / zoom);
  };
  syncSize();
  scene.scale.on(Phaser.Scale.Events.RESIZE, syncSize);
  backdrop.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, syncSize);
  });
  return backdrop;
};

// A shell never owns dimming. The scene inserts exactly one backdrop below
// its topmost panel, even when a result, confirmation and external pause overlap.
export const createModalShell = (scene: Phaser.Scene, options: PanelOptions): Phaser.GameObjects.Container => {
  const panel = paperSurface(scene, 'modal', options.x, options.y, options.width, options.height, VISUAL_COLORS.surface.elevated.phaser);
  return scene.add.container(0, 0, [panel]);
};
