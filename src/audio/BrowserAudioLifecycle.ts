import type { AudioManager } from "./AudioManager.js";

/**
 * Platform-independent fallback for focus, tab switching and mobile page lifecycle.
 * SDK game_api_pause/resume needs an additional subscription when Yandex is integrated.
 */
export const attachBrowserAudioLifecycle = (
  manager: AudioManager,
  win: Window = window,
  doc: Document = document,
): (() => void) => {
  let focused = !doc.hidden;
  let pageGone = false;
  const sync = (): void => manager.setPageVisible(!pageGone && !doc.hidden && focused);
  const unlock = (): void => {
    // Ignore gestures in a background page: audio must stay silent off-screen.
    if (pageGone || doc.hidden) return;
    focused = true; // Android may lose focus without a matching focus event.
    sync();
    manager.unlock();
  };
  const retryOnRelease = (): void => {
    // pointerup is a second user-activation opportunity within the SAME tap.
    // Some mobile browsers reject or defer play() on pointerdown while loading.
    if (pageGone || doc.hidden || !focused) return;
    manager.retryPlaybackFromGesture();
  };
  const blur = (): void => { focused = false; sync(); };
  const focus = (): void => { focused = true; sync(); };
  const visibility = (): void => { focused = !doc.hidden; sync(); };
  const pagehide = (): void => { pageGone = true; focused = false; sync(); };
  const pageshow = (): void => { pageGone = false; focused = !doc.hidden; sync(); };

  // Capture before Phaser's button/tile pointerdown handler.
  win.addEventListener("pointerdown", unlock, { passive: true, capture: true });
  win.addEventListener("pointerup", retryOnRelease, true);
  win.addEventListener("keydown", unlock, true);
  win.addEventListener("blur", blur);
  win.addEventListener("focus", focus);
  win.addEventListener("pagehide", pagehide);
  win.addEventListener("pageshow", pageshow);
  doc.addEventListener("visibilitychange", visibility);
  sync();
  return () => {
    win.removeEventListener("pointerdown", unlock, true);
    win.removeEventListener("pointerup", retryOnRelease, true);
    win.removeEventListener("keydown", unlock, true);
    win.removeEventListener("blur", blur);
    win.removeEventListener("focus", focus);
    win.removeEventListener("pagehide", pagehide);
    win.removeEventListener("pageshow", pageshow);
    doc.removeEventListener("visibilitychange", visibility);
  };
};
