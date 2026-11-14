# Target fragment orders — campaign rules v2

Base: `dev` at `6dd87d31413b1ceed133f618423d17232260083e`. Feature: `feature/target-fragment-orders`, Draft PR into `dev`. No merge or Pages deployment.

## Rules and state

Orders use the unchanged classic placement and simultaneous line-clear engine. Victory requires removal of **all original marked tiles**, in any order. Clearing a line of ordinary tiles earns the existing score but no target progress. Fragment membership never depends on texture, color or current occupancy.

`OrderConfig.fragments` records fragment IDs, localized names and immutable row-major addresses (`row*10+col`). `CampaignAttempt.remainingTargets` holds a distinct subset of those addresses. A clear filters the union of its rows and columns once, including intersections. Placement never adds addresses to this set. Refilling a cleared target coordinate therefore creates an ordinary tile. Individual and total counters derive from immutable fragments plus the remaining mask, avoiding divergent stored counters.

There is no active operation, `stage`, `count`, direction gate or spillover rule. Fragment cards are peers. Each card opens its own silhouette and counters. Removed cells remain faint with ticks in the silhouette even when new ordinary tiles occupy the same board coordinates. The approved raster `cross.png` is reused as a mosaic seal on original targets. No new art files, SVGs, economy or orders were added.

| Order | Original target fragments | Main solution | Recovery after a wasted piece |
| --- | --- | --- | --- |
| 01 — Первый фрагмент / The first fragment | A: horizontal 4 cells | 3 moves | 4 moves |
| 02 — Два фрагмента / Two fragments | A: horizontal 4; B: vertical 4 | 3 moves; either direction first | 3 moves |
| 03 — Разделённая мозаика / A divided mosaic | A: L of 4; B: horizontal 3; C: vertical 3 | 5 moves; A is partially removed after move 1 | 7 moves |

The second order also has a two-move solution: prepare the column, then clear both axes and both fragments together. These are hand-authored constructive traces, replayed through `placeCampaign` and real Canvas drags. They establish feasibility, not human difficulty or balance. Fixed trays teach the targets; after their prefix, the existing sampler continues with serialized xorshift32. No move limit or timer was added.

## Human-readable solutions for device QA

All coordinates here are **one-based**: rows from the top, columns from the left. Tray slots: L = left, M = middle, R = right. Pieces do not rotate.

| Order / route | Sequence: slot → (row, column) |
| --- | --- |
| 01 | L → (9,5); M → (9,8); R → (9,10) |
| 01, mistake + recovery | R → (1,1); L → (9,5); M → (9,8); new L → (9,10) |
| 02, horizontal first | L → (8,6); M → (5,8); R → (8,8) |
| 02, vertical first | M → (5,8); R → (8,8); L → (8,6) |
| 02, simultaneous | M → (5,8); L → (8,6) |
| 02, mistake + recovery | R → (1,1); M → (5,8); L → (8,6) |
| 03 | L → (5,4); M → (7,7); R → (10,1); new L → (5,1); M → (5,7) |
| 03, mistake + recovery | R → (10,5); L → (5,4); M → (7,7); new L → (5,7); M → (10,1); R → (10,7); new L → (5,1) |

## Storage and recovery

Campaign v2 uses only `block-workshop:campaign:v2`, envelope `schemaVersion:2`, `catalogVersion:2`, `targetRulesVersion:2`; each order has `contentVersion:2`. Active snapshots also require `targetRulesVersion:2`. Old stage/count snapshots are never interpreted as target progress.

If v2 does not exist and the old test campaign key exists, v2 starts empty with an explanatory notice. The notice persists until acknowledged in the journal. The old key is retained and never used for gameplay. Classic saves, records, language and audio keys are untouched. If storage is denied, gameplay remains available in memory.

Validation checks board/tray shape, known families/pieces, nonempty RNG state, numeric bounds, consumed-tray cursor, unique target subset, occupied original target tiles, initial state, terminal status and available placements. A malformed active attempt is discarded while a valid prefix of completions is retained; incompatible envelopes reset only campaign state. A recovery notice explains the free restart. No `localStorage.clear()` is used by production code.

Only one campaign attempt is retained, as before. Selecting a different order replaces that campaign attempt. Completed orders remain replayable for free. Result navigation uses the existing shared transaction with advertising disabled; classic advertising is unchanged.

## UI and raster rendering

- Mode cards share 416×144 logical geometry, identical title/subtitle/action baselines, centered icons and full-card touch zones. Checked RU/EN, Play/Continue and long/compact record text.
- Back icon crops the existing PNG's transparent padding `(39,24,70,81)` as a Phaser frame. It keeps the same central position and unchanged 66×66 hit area; no binary edit.
- One CSS paper surface spans the browser behind a transparent Canvas. The centered 480×800 composition and 440×440 field stay fixed. The paper URL derives from Vite's relative base and `document.baseURI`, so `/block_workshop/` resolves correctly. No missing-art background request is emitted in a fallback build.
- Existing nine-patch raster panels are cached once per texture/size/density as Canvas textures. This preserves raster materials, supports Phaser's Canvas renderer (its native NineSlice renderer is a no-op) and avoids rebuilding panel geometry every frame. All 31 original SHA-256 entries remain unchanged.

## Verification

Run `npm run check` on Node 22, then `EXPECT_COZY_ART=1 npm run test:e2e` against the complete 31-file pack. Tests cover all main/recovery solutions, both axis orders, simultaneous clears, intersections, partial masks, replacement cells, snapshot corruption, migration, independent classic persistence, free victory/defeat retries, shared pause/ad lifecycle, live RU/EN, 320/360px layouts, landscape/desktop/resizing and native Chromium touch.

`tests/e2e/render.spec.ts` verifies visible raster panels on Canvas fallback and records 120 real animation-frame intervals to `raster-frame-times.json`. A one-second stall fails the check. Existing assertion and journey timeouts were not increased. Production screenshots come from actual game renders; none is a generated mockup.

For optional-art fallback verification, temporarily stage the 31 binaries outside `public/assets/cozy-mosaic`, retain the manifest, run the checksum gate (0/31), build separately and run `EXPECT_COZY_ART=0` browser checks. Restore the original files and hashes afterwards. Do not commit binary removals or regenerate hashes.

## Assets and Android handoff

**No manual image upload is needed.** All 31 images already exist in the base branch. This PR changes only source, tests and documentation; no PNG/WebP is added or changed. An asset ZIP/contact sheet would duplicate existing files and is intentionally unnecessary.

The feature branch does not deploy GitHub Pages: hosting still deploys only after a push to `dev`. For device review, download CI's `build-and-results-chromium` artifact and use its `dist` directory, or the supplied preview ZIP. For a Yandex draft, package the **contents** of dist with `index.html` at the archive root. Do not submit for moderation as part of this work.

Physical Android QA remains required:

1. In RU and EN, inspect equal mode-card padding, Play/Continue and centered Back arrow at the actual browser scale.
2. Follow all three main solutions; verify the target seals and per-fragment removed/remaining counts. Repeat order 02 using vertical-first and simultaneous routes.
3. In order 03 after the first clear, A must show 2/4 removed, B 3/3, C 0/3 and total 5 left. Reload and resume: all counts and the remaining tray must match.
4. After consuming the first tray in order 03, place the new left single at (5,2), an already-cleared target coordinate. It must remain ordinary; A stays 2/4. Reload and inspect the A silhouette.
5. Try the mistake/recovery paths; inspect real defeat and free retry. Report how quickly the goal is understood, accidental drops, legibility and felt difficulty. Do not infer balance from scripted solutions.
6. Rotate portrait ↔ landscape; inspect the full paper backdrop, unchanged board proportions, no scroll/zoom and drag cancellation during rotation/backgrounding.
7. Switch back to an existing Classic game: board, tray, record, language, audio sliders and existing ad scenarios must remain intact. Run live Yandex draft SDK/ad checks separately; desktop mocks are not device tests.

Keep the PR in draft for that review. No merge was performed.
