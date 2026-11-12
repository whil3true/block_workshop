# Frozen DOM comparison harness

These are the original rendering/controller modules from Block Workshop dev
5935614. They exist only for the retained baseline regression suite and seeded
behavior comparisons against src/model.ts. Production imports none of these
files. Their imports of shared engine/platform/storage modules are redirected to
src so all core platform and rule regressions still run against maintained code.
Old DOM browser specs are preserved under reference/dom-e2e; active E2E lives in
tests/e2e and drives Phaser Canvas.
