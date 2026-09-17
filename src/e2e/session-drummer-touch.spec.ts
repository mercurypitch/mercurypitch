// Actual touch input catches implicit pointer capture; host checks catch missing scoped chrome.
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'

test.use({ hasTouch: true })

for (const width of [390, 820]) {
  test(`touch wheels commit a swipe and retain taps at ${width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1180 })
    await page.goto('/guitar-night')
    await dismissOverlays(page)
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page.getByRole('button', { name: 'Free play', exact: true }).click()
    await page
      .getByRole('button', { name: 'Session drummer', exact: true })
      .tap()
    const genre = page.getByRole('listbox', { name: 'Genre', exact: true })
    const bounds = (await genre.boundingBox())!
    const client = await page.context().newCDPSession(page)
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + 66, id: 1 }
    // Starts on the real option button: touch implicitly captures that child.
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    })
    for (let step = 1; step <= 8; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, y: point.y - step * 5.5 }],
      })
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(genre.getByRole('option', { selected: true })).toHaveText(
      'Blues',
    )
    await genre.getByRole('option', { name: 'Funk', exact: true }).tap()
    await expect(genre.getByRole('option', { selected: true })).toHaveText(
      'Funk',
    )
    await genre.getByRole('option', { name: 'Jazz', exact: true }).tap()
    await expect(genre.getByRole('option', { selected: true })).toHaveText(
      'Jazz',
    )
    const expectCenteredSelection = async () => {
      await expect
        .poll(async () => {
          const selected = (await genre
            .getByRole('option', { selected: true })
            .boundingBox())!
          const wheel = (await genre.boundingBox())!
          return Math.abs(
            selected.y + selected.height / 2 - (wheel.y + wheel.height / 2),
          )
        })
        .toBeLessThan(1)
    }
    await expectCenteredSelection()
    // Cancellation must restore the selected row, without committing a new genre.
    const currentWheel = (await genre.boundingBox())!
    point.y = currentWheel.y + currentWheel.height / 2
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, y: point.y + 44 }],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await expect(genre.getByRole('option', { selected: true })).toHaveText(
      'Jazz',
    )
    await expectCenteredSelection()
    const dialog = page.getByRole('dialog', { name: 'Session drummer' })
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`drummer-touch-${width}.png`),
    })
    await client.detach()
  })
}

for (const mode of ['free', 'score'] as const) {
  test(`drummer has its own visible chrome without covering ${mode} room controls @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    if (mode === 'score') await seedAuthoredGuitarScore(page, 'drummer-chrome')
    await page.goto(
      mode === 'score' ? '/guitar-night?song=drummer-chrome' : '/guitar-night',
    )
    await dismissOverlays(page)
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page
      .getByRole('button', {
        name: mode === 'score' ? 'Practice with tab' : 'Free play',
        exact: true,
      })
      .click()
    const trigger = page.getByRole('button', {
      name: 'Session drummer',
      exact: true,
    })
    await expect(trigger).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(trigger).toHaveCSS('border-top-style', 'solid')
    const bounds = (await trigger.boundingBox())!
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
    await page.screenshot({
      path: testInfo.outputPath(`drummer-${mode}-host.png`),
    })
    // A real tap on the neighboring action must not be intercepted by Drummer.
    if (mode === 'score') {
      await page.getByTestId('guitar-night-session-trigger').tap()
      await expect(
        page.getByRole('dialog', { name: /^Track mixer for / }),
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole('heading', { name: 'Free form', exact: true }),
      ).toBeVisible()
      await page
        .getByRole('button', { name: 'Session controls', exact: true })
        .tap()
      await expect(
        page.getByRole('dialog', { name: 'Session', exact: true }),
      ).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await trigger.tap()
    await page
      .getByRole('button', {
        name: mode === 'score' ? 'Start with score' : 'Start drummer',
        exact: true,
      })
      .tap()
    if (mode === 'free')
      await page
        .getByRole('button', { name: 'Close drummer', exact: true })
        .tap()
    const stop = page.getByRole('button', {
      name: 'Stop session drummer',
      exact: true,
    })
    await expect(stop).toHaveCSS('border-top-style', 'solid')
    const activeBounds = (await stop.boundingBox())!
    expect(activeBounds.x + activeBounds.width).toBeLessThanOrEqual(390)
    await expect(
      page.locator('h1').filter({ visible: true }).first(),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`drummer-${mode}-active-host.png`),
    })
    await stop.tap()
    await expect(trigger).toBeVisible()
  })
}
