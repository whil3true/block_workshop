# Phaser 4 migration

Source snapshots (read-only donor):

- Block Workshop `dev`: `5935614d35d339b6030caaa380df873bc2a28bde`.
- Cozy Gallery `dev`: `da4a7612c870ce75d678b939a491157ae3670883`.

## Architecture and reuse

| Area | Production implementation | Origin |
| --- | --- | --- |
| Rules | `engine.ts`, `pieces.ts`, unchanged | Block Workshop: 10×10, 37 shapes |
| Session | `model.ts`, DOM-free extraction of `game.ts` | Original scoring, line/streak/perfect bonus, RNG/tray/refill, game over, reward session/revision guards |
| Persistence | `storage.ts`, version 1 envelope and existing keys | Block Workshop, no migration or key reset needed |
| Render density/camera | `phaser/Display.ts` | Cozy 480×800, EXPAND, bounded startup density 1–2× and logical camera |
| UI | `phaser/UiPrimitives.ts`, `UiPolicy.ts`, `AudioVolumeSlider*.ts` | Cozy hit areas, button states, full viewport modal blockers and pointer-capturing sliders |
| Appearance | `VisualTokens.ts`, `BoardGeometry.ts`, `WorkshopScene.ts` | Cozy token structure adapted to the existing Block Workshop dark palette and piece colors; no donor artwork/fonts |
| Screens | `WorkshopScene.ts` | Menu, gameplay, settings, restart/reward confirmation, game over, pause/navigation covers, inside Canvas |
| Platform | `platform/*`, `app/AdFlow.ts`, `PauseGate.ts` | Retain existing Cozy-derived Block Workshop implementation; one advertising controller |
| Localization | `LocaleRuntime`, `Localization`, `WebLocaleStore` | Cozy-derived saved-choice-first RU/EN; resolved before scene construction; first resolved locale persisted |
| Audio | `audio/*`, `AudioRuntime.ts` | Retain existing Cozy-derived shared manager/output/lifecycle, Block Workshop synthesized WAV events and two volume settings |

`app/bootstrap.ts` owns services and listeners before creating Phaser. The scene
consumes them, rather than instantiating competing platform/audio owners.
LoadingAPI.ready follows the first enabled menu render and remains held during
SDK/browser startup pause. GameplayAPI follows actual gameplay availability.

The model retains the exact placement/scoring algorithm. The pointer targets the
first bounding-box cell, with a 40 logical pixel lift for touch; world coordinates
come from the active camera. Invalid/out-of-board drops never mutate the session.
Resize, pointer cancel, browser/SDK pause, and opening a modal cancel a drag.

## Advertising guarantees

- Interstitials remain tied to deliberate confirmed restart, with the existing
  90-second cooldown and 15-second failed-attempt retry interval.
- Ad callbacks settle navigation immediately, independently of SDK resume. The
  new session is committed before the navigation cover is removed. SDK/browser
  pause retains its independent ownership of input/audio/gameplay signals.
- Reward video is explicitly confirmed; grants require onRewarded. Once per
  session; prepared offers carry session/revision. The result is staged until all
  pause owners release. Duplicate/late callbacks cannot grant twice.
- Standalone web never fabricates a successful ad. Reward controls are disabled
  there. SDK initialization failure on a platform host does not silently use Web.

## Compatibility

Retain `block-workshop:lastGame`, `bestScore`, `audio-settings`, `ui-locale` and
schemaVersion/rulesVersion 1. Board families, tray IDs/null slots, score, streak,
reward-used state, record and two volumes are loaded unchanged. Finished saved
sessions start a fresh playable game from the menu. Unfinished sessions survive
Menu/Continue and reload. The retired legacy mute key stays false; its old button
is absent.

## Verification and risks

Original baseline: 432 passing unit tests. Current suite: 444 tests, including
12 new production-model/parity/locale/geometry/defeat checks. All baseline tests are retained; original DOM
components are isolated under `tests/legacy` as a behavioral oracle, never imported
by production. Snapshot/reward regressions run against the production model.
Eight seeded 100-move parity runs compare complete state, sound event priority,
reward grants and restart against the frozen controller. Core `engine.ts` and
`pieces.ts` remain byte-identical to the base commit.

Active Playwright tests drive actual production Canvas through pointer coordinates
and assert persisted outcomes, without adding debug controls to the game. They
cover mobile, desktop, landscape, rotation, edge placement, invalid drops,
refill/clears/perfect score, settings, reload, defeat, native Chromium touch,
double-tap protection, and SDK mock callbacks/independent pauses. Old DOM browser
specs are retained under `reference/dom-e2e` for historical reference only.

Local Chromium cannot start in this executor because AF_UNIX sockets are denied;
local browser downloads also return truncated archives. GitHub Actions installs
and runs Chromium, Firefox and WebKit on Ubuntu 24.04 and retains screenshots and
failure traces as artifacts. The final report must record actual CI results.

Real Android touch/audio/background behavior and actual Yandex advertising still
require device/platform QA. SDK mocks are not evidence of real advertisement
integration. The build is larger because it now embeds Phaser; the existing 5 MiB
uncompressed package gate remains enforced. Local stores remain local, with no
cloud-save promise.

## Licensing

MIT notices for 10block/Vite remain intact. Phaser 4.2.1 is pinned and its MIT notice
is redistributed in `public/licenses`. Donor components are reused under explicit
project-owner authorization; the donor snapshot has no general LICENSE file, so
no blanket open-source license is inferred. No donor logos, chapters, media,
artwork, music, fonts, or campaign data are included.

## Browser evidence review

Production screenshots from Actions run 43183185664 were visually reviewed for
393×852 mobile gameplay, RU settings with both sliders, 320×568 and 1920×1080
layout. Buttons, board and localized text fit. Native Chromium touch drag,
double-tap scale protection and browser-pause cancellation passed. Firefox and
WebKit both confirmed all SDK mock callback/ownership scenarios.

The initial defeat fixture accidentally cleared nearly every row/column and was
therefore still playable. It is replaced with a diagonal-hole board which the
production unit test proves reaches game over after the specified move. Chromium
completed the long settings/reload/restart journey up to its final reload before
the default 30-second per-test deadline; the suite now allows 60 seconds for
hosted software WebGL, while individual assertion timeouts remain unchanged.
Every final browser scenario additionally rejects uncaught page errors.

The PR remains a draft. Physical Android and real Yandex ads are pending.
