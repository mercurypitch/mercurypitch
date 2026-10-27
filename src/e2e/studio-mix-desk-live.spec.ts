// Studio mixing desk, live — with a real mouse: a fader drags from where it is and ignores a click on its rail, a held fader and dial are heard before they save, sound edits keep the song playing, and a muted lane comes in without a dropout.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { center, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { importSteady, openDesk, outputLevel, settled, tapOutput, traceLevel, } from './helpers/studio-output'

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

  test('a lane muted when Play started comes in with its Mute, and one outside a solo with an un-solo, with no dropout and no restart @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    const lanes = studio.locator('[data-studio-track]')
    await importSteady(page, 'Pad', [330])
    // As loud as the pad: the song is 3 dB louder once it comes in.
    await importSteady(page, 'Low', [165])
    // The fixture's phrase swells; it stays out. Low waits, muted.
    await lanes
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await lanes.getByRole('button', { name: 'Mute Low', exact: true }).click()
    const unmuteLow = lanes.getByRole('button', {
      name: 'Unmute Low',
      exact: true,
    })
    await expect(unmuteLow).toHaveAttribute('aria-pressed', 'true')
    const play = studio.getByRole('button', { name: 'Play song', exact: true })
    await play.click()
    await expect
      .poll(() => outputLevel(page), { timeout: 15_000 })
      .toBeGreaterThan(-40)
    const unmute = await traceLevel(page, () => unmuteLow.click())
    expect(unmute.after - unmute.before).toBeGreaterThan(2)
    expect(unmute.dip).toBeLessThan(3)
    expect(unmute.sources).toBe(0)

    // Play again with Pad soloed: Low is silent from the start this time.
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
    const soloPad = lanes.getByRole('button', { name: 'Solo Pad', exact: true })
    await soloPad.click()
    await expect(soloPad).toHaveAttribute('aria-pressed', 'true')
    await play.click()
    await expect
      .poll(() => outputLevel(page), { timeout: 15_000 })
      .toBeGreaterThan(-40)
    const unsolo = await traceLevel(page, () => soloPad.click())
    expect(unsolo.after - unsolo.before).toBeGreaterThan(2)
    expect(unsolo.dip).toBeLessThan(3)
    expect(unsolo.sources).toBe(0)
  })
})
