# Block Workshop

- Work in this standalone Phaser 4/TypeScript project. The Cozy Gallery repository is a read-only donor; never modify, push or merge it.
- Do not push directly to `main`. Use feature branches from `dev`; never push directly to `main` or `dev`.
- Preserve `engine.ts` / `pieces.ts` rules and the 10×10 / 37-shape baseline unless a separate design decision authorizes a change. The Phaser migration is explicitly authorized. All ordinary game UI must remain inside Canvas.
- Platform promises settle on ad callbacks; SDK pause/resume owns an independent PauseGate reason. Do not add a wait for SDK resume to navigation, or synthesize resume.
- Reward only on `onRewarded`, once per session, in a safe state. Keep session/revision/dispose protection.
- Preserve MIT/Vite notices and provenance. Do not copy media from the donor without checking the specific files.
- Use a new storage namespace. Never clear unrelated localStorage entries.
- Run `npm run check` on Node 22 after code changes. CI also defines Playwright production smoke, but do not report it as passed until it actually ran.
- Real Android and Yandex draft QA are pending. jsdom, SDK mocks and desktop Chrome are not physical Android tests.
- Product status remains MVP until docs/ANDROID_YANDEX_QA.md and publication tasks are complete.
