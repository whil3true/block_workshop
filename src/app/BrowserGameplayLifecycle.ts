export interface BrowserLifecycleTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface BrowserVisibilityTarget extends BrowserLifecycleTarget {
  readonly hidden: boolean;
}

export interface BrowserGameplayLifecycleCallbacks {
  readonly onBackground: () => void;
  readonly onForeground: () => void;
}

/**
 * Reports actual page backgrounding without treating ordinary window focus
 * changes (for example, tapping browser chrome) as a gameplay interruption.
 */
export const attachBrowserGameplayLifecycle = (
  callbacks: BrowserGameplayLifecycleCallbacks,
  win: BrowserLifecycleTarget = window,
  doc: BrowserVisibilityTarget = document,
): (() => void) => {
  let backgrounded = false;
  let attached = true;

  const setBackgrounded = (next: boolean): void => {
    if (!attached || backgrounded === next) return;
    backgrounded = next;
    if (next) callbacks.onBackground();
    else callbacks.onForeground();
  };
  const visibility = (): void => setBackgrounded(doc.hidden);
  const pagehide = (): void => setBackgrounded(true);
  const pageshow = (): void => setBackgrounded(doc.hidden);

  doc.addEventListener("visibilitychange", visibility);
  win.addEventListener("pagehide", pagehide);
  win.addEventListener("pageshow", pageshow);
  visibility();

  return () => {
    if (!attached) return;
    attached = false;
    doc.removeEventListener("visibilitychange", visibility);
    win.removeEventListener("pagehide", pagehide);
    win.removeEventListener("pageshow", pageshow);
  };
};
