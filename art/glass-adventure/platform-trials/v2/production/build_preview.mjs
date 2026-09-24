/** Build the Cloudway route-card derivative without altering the accepted master. */

import { mkdir, copyFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const repo = resolve(import.meta.dirname, '../../../../..')
const source = resolve(
  repo,
  'art/glass-adventure/platform-trials/v1/concepts/02-cloudway-route.png',
)
const archive = resolve(
  repo,
  'art/glass-adventure/platform-trials/v2/exports/cloudway-ribbon-preview.webp',
)
const runtime = resolve(
  repo,
  'apps/beside-cue/public/games/cloudway-v1/cloudway-ribbon-preview.webp',
)

await mkdir(dirname(archive), { recursive: true })
await mkdir(dirname(runtime), { recursive: true })
await sharp(source)
  .resize({ width: 1280, height: 640, fit: 'cover', position: 'centre' })
  .webp({ quality: 86, effort: 6, smartSubsample: true })
  .toFile(archive)
await copyFile(archive, runtime)

const metadata = await sharp(runtime).metadata()
console.log(
  JSON.stringify({
    source,
    archive,
    runtime,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  }),
)
