// Studio Inputs view — on Chromium's two-channel fake capture, a loud tone on the left and a quiet one on the right, the view lists the input with Input 1, Input 2 and Inputs 1 + 2; a check meters each row, the left loudest, the pair between, and names the signal; an armed lane leaves Check off and meters its input on the arm's own split; a lane's channel chosen there is its choice in Track details; and the view fits a computer and a phone with no sideways scroll and finger-sized targets on a phone.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton } from './helpers/studio-arming'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'

/** A loud tone on the left and a quiet one on the right: the rows tell them apart by level. */
const STEREO_WAV = writeStereoToneWav(440, 660, 10, [0.5, 0.125])
/** Each side's peak as the file holds it. */
const LEFT_PEAK = (0.5 * 26000) / 32768
const RIGHT_PEAK = (0.125 * 26000) / 32768

test.use({
  launchOptions: { args: fakeMicArgs(STEREO_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Inputs, opened from the Sound panel's Recording section. */
async function openInputs(page: Page): Promise<Locator> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await studio
    .getByRole('button', { name: 'Inputs and channels', exact: true })
    .click()
  const panel = studio.locator('[data-studio-panel][aria-label="Inputs"]')
  await expect(panel.locator('[data-studio-inputs]')).toBeVisible()
  return panel
}

/** The system default's card: the input a lane that follows the Studio's records. */
function defaultCard(panel: Locator): Locator {
  return panel.getByRole('article').filter({ hasText: 'System default' })
}

/** Check the input on `card`, and wait for its rows. */
async function check(card: Locator): Promise<void> {
  await card.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(card.locator('[data-studio-input-channels]')).toHaveText('2', {
    timeout: 15_000,
  })
}

/** A row's meter reading, its peak. */
async function peak(card: Locator, row: string): Promise<number> {
  const value = await card
    .locator(`[data-studio-input-row="${row}"] [data-peak]`)
    .getAttribute('data-peak')
  return Number(value ?? 0)
}

/** Every row's meter reading at one moment, by its label. */
async function peaks(card: Locator): Promise<Record<string, number>> {
  return card
    .locator('[data-studio-input-row]')
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((row) => [
          row.getAttribute('data-studio-input-row') ?? '',
          Number(
            row.querySelector('[data-peak]')?.getAttribute('data-peak') ?? 0,
          ),
        ]),
      ),
    )
}

/**
 * Every row's reading at one moment, once all of them read the capture. A
 * Check's first few hundred milliseconds can read silence on every row at
 * once: Chromium's fake capture starts with 30 ms of silence, longer than a
 * meter's 21 ms block, and its first buffers arrive unevenly. Measured, the
 * four rows all read 0.000 at 0.215, 0.241 and 0.273 s after the capture
 * opened, between readings of the tones, and never after 0.3 s in 75 s of
 * reading; this test reads them about 0.15 s in. The file's loop leaves 5 to
 * 14 ms of silence, shorter than a block, and no row ever read 0 there.
 */
async function peaksTogether(card: Locator): Promise<Record<string, number>> {
  let read: Record<string, number> = {}
  await expect
    .poll(
      async () => {
        read = await peaks(card)
        return Object.values(read).every((value) => value > 0)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  return read
}

/** Each side's row reads its own tone: the left loud, the right quiet, neither the other. */
async function expectSides(card: Locator): Promise<void> {
  for (const [row, level] of [
    ['Input 1', LEFT_PEAK],
    ['Input 2', RIGHT_PEAK],
  ] as const) {
    await expect
      .poll(() => peak(card, row), { timeout: 10_000 })
      .toBeGreaterThan(level * 0.8)
    expect(await peak(card, row)).toBeLessThan(level * 1.2)
  }
}

test.describe('Studio Inputs view', () => {
  test('meters each input and pair of a two-channel input, follows an armed lane on its own split, and sets a lane’s channel as Track details does', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    const panel = await openInputs(page)
    const listed = await page.evaluate(() =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) =>
          devices
            .filter((device) => device.kind === 'audioinput')
            .map((device) => `${device.deviceId.slice(0, 8)} ${device.label}`),
        ),
    )
    console.log(`[studio-inputs-view] inputs ${JSON.stringify(listed)}`)
    const card = defaultCard(panel)
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Not open')

    await check(card)
    await expect(
      card
        .locator('[data-studio-input-row]')
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute('data-studio-input-row')),
        ),
    ).resolves.toEqual([
      'Default: Inputs 1 + 2',
      'Input 1',
      'Input 2',
      'Inputs 1 + 2',
    ])
    // Each side on its own row; the pair mixes both at half each, so it
    // reads between them; and the default row reads what the default
    // takes, the pair.
    await expectSides(card)
    const read = await peaksTogether(card)
    console.log(`[studio-inputs-view] checked ${JSON.stringify(read)}`)
    expect(read['Inputs 1 + 2']).toBeGreaterThan(read['Input 2'])
    expect(read['Inputs 1 + 2']).toBeLessThan(read['Input 1'])
    expect(read['Default: Inputs 1 + 2']).toBe(read['Inputs 1 + 2'])
    await expect(card).toContainText('Signal on Input 1')

    // An arm takes the input over: Check goes off, and the meters follow
    // the armed lane on its own split.
    await armLane(page, 'Lane 2')
    await expect(card).toContainText('Armed lane records from it')
    const checks = panel.getByRole('button', { name: 'Check', exact: true })
    expect(await checks.count()).toBeGreaterThan(0)
    for (const button of await checks.all()) await expect(button).toBeDisabled()
    await expectSides(card)

    // A lane's channel chosen here is its own choice: it re-arms, the
    // meters follow the new arm's split, and Track details says so.
    await panel
      .getByRole('group', { name: 'Lane 2 input', exact: true })
      .getByRole('combobox', { name: 'Channel', exact: true })
      .selectOption({ label: 'Input 2' })
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await expect(
      card.locator('[data-studio-input-row="Input 2"]'),
    ).toContainText('Lane 2')
    await expectSides(card)
    await studio
      .getByRole('button', { name: 'Lane 2 details', exact: true })
      .click()
    await expect(
      studio.getByRole('combobox', { name: 'Channel', exact: true }),
    ).toHaveValue('2')
  })
})

// A computer's side panel, and a phone's sheet.
const LAYOUTS = [
  {
    name: 'computer',
    viewport: { width: 1440, height: 900 },
    touch: false,
  },
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
] as const

for (const layout of LAYOUTS)
  test.describe(`Studio Inputs view on a ${layout.name}`, () => {
    test.use({
      viewport: layout.viewport,
      hasTouch: layout.touch,
      isMobile: layout.touch,
    })

    test('fits with no sideways scroll, every target finger-sized on touch', async ({
      page,
    }) => {
      await openArrangement(page)
      const panel = await openInputs(page)
      await check(defaultCard(panel))

      const fit = await panel.evaluate((element, touch) => {
        const body = element.querySelector<HTMLElement>(
          '[data-studio-inputs]',
        )!.parentElement!
        const small = touch
          ? [
              ...element.querySelectorAll<HTMLElement>(
                '[data-studio-inputs] button, [data-studio-inputs] select',
              ),
            ]
              .filter((control) => {
                const box = control.getBoundingClientRect()
                return box.width > 0 && box.height < 44
              })
              .map(
                (control) =>
                  control.getAttribute('aria-label') ??
                  control.textContent?.trim() ??
                  control.tagName,
              )
          : []
        return {
          page:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          body: body.scrollWidth - body.clientWidth,
          small,
        }
      }, layout.touch)

      expect(fit.page).toBeLessThanOrEqual(0)
      expect(fit.body).toBeLessThanOrEqual(1)
      expect(fit.small).toEqual([])
    })
  })
