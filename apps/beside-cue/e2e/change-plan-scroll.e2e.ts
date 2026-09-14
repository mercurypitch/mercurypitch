// Changing a plan preserves the person's position while they compare Pulls.
import { expect, test } from '@playwright/test'

test('changing and reselecting a Pull does not scroll to confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: /Change this plan/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose your Pull', exact: true }),
  ).toBeVisible()

  for (const name of [
    'Automatic snacking',
    'Endless scrolling',
    'Endless scrolling',
  ]) {
    const radio = page.getByRole('radio', { name, exact: true })
    const card = radio.locator('..')
    await card.scrollIntoViewIfNeeded()
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    const before = await page.evaluate(() => scrollY)
    // A real pointer click avoids Playwright scrolling the radio into view.
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(radio).toBeChecked()
    // Observe through the browser's smooth-scroll interval, not just its first frame.
    const positions = await page.evaluate(async () => {
      const samples: number[] = []
      const until = performance.now() + 700
      while (performance.now() < until) {
        samples.push(scrollY)
        await new Promise(requestAnimationFrame)
      }
      return samples
    })
    expect(positions.length).toBeGreaterThan(1)
    expect(
      Math.max(...positions.map((position) => Math.abs(position - before))),
    ).toBeLessThanOrEqual(1)
    await expect(
      page
        .getByRole('region', { name: 'Selected Pull preview' })
        .getByRole('heading', { name }),
    ).toBeAttached()
  }
  const confirm = page.getByRole('button', {
    name: 'Confirm Endless scrolling',
    exact: true,
  })
  await expect(confirm).toBeVisible()
  await expect(confirm).toBeEnabled()
  const confirmBox = await confirm.boundingBox()
  expect(confirmBox!.y).toBeGreaterThanOrEqual(0)
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(664)
})
