// ============================================================
// Store-shot contact sheet — both devices side by side, with pixel sizes
// ============================================================
//
// Runs once after the shots (globalTeardown in ../playwright.shots.config.ts)
// and writes index.html beside the PNGs. It lists what is on disk, so a
// failed shot shows up as a gap instead of silently dropping out.

import type { FullConfig } from '@playwright/test'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PngFacts {
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
}

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
  if (!existsSync(file)) {
    const width = Math.round((IMAGE_HEIGHT_PX * device.width) / device.height)
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
  const screens = new Set<string>()
  for (const device of devices) {
    const folder = join(shotDir, device.name)
    if (!existsSync(folder)) continue
    for (const file of readdirSync(folder)) {
      if (/^\d\d-[a-z0-9-]+\.png$/u.test(file)) screens.add(file)
    }
  }
  const rows = [...screens]
    .sort()
    .map((screen) =>
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
<title>Beside Cue store shots</title>
<style>
:root { color-scheme: light; --ground: #eeeae2; --ink: #1f2420; --muted: #5b615c; --line: #d3ccbf; --bad: #a3261a; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 24px 48px; background: var(--ground); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; }
header { max-width: 64rem; margin: 0 auto 8px; }
h1 { margin: 0 0 4px; font-size: 1.5rem; }
header p { margin: 0; color: var(--muted); }
.scroll { overflow-x: auto; }
table { margin: 0 auto; border-collapse: separate; border-spacing: 28px 24px; }
thead th { text-align: left; font-weight: 600; }
thead small { display: block; color: var(--muted); font-weight: 400; }
tbody th { font: 600 0.9rem ui-monospace, monospace; text-align: left; vertical-align: top; padding-top: 6px; white-space: nowrap; }
td { vertical-align: top; }
figure { margin: 0; }
img { display: block; height: ${IMAGE_HEIGHT_PX}px; width: auto; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 10px 28px rgb(0 0 0 / 0.08); }
figcaption, .caption { margin: 8px 0 0; font: 0.8rem/1.4 ui-monospace, monospace; color: var(--muted); }
.bad { color: var(--bad); font-weight: 700; }
.missing { display: grid; place-items: center; height: ${IMAGE_HEIGHT_PX}px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); }
</style>
</head>
<body>
<header>
<h1>Beside Cue store shots</h1>
<p>${screens.size} screens from <code>pnpm shots</code> in apps/beside-cue, written ${escapeHtml(new Date().toLocaleString('en-GB'))}. Raw app screens, flattened to 8-bit RGB. Open an image for full size.</p>
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
  const shotDir = process.env.BESIDE_CUE_SHOTS_DIR
  if (shotDir === undefined || !existsSync(shotDir)) return

  const devices = config.projects.flatMap((project): Device[] => {
    const viewport = project.use.viewport
    if (viewport === null || viewport === undefined) return []
    const scale = project.use.deviceScaleFactor ?? 1
    return [
      {
        name: project.name,
        width: viewport.width * scale,
        height: viewport.height * scale,
      },
    ]
  })
  const file = join(shotDir, 'index.html')
  writeFileSync(file, sheet(shotDir, devices))
  console.log(`Contact sheet: ${file}`)
}
