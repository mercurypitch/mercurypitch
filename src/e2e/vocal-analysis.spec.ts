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

  // ── Progressive depth ───────────────────────────────────────

  test('the pitch section is present before anything is sung', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')

    // A section that only materialises mid-song is one the user never learns
    // exists, so it renders with its own empty state instead.
    const trace = page.locator('[data-tour="analysis.trace"]')
    await expect(trace).toBeVisible({ timeout: 10000 })
    await expect(trace).toContainText('Pitch')
  })

  test('dense sections fold and unfold', async ({ page }) => {
    await switchTab(page, 'analysis')

    const toggle = page.locator('[data-collapsible="analysis_open_trace"]')
    await expect(toggle).toBeVisible({ timeout: 10000 })

    const before = await toggle.getAttribute('aria-expanded')
    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-expanded',
      before === 'true' ? 'false' : 'true',
    )

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', before ?? 'true')
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

    // The trace is drawn from recorded per-note durations, and says so rather
    // than implying a wall clock the data never had.
    const trace = page.locator('[data-tour="analysis.trace"]')
    await expect(trace).toBeVisible()
    await expect(trace).toContainText('note sequence')

    // Not supported — a practice record holds no waveform.
    await expect(page.locator('[data-tour="analysis.timbre"]')).toHaveCount(0)
    await expect(page.locator('[data-tour="analysis.spectrum"]')).toHaveCount(0)
  })

  // ── Switching takes must not rebuild the tab ────────────────────
  //
  // This tab is lazy-loaded inside a <Suspense>, and the note-analysis
  // resource was read with `notes()`. Calling a LOADING resource inside
  // that boundary re-suspends the whole tab, so picking a different take
  // unmounted the dashboard root, flashed the tab skeleton, and rebuilt
  // the page — "the page flicks and reloads". `.latest` keeps the last
  // value on screen instead.
  //
  // Asserted through the DOM rather than by eye: the dashboard root must
  // survive the click.
  test('picking a take does not remount the dashboard @smoke', async ({
    page,
  }) => {
    const seeded = await page.evaluate(() => {
      const pp = (window as unknown as { __pp?: Record<string, never> })
        .__pp as
        | { appStore?: { importUvrSession?: (s: unknown) => void } }
        | undefined
      if (!pp?.appStore?.importUvrSession) return false
      for (const n of [1, 2]) {
        pp.appStore.importUvrSession({
          sessionId: `flicker-${n}`,
          status: 'completed',
          progress: 100,
          createdAt: Date.now() - n * 100000,
          originalFile: {
            name: `song-${n}.mp3`,
            size: 1000,
            mimeType: 'audio/mpeg',
          },
          stemMeta: { vocal: { duration: 30 + n } },
          processingMode: 'local',
        })
      }
      return true
    })
    test.skip(!seeded, 'session store not exposed on window.__pp')

    // The seed lands before the tab mounts; switchTab renders the picker.
    await switchTab(page, 'analysis')
    await page.waitForTimeout(800)

    const take = page.locator('[data-testid^="take-uvr:"]').first()
    await expect(take).toBeVisible({ timeout: 10000 })

    // Watch for the tab SKELETON appearing. That element is the
    // <Suspense> fallback, so seeing it means the whole tab re-suspended
    // — the thing being guarded against. Checking that the root node
    // survives is not enough: it is re-added within the same tick, so a
    // poll after the fact sees it back in place and reports success.
    await page.evaluate(() => {
      const w = window as unknown as { __sawSkeleton?: boolean }
      w.__sawSkeleton = false
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType !== 1) return
            const cls = (n as HTMLElement).className
            if (typeof cls === 'string' && cls.includes('skeletonTabContent')) {
              w.__sawSkeleton = true
            }
          })
        }
      })
      obs.observe(document.body, { childList: true, subtree: true })
    })

    await take.click()
    await page.waitForTimeout(1500)

    const reSuspended = await page.evaluate(
      () => (window as unknown as { __sawSkeleton?: boolean }).__sawSkeleton,
    )
    expect(reSuspended).toBe(false)
  })
})
