# Paper Mosaic — campaign vertical slice

Base: `dev` at `a3c75a1bbee0a10c012b329e898db0998ec92b64`. Target: Draft PR into `dev`, branch `feature/cozy-mosaic-campaign`. No merge and no feature deployment to Pages.

## Delivered behavior

Two independently saved modes share the existing Phaser scene, SDK, AudioManager, PauseGate and AdFlow. The classic `engine.ts`, `model.ts`, `pieces.ts` and `storage.ts` are unchanged. Board geometry remains 480×800 / 10×10 / 440×440, with three tray slots and the original touch lift.

Only three orders are released:

| Order | Operations | Verified solution | Recovery after one misplaced piece |
| --- | --- | --- | --- |
| 01 — The first strip | Any horizontal row | 3 moves | 4 moves |
| 02 — A change of direction | Horizontal, then vertical | 3 moves | 7 moves |
| 03 — A precise pattern | Row 5, then column 7 | 4 moves | 7 moves |

Rows count from the top, columns from the left. The simultaneous-clear event can advance only the currently active operation. Wrong-axis clears are legal. Victory is checked before a blocked tray. No timer, move limit, campaign rewarded replacement, currency or stars were introduced. All campaign retries are free; existing classic advertising remains in place. Campaign result navigation uses the shared transaction with advertising disabled for this slice.

The checked prefixes contain fixed trays; after them the existing weighted sampler continues using serialized xorshift32 state. Reload saves the current board, partly consumed tray, cursor, RNG, operation, score, streak and terminal state. Completion and the completed-ID set are persisted together in one envelope, including the result so it can be restored. Only one active campaign attempt is retained; selecting another order replaces that campaign attempt, without touching classic.

`CHAPTERS` supports three chapter entries; its order IDs derive from the catalog. The journal supports up to six entries per chapter (two columns when needed). Chapters 2/3 currently contain no orders and have no actionable future-content buttons. There are no fake orders 04–18.

## Files

- `src/campaign/CampaignCatalog.ts`: released boards, versioned goals and fixed trays, chapter metadata, unlock policy.
- `src/campaign/OrderRules.ts`: pure operation reducer for axis counts, addresses and intersections.
- `src/campaign/CampaignSession.ts`: deterministic placement transaction and controller; it reuses the unchanged board engine.
- `src/campaign/CampaignStore.ts`: independent `block-workshop:campaign:v1` envelope, validation and recovery of damaged active attempts while retaining recognized completions.
- `src/phaser/CozyAssets.ts`: optional preload, raster surfaces and functional fallback.
- `public/assets/cozy-mosaic/asset-manifest.json`: exact asset paths, dimensions, slice borders, purpose and SHA-256. **Images intentionally absent from this PR.**
- `public/fonts/Nunito.woff2`, `public/licenses/OFL-Nunito.txt`: self-hosted RU/EN font and license.
- `scripts/check-cozy-assets.mjs`: complete-pack and SHA-256 gate, accepting either 0/31 (fallback) or 31/31 (art).
- `tests/campaign.test.ts`, `tests/campaign-witnesses.ts`, `tests/e2e/campaign.spec.ts`: solutions, recovery solutions, persistence, boundaries and full browser journeys.
- Existing scene, UI primitives/tokens, localization, bootstrap, AdFlow and browser tests are updated to the new composition. No second platform or audio lifecycle was added.

## Visual production and verification

The separate asset ZIP contains 31 PNG/WebP files: generated paper materials and a transparent paper-collage emblem, cropped/composited into reusable tile and UI surfaces; small icons and the shared stamp are raster manufactured. There are no SVGs, per-order artworks, baked labels or fullscreen mockups. Text and all game values are Phaser Text. Default/pressed/disabled surfaces are separate raster files; outlines remain only for functional drop feedback.

A build-time presence list prevents missing-art requests in CI. After a complete manual upload, the next build loads the exact same paths automatically. The manifest gate rejects a partial or modified pack so a mistaken upload is visible in CI. `npm run build` itself remains able to render individual missing textures through fallback.

Local validation: Node 22.23.5, 482 unit tests; 23 Chromium production E2E with the real 31-file pack. It covers full solutions through drag, partial-tray reload, defeat/retry, classic regression, RU/EN, six viewport/orientation cases, native touch emulation and SDK/ad mocks. Actual rendered screenshots include menu, classic, all three orders, address markers, journal, settings, goal details and results. A separate no-art production/E2E run verifies the code-only PR state. See the delivered report for final remote CI status.

Balance evidence: there are 240 / 205 / 211 legal initial placements respectively; none immediately causes defeat. Each order also has a verified recovery solution after a misplaced piece. These are short introductory tasks, not a measured 1–2 minute experience. Scripted solutions and branch counts do not establish human difficulty or retention.

Physical Android ergonomics/audio/background behavior and live Yandex ads still require the existing `docs/ANDROID_YANDEX_QA.md` device/draft gate. Desktop browser emulation is not physical Android QA.

## Manual image upload — no code changes required

1. Extract `block-workshop-cozy-mosaic-assets.zip`.
2. In GitHub select **feature/cozy-mosaic-campaign** and open **public/assets/cozy-mosaic**.
3. **Add file → Upload files**. Upload the **31 PNG/WebP files** from the archive's `public/assets/cozy-mosaic` directory. The same manifest is already in the PR. Do not upload the ZIP itself, root contact sheet, root README or checksums into the game folder.
4. Commit to **feature/cozy-mosaic-campaign**. Do not select `dev` or `main`. This updates the existing Draft PR and automatically reruns the quality workflow.
5. Confirm all three browser jobs pass and the log says **Cozy assets: 31/31 · SHA-256 verified; raster build**. Zero means the files were uploaded at the wrong path. A partial count or hash error identifies an incomplete/wrong pack; replace with the exact files from the ZIP.
6. For the resulting build, download the workflow artifact **build-and-results-chromium** and use its **dist** directory. To upload to a Yandex draft, ZIP the **contents** of dist so `index.html` is at the ZIP root. Alternatively the separately supplied `block-workshop-cozy-mosaic-preview.zip` already contains the tested art build in that layout.
7. On Android check all three orders, a mistaken move, reload in the middle of a tray, return to classic, RU/EN, volume controls, rotation and background/return. Check live advertising in the draft separately. Keep the PR in draft until visual/device review; merge only by the user's decision.

Uploading art to the feature branch does not deploy Pages: the existing workflow only deploys on a push to `dev`. The supplied preview ZIP is not published by this work.
