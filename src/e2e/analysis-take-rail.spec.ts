// ============================================================
// Analysis take rail — the card list holds its own shape.
// ============================================================
//
// Two regressions, one rule set, and the second was caused by the fix for
// the first — which is why both ends are pinned here rather than eyeballed.
//
//   Phone: the rail caps its height and scrolls. Its cards are flex items,
//   so without `flex-shrink: 0` the cap squeezed them instead — down to the
//   44px touch-target floor, where the title collapsed to nothing and the
//   badge pills painted outside the border, over the card below.
//
//   Desktop: the first fix for that was `contain: inline-size` on the rail,
//   which stopped a long song title inflating the page by making the rail
//   contribute nothing to its parent's max-content width. Above 720px the
//   rail IS the widest thing on the page, so .page shrank to the width of
//   its subtitle: a 416px column on a 1280px screen.
//
// Both are invisible to a smoke test that only asks whether the page
// rendered, so this measures painted boxes.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

/** Enough takes to overflow the phone rail's height cap several times over. */
const SEEDED_TAKES = 8

/**
 * A practice history, written before the app boots. Practice takes are the
 * cheapest real take to make: no audio, no IndexedDB, same card as a song.
 */
function seedPracticeHistory(count: number): void {
  const now = Date.now()
  const sessions = Array.from({ length: count }, (_, i) => ({
    sessionId: `e2e-take-${i}`,
    name: `Practice run ${i + 1}`,
    sessionName: `Practice run ${i + 1}`,
    score: 70 + i,
    totalItems: 1,
    itemsCompleted: 1,
    completedAt: now - i * 86_400_000,
    avgCents: 8,
    rating: 'good',
    practiceItemResult: [
      {
        itemIndex: 0,
        score: 70 + i,
        noteResult: [
          {
            expectedMidi: 60,
            detectedMidi: 60,
            centsOff: 4,
            accuracy: 92,
            rating: 'good',
          },
        ],
      },
    ],
  }))
  localStorage.setItem('pitchperfect_session_history', JSON.stringify(sessions))
}

async function openAnalysis(page: import('@playwright/test').Page) {
  await page.addInitScript(seedPracticeHistory, SEEDED_TAKES)
  await page.goto('/#/analysis')
  await dismissOverlays(page)
  await expect(page.locator('[data-testid^="take-"]').first()).toBeVisible()
}

test.describe('Analysis take rail — phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a capped rail scrolls instead of crushing its cards @smoke', async ({
    page,
  }) => {
    await openAnalysis(page)

    const measured = await page
      .locator('[role="listbox"][aria-label="Analysis takes"]')
      .evaluate((rail) => {
        const cards = Array.from(
          rail.querySelectorAll<HTMLElement>('[data-testid^="take-"]'),
        )
        return {
          cardCount: cards.length,
          railClientHeight: rail.clientHeight,
          railScrollHeight: rail.scrollHeight,
          railOverflowY: getComputedStyle(rail).overflowY,
          cards: cards.map((card) => {
            const box = card.getBoundingClientRect()
            // How far any descendant paints outside the card's border box.
            // The pills were the visible symptom; the date line went too.
            let escape = 0
            for (const kid of card.querySelectorAll('span')) {
              const k = kid.getBoundingClientRect()
              if (k.width === 0 && k.height === 0) continue
              escape = Math.max(
                escape,
                k.bottom - box.bottom,
                box.top - k.top,
                k.right - box.right,
                box.left - k.left,
              )
            }
            return {
              id: card.dataset.testid ?? '',
              // Content taller than the box is the squeeze itself, measured
              // before it has a chance to paint anywhere.
              contentOverflow: card.scrollHeight - card.clientHeight,
              escape,
            }
          }),
        }
      })

    // Guard on the guard: with few enough takes to fit the cap there is
    // nothing to shrink, and every assertion below would pass while
    // proving nothing.
    expect(measured.cardCount).toBeGreaterThan(SEEDED_TAKES - 1)
    expect(measured.railScrollHeight).toBeGreaterThan(measured.railClientHeight)
    expect(measured.railOverflowY).toBe('auto')

    // The actual assertions. Sub-pixel layout rounding is real; the bug
    // was 21px of content hanging out of every card on the page.
    for (const card of measured.cards) {
      expect(
        card.contentOverflow,
        `${card.id} content is taller than its box`,
      ).toBeLessThanOrEqual(1)
      expect(
        card.escape,
        `${card.id} paints outside its border`,
      ).toBeLessThanOrEqual(0.5)
    }
  })
})

test.describe('Analysis take rail — desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('the page is sized by its container, not by its own text', async ({
    page,
  }) => {
    await openAnalysis(page)

    const measured = await page
      .locator('[role="listbox"][aria-label="Analysis takes"]')
      .evaluate((rail) => {
        const pageEl = rail.closest<HTMLElement>('[class*="page"]')!
        const parent = pageEl.parentElement!
        const parentStyle = getComputedStyle(parent)
        const available =
          parent.clientWidth -
          parseFloat(parentStyle.paddingLeft) -
          parseFloat(parentStyle.paddingRight)
        // Read the cap off the element rather than hard-coding 960px, so
        // this still measures the right thing if the page is re-tuned.
        const cap = parseFloat(getComputedStyle(pageEl).maxWidth)

        const tops = new Set<number>()
        const cards = rail.querySelectorAll<HTMLElement>(
          '[data-testid^="take-"]',
        )
        for (const card of cards) {
          tops.add(Math.round(card.getBoundingClientRect().top))
        }
        return {
          cardCount: cards.length,
          rowCount: tops.size,
          pageWidth: pageEl.getBoundingClientRect().width,
          expectedWidth: Math.min(
            Number.isNaN(cap) ? available : cap,
            available,
          ),
        }
      })

    // Filling the space it is given — the collapsed page was 416px of a
    // 960px allowance, and nothing about the page said so out loud.
    expect(measured.pageWidth).toBeGreaterThanOrEqual(
      measured.expectedWidth - 1,
    )

    // ...which is what lets the wide-screen rail be a wrapping grid at all.
    // One row per card is the shape the collapse produced.
    expect(measured.cardCount).toBeGreaterThan(1)
    expect(measured.rowCount).toBeLessThan(measured.cardCount)
  })
})
