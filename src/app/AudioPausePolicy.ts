import type { PauseGate } from './PauseGate';

/** Only external interruptions suspend audio. Manual dialogs and navigation
 * lock gameplay, while startup leaves playback gated by the first gesture. */
export function shouldSuspendAudio(gate: Pick<PauseGate, 'has'>): boolean {
  return gate.has('sdk') || gate.has('browser') || gate.has('ad') || gate.has('focus') || gate.has('input');
}
