import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Presence is resolved per build. CI without art never requests missing textures;
// uploading the pack and rebuilding enables it with exactly the same game code.
const manifest = JSON.parse(readFileSync(new URL('./public/assets/cozy-mosaic/asset-manifest.json', import.meta.url), 'utf8')) as { assets: { key: string; path: string }[] };
export default defineConfig({
 base: './', server: { host: '0.0.0.0', port: 5173 },
 define: { __COZY_ASSET_IDS__: JSON.stringify(manifest.assets.filter(a => existsSync(resolve(a.path))).map(a => a.key)) },
});
