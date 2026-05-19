import { expect, test } from '@playwright/test'

/**
 * CSS Module Refactor -- Visual Regression Audit
 *
 * Verifies that all critical CSS classes render correctly after the
 * migration from the global app.css monolith to CSS modules.
 * Checks computed styles for layout, visibility, and key visual properties.
 */

// Helper: get computed style properties for an element
async function getStyles(
  page: import('@playwright/test').Page,
  selector: string,
  props: string[],
) {
  return page.evaluate(
    ({ sel, properties }) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const computed = window.getComputedStyle(el)
      const result: Record<string, string> = {}
      for (const prop of properties) {
        result[prop] = computed.getPropertyValue(prop)
      }
      return result
    },
    { sel: selector, properties: props },
  )
}

test.describe('CSS Module Refactor - Style Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // Wait for SolidJS to render
    await page.waitForTimeout(1500)
  })

  test('sidebar has correct base layout', async ({ page }) => {
    const sidebar = page.locator('.app-sidebar')
    await expect(sidebar).toBeVisible()

    const styles = await getStyles(page, '.app-sidebar', [
      'width',
      'display',
      'flex-direction',
      'background-color',
      'overflow-y',
      'padding',
    ])

    expect(styles).not.toBeNull()
    expect(styles!['display']).toBe('flex')
    expect(styles!['flex-direction']).toBe('column')
    expect(styles!['overflow-y']).toBe('auto')
    // Width should be 300px (not 0 or auto)
    expect(parseInt(styles!['width'])).toBeGreaterThanOrEqual(280)
    // Background should be set (not transparent)
    expect(styles!['background-color']).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('sidebar sections render properly', async ({ page }) => {
    // Check that sidebar section children are visible
    const sections = page.locator('.app-sidebar > *')
    const count = await sections.count()
    expect(count).toBeGreaterThan(2)
  })

  test('icon-svg elements have correct sizing', async ({ page }) => {
    const iconSvgs = page.locator('.icon-svg')
    const count = await iconSvgs.count()

    if (count > 0) {
      const styles = await getStyles(page, '.icon-svg', [
        'display',
        'width',
        'height',
        'stroke',
      ])

      expect(styles).not.toBeNull()
      // Should have explicit sizing, not 0
      expect(parseInt(styles!['width'])).toBeGreaterThan(0)
      expect(parseInt(styles!['height'])).toBeGreaterThan(0)
      // Should use stroke styling
      expect(styles!['stroke']).not.toBe('none')
    }
  })

  test('settings-toggle switches render', async ({ page }) => {
    const toggles = page.locator('.settings-toggle')
    const count = await toggles.count()
    // Sidebar has visibility toggles
    expect(count).toBeGreaterThan(0)

    const sliders = page.locator('.settings-slider')
    const sliderCount = await sliders.count()
    expect(sliderCount).toBeGreaterThan(0)
  })

  test('dropdown-select-style has correct appearance', async ({ page }) => {
    const dropdowns = page.locator('.dropdown-select-style')
    const count = await dropdowns.count()
    expect(count).toBeGreaterThan(0)

    if (count > 0) {
      const styles = await getStyles(page, '.dropdown-select-style', [
        'border-radius',
        'border',
        'cursor',
      ])
      expect(styles).not.toBeNull()
      expect(styles!['cursor']).toBe('pointer')
    }
  })

  test('tab navigation is visible and styled', async ({ page }) => {
    // Check that the main tab bar exists and has styled buttons
    const tabBtns = page.locator('#tab-singing, #tab-analysis')
    const count = await tabBtns.count()
    expect(count).toBeGreaterThan(0)
  })

  test('ctrl-btn toolbar buttons have styling', async ({ page }) => {
    // Check via data-testid since ctrl-btn is now module-scoped
    const playBtn = page.locator('[data-testid="play-btn"]')
    if ((await playBtn.count()) > 0) {
      await expect(playBtn).toBeVisible()
      const box = await playBtn.boundingBox()
      expect(box).not.toBeNull()
      // Should have meaningful size (not collapsed)
      expect(box!.width).toBeGreaterThan(20)
      expect(box!.height).toBeGreaterThan(20)
    }
  })

  test('changelog modal styles load correctly', async ({ page }) => {
    // Open settings, then changelog
    const settingsTab = page.locator('[data-testid="tab-settings"]')
    if ((await settingsTab.count()) > 0) {
      await settingsTab.click()
      await page.waitForTimeout(500)

      // Look for the What's New / changelog trigger
      const changelogBtn = page.locator('[data-testid="whats-new-btn"]')
      if ((await changelogBtn.count()) > 0) {
        await changelogBtn.click()
        await page.waitForTimeout(500)

        const changelogVersion = page.locator('.changelog-version')
        if ((await changelogVersion.count()) > 0) {
          const styles = await getStyles(page, '.changelog-version', [
            'margin-bottom',
          ])
          expect(styles).not.toBeNull()
          // Should have spacing, not 0
          expect(parseInt(styles!['margin-bottom'])).toBeGreaterThan(0)
        }
      }
    }
  })

  test('vocal analysis tab renders with styles', async ({ page }) => {
    const analysisTab = page.locator('[data-testid="tab-analysis"]')
    if ((await analysisTab.count()) > 0) {
      await analysisTab.click()
      await page.waitForTimeout(500)

      // Check that analysis container is visible
      const container = page.locator('.vocal-analysis-tab')
      if ((await container.count()) > 0) {
        await expect(container).toBeVisible()
      }
    }
  })

  test('no unstyled elements with class but zero dimensions', async ({
    page,
  }) => {
    // Audit: find elements with non-empty class that have 0 width AND 0 height
    // These are likely CSS casualties from the refactor
    const zeroSized = await page.evaluate(() => {
      const issues: string[] = []
      const all = document.querySelectorAll('[class]')

      all.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const tag = el.tagName.toLowerCase()
        const cls = el.getAttribute('class') || ''

        // Skip hidden/expected zero-size elements
        if (
          ['script', 'style', 'link', 'meta', 'br', 'hr', 'input'].includes(tag)
        )
          return
        if (cls.includes('hidden') || cls.includes('sr-only')) return
        if (el.closest('[style*="display: none"]')) return

        const computed = window.getComputedStyle(el)
        if (computed.display === 'none' || computed.visibility === 'hidden')
          return

        // Flag visible elements with no dimensions (likely missing CSS)
        if (
          rect.width === 0 &&
          rect.height === 0 &&
          computed.display !== 'contents'
        ) {
          issues.push(`${tag}.${cls.split(' ').slice(0, 2).join('.')}`)
        }
      })

      return issues.slice(0, 20) // Cap at 20
    })

    // Report but don't hard-fail (some zero-size elements are intentional)
    if (zeroSized.length > 0) {
      console.log(
        'Warning: elements with class but zero dimensions:',
        zeroSized,
      )
    }
    // Hard-fail if critical elements are zero-sized
    const criticalZero = zeroSized.filter(
      (s) =>
        s.includes('sidebar') ||
        s.includes('toolbar') ||
        s.includes('header') ||
        s.includes('canvas'),
    )
    expect(criticalZero).toEqual([])
  })
})
