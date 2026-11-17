# SDK language persistence and Classic advertisement pause QA

Date: 2026-11-17 (Europe/Moscow). Base: dev at
`53eed52cd74bc485ec41a0dc28d5291e0112b168`.

## Language fix

Previously LocaleRuntime saved the resolved startup language whenever no value existed.
Consequently an SDK-derived default became indistinguishable from an explicit player preference;
future debug Language settings lost to that saved value. Clearing the HTTP cache does not
necessarily remove localStorage.

Startup now reads the existing preference and resolves the current SDK language without writing.
Only LocaleRuntime.set with a different language writes the existing
`block-workshop:ui-locale` key and notifies subscribers. Selecting the active RU/EN button does
nothing, including no storage write and no redraw notification. A real change still updates the
interface immediately without reloading. If storage is denied, the session can still switch language.

| Stored value | SDK value | Result / startup write |
| --- | --- | --- |
| None | ru / ru-RU | ru / none |
| None | en / en_US | en / none |
| None | Other nonempty language | en / none |
| None | Missing, empty or whitespace | Existing DEFAULT_LOCALE (ru) / none |
| ru or en | Any | Stored value / none |
| Invalid value | Any | Resolve from SDK/fallback; do not erase or rewrite the invalid entry |

YandexPlatform retains its existing missing-language default of ru. createPlatform waits for SDK
initialization before bootstrap constructs LocaleRuntime. The SDK language is sampled at startup;
changing the debug panel must be followed by restarting/reloading the game. Hot updates from the
debug panel are not an SDK language-change subscription.

The current Cozy Gallery dev implementation was inspected read-only: WebLocaleStore,
MainMenuScene.selectLocale, UiLocaleRuntime and main.ts. It resolves startup without saving and
ignores selecting the already active language. Block Workshop now follows those rules using its
existing live locale subscription.

## Conservative legacy compatibility

Keep the existing plain ru/en format and key. No migration writes, new keys, provenance guesses or
storage clearing. A historical value may have been automatic or manual; it remains authoritative
to avoid losing a possible real choice. New installations have no automatic preference; all new
language writes are caused by an actual in-game switch. This distinction is behavioral, not a
claim that old ru/en values have known provenance.

Classic snapshots, best score, campaign progress and audio preferences are untouched. An old
installation can continue using the historical value until the player changes it or a developer
explicitly resets only the locale preference.

### Reset only language during real SDK debug QA

In DevTools select the game's iframe execution context and run:

```js
localStorage.removeItem('block-workshop:ui-locale');
```

Then set debug Language and reload/restart the game in the same draft. Do not clear all site data,
call localStorage.clear(), or remove any other key. The console command is a developer QA action,
not automatic production migration. If a valid old value remains, its priority is expected.

## Classic advertising finding

No advertising runtime defect was reproduced by the added controlled-clock integration tests.
Ad code, threshold, cooldowns, rewarded behavior, UI and countdown behavior remain unchanged.

The official [advertising placement requirement §4.4](https://yandex.ru/dev/games/doc/ru/requirements/4/4)
was checked on the date above. It distinguishes conditional turn-based games from real-time games.
For the former it specifies advertising immediately after an action without a warning, with no
intentional delay; the maximum action-to-ad delay is two seconds. Applying that classification to
Block Workshop is our engineering interpretation: a player completes an independent tile placement.
The two-second warning applies to the documented long real-time case.

The 90 active seconds only enable the next safe completed placement; update/idle/held drag cannot
trigger a request. WorkshopScene.release calls model.place (including synchronous save) before
tryClassicIntermission. AdFlow acquires transition before calling the controller. Input and audio
stay blocked during the transaction. onOpen adds the ad cover. Terminal close/error/no-fill clears
only transaction-owned pause reasons; SDK and browser reasons remain until their own resume.
There is no invented readiness API or forced SDK resume.

| Check | Evidence |
| --- | --- |
| Drop and save finish before actual SDK call | New scene + real model + controller + YandexPlatform integration test asserts saved board/score at showFullscreenAdv |
| One transaction / no repeated drop | Concurrent intermission and repeated release rejected; revision and saved snapshot remain unchanged |
| Audio pauses and resumes correctly | Real AudioManager driven by PauseGate and shouldSuspendAudio, with observable output |
| Successful advertisement, no-fill, error before/after open | New controlled-clock integration cases; existing SDK watchdog cases retained |
| Duplicate/late callbacks | Cover opens once; terminal callbacks cannot replay placement or re-open transaction |
| Close before SDK resume | Transaction finishes; sdk pause still blocks input/audio |
| SDK resume before close | Transition/ad still block until terminal callback |
| Background during advertisement | SDK resume alone cannot release browser pause; pageshow required |
| Watchdog recovery | Existing pre-open/post-open fake-timer tests retained; watchdog never synthesizes SDK resume |
| Control returns and progress survives | Next fresh placement succeeds once after all reasons release; browser tests also reload save |

A brief transaction pause is normal. If the advertisement has closed but SDK still holds pause,
remaining paused is intentional. A persistent pause after terminal callback, real SDK resume,
foreground/focus restoration and release of held input would be a defect; record those events
before diagnosing it.

## Automated validation

- New language unit cases cover SDK changes across launches, no auto-write, live manual changes,
  active-button no-op, legacy/invalid values, unrelated saves and unavailable storage.
- New Classic integration cases use injected monotonic time and fake watchdog timers; no test
  waits 90 real seconds.
- Production E2E adds SDK ru/en restart/manual/legacy/fallback cases and Classic callback ordering,
  no-fill/error/background/duplicate cases at 393×852. Existing all-orders, native Chromium touch,
  RU/EN, viewport, save and input suites remain enabled.
- CI workflow, Playwright configuration, four Chromium shards, Firefox/WebKit jobs, Pages and
  upload-ready ZIP workflow are unchanged. The current PR's checks are authoritative.

Local Node 22 `npm run check` passed (typecheck, raster checksums, all unit tests, build and dist audit).
Browser binary download in the local executor returned a truncated archive; local browser passes
are not claimed. The unchanged GitHub Actions jobs execute the complete production suite.

## Short real-draft recheck

1. Take the upload-ready ZIP only from this PR's green run and upload it to the existing draft.
2. Note existing Classic score, completed orders and sound levels. Reset only the locale key using
   the command above. Set SDK ru, reload: Russian and no locale key. Set SDK en, reload: English
   and still no locale key. Repeat in reverse.
3. Press the active language: key remains absent. Switch to the other language: key appears with
   that value immediately. Repeat the active press: no new write. Reload with the opposite SDK
   language: the manual value wins. Repeat EN → RU.
4. Confirm a historical ru/en value still wins until explicitly reset; score, orders and sound
   remain intact after locale-only reset.
5. Play Classic for 90 active seconds, including a held drag near the boundary. Advertisement
   requests only after a valid completed drop. Record drop-to-ad timing in the real draft.
6. Close a real advertisement; test unavailable/no-fill and network error where reproducible.
   The saved drop remains once, no double request/drop, and a fresh drag works after SDK resume.
7. Background the tab/app during an advertisement, then return and release held touches.
   Input/audio resume only after SDK and browser/focus pauses clear. Reload and verify the save.

These mocks and desktop-engine viewport tests do not certify real ad delivery, physical Android
audio or moderation approval. The real draft recheck above remains required.
