// Studio note editor — a MIDI clip draws its notes in its lane's canvas; a double-click opens its notes in a drawer under the lanes, Escape and Done close it and give the focus back to the clip; Clip details' Edit notes and E open it too; the drawer's top edge resizes it, Expand fills the arrangement and Mix takes turns with it; two taps open it on a tablet, and on a phone it fills the screen until Done.
import { expect, test } from '@playwright/test'
import { center, setStudioZoom, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { clipCanvasAlpha, DRUM_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

test.describe('Studio note editor on a computer', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a MIDI clip draws its notes in its lane, at their times and pitches @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    await setStudioZoom(page, 160)

    await expect(clip).toContainText('MIDI · PIANO')
    await expect(clip).toContainText('8 notes')
    const canvas = clip.locator('canvas')
    await expect(canvas).toHaveAttribute('data-notes', '8')
    // Rows from C#5 down to B3: C5 (from tick 1920 to 2880) on the second.
    const box = (await canvas.boundingBox())!
    const row = (box.height - 4) / 15
    const band = { top: 2 + row, bottom: 2 + row * 2 }
    const x = (tick: number) => (tick / 7680) * box.width
    expect(
      await clipCanvasAlpha(clip, { x: x(2400), ...band }),
    ).toBeGreaterThan(120)
    // The same row where no note is: the waveform stays below it.
    expect(await clipCanvasAlpha(clip, { x: x(6400), ...band })).toBeLessThan(
      60,
    )
  })

  test('a drum clip draws its hits on the kit’s rows, and its editor names them', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })

    await expect(clip).toContainText('MIDI · KIT')
    await expect(clip).toContainText(`${DRUM_NOTES.length} hits`)
    await clip.dblclick()

    await expect(
      noteEditor(page).getByRole('img', {
        name: `${DRUM_NOTES.length} hits on 3 drums, bars 1 to 2`,
      }),
    ).toBeVisible()
  })

  test('a double-click opens the notes under the lanes; Escape and Done close them and give the focus back @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    const editor = noteEditor(page)

    await clip.dblclick()
    await expect(editor).toBeVisible()
    await expect(editor).toBeFocused()
    await expect(
      editor.getByRole('img', { name: '8 notes from C4 to C5, bars 1 to 2' }),
    ).toBeVisible()
    await expect(clip).toHaveAttribute('data-editing', '')
    // Under the lanes: its top below the last lane's.
    const lanes = studioRegion(page).locator('[data-studio-track]').last()
    expect((await editor.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await lanes.boundingBox())!.y,
    )

    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
    await expect(clip).toBeFocused()

    await clip.dblclick()
    await expect(editor).toBeVisible()
    await editor.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(editor).toHaveCount(0)
  })

  test('Edit notes in Clip details, and E on the selected clip, open the notes', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    const studio = studioRegion(page)
    const editor = noteEditor(page)

    await clip.click()
    await studio
      .locator('[aria-label="Selected clip"]')
      .getByRole('button', { name: 'Details', exact: true })
      .click()
    await studio
      .getByRole('button', { name: 'Edit notes', exact: true })
      .click()
    await expect(editor).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)

    await clip.focus()
    await page.keyboard.press('e')
    await expect(editor).toBeVisible()
  })

  test('the drawer resizes from its top edge, fills the arrangement, and takes turns with Mix', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    const studio = studioRegion(page)
    const editor = noteEditor(page)
    await clip.dblclick()
    await expect(editor).toBeVisible()
    await noteEditorArrived(editor)
    const before = (await editor.boundingBox())!.height

    // A real drag of the top edge, 120 px up.
    const edge = editor.getByRole('separator', { name: 'Note editor height' })
    const grip = await center(edge)
    await page.mouse.move(grip.x, grip.y)
    await page.mouse.down()
    await page.mouse.move(grip.x, grip.y - 120, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => (await editor.boundingBox())!.height)
      .toBeCloseTo(before + 120, -1)

    // Expand covers the lanes, which take no focus under it.
    await editor
      .getByRole('button', { name: 'Fill the arrangement', exact: true })
      .click()
    const timeline = studio.locator('[aria-label="Song arrangement"]')
    await expect(timeline).toHaveAttribute('inert', '')
    const arrangement = (await timeline.boundingBox())!
    expect((await editor.boundingBox())!.height).toBeGreaterThanOrEqual(
      arrangement.height - 1,
    )

    // X opens Mix in the editor's place; the notes open again in Mix's.
    await page.keyboard.press('x')
    await expect(editor).toHaveCount(0)
    await expect(studio.getByRole('region', { name: 'Mix' })).toBeVisible()
    await clip.dblclick()
    await expect(editor).toBeVisible()
    await expect(studio.getByRole('region', { name: 'Mix' })).toHaveCount(0)
  })

  test('Ctrl and the wheel zoom the roll about the pointer, and the wheel scrolls its rows', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    await clip.dblclick()
    const roll = noteEditor(page).locator('[data-studio-note-roll]')
    await expect(roll).toHaveAttribute('data-studio-note-roll', /^0:7680:/)
    const box = (await roll.boundingBox())!

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')
    await expect(roll).not.toHaveAttribute('data-studio-note-roll', /^0:7680:/)

    const rows = async () =>
      Number((await roll.getAttribute('data-studio-note-roll'))!.split(':')[2])
    const lowest = await rows()
    await page.mouse.wheel(0, 300)
    await expect.poll(rows).toBeLessThan(lowest)
  })
})

test.describe('Studio note editor on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test('two taps on a MIDI clip open its notes', async ({ page }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    const point = await center(clip)

    await page.touchscreen.tap(point.x, point.y)
    await page.touchscreen.tap(point.x + 4, point.y + 2)

    await expect(noteEditor(page)).toBeVisible()
  })
})

test.describe('Studio note editor on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('two taps open the notes full screen, and Done goes back to the lanes', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    const studio = studioRegion(page)
    const editor = noteEditor(page)
    const point = await center(clip)

    await page.touchscreen.tap(point.x, point.y)
    await expect(
      studio.getByRole('button', { name: 'Edit notes', exact: true }),
    ).toBeVisible()
    await page.touchscreen.tap(point.x + 3, point.y)

    await expect(editor).toBeVisible()
    await expect(studio.locator('[data-studio-top-bar]')).toBeHidden()
    const box = (await editor.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(389)
    await editor.getByRole('button', { name: 'Done', exact: true }).tap()
    await expect(editor).toHaveCount(0)
    await expect(studio.locator('[data-studio-top-bar]')).toBeVisible()
  })
})
