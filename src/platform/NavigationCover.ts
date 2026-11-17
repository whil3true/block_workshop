/** Technical ad shield: stays visible even when Phaser's render loop is suspended. */
const ID = 'navigation-cover';
let fallback: ReturnType<typeof setTimeout> | null = null;
export function hideNavigationCover(): void {
 if (fallback !== null) clearTimeout(fallback);
 fallback = null;
 const cover = document.getElementById(ID);
 if (cover) cover.hidden = true;
}
export function showNavigationCover(): void {
 let cover = document.getElementById(ID);
 if (!cover) {
  const root = document.getElementById('app'); if (!root) return;
  cover = document.createElement('div'); cover.id = ID; cover.setAttribute('aria-hidden','true');
  root.appendChild(cover);
 }
 cover.hidden = false;
}
/** Arm only AFTER ad callbacks and destination commit, never during a long advertisement. */
export function armNavigationCoverFallback(): void {
 if (document.getElementById(ID)?.hidden !== false) return;
 if (fallback !== null) clearTimeout(fallback);
 fallback = setTimeout(hideNavigationCover, 10000);
}
