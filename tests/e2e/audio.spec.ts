import { test, expect } from './fixtures';
import { drag, frames, open, point, seed } from './helpers';

interface AudioProbe {
 decoded: number;
 started: number[];
 ended: number;
 music: Set<HTMLMediaElement>;
}

test.use({ hasTouch: true, viewport: { width: 400, height: 800 } });

test('touch unlock plays one UI click, one looping track, and distinct piece sounds', async ({ page, browserName }) => {
 test.skip(browserName !== 'chromium', 'Touch audio regression for Android Chromium behavior');
 await seed(page, { locale: 'en' });
 await page.addInitScript(() => {
  const probe: AudioProbe = { decoded: 0, started: [], ended: 0, music: new Set() };
  Object.assign(window, { audioProbe: probe });

  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = async function (...args) {
   const buffer = await decode.apply(this, args);
   probe.decoded++;
   return buffer;
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
   start.apply(this, args);
   probe.started.push(this.buffer!.duration);
   this.addEventListener('ended', () => { probe.ended++; }, { once: true });
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
   if (this.src.endsWith('/forget_me_not_in_f_major_looped.ogg')) probe.music.add(this);
   return play.call(this);
  };
 });

 const read = () => page.evaluate(() => {
  const probe = (window as Window & { audioProbe?: AudioProbe }).audioProbe!;
  return {
   decoded: probe.decoded, started: probe.started, ended: probe.ended,
   music: [...probe.music].map(player => ({ loop: player.loop, paused: player.paused, time: player.currentTime })),
  };
 });
 const tap = async (x: number, y: number) => {
  const target = await point(page, x, y);
  await page.touchscreen.tap(target.x, target.y);
  await frames(page, 5);
 };

 await open(page);
 await expect.poll(async () => (await read()).decoded).toBe(6);
 expect(await read()).toMatchObject({ started: [], music: [] });

 await tap(240, 690); // Settings, an ordinary pointerdown/pointerup button.
 await expect.poll(async () => (await read()).ended).toBe(1);
 const [clickDuration] = (await read()).started;
 expect(clickDuration).toBeLessThan(0.02);
 await expect.poll(async () => (await read()).music).toEqual([
  { loop: true, paused: false, time: expect.any(Number) },
 ]);
 await expect.poll(async () => (await read()).music[0]?.time ?? 0).toBeGreaterThan(0);

 await tap(240, 667); // Close settings.
 await tap(240, 412); // Open journal.
 expect((await read()).started).toEqual(Array(3).fill(clickDuration));
 for (const tab of [2, 3, 4, 5, 6, 1]) {
  const x = 60 + (tab - 1) * 72;
  const before = (await read()).started.length;
  await tap(x, 174);
  expect((await read()).started.slice(before)).toEqual([clickDuration]);
  await tap(x, 174);
  expect((await read()).started.slice(before)).toEqual([clickDuration]);
 }

 await tap(240, 756); // Back to menu.
 await tap(240, 580); // Classic.
 const beforeDrag = (await read()).started.length;
 await drag(page, 0, 0, 0);
 const { started, music } = await read();
 expect(started.slice(beforeDrag)).toHaveLength(2);
 expect(started[beforeDrag]).toBeGreaterThan(0.15);
 expect(started[beforeDrag + 1]).toBeGreaterThan(0.15);
 expect(music).toHaveLength(1);
});
