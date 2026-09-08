// Recorder overlays and saved camera preferences remain usable above the live stage.
import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { enterRecording } from './helpers/guitar-recording'

async function expectUncovered(element: Locator) {
  await expect
    .poll(() =>
      element.evaluate((node) => {
        const box = node.getBoundingClientRect()
        return node.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        )
      }),
    )
    .toBe(true)
}

test('melody removal keeps an opaque faceplate and visible actions in both galleries @smoke', async ({
  page,
}) => {
  await enterRecording(page)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 740 })
    const library = page.getByRole('button', {
      name: 'My melodies, 1 recording',
      exact: true,
    })
    for (const quick of [true, false]) {
      await library.click({ button: quick ? 'right' : 'left' })
      const gallery = page.getByRole('dialog', {
        name: quick ? 'Switch melody' : 'My melodies',
        exact: true,
      })
      const remove = gallery.getByRole('button', {
        name: 'Remove Two-part transport proof',
        exact: true,
      })
      await remove.click()
      const dialog = page.getByRole('alertdialog', {
        name: 'Remove this melody?',
      })
      await expect(dialog).toBeInViewport()
      await expect(dialog).toHaveCSS('opacity', '1')
      const background = await dialog.evaluate(
        (node) => getComputedStyle(node).backgroundColor,
      )
      expect(background).toMatch(/^rgb\(/)
      const confirm = dialog.getByTestId('confirm-delete')
      expect(
        await confirm.evaluate(
          (node) => getComputedStyle(node).backgroundColor,
        ),
      ).toMatch(/^rgb\(/)
      await expectUncovered(confirm)
      const box = (await dialog.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await page.screenshot({
        path: test
          .info()
          .outputPath(`remove-${quick ? 'quick' : 'gallery'}-${width}.png`),
        animations: 'disabled',
      })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(remove).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(gallery).not.toBeVisible()
    }
  }
})

test('listening picker stays above the recorder and anchored through resizing @smoke', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('mp.guitarNight.inputProfile', 'interface'),
  )
  await enterRecording(page)
  const listening = page.getByTestId('guitar-night-listening-cycle')
  await listening.click({ button: 'right' })
  const picker = page.getByTestId('guitar-night-listening-picker')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 740 })
    for (const chip of await picker.getByRole('menuitemradio').all()) {
      await expectUncovered(chip)
      await expect(chip).toBeInViewport()
    }
    for (const control of await picker.getByRole('button').all()) {
      await expectUncovered(control)
    }
    const box = (await picker.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y + box.height).toBeLessThanOrEqual(
      (await listening.boundingBox())!.y,
    )
    await page.screenshot({
      path: test.info().outputPath(`listening-${width}.png`),
    })
  }
  await page.keyboard.press('Escape')
  await expect(picker).not.toBeVisible()
  await expect(listening).toBeFocused()
  await listening.click({ button: 'right' })
  await page.mouse.click(300, 350)
  await expect(picker).not.toBeVisible()
})

test('correction review starts with the selected note and keeps notation tools optional @smoke', async ({
  page,
}) => {
  await enterRecording(page)
  await page.setViewportSize({ width: 390, height: 850 })
  await page.getByRole('button', { name: 'Review take', exact: true }).click()
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await review
    .getByRole('button', { name: 'Review and correct notes', exact: true })
    .click()
  const pitch = review.getByRole('spinbutton', { name: 'Pitch (MIDI)' })
  await pitch.scrollIntoViewIfNeeded()
  await expect(pitch).toBeVisible()
  await expect(
    review.getByRole('spinbutton', { name: 'Display tempo (BPM)' }),
  ).not.toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('note-corrections.png'),
  })
  await review.getByText('Tempo and snapping', { exact: true }).click()
  await expect(
    review.getByRole('spinbutton', { name: 'Display tempo (BPM)' }),
  ).toBeVisible()
  await review
    .getByRole('button', { name: 'Snap to eighth notes', exact: true })
    .click()
  await expect(
    review.getByRole('button', { name: 'Undo correction', exact: true }),
  ).toBeEnabled()
})

test('old phrase-follow settings become a fixed highway and never undo a manual orbit @smoke', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('guitar-night-camera-preset-v1', 'phrase-focus'),
  )
  const deck = await enterRecording(page)
  const canvas = page.locator('canvas[data-tab-presentation]')
  await expect(canvas).toHaveAttribute('data-camera-ready', 'true')
  await expect(canvas).toHaveAttribute('data-camera-following', 'false')
  await expect(page.getByTestId('guitar-night-stage')).toHaveAttribute(
    'data-camera-preset',
    'flow',
  )
  const timeline = page.getByTestId('guitar-recording-timeline')
  const rail = (await timeline.boundingBox())!
  const target = await canvas.getAttribute('data-camera-target-x')
  await page.mouse.click(rail.x + rail.width * 0.7, rail.y + rail.height / 2)
  await expect
    .poll(async () => Number(await timeline.inputValue()))
    .toBeGreaterThan(7)
  await expect(canvas).toHaveAttribute('data-camera-target-x', target!)
  const box = (await canvas.boundingBox())!
  const initial = await canvas.getAttribute('data-camera-yaw')
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5, {
    steps: 5,
  })
  await page.mouse.up()
  await expect
    .poll(() => canvas.getAttribute('data-camera-yaw'))
    .not.toBe(initial)
  const orbited = await canvas.getAttribute('data-camera-yaw')
  await page.mouse.click(rail.x + rail.width * 0.1, rail.y + rail.height / 2)
  await deck
    .getByRole('button', { name: 'Play recording', exact: true })
    .click()
  await expect
    .poll(async () => Number(await timeline.inputValue()))
    .toBeGreaterThan(2)
  await expect(canvas).toHaveAttribute('data-camera-yaw', orbited!)
  await expect(canvas).toHaveAttribute('data-camera-target-x', target!)
})
