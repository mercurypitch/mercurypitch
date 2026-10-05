// Creator previews scroll inside the real Games host without moving a game canvas.
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 640 }, hasTouch: true })

for (const preview of [
  { card: 'Little discoveries', title: 'Little discoveries' },
  { card: 'Echo Curator', title: 'The Echo Curator' },
  { card: 'Merc’s little songbook', title: 'Merc’s little songbook' },
]) {
  test(`${preview.card} scrolls by touch inside the Games list host @smoke`, async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Trusted touch input uses Chromium CDP.',
    )
    await page.goto('/?devSeed&cold')
    await page.getByRole('button', { name: /B-side games/u }).click()
    await page
      .getByRole('button', { name: new RegExp(preview.card, 'u') })
      .click()
    await expect(
      page.getByRole('heading', { name: preview.title, exact: true }),
    ).toBeVisible()
    const host = page.locator('.games-stage')
    await expect
      .poll(() =>
        host.evaluate((node) => node.scrollHeight - node.clientHeight),
      )
      .toBeGreaterThan(40)
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 195, y: 530 }],
    })
    for (let y = 490; y >= 130; y -= 40) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 195, y }],
      })
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      )
    }
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect
      .poll(() => host.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(50)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.screenshot({
      path: test.info().outputPath('preview-after-touch.png'),
    })
    await host.evaluate((node) => node.scrollTo(0, 0))
    await page
      .getByRole('button', { name: /Back to games|Leave audition/u })
      .click()
    await expect(
      page.getByRole('heading', { name: 'A small game, sung.' }),
    ).toBeVisible()
  })
}

test('the Games list opens the Singing Current and its exit returns to the list @smoke', async ({
  page,
}) => {
  await page.goto('/?devSeed&cold')
  await page.getByRole('button', { name: /B-side games/u }).click()
  await page.getByRole('button', { name: /The Singing Current/u }).click()
  await expect(
    page.getByRole('dialog', { name: 'Ready when you are', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.games-stage')).not.toHaveClass(
    /games-stage--preview/u,
  )
  await page
    .getByRole('dialog', { name: 'Ready when you are', exact: true })
    .getByRole('button', { name: 'Leave course', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'A small game, sung.' }),
  ).toBeVisible()
})
