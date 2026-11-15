// ============================================================
// Read the Note: a run in a real browser, with no microphone
// ============================================================
//
// The drill's arithmetic and its screen are unit-tested. What only a browser
// shows: the card opens it from the gallery, the staff's glyphs draw, the
// seven answers fit a phone's width at a size a thumb can press, a run ends
// in a result, and at no point does the page ask for a microphone. It is
// the one drill that must not.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** The letter at each place of each staff, counted up from its bottom line. */
function letterAt(clef: string, place: number): string {
  // The treble staff's bottom line is E, the bass staff's is G.
  const bottom = clef === 'treble' ? 2 : 4
  return LETTERS[(((bottom + place) % 7) + 7) % 7]
}

async function openDrill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
    // Count every request for a microphone, and refuse it.
    const w = window as unknown as { micAsked?: number }
    w.micAsked = 0
    const media = navigator.mediaDevices
    media.getUserMedia = () => {
      w.micAsked = (w.micAsked ?? 0) + 1
      return Promise.reject(new DOMException('refused', 'NotAllowedError'))
    }
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page
    .locator('.exercise-card', { hasText: 'Read the Note' })
    .first()
    .click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

/** Answer the note that is up, right or wrong, and wait for the next one. */
async function answerNote(page: Page, right: boolean): Promise<void> {
  const staff = page.getByTestId('note-staff')
  const clef = (await staff.getAttribute('data-clef')) ?? 'treble'
  const place = Number(await staff.getAttribute('data-place'))
  const letter = letterAt(clef, place)
  const tapped = right ? letter : letter === 'C' ? 'D' : 'C'
  const answers = page.getByRole('group', { name: 'Name the note' })
  await answers.getByRole('button', { name: tapped, exact: true }).click()
  await expect(page.locator('.exercise-active-phase')).toContainText(
    right ? `Yes, ${letter}.` : `That is ${letter}:`,
  )
}

test.describe('Read the Note', () => {
  test('a run by letters on a phone ends in a result, and never asks for a microphone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openDrill(page)
    await expect(page.locator('h2.exercise-title')).toHaveText('Read the Note')
    await expect(page.locator('.idle-hint')).toContainText('10 notes')

    // From here to the result is the drill's own run: whatever the app
    // asked for before this drill opened is not its doing.
    await page.evaluate(() => {
      ;(window as unknown as { micAsked?: number }).micAsked = 0
    })
    await page.locator('.exercise-idle-start').click()
    const staff = page.getByTestId('note-staff')
    await expect(staff).toBeVisible()
    // The staff is drawn: its clef and its notehead have a size.
    const drawn = await staff.evaluate((svg) =>
      Array.from(svg.querySelectorAll('path')).map(
        (p) => p.getBoundingClientRect().height,
      ),
    )
    expect(drawn).toHaveLength(2)
    for (const height of drawn) expect(height).toBeGreaterThan(8)

    // Seven answers across, each a thumb wide, inside the sheet.
    const boxes = await page
      .getByRole('group', { name: 'Name the note' })
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((b) => {
          const r = b.getBoundingClientRect()
          return {
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          }
        }),
      )
    expect(boxes).toHaveLength(7)
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(390)
    }

    // One miss, then nine read right.
    await answerNote(page, false)
    for (let i = 0; i < 9; i++) {
      await expect(page.locator('.exercise-active-phase')).toHaveText(
        'Which note is this?',
        { timeout: 5000 },
      )
      await answerNote(page, true)
    }

    const card = page.locator('.exercise-result-card')
    await expect(card).toBeVisible({ timeout: 5000 })
    await expect(card).toContainText('90%')
    await expect(card).toContainText('Read right: 9 of 10')
    expect(
      await page.evaluate(
        () => (window as unknown as { micAsked?: number }).micAsked,
      ),
    ).toBe(0)
  })

  test('the piano keys answer too, on the bass staff, on a desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openDrill(page)
    await page.getByRole('button', { name: 'Bass', exact: true }).click()
    await page.getByRole('button', { name: 'Piano keys' }).click()
    await expect(page.locator('.idle-hint')).toContainText('Bass staff')

    await page.locator('.exercise-idle-start').click()
    await expect(page.getByTestId('note-staff')).toHaveAttribute(
      'data-clef',
      'bass',
    )
    // An octave of keys: seven white ones, wider than they are apart.
    const keys = page
      .getByRole('group', { name: 'Name the note' })
      .getByRole('button')
    await expect(keys).toHaveCount(7)
    await answerNote(page, true)
    await expect(page.locator('.exercise-active-phase')).toHaveText(
      'Which note is this?',
      { timeout: 5000 },
    )
  })
})
