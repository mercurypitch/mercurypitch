// Studio strip meters — each desk strip shows its lane's level after the fader beside the fader while the song plays, reads silent for a muted lane, falls to the floor on Pause and stays out of the accessibility tree.
import { expect, type Locator, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { importSteady, openDesk } from './helpers/studio-output'

/** The desk strip holding a lane's fader. */
function strip(desk: Locator, lane: string): Locator {
  return desk.locator('[data-studio-mix-strip]').filter({
    has: desk.page().getByRole('slider', { name: `${lane} volume` }),
  })
}

/** A strip meter's reading in dBFS: -Infinity when silent, null at the floor. */
async function levelDb(meter: Locator): Promise<number | null> {
  const value = await meter.getAttribute('data-level-db')
  if (value === null) return null
  return value === '-inf' ? -Infinity : Number(value)
}

test.describe('Studio strip meters', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('each strip meters its own lane beside its fader, a muted lane reads silent, and every meter falls to the floor on Pause @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importSteady(page, 'Pad', [330])
    await importSteady(page, 'Low', [165])
    const desk = await openDesk(page)
    const padStrip = strip(desk, 'Pad')
    const pad = padStrip.locator('[data-studio-strip-meter]')
    const low = strip(desk, 'Low').locator('[data-studio-strip-meter]')
    await expect(desk.locator('[data-studio-strip-meter]')).toHaveCount(3)

    // Stopped, it sits at the floor; screen readers hear the fader instead.
    await expect(pad).toHaveAttribute('aria-hidden', 'true')
    await expect(pad).toHaveAttribute(
      'title',
      'Pad: press Play to see its level',
    )
    await expect(pad).not.toHaveAttribute('data-level-db')

    // Beside the fader's travel and inside the strip.
    await expect(pad).toBeVisible()
    const fader = padStrip.getByRole('slider', { name: 'Pad volume' })
    const [meterBox, faderBox, stripBox] = await Promise.all(
      [pad, fader, padStrip].map((item) => item.boundingBox()),
    )
    if (!meterBox || !faderBox || !stripBox)
      throw new Error('The Pad strip is not laid out.')
    expect(meterBox.x).toBeGreaterThanOrEqual(faderBox.x + faderBox.width)
    expect(meterBox.x + meterBox.width).toBeLessThanOrEqual(
      stripBox.x + stripBox.width,
    )
    expect(meterBox.y).toBeGreaterThanOrEqual(faderBox.y)
    expect(meterBox.y + meterBox.height).toBeLessThanOrEqual(
      faderBox.y + faderBox.height,
    )

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    for (const meter of [pad, low])
      await expect
        .poll(() => levelDb(meter), { timeout: 15_000 })
        .toBeGreaterThan(-40)
    await expect(pad).toHaveAttribute(
      'title',
      /^Pad: peak -\d+\.\d dB after the fader/,
    )

    // A steady tone reads steadily: no tick drops its lane to the floor.
    // Sampled every 5 ms for 3 s, as the attribute changes only when the
    // reading does.
    const readings = await pad.evaluate(
      (meter) =>
        new Promise<(string | null)[]>((resolve) => {
          const seen: (string | null)[] = []
          const sample = setInterval(
            () => seen.push(meter.getAttribute('data-level-db')),
            5,
          )
          setTimeout(() => {
            clearInterval(sample)
            resolve(seen)
          }, 3000)
        }),
    )
    expect(readings.length).toBeGreaterThan(100)
    expect(
      readings.filter(
        (value) => value === null || value === '-inf' || Number(value) < -40,
      ),
    ).toEqual([])

    // A muted lane reads silent while the others read on. Its title keeps
    // the last peak for 1.5 s, then lets it fall to the floor.
    await desk.getByRole('button', { name: 'Mute Low', exact: true }).click()
    await expect(low).toHaveAttribute('data-level-db', '-inf')
    await expect(low).toHaveAttribute('title', 'Low: silent', {
      timeout: 10_000,
    })
    expect(await levelDb(pad)).toBeGreaterThan(-40)
    await desk.getByRole('button', { name: 'Unmute Low', exact: true }).click()
    await expect.poll(() => levelDb(low)).toBeGreaterThan(-40)

    // Pause: every meter falls to the floor.
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
    for (const meter of [pad, low])
      await expect(meter).not.toHaveAttribute('data-level-db')
    await expect(pad).toHaveAttribute(
      'title',
      'Pad: press Play to see its level',
    )
  })

  test('a press on a strip meter drags its fader, and the meter still names itself there @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    const desk = await openDesk(page)
    const strip = desk.locator('[data-studio-mix-strip]').first()
    const meter = strip.locator('[data-studio-strip-meter]')
    const fader = strip.getByRole('slider', { name: 'Phrase volume' })
    await expect(fader).toHaveValue('0')
    const box = (await meter.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    // A real press in the meter's middle and a drag upward raise the
    // lane's volume, as a press on the fader beside it does.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y - 12, { steps: 4 })
    await page.mouse.move(x, y - 24, { steps: 4 })
    await page.mouse.up()
    await expect
      .poll(async () => Number(await fader.inputValue()))
      .toBeGreaterThan(5)

    // The press lands on the meter, inside the fader's drag area, and a
    // pointer resting there still reads the meter's own title.
    const landed = await strip.evaluate(
      (element, [x, y]) => {
        const hit = document.elementFromPoint(x, y)
        const fader = element.querySelector('[data-studio-fader]')!
        return {
          title: hit?.closest('[title]')?.getAttribute('title') ?? null,
          dragArea: fader.parentElement!.contains(hit),
        }
      },
      [x, y],
    )
    expect(landed).toEqual({
      title: 'Phrase: press Play to see its level',
      dragArea: true,
    })
  })

  test("a strip meter reads on its fader's own dB marks: 0 dBFS beside 0 dB, the floor beside −60", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    const desk = await openDesk(page)
    const strip = desk.locator('[data-studio-mix-strip]').first()
    const marks = await strip.evaluate((element) =>
      Object.fromEntries(
        [...element.querySelectorAll('[aria-hidden="true"] > span')]
          .filter(
            (mark) =>
              /^(\+12|0|−\d\d)$/.test(mark.textContent ?? '') &&
              mark.getClientRects().length > 0,
          )
          .map((mark) => {
            const box = mark.getBoundingClientRect()
            return [mark.textContent, box.top + box.height / 2]
          }),
      ),
    )
    const box = (await strip
      .locator('[data-studio-strip-meter]')
      .boundingBox())!
    expect(Math.abs(box.y - marks['0'])).toBeLessThanOrEqual(1)
    expect(Math.abs(box.y + box.height - marks['−60'])).toBeLessThanOrEqual(1)
  })
})
