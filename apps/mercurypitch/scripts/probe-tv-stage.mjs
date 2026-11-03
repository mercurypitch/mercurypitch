// ============================================================
// The TV stage at a TV's size: inside the overscan inset, opaque, legible
// ============================================================
//
//   node scripts/probe-tv-stage.mjs                    the app's own dev server
//   node scripts/probe-tv-stage.mjs --shots <dir>      and keep the screenshots
//   node scripts/probe-tv-stage.mjs --base-url <url>   a served test build
//
// The Karaoke room's stage on a TV (stage.html, src/stage/main.ts) is a page
// of its own that the root e2e config never serves. With no --base-url this
// starts the app's own Vite dev server, from vite.config.ts as `pnpm dev`
// does (so a fresh checkout fetches the example stems first, as `pnpm dev`
// would), privately: no file watching, no reloads, a cache of its own, and
// a port of this checkout's own. A test build carries the page too
// (`vite build` with the portable console on, then `vite preview`); a store
// build does not.
//
// The page is fed a song through `window.__mpStage.receive`, as the iPhone
// feeds it: an invented song, "River Road", with a short line, a long one, a
// longer one, a run-on verse and a rest, notes, the singer's readings and a
// score. The page's clock is held still (Playwright's fixed time), so a
// playing song stands where it was put and every frame is the same. Each
// scene is drawn playing (the paused screen would cover the lyrics),
// measured, and drawn again with the same song and no lyrics: what changed
// is the lyrics' ink, pixel for pixel, and what the renderer wrote in the
// first frame and not in the second is the lyrics' text. Two scenes are
// drawn standing still instead, to show the paused screen: part way, and
// ready at the start. Then, at 1920x1080, at 3840x2160, and at 1920x1080
// on a 2x screen (the same pixels as 4K), it asks:
//
//   - inset: every pixel that is not the background lies inside 5% of each
//     edge (REQ-TV-020, Play TV-OV);
//   - opaque: the canvas fills the viewport at the screen's own pixels, and
//     every pixel of it is opaque (REQ-TV-021, Play TV-LO);
//   - floor: no lyric is written under 32 px per 1080 lines (REQ-TV-022),
//     and nothing on the lane either: its C names and the name of the note
//     under the now marker. Other text is reported against the same floor,
//     and not failed;
//   - clear: no lyric ink lands on the lane, and no two lyric rows touch,
//     the next line included (measured from the font's own ink boxes);
//   - glass: the lane draws its notes in their yellow glass. They are
//     sprites painted once on canvases of their own (src/lib/tv-stage/
//     sprites.ts), and a page that could not make one would draw an empty
//     lane with no error anywhere;
//   - paused: standing still, the paused screen says so ("Paused", or
//     "Ready to sing" at the start), and every text on the screen, its own
//     and the stage's behind it, is 32 px per 1080 lines or more.
//
// The lane's box is worked out here as tvStageLayout works it out
// (src/lib/tv-stage/layout.ts): the lane is drawn from sprites, so no fill
// the renderer makes outlines it.
//
// The page draws in the system font. Headless Chromium has no SF Pro, so its
// shots are close to the TV's, not the same: here the font is whatever
// fontconfig gives `system-ui`.
//
// Exits 1 when a check fails. Not run in CI; run it after a change to the
// stage's renderer (src/lib/tv-stage/renderer.ts, lyric-wrap.ts).

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The screens: a 1080p TV, a 4K one, and a 4K one that lays out at 1080. */
const FRAMES = [
  { width: 1920, height: 1080, scale: 1 },
  { width: 3840, height: 2160, scale: 1 },
  { width: 1920, height: 1080, scale: 2 },
]

/** TV_STAGE_COLORS.background and .sung, in renderer.ts. */
const BACKGROUND = [11, 13, 18]
const SUNG = [255, 193, 90]

/** The overscan inset, a share of each edge (REQ-TV-020). */
const INSET = 0.05

/** The least a lyric may be, in px per 1080 lines (REQ-TV-022). */
const FLOOR_PX = 32

// ── The song ─────────────────────────────────────────────────
//
// Invented for this check. Each line's words fill one after another from
// its start, `per` seconds each; a gap of two seconds or more before the
// next line is a rest, in which that line waits in the big place.

const TITLE = 'River Road'

const LINES = [
  { at: 4, per: 0.5, text: 'Hold the light a little longer' },
  {
    at: 8,
    per: 0.6,
    text: 'Every light along the river road was singing back the words we never said',
  },
  {
    at: 18,
    per: 0.5,
    text: 'We kept the windows open all the summer long, and every evening the river came up to the door with another song',
  },
  {
    at: 32,
    per: 0.3,
    text: 'and on we went down every street in town, past the bakery and the station and the school and the bridge and the park where we used to meet when the lamps came on, and nobody knew our names and nobody minded what we sang as long as we kept on singing all the way home again, past the dog next door and the radio upstairs and the kettle on the stove, and we were singing still when the morning came',
  },
  {
    at: 62,
    per: 0.5,
    text: 'So sing it one more time for everyone who stayed with us until the very end of the night',
  },
]

/** The tune the notes follow, a MIDI number for each word in turn. */
const TUNE = [67, 69, 71, 72, 74, 72, 71, 69, 67, 64, 66, 67]

function lineWords(line) {
  const current = line.text.split(' ')
  const words = current.map((_, index) => {
    const start = line.at + index * line.per
    return [round(start), round(start + line.per)]
  })
  return { current, words, end: line.at + current.length * line.per }
}

function lyrics() {
  const segments = [{ at: 0, current: [], next: LINES[0].text, words: [] }]
  LINES.forEach((line, index) => {
    const next = LINES[index + 1]?.text ?? null
    const { current, words, end } = lineWords(line)
    segments.push({ at: line.at, current, next, words })
    const following = LINES[index + 1]?.at ?? Infinity
    if (following - end >= 2) {
      segments.push({ at: round(end), current: [], next, words: [] })
    }
  })
  return segments
}

function notes() {
  return LINES.flatMap((line) =>
    lineWords(line).words.map(([start], index) => ({
      t0: start,
      t1: round(start + line.per * 0.9),
      midi: TUNE[index % TUNE.length],
    })),
  )
}

/** The singer, a little flat with a 5.5 Hz vibrato, for five seconds back. */
function readings(position) {
  const found = []
  for (const note of notes()) {
    for (let t = note.t0 + 0.05; t < note.t1; t += 0.05) {
      if (t > position || t < position - 5) continue
      const wobble = 0.2 * Math.sin(2 * Math.PI * 5.5 * t) - 0.12
      found.push([round(t), Math.round((note.midi + wobble) * 100) / 100])
    }
  }
  return found
}

function round(seconds) {
  return Math.round(seconds * 1000) / 1000
}

const song = (withLyrics) => ({
  v: 1,
  kind: 'song',
  title: TITLE,
  duration: 90,
  notes: notes(),
  lyrics: withLyrics ? lyrics() : [],
})

/** The page's wall clock, held still: Playwright's fixed time. */
const NOW = Date.UTC(2026, 10, 3, 20, 0, 0)

/** A frame read at NOW. */
const frame = (position, playing) => ({
  v: 1,
  kind: 'frame',
  at: NOW,
  position,
  playing,
  rate: 1,
  singer: readings(position),
  score: { pct: 84, grade: 'B' },
})

/**
 * The song playing at `position`, its start long enough ago that the paused
 * screen has faded: a frame that starts it three seconds before, then one
 * where it is. The clock is held still, so it stays there.
 */
const playingAt = (position) => [
  { ...frame(position - 3, true), at: NOW - 3000, singer: [] },
  frame(position, true),
]

/** The song standing still at `position`: the paused screen, fully in. */
const standingAt = (position) => [frame(position, false)]

/**
 * The scenes. `line` is a line of LINES; `into` says where in it: `'start'`
 * for its first moment, `'second-row'` for half way into the first word of
 * the second row on screen, found from a first drawing at its start (the
 * rows depend on the font, so they are read, not assumed).
 */
const SCENES = [
  { name: 'idle' },
  { name: 'short', line: 0, into: 'third-word' },
  { name: 'long', line: 1, into: 'second-row' },
  { name: 'longer', line: 2, into: 'second-row' },
  { name: 'run-on', line: 3, into: 'second-row' },
  { name: 'rest', position: 58 },
  { name: 'paused', position: 20.3, standing: true, says: 'Paused' },
  { name: 'ready', position: 0, standing: true, says: 'Ready to sing' },
]

// ── In the page ──────────────────────────────────────────────

/**
 * Installed before the stage's own script: records what each frame writes
 * and fills, with each text's ink box as the font measures it. A frame
 * starts where the renderer covers the whole canvas: with its background
 * filled, or with a song on, the stage's backdrop stamped (the background,
 * the light and the lane's glass, painted once per size).
 */
function installRecorder() {
  const proto = CanvasRenderingContext2D.prototype
  const { drawImage, fillRect, fillText } = proto
  const probe = { frame: null }
  window.__mpProbe = probe
  proto.fillRect = function (x, y, w, h) {
    const whole =
      x === 0 && y === 0 && w === this.canvas.width && h === this.canvas.height
    if (whole) probe.frame = { texts: [], rects: [] }
    else probe.frame?.rects.push({ x, y, w, h })
    return fillRect.call(this, x, y, w, h)
  }
  proto.drawImage = function (image, ...args) {
    const whole =
      args.length === 2 &&
      args[0] === 0 &&
      args[1] === 0 &&
      image.width === this.canvas.width &&
      image.height === this.canvas.height
    if (whole) probe.frame = { texts: [], rects: [] }
    return drawImage.call(this, image, ...args)
  }
  proto.fillText = function (text, x, y, ...rest) {
    const ink = this.measureText(text)
    probe.frame?.texts.push({
      text,
      x,
      y,
      px: Number(/(\d+(?:\.\d+)?)px/u.exec(this.font)?.[1] ?? 0),
      color: String(this.fillStyle),
      left: x - ink.actualBoundingBoxLeft,
      right: x + ink.actualBoundingBoxRight,
      top: y - ink.actualBoundingBoxAscent,
      bottom: y + ink.actualBoundingBoxDescent,
    })
    return fillText.call(this, text, x, y, ...rest)
  }
}

/**
 * The canvas, read: its size, the lowest alpha, the box of every pixel that
 * is not the background and how many of them lie outside `inset` of the
 * edges, and the frame's record. With `against`, the pixels that differ
 * from the frame read last, and how many of them fall in `against.lane`.
 */
function readCanvas({ background, inset, against }) {
  const canvas = document.getElementById('stage')
  const { width, height } = canvas
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const before = window.__mpProbe.pixels
  const drawn = { x0: width, y0: height, x1: -1, y1: -1, outside: 0 }
  const safe = {
    x0: inset * width,
    y0: inset * height,
    x1: (1 - inset) * width,
    y1: (1 - inset) * height,
  }
  const changed = { x0: width, y0: height, x1: -1, y1: -1, count: 0, inLane: 0 }
  const grow = (box, x, y) => {
    box.x0 = Math.min(box.x0, x)
    box.y0 = Math.min(box.y0, y)
    box.x1 = Math.max(box.x1, x)
    box.y1 = Math.max(box.y1, y)
  }
  let minAlpha = 255
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width
    const y = Math.floor(i / 4 / width)
    minAlpha = Math.min(minAlpha, data[i + 3])
    const ground =
      data[i] === background[0] &&
      data[i + 1] === background[1] &&
      data[i + 2] === background[2]
    if (!ground) {
      grow(drawn, x, y)
      const out =
        x < safe.x0 || x + 1 > safe.x1 || y < safe.y0 || y + 1 > safe.y1
      if (out) drawn.outside += 1
    }
    if (against === undefined || before === undefined) continue
    const same =
      data[i] === before[i] &&
      data[i + 1] === before[i + 1] &&
      data[i + 2] === before[i + 2]
    if (same) continue
    grow(changed, x, y)
    changed.count += 1
    const lane = against.lane
    const inLane = x >= lane.x0 && x < lane.x1 && y >= lane.y0 && y < lane.y1
    if (inLane) changed.inLane += 1
  }
  if (against === undefined) window.__mpProbe.pixels = data
  return {
    width,
    height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    minAlpha,
    drawn,
    changed: against === undefined ? null : changed,
    record: window.__mpProbe.frame,
  }
}

/** Of the kept frame's pixels in each box, how many are near `color`. */
function countColor({ boxes, color }) {
  const canvas = document.getElementById('stage')
  const pixels = window.__mpProbe.pixels
  return boxes.map((box) => {
    let near = 0
    let ink = 0
    for (
      let y = Math.max(0, box.y0);
      y < Math.min(canvas.height, box.y1);
      y++
    ) {
      for (
        let x = Math.max(0, box.x0);
        x < Math.min(canvas.width, box.x1);
        x++
      ) {
        const i = (y * canvas.width + x) * 4
        const distance =
          Math.abs(pixels[i] - color[0]) +
          Math.abs(pixels[i + 1] - color[1]) +
          Math.abs(pixels[i + 2] - color[2])
        if (distance < 60) near += 1
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 300) ink += 1
      }
    }
    return { near, ink }
  })
}

// ── Driving the page ─────────────────────────────────────────

async function send(page, ...messages) {
  for (const message of messages) {
    await page.evaluate(
      (json) => window.__mpStage.receive(json),
      JSON.stringify(message),
    )
  }
  // Two frames of the display: the stage has drawn what it was sent.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  )
}

const IDLE = { v: 1, kind: 'idle' }

/** How every frame is read: against the background, and the inset. */
const READ = { background: BACKGROUND, inset: INSET }

/** Where in its line a scene is drawn; see SCENES. */
async function positionOf(page, scene) {
  if (scene.position !== undefined) return scene.position
  const line = LINES[scene.line]
  const { current, words } = lineWords(line)
  if (scene.into === 'third-word') return words[2][0] + line.per / 2
  await send(page, IDLE, song(true), ...playingAt(line.at))
  const { record } = await page.evaluate(readCanvas, READ)
  const pieces = record.texts.filter((text) => current.includes(text.text))
  const firstRow = pieces.filter((piece) => piece.y === pieces[0].y).length
  return words[Math.min(firstRow, words.length - 1)][0] + line.per / 2
}

/** Texts in `all` that `some` has not, as a multiset. */
function without(all, some) {
  const key = (text) =>
    `${text.text}|${text.x}|${text.y}|${text.px}|${text.color}`
  const left = new Map()
  for (const text of some) left.set(key(text), (left.get(key(text)) ?? 0) + 1)
  return all.filter((text) => {
    const count = left.get(key(text)) ?? 0
    if (count > 0) left.set(key(text), count - 1)
    return count === 0
  })
}

/**
 * The lane's box on a canvas this size, as tvStageLayout has it
 * (src/lib/tv-stage/layout.ts): inside the 5% inset, below the header's 12%
 * of it and a 3% gap, half the inset's height tall.
 */
function laneBox(width, height) {
  const safe = {
    x: width * 0.05,
    y: height * 0.05,
    w: width * 0.9,
    h: height * 0.9,
  }
  const y0 = safe.y + safe.h * 0.12 + safe.h * 0.03
  return { x0: safe.x, y0, x1: safe.x + safe.w, y1: y0 + safe.h * 0.5 }
}

/** The lane's notes are yellow glass: this many of its pixels are. */
function noteGlass({ lane }) {
  const canvas = document.getElementById('stage')
  const pixels = window.__mpProbe.pixels
  let glass = 0
  for (let y = Math.ceil(lane.y0); y < Math.floor(lane.y1); y++) {
    for (let x = Math.ceil(lane.x0); x < Math.floor(lane.x1); x++) {
      const i = (y * canvas.width + x) * 4
      const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
      if (r > 220 && g > 150 && g < 235 && b < 110) glass += 1
    }
  }
  return glass
}

/** Lyric texts in rows by height, each with its ink box, top first. */
function rowsOf(texts) {
  const rows = new Map()
  for (const text of texts)
    rows.set(text.y, [...(rows.get(text.y) ?? []), text])
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, pieces]) => ({
      y,
      px: Math.max(...pieces.map((p) => p.px)),
      x0: Math.min(...pieces.map((p) => p.left)),
      x1: Math.max(...pieces.map((p) => p.right)),
      y0: Math.min(...pieces.map((p) => p.top)),
      y1: Math.max(...pieces.map((p) => p.bottom)),
      texts: pieces
        .filter((p, i) => i === 0 || p.x !== pieces[i - 1].x)
        .map((p) => p.text),
    }))
}

async function runScene(page, view, scene, shots) {
  const name = `${view.name}-${scene.name}`
  const errors = []
  if (scene.name === 'idle') {
    await send(page, IDLE)
  } else {
    const position = await positionOf(page, scene)
    const frames = scene.standing ? standingAt(position) : playingAt(position)
    await send(page, IDLE, song(true), ...frames)
  }
  const full = await page.evaluate(readCanvas, READ)
  if (shots !== null)
    await page.screenshot({ path: join(shots, `${name}.png`) })
  const result = { name, scene: scene.name, view: view.name, full, errors }
  if (scene.name === 'idle') return result
  if (scene.standing) return { ...result, says: scene.says }
  const lane = laneBox(full.width, full.height)
  const glass = await page.evaluate(noteGlass, { lane })
  await send(page, song(false))
  const bare = await page.evaluate(readCanvas, { ...READ, against: { lane } })
  const lyricTexts = without(full.record.texts, bare.record.texts)
  const rows = rowsOf(lyricTexts)
  const sung = await page.evaluate(countColor, {
    boxes: rows.map((row) => ({
      x0: Math.floor(row.x0),
      y0: Math.floor(row.y0),
      x1: Math.ceil(row.x1),
      y1: Math.ceil(row.y1),
    })),
    color: SUNG,
  })
  return { ...result, lane, glass, bare, lyricTexts, rows, sung }
}

// ── The checks ───────────────────────────────────────────────

function judge(result, view) {
  const { full } = result
  const unit = full.height / 1080
  const failures = []
  const fail = (what) => failures.push(`${result.name}: ${what}`)
  const width = view.width * view.scale
  const height = view.height * view.scale
  if (full.width !== width || full.height !== height) {
    fail(`canvas ${full.width}x${full.height}, not ${width}x${height}`)
  }
  if (full.clientWidth !== view.width || full.clientHeight !== view.height) {
    fail(`canvas shows at ${full.clientWidth}x${full.clientHeight}`)
  }
  if (full.minAlpha !== 255) fail(`a pixel with alpha ${full.minAlpha}`)
  const { drawn } = full
  if (drawn.outside > 0) {
    fail(
      `${drawn.outside} px outside the 5% inset, in ${JSON.stringify(drawn)}`,
    )
  }
  const floor = FLOOR_PX * unit
  if (result.says !== undefined) {
    const texts = full.record.texts
    if (!texts.some((text) => text.text === result.says)) {
      fail(`the paused screen does not say "${result.says}"`)
    }
    for (const text of texts) {
      if (text.px < floor - 1e-6) fail(`"${text.text}" at ${text.px} px`)
    }
    return failures
  }
  if (result.rows === undefined) return failures
  for (const text of result.lyricTexts) {
    if (text.px < floor - 1e-6) fail(`"${text.text}" at ${text.px} px`)
  }
  for (const text of onLane(result.bare.record.texts, result.lane)) {
    if (text.px < floor - 1e-6) {
      fail(`the lane's "${text.text}" at ${text.px} px`)
    }
  }
  if (result.glass < 200 * unit * unit) {
    fail(`only ${result.glass} px of the notes' yellow glass on the lane`)
  }
  if (result.bare.changed.inLane > 0) {
    fail(`${result.bare.changed.inLane} lyric pixels on the lane`)
  }
  if (result.rows.length > 0 && result.rows[0].y0 < result.lane.y1) {
    fail(
      `the lyrics' ink starts at ${result.rows[0].y0}, the lane ends at ${result.lane.y1}`,
    )
  }
  result.rows.slice(1).forEach((row, index) => {
    const above = result.rows[index]
    if (row.y0 < above.y1) fail(`rows at ${above.y} and ${row.y} touch`)
  })
  return failures
}

const per1080 = (px, height) => Math.round((px * 1080) / height)

/** The texts written inside the lane's box. */
const onLane = (texts, lane) =>
  texts.filter(
    (t) => t.x >= lane.x0 && t.x <= lane.x1 && t.y >= lane.y0 && t.y <= lane.y1,
  )

function describe(result) {
  const { full } = result
  const { drawn, width, height } = full
  const pct = (value, of) => ((100 * value) / of).toFixed(2)
  const margins = `margins L ${pct(drawn.x0, width)}% R ${pct(width - drawn.x1 - 1, width)}% T ${pct(drawn.y0, height)}% B ${pct(height - drawn.y1 - 1, height)}%`
  const lines = [
    `  ${result.scene.padEnd(7)} ${margins}, ${drawn.outside} px outside, min alpha ${full.minAlpha}`,
  ]
  if (result.rows === undefined) {
    const sizes = full.record.texts.map((t) => `${per1080(t.px, height)}`)
    lines.push(`          text per 1080: ${sizes.join(', ')}`)
    if (result.says !== undefined) {
      const said = full.record.texts.map((t) => t.text).join(' | ')
      lines.push(
        `          says: ${said.length <= 100 ? said : `${said.slice(0, 100)} [..]`}`,
      )
    }
    return lines
  }
  const other = [
    ...new Set(
      result.bare.record.texts.map(
        (t) =>
          `${/^[A-G]#?\d$/u.test(t.text) ? 'note names' : t.text} ${per1080(t.px, height)}`,
      ),
    ),
  ]
  lines.push(`          other text per 1080: ${other.join(', ')}`)
  lines.push(
    `          lane ${Math.round(result.lane.y0)}..${Math.round(result.lane.y1)}: ${result.glass} px of note glass`,
  )
  result.rows.forEach((row, index) => {
    const sung = result.sung[index]
    const share = sung.ink > 0 ? Math.round((100 * sung.near) / sung.ink) : 0
    const said = row.texts.join(' ')
    const shown =
      said.length <= 60 ? said : `${said.slice(0, 32)} [..] ${said.slice(-22)}`
    lines.push(
      `          row ${index + 1}: ${row.px} px (${per1080(row.px, height)} per 1080), ink ${Math.round(row.y0)}..${Math.round(row.y1)}, ${share}% of its ink lit: "${shown}"`,
    )
  })
  const gaps = result.rows
    .slice(1)
    .map((row, index) => Math.round(row.y0 - result.rows[index].y1))
  lines.push(
    `          lane ends ${Math.round(result.lane.y1)}, lyrics' ink ${result.bare.changed.y0}..${result.bare.changed.y1} (${result.bare.changed.count} px changed, ${result.bare.changed.inLane} on the lane); gaps between rows ${gaps.join(', ') || '-'}`,
  )
  return lines
}

// ── The server, the browser, the run ─────────────────────────

function parseArgs(argv) {
  const args = { baseUrl: null, shots: null }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--base-url') args.baseUrl = argv[(i += 1)]
    else if (flag === '--shots') args.shots = resolve(argv[(i += 1)])
    else throw new Error(`probe-tv-stage: unknown argument ${flag}`)
  }
  return args
}

/** A port of this checkout's own, so parallel worktrees never meet. */
function checkoutPort() {
  const digest = createHash('sha256').update(APP_ROOT).digest()
  return 5600 + (digest.readUInt16BE(0) % 400)
}

/** The app's own dev server, as `pnpm dev` starts it, kept to this run. */
async function startServer() {
  const { createServer } = await import('vite')
  const port = checkoutPort()
  const server = await createServer({
    configFile: join(APP_ROOT, 'vite.config.ts'),
    root: APP_ROOT,
    cacheDir: join(tmpdir(), `mercurypitch-tv-stage-vite-${port}`),
    logLevel: 'warn',
    // The stage page imports no package, so nothing is scanned or bundled.
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: '127.0.0.1', port, hmr: false, watch: null },
  })
  await server.listen()
  const url = server.resolvedUrls?.local[0]
  if (url === undefined)
    throw new Error('probe-tv-stage: the server has no URL')
  return { server, baseUrl: url.replace(/\/$/u, '') }
}

async function launch() {
  const args = ['--force-color-profile=srgb', '--hide-scrollbars']
  if (process.env.CHROMIUM) {
    return chromium.launch({ executablePath: process.env.CHROMIUM, args })
  }
  try {
    return await chromium.launch({ args })
  } catch {
    // Sandboxes ship a prebuilt Chromium that Playwright's own install misses.
    return chromium.launch({
      executablePath: '/opt/pw-browsers/chromium',
      args,
    })
  }
}

async function probeView(browser, baseUrl, view, shots) {
  const name =
    view.scale === 1
      ? `${view.width}x${view.height}`
      : `${view.width}x${view.height}@${view.scale}x`
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.scale,
    colorScheme: 'dark',
  })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(String(error)))
  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'error' &&
      !text.includes('Failed to load resource')
    ) {
      problems.push(text)
    }
  })
  await page.addInitScript(installRecorder)
  // Date.now() held at NOW, the timers still running: a frame that plays
  // stands where it was put, and the paused screen's fade is done or not.
  await page.clock.setFixedTime(NOW)
  await page.goto(`${baseUrl}/stage.html`, { waitUntil: 'load' })
  await page.waitForFunction(
    () => window.__mpStage !== undefined && window.__mpProbe.frame !== null,
  )
  const results = []
  for (const scene of SCENES) {
    results.push(await runScene(page, { ...view, name }, scene, shots))
  }
  await context.close()
  return { name, results, problems }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.shots !== null) mkdirSync(args.shots, { recursive: true })
  const started = args.baseUrl === null ? await startServer() : null
  const baseUrl = args.baseUrl ?? started.baseUrl
  const browser = await launch()
  const failures = []
  const report = []
  try {
    for (const view of FRAMES) {
      const probed = await probeView(browser, baseUrl, view, args.shots)
      console.log(`\n${probed.name} (${browser.version()})`)
      for (const problem of probed.problems)
        failures.push(`${probed.name}: ${problem}`)
      for (const result of probed.results) {
        for (const line of describe(result)) console.log(line)
        failures.push(...judge(result, view))
        report.push({
          view: probed.name,
          scene: result.scene,
          drawn: result.full.drawn,
          minAlpha: result.full.minAlpha,
          canvas: [result.full.width, result.full.height],
          lane: result.lane ?? null,
          rows: result.rows ?? null,
          lyricInk: result.bare?.changed ?? null,
          sung: result.sung ?? null,
        })
      }
    }
  } finally {
    await browser.close()
    await started?.server.close()
  }
  if (args.shots !== null) {
    writeFileSync(
      join(args.shots, 'report.json'),
      JSON.stringify(report, null, 2),
    )
    console.log(`\nshots and report.json in ${args.shots}`)
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} failed:`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log('\nevery check passed')
}

await main()
