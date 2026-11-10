import { AUDIO_EFFECTS, AUDIO_MUSIC } from "./AudioAssetManifest.js";
import type { AudioOutput } from "./AudioManager.js";

/**
 * Decoded Web Audio buffers for low-latency SFX, one streaming HTMLAudioElement
 * for music. No effect is queued for late playback after a scene transition.
 */
export class HtmlAudioOutput implements AudioOutput {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly fallbackPools = new Map<string, HTMLAudioElement[]>();
  private effectsContext: AudioContext | null = null;
  private effectsActive = false;
  private music: HTMLAudioElement | null = null;
  private preparedFirstTrack: HTMLAudioElement | null = null;
  private musicNeedsRetry = false;
  private musicPlayToken = 0;
  // Retain the logical soundtrack state independently of the media element.
  // Android may keep a system media card for an HTMLAudioElement that is only paused.
  private musicPath: string | null = null;
  private musicVolume = 1;
  private musicPosition = 0;
  private musicEnded: (() => void) | null = null;

  constructor() {
    this.prepareMusic();
    this.prepareEffects();
  }

  /** Warm the first track BEFORE the initial user tap, but never autoplay it. */
  private prepareMusic(): void {
    try {
      const music = new Audio(AUDIO_MUSIC[0]!.path);
      music.preload = "auto";
      music.load();
      this.preparedFirstTrack = music;
    } catch {
      // Unsupported media must not prevent the game from booting.
    }
  }

  /** Fetch/decode each small sound once; never create new media on a normal tap. */
  private prepareEffects(): void {
    try {
      const browser = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Constructor = window.AudioContext ?? browser.webkitAudioContext;
      if (Constructor) this.effectsContext = new Constructor();
    } catch {
      // Rare browsers lacking Web Audio use the small preloaded media fallback.
    }

    for (const path of Object.values(AUDIO_EFFECTS)) {
      const context = this.effectsContext;
      if (context) {
        void fetch(path)
          .then((response) => {
            if (!response.ok) throw new Error(`Cannot load SFX: ${path}`);
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .then((buffer) => { this.buffers.set(path, buffer); })
          .catch(() => { this.prepareFallback(path); });
      } else {
        this.prepareFallback(path);
      }
    }
  }

  private prepareFallback(path: string): void {
    try {
      const player = new Audio(path);
      player.preload = "auto";
      player.load();
      this.fallbackPools.set(path, [player]);
    } catch {
      // Silent fallback, never a gameplay failure.
    }
  }

  onUserGesture(): void {
    const context = this.effectsContext;
    if (this.effectsActive && context && context.state !== "running") {
      try { void context.resume().catch(() => {}); } catch { /* browser denied resume */ }
    }
  }

  setEffectsActive(active: boolean): void {
    this.effectsActive = active;
    const context = this.effectsContext;
    if (!active) {
      // Stop already-playing SFX, not only future effects.
      for (const pool of this.fallbackPools.values()) for (const player of pool) player.pause();
      if (context && context.state !== "suspended") {
        try { void context.suspend().catch(() => {}); } catch { /* closed context */ }
      }
    }
    // Resume is deliberately handled by a trusted gesture, not by background events.
  }

  playEffect(path: string, volume: number): void {
    if (!this.effectsActive || volume <= 0) return;
    const context = this.effectsContext;
    const buffer = this.buffers.get(path);
    if (context && buffer) {
      try {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = Math.max(0, Math.min(1, volume));
        source.connect(gain);
        gain.connect(context.destination);
        source.start(0);
      } catch {
        // Do not enqueue a sound to fire late after navigation.
      }
      return;
    }
    // While Web Audio is still decoding, skip a first effect instead of playing
    // it noticeably late on the next screen. A fallback is only for decode failures.
    if (this.fallbackPools.has(path)) this.playFallback(path, volume);
  }

  private playFallback(path: string, volume: number): void {
    try {
      const pool = this.fallbackPools.get(path);
      if (!pool) return;
      let player = pool.find((item) => item.paused || item.ended);
      if (!player) {
        if (pool.length >= 3) return;
        player = new Audio(path);
        player.preload = "auto";
        pool.push(player);
      }
      player.volume = Math.max(0, Math.min(1, volume));
      try { player.currentTime = 0; } catch { /* not seekable yet */ }
      try { void player.play().catch(() => {}); } catch { /* denied */ }
    } catch { /* silence on unsupported browsers */ }
  }

  startMusic(path: string, volume: number, onEnded: () => void): void {
    this.stopMusic();
    this.musicPath = path;
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicPosition = 0;
    this.musicEnded = onEnded;
    this.createMusicPlayer();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) this.music.volume = this.musicVolume;
  }

  pauseMusic(): void {
    // pause() alone leaves Android Chrome's media notification associated with
    // this source. Release it on blur/pagehide/ad pause/mute, retaining progress.
    const player = this.music;
    if (player) {
      const position = player.currentTime;
      if (Number.isFinite(position) && position >= 0) this.musicPosition = position;
    }
    this.releaseMusicElement();
    this.clearMediaSession();
  }

  resumeMusic(): void {
    if (!this.music) {
      // The manager checks focus, ads and volume before reaching this method.
      // A new element has no stale media session or system playback controls.
      if (this.musicPath !== null) this.createMusicPlayer();
      return;
    }
    // A pending play() does NOT mean audio is actually playing. On Android it
    // can still be waiting for media data or user activation.
    if (!this.music.paused && !this.musicNeedsRetry) return;
    this.tryPlayMusic(this.music);
  }

  stopMusic(): void {
    this.releaseMusicElement();
    this.musicPath = null;
    this.musicEnded = null;
    this.musicPosition = 0;
    this.clearMediaSession();
  }

  private createMusicPlayer(): void {
    const path = this.musicPath;
    if (path === null) return;
    try {
      const prepared = this.preparedFirstTrack;
      const player = prepared && path === AUDIO_MUSIC[0]!.path ? prepared : new Audio(path);
      this.preparedFirstTrack = null;
      player.preload = "auto";
      player.loop = false;
      player.volume = this.musicVolume;
      player.addEventListener("ended", () => {
        if (this.music === player) this.musicEnded?.();
      });
      this.music = player;
      const position = this.musicPosition;
      if (position > 0) {
        const seekAndPlay = (): void => {
          if (this.music !== player) return; // page hidden again while loading
          try { player.currentTime = position; } catch { /* unsupported seek */ }
          this.tryPlayMusic(player);
        };
        if (player.readyState >= 1) seekAndPlay();
        else {
          player.addEventListener("loadedmetadata", seekAndPlay, { once: true });
          player.load();
        }
      } else {
        this.tryPlayMusic(player);
      }
    } catch {
      // Keep the logical soundtrack so a later trusted gesture can retry it.
    }
  }

  private releaseMusicElement(): void {
    ++this.musicPlayToken;
    this.musicNeedsRetry = false;
    const player = this.music;
    this.music = null; // Ignore stale play/ended/metadata callbacks.
    if (!player) return;
    try {
      player.pause();
      player.removeAttribute("src");
      player.load(); // Release the OS media session, not just audible playback.
    } catch {
      // Some mobile browsers can throw during media teardown.
    }
  }

  private clearMediaSession(): void {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    } catch {
      // Clearing the HTMLAudioElement source above is the primary mechanism.
    }
  }

  private tryPlayMusic(player: HTMLAudioElement): void {
    if (this.music !== player) return;
    const token = ++this.musicPlayToken;
    this.musicNeedsRetry = false;
    try {
      const promise = player.play();
      void promise.catch(() => {
        if (this.music === player && this.musicPlayToken === token) {
          this.musicNeedsRetry = true;
        }
      });
    } catch {
      if (this.music === player && this.musicPlayToken === token) {
        this.musicNeedsRetry = true;
      }
    }
  }
}
