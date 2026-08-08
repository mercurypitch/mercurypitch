#!/usr/bin/env node
// optimize-pwa-images — shrink the PWA's install-surface PNGs in place.
//
// The manifest icons and screenshots are the bytes Android touches while
// installing: the install sheet downloads every screenshot to render its
// cards, and the WebAPK minting service fetches the icons to bake them into
// the signed APK. None of it goes through our service worker, so the only
// lever is the files themselves.
//
// Palette quantization via sharp (libimagequant, the pngquant engine) at
// quality 95 with dithering is visually lossless for UI captures and flat
// icon art, and typically saves 50-70%. A file is rewritten only when the
// quantized output is actually smaller; dimensions never change, so the
// `sizes` entries in public/site.webmanifest stay correct.
//
// Run directly (`pnpm assets:pwa-images`) after hand-editing an icon, or let
// scripts/gen-pwa-screenshots.mjs call it — it runs this automatically over
// every shot it writes.

import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Quantize one PNG in place; keep the original when it is already smaller. */
export async function optimizePng(path) {
  const before = statSync(path).size
  const quantized = await sharp(path)
    .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
    .toBuffer()
  if (quantized.length >= before) return { path, before, after: before }
  writeFileSync(path, quantized)
  return { path, before, after: quantized.length }
}

/** Optimize every path, printing one savings line per file. */
export async function optimizePngs(paths) {
  let saved = 0
  for (const path of paths) {
    const { before, after } = await optimizePng(path)
    saved += before - after
    const label = path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path
    console.log(
      `${after < before ? 'ok   ' : 'kept '} ${label}  ${Math.round(before / 1024)} -> ${Math.round(after / 1024)} KiB`,
    )
  }
  console.log(`optimize-pwa-images: saved ${Math.round(saved / 1024)} KiB`)
}

// CLI: the full install surface — everything public/site.webmanifest points
// Android at, plus the iOS home-screen icon.
const isCli = process.argv[1] === fileURLToPath(import.meta.url)
if (isCli) {
  const screenshotsDir = join(ROOT, 'public/screenshots')
  const targets = [
    join(ROOT, 'public/icon-192.png'),
    join(ROOT, 'public/icon-512.png'),
    join(ROOT, 'public/maskable-512.png'),
    join(ROOT, 'public/apple-touch-icon.png'),
    ...readdirSync(screenshotsDir)
      .filter((name) => name.endsWith('.png'))
      .map((name) => join(screenshotsDir, name)),
  ]
  await optimizePngs(targets)
}
