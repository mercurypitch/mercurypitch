// Studio MIDI lanes — with a fake Web MIDI keyboard in the page, a lane set to it plays the piano's synth (the sampled grand's samples refused, so the run is the same every time), arms with no microphone, records the sound as a take, and saves the note played in the song as the sequence its clip plays, its sound in the take starting at its frame or within one audio callback after; and the Inputs view lists the keyboard with its lane and a light while it plays. Nothing reaches the live site.
import { expect, test } from '@playwright/test'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordTake } from './helpers/studio-arming'
import { installFakeMidi, microphonesAsked, playLaneFromKeys, playMidi as play, routeNetwork, } from './helpers/studio-midi'
import { storedTake, studioTickFrame } from './helpers/studio-takes'

test.use({ viewport: { width: 1440, height: 900 } })

test.describe('Studio MIDI lanes', () => {
  test('records a MIDI lane as a take with no microphone, and saves its note in the song at or just before its sound', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await playLaneFromKeys(page, 'Lane 2')
    await expect(
      studio.getByRole('button', {
        name: 'Lane 2 records from Fake Keys (MIDI)',
        exact: true,
      }),
    ).toHaveText('MIDI')

    await armLane(page, 'Lane 2')
    await expect(
      studio.getByText(
        'Armed on Lane 2 with Fake Keys. Press Record to start.',
        { exact: true },
      ),
    ).toBeVisible()
    await recordTake(page, 'Take 1', async () => {
      await play(page, [0x90, 60, 100])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 600)))
      await play(page, [0x80, 60, 0])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 300)))
    })

    const read = await storedTake(
      page,
      { title: 'Take 1' },
      { hz: [261.63, 400], over: 'onset' },
    )
    // The amplitude of middle C and of 400 Hz while the note sounded.
    const take = { ...read, middleC: read.tones[0], between: read.tones[1] }
    const project = await readStudioProject(page)
    const clip = project.clips.find((each) => each.assetId === take.assetId)!
    const microphones = await microphonesAsked(page)
    console.log(
      `[studio-midi-lanes] ${JSON.stringify({ ...take, midi: clip.midi, microphones })}`,
    )

    expect(microphones).toBe(0)
    // The clip plays a sequence of the song, laid on the song's tempo.
    expect(clip.midi?.sequenceId).toEqual(expect.any(String))
    expect(clip.midi?.renderKey).toMatch(/^[0-9a-f]{16}$/)
    expect(take.tempoBpm).toBe(project.tempoBpm)
    expect(take.notes).toHaveLength(1)
    const [note] = take.notes
    expect([note.pitch, Math.round(note.velocity * 127)]).toEqual([60, 100])
    // The key was held about 0.6 s.
    const held = studioTickFrame(take, note.lengthTicks)
    expect(held).toBeGreaterThan(0.45 * 48_000)
    expect(held).toBeLessThan(0.9 * 48_000)
    // The take holds the piano's middle C, and the note sits where its sound
    // starts, never after it. The sound crosses the onset's level a little
    // later: the synth rises over 8 ms and its limiter looks 6 ms ahead, and
    // a note whose message is already past starts at the audio's next
    // callback, up to one callback after the time it is kept at. Measured in
    // headless Chromium, 12.8 to 24.8 ms.
    expect(take.peak).toBeGreaterThan(0.02)
    expect(take.middleC).toBeGreaterThan(4 * take.between)
    // Tick 0 is the take's first sample, where the clip's source frames count from.
    const late = take.onset - studioTickFrame(take, note.startTick)
    expect(late).toBeGreaterThanOrEqual(0)
    expect(late).toBeLessThan(0.04 * 48_000)
    expect(live).toEqual([])
  })

  test('lists the keyboard in the Inputs view with its lane, lit while it plays', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await playLaneFromKeys(page, 'Lane 2')

    await studio.getByRole('button', { name: 'Sound', exact: true }).click()
    await studio
      .getByRole('button', { name: 'Inputs and channels', exact: true })
      .click()
    const midi = studio.getByRole('region', { name: 'MIDI inputs' })
    const row = midi.locator('[data-studio-midi-port="fake-keys"]')
    await expect(row).toContainText('Fake Keys')
    await expect(row).toContainText('Lane 2')
    const light = row.locator('[aria-hidden="true"]')
    await expect(async () => {
      await play(page, [0x90, 64, 90])
      await expect(light).toHaveAttribute('data-active', '', { timeout: 200 })
    }).toPass({ timeout: 10_000 })
    await play(page, [0x80, 64, 0])
    await expect(light).not.toHaveAttribute('data-active', '')
    expect(live).toEqual([])
  })
})
