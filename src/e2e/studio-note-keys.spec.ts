// Studio note roll keys — on a computer a press on a piano key in the note roll's keys' column sounds that key at the speakers, the key lit while it sounds and dark after; the mouse held down and slid up the keys plays each it reaches; a press on a kit's drum name sounds that drum; on a phone and a tablet a tap on a key or a drum's name sounds it, lit, and a finger dragged on the keys pans the rows. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import { center } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import type { NoteRollView } from './helpers/studio-note-roll'
import { keysX, litKey, pitchY, readNoteRoll, rowHeight, touchDrag, } from './helpers/studio-note-roll'
import { DRUM_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'
import { audioClock, captureOutput, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { toneAmplitude } from './helpers/studio-output-span'

const SNARE = 38
/** The kit's rows from the top, as the editor shows them for the beat. */
const ROWS = studioDrumRows(DRUM_NOTES)
/** A drum's row, counted from the kick at the foot. */
const rowOf = (key: number) =>
  ROWS.length - 1 - ROWS.findIndex((row) => row.key === key)

/** Middle C's frequency, its key's fundamental. */
const MIDDLE_C_HZ = 261.63

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

/** How strong middle C is at the speakers over the 0.1 s from where the sound starts, a moment after it was pressed. */
async function middleCHeard(page: Page): Promise<number> {
  await untilAudioClock(page, (await audioClock(page)) + 0.2)
  const capture = await captureOutput(page)
  const onset = capture.samples.findIndex((sample) => Math.abs(sample) > 1e-3)
  if (onset < 0) return 0
  const window = Math.min(
    Math.round(0.1 * capture.sampleRate),
    capture.samples.length - onset,
  )
  return toneAmplitude(capture, onset, window, MIDDLE_C_HZ)
}

/** The middle of the row the view shows nearest its middle: a key surely in view. */
const middleKey = (view: NoteRollView) =>
  Math.round((view.minMidi + view.maxMidi) / 2)

test.describe('Studio note roll keys on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a press on a piano key sounds it at the speakers, lit while it sounds, and the mouse slid up the keys plays each it reaches @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await captureStudioOutput(page)
    await openByMouse(page)
    const view = await readNoteRoll(page)
    const x = keysX(view)

    await page.mouse.move(x, pitchY(view, 60))
    await page.mouse.down()
    await expect.poll(() => litKey(page)).toBe(60)
    expect(await middleCHeard(page)).toBeGreaterThan(0.002)
    // Up the keys to E4, by C sharp, D and E flat.
    await page.mouse.move(x, pitchY(view, 64), { steps: 8 })
    await expect.poll(() => litKey(page)).toBe(64)
    await page.mouse.up()

    // Dark once its moment has sounded.
    await expect.poll(() => litKey(page)).toBeNull()
    expect(live).toEqual([])
  })

  test('a press on a kit’s drum name sounds that drum, lit while it sounds', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await captureStudioOutput(page)
    await openByMouse(page, true)
    const view = await readNoteRoll(page, false, true)

    await page.mouse.click(keysX(view, false, true), pitchY(view, rowOf(SNARE)))

    await expect.poll(() => litKey(page)).toBe(SNARE)
    await untilAudioClock(page, (await audioClock(page)) + 0.2)
    const capture = await captureOutput(page)
    expect(Math.max(...capture.samples.map(Math.abs))).toBeGreaterThan(0.005)
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
  test.describe(`Studio note roll keys on a ${screen.name}`, () => {
    test.use(screen.use)

    test('a tap on a key sounds it, lit while it sounds, and a finger dragged on the keys pans the rows @smoke', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openByTouch(page)
      const view = await readNoteRoll(page, screen.phone)
      const key = middleKey(view)
      const at = { x: keysX(view, screen.phone), y: pitchY(view, key) }

      await page.touchscreen.tap(at.x, at.y)
      await expect.poll(() => litKey(page)).toBe(key)
      // Three rows down the keys: the rows follow the finger.
      await touchDrag(page, at, { x: at.x, y: at.y + 3 * rowHeight(view) })

      await expect
        .poll(async () => (await readNoteRoll(page, screen.phone)).maxMidi)
        .toBeGreaterThan(view.maxMidi + 2)
      await expect.poll(() => litKey(page)).toBeNull()
      expect(live).toEqual([])
    })

    test('a tap on a drum’s name sounds that drum, lit while it sounds', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      await openByTouch(page, true)
      const view = await readNoteRoll(page, screen.phone, true)

      await page.touchscreen.tap(
        keysX(view, screen.phone, true),
        pitchY(view, rowOf(SNARE)),
      )

      await expect.poll(() => litKey(page)).toBe(SNARE)
      expect(live).toEqual([])
    })
  })
}
