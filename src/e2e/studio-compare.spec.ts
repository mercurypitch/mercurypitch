// Studio Compare proof — explicit native auditions and Escape cancellation of a real slider gesture.
import { expect, test } from '@playwright/test'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })

test('Studio prepares matched Compare without autoplay and switches explicit auditions at the same position @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play
    const nativeUrl = URL.createObjectURL
    const sourceSizes = new Map<string, number>()
    URL.createObjectURL = (source) => {
      const url = nativeUrl.call(URL, source)
      if (source instanceof Blob) sourceSizes.set(url, source.size)
      return url
    }
    const state = window as unknown as {
      studioTestMediaPlays: number
      studioTestAudition?: HTMLMediaElement
    }
    state.studioTestMediaPlays = 0
    HTMLMediaElement.prototype.play = function () {
      // The app primes iOS audio with a separate 1644-byte silent WAV.
      // These four-second prepared songs are larger than that unlock clip.
      if ((sourceSizes.get(this.src) ?? 0) > 1644) {
        state.studioTestMediaPlays++
        state.studioTestAudition = this
      }
      return nativePlay.call(this)
    }
  })
  await openArrangement(page)
  const studio = studioRegion(page)
  const original = await readStudioProject(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const priorPlayCount = await page.evaluate(
    () =>
      (window as unknown as { studioTestMediaPlays: number })
        .studioTestMediaPlays,
  )
  const compare = studio.getByRole('region', {
    name: 'Compare sound',
    exact: true,
  })
  await compare
    .getByRole('button', { name: 'Prepare Compare', exact: true })
    .click()
  const before = compare.getByRole('button', { name: 'Before', exact: true })
  const after = compare.getByRole('button', { name: 'After', exact: true })
  await expect(before).toBeEnabled({ timeout: 90_000 })
  const playCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { studioTestMediaPlays: number })
          .studioTestMediaPlays,
    )
  const position = () =>
    page.evaluate(
      () =>
        (window as unknown as { studioTestAudition?: HTMLMediaElement })
          .studioTestAudition?.currentTime ?? 0,
    )
  expect(await playCount()).toBe(priorPlayCount)
  await before.click()
  await expect(before).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(playCount).toBe(priorPlayCount + 1)
  await expect.poll(position).toBeGreaterThan(0.2)
  const switchedAt = await position()
  await after.click()
  await expect(after).toHaveAttribute('aria-pressed', 'true')
  await expect(before).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(playCount).toBe(priorPlayCount + 2)
  await expect.poll(position).toBeGreaterThanOrEqual(switchedAt - 0.05)
  await compare
    .getByRole('button', { name: 'Stop Compare', exact: true })
    .click()
  await expect(after).toHaveAttribute('aria-pressed', 'false')
  expect((await readStudioProject(page)).revision).toBe(original.revision)
  await studio.getByRole('button', { name: 'Warm', exact: true }).click()
  await expect(
    compare.getByRole('button', { name: 'Prepare Compare', exact: true }),
  ).toBeEnabled()
  await expect(before).toHaveCount(0)
  expect(await playCount()).toBe(priorPlayCount + 2)
})

test('Studio Escape cancels the whole pointer macro gesture, including later moves before release @smoke', async ({
  page,
}) => {
  await openArrangement(page)
  const studio = studioRegion(page)
  const original = await readStudioProject(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  const tone = studio.getByRole('slider', { name: 'Tone', exact: true })
  const box = await tone.boundingBox()
  if (!box) throw new Error('The Tone slider is not visible.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, {
    steps: 6,
  })
  await page.keyboard.press('Escape')
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, {
    steps: 6,
  })
  await page.mouse.up()
  await expect(tone).toHaveValue(String(original.mix.macros.tone))
  expect((await readStudioProject(page)).revision).toBe(original.revision)
  await expect(
    studio.getByRole('button', { name: 'Close Sound', exact: true }),
  ).toBeVisible()
})
