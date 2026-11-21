// Studio MIDI clips — drawn from scratch and lengthened, each result read back from the saved song: New lane's Piano and Drums (from Add takes on a phone, and from an empty song's own offer under its Add takes, on a computer, a tablet and a phone) make a lane with an empty clip four bars long at the playhead's bar, its audio a quarter second of silence, open in Draw; a double-click with a mouse, or two taps of a finger, on an empty stretch of a MIDI lane makes a clip from the bar under it; a MIDI clip's right edge in the lanes drags past its audio, snapping, its sequence growing, one undo step; the editor's End handle lengthens the clip by a finger or a mouse; and a note drawn in a new clip is rendered and kept as the editor closes, the clip's render key then naming its notes. The sampled grand's samples are refused, so the piano's synth renders. Nothing reaches the live site.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { center, importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import { endDrag, endHandle, laneSecond, renderKept, savedAssets, savedMidiClips, } from './helpers/studio-midi-clips'
import { pitchY, readNoteRoll, tickX, touchDrag, } from './helpers/studio-note-roll'
import { noteEditor, noteEditorArrived, openMidiSong, } from './helpers/studio-notes'
import { dismissOverlays, waitForNav } from './helpers/ui'

/** Four bars at 120 bpm: eight seconds, 15,360 ticks. */
const FOUR_BARS = 384_000
const FOUR_BAR_TICKS = 15_360
/** The MIDI song's clip (studio-notes.ts): four seconds, two bars, 7680 ticks. */
const CLIP_TICKS = 7680

const PHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
}
const TABLET = { viewport: { width: 1180, height: 820 }, hasTouch: true }
const COMPUTER = { viewport: { width: 1440, height: 900 } }

/** The MIDI song's Keys clip (studio-notes.ts), its render kept as it opens, so no keep lets go of a gesture under way. */
async function midiSong(page: Page) {
  const clip = await openMidiSong(page)
  await renderKept(page)
  return clip
}

/** The editor, open on a clip just made, in Draw. */
async function openedInDraw(page: Page): Promise<void> {
  const editor = noteEditor(page)
  await expect(editor).toBeVisible()
  await noteEditorArrived(editor)
  await expect(
    editor.getByRole('button', { name: 'Draw', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
}

/** Lane `lane`'s one MIDI clip, four bars of silence from the song's start, as saved, with its quarter second of audio. */
async function expectEmptyClip(
  page: Page,
  lane: string,
  role: 'piano' | 'drums',
): Promise<void> {
  await expect
    .poll(async () => (await savedMidiClips(page, lane)).length)
    .toBe(1)
  const [made] = await savedMidiClips(page, lane)
  const audio = (await savedAssets(page)).find(
    (asset) => asset.id === made.clip.assetId,
  )
  expect(made.track.role).toBe(role)
  expect(made.clip).toMatchObject({
    startFrame: 0,
    sourceInFrame: 0,
    sourceOutFrame: FOUR_BARS,
  })
  expect(made.sequence).toMatchObject({
    lengthTicks: FOUR_BAR_TICKS,
    notes: [],
  })
  expect(made.clip.midi?.renderKey).toBe(
    studioMidiRenderKey(made.sequence, role),
  )
  expect(audio).toMatchObject({ normalizedFrameCount: 12_000, channels: 1 })
}

/** The Keys clip's window as saved, and its sequence's length. */
async function keysLength(page: Page): Promise<[number, number] | null> {
  const [keys] = await savedMidiClips(page, 'Keys')
  return keys === undefined
    ? null
    : [keys.clip.sourceOutFrame, keys.sequence.lengthTicks]
}

/** Draw one note on middle C at the second beat of the open clip, by a mouse or a finger; then Done, and wait for its render to be kept as the clip's audio. */
async function drawAndKeep(page: Page, lane: string, phone: boolean) {
  const silence = (await savedMidiClips(page, lane))[0].clip.assetId
  const view = await readNoteRoll(page, phone)
  const at = { x: tickX(view, 1000), y: pitchY(view, 60) }
  if (phone) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
  await expect
    .poll(async () => (await savedMidiClips(page, lane))[0].sequence.notes)
    .toEqual([
      expect.objectContaining({ pitch: 60, startTick: 960, lengthTicks: 240 }),
    ])
  await noteEditor(page)
    .getByRole('button', { name: 'Done', exact: true })
    .click()
  await expect(noteEditor(page)).toHaveCount(0)
  // Kept: the clip's key names its notes now, and it plays the render.
  await expect
    .poll(
      async () => {
        const [made] = await savedMidiClips(page, lane)
        return (
          made.clip.assetId !== silence &&
          made.clip.midi?.renderKey ===
            studioMidiRenderKey(made.sequence, 'piano')
        )
      },
      { timeout: 45_000 },
    )
    .toBe(true)
  const [kept] = await savedMidiClips(page, lane)
  const render = (await savedAssets(page)).find(
    (asset) => asset.id === kept.clip.assetId,
  )
  // The render covers the window: four bars and the piano's tail.
  expect(render?.normalizedFrameCount).toBeGreaterThanOrEqual(FOUR_BARS)
}

test.describe('Studio MIDI clips on a computer', () => {
  test.use(COMPUTER)

  test('New lane’s Piano makes a Piano lane with an empty clip, open in Draw, and a note drawn in it renders as the editor closes', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const live = await routeNetwork(page)
    await openArrangement(page)

    await studioRegion(page)
      .getByRole('button', { name: 'New piano lane', exact: true })
      .click()

    await openedInDraw(page)
    await expectEmptyClip(page, 'Piano', 'piano')
    await drawAndKeep(page, 'Piano', false)
    expect(live).toEqual([])
  })

  test('New lane’s Drums makes a Drums lane with an empty clip, open in Draw on the kit', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openArrangement(page)

    await studioRegion(page)
      .getByRole('button', { name: 'New drums lane', exact: true })
      .click()

    await openedInDraw(page)
    await expect(noteEditor(page).getByText('MIDI · KIT')).toBeVisible()
    await expectEmptyClip(page, 'Drums', 'drums')
    expect(live).toEqual([])
  })

  test('a double-click on an empty stretch of a MIDI lane makes a clip from the bar under it, open in Draw', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    // Nine seconds in, in bar 5, which starts at eight.
    const at = await laneSecond(clip, [0, 4], 9)

    await page.mouse.dblclick(at.x, at.y)

    await openedInDraw(page)
    await expect
      .poll(async () =>
        (await savedMidiClips(page, 'Keys')).map((each) => [
          each.clip.startFrame,
          each.clip.sourceOutFrame - each.clip.sourceInFrame,
        ]),
      )
      .toEqual([
        [0, 192_000],
        [FOUR_BARS, FOUR_BARS],
      ])
    expect(live).toEqual([])
  })

  test('a MIDI clip’s right edge drags past its audio, snapping to a second, its sequence growing, and Ctrl+Z takes both back @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    await clip.click()
    const edge = studioRegion(page).getByRole('button', {
      name: 'Trim end',
      exact: true,
    })
    const from = await center(edge)

    // Dragged 78 px at 40 px a second: 1.95 s, which snaps to 6 s.
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 78, from.y, { steps: 12 })
    await page.mouse.up()

    await expect.poll(() => keysLength(page)).toEqual([288_000, 11_520])
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => keysLength(page)).toEqual([192_000, CLIP_TICKS])
    expect(live).toEqual([])
  })

  test('the editor’s End handle, dragged a bar on, lengthens the clip and its sequence @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    await clip.dblclick()
    const drag = await endDrag(page, CLIP_TICKS + 3840)
    await expect(endHandle(page)).toHaveAttribute('aria-valuetext', 'bar 3')

    await page.mouse.move(drag.from.x, drag.from.y)
    await page.mouse.down()
    await page.mouse.move(drag.to.x, drag.to.y, { steps: 12 })
    await page.mouse.up()

    await expect.poll(() => keysLength(page)).toEqual([288_000, 11_520])
    await expect(endHandle(page)).toHaveAttribute('aria-valuetext', 'bar 4')
    expect(live).toEqual([])
  })
})

test.describe('Studio MIDI clips on a tablet', () => {
  test.use(TABLET)

  test('New lane’s Piano, tapped, makes a Piano lane with an empty clip, open in Draw', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openArrangement(page)

    await studioRegion(page)
      .getByRole('button', { name: 'New piano lane', exact: true })
      .tap()

    await openedInDraw(page)
    await expectEmptyClip(page, 'Piano', 'piano')
    expect(live).toEqual([])
  })

  test('two taps on an empty stretch of a MIDI lane make a clip from the bar under them', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    const at = await laneSecond(clip, [0, 4], 9)

    await page.touchscreen.tap(at.x, at.y)
    await page.touchscreen.tap(at.x + 3, at.y)

    await openedInDraw(page)
    await expect
      .poll(async () =>
        (await savedMidiClips(page, 'Keys')).map(
          (each) => each.clip.startFrame,
        ),
      )
      .toEqual([0, FOUR_BARS])
    expect(live).toEqual([])
  })

  test('a selected MIDI clip’s right edge, dragged by a finger past its audio, snaps to a second and grows its sequence', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    const at = await center(clip)
    await page.touchscreen.tap(at.x, at.y)
    const edge = studioRegion(page).getByRole('button', {
      name: 'Trim end',
      exact: true,
    })
    const from = await center(edge)

    await touchDrag(page, from, { x: from.x + 78, y: from.y })

    await expect.poll(() => keysLength(page)).toEqual([288_000, 11_520])
    expect(live).toEqual([])
  })

  test('the editor’s End handle, dragged a bar on by a finger, lengthens the clip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    const at = await center(clip)
    await page.touchscreen.tap(at.x, at.y)
    await page.touchscreen.tap(at.x + 3, at.y)
    const drag = await endDrag(page, CLIP_TICKS + 3840)
    // A finger's target: 44 px across.
    const target = (await endHandle(page).boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)

    await touchDrag(page, drag.from, drag.to)

    await expect.poll(() => keysLength(page)).toEqual([288_000, 11_520])
    expect(live).toEqual([])
  })
})

test.describe('Studio MIDI clips on a phone', () => {
  test.use(PHONE)

  test('Add takes offers New lane: Piano makes a Piano lane with an empty clip, open in Draw, and a note drawn in it renders as the editor closes', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const live = await routeNetwork(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'Add takes', exact: true }).tap()
    const sheet = studio.getByRole('dialog', { name: 'Add takes', exact: true })

    await sheet
      .getByRole('group', { name: 'New lane', exact: true })
      .getByRole('button', { name: 'New piano lane', exact: true })
      .tap()

    await openedInDraw(page)
    await expect(sheet).toHaveCount(0)
    await expectEmptyClip(page, 'Piano', 'piano')
    await drawAndKeep(page, 'Piano', true)
    expect(live).toEqual([])
  })

  test('Add takes offers New lane: Drums makes a Drums lane with an empty clip, open in Draw', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'Add takes', exact: true }).tap()

    await studio
      .getByRole('dialog', { name: 'Add takes', exact: true })
      .getByRole('button', { name: 'New drums lane', exact: true })
      .tap()

    await openedInDraw(page)
    await expectEmptyClip(page, 'Drums', 'drums')
    expect(live).toEqual([])
  })

  test('two taps on an empty stretch of a MIDI lane make a clip from the bar under them', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    // A twelve-second take on a lane of its own, so the Keys lane has room.
    await importStudioAudio(page, 'Long', 12)
    const at = await laneSecond(clip, [0, 4], 9)

    await page.touchscreen.tap(at.x, at.y)
    await page.touchscreen.tap(at.x + 3, at.y)

    await openedInDraw(page)
    await expect
      .poll(async () =>
        (await savedMidiClips(page, 'Keys')).map(
          (each) => each.clip.startFrame,
        ),
      )
      .toEqual([0, FOUR_BARS])
    expect(live).toEqual([])
  })

  test('the editor’s End handle, dragged a bar on by a finger, lengthens the clip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    const clip = await midiSong(page)
    const at = await center(clip)
    await page.touchscreen.tap(at.x, at.y)
    await page.touchscreen.tap(at.x + 3, at.y)
    const drag = await endDrag(page, CLIP_TICKS + 3840, true)
    const target = (await endHandle(page).boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)
    // Taken just under the ruler, on the dimmed side past the end, where a
    // finger's target reaches, and moved a bar on from there.
    const under = { x: drag.from.x + 8, y: target.y + target.height + 9 }

    await touchDrag(page, under, { x: drag.to.x + 8, y: under.y })

    await expect.poll(() => keysLength(page)).toEqual([288_000, 11_520])
    expect(live).toEqual([])
  })
})

/** A new song with nothing in it and Add takes closed: the song's own way to start. */
async function openEmptySong(page: Page): Promise<Locator> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  // A new song opens Add takes, which holds New lane as well. Closed, the
  // song offers both ways to start itself.
  await studio
    .getByRole('button', { name: 'Close Add takes', exact: true })
    .click()
  return studio.getByRole('group', { name: 'Start your song', exact: true })
}

for (const [where, device, touch, tag] of [
  ['a computer', COMPUTER, false, ' @smoke'],
  ['a tablet', TABLET, true, ''],
  ['a phone', PHONE, true, ' @smoke'],
] as const) {
  test.describe(`Studio MIDI clips from an empty song on ${where}`, () => {
    test.use(device)

    test(`an empty song offers Add takes and New lane’s Audio, Piano and Drums, and Piano makes a Piano lane with an empty clip, open in Draw${tag}`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await routeNetwork(page)
      const start = await openEmptySong(page)
      await expect(
        start.getByRole('button', { name: 'Add takes', exact: true }),
      ).toBeEnabled()
      const choices = start.getByRole('group', {
        name: 'New lane',
        exact: true,
      })
      await expect(choices.getByRole('button')).toHaveText([
        'Audio',
        'Piano',
        'Drums',
      ])
      const piano = choices.getByRole('button', {
        name: 'New piano lane',
        exact: true,
      })

      if (touch) await piano.tap()
      else await piano.click()

      await openedInDraw(page)
      await expect(start).toHaveCount(0)
      await expectEmptyClip(page, 'Piano', 'piano')
      expect(live).toEqual([])
    })
  })
}
