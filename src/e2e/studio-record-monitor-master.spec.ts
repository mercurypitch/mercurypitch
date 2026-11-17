// Studio monitoring through the master — the armed input is heard through the master as the song is: once Compare has measured the song's loudness, the voice heard against the song moves by as much as the song does, playing or stopped, and while Compare plays a side, the voice takes that side's gain, so on After it keeps its place against the song, and on Before it loses its lane's effects, as the song does.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { studioRegion } from './helpers/dedicatedstudio-fixture'
import { setMonitoring } from './helpers/studio-arming'
import { audioClock, captureOutput, captureStudioOutput, importWav, twoPartWav, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'
import { dismissOverlays, waitForNav } from './helpers/ui'

/** The microphone's tone: no harmonic of the song's, nor the song of its. */
const MIC_HZ = 370
/** The song: one lane of a steady sine, so its level is the same wherever a capture falls. */
const SONG_HZ = 290
const SONG_WAV = twoPartWav(6, 6, [SONG_HZ, SONG_HZ], 0.1)
/** Seconds a capture holds (32768 frames at 48 kHz), and a little more: a capture this long after a change holds none of what came before it. */
const CAPTURE_SECONDS = 0.8
/** The same quiet sine on both sides, about -28 dBFS: far under the ceiling at any gain Compare measures. */
const MIC_WAV = writeStereoToneWav(MIC_HZ, MIC_HZ, 4, [0.05, 0.05])
/** How close the voice's move is held to the song's, in dB. */
const WITHIN_DB = 0.5
/**
 * How close the voice's move on Compare's Before side is held to the
 * song's, in dB. Twelve runs read 0.22 to 0.24: the lane's effects take
 * 0.44 to 0.47 dB from the voice's tone and 0.68 dB from the song's. A
 * monitor that left the compressor out read 0.77.
 */
const BEFORE_DB = 0.35
/** How close the voice's place against the song on a side of Compare is held to playback's, in dB. */
const BALANCE_DB = 0.1

test.use({
  launchOptions: { args: fakeMicArgs(MIC_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 1000 },
})

/** The level of `hz` in `samples`, in dB of a full-scale sine, through a Hann window. */
function stretchDb(samples: Float32Array, rate: number, hz: number): number {
  let re = 0
  let im = 0
  let weight = 0
  for (let i = 0; i < samples.length; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (samples.length - 1))
    const phase = (2 * Math.PI * hz * i) / rate
    re += samples[i] * hann * Math.cos(phase)
    im -= samples[i] * hann * Math.sin(phase)
    weight += hann
  }
  return 20 * Math.log10((2 * Math.hypot(re, im)) / weight)
}

/** Stretches a capture is read in: 85 ms each, wide enough to tell the two tones apart. */
const STRETCHES = 8

/**
 * The level of `hz` in `samples`: the median over its stretches, so a short
 * dropout under load does not decide the reading. Beside nine other specs,
 * one run read the voice 0.7 dB low over a whole capture while the song
 * read exact.
 */
function toneDb(samples: Float32Array, rate: number, hz: number): number {
  const length = Math.floor(samples.length / STRETCHES)
  const levels = Array.from({ length: STRETCHES }, (_, index) =>
    stretchDb(samples.subarray(index * length, (index + 1) * length), rate, hz),
  ).sort((a, b) => a - b)
  return (levels[STRETCHES / 2 - 1] + levels[STRETCHES / 2]) / 2
}

/** Where the voice sits against the song, in dB. */
function balance({ voiceDb, songDb }: { voiceDb: number; songDb: number }) {
  return voiceDb - songDb
}

/** The voice and the song in the newest output, `settle` seconds of audio clock from now. */
async function heard(
  page: Page,
  settle: number,
): Promise<{ voiceDb: number; songDb: number }> {
  await untilAudioClock(page, (await audioClock(page)) + settle)
  const { samples, sampleRate } = await captureOutput(page)
  return {
    voiceDb: toneDb(samples, sampleRate, MIC_HZ),
    songDb: toneDb(samples, sampleRate, SONG_HZ),
  }
}

/** The voice and the song while the song plays, from its start. */
async function heardPlaying(
  page: Page,
): Promise<{ voiceDb: number; songDb: number }> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  const both = await heard(page, 2)
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Go to start', exact: true }).click()
  // The lane's reverb rings on after a pause.
  await untilAudioClock(page, (await audioClock(page)) + 2)
  return both
}

function compareRegion(page: Page): Locator {
  return studioRegion(page).getByRole('region', {
    name: 'Compare sound',
    exact: true,
  })
}

test("the armed input is heard through the master: it moves with the song's measured gain, and with each side of Compare", async ({
  page,
}) => {
  test.setTimeout(180_000)
  await captureStudioOutput(page)
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
  await importWav(page, 'Backing', SONG_WAV)
  const record = studio.locator('[data-studio-record]')
  await studio
    .getByRole('button', { name: 'Arm Backing for recording', exact: true })
    .click()
  await expect(record).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  const onAt = await setMonitoring(page, true)
  // Past the input's settling and the monitor's rise.
  await untilAudioClock(page, onAt + 0.5)

  // Before any measurement the master plays at 0 dB.
  const stopped = await heard(page, CAPTURE_SECONDS)
  const playing = await heardPlaying(page)

  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const compare = compareRegion(page)
  await compare
    .getByRole('button', { name: 'Prepare Compare', exact: true })
    .click()
  const before = compare.getByRole('button', { name: 'Before', exact: true })
  const after = compare.getByRole('button', { name: 'After', exact: true })
  await expect(before).toBeEnabled({ timeout: 90_000 })
  await expect(record).toHaveAttribute('data-phase', 'armed')

  // The song stopped, the voice already plays at the gain the next Play
  // starts at; then both play, the song through playback's master.
  const measured = await heard(page, CAPTURE_SECONDS)
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  const measuredPlaying = await heardPlaying(page)
  const songMoved = measuredPlaying.songDb - playing.songDb
  const voiceMovedPlaying = measuredPlaying.voiceDb - playing.voiceDb
  const voiceMovedStopped = measured.voiceDb - stopped.voiceDb

  // Compare's Before side plays the song with every effect off and no
  // master, and the voice heard beside it loses its lane's effects and the
  // master's too; its After side has them back, both at the side's match
  // gain.
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await before.click()
  await expect(before).toHaveAttribute('aria-pressed', 'true')
  const onBefore = await heard(page, CAPTURE_SECONDS)
  await after.click()
  await expect(after).toHaveAttribute('aria-pressed', 'true')
  // As far into the song as the playing captures, where the lane's reverb
  // on the song has built up as it had there.
  const onAfter = await heard(page, 2)
  await compare
    .getByRole('button', { name: 'Stop Compare', exact: true })
    .click()
  await expect(after).toHaveAttribute('aria-pressed', 'false')

  console.log(
    `[studio-record-monitor-master] ${JSON.stringify({
      stopped,
      playing,
      measured,
      measuredPlaying,
      songMoved,
      voiceMovedPlaying,
      voiceMovedStopped,
      onBefore,
      onAfter,
      voiceMovedBefore: onBefore.voiceDb - playing.voiceDb,
      songMovedBefore: onBefore.songDb - playing.songDb,
      balance: {
        playing: balance(playing),
        measuredPlaying: balance(measuredPlaying),
        onBefore: balance(onBefore),
        onAfter: balance(onAfter),
      },
    })}`,
  )
  // The song is quiet: Compare lifts it by several dB.
  expect(Math.abs(songMoved)).toBeGreaterThan(2)
  expect(Math.abs(voiceMovedPlaying - songMoved)).toBeLessThan(WITHIN_DB)
  expect(Math.abs(voiceMovedStopped - songMoved)).toBeLessThan(WITHIN_DB)
  // After plays the master at the measured gain and then turns the song
  // down to Before's loudness; the voice keeps its place against the song as
  // in playback.
  expect(Math.abs(balance(onAfter) - balance(measuredPlaying))).toBeLessThan(
    BALANCE_DB,
  )
  // Before plays the song with every effect off at its match gain, 0 dB for
  // this quiet song, and the voice loses its lane's effects too, the
  // compressor's makeup among them, so it moves from where it played as the
  // song does: the lane's effects took 0.45 dB from the voice and 0.68 dB
  // from the song. A monitor that left the compressor out took 1.45 dB from
  // the voice.
  expect(
    Math.abs(
      onBefore.voiceDb - playing.voiceDb - (onBefore.songDb - playing.songDb),
    ),
  ).toBeLessThan(BEFORE_DB)
  await expect(record).toHaveAttribute('data-phase', 'armed')
})
