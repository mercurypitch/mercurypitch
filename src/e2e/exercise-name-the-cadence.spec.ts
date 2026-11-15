// ============================================================
// Name the Cadence: a run in a real browser, with no microphone
// ============================================================
//
// The drill's arithmetic, its playback and its screen are unit-tested. What
// only a browser shows: the card opens it from the gallery, a round plays
// through to its question on the real clock, the names fit a phone, a whole
// run ends in a result that adds up, and at no point does the page ask for
// a microphone.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

async function openDrill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
    // Count every request for a microphone, and refuse it.
    const w = window as unknown as { micAsked?: number }
    w.micAsked = 0
    navigator.mediaDevices.getUserMedia = () => {
      w.micAsked = (w.micAsked ?? 0) + 1
      return Promise.reject(new DOMException('refused', 'NotAllowedError'))
    }
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page
    .locator('.exercise-card', { hasText: 'Name the Cadence' })
    .first()
    .click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

test.describe('Name the Cadence', () => {
  test('a run on a phone plays each cadence, takes a name and ends in a result that adds up', async ({
    page,
  }) => {
    // Eight rounds on the real clock: about two seconds of chords each, and
    // the cadence again after every miss.
    test.slow()
    await page.setViewportSize({ width: 390, height: 844 })
    await openDrill(page)
    await expect(page.locator('h2.exercise-title')).toHaveText(
      'Name the Cadence',
    )
    await expect(page.locator('.idle-hint')).toHaveText(
      '8 cadences · Perfect, Imperfect and Plagal',
    )

    // From here to the result is the drill's own run.
    await page.evaluate(() => {
      ;(window as unknown as { micAsked?: number }).micAsked = 0
    })
    await page.locator('.exercise-idle-start').click()
    const say = page.locator('.exercise-active-phase')
    const names = page.getByRole('group', { name: 'Name the cadence' })
    await expect(say).toHaveText('Listen.')
    // Not yet: the ending has not sounded.
    await expect(
      names.getByRole('button', { name: 'Perfect', exact: true }),
    ).toHaveAttribute('aria-disabled', 'true')

    // The names fit the sheet, each a thumb tall.
    const boxes = await names.getByRole('button').evaluateAll((buttons) =>
      buttons.map((b) => {
        const r = b.getBoundingClientRect()
        return { left: r.left, right: r.right, height: r.height }
      }),
    )
    expect(boxes).toHaveLength(3)
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(390)
    }

    // Answer "Perfect" to every round, and count how often Merc agrees.
    let right = 0
    for (let round = 0; round < 8; round++) {
      await expect(say).toHaveText('How does it end?', { timeout: 8000 })
      await names.getByRole('button', { name: 'Perfect', exact: true }).click()
      await expect(say).toHaveText(
        /^(Yes, perfect: V to I, it comes home\.|That was (imperfect|plagal): )/,
      )
      if (((await say.textContent()) ?? '').startsWith('Yes')) right += 1
      // The chords are named once the answer is on show.
      await expect(
        page.getByTestId('cadence-chords').locator('[data-role="last"]'),
      ).not.toContainText('?')
      if (round < 7) await expect(say).toHaveText('Listen.', { timeout: 8000 })
    }

    const card = page.locator('.exercise-result-card')
    await expect(card).toBeVisible({ timeout: 8000 })
    await expect(card).toContainText(`Named right: ${right} of 8`)
    await expect(card).toContainText(`${Math.round((100 * right) / 8)}%`)
    expect(
      await page.evaluate(
        () => (window as unknown as { micAsked?: number }).micAsked,
      ),
    ).toBe(0)
  })
})
