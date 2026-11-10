import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAudio, createSilentAudio, type AudioApi } from '../src/audio';

let vibrateSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
  vibrateSpy = vi.fn(() => true);
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrateSpy,
    writable: true,
    configurable: true,
  });
});

/** Let the fetch → arrayBuffer → decodeAudioData chains settle so the audio
 *  module's buffers populate. The setup.ts stubs all resolve immediately. */
async function flushBufferLoad(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r));
}

function spies() {
  const sourceProto = Object.getPrototypeOf(
    new AudioContext().createBufferSource(),
  );
  return {
    resume: vi.spyOn(AudioContext.prototype, 'resume'),
    createBuffer: vi.spyOn(AudioContext.prototype, 'createBuffer'),
    createBufferSource: vi.spyOn(AudioContext.prototype, 'createBufferSource'),
    start: vi.spyOn(sourceProto, 'start'),
  };
}

const EVENT_METHODS: Array<keyof AudioApi> = [
  'pickup',
  'place',
  'reject',
  'clear',
  'combo',
  'perfect',
  'gameOver',
];

describe('createSilentAudio()', () => {
  it('event methods do not throw', () => {
    const audio = createSilentAudio();
    for (const m of EVENT_METHODS) {
      expect(audio[m] as () => void).not.toThrow();
    }
  });

  it('does not vibrate', () => {
    const audio = createSilentAudio();
    audio.pickup();
    audio.clear();
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('reports muted=false by default and respects setMuted', () => {
    const audio = createSilentAudio();
    expect(audio.isMuted()).toBe(false);
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
  });
});

describe('createAudio() — iOS unlock prime', () => {
  it('unlock() resumes the context and plays one empty buffer after resume resolves', async () => {
    const s = spies();
    const audio = createAudio();
    audio.unlock();
    expect(s.resume).toHaveBeenCalled(); // resume() is called synchronously
    await flushBufferLoad(); // let resume().then(prime) settle
    expect(s.createBuffer).toHaveBeenCalledWith(1, 1, 22050);
    expect(s.start).toHaveBeenCalled();
  });

  it('primes exactly once across repeated unlock() and events', async () => {
    const s = spies();
    const audio = createAudio();
    audio.unlock();
    audio.unlock();
    audio.pickup();
    audio.place();
    await flushBufferLoad();
    expect(s.createBuffer).toHaveBeenCalledTimes(1);
  });

  it('a first event primes even without an explicit unlock()', async () => {
    const s = spies();
    const audio = createAudio();
    audio.pickup(); // the pickup gesture itself must drive the unlock
    await flushBufferLoad();
    expect(s.createBuffer).toHaveBeenCalled();
  });
});

describe('createAudio() — playback', () => {
  it('starts a source for every event once buffers are loaded', async () => {
    const s = spies();
    const audio = createAudio();
    await flushBufferLoad(); // buffers decoded
    audio.unlock();
    await flushBufferLoad(); // resume().then(prime) settled; unlocked latched
    for (const m of EVENT_METHODS) {
      s.start.mockClear();
      (audio[m] as () => void)();
      expect(s.start, `${String(m)} should start a source`).toHaveBeenCalledTimes(1);
    }
  });

  it('plays no cue synchronously before buffers load', () => {
    // Nothing awaited: buffer fetch is in flight and the resume().then prime
    // is still a pending microtask. fire() must not create a cue source.
    const s = spies();
    const audio = createAudio();
    audio.pickup();
    expect(s.createBufferSource).not.toHaveBeenCalled();
  });
});

describe('createAudio() — mute', () => {
  it('creates no source and does not prime when muted', () => {
    const s = spies();
    const audio = createAudio();
    audio.setMuted(true);
    audio.pickup();
    audio.gameOver();
    expect(s.createBufferSource).not.toHaveBeenCalled();
    expect(s.createBuffer).not.toHaveBeenCalled();
  });

  it('skips vibration when muted', () => {
    const audio = createAudio();
    audio.setMuted(true);
    audio.clear();
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('persists mute via storage on setMuted', () => {
    const audio = createAudio();
    audio.setMuted(true);
    expect(localStorage.getItem('blockly:mute')).toBe('true');
    audio.setMuted(false);
    expect(localStorage.getItem('blockly:mute')).toBe('false');
  });

  it('initialises mute from storage', () => {
    localStorage.setItem('blockly:mute', 'true');
    expect(createAudio().isMuted()).toBe(true);
  });
});

describe('createAudio() — context resume', () => {
  it('an event resumes a suspended context (self-heal)', () => {
    const s = spies();
    const audio = createAudio();
    audio.pickup();
    expect(s.resume).toHaveBeenCalled();
  });

  it('re-resumes after the context is re-suspended (iOS backgrounding)', async () => {
    // iOS suspends the AudioContext when the page hides (phone lock, app
    // switch). After the first unlock latches `unlocked = true`, the next
    // gesture must still call resume() — otherwise events fire into a
    // silent, suspended context.
    const s = spies();
    let instance: { state: 'suspended' | 'running' | 'closed' } | null = null;
    s.resume.mockImplementation(function (this: typeof instance & object) {
      instance = this as NonNullable<typeof instance>;
      instance.state = 'running';
      return Promise.resolve();
    });
    const audio = createAudio();
    audio.unlock();
    await flushBufferLoad(); // first prime settled; `unlocked` latched
    expect(instance).not.toBeNull();
    s.resume.mockClear();

    // Simulate iOS putting the page in background → context suspends again.
    instance!.state = 'suspended';

    audio.pickup();
    expect(s.resume).toHaveBeenCalled();
  });
});

describe('createAudio() — haptics', () => {
  it('invokes navigator.vibrate per event when not muted', () => {
    const audio = createAudio();
    audio.pickup();
    expect(vibrateSpy).toHaveBeenLastCalledWith([10]);
    audio.clear();
    expect(vibrateSpy).toHaveBeenLastCalledWith([30]);
    audio.combo();
    expect(vibrateSpy).toHaveBeenLastCalledWith([40, 30, 40]);
    audio.perfect();
    expect(vibrateSpy).toHaveBeenLastCalledWith([60, 40, 60, 40, 60]);
    audio.gameOver();
    expect(vibrateSpy).toHaveBeenLastCalledWith([80, 60, 80]);
  });

  it('tolerates a missing navigator.vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const audio = createAudio();
    expect(() => audio.place()).not.toThrow();
  });
});
