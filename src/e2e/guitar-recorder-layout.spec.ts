// Responsive recorder checks use a saved take so capture timing does not share their layout budget.
import { expect, test } from '@playwright/test'
import { enterRecording } from './helpers/guitar-recording'

test('keeps the empty free-form recorder centered at desktop and phone widths @smoke', async ({
  page,
}) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Free play', exact: true })
    .click()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    const button = page.getByRole('button', {
      name: 'Record a melody',
      exact: true,
    })
    await expect(button).toBeInViewport()
    const recordBounds = (await page
      .getByTestId('guitar-recorder-actions')
      .boundingBox())!
    expect(recordBounds.height).toBeGreaterThanOrEqual(44)
    expect(
      Math.abs(recordBounds.x + recordBounds.width / 2 - width / 2),
    ).toBeLessThanOrEqual(3)
    await page.screenshot({
      path: test.info().outputPath(`free-room-${width}.png`),
    })
  }
})

for (const width of [1440, 390, 320]) {
  test(`keeps saved take review, transport and gallery reachable at ${width}px @smoke`, async ({
    page,
  }) => {
    const deck = await enterRecording(page)
    await page.setViewportSize({ width, height: width === 320 ? 568 : 850 })
    await page.getByRole('button', { name: 'Review take', exact: true }).click()
    const review = page
      .getByRole('dialog')
      .filter({ hasText: 'Recorded melody' })
    await page.setViewportSize({ width, height: width === 320 ? 568 : 850 })
    const tone = review.getByRole('button', {
      name: 'Playback tone',
      exact: true,
    })
    await tone.scrollIntoViewIfNeeded()
    await expect(tone).toBeInViewport()
    await expect(
      review.getByRole('button', { name: 'Playback source', exact: true }),
    ).toBeInViewport()
    await expect(
      review.getByRole('button', { name: 'Play take playback', exact: true }),
    ).toBeInViewport()
    const reviewPlay = (await review
      .getByRole('button', { name: 'Play take playback', exact: true })
      .boundingBox())!
    const pinnedKeep = (await review
      .getByRole('button', { name: 'Keep take', exact: true })
      .boundingBox())!
    expect(reviewPlay.y + reviewPlay.height).toBeLessThanOrEqual(pinnedKeep.y)
    expect(
      await tone.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44)
    await page.screenshot({
      path: test.info().outputPath(`recording-playback-review-${width}.png`),
    })
    await review
      .getByRole('button', { name: 'Review and correct notes', exact: true })
      .click()
    await page.setViewportSize({ width, height: 850 })
    const bounds = (await review.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    await expect(
      review.getByRole('button', { name: 'Keep take', exact: true }),
    ).toBeInViewport()
    await expect(
      review.getByRole('button', { name: 'Practice these notes', exact: true }),
    ).toBeInViewport()
    await page.screenshot({
      path: test.info().outputPath(`recording-review-${width}.png`),
    })
    await review
      .getByRole('button', { name: 'Hide note corrections', exact: true })
      .click()
    await review.getByRole('button', { name: 'Keep take', exact: true }).click()
    await expect(
      review.getByRole('button', { name: 'Take kept', exact: true }),
    ).toBeDisabled()
    await review
      .getByRole('button', { name: 'Close Jam Doctor', exact: true })
      .click()
    await page.setViewportSize({ width, height: width === 320 ? 568 : 850 })
    await expect(
      deck.getByRole('button', { name: 'Play recording', exact: true }),
    ).toBeInViewport()
    const playBounds = (await deck
      .getByRole('button', { name: 'Play recording', exact: true })
      .boundingBox())!
    expect(playBounds.y + playBounds.height).toBeLessThanOrEqual(
      width === 320 ? 568 : 850,
    )
    await expect(
      deck.getByRole('button', { name: 'Record a melody', exact: true }),
    ).toBeInViewport()
    await expect(
      deck.getByRole('button', { name: 'Playback tone', exact: true }),
    ).toBeInViewport()
    expect(
      await deck.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`recording-deck-${width}.png`),
    })
    const flow = page.locator('canvas[data-tab-presentation]')
    const stageBefore = (await flow.boundingBox())!
    const libraryButton = page.getByRole('button', {
      name: 'My melodies, 1 recording',
      exact: true,
    })
    await libraryButton.click()
    const gallery = page.getByRole('dialog', {
      name: 'My melodies',
      exact: true,
    })
    await expect(
      gallery.getByRole('img', { name: /Captured melody/ }),
    ).toBeVisible()
    const galleryBounds = (await gallery.boundingBox())!
    expect(galleryBounds.x).toBeGreaterThanOrEqual(0)
    expect(galleryBounds.x + galleryBounds.width).toBeLessThanOrEqual(width)
    expect(
      await gallery.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true)
    await expect(
      gallery.getByRole('button', { name: 'Close My melodies', exact: true }),
    ).toBeInViewport()
    await page.screenshot({
      path: test.info().outputPath(`melody-gallery-${width}.png`),
    })
    await page.keyboard.press('Escape')
    await expect(gallery).not.toBeVisible()
    await expect(libraryButton).toBeFocused()
    expect((await flow.boundingBox())!.height).toBeCloseTo(
      stageBefore.height,
      0,
    )
  })
}
