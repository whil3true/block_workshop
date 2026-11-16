# Campaign verification

`npm run check` completed on Node 22.23.5: typecheck, 595 tests in 26 files, 31/31 raster checksums, production build and distribution checks passed.

All 18 primary and all 18 recovery traces are replayed through `placeCampaign`; the old three-order v2 completion prefix unlocks order 04 without a migration or lost completion.

The local managed shell cannot launch Chromium because its process-singleton Unix socket is denied. Browser validation therefore runs through the repository's unchanged GitHub Actions Chromium/Firefox/WebKit matrix. Final results and screenshot locations will be recorded here after those jobs complete. No test timeout or assertion was relaxed.
