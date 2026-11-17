// Studio note erasing — on a computer a right-click on the note roll opens no menu and takes away the note it presses, while the rest of the editor keeps its menu, and a right-drag takes exactly the notes it crosses, one Ctrl+Z bringing them all back, on a piano and on a kit; on a phone and a tablet, with Erase on, a tap takes a note away, a swipe the notes it crosses, and Undo brings them back, on a piano and on a kit. Each result is read back from the saved song; nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import { center } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import type { NoteRollView, Point } from './helpers/studio-note-roll'
import { noteCenter, pitchY, readNoteRoll, savedNotes, tickX, touchDrag, } from './helpers/studio-note-roll'
import { DRUM_NOTES, KEYS_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

/** One of the piano's notes as it was written (studio-notes.ts). */
const written = (id: number) => KEYS_NOTES.find((each) => each.id === id)!
/** The ids of the clip's notes as the song saved them. */
const savedIds = async (page: Page) =>
  (await savedNotes(page)).map((each) => each.id)
/** Every id of `notes` but `gone`. */
const idsBut = (notes: readonly { id: number }[], ...gone: number[]) =>
  notes.map((each) => each.id).filter((id) => !gone.includes(id))

const CLOSED_HAT = 42
const SNARE = 38
const KICK = 36
/** The kit's rows from the top, as the editor shows them for the beat. */
const ROWS = studioDrumRows(DRUM_NOTES)
/** A drum's row, counted from the kick at the foot. */
const rowOf = (key: number) =>
  ROWS.length - 1 - ROWS.findIndex((row) => row.key === key)
/** The beat's hits of `key` at `ticks`, by id. */
const hitIds = (key: number, ...ticks: number[]) =>
  DRUM_NOTES.filter(
    (note) => note.pitch === key && ticks.includes(note.startTick),
  ).map((note) => note.id)
/** A point on `key`'s row at `tick`, just into its hit's square. */
const cellAt = (view: NoteRollView, key: number, tick: number): Point => ({
  x: tickX(view, tick) + 3,
  y: pitchY(view, rowOf(key)),
})

async function openByMouse(page: Page, drums = false): Promise<void> {
  const clip = await openMidiSong(
    page,
    drums ? { notes: DRUM_NOTES, lane: 'Drums' } : {},
  )
  await clip.dblclick()
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
}

async function openByTouch(page: Page, drums = false): Promise<void> {
  const clip = await openMidiSong(
    page,
    drums ? { notes: DRUM_NOTES, lane: 'Drums' } : {},
  )
  const point = await center(clip)
  await page.touchscreen.tap(point.x, point.y)
  await page.touchscreen.tap(point.x + 3, point.y)
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
}

/** Keep, in order, whether each context menu the page saw was kept from the browser. */
async function watchMenus(page: Page): Promise<() => Promise<boolean[]>> {
  await page.evaluate(() => {
    const seen: boolean[] = []
    Object.assign(window, { studioMenus: seen })
    window.addEventListener('contextmenu', (event) =>
      seen.push(event.defaultPrevented),
    )
  })
  return () =>
    page.evaluate(
      () => (window as unknown as { studioMenus: boolean[] }).studioMenus,
    )
}

/** The right button pressed at `from`, drawn through `through` and let go at the last. */
async function rightDrag(page: Page, from: Point, ...through: Point[]) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button: 'right' })
  for (const point of through)
    await page.mouse.move(point.x, point.y, { steps: 6 })
  await page.mouse.up({ button: 'right' })
}

test.describe('Studio note erasing on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a right-click on the roll opens no menu and takes away the note it presses; the rest of the editor keeps its menu @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openByMouse(page)
    const menus = await watchMenus(page)
    // A4, on bar 2's first beat.
    const a4 = noteCenter(await readNoteRoll(page), written(6))

    await page.mouse.click(a4.x, a4.y, { button: 'right' })
    await expect.poll(() => savedIds(page)).toEqual(idsBut(KEYS_NOTES, 6))
    await noteEditor(page)
      .getByRole('button', { name: 'Done', exact: true })
      .click({ button: 'right' })

    expect(await menus()).toEqual([true, false])
    expect(live).toEqual([])
  })

  test('a right-drag takes exactly the notes it crosses, and one Ctrl+Z brings them all back @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openByMouse(page)
    const view = await readNoteRoll(page)

    // Down the run from C5 through B4 and A4 to G4: not the chord's G4,
    // E4 and C4 before it, nor F4 after it.
    await rightDrag(
      page,
      noteCenter(view, written(4)),
      noteCenter(view, written(5)),
      noteCenter(view, written(6)),
      noteCenter(view, written(7)),
    )

    await expect
      .poll(() => savedIds(page))
      .toEqual(idsBut(KEYS_NOTES, 4, 5, 6, 7))
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => savedNotes(page)).toEqual(KEYS_NOTES)
    expect(live).toEqual([])
  })

  test('on a kit a right-drag along a row takes the hits it crosses, and a right-click one hit', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openByMouse(page, true)
    const view = await readNoteRoll(page, false, true)

    // Along the hats from just before the second to just past the fourth.
    const from = cellAt(view, CLOSED_HAT, 400)
    await rightDrag(page, from, { x: tickX(view, 1500), y: from.y })
    const swept = hitIds(CLOSED_HAT, 480, 960, 1440)
    await expect
      .poll(() => savedIds(page))
      .toEqual(idsBut(DRUM_NOTES, ...swept))
    // The snare on beat 2.
    const snare = cellAt(view, SNARE, 960)
    await page.mouse.click(snare.x, snare.y, { button: 'right' })

    await expect
      .poll(() => savedIds(page))
      .toEqual(idsBut(DRUM_NOTES, ...swept, ...hitIds(SNARE, 960)))
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
  test.describe(`Studio note erasing on a ${screen.name}`, () => {
    test.use(screen.use)

    const eraseOn = async (page: Page) => {
      const erase = noteEditor(page).getByRole('button', {
        name: 'Erase',
        exact: true,
      })
      await erase.tap()
      await expect(erase).toHaveAttribute('aria-pressed', 'true')
      const box = (await erase.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const undo = (page: Page) =>
      noteEditor(page).getByRole('button', { name: 'Undo', exact: true }).tap()

    test('with Erase on, a tap takes a note away, a swipe the notes it crosses, and Undo brings them back @smoke', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openByTouch(page)
      await eraseOn(page)
      const view = await readNoteRoll(page, screen.phone)

      // A4 tapped, then a swipe from G4 down to F4 after it.
      const a4 = noteCenter(view, written(6))
      await page.touchscreen.tap(a4.x, a4.y)
      await expect.poll(() => savedIds(page)).toEqual(idsBut(KEYS_NOTES, 6))
      await touchDrag(
        page,
        noteCenter(view, written(7)),
        noteCenter(view, written(8)),
      )
      await expect
        .poll(() => savedIds(page))
        .toEqual(idsBut(KEYS_NOTES, 6, 7, 8))

      await undo(page)
      await expect.poll(() => savedIds(page)).toEqual(idsBut(KEYS_NOTES, 6))
      await undo(page)
      await expect.poll(() => savedNotes(page)).toEqual(KEYS_NOTES)
      expect(live).toEqual([])
    })

    test('on a kit, with Erase on, a tap takes a hit away and a swipe along a row the hits it crosses', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openByTouch(page, true)
      await eraseOn(page)
      const view = await readNoteRoll(page, screen.phone, true)

      const snare = cellAt(view, SNARE, 960)
      await page.touchscreen.tap(snare.x, snare.y)
      await expect
        .poll(() => savedIds(page))
        .toEqual(idsBut(DRUM_NOTES, ...hitIds(SNARE, 960)))
      // Along the kicks from the one on beat 3 to the next bar's first. A
      // finger takes a hit a row wide and its reach past that, so on a
      // phone the hats, and the room between two kicks, are all hits.
      const from = cellAt(view, KICK, 1920)
      await touchDrag(page, from, { x: tickX(view, 3840) + 6, y: from.y })

      await expect
        .poll(() => savedIds(page))
        .toEqual(
          idsBut(
            DRUM_NOTES,
            ...hitIds(SNARE, 960),
            ...hitIds(KICK, 1920, 3840),
          ),
        )
      await undo(page)
      await expect
        .poll(() => savedIds(page))
        .toEqual(idsBut(DRUM_NOTES, ...hitIds(SNARE, 960)))
      expect(live).toEqual([])
    })
  })
}
