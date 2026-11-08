// Studio lane inputs — on a two-channel input, a lane set to Input 2 records its right-hand tone alone, and on Inputs 1 + 2 or by default both at half each, as the armed card says; the lane's header chip says which and opens the lane's input; a lane with an input of its own still fits its header on a computer and a tablet; and at one to eight channels a take hears one input alone or an aligned pair at half each, and by default both sides of a stereo input and input 1 of any other.
import { expect, type Page, test } from '@playwright/test'
import { defaultChannelPick, splitChannels, } from '../lib/audio-input/input-channels'
import { STUDIO_CAPTURE_INPUT } from '../lib/studio/record/capture-input'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton, recordTake, setLaneInput, } from './helpers/studio-arming'
import { storedTake } from './helpers/studio-takes'
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

interface Tones {
  readonly left: number
  readonly right: number
}

/** How strong each side's tone is over the middle second of a kept take, read once its copy is in the database. */
async function storedTones(page: Page, title: string): Promise<Tones> {
  const take = await storedTake(
    page,
    { title },
    { hz: [LEFT_HZ, RIGHT_HZ], over: 'middle' },
  )
  return { left: take.tones[0], right: take.tones[1] }
}

test.describe('Studio lane inputs', () => {
  test('a lane on Input 2 records its right-hand tone alone, and on Inputs 1 + 2 or by default both at half, as its card says', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()

    // The first arm opens the input and learns its channels.
    await armLane(page, 'Lane 2')
    const opened = await page.evaluate(() =>
      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: false } })
        .then((stream) => {
          const track = stream.getAudioTracks()[0]
          const reported = { label: track?.label, ...track?.getSettings() }
          for (const each of stream.getTracks()) each.stop()
          return reported
        }),
    )
    console.log(`[studio-lane-input] fake capture ${JSON.stringify(opened)}`)
    expect(opened.channelCount).toBe(2)
    // With no choice, a stereo input records both sides, and the card says so.
    await expect(
      studio.getByText(
        /^Armed on Lane 2 with Inputs 1 \+ 2 of .+, mixed\. Press Record to start\.$/,
      ),
    ).toBeVisible()

    await studio
      .getByRole('button', { name: 'Lane 2 details', exact: true })
      .click()
    const channel = studio.getByRole('combobox', {
      name: 'Channel',
      exact: true,
    })
    await expect(channel.locator('option')).toHaveText([
      'Default: Inputs 1 + 2',
      'Input 1',
      'Input 2',
      'Inputs 1 + 2',
    ])
    await channel.selectOption({ label: 'Input 2' })
    await studio
      .getByRole('button', { name: 'Close Track details', exact: true })
      .click()
    // The armed lane opens its input at once, and its header and card say so.
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const chip = (picked: string) =>
      studio.getByRole('button', {
        name: `Lane 2 records from the Studio's input (Default input), ${picked}`,
        exact: true,
      })
    await expect(chip('Input 2')).toHaveText('In 2')
    await expect(
      studio.getByText(
        /^Armed on Lane 2 with Input 2 of .+\. Press Record to start\.$/,
      ),
    ).toBeVisible()
    await recordTake(page, 'Take 1')
    const alone = await storedTones(page, 'Take 1')

    // The chip opens the lane's input; the pair next.
    await chip('Input 2').click()
    await expect(
      studio.getByRole('combobox', { name: 'Input', exact: true }),
    ).toBeFocused()
    await channel.selectOption({ label: 'Inputs 1 + 2' })
    await studio
      .getByRole('button', { name: 'Close Track details', exact: true })
      .click()
    await expect(chip('Inputs 1 + 2')).toHaveText('In 1+2')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await recordTake(page, 'Take 2')
    const pair = await storedTones(page, 'Take 2')

    // Back to the default, which on a stereo input is the same pair.
    await setLaneInput(page, 'Lane 2', 'Channel', 'Default: Inputs 1 + 2')
    await expect(chip('Inputs 1 + 2')).toHaveCount(0)
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await recordTake(page, 'Take 3')
    const byDefault = await storedTones(page, 'Take 3')

    console.log(
      `[studio-lane-input] ${JSON.stringify({ alone, pair, byDefault })}`,
    )
    // Input 2 alone: the right-hand tone whole, the left more than 40 dB down.
    expect(alone.right).toBeGreaterThan(SIDE_AMPLITUDE * 0.8)
    expect(alone.right).toBeLessThan(SIDE_AMPLITUDE * 1.2)
    expect(alone.left).toBeLessThan(alone.right / 100)
    // Inputs 1 + 2, chosen or by default: each side at half its level.
    for (const side of [
      pair.left,
      pair.right,
      byDefault.left,
      byDefault.right,
    ]) {
      expect(side).toBeGreaterThan(SIDE_AMPLITUDE * 0.4)
      expect(side).toBeLessThan(SIDE_AMPLITUDE * 0.6)
    }
  })

  test('a take hears one input alone or an aligned pair at half each, and by default both sides of a stereo input and input 1 of any other, at 1 to 8 channels', async ({
    page,
  }) => {
    await page.goto('about:blank')
    // The Studio's own split, default and recorder input, not copies.
    await page.evaluate(
      `window.__splitChannels = ${splitChannels.toString()}; window.__defaultChannelPick = ${defaultChannelPick.toString()}`,
    )
    const heard = await page.evaluate(async (capture) => {
      interface Pick {
        channel: number
        pair: boolean
      }
      const studio = window as unknown as {
        __splitChannels(
          context: BaseAudioContext,
          source: AudioNode,
          count: number,
        ): { open(): void; take(pick: Pick): AudioNode }
        __defaultChannelPick(count: number): Pick
      }
      /** Channel k carries a steady 2^-(k+1), so a sum says who is in it. */
      const level = (k: number) => 2 ** -(k + 1)
      /** What the recorder hears of `count` channels: `pick`, or the input as it is for null. */
      async function render(count: number, pick: Pick | null) {
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
        if (pick === null) merger.connect(recorder)
        else {
          const split = studio.__splitChannels(context, merger, count)
          split.open()
          split.take(pick).connect(recorder)
        }
        return (await context.startRendering()).getChannelData(0)[128]
      }
      const result: Record<
        string,
        { single: number[]; pairs: number[]; byDefault: number }
      > = {}
      for (let count = 1; count <= 8; count++) {
        const single: number[] = []
        for (let k = 0; k < count; k++)
          single.push(await render(count, { channel: k, pair: false }))
        const pairs: number[] = []
        for (let k = 0; k + 1 < count; k += 2)
          pairs.push(await render(count, { channel: k, pair: true }))
        // One channel goes as it is; any other takes the default pick.
        const byDefault = await render(
          count,
          count === 1 ? null : studio.__defaultChannelPick(count),
        )
        result[count] = { single, pairs, byDefault }
      }
      return result
    }, STUDIO_CAPTURE_INPUT)

    console.log(`[studio-lane-input] routing ${JSON.stringify(heard)}`)
    const level = (k: number) => 2 ** -(k + 1)
    expect(Object.keys(heard)).toHaveLength(8)
    for (const [count, { single, pairs, byDefault }] of Object.entries(heard)) {
      single.forEach((value, k) =>
        expect(value, `input ${k + 1} of ${count}`).toBeCloseTo(level(k), 6),
      )
      pairs.forEach((value, at) =>
        expect(
          value,
          `inputs ${2 * at + 1} + ${2 * at + 2} of ${count}`,
        ).toBeCloseTo((level(2 * at) + level(2 * at + 1)) / 2, 6),
      )
      expect(pairs).toHaveLength(Math.floor(Number(count) / 2))
      // Both sides of a stereo input at half each; input 1 of any other.
      expect(byDefault, `the default of ${count}`).toBeCloseTo(
        count === '2' ? (level(0) + level(1)) / 2 : level(0),
        6,
      )
    }
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
