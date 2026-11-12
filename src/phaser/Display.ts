import Phaser from 'phaser';
export const LOGICAL_GAME_WIDTH = 480;
export const LOGICAL_GAME_HEIGHT = 800;
export const MIN_RENDER_SCALE = 1;
export const MAX_RENDER_SCALE = 2;

/**
 * Maximum logical height exposed by the adaptive portrait canvas. This is a
 * guard rail for pathological aspect ratios and GPU fill-rate, not layout
 * space: authored gameplay/UI remains inside the centered 480x800 composition.
 */
export const MAX_LOGICAL_VIEWPORT_HEIGHT = LOGICAL_GAME_HEIGHT * 2;

export interface PortraitFrame {
  readonly scale: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly sideGutter: number;
  readonly topBottomGutter: number;
  readonly logicalViewportWidth: number;
  readonly logicalViewportHeight: number;
}

/**
 * Describes the production Phaser.Scale.EXPAND contract with canvas width
 * capped at the canonical portrait width. Wide viewports therefore retain
 * desktop side gutters, while normal tall-mobile viewports extend the Phaser
 * canvas vertically instead of exposing CSS gutters above and below it.
 */
export const computePortraitFrame = (
  viewportWidth: number,
  viewportHeight: number,
  logicalWidth = LOGICAL_GAME_WIDTH,
  logicalHeight = LOGICAL_GAME_HEIGHT,
): PortraitFrame => {
  const widthScale = viewportWidth / logicalWidth;
  const heightScale = viewportHeight / logicalHeight;

  if (widthScale <= heightScale) {
    const logicalViewportHeight = Math.min(
      viewportHeight / widthScale,
      logicalHeight * 2,
    );
    const displayHeight = logicalViewportHeight * widthScale;
    return {
      scale: widthScale,
      displayWidth: viewportWidth,
      displayHeight,
      sideGutter: 0,
      topBottomGutter: (viewportHeight - displayHeight) / 2,
      logicalViewportWidth: logicalWidth,
      logicalViewportHeight,
    };
  }

  const displayWidth = logicalWidth * heightScale;
  return {
    scale: heightScale,
    displayWidth,
    displayHeight: viewportHeight,
    sideGutter: (viewportWidth - displayWidth) / 2,
    topBottomGutter: 0,
    logicalViewportWidth: logicalWidth,
    logicalViewportHeight: logicalHeight,
  };
};

/**
 * Chooses the renderer density once at startup. EXPAND can display the
 * canonical field above its authored size even when DPR is 1, so DPR alone is
 * not a sufficient backing-buffer policy. The production cap intentionally
 * preserves the existing mobile ceiling while allowing desktop DPR-1 canvases
 * to track their CSS presentation size through QHD.
 */
export const computeRenderScale = (
  devicePixelRatio: number,
  viewportWidth = LOGICAL_GAME_WIDTH,
  viewportHeight = LOGICAL_GAME_HEIGHT,
): number => {
  const dpr = Number.isFinite(devicePixelRatio)
    ? Math.max(MIN_RENDER_SCALE, devicePixelRatio)
    : MIN_RENDER_SCALE;
  const hasFiniteViewport = Number.isFinite(viewportWidth) && viewportWidth > 0
    && Number.isFinite(viewportHeight) && viewportHeight > 0;
  const presentationScale = hasFiniteViewport
    ? computePortraitFrame(viewportWidth, viewportHeight).scale
    : MIN_RENDER_SCALE;
  const requiredScale = dpr * Math.max(MIN_RENDER_SCALE, presentationScale);
  return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, requiredScale));
};

/**
 * Mirrors Phaser 4.2.1's device/OS desktop classification for startup.
 * Phaser.Device is intentionally not exposed by the Phaser root namespace.
 * Device emulation changes the UA; do not apply the desktop trial on Android/iOS.
 */
export const isDesktopBrowserUserAgent = (
  userAgent: string,
  maxTouchPoints = 0,
): boolean => {
  if (/(Android|iPhone|iPad|iPod|Windows Phone|IEMobile)/i.test(userAgent)) return false;
  if (/Windows/i.test(userAgent)) return !/Touch/i.test(userAgent);
  if (/Mac OS/i.test(userAgent) && !/like Mac OS/i.test(userAgent)) return maxTouchPoints <= 2;
  if (/CrOS/i.test(userAgent)) return true;
  return /Linux/i.test(userAgent) && !/Silk/i.test(userAgent);
};

/**
 * Desktop sharpness trial: use the existing bounded 2x backing density at startup
 * instead of fractional 1.x density. Mobile keeps its current computed policy.
 */
export const selectStartupRenderScale = (
  automaticRenderScale: number,
  isDesktop: boolean,
  // Desktop retains its previously approved 2× rendering policy.
): number => isDesktop ? MAX_RENDER_SCALE : automaticRenderScale;

const logicalCameraResizeHandlers = new WeakMap<Phaser.Scene, () => void>();

/**
 * Keeps the immutable 480x800 production composition centered inside the
 * adaptive Phaser viewport. EXPAND may reveal background-only world space
 * above/below on tall phones, while renderScale still supplies HiDPI backing
 * pixels.
 */
export const configureLogicalCamera = (scene: Phaser.Scene, renderScale: number): void => {
  const existing = logicalCameraResizeHandlers.get(scene);
  if (existing !== undefined) scene.scale.off(Phaser.Scale.Events.RESIZE, existing);

  const syncCamera = (): void => {
    scene.cameras.main
      .setZoom(renderScale)
      .centerOn(LOGICAL_GAME_WIDTH / 2, LOGICAL_GAME_HEIGHT / 2);
  };

  logicalCameraResizeHandlers.set(scene, syncCamera);
  scene.scale.on(Phaser.Scale.Events.RESIZE, syncCamera);
  syncCamera();

  if (existing === undefined) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const current = logicalCameraResizeHandlers.get(scene);
      if (current !== undefined) scene.scale.off(Phaser.Scale.Events.RESIZE, current);
      logicalCameraResizeHandlers.delete(scene);
    });
  }
};

/** Uses Phaser's supported Text resolution without custom WebGL render nodes. */
export const setHiDpiTextResolution = <T extends Phaser.GameObjects.Text>(
  text: T,
  renderScale: number,
): T => renderScale === 1 ? text : text.setResolution(renderScale);

