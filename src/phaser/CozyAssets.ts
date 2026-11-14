import Phaser from 'phaser';
import manifest from '../../public/assets/cozy-mosaic/asset-manifest.json';
declare const __COZY_ASSET_IDS__: readonly string[];
export function preloadCozyAssets(scene: Phaser.Scene): void {
 for (const asset of manifest.assets) {
  if (__COZY_ASSET_IDS__.includes(asset.key)) scene.load.image(`cozy-${asset.key}`, `${import.meta.env.BASE_URL}${asset.path.replace(/^public\//, '')}`);
 }
}
/** Optional art never changes geometry, input, or game rules. */
export function paperSurface(scene: Phaser.Scene, key: string, x: number, y: number, width: number, height: number, fallback = 0xfff8f1): Phaser.GameObjects.GameObject {
 const texture = `cozy-${key}`;
 if (scene.textures.exists(texture)) {
  const spec = manifest.assets.find(a => a.key === key);
  if (spec && 'slice' in spec) return scene.add.nineslice(x,y,texture,undefined,width,height,32,32,32,32);
  return scene.add.image(x,y,texture).setDisplaySize(width,height);
 }
 return scene.add.graphics().fillStyle(0x594236,0.08).fillRoundedRect(x-width/2,y-height/2+3,width,height,14)
  .fillStyle(fallback).fillRoundedRect(x-width/2,y-height/2,width,height,14);
}
