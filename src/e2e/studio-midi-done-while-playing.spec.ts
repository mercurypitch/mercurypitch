// Studio MIDI Done while playing — maff's steps on a new song: a Drums lane with hits drawn in it, a Piano lane with notes drawn in it, Play, and Done while the song plays. The piano's render is kept as its clip's audio and saved with it, and the song plays on with no error said anywhere; it used to stop with "clip.<id>.assetId: Owned source is missing" in a red bar. The sampled grand's samples are refused, so the piano's synth renders. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { studioRegion } from './helpers/dedicatedstudio-fixture'
import { routeNetwork } from './helpers/studio-midi'
import { savedAssets, savedMidiClips } from './helpers/studio-midi-clips'
import { pitchY, readNoteRoll, tickX } from './helpers/studio-note-roll'
import { noteEditor, noteEditorArrived } from './helpers/studio-notes'
import { dismissOverlays, waitForNav } from './helpers/ui'

test.use({ viewport: { width: 1440, height: 900 } })

/** A new lane's clip: four bars at 120 bpm, 15,360 ticks. */
const CLIP_TICKS = 15_360

/** A new, empty song, open in the Studio. */
async function newSong(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  await studioRegion(page)
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  await expect(
    studioRegion(page).getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()
}

/** New lane's Piano or Drums: its empty clip opens in Draw. */
async function newMidiLane(page: Page, kind: 'piano' | 'drums') {
  await studioRegion(page)
    .getByRole('button', { name: `New ${kind} lane`, exact: true })
    .first()
    .click()
  const editor = noteEditor(page)
  await expect(editor).toHaveAttribute(
    'aria-label',
    kind === 'piano' ? /^Note editor: Piano/ : /^Note editor: Drums/,
  )
  await noteEditorArrived(editor)
  await expect(
    editor.getByRole('button', { name: 'Draw', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
}

/** `count` clicks in Draw across the open clip, each on an empty cell, read back from the saved song. */
async function draw(page: Page, lane: string, count: number, kit: boolean) {
  const view = await readNoteRoll(page, false, kit)
  const span = Math.min(view.end, CLIP_TICKS) - view.start
  for (let index = 0; index < count; index++) {
    const tick = view.start + ((index + 0.25) * span) / count
    // A kit's rows count from the kick at its foot; a piano's from middle C.
    const row = kit ? view.minMidi + (index % 3) : 60 + (index % 5)
    await page.mouse.click(tickX(view, tick) + 3, pitchY(view, row))
  }
  await expect
    .poll(async () => (await savedMidiClips(page, lane))[0]?.sequence.notes)
    .toHaveLength(count)
}

/** The song's position as the transport shows it, in seconds. */
async function position(page: Page): Promise<number> {
  const text = await studioRegion(page)
    .getByRole('status', { name: 'Song position', exact: true })
    .textContent()
  const [minutes, seconds] = (text ?? '0:0').split(':').map(Number)
  return minutes * 60 + seconds
}

test.describe('Studio MIDI Done while the song plays', () => {
  test('keeps the piano’s render as its clip’s audio, saved, and the song plays on with no error said @smoke', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const live = await routeNetwork(page)
    await newSong(page)
    const studio = studioRegion(page)
    await newMidiLane(page, 'drums')
    await draw(page, 'Drums', 8, true)
    await newMidiLane(page, 'piano')
    await draw(page, 'Piano', 8, false)
    const silence = (await savedMidiClips(page, 'Piano'))[0].clip.assetId
    // Repeat keeps the song going past its four bars, however long the keep takes.
    await studio
      .getByRole('button', { name: 'Repeat song', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    const pause = studio.getByRole('button', {
      name: 'Pause song',
      exact: true,
    })
    await expect(pause).toBeVisible()
    await expect.poll(() => position(page)).toBeGreaterThan(0.5)

    await noteEditor(page)
      .getByRole('button', { name: 'Done', exact: true })
      .click()

    await expect(noteEditor(page)).toHaveCount(0)
    // Kept: the clip's key names its notes, and it plays the render, saved.
    await expect
      .poll(
        async () => {
          const [piano] = await savedMidiClips(page, 'Piano')
          return (
            piano.clip.assetId !== silence &&
            piano.clip.midi?.renderKey ===
              studioMidiRenderKey(piano.sequence, 'piano')
          )
        },
        { timeout: 45_000 },
      )
      .toBe(true)
    const [piano] = await savedMidiClips(page, 'Piano')
    expect((await savedAssets(page)).map((asset) => asset.id)).toContain(
      piano.clip.assetId,
    )
    // Still playing once the render is in: the position moves on.
    const at = await position(page)
    await expect.poll(() => position(page)).not.toBe(at)
    await expect(pause).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    expect(live).toEqual([])
  })
})
