// Studio mixing desk, live — with a real mouse: a fader drags from where it is and ignores a click on its rail, a held fader and dial are heard before they save, and sound edits keep the song playing.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { center, openArrangement, readStudioProject, STUDIO_RATE, studioRegion, } from './helpers/dedicatedstudio-fixture'

declare global {
  interface Window {
    __studioTaps?: AnalyserNode[]
    __studioSources?: number
    __studioTrace?: {
      start: number
      /** [ms since the start, mean power] every 10 ms. */
      trace: [number, number][]
      sources: number
      actionAt?: number
      done: boolean
    }
  }
}

/** Steady tones: any change in the output level comes from the mix. */
function steadyWav(
  seconds: number,
  hz: readonly number[],
  peak: number,
): Buffer {
  const frames = Math.round(STUDIO_RATE * seconds)
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(STUDIO_RATE, 24)
  bytes.writeUInt32LE(STUDIO_RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++) {
    let sample = 0
    for (const tone of hz)
      sample += Math.sin((2 * Math.PI * tone * frame) / STUDIO_RATE)
    bytes.writeInt16LE(
      Math.round((sample / hz.length) * peak * 32_767),
      44 + frame * 2,
    )
  }
  return bytes
}

/** Everything the page sends to a speaker, summed into one analyser; and every buffer source it starts. */
async function tapOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect as (
      this: AudioNode,
      ...args: unknown[]
    ) => unknown
    AudioNode.prototype.connect = function (
      this: AudioNode,
      ...args: unknown[]
    ) {
      const result = connect.apply(this, args)
      const target = args[0]
      if (target instanceof AudioDestinationNode) {
        const context = target.context as BaseAudioContext & {
          __studioTap?: AnalyserNode
        }
        if (!context.__studioTap) {
          context.__studioTap = context.createAnalyser()
          context.__studioTap.fftSize = 512
          window.__studioTaps = [
            ...(window.__studioTaps ?? []),
            context.__studioTap,
          ]
        }
        connect.call(this, context.__studioTap)
      }
      return result
    } as typeof AudioNode.prototype.connect
    const create = BaseAudioContext.prototype.createBufferSource
    BaseAudioContext.prototype.createBufferSource = function (
      this: BaseAudioContext,
    ) {
      window.__studioSources = (window.__studioSources ?? 0) + 1
      return create.call(this)
    }
  })
}

interface LevelTrace {
  /** Median level before the action, in dBFS. */
  before: number
  /** Median level once it has settled, in dBFS. */
  after: number
  /** How far a 30 ms average fell below the quieter of the two, in dB. */
  dip: number
  /** Buffer sources started meanwhile: a restart starts a whole new set. */
  sources: number
}

/** The output level every 10 ms: 150 ms before `action`, and 1.35 s after it. */
async function traceLevel(
  page: Page,
  action: () => Promise<unknown>,
): Promise<LevelTrace> {
  await page.evaluate(() => {
    const samples = new Float32Array(512)
    const run: NonNullable<Window['__studioTrace']> = {
      start: performance.now(),
      trace: [],
      sources: window.__studioSources ?? 0,
      done: false,
    }
    window.__studioTrace = run
    const timer = setInterval(() => {
      let sum = 0
      let count = 0
      for (const tap of window.__studioTaps ?? []) {
        if (tap.context.state !== 'running') continue
        tap.getFloatTimeDomainData(samples)
        for (const value of samples) sum += value * value
        count += samples.length
      }
      const now = performance.now() - run.start
      run.trace.push([now, count ? sum / count : 0])
      if (run.actionAt === undefined || now < run.actionAt + 1350) return
      clearInterval(timer)
      run.done = true
    }, 10)
  })
  await page.waitForFunction(
    () => (window.__studioTrace?.trace.at(-1)?.[0] ?? 0) >= 150,
  )
  await page.evaluate(() => {
    const run = window.__studioTrace!
    run.actionAt = performance.now() - run.start
  })
  await action()
  await page.waitForFunction(() => window.__studioTrace?.done === true)
  const { trace, actionAt, sources } = await page.evaluate(() => {
    const run = window.__studioTrace!
    return {
      trace: run.trace,
      actionAt: run.actionAt!,
      sources: (window.__studioSources ?? 0) - run.sources,
    }
  })
  const db = (power: number) => (power > 0 ? 10 * Math.log10(power) : -120)
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
  const powers = (from: number, to: number) =>
    trace.filter(([t]) => t >= from && t < to).map(([, power]) => power)
  const before = db(median(powers(0, actionAt)))
  const after = db(median(powers(actionAt + 750, Infinity)))
  const during = powers(actionAt, actionAt + 750)
  let floor = Infinity
  for (let i = 2; i < during.length; i++)
    floor = Math.min(floor, (during[i] + during[i - 1] + during[i - 2]) / 3)
  return {
    before,
    after,
    dip: Math.min(before, after) - db(floor),
    sources,
  }
}

/** Wait out an element's own CSS animations and transitions. */
async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

async function outputLevel(page: Page): Promise<number> {
  return (await traceLevel(page, async () => undefined)).after
}

async function importSteady(
  page: Page,
  name: string,
  hz: number[],
  peak = 0.3,
) {
  const studio = studioRegion(page)
  await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
    name: `${name}.wav`,
    mimeType: 'audio/wav',
    buffer: steadyWav(40, hz, peak),
  })
  await expect(
    studio.getByRole('button', { name: `${name} details`, exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
}

async function openDesk(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Mix', exact: true })
    .click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  // The desk slides up; its controls' boxes are final once it lands.
  await settled(desk)
  return desk
}

/** The lane header's control, not the desk strip's. */
function headerSlider(page: Page, name: string): Locator {
  return studioRegion(page)
    .locator('[data-studio-track]')
    .getByRole('slider', { name, exact: true })
}

const gainOf = async (page: Page, name: string) =>
  (await readStudioProject(page)).tracks.find((track) => track.name === name)!
    .gainDb

test.describe('Studio mixing desk, live', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a fader ignores a click on its rail, drags from where it was, shows the same value in the lane header, and a double-click puts it back to 0 dB @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    const desk = await openDesk(page)
    const fader = desk.getByRole('slider', {
      name: 'Phrase volume',
      exact: true,
    })
    const rail = await fader.boundingBox()
    if (!rail) throw new Error('The Phrase fader is not visible.')
    expect(await fader.getAttribute('max')).toBe('12')
    const x = rail.x + rail.width / 2
    // The cap sits at 0 dB, a sixth of the way down; click well below it.
    const start = await readStudioProject(page)
    await page.mouse.click(x, rail.y + rail.height * 0.85)
    // The drag below must be the only edit: the revision checks after it
    // prove this click saved nothing.
    await expect(fader).toHaveAttribute('aria-valuetext', '0.0 dB')

    // A drag that starts on the rail moves the value by the distance only.
    await page.mouse.move(x, rail.y + rail.height * 0.85)
    await page.mouse.down()
    await page.mouse.move(x, rail.y + rail.height * 0.85 + 30, { steps: 6 })
    const moving = await fader.getAttribute('aria-valuetext')
    const value = Number.parseFloat(moving ?? '')
    // 30 px of the cap's travel, 72 dB over the rail less the 14 px cap.
    const expected = -(30 * 72) / (rail.height - 14)
    expect(Math.abs(value - expected)).toBeLessThanOrEqual(1)
    await expect(headerSlider(page, 'Phrase volume')).toHaveAttribute(
      'aria-valuetext',
      moving!,
    )
    expect((await readStudioProject(page)).revision).toBe(start.revision)
    await page.mouse.up()
    await expect
      .poll(async () => (await readStudioProject(page)).revision)
      .toBe(start.revision + 1)
    expect(await gainOf(page, 'Phrase')).toBe(value)

    // A double-click anywhere on the fader is one edit back to 0 dB.
    await page.mouse.dblclick(x, rail.y + rail.height * 0.9)
    await expect
      .poll(async () => (await readStudioProject(page)).revision)
      .toBe(start.revision + 2)
    expect(await gainOf(page, 'Phrase')).toBe(0)
    await expect(
      studioRegion(page).getByRole('button', { name: /^Undo/ }),
    ).toHaveAttribute('aria-label', 'Undo volume')

    // A pressed Solo keeps its colour under the pointer. Colours ease over
    // 0.15 s, so each is read once it has settled.
    const solo = desk.getByRole('button', { name: 'Solo Phrase', exact: true })
    const background = () =>
      solo.evaluate((element) => getComputedStyle(element).backgroundColor)
    const plain = await background()
    await solo.click()
    await expect(solo).toHaveAttribute('aria-pressed', 'true')
    await settled(solo)
    const hovered = await background()
    expect(hovered).not.toBe(plain)
    await page.mouse.move(5, 5)
    await settled(solo)
    expect(await background()).toBe(hovered)
  })

  test('a held fader and dial are heard before they save, and a flavour, a dial release, Reset sound and a new lane keep the song playing @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // One tone a lane: two close tones beat, and the beat reads as a dip.
    await importSteady(page, 'Pad', [330])
    // A quiet low lane keeps the song audible once the pad is pulled down.
    await importSteady(page, 'Low', [165], 0.1)
    // The fixture's phrase swells; only the steady lanes play.
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await expect
      .poll(() => outputLevel(page), { timeout: 15_000 })
      .toBeGreaterThan(-40)
    const desk = await openDesk(page)

    // Hold the Pad fader low: the song follows before anything saves.
    const before = await readStudioProject(page)
    const playing = await outputLevel(page)
    const fader = desk.getByRole('slider', { name: 'Pad volume', exact: true })
    const rail = await fader.boundingBox()
    if (!rail) throw new Error('The Pad fader is not visible.')
    await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height + 60, {
      steps: 10,
    })
    await expect(fader).toHaveAttribute('aria-valuetext', '-60.0 dB')
    await expect(headerSlider(page, 'Pad volume')).toHaveAttribute(
      'aria-valuetext',
      '-60.0 dB',
    )
    const held = await outputLevel(page)
    expect((await readStudioProject(page)).revision).toBe(before.revision)
    // The low lane still plays, so the drop is the pad's share of the mix.
    expect(playing - held).toBeGreaterThan(1.5)
    // Releasing saves the value already playing: no step, no dropout.
    const release = await traceLevel(page, () => page.mouse.up())
    expect(Math.abs(release.after - held)).toBeLessThan(1)
    expect(release.dip).toBeLessThan(3)
    expect(release.sources).toBe(0)
    expect((await readStudioProject(page)).revision).toBe(before.revision + 1)

    // Turn the Tone dial and hold it: heard at once, saved on release.
    const tone = desk.getByTitle(
      'Tone: drag up or down. Double-click for the centre.',
    )
    const point = await center(tone)
    const untouched = await outputLevel(page)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x, point.y + 80, { steps: 8 })
    await expect(
      desk.getByRole('slider', { name: 'Tone', exact: true }),
    ).toHaveAttribute('aria-valuetext', '100 toward Dark')
    const dark = await outputLevel(page)
    expect(Math.abs(dark - untouched)).toBeGreaterThan(0.5)
    expect((await readStudioProject(page)).revision).toBe(before.revision + 1)
    const dialRelease = await traceLevel(page, () => page.mouse.up())
    expect(dialRelease.dip).toBeLessThan(3)
    expect(dialRelease.sources).toBe(0)

    // Sound edits move the running chains: no restart, no dropout.
    for (const action of [
      () => desk.getByRole('button', { name: 'Warm', exact: true }).click(),
      () =>
        desk.getByRole('button', { name: 'Reset sound', exact: true }).click(),
      () =>
        studio.getByRole('button', { name: 'New lane', exact: true }).click(),
    ]) {
      const level = await traceLevel(page, action)
      expect(level.dip).toBeLessThan(3)
      expect(level.sources).toBe(0)
    }
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
  })
})
