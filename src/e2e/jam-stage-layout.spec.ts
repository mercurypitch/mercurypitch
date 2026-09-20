// ============================================================
// Jam song stage — zoom, the lyric split, alignment and lyric size
// ============================================================
//
// The stage shipped with four constants where a preference belonged: an
// eight-second window whatever the lane was, a 3fr/2fr split whatever the
// screen was, hard-left lyrics, and one font size for every pair of eyes.
// This spec drives the four controls that replaced them with a real
// pointer, a real wheel and a real two-finger pinch, because none of them
// can be proved in jsdom: the lanes are a canvas, the split is a grid
// measured in percentages, the alignment only shows up in where the
// glyphs actually land, and the lyric size is a custom property that
// means nothing until a stylesheet multiplies it. Nor can where the sung
// line sits in its box, which is measured here too.
//
// This file exceeds 600 lines to keep the four controls on the one room
// they share. Seeding the song, the fake microphone and the preview room
// are most of what any test here needs, and the controls lean on each
// other -- the lyric size moves the line the centring test measures, the
// seam resizes the box both of them scroll -- so four specs would be four
// copies of the set-up, drifting apart.
//
// The room is the preview room (VITE_JAM_MOCK_SIGNALING=1): two invented
// peers, no fabricated pitch. The target notes are seeded into the
// analysis table the same way a pass through the stem mixer would leave
// them, so the lanes have something to draw; the singer's own trail is
// real, from Chromium's fake microphone.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

/** A4, which the seeded targets sit around. */
const TONE = writeToneWav(440, 6)

/**
 * Where a screenshot goes.
 *
 * Playwright's own per-test folder by default, so the spec carries no
 * machine's directory layout around with it. Point JAM_STAGE_ARTIFACTS at
 * somewhere a person will actually look to collect them instead.
 */
function shot(name: string): string {
  const directory = process.env.JAM_STAGE_ARTIFACTS
  if (directory === undefined) return test.info().outputPath(name)
  mkdirSync(directory, { recursive: true })
  return join(directory, name)
}

const DEMO_SESSION_ID = 'karaoke-night-demo'

/**
 * Target notes for the bundled song.
 *
 * The room reads these from the offline analysis table, which is empty in
 * a fresh profile -- the demo only has notes once somebody has opened it
 * in the stem mixer. Seeding the row is the cheapest way to get a stage
 * that looks like a stage; the shape (a scale walked up and down, a note
 * every 1.2s) is chosen so every window has something in it at any zoom.
 */
async function seedSongNotes(page: Page): Promise<void> {
  await page.evaluate(async (sessionId) => {
    const scale = [67, 69, 71, 72, 71, 69, 67, 65]
    const notes = Array.from({ length: 160 }, (_note, i) => ({
      midi: scale[i % scale.length] ?? 67,
      noteName: 'G',
      startSec: i * 1.2,
      endSec: i * 1.2 + 0.85,
    }))
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('MercuryPitchDB')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction(['offlinePitchAnalysis'], 'readwrite')
        const now = new Date().toISOString()
        tx.objectStore('offlinePitchAnalysis').put({
          id: 'e2e-jam-stage-notes',
          fileHash: `session:${sessionId}`,
          analysisResultsJson: JSON.stringify(notes),
          lrcLinesJson: '[]',
          // The cleaned line as well as the raw one. A record with only
          // `analysisResultsJson` is a song analysed before the clean-up
          // existed, and the host's room now works a proper line out for
          // those: it fetched the real vocal stem, spent seconds of main
          // thread on it and then REPLACED these notes under whichever
          // test was half way through measuring them. One run in five
          // failed on a pill that had changed size for no visible reason.
          segmentedNotesJson: JSON.stringify(notes),
          createdAt: now,
          updatedAt: now,
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, DEMO_SESSION_ID)
}

/** Create the preview room and load the bundled song into it. */
async function openSongRoom(page: Page, options: { seek?: boolean } = {}) {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await seedSongNotes(page)

  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()

  const handle = page.getByTestId('jam-split-handle')
  await expect(handle).toBeVisible()
  if (options.seek !== false) {
    // Park the playhead where the seeded targets are, so the lanes are
    // drawing a phrase rather than the run-in.
    await page.locator('[data-line="6"]').click()
  }
  return { handle, zoom: page.getByTestId('jam-lane-zoom') }
}

/**
 * The fake microphone, for the whole file.
 *
 * `launchOptions` cannot live in a describe group -- it forces a new
 * worker -- so both viewports share one browser launch and differ only
 * in the viewport they use.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: fakeMicArgs(TONE) },
})

/**
 * Get back to a song stage after a reload.
 *
 * A reload may or may not leave the room standing -- the preview room is
 * restored from storage when it can be -- so this asks rather than
 * assumes, and a spec proving a preference survived a reload must not
 * fail because the room came back by itself.
 */
async function reenterSongRoom(page: Page): Promise<void> {
  const handle = page.getByTestId('jam-split-handle')
  if ((await handle.count()) > 0) return
  const create = page.getByRole('button', { name: 'Create Room' })
  if ((await create.count()) > 0) await create.click()
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(handle).toBeVisible()
}

/**
 * Give some of the song to the singer whose lane this is.
 *
 * Without it every note is unassigned, which the lanes draw as
 * everybody's -- correct, but it means the "these are YOURS" path (the
 * lane's own colour, the lead-in outline, the note names at high zoom)
 * never appears in a screenshot. Uses the room's own brush: arm a
 * singer in the parts bar, then sweep down the lines.
 */
async function giveLinesToYou(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'You', exact: true }).first().click()
  const from = await page.locator('[data-line="4"]').boundingBox()
  const to = await page.locator('[data-line="9"]').boundingBox()
  await page.mouse.move((from?.x ?? 0) + 40, (from?.y ?? 0) + (from?.height ?? 0) / 2) // prettier-ignore
  await page.mouse.down()
  await page.mouse.move((to?.x ?? 0) + 40, (to?.y ?? 0) + (to?.height ?? 0) / 2, { steps: 10 }) // prettier-ignore
  await page.mouse.up()
  await expect(page.locator('[class*="lineOwned"]').first()).toBeVisible()
  // Put the brush down again, or every screenshot shows the room mid-edit.
  await page.getByRole('button', { name: 'Done', exact: true }).click()
}

/** Pin the theme: a screenshot taken in light is not the room people use. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pitchperfect_theme', 'dark')
      localStorage.setItem('pitchperfect_theme_source', 'manual')
    } catch {
      /* storage blocked — the app's own default is dark anyway */
    }
  })
})

/** The split element, which carries the layout name and the share. */
const splitOf = (page: Page) => page.locator('[class*="split"]').first()

interface LaneInk {
  /** Widest unbroken run of painted pixels across a row: a note pill. */
  widestRun: number
  /** Tallest run down a column, ignoring the full-height playhead. */
  tallestRun: number
  painted: number
}

/**
 * What one lane actually painted.
 *
 * Read off the canvas rather than asserted through the component,
 * because "bigger" is the whole request and a component test cannot see
 * a pixel. The playhead is a full-height hairline at 0.75 of the width,
 * so its column is skipped or it would be every tallest run.
 *
 * Lane 1 by default -- a peer's. Peers have no pitch in a preview room,
 * so their lanes hold the target notes and nothing else; measuring the
 * singer's own lane would measure whatever the live trail happened to
 * be drawing at that instant.
 */
async function laneInk(page: Page, lane = 1): Promise<LaneInk> {
  return await page.evaluate((index) => {
    const canvases = [...document.querySelectorAll('canvas')].filter(
      (c) => (c as HTMLCanvasElement).clientWidth < 900,
    ) as HTMLCanvasElement[]
    const canvas = canvases[index]
    if (canvas === undefined) throw new Error('no lane canvas')
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('no lane context')
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    const lit = (x: number, y: number): boolean =>
      (data[(y * width + x) * 4 + 3] ?? 0) >= 20

    let painted = 0
    let widestRun = 0
    for (let y = 0; y < height; y++) {
      let run = 0
      for (let x = 0; x < width; x++) {
        if (lit(x, y)) {
          run++
          painted++
          if (run > widestRun) widestRun = run
        } else {
          run = 0
        }
      }
    }

    const playheadX = Math.round(width * 0.75)
    let tallestRun = 0
    for (let x = 0; x < width; x++) {
      if (Math.abs(x - playheadX) <= 2) continue
      let run = 0
      for (let y = 0; y < height; y++) {
        if (lit(x, y)) {
          run++
          if (run > tallestRun) tallestRun = run
        } else {
          run = 0
        }
      }
    }
    return { widestRun, tallestRun, painted }
  }, lane)
}

/**
 * Where the glyphs of a lyric line actually sit.
 *
 * A Range over the span, not the span's own box: `text-align` moves the
 * glyphs INSIDE a block that does not move, so measuring the element
 * would report no change at any alignment. The span's box comes back
 * too, because "aligned left" means the glyphs sit against ITS left
 * edge, and the row's box, because "centred" has to mean centred on the
 * panel rather than on whatever is left over.
 */
async function lyricTextBox(page: Page, line: number) {
  return await page.evaluate((index) => {
    const row = document.querySelector(`[data-line="${index}"]`)
    const span = row?.querySelector('span')
    if (row === null || span === null || span === undefined) return null
    const range = document.createRange()
    range.selectNodeContents(span)
    const text = range.getBoundingClientRect()
    const spanBox = span.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    return {
      textLeft: text.left,
      textRight: text.right,
      textCenter: text.left + text.width / 2,
      spanLeft: spanBox.left,
      spanRight: spanBox.right,
      spanCenter: spanBox.left + spanBox.width / 2,
      rowCenter: rowBox.left + rowBox.width / 2,
    }
  }, line)
}

/**
 * The shortest lyric line on screen.
 *
 * Alignment can only be measured on a line that does not already fill
 * its column -- a line of text as wide as the box it sits in looks the
 * same left, centred and right, and asserting on one proves nothing
 * whichever way the CSS goes.
 */
async function shortestLyricLine(page: Page): Promise<number> {
  const found = await page.evaluate(() => {
    let best = -1
    let slack = 0
    const rows = [...document.querySelectorAll('[data-line]')].slice(0, 24)
    for (const row of rows) {
      const span = row.querySelector('span')
      if (span === null) continue
      const range = document.createRange()
      range.selectNodeContents(span)
      const box = range.getBoundingClientRect()
      if (box.width < 10) continue
      const room = span.getBoundingClientRect().width - box.width
      if (room > slack) {
        slack = room
        best = Number((row as HTMLElement).dataset.line ?? '-1')
      }
    }
    return { best, slack }
  })
  // Under about twenty pixels of slack the three alignments are the same
  // picture to within a rounding error, and asserting on one proves
  // nothing whichever way the CSS goes.
  expect(found.slack, 'no lyric line loose enough to measure alignment').toBeGreaterThan(20) // prettier-ignore
  return found.best
}

/** What each alignment's button is called. */
const ALIGN_NAME = { left: 'Left', center: 'Middle', right: 'Right' } as const

const alignRadio = (page: Page, value: 'left' | 'center' | 'right') =>
  page
    .getByRole('radiogroup', { name: 'Lyric alignment' })
    .getByRole('radio', { name: ALIGN_NAME[value], exact: true })

async function setAlign(page: Page, value: 'left' | 'center' | 'right') {
  await alignRadio(page, value).click()
  await expect(alignRadio(page, value)).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('[data-align]').first()).toHaveAttribute(
    'data-align',
    value,
  )
}

/** The lyric size control: the lane zoom's three buttons, in the header. */
const lyricSize = (page: Page) => page.getByTestId('jam-lyrics-size')

/** The computed font size of one lyric line, in CSS pixels. */
async function lineFontPx(page: Page, line: number): Promise<number> {
  return await page.evaluate((index) => {
    const row = document.querySelector(`[data-line="${index}"]`)
    if (row === null) throw new Error(`no lyric line ${index}`)
    return Number.parseFloat(getComputedStyle(row).fontSize)
  }, line)
}

/**
 * How far a line's middle is from the middle of the box it scrolls in.
 *
 * `offBy` of zero is perfectly centred. Only ask it of a line the box CAN
 * centre: one near either end of the song stops at the end instead, and
 * asserting that it is centred would be asserting the clamp is broken.
 * Line 6, where openSongRoom parks the song, is far enough in at every
 * size and on both screens.
 */
async function lineOffCentre(page: Page, line: number) {
  return await page.evaluate((index) => {
    const row = document.querySelector(`[data-line="${index}"]`)
    const box = row?.closest('[data-align]')
    if (row === null || box === null || box === undefined) return null
    const rowBox = row.getBoundingClientRect()
    const boxBox = box.getBoundingClientRect()
    return {
      offBy: rowBox.top + rowBox.height / 2 - (boxBox.top + boxBox.height / 2),
      scrollTop: box.scrollTop,
      boxHeight: box.clientHeight,
    }
  }, line)
}

/** `lineOffCentre` as a distance, for polling: 99 while there is no line. */
const offCentre = async (page: Page, line: number) =>
  Math.abs((await lineOffCentre(page, line))?.offBy ?? 99)

// ── Desktop ──────────────────────────────────────────────────────────

test.describe('the song stage on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('zooms the lanes with the buttons, the wheel and a reset @smoke', async ({
    page,
  }) => {
    const { zoom } = await openSongRoom(page)
    await expect(zoom).toHaveAttribute('data-zoom', '1.000')
    await giveLinesToYou(page)

    // The singer's own trail is real: the fake microphone is singing A4
    // straight into the room's detector.
    await page.getByTitle('Unmute microphone').click()
    await expect(page.getByTitle('Mute microphone')).toBeVisible()
    await page.waitForTimeout(1200)

    const atOne = await laneInk(page)
    expect(atOne.painted).toBeGreaterThan(200)
    await page.screenshot({ path: shot('desktop-zoom-1x.png') })

    const zoomIn = page.getByLabel('Look closer at the pitch lanes')
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await expect(zoom).toHaveAttribute('data-zoom', '1.953')
    await page.waitForTimeout(500)
    const atTwo = await laneInk(page)
    await page.screenshot({ path: shot('desktop-zoom-2x.png') })

    // The point of the whole feature: everything is bigger, and less of
    // the song fits. A note is wider and a pill is taller.
    expect(atTwo.widestRun).toBeGreaterThan(atOne.widestRun)
    expect(atTwo.tallestRun).toBeGreaterThan(atOne.tallestRun)

    // Four more notches: 1.25^7 overshoots 4x, so the seventh click is
    // the one that lands on the ceiling.
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await expect(zoom).toHaveAttribute('data-zoom', '4.000')
    await expect(zoomIn).toBeDisabled()
    await page.waitForTimeout(500)
    const atMax = await laneInk(page)
    expect(atMax.widestRun).toBeGreaterThan(atTwo.widestRun)
    await page.screenshot({ path: shot('desktop-zoom-max.png') })

    // Ctrl+wheel always zooms, wherever the lane list stands.
    const lanes = page.locator('canvas').nth(1)
    const box = await lanes.boundingBox()
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    )
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, 240)
    await page.keyboard.up('Control')
    await expect(zoom).not.toHaveAttribute('data-zoom', '4.000')

    // One click back to where it started, from anywhere.
    await page.getByTitle('Reset the zoom').click()
    await expect(zoom).toHaveAttribute('data-zoom', '1.000')
    await expect(page.getByTitle('Reset the zoom')).toBeDisabled()

    // And it is this device's preference, not the room's.
    expect(
      await page.evaluate(() =>
        localStorage.getItem('pitchperfect_jam_lane_zoom'),
      ),
    ).toBe('1')
  })

  test('trades space between the words and the lanes, and remembers it @smoke', async ({
    page,
  }) => {
    const { handle } = await openSongRoom(page)
    const split = splitOf(page)
    await expect(split).toHaveAttribute('data-layout', 'wide')
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    await expect(handle).toHaveAttribute('aria-valuenow', '50')
    await page.screenshot({ path: shot('desktop-split-default.png') })

    const splitBox = await split.boundingBox()
    const handleBox = await handle.boundingBox()
    const midY = (handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2
    const grabX = (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2

    // A real drag: press on the seam and pull it towards the words.
    await page.mouse.move(grabX, midY)
    await page.mouse.down()
    await page.mouse.move(grabX - 200, midY, { steps: 12 })
    await page.mouse.up()
    const narrowed = Number(await handle.getAttribute('aria-valuenow'))
    const expected = 50 - (200 / (splitBox?.width ?? 1)) * 100
    expect(Math.abs(narrowed - expected)).toBeLessThanOrEqual(2)
    await page.screenshot({ path: shot('desktop-split-lanes-wide.png') })

    // Past the end it stops rather than collapsing a side.
    await page.mouse.move(grabX - 200, midY)
    await page.mouse.down()
    await page.mouse.move((splitBox?.x ?? 0) - 400, midY, { steps: 8 })
    await page.mouse.up()
    await expect(handle).toHaveAttribute('aria-valuenow', '25')
    await page.screenshot({ path: shot('desktop-split-min.png') })

    const nowBox = await handle.boundingBox()
    await page.mouse.move((nowBox?.x ?? 0) + (nowBox?.width ?? 0) / 2, midY)
    await page.mouse.down()
    await page.mouse.move(
      (splitBox?.x ?? 0) + (splitBox?.width ?? 0) + 400,
      midY,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect(handle).toHaveAttribute('aria-valuenow', '75')
    await page.screenshot({ path: shot('desktop-split-max.png') })

    // The keyboard reaches all of it too.
    await handle.focus()
    await page.keyboard.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '25')
    await page.keyboard.press('ArrowRight')
    await expect(handle).toHaveAttribute('aria-valuenow', '27')
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '75')

    // Double-click is the way back.
    await handle.dblclick()
    await expect(handle).toHaveAttribute('aria-valuenow', '50')

    // Move it, then come back to the room: the seam is where it was left.
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(handle).toHaveAttribute('aria-valuenow', '46')
    expect(
      await page.evaluate(() =>
        localStorage.getItem('pitchperfect_jam_split_wide'),
      ),
    ).toBe('46')

    // Out of the room and back in from scratch. A bare reload rejoins
    // the room in the URL, and a rejoined preview room comes back
    // without its song picker -- so the spec would be proving something
    // about room restoration rather than about the remembered seam.
    await page.locator('button[title="Leave room"]:visible').click()
    await page.reload()
    await dismissOverlays(page)
    await reenterSongRoom(page)
    await expect(page.getByTestId('jam-split-handle')).toHaveAttribute(
      'aria-valuenow',
      '46',
    )
  })

  test('puts the words where the singer asked for them @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    const scroll = page.locator('[data-align]').first()
    // Centred out of the box: a lyric column is read like a teleprompter.
    await expect(scroll).toHaveAttribute('data-align', 'center')
    await page.screenshot({ path: shot('desktop-align-center.png') })

    // Picked with the words hard left, where the column is widest and a
    // short line is most obviously short.
    await setAlign(page, 'left')
    const line = await shortestLyricLine(page)
    const left = await lyricTextBox(page, line)
    expect(left).not.toBeNull()
    await page.screenshot({ path: shot('desktop-align-left.png') })

    await setAlign(page, 'right')
    const right = await lyricTextBox(page, line)
    await page.screenshot({ path: shot('desktop-align-right.png') })

    await setAlign(page, 'center')
    const centered = await lyricTextBox(page, line)

    // Each name means what it says: the glyphs sit against that edge of
    // the column they are in.
    expect(Math.abs((left?.textLeft ?? 0) - (left?.spanLeft ?? 0))).toBeLessThanOrEqual(2) // prettier-ignore
    expect(Math.abs((right?.textRight ?? 0) - (right?.spanRight ?? 0))).toBeLessThanOrEqual(2) // prettier-ignore
    expect(Math.abs((centered?.textCenter ?? 0) - (centered?.spanCenter ?? 0))).toBeLessThanOrEqual(3) // prettier-ignore

    // And centred means centred on the PANEL, not on whatever is left
    // once the score and the assign button have had their share -- which
    // is the part that looked wrong before the gutter existed.
    expect(
      Math.abs((centered?.textCenter ?? 0) - (centered?.rowCenter ?? 0)),
    ).toBeLessThanOrEqual(6)

    // The three are actually different pictures.
    expect(left?.textLeft ?? 0).toBeLessThan(centered?.textLeft ?? 0)
    expect(centered?.textLeft ?? 0).toBeLessThan(right?.textLeft ?? 0)

    // A real keyboard reaches it: the group is one tab stop, and an arrow
    // moves the choice and the focus together. Proved here rather than
    // only in jsdom because the handler is bound natively, and a native
    // key handler is exactly what a synthetic event cannot vouch for.
    await alignRadio(page, 'center').focus()
    await page.keyboard.press('ArrowRight')
    await expect(scroll).toHaveAttribute('data-align', 'right')
    await expect(alignRadio(page, 'right')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(scroll).toHaveAttribute('data-align', 'left')
    await page.keyboard.press('ArrowRight')
    await expect(scroll).toHaveAttribute('data-align', 'center')

    // Remembered per device, under the room's own key.
    expect(
      await page.evaluate(() =>
        localStorage.getItem('pitchperfect_jam_lyrics_align'),
      ),
    ).toBe('center')
  })

  test('keeps the line being sung in the middle of the words @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    // Parked on line 6, which is far enough into the song to be centred.
    await expect
      .poll(async () => (await lineOffCentre(page, 6))?.scrollTop ?? 0)
      .toBeGreaterThan(0)
    // The middle of the BOX. The sum used to start from the panel around
    // it, which has a header and a parts bar on top, and left the sung
    // line that much too high: 76px, or 100 once the parts bar wraps.
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)
    await page.screenshot({ path: shot('desktop-lyrics-centred.png') })
  })

  test('sizes the words with the buttons and a wheel, and remembers it @smoke', async ({
    page,
  }) => {
    const { zoom } = await openSongRoom(page)
    const size = lyricSize(page)
    const scroll = page.locator('[data-align]').first()
    await expect(size).toHaveAttribute('data-zoom', '1.000')
    const shipped = await lineFontPx(page, 6)
    expect(shipped).toBeGreaterThan(10)
    await page.screenshot({ path: shot('desktop-lyrics-100.png') })

    // The point of the feature: plus makes the words bigger, by the step
    // the readout says. Two stops up the ladder is 125%.
    const larger = page.getByRole('button', { name: 'Larger lyrics' })
    await larger.click()
    await larger.click()
    await expect(size).toHaveAttribute('data-zoom', '1.250')
    await expect(page.getByTitle('Reset lyric size')).toHaveText('125%')
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped * 1.25, 1)
    // Every line, not only the sung one.
    expect(await lineFontPx(page, 0)).toBeCloseTo(shipped * 1.25, 1)

    // Line 6 is being sung (openSongRoom parks there). Every line above
    // it just grew, so it moved; it has to be brought back to the middle.
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)

    // All the way up: it stops, and says so.
    await larger.click()
    await larger.click()
    await larger.click()
    await expect(size).toHaveAttribute('data-zoom', '2.000')
    await expect(larger).toBeDisabled()
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped * 2, 1)
    await page.screenshot({ path: shot('desktop-lyrics-200.png') })
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)

    // And all the way down. Seven stops from the ceiling to the floor.
    const smaller = page.getByRole('button', { name: 'Smaller lyrics' })
    for (let i = 0; i < 7; i++) await smaller.click()
    await expect(size).toHaveAttribute('data-zoom', '0.800')
    await expect(smaller).toBeDisabled()
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped * 0.8, 1)
    await page.screenshot({ path: shot('desktop-lyrics-80.png') })

    // One click back to the shipped size, from anywhere.
    await page.getByTitle('Reset lyric size').click()
    await expect(size).toHaveAttribute('data-zoom', '1.000')
    await expect(page.getByTitle('Reset lyric size')).toBeDisabled()
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped, 1)

    // Ctrl+wheel over the words sizes them...
    const box = await scroll.boundingBox()
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    )
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(size).not.toHaveAttribute('data-zoom', '1.000')
    const wheeled = Number(await size.getAttribute('data-zoom'))
    expect(wheeled).toBeGreaterThan(1)
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped * wheeled, 1)

    // ...and a plain wheel still scrolls them, which is what it is for.
    const before = (await lineOffCentre(page, 6))?.scrollTop ?? 0
    await page.mouse.wheel(0, 160)
    await expect
      .poll(async () => (await lineOffCentre(page, 6))?.scrollTop ?? 0)
      .toBeGreaterThan(before)
    await expect(size).toHaveAttribute('data-zoom', wheeled.toFixed(3))

    // The lanes have a zoom of their own, and this is not it.
    await expect(zoom).toHaveAttribute('data-zoom', '1.000')

    // Land on a stop, leave, and come back: the words are the size they
    // were left. Out of the room and in from scratch, for the reason the
    // split test gives.
    await page.getByTitle('Reset lyric size').click()
    await larger.click()
    await larger.click()
    await larger.click()
    await expect(size).toHaveAttribute('data-zoom', '1.500')
    expect(
      await page.evaluate(() =>
        localStorage.getItem('pitchperfect_jam_lyrics_scale'),
      ),
    ).toBe('1.5')
    await page.locator('button[title="Leave room"]:visible').click()
    await page.reload()
    await dismissOverlays(page)
    await reenterSongRoom(page)
    await expect(lyricSize(page)).toHaveAttribute('data-zoom', '1.500')
    expect(await lineFontPx(page, 0)).toBeCloseTo(shipped * 1.5, 1)
  })

  test('has nothing to trade when the lanes are hidden @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    // Two buttons carry this title: the transport row's and the phone
    // menu's. Only one of them is on screen at a time.
    await page.locator('button[title="Hide the live pitch"]:visible').click()
    const split = splitOf(page)
    await expect(split).toHaveAttribute('data-layout', 'solo')
    await expect(page.getByTestId('jam-split-handle')).toHaveCount(0)
    await expect(page.getByTestId('jam-lane-zoom')).toHaveCount(0)
    await page.screenshot({ path: shot('desktop-lanes-hidden.png') })

    // The words take the whole stage rather than half of it.
    const splitBox = await split.boundingBox()
    const lyrics = await page.locator('[data-align]').first().boundingBox()
    expect(lyrics?.width ?? 0).toBeGreaterThan((splitBox?.width ?? 0) * 0.9)
  })

  test('never puts the page into a sideways scroll @smoke', async ({
    page,
  }) => {
    const { handle } = await openSongRoom(page)
    for (const key of ['Home', 'End']) {
      await handle.focus()
      await page.keyboard.press(key)
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0)
    }
  })
})

// ── Phone ────────────────────────────────────────────────────────────

test.describe('the song stage on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('stacks the stage and turns the seam with it @smoke', async ({
    page,
  }) => {
    const { handle } = await openSongRoom(page)
    const split = splitOf(page)
    await expect(split).toHaveAttribute('data-layout', 'stacked')
    await expect(handle).toHaveAttribute('aria-orientation', 'horizontal')
    await expect(handle).toHaveAttribute('aria-valuenow', '60')
    await page.screenshot({ path: shot('phone-stacked-default.png') })

    // A thumb has to be able to find it.
    const handleBox = await handle.boundingBox()
    expect(handleBox?.height ?? 0).toBeGreaterThanOrEqual(24)

    const splitBox = await split.boundingBox()
    const grabY = (handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2
    const grabX = (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.mouse.move(grabX, grabY - 150, { steps: 10 })
    await page.mouse.up()
    const raised = Number(await handle.getAttribute('aria-valuenow'))
    const expected = 60 - (150 / (splitBox?.height ?? 1)) * 100
    expect(Math.abs(raised - expected)).toBeLessThanOrEqual(3)
    await page.screenshot({ path: shot('phone-stacked-lanes-tall.png') })

    // Its own remembered share: moving it here left the desktop alone.
    const stored = await page.evaluate(() => [
      localStorage.getItem('pitchperfect_jam_split_stacked'),
      localStorage.getItem('pitchperfect_jam_split_wide'),
    ])
    expect(Math.abs(Number(stored[0]) - raised)).toBeLessThanOrEqual(0.5)
    expect(stored[1]).toBeNull()

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })

  test('zooms the lanes with two fingers @smoke', async ({ page }) => {
    const { zoom } = await openSongRoom(page)
    await expect(zoom).toHaveAttribute('data-zoom', '1.000')
    await page.getByTitle('Unmute microphone').click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: shot('phone-zoom-1x.png') })
    const atOne = await laneInk(page)

    const lane = page.locator('canvas').nth(1)
    const box = await lane.boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 0) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 0) / 2

    // Real touch points through CDP, not synthesised PointerEvents: the
    // gesture has to survive `touch-action: pan-y` on the lane list and
    // arrive as two pointers, which is the whole thing under test.
    const cdp = await page.context().newCDPSession(page)
    type TouchType = 'touchStart' | 'touchMove' | 'touchEnd'
    const touch = (type: TouchType, spread: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints:
          type === 'touchEnd'
            ? []
            : [
                { x: cx - spread, y: cy, id: 1 },
                { x: cx + spread, y: cy, id: 2 },
              ],
      })
    const pinchOut = async () => {
      await touch('touchStart', 40)
      for (const spread of [55, 70, 85, 100, 115, 130]) {
        await touch('touchMove', spread)
      }
      await touch('touchEnd', 0)
      return Number(await zoom.getAttribute('data-zoom'))
    }

    // Retried rather than asserted once: the first synthetic touch after
    // a layout settles is occasionally swallowed, and a flake here would
    // read as a broken gesture.
    await expect.poll(pinchOut, { timeout: 15000 }).toBeGreaterThan(1.5)
    await page.waitForTimeout(500)
    const atTwo = await laneInk(page)
    expect(atTwo.widestRun).toBeGreaterThan(atOne.widestRun)
    await page.screenshot({ path: shot('phone-zoom-2x.png') })

    // The buttons are still reachable with a thumb on a coarse pointer.
    const zoomIn = page.getByLabel('Look closer at the pitch lanes')
    const buttonBox = await zoomIn.boundingBox()
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(24)
    expect(buttonBox?.width ?? 0).toBeGreaterThanOrEqual(24)
  })

  test('keeps the line being sung in the middle, however tall the words are @smoke', async ({
    page,
  }) => {
    const { handle } = await openSongRoom(page)
    // A phone's box is a little over 200px, and the old sum was out by
    // more than 80: the line being sung sat on the top edge of it.
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)
    await page.screenshot({ path: shot('phone-lyrics-centred.png') })

    // Drag the seam up. The words lose height under a song that is
    // standing still, so nothing but the box has moved -- and the middle
    // of it has. The line has to follow.
    const tall = (await lineOffCentre(page, 6))?.boxHeight ?? 0
    const handleBox = await handle.boundingBox()
    const grabX = (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2
    const grabY = (handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.mouse.move(grabX, grabY - 70, { steps: 7 })
    await page.mouse.up()
    await expect
      .poll(async () => (await lineOffCentre(page, 6))?.boxHeight ?? tall)
      .toBeLessThan(tall - 40)
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)
    await page.screenshot({ path: shot('phone-lyrics-centred-short.png') })
  })

  test('sizes the words with two fingers, and still scrolls them with one @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    const size = lyricSize(page)
    await expect(size).toHaveAttribute('data-zoom', '1.000')
    const shipped = await lineFontPx(page, 6)
    await page.screenshot({ path: shot('phone-lyrics-100.png') })

    const box = await page.locator('[data-align]').first().boundingBox()
    const cx = (box?.x ?? 0) + (box?.width ?? 0) / 2
    const cy = (box?.y ?? 0) + (box?.height ?? 0) / 2

    // Real touch points through CDP, for the reason the lane pinch gives:
    // the gesture has to survive `touch-action: pan-y` on a box that
    // genuinely scrolls, and arrive at the page as two fingers.
    const cdp = await page.context().newCDPSession(page)
    type TouchType = 'touchStart' | 'touchMove' | 'touchEnd'
    const touch = (type: TouchType, points: Array<{ x: number; y: number }>) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((point, id) => ({ ...point, id: id + 1 })),
      })
    const two = (spread: number) => [
      { x: cx - spread, y: cy },
      { x: cx + spread, y: cy },
    ]
    const pinchOut = async () => {
      await touch('touchStart', two(40))
      for (const spread of [55, 70, 85, 100, 115, 130]) {
        await touch('touchMove', two(spread))
      }
      await touch('touchEnd', [])
      return Number(await size.getAttribute('data-zoom'))
    }

    // Retried for the same reason too: the first synthetic touch after a
    // layout settles is occasionally swallowed.
    await expect.poll(pinchOut, { timeout: 15000 }).toBeGreaterThan(1.5)
    const pinched = Number(await size.getAttribute('data-zoom'))
    expect(await lineFontPx(page, 6)).toBeCloseTo(shipped * pinched, 1)
    await page.screenshot({ path: shot('phone-lyrics-pinched.png') })

    // The pinch was the words', not the page's: the browser did not zoom.
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)

    // And it did not throw the sung line out of the panel on the way.
    await expect.poll(() => offCentre(page, 6)).toBeLessThanOrEqual(4)

    // One finger is still a scroll -- the gesture this box is mostly for.
    const before = (await lineOffCentre(page, 6))?.scrollTop ?? 0
    const drag = async () => {
      await touch('touchStart', [{ x: cx, y: cy + 60 }])
      for (const dy of [40, 20, 0, -20, -40, -60]) {
        await touch('touchMove', [{ x: cx, y: cy + dy }])
      }
      await touch('touchEnd', [])
      return (await lineOffCentre(page, 6))?.scrollTop ?? 0
    }
    await expect.poll(drag, { timeout: 15000 }).toBeGreaterThan(before + 40)
    await expect(size).toHaveAttribute('data-zoom', pinched.toFixed(3))

    // The buttons are a thumb's size here, like the ones beside them.
    const larger = await page
      .getByRole('button', { name: 'Larger lyrics' })
      .boundingBox()
    expect(larger?.width ?? 0).toBeGreaterThanOrEqual(40)
    expect(larger?.height ?? 0).toBeGreaterThanOrEqual(40)

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })

  test('aligns the words on a narrow column too @smoke', async ({ page }) => {
    await openSongRoom(page)
    // Three buttons where there was one chip, so each one has to be a
    // target a thumb can hit without aiming.
    for (const value of ['left', 'center', 'right'] as const) {
      const box = await alignRadio(page, value).boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
    }
    await setAlign(page, 'left')
    const line = await shortestLyricLine(page)
    const left = await lyricTextBox(page, line)
    await setAlign(page, 'center')
    const centered = await lyricTextBox(page, line)
    await page.screenshot({ path: shot('phone-align-center.png') })
    expect(left?.textLeft ?? 0).toBeLessThan(centered?.textLeft ?? 0)
    expect(
      Math.abs((centered?.textCenter ?? 0) - (centered?.rowCenter ?? 0)),
    ).toBeLessThanOrEqual(6)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })
})

// ── The narrowest phone ──────────────────────────────────────────────

test.describe('the lyric header on a 360px phone', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  })

  test('keeps both controls on one row, all of it inside the panel @smoke', async ({
    page,
  }) => {
    await openSongRoom(page)
    await expect(splitOf(page)).toHaveAttribute('data-layout', 'stacked')
    const header = page.getByTestId('jam-lyrics-header')
    await page.screenshot({ path: shot('phone-360-header.png') })

    // Three 40px buttons and a minus / readout / plus do not fit beside a
    // label at this width. What gives is the label -- never a second row,
    // which would come straight out of the height the words have.
    const layout = await header.evaluate((row) => {
      const box = (element: Element) => element.getBoundingClientRect()
      const controls = [
        ...row.querySelectorAll('[role="radio"], [data-testid] button'),
      ].filter((control) => box(control).width > 0)
      const rowBox = box(row)
      return {
        overflow: row.scrollWidth - row.clientWidth,
        height: rowBox.height,
        tops: [...new Set(controls.map((c) => Math.round(box(c).top)))],
        count: controls.length,
        leftmost: Math.min(...controls.map((c) => box(c).left)) - rowBox.left,
        rightmost:
          rowBox.right - Math.max(...controls.map((c) => box(c).right)),
        smallest: Math.min(
          ...controls.map((c) => Math.min(box(c).width, box(c).height)),
        ),
      }
    })
    // All six: three alignments, minus, the readout and plus.
    expect(layout.count).toBe(6)
    expect(layout.tops).toHaveLength(1)
    expect(layout.overflow).toBeLessThanOrEqual(0)
    expect(layout.leftmost).toBeGreaterThanOrEqual(0)
    expect(layout.rightmost).toBeGreaterThanOrEqual(0)
    expect(layout.smallest).toBeGreaterThanOrEqual(40)
    // One row of thumb-sized controls, not two.
    expect(layout.height).toBeLessThanOrEqual(56)

    // The host's parts bar underneath still has its row, and the words
    // still have theirs.
    await expect(page.getByText('Parts', { exact: true })).toBeVisible()
    await expect(page.locator('[data-line="6"]')).toBeVisible()

    // And they all still work at this size.
    await page.getByRole('button', { name: 'Larger lyrics' }).click()
    await expect(lyricSize(page)).toHaveAttribute('data-zoom', '1.100')
    await setAlign(page, 'left')

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0)
  })
})

// ── A tablet ─────────────────────────────────────────────────────────

test.describe('the lyric header on a tablet', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  })

  test('is the lane zoom’s height, not a phone’s', async ({ page }) => {
    // Owner report, 2026-09-20: the alignment toggles and the - 100% + were
    // "too bulky in height" next to the "sleek" - 1x + over the lanes. Every
    // touch screen got a phone's 40px; a tablet now takes the lane zoom's.
    await openSongRoom(page)
    await page.screenshot({ path: shot('tablet-lyric-header.png') })

    const heightOf = async (target: Locator) =>
      (await target.boundingBox())?.height ?? 0
    const lane = await heightOf(
      page.getByLabel('Look closer at the pitch lanes'),
    )
    expect(lane).toBeGreaterThanOrEqual(24)

    const larger = page.getByRole('button', { name: 'Larger lyrics' })
    expect(Math.abs((await heightOf(larger)) - lane)).toBeLessThanOrEqual(1)
    for (const value of ['left', 'center', 'right'] as const) {
      const box = await alignRadio(page, value).boundingBox()
      expect(Math.abs((box?.height ?? 0) - lane)).toBeLessThanOrEqual(1)
      // Square, and still over the floor a finger needs.
      expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(1) // prettier-ignore
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
    }

    // The row the two pills sit in: 51px before, under 42 now.
    const header = await page.getByTestId('jam-lyrics-header').boundingBox()
    expect(header?.height ?? 0).toBeLessThanOrEqual(42)

    // They still work at this size.
    await larger.click()
    await expect(lyricSize(page)).toHaveAttribute('data-zoom', '1.100')
    await setAlign(page, 'left')
  })
})
