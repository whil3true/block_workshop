export type AudioApi = {
  pickup(): void;
  place(): void;
  reject(): void;
  clear(): void;
  combo(): void;
  perfect(): void;
  gameOver(): void;
  setMuted(value: boolean): void;
  isMuted(): boolean;
  unlock(): void;
};


export function createSilentAudio(): AudioApi {
  let muted = false;
  return {
    pickup: noop,
    place: noop,
    reject: noop,
    clear: noop,
    combo: noop,
    perfect: noop,
    gameOver: noop,
    setMuted(value: boolean): void {
      muted = value;
    },
    isMuted: () => muted,
    unlock: noop,
  };
}

function noop(): void {
  // intentional
}
