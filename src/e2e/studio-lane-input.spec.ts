// Studio lane inputs — on a two-channel input, a lane set to Input 2 records its right-hand tone alone and a lane on all of it both, mixed half and half; the lane's header chip says which and opens the lane's input; a lane with an input of its own still fits its header on a computer and a tablet; and a take hears a chosen channel alone at any channel count, where Web Audio's speaker rules fold all of them.
import { expect, type Page, test } from '@playwright/test'
import { splitChannels } from '../lib/audio-input/input-channels'
import { STUDIO_CAPTURE_INPUT } from '../lib/studio/record/capture-input'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton } from './helpers/studio-arming'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'

const LEFT_HZ = 440
const RIGHT_HZ = 660
/** A guitar on input 1 and something else on input 2, as Chromium hands them over: two channels. */
const STEREO_WAV = writeStereoToneWav(LEFT_HZ, RIGHT_HZ, 10)
/** Each side's tone in the file: half of the 26000 of 32768 the helper writes. */
const SIDE_AMPLITUDE = (0.5 * 26000) / 32768

test.use({
  launchOptions: { args: fakeMicArgs(STEREO_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Choose `option` in the lane's Track details, then close them. */
async function setLaneInput(
  page: Page,
  lane: string,
  field: 'Input' | 'Channel',
  option: string,
): Promise<void> {
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: `${lane} details`, exact: true })
    .click()
  await studio
    .getByRole('combobox', { name: field, exact: true })
    .selectOption({ label: option })
  await studio
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()
}

/** Record about two seconds on the armed lane with R; resolves once the take is kept as `title`. */
async function recordTake(page: Page, title: string): Promise<void> {
  const studio = studioRegion(page)
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
    timeout: 10_000,
  })
  await expect(studio.getByRole('timer')).toHaveText(/^0:0[2-9]/, {
    timeout: 10_000,
  })
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

interface Tones {
  readonly left: number
  readonly right: number
}

/** A kept take's tones, read once its copy is in the database. */
async function storedTones(page: Page, title: string): Promise<Tones> {
  let tones: Tones | null = null
  await expect(async () => {
    tones = await takeTones(page, title)
  }).toPass({ timeout: 30_000 })
  return tones!
}

/**
 * How strong each side's tone is in a kept take: the amplitude of the left
 * and the right tone over the middle second of its stored copy (a Goertzel
 * filter at each frequency).
 */
async function takeTones(page: Page, title: string): Promise<Tones> {
  return page.evaluate(
    async ({ title, leftHz, rightHz }) => {
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
            originalName?: string
            canonicalPcmId: string
            canonicalPcmFormat?: 'int16'
            normalizedFrameCount: number
          }
        }>('studioAssets')
        const take = assets
          .map((row) => row.asset)
          .find((asset) => asset.originalName?.startsWith(title))
        if (take === undefined) throw new Error(`No take named ${title}.`)
        const blobs = await all<{ id: string; data: ArrayBuffer }>(
          'studioAssetBlobs',
        )
        const data = blobs.find((row) => row.id === take.canonicalPcmId)!.data
        const frames = take.normalizedFrameCount
        // Planar after a 32-byte header: a recorded take's one channel.
        const samples =
          take.canonicalPcmFormat === 'int16'
            ? Float32Array.from(
                new Int16Array(data, 32, frames),
                (value) => value / 32768,
              )
            : new Float32Array(data, 32, frames)
        const from = Math.max(0, Math.floor(frames / 2) - 24_000)
        const middle = samples.subarray(from, Math.min(frames, from + 48_000))
        const amplitude = (hz: number) => {
          const w = (2 * Math.PI * hz) / 48_000
          const k = 2 * Math.cos(w)
          let s1 = 0
          let s2 = 0
          for (const x of middle) {
            const s0 = x + k * s1 - s2
            s2 = s1
            s1 = s0
          }
          const re = s1 - s2 * Math.cos(w)
          const im = s2 * Math.sin(w)
          return (2 * Math.sqrt(re * re + im * im)) / middle.length
        }
        return { left: amplitude(leftHz), right: amplitude(rightHz) }
      } finally {
        database.close()
      }
    },
    { title, leftHz: LEFT_HZ, rightHz: RIGHT_HZ },
  )
}

test.describe('Studio lane inputs', () => {
  test('a lane set to Input 2 records its right-hand tone alone, and on all of its input both, mixed', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()

    // The first arm opens the input and learns its channels.
    await armLane(page, 'Lane 2')
    const settings = await page.evaluate(() =>
      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: false } })
        .then((stream) => {
          const reported = stream.getAudioTracks()[0]?.getSettings()
          for (const track of stream.getTracks()) track.stop()
          return reported
        }),
    )
    console.log(`[studio-lane-input] fake capture ${JSON.stringify(settings)}`)
    expect(settings?.channelCount).toBe(2)

    await studio
      .getByRole('button', { name: 'Lane 2 details', exact: true })
      .click()
    const channel = studio.getByRole('combobox', {
      name: 'Channel',
      exact: true,
    })
    await expect(channel.locator('option')).toHaveText([
      'All inputs, mixed',
      'Input 1',
      'Input 2',
    ])
    await channel.selectOption({ label: 'Input 2' })
    await studio
      .getByRole('button', { name: 'Close Track details', exact: true })
      .click()
    // The armed lane opens its channel at once, and its header says so.
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const chip = studio.getByRole('button', {
      name: "Lane 2 records from the Studio's input (Default input), Input 2",
      exact: true,
    })
    await expect(chip).toHaveText('In 2')

    await recordTake(page, 'Take 1')
    const alone = await storedTones(page, 'Take 1')

    // The chip opens the lane's input; back to all of it.
    await chip.click()
    await expect(
      studio.getByRole('combobox', { name: 'Input', exact: true }),
    ).toBeFocused()
    await channel.selectOption({ label: 'All inputs, mixed' })
    await studio
      .getByRole('button', { name: 'Close Track details', exact: true })
      .click()
    await expect(chip).toHaveCount(0)
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await recordTake(page, 'Take 2')
    const mixed = await storedTones(page, 'Take 2')

    console.log(`[studio-lane-input] ${JSON.stringify({ alone, mixed })}`)
    // Input 2 alone: the right-hand tone whole, the left more than 40 dB down.
    expect(alone.right).toBeGreaterThan(SIDE_AMPLITUDE * 0.8)
    expect(alone.right).toBeLessThan(SIDE_AMPLITUDE * 1.2)
    expect(alone.left).toBeLessThan(alone.right / 100)
    // Both, folded by the speaker rules: each side at half its level.
    for (const side of [mixed.left, mixed.right]) {
      expect(side).toBeGreaterThan(SIDE_AMPLITUDE * 0.4)
      expect(side).toBeLessThan(SIDE_AMPLITUDE * 0.6)
    }
  })

  test("the take hears a chosen channel alone at any channel count, and all of them as Web Audio's speaker rules fold them", async ({
    page,
  }) => {
    await page.goto('about:blank')
    // The Studio's own split and its recorder's input settings, not copies.
    await page.evaluate(`window.__splitChannels = ${splitChannels.toString()}`)
    const heard = await page.evaluate(async (capture) => {
      const split = (window as unknown as { __splitChannels: unknown })
        .__splitChannels as (
        context: BaseAudioContext,
        source: AudioNode,
        count: number,
      ) => { open(): void; alone(channel: number): AudioNode }
      /** Channel k carries a steady 2^-(k+1), so a sum says who is in it. */
      const level = (k: number) => 2 ** -(k + 1)
      async function render(count: number, channel: number | null) {
        const context = new OfflineAudioContext({
          numberOfChannels: 1,
          length: 256,
          sampleRate: 48_000,
        })
        const merger = context.createChannelMerger(count)
        for (let k = 0; k < count; k++) {
          const steady = context.createConstantSource()
          steady.offset.value = level(k)
          steady.connect(merger, 0, k)
          steady.start()
        }
        const recorder = context.createGain()
        Object.assign(recorder, capture)
        recorder.connect(context.destination)
        if (channel === null) merger.connect(recorder)
        else {
          const taken = split(context, merger, count)
          taken.open()
          taken.alone(channel).connect(recorder)
        }
        return (await context.startRendering()).getChannelData(0)[128]
      }
      const counts = [2, 3, 4, 5, 6, 8]
      const result: Record<string, { alone: number[]; all: number }> = {}
      for (const count of counts) {
        const alone: number[] = []
        for (let k = 0; k < count; k++) alone.push(await render(count, k))
        result[count] = { alone, all: await render(count, null) }
      }
      return result
    }, STUDIO_CAPTURE_INPUT)

    console.log(`[studio-lane-input] fold ${JSON.stringify(heard)}`)
    const level = (k: number) => 2 ** -(k + 1)
    for (const [count, { alone }] of Object.entries(heard))
      alone.forEach((value, k) =>
        expect(value, `channel ${k} of ${count}`).toBeCloseTo(level(k), 6),
      )
    // All inputs: stereo halves each side, quad quarters each, 5.1 weighs
    // its sides and centre and leaves out its LFE; any other count keeps
    // its first channel alone.
    expect(heard[2].all).toBeCloseTo((0.5 + 0.25) / 2, 6)
    expect(heard[4].all).toBeCloseTo((0.5 + 0.25 + 0.125 + 0.0625) / 4, 6)
    expect(heard[6].all).toBeCloseTo(
      Math.SQRT1_2 * (0.5 + 0.25) + 0.125 + 0.5 * (0.03125 + 0.015625),
      5,
    )
    for (const count of [3, 5, 8]) expect(heard[count].all).toBe(0.5)
  })
})

// The compact headers `studio-track-headers.spec.ts` measures, less the lane
// row's 1 px rule: 64 and 96 px rows.
const CHIP_LAYOUTS = [
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    touch: false,
    header: { width: 240, height: 63 },
  },
  {
    name: 'tablet',
    viewport: { width: 1024, height: 768 },
    touch: true,
    header: { width: 224, height: 95 },
  },
] as const

for (const layout of CHIP_LAYOUTS)
  test.describe(`Studio lane input chip on ${layout.name}`, () => {
    test.use({
      viewport: layout.viewport,
      hasTouch: layout.touch,
      isMobile: layout.touch,
    })

    test('a lane with an input of its own still fits its header, its name whole and, on touch, every target 44 px', async ({
      page,
    }) => {
      await openArrangement(page)
      const studio = studioRegion(page)
      await studio
        .getByRole('button', { name: 'New lane', exact: true })
        .click()
      await setLaneInput(page, 'Lane 2', 'Input', 'Fake Audio Input 1')

      await expect(
        studio.getByRole('button', {
          name: 'Lane 2 records from Fake Audio Input 1',
          exact: true,
        }),
      ).toHaveText('Fake')
      const reading = await studio
        .locator('[data-studio-track]', {
          has: page.getByRole('button', {
            name: 'Lane 2 details',
            exact: true,
          }),
        })
        .evaluate((lane, touch) => {
          const header = lane.firstElementChild as HTMLElement
          const box = header.getBoundingClientRect()
          const name = header.querySelector<HTMLElement>(
            '[data-studio-track-name]',
          )!
          const outside = [...header.querySelectorAll<HTMLElement>('*')]
            .filter((element) => {
              const at = element.getBoundingClientRect()
              return (
                at.width > 0 &&
                (at.left < box.left - 0.5 ||
                  at.right > box.right + 0.5 ||
                  at.top < box.top - 0.5 ||
                  at.bottom > box.bottom + 0.5)
              )
            })
            .map(
              (element) =>
                element.getAttribute('aria-label') ?? element.tagName,
            )
          const small = touch
            ? [...header.querySelectorAll<HTMLElement>('button')]
                .filter((button) => {
                  const at = button.getBoundingClientRect()
                  return at.width < 44 || at.height < 44
                })
                .map((button) => button.getAttribute('aria-label') ?? '')
            : []
          return {
            outside,
            small,
            clipped: name.scrollWidth > name.clientWidth + 1,
            size: [Math.round(box.width), Math.round(box.height)],
          }
        }, layout.touch)
      expect(reading.outside).toEqual([])
      expect(reading.small).toEqual([])
      expect(reading.clipped, 'the lane name runs out').toBe(false)
      expect(reading.size[0]).toBe(layout.header.width)
      expect(reading.size[1]).toBeGreaterThanOrEqual(layout.header.height)
    })
  })
