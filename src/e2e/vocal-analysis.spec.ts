// ============================================================
// Analysis Dashboard E2E Tests
//
// The page is one responsive dashboard now — no subtab bar, no
// history/live mode toggle, no viewport fork. What it must prove is that a
// take can be picked and that sections only appear when the selected take's
// data can support them.
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from '@/e2e/helpers/ui'

test.describe('Analysis Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // Analysis lives in the Advanced tab group.
    await page.evaluate(() => {
      const pp = (window as any).__pp
      if (pp?.appStore?.setAdvancedFeaturesEnabled) {
        pp.appStore.setAdvancedFeaturesEnabled(true)
      }
    })
  })

  // ── Page shell ──────────────────────────────────────────────

  test('navigates to the Analysis tab', async ({ page }) => {
    await switchTab(page, 'analysis')

    await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible({
      timeout: 10000,
    })
  })

  test('offers the live take first, selected by default', async ({ page }) => {
    await switchTab(page, 'analysis')

    const liveTake = page.getByTestId('take-live')
    await expect(liveTake).toBeVisible({ timeout: 10000 })
    await expect(liveTake).toHaveAttribute('aria-selected', 'true')
    await expect(liveTake).toContainText('Sing now')
  })

  test('shows no subtab bar — the lab tools are gone from this page', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')
    await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible({
      timeout: 10000,
    })

    await expect(
      page.getByRole('tab', { name: 'Pitch Detection' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('tab', { name: 'Pitch Algorithms' }),
    ).toHaveCount(0)
  })

  // ── Live take ───────────────────────────────────────────────

  test('live take exposes a start control', async ({ page }) => {
    await switchTab(page, 'analysis')

    const start = page.getByTestId('live-start')
    await expect(start).toBeVisible({ timeout: 10000 })
    await expect(start).toBeEnabled()
  })

  test('does not show timbre readings before anything is captured', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')
    await expect(page.getByTestId('live-start')).toBeVisible({ timeout: 10000 })

    // The old page rendered these cards permanently, filled with numbers
    // derived from note metadata. They must not appear without real audio.
    await expect(page.locator('[data-tour="analysis.timbre"]')).toHaveCount(0)
  })

  // ── Progress ────────────────────────────────────────────────

  test('progress section renders with an honest empty state', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')

    const trends = page.locator('[data-tour="analysis.trends"]')
    await expect(trends).toBeVisible({ timeout: 10000 })
    await expect(trends).toContainText('Progress')
    // No sessions yet → zeros, not a fabricated streak.
    await expect(trends).toContainText('Current streak')
  })

  // ── Capability gating ───────────────────────────────────────

  test('a practice take shows scores but no spectral sections', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')
    await expect(page.getByTestId('take-live')).toBeVisible({ timeout: 10000 })

    // Seed one practice session directly into the store.
    const seeded = await page.evaluate(() => {
      const pp = (window as any).__pp
      const setResults = pp?.appStore?.setSessionResults
      if (typeof setResults !== 'function') return false
      setResults([
        {
          sessionId: 'e2e-session',
          name: 'E2E Warmup',
          sessionName: 'E2E Warmup',
          score: 82,
          itemsCompleted: 2,
          completedAt: Date.now(),
          practiceItemResult: [
            {
              score: 82,
              noteCount: 2,
              avgCents: 10,
              itemsCompleted: 2,
              name: 'E2E Warmup',
              mode: 'once',
              completedAt: Date.now(),
              noteResult: [
                {
                  item: {
                    id: 1,
                    note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
                    duration: 1,
                    startBeat: 0,
                  },
                  pitchFreq: 261.63,
                  pitchCents: 8,
                  time: 500,
                  rating: 'good',
                  avgCents: 8,
                  targetNote: 'C4',
                },
                {
                  item: {
                    id: 2,
                    note: { midi: 67, name: 'G', octave: 4, freq: 392 },
                    duration: 1,
                    startBeat: 1,
                  },
                  pitchFreq: 392,
                  pitchCents: -12,
                  time: 500,
                  rating: 'good',
                  avgCents: -12,
                  targetNote: 'G4',
                },
              ],
            },
          ],
        },
      ])
      return true
    })

    test.skip(!seeded, 'session store not exposed on window.__pp')

    const practiceTake = page.getByTestId('take-practice:e2e-session')
    await expect(practiceTake).toBeVisible({ timeout: 10000 })
    await expect(practiceTake).toContainText('Scores only')

    await practiceTake.click()

    // Supported by note results.
    const overview = page.locator('[data-tour="analysis.overview"]')
    await expect(overview).toBeVisible({ timeout: 5000 })
    await expect(overview).toContainText('C4–G4')
    await expect(page.locator('[data-tour="analysis.tuning"]')).toBeVisible()

    // Not supported — a practice record holds no waveform.
    await expect(page.locator('[data-tour="analysis.timbre"]')).toHaveCount(0)
  })
})
