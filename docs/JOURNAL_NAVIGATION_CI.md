# Journal navigation and CI performance

Base: `dev` at `2593ddf306ad6e0e863443ca633fd5362656f80b`. Draft PR #18; no merge.

## Journal

Six full-size 120px cards plus five existing 15px gaps would require 795 logical pixels before either header or footer. Six cards cannot fit the authored 480×800 frame without shrinking the approved design. The journal therefore uses six display chapters of three orders each, preserving the 416×120 cards, title/status typography, surfaces, positions and spacing.

| Display chapter | Theme RU / EN | Global orders |
|---|---|---|
| 1 | Первые фрагменты · I / First fragments · I | 01–03 |
| 2 | Первые фрагменты · II / First fragments · II | 04–06 |
| 3 | Мозаика · I / Mosaics · I | 07–09 |
| 4 | Мозаика · II / Mosaics · II | 10–12 |
| 5 | Узоры · I / Patterns · I | 13–15 |
| 6 | Узоры · II / Patterns · II | 16–18 |

The existing historical `OrderConfig.chapter` and IDs remain unchanged. `CHAPTERS` owns display membership; `displayChapterForOrder()` selects the correct journal after entry, replay, Next order, victory or defeat. No storage keys, schemas, boards, fragments, title strings, figure generation or completion IDs change.

Only the upper row of six centered numeric tabs remains. Each hit area is 66×66 logical pixels (44×44 CSS pixels at a 320px portrait viewport), with 6px logical gaps. The old page state, arrows and handlers are removed. The journal creates neither a header Back surface nor its zone. The existing 360×56 primary button at (240,756) now says Назад / Back and navigates to the menu for incomplete and completed campaigns alike.

Esc already routes journal → menu and keeps existing campaign exit confirmation behavior. The project has no Android hardware/browser-history Back bridge; this change adds none. Physical Android and Yandex draft QA remain separate from viewport/CDP emulation.

## CI diagnosis

Baseline merge run: [43856789966](https://github.com/whil3true/block_workshop/actions/runs/43856789966).

| Baseline | Actual time |
|---|---:|
| Chromium attempt 1 E2E | 61m43s; 127 passed, order-18 defeat/retry timed out twice |
| Chromium attempt 1 job | 62m43s |
| Chromium successful retry E2E | 33m54s; 128 passed |
| Chromium successful retry job | 35m17s |
| Firefox E2E / job | 3m37s / 4m24s |
| WebKit E2E / job | 8m00s / 9m29s |
| Workflow including failed attempt and delayed rerun | 105m01s |

On the failed Chromium attempt the campaign consumed about 40m28s including retry, drag-preview 9m07s and backdrop 5m14s. The 90s failure occurred in real `mouse.move` / `mouse.up`, not an assertion. Browser installation cost only 21s (Chromium), 19s (Firefox), 51s (WebKit). The successful rerun used 33m54s with unchanged code: substantial host/software-rendering variance is real. The existing trace already disables per-action screenshots; pixel comparisons in drag/backdrop tests are intentional coverage and remain intact.

## Changes to CI and tests

- Build/typecheck/unit/assets/dist checks execute once on Node 22. All browser runners download that exact `production-dist` artifact and keep npm cache.
- Four Chromium shards, one worker each. `fullyParallel: true` permits individual campaign tests to be sharded; `workers: 1` still prevents concurrent software-WebGL scenes on a runner. Firefox and WebKit remain complete mandatory jobs.
- Every test gets a fresh Playwright context/localStorage. No shared page fixture, serial dependency or fixed secondary server port is introduced. The existing Pages-subpath server uses an ephemeral port.
- Artifacts have unique browser/shard names, include JSON durations and blob reports, and retain screenshots and retry traces. No tests are removed, skipped for speed, or marked continue-on-error. The existing Chromium-only CDP case remains Chromium-only.
- One current gesture geometry read replaces four separate browser round trips in `drag()`. It reads current safe-area/Canvas bounds on each gesture; pointer down, three moves, pointer up and two animation frames remain unchanged.
- The long order-18 scenario is split into the full original crowding/defeat/journal path and a second independently generated five-move real defeat followed by the complete free retry → victory path. Final-order replay is a separate complete Canvas journey. All five new chapter boundaries are exercised through the actual Next order action.
- Normal feature changes run once through pull_request rather than duplicate push + PR workflows. Superseded PR runs cancel through a per-PR concurrency group.
- Pages build uploads once. `deploy-pages` requires both build and the entire verify matrix, and only runs for a push to `dev`. Draft PRs, branch pushes and manual feature runs cannot publish.

## Validation and evidence

`npm run check` on Node 22 passes: 607 unit tests, typecheck, 31 existing raster assets, production build and dist validation. The final browser matrix has 136 tests per project (four Chromium shards of 34); two pre-existing CDP-only tests skip in non-Chromium browsers by design.

Local Chromium terminal-flow checks pass: original order-18 defeat → chapter 6 (18.5s), shorter real defeat → full free retry victory (17.0s), completed final-order replay (11.3s). Journal tests cover all 18 completed orders, former invisible control areas, Back/Esc, Classic persistence, both locales and 320/360/393px widths. Landscape/desktop tests inspect all six chapters and measure every title at its unchanged font size.

Screenshots in `evidence/journal-navigation/` include Android user-agent + touch emulation at 320/360/393px, plus landscape/desktop viewport checks; they are not photographs from physical Android. Full current CI results and before/after shard measurements are linked in the PR description and included in the delivered QA report once the run completes.

GitHub pull_request CI checks the synthetic merge with current `dev`. A real post-merge `push`/Pages deployment cannot be executed without merging; merge is explicitly outside this task. That post-merge observation remains pending.

Local renderer probe confirms ANGLE / Vulkan SwiftShader software WebGL with real raster art: frame p50 50.1ms, p95 83.4ms, max 133.3ms across 120 frames. The renderer test now records the actual driver beside its existing frame timings. No render mode or browser launch flags are changed to obtain speed.

Reviewed mobile evidence: [RU 320px](evidence/journal-navigation/journal-ru-320-chapter-1.webp), [EN 320px](evidence/journal-navigation/journal-en-320-chapter-1.webp). Final-chapter, other-width, landscape and desktop captures are included in the accompanying QA archive.

The six Android user-agent/touch navigation checks pass in 18.1s locally. The updated first-three-orders journey passes in 24.7s after replacing its obsolete journal-arrow click with the new bottom Back button.

The first complete matrix exposed two WebKit retry-only passes: a click immediately after Escape could precede creation of the warning's Canvas zones, and Classic's reload journey used two frames without waiting for async startup readiness. Both tests now wait for their real preconditions (rendered warning / `aria-busy=false`), preserving all actions and assertions without sleeps or larger timeouts.
