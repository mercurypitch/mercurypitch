// Studio MIDI lanes — with a fake Web MIDI keyboard in the page, a lane set to it plays the piano's synth (the sampled grand's samples refused, so the run is the same every time), arms with no microphone, records the sound as a take, and saves the note played in the song as the sequence its clip plays, its sound in the take starting at its frame or within one audio callback after, the arm's first note as loud as the same note after it; and the Inputs view lists the keyboard with its lane and a light while it plays. Its notes are heard once, through the lane, whether monitoring is on or off, and not at all with the lane muted. Nothing reaches the live site.
import { expect, test } from '@playwright/test'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordTake, setMonitoring } from './helpers/studio-arming'
import { installFakeMidi, microphonesAsked, playLaneFromKeys, playMidi as play, routeNetwork, } from './helpers/studio-midi'
import { audioClock, captureOutput, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { toneAmplitude } from './helpers/studio-output-span'
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
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
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

  test("records an arm's first note as loud as the same note played after it", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await playLaneFromKeys(page, 'Lane 2')
    await armLane(page, 'Lane 2')

    // Middle C at velocity 100, three times: the arm's first note, then two.
    await recordTake(page, 'Take 1', async () => {
      for (let note = 0; note < 3; note += 1) {
        await play(page, [0x90, 60, 100])
        await page.evaluate(() => new Promise((done) => setTimeout(done, 400)))
        await play(page, [0x80, 60, 0])
        await page.evaluate(() => new Promise((done) => setTimeout(done, 400)))
      }
    })

    const take = await storedTake(
      page,
      { title: 'Take 1' },
      { hz: [261.63], over: 'onset', eachNote: 0.25 },
    )
    const [first, second, third] = take.noteTones
    const db = (level: number, against: number) =>
      20 * Math.log10(level / against)
    const firstDb = db(first, (second + third) / 2)
    console.log(
      `[studio-midi-lanes] ${JSON.stringify({ noteTones: take.noteTones, firstAgainstLaterDb: firstDb, laterDb: db(third, second) })}`,
    )

    expect(take.notes).toHaveLength(3)
    expect(second).toBeGreaterThan(0.005)
    expect(Math.abs(db(third, second))).toBeLessThan(0.1)
    // A new limiter starts as if it were compressing hard: the first note
    // was 1.39 dB under the rest before it eased in (piano-fallback-synth.ts).
    expect(Math.abs(firstDb)).toBeLessThan(0.1)
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
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
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

  test("plays a MIDI lane's notes once, through its lane, with monitoring on or off, and not with the lane muted", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio
      .getByRole('button', { name: 'New audio lane', exact: true })
      .click()
    await playLaneFromKeys(page, 'Lane 2')
    await armLane(page, 'Lane 2')

    /** Middle C held half a second, and how strong it is at the speakers over the 0.3 s from where it starts. */
    const heard = async () => {
      await play(page, [0x90, 60, 100])
      await untilAudioClock(page, (await audioClock(page)) + 0.5)
      const capture = await captureOutput(page)
      await play(page, [0x80, 60, 0])
      await untilAudioClock(page, (await audioClock(page)) + 0.5)
      const window = Math.round(0.3 * capture.sampleRate)
      const onset = capture.samples.findIndex(
        (sample) => Math.abs(sample) > 1e-3,
      )
      if (onset < 0) return 0
      expect(onset + window).toBeLessThanOrEqual(capture.samples.length)
      return toneAmplitude(capture, onset, window, 261.63)
    }
    // The lane's monitor rises on the arm over the house release (input-
    // monitor.ts): past it, the arm's first note is as loud as the rest.
    await untilAudioClock(page, (await audioClock(page)) + 0.3)
    const off = await heard()
    const again = await heard()
    await setMonitoring(page, true)
    const on = await heard()
    await studio
      .getByRole('button', { name: 'Mute Lane 2', exact: true })
      .click()
    await untilAudioClock(page, (await audioClock(page)) + 0.3)
    const muted = await heard()
    console.log(
      `[studio-midi-lanes] ${JSON.stringify({ off, again, on, muted, againstFirstDb: 20 * Math.log10(again / off), onAgainstOffDb: 20 * Math.log10(on / off) })}`,
    )

    expect(off).toBeGreaterThan(0.005)
    expect(Math.abs(20 * Math.log10(again / off))).toBeLessThan(0.1)
    // The one path through the lane: a second would put the note 6 dB up.
    expect(Math.abs(20 * Math.log10(on / off))).toBeLessThan(1.5)
    expect(muted).toBeLessThan(off / 100)
    expect(live).toEqual([])
  })
})
