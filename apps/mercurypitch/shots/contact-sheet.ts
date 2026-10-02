// ============================================================
// Store-shot contact sheet — every device side by side, with pixel sizes
// ============================================================
//
// Runs once after the shots (globalTeardown in ../playwright.shots.config.ts)
// and writes index.html and manifest.json beside the PNGs. It lists what is
// on disk against what should be, so a failed shot shows up as a gap instead
// of silently dropping out.

import type { FullConfig } from '@playwright/test'
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ShotOptions } from '../playwright.shots.config'
import { SHOT_NOW, SINGER } from './fixtures'

interface PngFacts {
  readonly width: number
  readonly height: number
  readonly bitDepth: number
  readonly colorType: number
  /** An alpha channel, or a tRNS chunk that makes some colour transparent. */
  readonly hasTransparency: boolean
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const COLOR_TYPES: Readonly<Record<number, string>> = {
  0: 'grey',
  2: 'RGB',
  3: 'palette',
  4: 'grey + alpha',
  6: 'RGBA',
}

/** Reads a PNG's header chunks without decoding a pixel. */
export function readPngFacts(file: string): PngFacts {
  const bytes = readFileSync(file)
  if (
    !bytes.subarray(0, 8).equals(PNG_SIGNATURE) ||
    bytes.toString('latin1', 12, 16) !== 'IHDR'
  ) {
    throw new Error(`${file} is not a PNG`)
  }
  let transparencyChunk = false
  // tRNS must precede the first IDAT, so the walk can stop there.
  for (let offset = 8; offset + 8 <= bytes.length; ) {
    const type = bytes.toString('latin1', offset + 4, offset + 8)
    if (type === 'IDAT' || type === 'IEND') break
    if (type === 'tRNS') transparencyChunk = true
    offset += 12 + bytes.readUInt32BE(offset)
  }
  const colorType = bytes.readUInt8(25)
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes.readUInt8(24),
    colorType,
    hasTransparency: colorType === 4 || colorType === 6 || transparencyChunk,
  }
}

interface Device {
  readonly name: string
  readonly width: number
  readonly height: number
  /** Screens this device does not capture, keyed by name, with the reason. */
  readonly dropped: Readonly<Record<string, string>>
}

/** Why a screen is not captured on a device, or undefined if it should be. */
function droppedReason(device: Device, screen: string): string | undefined {
  return device.dropped[screen.replace(/\.png$/u, '')]
}

/** Every screen store.shots.ts writes, in story order. */
const SCREENS = [
  '01-rooms-welcome.png',
  '02-rooms-sing-door.png',
  '03-sing-priming.png',
  '04-sing-live.png',
  '05-sing-take.png',
  '06-ear-lab.png',
  '07-karaoke.png',
  '08-settings.png',
] as const

const IMAGE_HEIGHT_PX = 560

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cell(shotDir: string, device: Device, screen: string): string {
  const relative = `${device.name}/${screen}`
  const file = join(shotDir, relative)
  const width = Math.round((IMAGE_HEIGHT_PX * device.width) / device.height)
  const reason = droppedReason(device, screen)
  if (reason !== undefined) {
    return `<td><div class="missing dropped" style="width:${width}px"><p><strong>Dropped on this device</strong><br>${escapeHtml(reason)}</p></div><p class="caption">${escapeHtml(relative)}</p></td>`
  }
  if (!existsSync(file)) {
    return `<td><div class="missing" style="width:${width}px">missing</div><p class="caption">${escapeHtml(relative)}</p></td>`
  }
  const facts = readPngFacts(file)
  const sizeOk = facts.width === device.width && facts.height === device.height
  const colourOk = facts.colorType === 2 && !facts.hasTransparency
  const colour = COLOR_TYPES[facts.colorType] ?? `type ${facts.colorType}`
  const href = escapeHtml(relative)
  return [
    '<td><figure>',
    `<a href="${href}"><img src="${href}" alt="${escapeHtml(`${device.name} ${screen}`)}" loading="lazy"></a>`,
    `<figcaption>${href}<br>`,
    `<span${sizeOk ? '' : ' class="bad"'}>${facts.width} x ${facts.height}</span>, `,
    `<span${colourOk ? '' : ' class="bad"'}>${colour}${facts.hasTransparency ? ' with transparency' : ''}</span>`,
    '</figcaption></figure></td>',
  ].join('')
}

function sheet(shotDir: string, devices: readonly Device[]): string {
  const rows = SCREENS.map((screen) =>
    [
      `<tr><th scope="row">${escapeHtml(screen.replace(/\.png$/u, ''))}</th>`,
      ...devices.map((device) => cell(shotDir, device, screen)),
      '</tr>',
    ].join(''),
  )
  const heads = devices
    .map(
      (device) =>
        `<th scope="col">${escapeHtml(device.name)}<small>expected ${device.width} x ${device.height}</small></th>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mercury Pitch store shots</title>
<style>
:root { color-scheme: dark; --ground: #0d0f14; --ink: #eceef3; --muted: #9aa0ad; --line: #2a2f3a; --bad: #ff7a6b; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 24px 48px; background: var(--ground); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; }
header { max-width: 64rem; margin: 0 auto 8px; }
h1 { margin: 0 0 4px; font-size: 1.5rem; }
header p { margin: 0; color: var(--muted); }
a { color: inherit; }
.scroll { overflow-x: auto; }
table { margin: 0 auto; border-collapse: separate; border-spacing: 28px 24px; }
thead th { text-align: left; font-weight: 600; }
thead small { display: block; color: var(--muted); font-weight: 400; }
tbody th { font: 600 0.9rem ui-monospace, monospace; text-align: left; vertical-align: top; padding-top: 6px; white-space: nowrap; }
td { vertical-align: top; }
figure { margin: 0; }
img { display: block; height: ${IMAGE_HEIGHT_PX}px; width: auto; border: 1px solid var(--line); border-radius: 10px; }
figcaption, .caption { margin: 8px 0 0; font: 0.8rem/1.4 ui-monospace, monospace; color: var(--muted); }
.bad { color: var(--bad); font-weight: 700; }
.missing { display: grid; place-items: center; height: ${IMAGE_HEIGHT_PX}px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); }
.dropped p { max-width: 24rem; padding: 0 24px; text-align: center; }
</style>
</head>
<body>
<header>
<h1>Mercury Pitch store shots</h1>
<p>${SCREENS.length} screens from <code>pnpm shots</code> in apps/mercurypitch, written ${escapeHtml(new Date().toLocaleString('en-GB'))}. Raw app screens, flattened to 8-bit RGB. Browser captures of the native bundle at the device's safe-area insets; system bars and permission sheets are not drawn. See <a href="manifest.json">capture provenance</a>. Open an image for full size.</p>
</header>
<div class="scroll">
<table>
<thead><tr><th></th>${heads}</tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>
</div>
</body>
</html>
`
}

export default function writeContactSheet(config: FullConfig): void {
  const shotDir = process.env.MERCURYPITCH_SHOTS_DIR
  if (shotDir === undefined) return
  mkdirSync(shotDir, { recursive: true })

  const devices = config.projects.flatMap((project): Device[] => {
    const viewport = project.use.viewport
    if (viewport === null || viewport === undefined) return []
    const scale = project.use.deviceScaleFactor ?? 1
    return [
      {
        name: project.name,
        width: viewport.width * scale,
        height: viewport.height * scale,
        dropped: (project.use as Partial<ShotOptions>).dropped ?? {},
      },
    ]
  })
  const appRoot = fileURLToPath(new URL('../', import.meta.url))
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: appRoot, encoding: 'utf8' }).trim()
  const sha256 = (file: string): string =>
    createHash('sha256').update(readFileSync(file)).digest('hex')
  const captures = devices.flatMap((device) =>
    SCREENS.map((name) => {
      const relative = `${device.name}/${name}`
      const file = join(shotDir, relative)
      const dropped = droppedReason(device, name)
      return {
        file: relative,
        captured: existsSync(file),
        ...(dropped === undefined ? {} : { dropped }),
        ...(existsSync(file)
          ? { ...readPngFacts(file), sha256: sha256(file) }
          : {}),
      }
    }),
  )
  const manifest = {
    capturedAt: new Date().toISOString(),
    commit: git('rev-parse', 'HEAD'),
    browserVersion: execFileSync(chromium.executablePath(), ['--version'], {
      encoding: 'utf8',
    }).trim(),
    workingTreeDirty: git('status', '--porcelain') !== '',
    fixtureClock: SHOT_NOW,
    fixture: {
      fictional: true,
      singer: SINGER.name,
      account: 'answered by shots/stand-in-api.ts; no request left the machine',
      microphone: 'shots/voice.ts, a synthesised phrase; nobody sang it',
    },
    runtime:
      'Chromium browser; the native bundle built with the store presentation: release channel, no song import, no developer console',
    nativeLimitations:
      'Safe-area insets are the device’s (iPhone 62 and 34 pt, iPad 24 and 20 pt, Android none), but system bars, permission sheets and purchase sheets are not drawn. System fonts are the machine’s, not the phone’s.',
    presentation:
      'Unaltered app layout at reduced motion. The screenshot API finishes CSS animations and hides the caret. RGB conversion only; no resizing, overlays or removed UI.',
    harness: Object.fromEntries(
      [
        'playwright.shots.config.ts',
        'shots/vite.config.ts',
        'shots/store.shots.ts',
        'shots/layout.ts',
        'shots/fixtures.ts',
        'shots/stand-in-api.ts',
        'shots/voice.ts',
        'shots/android-fonts.conf',
      ].map((file) => [file, sha256(join(appRoot, file))]),
    ),
    captures,
  }
  writeFileSync(
    join(shotDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  const file = join(shotDir, 'index.html')
  writeFileSync(file, sheet(shotDir, devices))
  console.log(`Contact sheet: ${file}`)
}
