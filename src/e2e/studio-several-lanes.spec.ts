// Studio several lanes — on Chromium's two-channel fake capture, a loud tone on the left and a quiet one on the right, Lane 2 on Input 1 and Lane 3 on Input 2 are armed beside each other, the armed card lists both, and one Record records both from the same frame, each take a clip on its own lane holding only its own side; and a fake MIDI keyboard's lane records beside a microphone lane, the microphone opened once, each take holding only its own sound, and the note saved in the song with the keyboard's clip alone. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import type { StudioProject } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton, recordTake, setLaneInput, } from './helpers/studio-arming'
import { installFakeMidi, microphonesAsked, playLaneFromKeys, playMidi, routeNetwork, } from './helpers/studio-midi'
import { storedTake } from './helpers/studio-takes'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'

const LEFT_HZ = 440
const RIGHT_HZ = 660
/** A loud tone on the left and a quiet one on the right: each lane's take tells them apart. */
const STEREO_WAV = writeStereoToneWav(LEFT_HZ, RIGHT_HZ, 10, [0.5, 0.125])
/** Each side's amplitude as the file holds it. */
const LEFT_AMPLITUDE = (0.5 * 26000) / 32768
const RIGHT_AMPLITUDE = (0.125 * 26000) / 32768
const MIDDLE_C_HZ = 261.63

test.use({
  launchOptions: { args: fakeMicArgs(STEREO_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Two lanes beside the song's own: Lane 2 and Lane 3. */
async function addTwoLanes(page: Page): Promise<void> {
  const studio = studioRegion(page)
  for (const lane of ['Lane 2', 'Lane 3']) {
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await expect(
      studio.getByRole('button', { name: `${lane} details`, exact: true }),
    ).toBeVisible()
  }
}

/** The clip each recorded lane keeps its take as, by the lane's name: its asset and where its first sample sits on the song. */
function clipsByLane(
  project: StudioProject,
): Map<string, { assetId: string; heardFirst: number }> {
  const byLane = new Map<string, { assetId: string; heardFirst: number }>()
  for (const clip of project.clips) {
    const track = project.tracks.find((each) => each.id === clip.trackId)
    if (track === undefined || !track.name.startsWith('Lane ')) continue
    byLane.set(track.name, {
      assetId: clip.assetId,
      heardFirst: clip.startFrame - clip.sourceInFrame,
    })
  }
  return byLane
}

test.describe('Studio several lanes', () => {
  test('records Lane 2 on Input 1 and Lane 3 on Input 2 from one press, each take on its own lane holding only its own side', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const live = await routeNetwork(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await addTwoLanes(page)

    // The first arm learns the input's channels; then each lane takes its side.
    await armLane(page, 'Lane 2')
    await setLaneInput(page, 'Lane 2', 'Channel', 'Input 1')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await armLane(page, 'Lane 3')
    await setLaneInput(page, 'Lane 3', 'Channel', 'Input 2')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })

    // Both lanes are armed, and the card lists each with what it records.
    for (const lane of ['Lane 2', 'Lane 3'])
      await expect(
        studio.getByRole('button', {
          name: `Arm ${lane} for recording`,
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true')
    await expect(studio.locator('[data-studio-armed-lane]')).toHaveText([
      /^Armed on Lane 2 with Input 1 of .+\.$/,
      /^Armed on Lane 3 with Input 2 of .+\.$/,
    ])
    await expect(recordButton(page)).toHaveAttribute(
      'title',
      'Record on Lane 2 and Lane 3 (R)',
    )

    await recordTake(page, 'Take 1', undefined, 2)

    const project = await readStudioProject(page)
    const clips = clipsByLane(project)
    const read = async (lane: string) =>
      storedTake(
        page,
        { assetId: clips.get(lane)!.assetId },
        { hz: [LEFT_HZ, RIGHT_HZ], over: 'middle' },
      )
    const [left, right] = [await read('Lane 2'), await read('Lane 3')]
    console.log(
      `[studio-several-lanes] stereo ${JSON.stringify({
        lane2: left.tones,
        lane3: right.tones,
        heardFirst: [...clips.entries()],
      })}`,
    )

    expect([...clips.keys()].sort()).toEqual(['Lane 2', 'Lane 3'])
    // Both takes start on the same frame of the song.
    expect(clips.get('Lane 2')!.heardFirst).toBe(
      clips.get('Lane 3')!.heardFirst,
    )
    // Lane 2 holds the loud left tone alone, Lane 3 the quiet right one alone.
    expect(left.tones[0]).toBeGreaterThan(LEFT_AMPLITUDE * 0.8)
    expect(left.tones[0]).toBeLessThan(LEFT_AMPLITUDE * 1.2)
    expect(left.tones[1]).toBeLessThan(left.tones[0] / 100)
    expect(right.tones[1]).toBeGreaterThan(RIGHT_AMPLITUDE * 0.8)
    expect(right.tones[1]).toBeLessThan(RIGHT_AMPLITUDE * 1.2)
    expect(right.tones[0]).toBeLessThan(right.tones[1] / 100)
    expect(live).toEqual([])
  })

  test("records a MIDI keyboard's lane beside a microphone lane, each take its own sound, the note kept with the keyboard's alone", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await addTwoLanes(page)
    await playLaneFromKeys(page, 'Lane 3')

    await armLane(page, 'Lane 2')
    await armLane(page, 'Lane 3')
    await expect(studio.locator('[data-studio-armed-lane]')).toHaveText([
      /^Armed on Lane 2 with Inputs 1 \+ 2 of .+, mixed\.$/,
      'Armed on Lane 3 with Fake Keys.',
    ])

    await recordTake(
      page,
      'Take 1',
      async () => {
        await playMidi(page, [0x90, 60, 100])
        await page.evaluate(() => new Promise((done) => setTimeout(done, 600)))
        await playMidi(page, [0x80, 60, 0])
        await page.evaluate(() => new Promise((done) => setTimeout(done, 300)))
      },
      2,
    )

    const project = await readStudioProject(page)
    const clips = clipsByLane(project)
    const voice = await storedTake(
      page,
      { assetId: clips.get('Lane 2')!.assetId },
      { hz: [LEFT_HZ, RIGHT_HZ, MIDDLE_C_HZ], over: 'middle' },
    )
    const keys = await storedTake(
      page,
      { assetId: clips.get('Lane 3')!.assetId },
      { hz: [LEFT_HZ, RIGHT_HZ, MIDDLE_C_HZ], over: 'onset' },
    )
    const microphones = await microphonesAsked(page)
    console.log(
      `[studio-several-lanes] midi ${JSON.stringify({
        voice: voice.tones,
        keys: keys.tones,
        notes: keys.notes,
        microphones,
      })}`,
    )

    // The microphone opened once, for Lane 2 alone.
    expect(microphones).toBe(1)
    // Lane 2 holds the capture, both sides at half, and no piano.
    expect(voice.tones[0]).toBeGreaterThan(LEFT_AMPLITUDE * 0.4)
    expect(voice.tones[1]).toBeGreaterThan(RIGHT_AMPLITUDE * 0.4)
    expect(voice.tones[2]).toBeLessThan(voice.tones[1] / 10)
    expect(voice.notes).toEqual([])
    // Lane 3 holds middle C and none of the capture, and keeps its note.
    expect(keys.tones[2]).toBeGreaterThan(4 * keys.tones[0])
    expect(keys.tones[0]).toBeLessThan(LEFT_AMPLITUDE / 100)
    expect(
      keys.notes.map((note) => [note.pitch, Math.round(note.velocity * 127)]),
    ).toEqual([[60, 100]])
    expect(live).toEqual([])
  })
})
