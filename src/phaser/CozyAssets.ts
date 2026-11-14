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
  if (spec && 'slice' in spec) return scene.add.image(x,y,rasterSliceTexture(scene,texture,width,height)).setDisplaySize(width,height);
  return scene.add.image(x,y,texture).setDisplaySize(width,height);
 }
 return scene.add.graphics().fillStyle(0x594236,0.08).fillRoundedRect(x-width/2,y-height/2+3,width,height,14)
  .fillStyle(fallback).fillRoundedRect(x-width/2,y-height/2,width,height,14);
}

/** One CSS paper surface behind a transparent Canvas: no seam at the Canvas edges. */
export function syncViewportPaper(scene: Phaser.Scene): void {
 const paper = manifest.assets.find(a => a.key === 'paper');
 const url = paper && scene.textures.exists('cozy-paper')
  ? new URL(`${import.meta.env.BASE_URL}${paper.path.replace(/^public\//, '')}`, document.baseURI).href : null;
 if (url) document.documentElement.style.setProperty('--workshop-paper', `url("${url}")`);
 else document.documentElement.style.removeProperty('--workshop-paper');
}

/** Phaser NineSlice has no Canvas renderer. Cache the same nine raster patches once
 * per size/state instead of invisible Canvas panels or repeated WebGL geometry. */
export function rasterSliceTexture(scene: Phaser.Scene, textureKey: string, width: number, height: number): string {
 const density = Math.min(2,Math.max(1,scene.cameras.main.zoom));
 const key = `${textureKey}-slice-${width}-${height}-${density}`;
 if (scene.textures.exists(key)) return key;
 const source = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;
 const texture = scene.textures.createCanvas(key,Math.ceil(width*density),Math.ceil(height*density));
 if (!texture) return textureKey;
 const context = texture.getContext();
 context.scale(density,density);
 const edgeX = Math.min(32,width/2), edgeY = Math.min(32,height/2);
 const sx=[0,32,source.width-32,source.width], sy=[0,32,source.height-32,source.height];
 const dx=[0,edgeX,width-edgeX,width], dy=[0,edgeY,height-edgeY,height];
 for(let r=0;r<3;r++)for(let c=0;c<3;c++) {
  const dw=dx[c+1]!-dx[c]!, dh=dy[r+1]!-dy[r]!;
  if(dw>0 && dh>0)context.drawImage(source,sx[c]!,sy[r]!,sx[c+1]!-sx[c]!,sy[r+1]!-sy[r]!,dx[c]!,dy[r]!,dw,dh);
 }
 texture.refresh(); return key;
}
