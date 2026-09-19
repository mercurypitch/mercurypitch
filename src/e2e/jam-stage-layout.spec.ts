// ============================================================
// Jam song stage — zoom, the lyric split, and the alignment chip
// ============================================================
//
// The stage shipped with three constants where a preference belonged: an
// eight-second window whatever the lane was, a 3fr/2fr split whatever the
// screen was, and hard-left lyrics. This spec drives the three controls
// that replaced them with a real pointer, a real wheel and a real
// two-finger pinch, because none of them can be proved in jsdom: the
// lanes are a canvas, the split is a grid measured in percentages, and
// the alignment only shows up in where the glyphs actually land.
//
// The room is the preview room (VITE_JAM_MOCK_SIGNALING=1): two invented
// peers, no fabricated pitch. The target notes are seeded into the
// analysis table the same way a pass through the stem mixer would leave
// them, so the lanes have something to draw; the singer's own trail is
// real, from Chromium's fake microphone.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

/** A4, which the seeded targets sit around. */
const TONE = writeToneWav(440, 6)

/** Where the owner picks the screenshots up. */
const SHOTS = '/home/maff/agent-out/mercurypitch/2026-09-19/jam-zoom'
mkdirSync(SHOTS, { recursive: true })

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
          segmentedNotesJson: '[]',
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

async function setAlign(page: Page, value: 'left' | 'center' | 'right') {
  await page.getByLabel('Lyric alignment').selectOption(value)
  await expect(page.locator('[data-align]').first()).toHaveAttribute(
    'data-align',
    value,
  )
}

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
    await page.screenshot({ path: `${SHOTS}/desktop-zoom-1x.png` })

    const zoomIn = page.getByLabel('Look closer at the pitch lanes')
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await expect(zoom).toHaveAttribute('data-zoom', '1.953')
    await page.waitForTimeout(500)
    const atTwo = await laneInk(page)
    await page.screenshot({ path: `${SHOTS}/desktop-zoom-2x.png` })

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
    await page.screenshot({ path: `${SHOTS}/desktop-zoom-max.png` })

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
    await page.screenshot({ path: `${SHOTS}/desktop-split-default.png` })

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
    await page.screenshot({ path: `${SHOTS}/desktop-split-lanes-wide.png` })

    // Past the end it stops rather than collapsing a side.
    await page.mouse.move(grabX - 200, midY)
    await page.mouse.down()
    await page.mouse.move((splitBox?.x ?? 0) - 400, midY, { steps: 8 })
    await page.mouse.up()
    await expect(handle).toHaveAttribute('aria-valuenow', '25')
    await page.screenshot({ path: `${SHOTS}/desktop-split-min.png` })

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
    await page.screenshot({ path: `${SHOTS}/desktop-split-max.png` })

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
    await page.screenshot({ path: `${SHOTS}/desktop-align-center.png` })

    // Picked with the words hard left, where the column is widest and a
    // short line is most obviously short.
    await setAlign(page, 'left')
    const line = await shortestLyricLine(page)
    const left = await lyricTextBox(page, line)
    expect(left).not.toBeNull()
    await page.screenshot({ path: `${SHOTS}/desktop-align-left.png` })

    await setAlign(page, 'right')
    const right = await lyricTextBox(page, line)
    await page.screenshot({ path: `${SHOTS}/desktop-align-right.png` })

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

    // Remembered per device, under the room's own key.
    expect(
      await page.evaluate(() =>
        localStorage.getItem('pitchperfect_jam_lyrics_align'),
      ),
    ).toBe('center')
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
    await page.screenshot({ path: `${SHOTS}/desktop-lanes-hidden.png` })

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
    await page.screenshot({ path: `${SHOTS}/phone-stacked-default.png` })

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
    await page.screenshot({ path: `${SHOTS}/phone-stacked-lanes-tall.png` })

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
    await page.screenshot({ path: `${SHOTS}/phone-zoom-1x.png` })
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
    await page.screenshot({ path: `${SHOTS}/phone-zoom-2x.png` })

    // The buttons are still reachable with a thumb on a coarse pointer.
    const zoomIn = page.getByLabel('Look closer at the pitch lanes')
    const buttonBox = await zoomIn.boundingBox()
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(24)
    expect(buttonBox?.width ?? 0).toBeGreaterThanOrEqual(24)
  })

  test('aligns the words on a narrow column too @smoke', async ({ page }) => {
    await openSongRoom(page)
    await setAlign(page, 'left')
    const line = await shortestLyricLine(page)
    const left = await lyricTextBox(page, line)
    await setAlign(page, 'center')
    const centered = await lyricTextBox(page, line)
    await page.screenshot({ path: `${SHOTS}/phone-align-center.png` })
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
