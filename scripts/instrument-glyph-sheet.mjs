#!/usr/bin/env node
// ============================================================
// Instrument glyph sheet — draw every Studio instrument glyph by family, and check its ink
// ============================================================
//
// Renders the contact sheet a glyph pull request attaches: each glyph at 16,
// 20, 24 and 32 px and in the 24 and 28 px chips, on the themes asked for,
// with the colours read from the app's own stylesheets. --check also renders
// each glyph at 240 px and fails when its ink comes within 1 unit of the frame
// or sits more than half a unit off centre (docs/studio-instrument-glyphs.md).
//
//   node scripts/instrument-glyph-sheet.mjs --out=sheet.png [--themes=dark,light,ocean] [--dpr=2] [--check]
//
// Uses Playwright's Chromium (a dev dependency). Loads the two data modules
// as they are, so they must keep to type-only imports.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value ?? true]
  }),
)
const themes = String(flags.themes ?? 'dark,light').split(',')
const dpr = Number(flags.dpr ?? 2)

const { INSTRUMENT_DRAWINGS: drawings } = await import(
  pathToFileURL(join(root, 'src/features/studio/instruments/glyph-drawings.ts'))
    .href
)
const { INSTRUMENT_FAMILIES: families, INSTRUMENT_GLYPHS: glyphs } =
  await import(
    pathToFileURL(join(root, 'src/lib/studio/instruments/glyph-catalog.ts'))
      .href
  )

/** A stylesheet block's custom properties, by the selector that opens it. */
function tokens(path, selector) {
  const css = readFileSync(join(root, path), 'utf8')
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`${selector} not found in ${path}`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  )
}
const appDark = tokens('src/styles/app.css', ':root {')
const studio = {
  dark: tokens('src/features/studio/StudioPage.module.css', '.page {'),
  light: tokens(
    'src/features/studio/StudioPage.module.css',
    ":global(html[data-theme='light']) .page {",
  ),
}
function palette(theme) {
  const app =
    theme === 'dark'
      ? appDark
      : {
          ...appDark,
          ...tokens('src/styles/app.css', `[data-theme='${theme}'] {`),
        }
  const hues =
    theme === 'light' ? { ...studio.dark, ...studio.light } : studio.dark
  return { app, hue: (name) => hues[`studio-hue-${name}`] }
}

let serial = 0
function svg(id, size) {
  serial += 1
  return `<svg class="g" data-size="${size}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[id].replaceAll('$k', `k${serial}`)}</svg>`
}
function chip(id, hue, theme, size) {
  const [ground, ink] = theme === 'light' ? [14, 70] : [20, 62]
  return `<span class="chip" style="width:${size}px;height:${size}px;border-radius:${size >= 28 ? 8 : 7}px;background:color-mix(in srgb, ${hue} ${ground}%, var(--bar));color:color-mix(in srgb, ${hue} ${ink}%, var(--text))">${svg(id, size === 24 ? 16 : 20)}</span>`
}
function panel(theme) {
  const { app, hue } = palette(theme)
  const sections = families
    .map((family) => {
      const tint = hue(family.hue)
      const rows = glyphs
        .filter((glyph) => glyph.family === family.id)
        .map(
          (g) =>
            `<div class="row"><span class="name">${g.label}</span>${[16, 20, 24, 32].map((s) => svg(g.id, s)).join('')}${chip(g.id, tint, theme, 24)}${chip(g.id, tint, theme, 28)}</div>`,
        )
        .join('')
      return `<section><h3><i style="background:${tint}"></i>${family.name}</h3>${rows}</section>`
    })
    .join('')
  return `<div class="panel" style="--bg:${app['bg-primary']};--bar:${app['bg-secondary']};--text:${app['text-primary']};--muted:${app['text-muted']}"><h2>${theme}</h2><div class="cols">${sections}</div></div>`
}
const css = `body{margin:0;font:12px/1.3 system-ui,sans-serif}
.panel{background:var(--bg);color:var(--text);padding:14px 18px 6px}
h2{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.cols{column-count:3}section{break-inside:avoid;margin:0 0 10px}
h3{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-size:11.5px;color:var(--muted)}
h3 i{width:8px;height:8px;border-radius:50%}
.row{display:flex;align-items:center;gap:10px;height:34px}.name{width:104px}
.chip{display:inline-grid;place-items:center;flex:none}svg.g{display:block;flex:none}
svg.g[data-size='16']{stroke-width:2.25}svg.g[data-size='16'] [data-fine]{display:none}
svg.g[data-size='32']{stroke-width:1.5}`

/** CHROMIUM names a browser; sandboxes ship a prebuilt one Playwright's own install misses. */
async function launch() {
  if (process.env.CHROMIUM)
    return chromium.launch({ executablePath: process.env.CHROMIUM })
  try {
    return await chromium.launch()
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  }
}

const work = mkdtempSync(join(tmpdir(), 'glyph-sheet-'))
const browser = await launch()
let failures = 0
try {
  if (flags.out) {
    const page = join(work, 'sheet.html')
    writeFileSync(
      page,
      `<!doctype html><meta charset="utf-8"><style>${css}</style>${themes.map(panel).join('')}`,
    )
    const tab = await browser.newPage({
      deviceScaleFactor: dpr,
      viewport: { width: 1320, height: 900 },
    })
    await tab.goto(pathToFileURL(page).href)
    await tab.screenshot({ path: resolve(String(flags.out)), fullPage: true })
    console.log(`wrote ${flags.out}`)
  }
  if (flags.check) {
    const tab = await browser.newPage({ viewport: { width: 400, height: 400 } })
    const ink = await tab.evaluate(
      async (list) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 240
        const g = canvas.getContext('2d', { willReadFrequently: true })
        const out = []
        for (const [id, markup] of list) {
          const image = new Image()
          await new Promise((done, fail) => {
            image.onload = done
            image.onerror = fail
            image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
          })
          g.fillStyle = '#fff'
          g.fillRect(0, 0, 240, 240)
          g.drawImage(image, 0, 0, 240, 240)
          const data = g.getImageData(0, 0, 240, 240).data
          let [l, t, r, b] = [240, 240, -1, -1]
          for (let y = 0; y < 240; y++)
            for (let x = 0; x < 240; x++)
              if (data[(y * 240 + x) * 4] < 128) {
                l = Math.min(l, x)
                r = Math.max(r, x)
                t = Math.min(t, y)
                b = Math.max(b, y)
              }
          out.push([id, l / 10, t / 10, (r + 1) / 10, (b + 1) / 10])
        }
        return out
      },
      glyphs.map((g) => [
        g.id,
        svg(g.id, 240)
          .replaceAll('currentColor', '#000')
          .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" `),
      ]),
    )
    for (const [id, l, t, r, b] of ink) {
      const bad = []
      if (Math.min(l, t) < 0.95 || Math.max(r, b) > 23.05)
        bad.push('within 1 unit of the frame')
      if (Math.abs((l + r) / 2 - 12) > 0.5 || Math.abs((t + b) / 2 - 12) > 0.5)
        bad.push('off centre')
      if (bad.length > 0) {
        failures += 1
        console.log(`${id}: ink ${l}..${r} x ${t}..${b}, ${bad.join(', ')}`)
      }
    }
    console.log(
      failures === 0
        ? `all ${ink.length} glyphs inside the margin and centred`
        : `${failures} glyph(s) to fix`,
    )
  }
} finally {
  await browser.close()
  rmSync(work, { recursive: true, force: true })
}
process.exit(failures === 0 ? 0 : 1)
