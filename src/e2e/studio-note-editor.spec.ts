// Studio note editor — a MIDI clip draws its notes in its lane's canvas; a double-click opens its notes in a drawer under the lanes, Escape and Done close it and give the focus back to the clip; a clip too short for its Editing tag drops it whole; Clip details' Edit notes and E open it too; the drawer's top edge resizes it, Expand fills the arrangement and Mix takes turns with it; two taps open it on a tablet, and on a phone it fills the screen until Done.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { center, setStudioZoom, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { clipCanvasAlpha, DRUM_NOTES, noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'

/**
 * Each tag in a MIDI clip's title, by its words, as the clip shows it: whole,
 * hidden, or cut by an edge that clips it.
 */
function clipTags(clip: Locator): Promise<Record<string, string>> {
  return clip.evaluate((button) => {
    const shown: Record<string, string> = {}
    for (const tag of button.querySelectorAll('span')) {
      const words = tag.textContent ?? ''
      if (
        tag.children.length > 0 ||
        !/^(MIDI · |Editing$|\d+ notes$)/.test(words)
      )
        continue
      const box = tag.getBoundingClientRect()
      const seen = {
        left: -Infinity,
        right: Infinity,
        top: -Infinity,
        bottom: Infinity,
      }
      for (let up = tag.parentElement; up !== null; up = up.parentElement) {
        const style = getComputedStyle(up)
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          const edge = up.getBoundingClientRect()
          seen.left = Math.max(seen.left, edge.left)
          seen.right = Math.min(seen.right, edge.right)
          seen.top = Math.max(seen.top, edge.top)
          seen.bottom = Math.min(seen.bottom, edge.bottom)
        }
        if (up === button) break
      }
      const whole =
        box.left >= seen.left - 0.5 &&
        box.right <= seen.right + 0.5 &&
        box.top >= seen.top - 0.5 &&
        box.bottom <= seen.bottom + 0.5
      const gone =
        box.right <= seen.left ||
        box.left >= seen.right ||
        box.bottom <= seen.top ||
        box.top >= seen.bottom
      shown[words] = whole ? 'whole' : gone ? 'hidden' : 'cut'
    }
    return shown
  })
}

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

  test('a clip too short for its Editing tag drops it whole, and a longer one shows it', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    // The take's four seconds at 40 px a second: room for the chip and the
    // count, and not for Editing as well.
    await setStudioZoom(page, 40)
    await clip.dblclick()
    await expect(noteEditor(page)).toBeVisible()
    await expect(clip).toHaveAttribute('data-editing', '')

    await expect
      .poll(() => clipTags(clip))
      .toEqual({
        'MIDI · PIANO': 'whole',
        '8 notes': 'whole',
        Editing: 'hidden',
      })

    await setStudioZoom(page, 160)
    await expect
      .poll(() => clipTags(clip))
      .toEqual({
        'MIDI · PIANO': 'whole',
        '8 notes': 'whole',
        Editing: 'whole',
      })
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
    // The clip's two bars, and the two dimmed bars past its end.
    await expect(roll).toHaveAttribute('data-studio-note-roll', /^0:15360:/)
    const box = (await roll.boundingBox())!

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')
    await expect(roll).not.toHaveAttribute('data-studio-note-roll', /^0:15360:/)

    const rows = async () =>
      Number((await roll.getAttribute('data-studio-note-roll'))!.split(':')[2])
    const lowest = await rows()
    await page.mouse.wheel(0, 300)
    await expect.poll(rows).toBeLessThan(lowest)
  })

  test('a header too narrow for one row keeps Done beside the names and gives the tools the row under them, Add takes open at 1440', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const clip = await openMidiSong(page)
    await clip.dblclick()
    const editor = noteEditor(page)
    await expect(editor).toBeVisible()
    await addTakes(page, false)

    // At 1440 the names, the tools and Done share one row.
    await expect
      .poll(() => headerRows(editor))
      .toEqual({
        doneByNames: true,
        toolsByDone: true,
        rows: 1,
      })

    // Add takes takes 360 px of it: the tools go under the names and Done,
    // and Done does not fall alone to a third row.
    await addTakes(page, true)
    await expect
      .poll(() => headerRows(editor))
      .toEqual({
        doneByNames: true,
        toolsByDone: false,
        rows: 2,
      })
  })

  test('a kit’s header, with no transpose, keeps one row at 1280', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1280, height: 900 })
    const clip = await openMidiSong(page, { notes: DRUM_NOTES, lane: 'Drums' })
    await clip.dblclick()
    const editor = noteEditor(page)
    await expect(editor).toBeVisible()
    await addTakes(page, false)

    await expect
      .poll(() => headerRows(editor))
      .toEqual({
        doneByNames: true,
        toolsByDone: true,
        rows: 1,
      })
  })
})

/** Open or close Add takes beside the lanes. */
async function addTakes(page: Page, open: boolean): Promise<void> {
  const toggle = studioRegion(page).locator('[data-tour="studio.add-takes"]')
  if ((await toggle.getAttribute('aria-expanded')) !== String(open))
    await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', String(open))
}

/** How the editor's header sets out the names, the tools and Done: which share a row, and how many rows it takes. */
function headerRows(editor: Locator) {
  return editor.evaluate((root) => {
    const tools = root.querySelector('[data-studio-note-tools]')!
    const header = tools.parentElement!
    const middle = (part: Element) => {
      const box = part.getBoundingClientRect()
      return box.top + box.height / 2
    }
    const names = header.firstElementChild!
    const done = root.querySelector('[data-studio-note-done]')!
    // Each part's row is where its middle falls; a row is 44 px at the most.
    const rows = new Set(
      [...header.children].map((part) =>
        Math.round((middle(part) - middle(names)) / 41),
      ),
    )
    return {
      doneByNames: Math.abs(middle(done) - middle(names)) < 12,
      toolsByDone: Math.abs(middle(tools) - middle(done)) < 12,
      rows: rows.size,
    }
  })
}

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
