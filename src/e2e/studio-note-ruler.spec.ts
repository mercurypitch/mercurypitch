// Studio note roll ruler — on a computer a click on the note roll's ruler moves a stopped song's position there and the roll draws its playhead there, a click moves a playing song there and it plays on, a drag along the ruler scrubs a stopped song, and the clip's End handle still takes its own drag and moves no playhead; a click in the dimmed room past the clip's end moves the song to its time there; on a phone and a tablet a tap on the ruler moves the song's position. Each position is read back from the transport, as the lanes' ruler says it; nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { center, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import { endHandle } from './helpers/studio-midi-clips'
import type { NoteRollView } from './helpers/studio-note-roll'
import { noteRoll, readNoteRoll, rulerY, tickX, } from './helpers/studio-note-roll'
import { noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

/** The song's position in seconds, as the lanes' ruler says it. */
async function songSeconds(page: Page): Promise<number> {
  const ruler = studioRegion(page).getByRole('slider', {
    name: 'Song playhead',
  })
  return Number(await ruler.getAttribute('aria-valuenow'))
}

/** The clip's tick that sounds at `seconds` into the song: its take starts the song at 120 bpm, 960 ticks a beat. */
const tickAt = (seconds: number) => seconds * 1920

/** Where the roll's ruler stands at `seconds` into the song, on the page. */
const rulerAt = (view: NoteRollView, seconds: number) => ({
  x: tickX(view, tickAt(seconds)),
  y: rulerY(view),
})

/** Where the roll draws its playhead across the page: the opaque columns of its overlay along a row of the grid with no note on it. */
async function drawnPlayheadX(page: Page, y: number): Promise<number | null> {
  return noteRoll(page)
    .locator('canvas[role="img"]')
    .evaluate((canvas: HTMLCanvasElement, row) => {
      const box = canvas.getBoundingClientRect()
      const scale = canvas.width / box.width
      const pixels = canvas
        .getContext('2d')!
        .getImageData(
          0,
          Math.round((row - box.top) * scale),
          canvas.width,
          1,
        ).data
      const columns: number[] = []
      for (let x = 0; x < canvas.width; x++)
        if (pixels[x * 4 + 3] > 128) columns.push(x)
      if (columns.length === 0) return null
      const middle = (columns[0] + columns[columns.length - 1]) / 2
      return box.left + middle / scale
    }, y)
}

async function openByMouse(page: Page): Promise<NoteRollView> {
  const clip = await openMidiSong(page)
  await clip.dblclick()
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
  return readNoteRoll(page)
}

test.describe('Studio note roll ruler on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a click on the ruler moves a stopped song there, and the roll draws its playhead there @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const view = await openByMouse(page)
    const bar2 = rulerAt(view, 2)

    await page.mouse.click(bar2.x, bar2.y)

    await expect.poll(() => songSeconds(page)).toBeCloseTo(2, 1)
    // Down the grid on the row above C5, where no note is.
    await expect
      .poll(async () =>
        Math.abs(((await drawnPlayheadX(page, view.top + 2)) ?? 0) - bar2.x),
      )
      .toBeLessThan(1.5)
    expect(live).toEqual([])
  })

  test('a click in the dimmed room past the clip’s end moves the song to its time there, the song running on past the clip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openMidiSong(page)
    const studio = studioRegion(page)
    // A Piano lane's new clip runs four bars, 8 s: the song runs past the
    // Keys clip's end at 4 s.
    await studio
      .getByRole('button', { name: 'New piano lane', exact: true })
      .click()
    await expect(noteEditor(page)).toBeVisible()
    await noteEditor(page)
      .getByRole('button', { name: 'Done', exact: true })
      .click()
    await studio.locator('[data-midi-clip]').first().dblclick()
    await expect(noteEditor(page)).toHaveAccessibleName(/^Note editor: Keys/)
    await noteEditorArrived(noteEditor(page))
    const view = await readNoteRoll(page)

    // A bar past the Keys clip's end, clear of its End handle.
    const past = rulerAt(view, 6)
    await page.mouse.click(past.x, past.y)

    await expect.poll(() => songSeconds(page)).toBeCloseTo(6, 1)
    expect(live).toEqual([])
  })

  test('a click on the ruler moves a playing song there, and it plays on from there @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const view = await openByMouse(page)
    const studio = studioRegion(page)
    const late = rulerAt(view, 3)
    await page.mouse.click(late.x, late.y)
    await expect.poll(() => songSeconds(page)).toBeCloseTo(3, 1)
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await expect.poll(() => songSeconds(page)).toBeGreaterThan(3.05)

    // Back to half a second in, while it plays.
    const early = rulerAt(view, 0.5)
    await page.mouse.click(early.x, early.y)

    await expect.poll(() => songSeconds(page)).toBeLessThan(1.5)
    await expect.poll(() => songSeconds(page)).toBeGreaterThan(0.6)
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
    expect(live).toEqual([])
  })

  test('a drag along the ruler scrubs a stopped song, and the End handle still takes its own drag and moves no playhead', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const view = await openByMouse(page)
    const from = rulerAt(view, 0.5)
    const to = rulerAt(view, 1.5)

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await expect.poll(() => songSeconds(page)).toBeCloseTo(1.5, 1)
    await page.mouse.up()
    await expect.poll(() => songSeconds(page)).toBeCloseTo(1.5, 1)

    // The End handle, on the clip's end at 4 s, dragged half a second on.
    const end = (await endHandle(page).boundingBox())!
    const grab = { x: end.x + end.width / 2, y: end.y + end.height / 2 }
    const before = (await readStudioProject(page)).clips[0].sourceOutFrame
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(rulerAt(view, 4.5).x, grab.y, { steps: 8 })
    await page.mouse.up()

    await expect
      .poll(async () => (await readStudioProject(page)).clips[0].sourceOutFrame)
      .toBeGreaterThan(before)
    expect(await songSeconds(page)).toBeCloseTo(1.5, 1)
    expect(live).toEqual([])
  })
})

const TOUCH_SCREENS = [
  {
    name: 'phone',
    phone: true,
    use: {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
  },
  {
    name: 'tablet',
    phone: false,
    use: { viewport: { width: 1180, height: 820 }, hasTouch: true },
  },
] as const

for (const screen of TOUCH_SCREENS) {
  test.describe(`Studio note roll ruler on a ${screen.name}`, () => {
    test.use(screen.use)

    test('a tap on the ruler moves the song’s position there @smoke', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      const clip = await openMidiSong(page)
      const point = await center(clip)
      await page.touchscreen.tap(point.x, point.y)
      await page.touchscreen.tap(point.x + 3, point.y)
      const editor = noteEditor(page)
      await expect(editor).toBeVisible()
      await noteEditorArrived(editor)
      const view = await readNoteRoll(page, screen.phone)

      const bar2 = rulerAt(view, 2)
      await page.touchscreen.tap(bar2.x, bar2.y)
      await expect.poll(() => songSeconds(page)).toBeCloseTo(2, 1)
      const beat = rulerAt(view, 3.5)
      await page.touchscreen.tap(beat.x, beat.y)

      await expect.poll(() => songSeconds(page)).toBeCloseTo(3.5, 1)
      expect(live).toEqual([])
    })
  })
}
