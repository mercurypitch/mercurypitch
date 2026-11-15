// Studio drum editing — on a phone and a tablet a tap in Draw puts a hit in an empty cell, a tap on it takes it away and Undo brings it back; a drag in Draw paints a hit on every step it crosses; a hit pressed and dragged moves between rows and steps at once; a lollipop dragged down makes a hit softer; on a computer a click in Draw adds a hit and takes it away, a marquee takes the hits it crosses, Up moves them a row and Ctrl+Z takes that back, a hit pressed at its far side moves rather than lengthening, and the toolbar has no transpose. Each edit is read back from the saved song; nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import { center, studioRegion } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import type { NoteRollView } from './helpers/studio-note-roll'
import { lollipopHead, moved, pitchY, readNoteRoll, rowHeight, savedNote, savedNotes, tickWidth, tickX, touchDrag, velocityStepHeight, } from './helpers/studio-note-roll'
import { DRUM_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

const KICK = 36
const SNARE = 38
const LOW_TOM = 45
const HIGH_TOM = 50
/** The kit's rows from the top, as the editor shows them for the beat. */
const ROWS = studioDrumRows(DRUM_NOTES)
/** A key's row, counted from the kick at the foot. */
const rowOf = (key: number) =>
  ROWS.length - 1 - ROWS.findIndex((row) => row.key === key)
/** The beat's hit of `key` at `tick`. */
const beatHit = (key: number, tick: number) =>
  DRUM_NOTES.find((note) => note.pitch === key && note.startTick === tick)!
/** The id the next hit drawn takes. */
const NEXT_ID = DRUM_NOTES.length + 1

/** Just inside the cell of `key`'s row at `tick`, where its hit's square starts. */
const cellAt = (view: NoteRollView, key: number, tick: number) => ({
  x: tickX(view, tick) + 3,
  y: pitchY(view, rowOf(key)),
})

/** The beat open on a Drums lane, its clip's notes opened by two taps. */
async function openDrumsByTouch(page: Page): Promise<void> {
  const clip = await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })
  const point = await center(clip)
  await page.touchscreen.tap(point.x, point.y)
  await page.touchscreen.tap(point.x + 3, point.y)
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
}

/** The beat open on a Drums lane, its clip's notes opened by a double-click. */
async function openDrumsByMouse(page: Page): Promise<void> {
  const clip = await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })
  await clip.dblclick()
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
}

const drawButton = (page: Page) =>
  noteEditor(page).getByRole('button', { name: 'Draw', exact: true })

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
  test.describe(`Studio drum editing on a ${screen.name}`, () => {
    test.use(screen.use)

    test('a tap in Draw puts a hit in an empty cell, a tap on it takes it away, and Undo brings it back', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openDrumsByTouch(page)
      await drawButton(page).tap()
      await expect(drawButton(page)).toHaveAttribute('aria-pressed', 'true')
      // The high tom's row is empty: bar 1's second beat, two sixteenths in.
      const view = await readNoteRoll(page, screen.phone, true)
      const cell = cellAt(view, HIGH_TOM, 1440)

      await page.touchscreen.tap(cell.x, cell.y)
      await expect
        .poll(() => savedNote(page, NEXT_ID))
        .toMatchObject({ pitch: HIGH_TOM, startTick: 1440, lengthTicks: 240 })
      await page.touchscreen.tap(cell.x, cell.y)
      await expect.poll(() => savedNote(page, NEXT_ID)).toBeNull()
      await noteEditor(page)
        .getByRole('button', { name: 'Undo', exact: true })
        .tap()

      await expect
        .poll(() => savedNote(page, NEXT_ID))
        .toMatchObject({ pitch: HIGH_TOM, startTick: 1440 })
      expect(live).toEqual([])
    })

    test('a drag in Draw paints a hit on every step it crosses', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openDrumsByTouch(page)
      await drawButton(page).tap()
      const view = await readNoteRoll(page, screen.phone, true)

      // Along the empty low tom's row, from the first sixteenth to the fifth.
      const from = cellAt(view, LOW_TOM, 0)
      await touchDrag(page, from, { x: tickX(view, 960) + 3, y: from.y })

      await expect
        .poll(async () =>
          (await savedNotes(page))
            .filter((note) => note.pitch === LOW_TOM)
            .map((note) => note.startTick),
        )
        .toEqual([0, 240, 480, 720, 960])
      expect(live).toEqual([])
    })

    test('a hit pressed and dragged moves between rows and steps at once, and its lollipop dragged down makes it softer', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openDrumsByTouch(page)
      const snare = beatHit(SNARE, 960)
      let view = await readNoteRoll(page, screen.phone, true)

      // The snare on beat 2, two sixteenths later and two rows up: the high tom.
      const from = cellAt(view, SNARE, 960)
      await touchDrag(
        page,
        from,
        moved(from, tickWidth(view, 480), -2 * rowHeight(view)),
      )
      await expect
        .poll(() => savedNote(page, snare.id))
        .toMatchObject({ pitch: HIGH_TOM, startTick: 1440 })

      // The kick on beat 3, its lollipop's head 14 px down.
      const kick = beatHit(KICK, 1920)
      view = await readNoteRoll(page, screen.phone, true)
      const head = lollipopHead(view, kick)
      await touchDrag(page, head, moved(head, 0, 14))
      const softer = 127 - Math.round(14 / velocityStepHeight(view))
      await expect
        .poll(async () =>
          Math.round((await savedNote(page, kick.id))!.velocity * 127),
        )
        .toBe(softer)
      expect(live).toEqual([])
    })
  })
}

test.describe('Studio drum editing on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a click in Draw adds a hit and takes it away, and the toolbar has no transpose', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openDrumsByMouse(page)
    const editor = noteEditor(page)
    await expect(
      studioRegion(page).locator('[data-studio-track-source]').first(),
    ).toHaveText('MIDI · Kit')
    await expect(editor.getByRole('group', { name: 'Transpose' })).toHaveCount(
      0,
    )
    await page.keyboard.press('b')
    await expect(drawButton(page)).toHaveAttribute('aria-pressed', 'true')
    const view = await readNoteRoll(page, false, true)
    const cell = cellAt(view, HIGH_TOM, 1440)

    await page.mouse.click(cell.x, cell.y)
    await expect
      .poll(() => savedNote(page, NEXT_ID))
      .toMatchObject({ pitch: HIGH_TOM, startTick: 1440, lengthTicks: 240 })
    await page.mouse.click(cell.x, cell.y)

    await expect.poll(() => savedNote(page, NEXT_ID)).toBeNull()
    expect(live).toEqual([])
  })

  test('a marquee takes the hits it crosses, Up moves them a row, and Ctrl+Z takes that back', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openDrumsByMouse(page)
    const view = await readNoteRoll(page, false, true)
    const snares = [beatHit(SNARE, 960), beatHit(SNARE, 2880)]

    // From the empty high tom's row before beat 2 down to the snare's
    // after beat 4: the two snares, and no hat, kick or tom.
    const from = cellAt(view, HIGH_TOM, 800)
    const to = cellAt(view, SNARE, 3000)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.press('ArrowUp')
    await expect
      .poll(async () =>
        Promise.all(
          snares.map(async (each) => (await savedNote(page, each.id))!.pitch),
        ),
      )
      .toEqual([LOW_TOM, LOW_TOM])
    await page.keyboard.press('ControlOrMeta+z')

    await expect.poll(() => savedNotes(page)).toEqual(DRUM_NOTES)
    expect(live).toEqual([])
  })

  test('a hit pressed at its far side moves rather than lengthening: a kit has no grips', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openDrumsByMouse(page)
    const view = await readNoteRoll(page, false, true)
    const snare = beatHit(SNARE, 960)
    const cell = cellAt(view, SNARE, 960)
    await page.mouse.click(cell.x, cell.y)

    // Its square's far side, then two sixteenths on.
    const side = { x: cell.x + rowHeight(view) / 2, y: cell.y }
    await page.mouse.move(side.x, side.y)
    await page.mouse.down()
    await page.mouse.move(side.x + tickWidth(view, 480), side.y, { steps: 8 })
    await page.mouse.up()

    await expect
      .poll(() => savedNote(page, snare.id))
      .toMatchObject({ startTick: 1440, lengthTicks: snare.lengthTicks })
    expect(live).toEqual([])
  })
})
