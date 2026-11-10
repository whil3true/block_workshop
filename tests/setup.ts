import { beforeEach } from 'vitest';

// jsdom 25 does not ship a PointerEvent constructor. We polyfill a minimal
// subclass of MouseEvent that carries pointerId / pointerType so the drag
// tests can dispatch synthetic pointer events.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PolyfillPointerEvent extends MouseEvent {
    public readonly pointerId: number;
    public readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  }
  globalThis.PointerEvent = PolyfillPointerEvent as unknown as typeof PointerEvent;
}

// setPointerCapture / releasePointerCapture are not in jsdom 25 either.
// Drag code wraps them in try/catch, but stub them anyway to keep tests quiet.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function () {
    // no-op stub
  };
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = function () {
    // no-op stub
  };
}

// jsdom 25 does not implement document.elementsFromPoint either; without a
// stub here, vi.spyOn cannot replace it. Default returns [] (off-box);
// tests override with mockReturnValue/mockImplementation as needed.
if (typeof Document.prototype.elementsFromPoint !== 'function') {
  Document.prototype.elementsFromPoint = function () {
    return [];
  };
}

// vitest's jsdom env in this combination ships a `localStorage` global whose
// prototype is plain Object (no `clear` / `removeItem` / etc). Replace it
// with a Map-backed Storage so the production storage module's localStorage
// calls behave correctly. Test-only.
const ls = (globalThis as { localStorage?: Storage }).localStorage;
if (!ls || typeof ls.clear !== 'function') {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
}

// The Map-backed storage above is shared across every test in the worker,
// so it must be wiped between tests. We do this here (rather than in each
// test file's beforeEach) so any future test file that touches the game
// controller starts with a clean storage by default.
beforeEach(() => {
  localStorage.clear();
});

// jsdom implements neither the Web Audio API nor a usable `fetch` for the
// audio module. Polyfill minimal stand-ins so `createAudio()` (exercised
// directly by audio.test.ts and indirectly by page-mount via main.ts) runs
// without throwing, and so the buffer-load pipeline settles deterministically.
class FakeAudioBufferSourceNode {
  public buffer: unknown = null;
  public connect(): void {
    // no-op
  }
  public start(): void {
    // spied via prototype in audio.test.ts
  }
}

class FakeAudioContext {
  public state: 'suspended' | 'running' | 'closed' = 'suspended';
  public readonly destination = {};

  public resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  public decodeAudioData(_data: ArrayBuffer): Promise<unknown> {
    return Promise.resolve({});
  }

  public createBuffer(
    _channels: number,
    _length: number,
    _sampleRate: number,
  ): unknown {
    return {};
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    return new FakeAudioBufferSourceNode();
  }

  public close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

if (typeof (globalThis as { AudioContext?: unknown }).AudioContext === 'undefined') {
  Object.defineProperty(globalThis, 'AudioContext', {
    value: FakeAudioContext,
    writable: true,
    configurable: true,
  });
}

const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: ((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : String(input);
    if (url.includes('/sounds/')) {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response);
    }
    if (originalFetch) return originalFetch(input);
    return Promise.reject(new Error(`unstubbed fetch: ${url}`));
  }) as typeof fetch,
});
