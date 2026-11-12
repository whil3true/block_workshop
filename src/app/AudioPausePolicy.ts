import type { PauseGate } from './PauseGate';

/** Manual UI dialogs block gameplay but must not interrupt music or UI sounds.
 * External owners retain audio suspension even when a settings dialog is open.
 * Startup is not an audio interruption: playback is already gesture-gated. */
export function shouldSuspendAudio(gate: Pick<PauseGate, 'has'>): boolean {
  return gate.has('sdk') || gate.has('browser') || gate.has('ad') || gate.has('transition');
}
