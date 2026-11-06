// Studio monitoring — with monitoring on, the armed input is heard through its lane's effects (its reverb rings on between the microphone's bursts), once even while the arm moves to another lane, and not at all once monitoring is off; a take recorded meanwhile is the input, bit for bit, as a tap beside the take's own capture hears it.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, importWav, noiseWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeNoiseBurstWav } from './helpers/tone-wav'

const RATE = 48_000
const BURST_SECONDS = 0.3
const GAP_SECONDS = 0.2
/** Four bursts, 2 s, which Chromium loops. */
const MIC_WAV = writeNoiseBurstWav(BURST_SECONDS, GAP_SECONDS, 4, 7)
/** The microphone's pattern repeats every burst and gap. */
const PERIOD = Math.round((BURST_SECONDS + GAP_SECONDS) * RATE)
/** 10 ms. */
const WINDOW = 480

test.use({
  launchOptions: { args: fakeMicArgs(MIC_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

function armButton(page: Page, lane: string): Locator {
  return studioRegion(page).getByRole('button', {
    name: `Arm ${lane} for recording`,
    exact: true,
  })
}

async function arm(page: Page, lane: string): Promise<void> {
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
  await armButton(page, lane).click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
}

/** Turn monitoring on or off in Sound; resolves with the audio clock at the change. */
async function setMonitoring(page: Page, on: boolean): Promise<number> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await clearClicks(page)
  await studio
    .getByRole('checkbox', { name: 'Monitor through headphones' })
    .setChecked(on)
  const [change] = (await readClicks(page)).filter(
    ({ kind }) => kind === 'change',
  )
  if (on)
    await expect(studio.locator('[data-studio-monitor-help]')).toContainText(
      "through the lane's effects",
    )
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  return change.contextTime
}

/** The RMS of each 10 ms of `samples`. */
function windowLevels(samples: Float32Array): number[] {
  const levels: number[] = []
  for (let from = 0; from + WINDOW <= samples.length; from += WINDOW) {
    let sum = 0
    for (let i = from; i < from + WINDOW; i++) sum += samples[i] ** 2
    levels.push(Math.sqrt(sum / WINDOW))
  }
  return levels
}

/** Mean square of the newest whole period: much the same wherever in the pattern it starts. */
function periodPower(samples: Float32Array): number {
  let sum = 0
  for (let i = samples.length - PERIOD; i < samples.length; i++)
    sum += samples[i] ** 2
  return sum / PERIOD
}

const powerDb = (ratio: number) => 10 * Math.log10(ratio)

/** Record `seconds` after the count-in on the armed lane, then wait for the take to be kept. */
async function recordTake(
  page: Page,
  title: string,
  seconds: number,
): Promise<void> {
  const studio = studioRegion(page)
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
    timeout: 10_000,
  })
  await untilAudioClock(page, (await audioClock(page)) + seconds)
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Record', {
    timeout: 30_000,
  })
  await expect(
    studio.getByRole('button', { name: new RegExp(`, ${title}\\.wav, `) }),
  ).toHaveCount(1)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

/** The 16-bit samples of a WAV's data chunk. */
function wavSamples(bytes: Buffer): Int16Array {
  let at = 12
  while (at + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(at + 4)
    if (bytes.toString('ascii', at, at + 4) === 'data') {
      const data = bytes.subarray(at + 8, at + 8 + size)
      return new Int16Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      )
    }
    at += 8 + size + (size % 2)
  }
  throw new Error('No data chunk in the WAV.')
}

/** The original WAV a recorded take was kept as, from the browser's storage. */
async function takeSamples(page: Page, title: string): Promise<Int16Array> {
  const base64 = await page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const all = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = database
          .transaction(store, 'readonly')
          .objectStore(store)
          .getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error)
      })
    try {
      const assets = await all<{
        asset: {
          id: string
          originalName?: string
          provenance: { kind: string }
        }
      }>('studioAssets')
      const take = assets.find(
        ({ asset }) =>
          asset.provenance.kind === 'recording' &&
          asset.originalName?.startsWith(name) === true,
      )
      if (!take) throw new Error(`No take named ${name}.`)
      const blobs = await all<{ id: string; data: Blob | ArrayBuffer }>(
        'studioAssetBlobs',
      )
      const original = blobs.find(
        (row) => row.id === `${take.asset.id}-original`,
      )
      if (!original) throw new Error(`No original WAV for ${name}.`)
      const data =
        original.data instanceof Blob
          ? await original.data.arrayBuffer()
          : original.data
      const bytes = new Uint8Array(data)
      let text = ''
      for (let i = 0; i < bytes.length; i += 0x8000)
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(text)
    } finally {
      database.close()
    }
  }, title)
  return wavSamples(Buffer.from(base64, 'base64'))
}

declare global {
  interface Window {
    __micTap?: { frame: number; samples: Float32Array }[]
  }
}

/**
 * Record, beside the take's own capture, every frame of each microphone
 * source the page makes, folded to mono as the capture folds it
 * (capture-node.ts).
 */
async function tapMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const processor = `
      class E2eMicTap extends AudioWorkletProcessor {
        process(inputs) {
          const channel = inputs[0][0]
          if (channel)
            this.port.postMessage({ frame: currentFrame, samples: channel.slice() })
          return true
        }
      }
      registerProcessor('e2e-mic-tap', E2eMicTap)`
    const url = URL.createObjectURL(
      new Blob([processor], { type: 'application/javascript' }),
    )
    const chunks: { frame: number; samples: Float32Array }[] = []
    window.__micTap = chunks
    const create = AudioContext.prototype.createMediaStreamSource
    AudioContext.prototype.createMediaStreamSource = function (
      this: AudioContext,
      stream: MediaStream,
    ) {
      const source = create.call(this, stream)
      void this.audioWorklet.addModule(url).then(() => {
        const tap = new AudioWorkletNode(this, 'e2e-mic-tap', {
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        })
        const silent = this.createGain()
        silent.gain.value = 0
        tap.port.onmessage = (event) => chunks.push(event.data)
        source.connect(tap)
        tap.connect(silent).connect(this.destination)
      })
      return source
    }
  })
}

/** What the tap heard, as a take keeps samples (take-audio.ts `floatToPcm16`). */
async function tappedSamples(page: Page): Promise<Int16Array> {
  const base64 = await page.evaluate(() => {
    const chunks = window.__micTap ?? []
    if (chunks.length === 0)
      throw new Error('The microphone tap heard nothing.')
    const first = chunks[0].frame
    const last = chunks[chunks.length - 1]
    const out = new Int16Array(last.frame + last.samples.length - first)
    for (const { frame, samples } of chunks)
      samples.forEach((sample, i) => {
        const value = Math.max(-1, Math.min(1, sample))
        out[frame - first + i] =
          value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff)
      })
    const bytes = new Uint8Array(out.buffer)
    let text = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(text)
  })
  const bytes = Buffer.from(base64, 'base64')
  return new Int16Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  )
}

/**
 * Where `take` sits in `heard`: the shift that puts 64 of its samples, from
 * its loudest moment in its second second, exactly on the tap's, or null.
 */
function shiftBetween(heard: Int16Array, take: Int16Array): number | null {
  let at = RATE
  for (let i = RATE; i < 2 * RATE; i++)
    if (Math.abs(take[i]) > Math.abs(take[at])) at = i
  const needle = 64
  for (let i = 0; i + needle <= heard.length; i++) {
    let k = 0
    while (k < needle && heard[i + k] === take[at + k]) k++
    if (k === needle) return i - at
  }
  return null
}

/** How many of the take's samples the tap holds under `shift`, and how many of those differ. */
function differing(heard: Int16Array, take: Int16Array, shift: number) {
  let compared = 0
  let differ = 0
  for (let j = 0; j < take.length; j++) {
    const i = j + shift
    if (i < 0 || i >= heard.length) continue
    compared++
    if (heard[i] !== take[j]) differ++
  }
  return { compared, differ }
}

test.describe('Studio monitoring', () => {
  test("the armed input is heard only with monitoring on, through its lane's effects, and once while the arm moves", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    // A second lane of the same role: the same effects and faders as Phrase.
    await importWav(page, 'Second', noiseWav(2, 0.1, 5))
    await arm(page, 'Phrase')

    const onAt = await setMonitoring(page, true)
    await untilAudioClock(page, onAt + 1)
    const heard = (await captureOutput(page)).samples
    const levels = windowLevels(heard)
    // The bursts are heard; between them the microphone is silent, and a dry
    // monitor would be too, but the lane's reverb rings on.
    expect(Math.max(...levels)).toBeGreaterThan(0.01)
    expect(Math.min(...levels)).toBeGreaterThan(1e-4)

    // Moving the arm crosses to the other lane's effects: the input heard
    // twice over would be 6 dB up across the crossing.
    await clearClicks(page)
    await armButton(page, 'Second').click()
    await expect(armButton(page, 'Second')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const [moved] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'down',
    )
    await untilAudioClock(page, moved.contextTime + 0.25)
    const crossing = (await captureOutput(page)).samples
    await untilAudioClock(page, moved.contextTime + 1.5)
    const settled = (await captureOutput(page)).samples
    const before = periodPower(heard)
    console.log(
      `[studio-record-monitor] ${JSON.stringify({
        quietestDb: 20 * Math.log10(Math.min(...levels)),
        crossingDb: powerDb(periodPower(crossing) / before),
        settledDb: powerDb(periodPower(settled) / before),
      })}`,
    )
    expect(powerDb(periodPower(crossing) / before)).toBeLessThan(1)
    expect(Math.abs(powerDb(periodPower(settled) / before))).toBeLessThan(1)

    // Off, the monitor comes out of the graph and nothing is heard.
    const offAt = await setMonitoring(page, false)
    await untilAudioClock(page, offAt + 1.1)
    const off = (await captureOutput(page)).samples
    expect(Math.max(...off.map(Math.abs))).toBeLessThan(1e-5)
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed')
  })

  test("a take recorded while monitoring through the lane's effects is the input, bit for bit", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await tapMicrophone(page)
    await captureStudioOutput(page)
    await openArrangement(page)
    await arm(page, 'Phrase')
    await setMonitoring(page, true)
    await recordTake(page, 'Take 1', 3)

    const take = await takeSamples(page, 'Take 1')
    const heard = await tappedSamples(page)
    const shift = shiftBetween(heard, take)
    const shared = shift === null ? null : differing(heard, take, shift)
    console.log(
      `[studio-record-monitor] ${JSON.stringify({ take: take.length, heard: heard.length, shift, shared })}`,
    )
    expect(shift).not.toBeNull()
    expect(shared).toEqual({ compared: take.length, differ: 0 })
  })
})
