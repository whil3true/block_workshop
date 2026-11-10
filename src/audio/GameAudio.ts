import type { AudioApi } from '../audio';
import { loadMute, saveMute } from '../storage';
import type { AudioManager } from './AudioManager';
export function gameAudio(manager: AudioManager, onMute: (muted: boolean) => void): AudioApi {
 let muted = loadMute();
 onMute(muted);
 return {
  pickup: () => manager.playEffect('pickup'), place: () => manager.playEffect('place'), reject: () => manager.playEffect('reject'),
  clear: () => manager.playEffect('clear'), combo: () => manager.playEffect('combo'), perfect: () => manager.playEffect('perfect'), gameOver: () => manager.playEffect('gameover'),
  unlock: () => manager.unlock(), isMuted: () => muted,
  setMuted: (value) => { muted = value; saveMute(value); onMute(value); }
 };
}
