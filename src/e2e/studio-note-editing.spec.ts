// Studio note editing — on a phone and a tablet a tapped note drags up, down, left and right and an unselected note drags at once, a selected note's grip lengthens it and its lollipop dragged down makes it softer, and Draw draws a note as long as the finger drags, each edit saved in the song; on a computer a mouse's marquee selects the notes it crosses, the arrows, Shift with Down, Delete and Ctrl or Cmd with D, C and V edit the selection, each edit one step Ctrl+Z takes back, Escape clears the selection before it closes the editor, and a MIDI lane's header says what it plays. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { center, studioRegion } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import { lollipopHead, moved, noteCenter, noteEnd, pitchY, readNoteRoll, rowHeight, savedNote, savedNotes, tickWidth, tickX, touchDrag, velocityStepHeight, } from './helpers/studio-note-roll'
import { KEYS_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

/** One of the song's notes as it was written (studio-notes.ts). */
const written = (id: number) => KEYS_NOTES.find((each) => each.id === id)!

/** The editor's readout of the selection's velocity, 1 to 127. */
const selectionVelocity = (page: Page) =>
  noteEditor(page).locator('[data-studio-note-velocity]')

/** The song open, its MIDI clip's notes opened by two taps, the editor done sliding in. */
async function openNotesByTouch(page: Page, phone: boolean): Promise<void> {
  const clip = await openMidiSong(page)
  const point = await center(clip)
  await page.touchscreen.tap(point.x, point.y)
  await page.touchscreen.tap(point.x + 3, point.y)
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
  if (!phone) await roomOnATablet(page)
}

/**
 * A tablet's drawer shows a few rows a finger can take: filled out over the
 * lanes, it keeps its top row and shows more under it, and a finger then
 * slides the rows down until C5's shows, with room above it. Every note the
 * tests move then stays clear of the edges, where a drag scrolls the roll.
 */
async function roomOnATablet(page: Page): Promise<void> {
  const expand = noteEditor(page).getByRole('button', {
    name: 'Fill the arrangement',
    exact: true,
  })
  await expand.tap()
  await expect(expand).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await readNoteRoll(page)).minMidi)
    .toBeLessThan(60)
  const view = await readNoteRoll(page)
  // On the top row late in the clip, where only F4 sounds, rows below.
  const from = { x: tickX(view, 7200), y: view.top + 12 }
  const rows = 74 - view.maxMidi
  await touchDrag(page, from, moved(from, 0, rows * rowHeight(view) + 10))
  await expect
    .poll(async () => (await readNoteRoll(page)).maxMidi)
    .toBeGreaterThan(72.5)
}

/** The song open, its MIDI clip's notes opened by a double-click. */
async function openNotesByMouse(page: Page): Promise<void> {
  const clip = await openMidiSong(page)
  await clip.dblclick()
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
}

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
  test.describe(`Studio note editing on a ${screen.name}`, () => {
    test.use(screen.use)

    test('a tapped note drags up, down, left and right, each move saved in the song', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openNotesByTouch(page, screen.phone)
      // G4, on bar 2's second beat for a beat, at velocity 89.
      let note = written(7)
      const tap = noteCenter(await readNoteRoll(page, screen.phone), note)

      await page.touchscreen.tap(tap.x, tap.y)
      await expect(selectionVelocity(page)).toHaveText('89')

      for (const step of [
        { rows: 2, ticks: 0, to: { pitch: 69, startTick: 4800 } },
        { rows: -3, ticks: 0, to: { pitch: 66, startTick: 4800 } },
        { rows: 0, ticks: 480, to: { pitch: 66, startTick: 5280 } },
        { rows: 0, ticks: -960, to: { pitch: 66, startTick: 4320 } },
      ]) {
        const view = await readNoteRoll(page, screen.phone)
        const from = noteCenter(view, note)
        await touchDrag(
          page,
          from,
          moved(
            from,
            tickWidth(view, step.ticks),
            -step.rows * rowHeight(view),
          ),
        )
        await expect
          .poll(() => savedNote(page, 7))
          .toMatchObject({ ...step.to, lengthTicks: 960 })
        note = { ...note, ...step.to }
      }
      expect(live).toEqual([])
    })

    test('an unselected note drags at once, its grip lengthens it, and its lollipop dragged down makes it softer', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openNotesByTouch(page, screen.phone)
      // A4, on bar 2's first beat for a beat, at velocity 102.
      const note = written(6)

      // Pressed and dragged a row up at once, with no tap first.
      let view = await readNoteRoll(page, screen.phone)
      const body = noteCenter(view, note)
      await touchDrag(page, body, moved(body, 0, -rowHeight(view)))
      await expect
        .poll(() => savedNote(page, 6))
        .toMatchObject({ pitch: 70, startTick: 3840, lengthTicks: 960 })

      // Selected by its drag, it shows its grip: a beat longer.
      view = await readNoteRoll(page, screen.phone)
      const grip = noteEnd(view, { ...note, pitch: 70 }, 4)
      await touchDrag(page, grip, moved(grip, tickWidth(view, 480), 0))
      await expect
        .poll(() => savedNote(page, 6))
        .toMatchObject({ pitch: 70, startTick: 3840, lengthTicks: 1440 })

      // Its lollipop's head, 14 px down: as many of 127 steps softer.
      view = await readNoteRoll(page, screen.phone)
      const head = lollipopHead(view, note)
      await touchDrag(page, head, moved(head, 0, 14))
      const softer = 102 - Math.round(14 / velocityStepHeight(view))
      await expect
        .poll(async () =>
          Math.round((await savedNote(page, 6))!.velocity * 127),
        )
        .toBe(softer)
      await expect(selectionVelocity(page)).toHaveText(String(softer))
      expect(live).toEqual([])
    })

    test('Draw draws a note where a finger presses, as long as it drags', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openNotesByTouch(page, screen.phone)
      const editor = noteEditor(page)

      await editor.getByRole('button', { name: 'Draw', exact: true }).tap()
      await expect(
        editor.getByRole('button', { name: 'Draw', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      // On D4's empty row, pressed just into bar 1's fourth beat and drawn
      // most of the way across it: the note starts on the grid line before
      // the press and ends on the one past the finger, the whole beat.
      const view = await readNoteRoll(page, screen.phone)
      const from = { x: tickX(view, 3000), y: pitchY(view, 62) }
      await touchDrag(page, from, { x: tickX(view, 3720), y: from.y })

      await expect
        .poll(() => savedNote(page, 9))
        .toMatchObject({ pitch: 62, startTick: 2880, lengthTicks: 960 })
      expect(live).toEqual([])
    })
  })
}

test.describe('Studio note editing on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a marquee selects the notes it crosses, Delete takes just those, and Ctrl+Z brings them back', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openNotesByMouse(page)
    await expect(
      studioRegion(page).locator('[data-studio-track-source]').first(),
    ).toHaveText('MIDI · Piano')
    const view = await readNoteRoll(page)

    // From B4's row after it ends, down and back across A4 to G4's row
    // before it starts: B4, A4 and G4, not C5 above or F4 below.
    await page.mouse.move(tickX(view, 5000), pitchY(view, 71))
    await page.mouse.down()
    await page.mouse.move(tickX(view, 2900), pitchY(view, 67), { steps: 8 })
    await page.mouse.up()
    await page.keyboard.press('Delete')

    await expect
      .poll(async () => (await savedNotes(page)).map((each) => each.id))
      .toEqual([1, 2, 3, 4, 8])
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => savedNotes(page)).toEqual(KEYS_NOTES)
    expect(live).toEqual([])
  })

  test('the keys move, transpose, delete, duplicate, copy and paste, each edit one undo step, and Escape clears before it closes', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openNotesByMouse(page)
    const editor = noteEditor(page)
    let view = await readNoteRoll(page)
    // C5, on bar 1's third beat for a beat, at velocity 127.
    const c5 = noteCenter(view, written(4))
    await page.mouse.click(c5.x, c5.y)
    await expect(selectionVelocity(page)).toHaveText('127')

    for (const step of [
      { key: 'ArrowUp', to: { pitch: 73, startTick: 1920 } },
      { key: 'ArrowRight', to: { pitch: 73, startTick: 2160 } },
      { key: 'Shift+ArrowDown', to: { pitch: 61, startTick: 2160 } },
      { key: 'Shift+ArrowUp', to: { pitch: 73, startTick: 2160 } },
    ]) {
      await page.keyboard.press(step.key)
      await expect.poll(() => savedNote(page, 4)).toMatchObject(step.to)
    }
    await page.keyboard.press('Delete')
    await expect.poll(() => savedNote(page, 4)).toBeNull()

    // Five edits, five steps back: the notes as they were written.
    for (let step = 0; step < 5; step++)
      await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => savedNotes(page)).toEqual(KEYS_NOTES)

    // A4 duplicated after itself, and the copy copied and pasted at the
    // playhead, on the song's first beat.
    view = await readNoteRoll(page)
    const a4 = noteCenter(view, written(6))
    await page.mouse.click(a4.x, a4.y)
    await page.keyboard.press('ControlOrMeta+d')
    await expect
      .poll(() => savedNote(page, 9))
      .toMatchObject({ pitch: 69, startTick: 4800, lengthTicks: 960 })
    await page.keyboard.press('ControlOrMeta+c')
    await page.keyboard.press('ControlOrMeta+v')
    await expect
      .poll(() => savedNote(page, 10))
      .toMatchObject({ pitch: 69, startTick: 0, lengthTicks: 960 })

    // Escape clears the selection, and only then closes the editor.
    await page.keyboard.press('Escape')
    await expect(
      editor.getByRole('button', { name: 'Duplicate', exact: true }),
    ).toBeDisabled()
    await expect(editor).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    expect(live).toEqual([])
  })
})
