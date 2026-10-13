// UI audit regressions exercise focus, readable tabs, and pointer hit targets in the real app.

import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { FRESH_VISITOR_INIT } from './helpers/tone-wav'

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

async function returningVisitor(page: Page) {
  await page.addInitScript((appVersion) => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_welcome_version', appVersion)
    localStorage.setItem('pitchperfect_focus_mode', 'false')
  }, version)
}

async function arriveByKeyboard(page: Page, target: Locator) {
  // Establish a nearby starting point, then leave and return through the
  // browser's actual tab order. A programmatic focus alone does not establish
  // keyboard modality and can miss :focus-visible regressions.
  await target.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(target).not.toBeFocused()
  await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

async function expectFocusRing(target: Locator) {
  // Auto-retry until border/outline transitions settle, including Firefox.
  await expect(target).toHaveCSS('outline-style', 'solid')
  await expect(target).toHaveCSS('outline-width', '2px')
  await expect(target).toHaveCSS('outline-offset', '2px')
  const accent = await target.evaluate((element) => {
    const style = document.createElement('span').style
    style.color = getComputedStyle(element).getPropertyValue('--accent')
    return style.color
  })
  expect(accent).not.toBe('')
  await expect(target).toHaveCSS('border-top-color', accent)
  await expect(target).toHaveCSS('outline-color', accent)
}

test('settings select has a visible keyboard focus ring', async ({ page }) => {
  await returningVisitor(page)
  await page.goto('/#/settings/practice')
  const algorithm = page.locator('#pitch-algorithm-select')
  await expect(algorithm).toBeVisible()
  await arriveByKeyboard(page, algorithm)
  await expectFocusRing(algorithm)
  await page.keyboard.press('Tab')
  await expect(algorithm).not.toBeFocused()
  await expect(algorithm).toHaveCSS('outline-style', 'none')
})

test('keyboard focus on the upload input visibly outlines its upload zone', async ({
  page,
}) => {
  await returningVisitor(page)
  await page.goto('/#/karaoke')
  await page.getByTestId('uvr-tab-upload').click()
  const input = page.locator('#uvr-file-input')
  const zone = page.locator('.upload-zone', { has: input })
  await expect(input).toBeEnabled()
  await arriveByKeyboard(page, input)
  await expectFocusRing(zone)
  await page.keyboard.press('Tab')
  await expect(input).not.toBeFocused()
  await expect(zone).toHaveCSS('outline-style', 'none')
})

test('native settings controls use the selected app font', async ({ page }) => {
  await returningVisitor(page)
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_font', 'outfit')
  })
  await page.goto('/#/settings/practice')
  const algorithm = page.locator('#pitch-algorithm-select')
  await expect(algorithm).toBeVisible()
  const bodyFont = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).fontFamily)
  expect(bodyFont.toLowerCase()).toContain('outfit')
  await expect(algorithm).toHaveCSS('font-family', bodyFont)
  await expect(page.locator('#set-min-confidence')).toHaveCSS(
    'font-family',
    bodyFont,
  )
})

test.describe('phone controls', () => {
  test.use({
    viewport: { width: 320, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('Community labels and counts remain complete at 200 percent text size', async ({
    page,
  }) => {
    await returningVisitor(page)
    await page.addInitScript(() => {
      const shared = (count: number, kind: string) =>
        Array.from({ length: count }, (_, index) => ({
          id: `ui-audit-${kind}-${index}`,
          name: `Shared ${kind} ${index + 1}`,
          author: 'UI audit fixture',
          date: 1_700_000_000_000 + index,
          items: [
            {
              id: 1,
              note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
              duration: 1,
              startBeat: 0,
            },
          ],
          results: [80],
        }))
      localStorage.setItem(
        'pp_shared_melodies',
        JSON.stringify(shared(23, 'melody')),
      )
      localStorage.setItem(
        'pp_shared_sessions',
        JSON.stringify(shared(12, 'session')),
      )
    })
    await page.goto('/#/community')
    const tabs = page.locator('.community-share-tab .community-tabs')
    await expect(tabs.locator('.tab-name')).toHaveText([
      'Melodies',
      'Sessions',
      'Profile',
    ])
    await expect(tabs.locator('.community-tab-count')).toHaveText(['23', '12'])
    await page.evaluate(() => document.fonts.ready.then(() => undefined))

    const normalSize = await tabs
      .locator('.tab-name')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
    // Text-only enlargement changes rem-based type without enlarging the
    // viewport; each label must fit rather than being silently ellipsized.
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    expect(
      await tabs
        .locator('.tab-name')
        .first()
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBe(normalSize * 2)

    const layout = await tabs.evaluate((element) => {
      const track = element.getBoundingClientRect()
      return [...element.querySelectorAll<HTMLElement>('.community-tab')].map(
        (tab) => {
          const button = tab.getBoundingClientRect()
          return {
            insideTrack:
              button.left >= track.left && button.right <= track.right,
            text: [
              ...tab.querySelectorAll<HTMLElement>(
                '.tab-name, .community-tab-count',
              ),
            ].map((label) => {
              const rect = label.getBoundingClientRect()
              return {
                text: label.textContent,
                unclipped: label.scrollWidth <= label.clientWidth + 1,
                insideButton:
                  rect.left >= button.left &&
                  rect.right <= button.right &&
                  rect.top >= button.top &&
                  rect.bottom <= button.bottom,
              }
            }),
          }
        },
      )
    })
    expect(layout).toHaveLength(3)
    for (const tab of layout) {
      expect(tab.insideTrack).toBe(true)
      for (const label of tab.text) {
        expect(label.unclipped, `${label.text} should not be ellipsized`).toBe(
          true,
        )
        expect(label.insideButton, `${label.text} should fit its button`).toBe(
          true,
        )
      }
    }
    await tabs.getByRole('button', { name: 'Sessions 12', exact: true }).tap()
    await expect(
      page.getByText('Shared session 1', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })

  test('song menu accepts taps across a 44 pixel target @smoke', async ({
    page,
  }) => {
    await returningVisitor(page)
    await page.goto('/')
    await page.waitForFunction(() => window.__pp?.appStore !== undefined)
    await page.evaluate(async () => {
      const store = window.__pp?.appStore as unknown as {
        initSessionStore: () => Promise<void>
        importUvrSessionDurable: (
          session: Record<string, unknown>,
        ) => Promise<void>
      }
      await store.initSessionStore()
      await store.importUvrSessionDurable({
        sessionId: 'ui-audit-song-target',
        status: 'completed',
        progress: 100,
        originalFile: { name: 'UI audit song', size: 0, mimeType: 'audio/wav' },
        // A valid one-sample silent WAV. This test opens actions, not playback.
        outputs: {
          vocal:
            'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAAAAAA==',
        },
        processingMode: 'server',
        provider: 'examples',
        createdAt: Date.now(),
      })
    })
    await page.goto('/#/karaoke')
    const card = page
      .locator('.uvr-session-result')
      .filter({ hasText: 'UI audit song' })
    const menu = card.getByRole('button', {
      name: 'More actions for this song',
    })
    await expect(menu).toBeVisible()
    await menu.scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
    ).toBe(true)
    const box = await menu.boundingBox()
    expect(box).not.toBeNull()
    if (box === null) throw new Error('Song menu has no hit target')
    // Tap all four edges of a 44px square, outside the visible 32px icon.
    for (const [dx, dy] of [
      [-21, 0],
      [21, 0],
      [0, -21],
      [0, 21],
    ]) {
      await page.touchscreen.tap(
        box.x + box.width / 2 + dx,
        box.y + box.height / 2 + dy,
      )
      await expect(menu).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByRole('menu')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveAttribute('aria-expanded', 'false')
    }
  })
})

test('onboarding button stays hovered and clickable at its bottom edge @smoke', async ({
  page,
}) => {
  await page.addInitScript(FRESH_VISITOR_INIT)
  await page.goto('/')
  const button = page.getByRole('button', {
    name: 'Sing one note',
    exact: true,
  })
  await expect(button).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  // Let the finite entry animation finish before measuring the resting edge.
  await button.evaluate(async (element) => {
    for (
      let node: Element | null = element;
      node !== null;
      node = node.parentElement
    ) {
      await Promise.all(
        node
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished),
      )
    }
  })
  const box = await button.boundingBox()
  if (box === null) throw new Error('Onboarding action has no hit target')
  const point = { x: box.x + box.width / 2, y: box.y + box.height - 0.25 }
  await page.mouse.move(point.x, point.y)
  const samples = await button.evaluate(async (element, hit) => {
    const observations: boolean[] = []
    // Several transition durations: losing hover even once reproduces the
    // original bottom-edge oscillation instead of only checking a CSS rule.
    for (let frame = 0; frame < 40; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      observations.push(
        element.matches(':hover') &&
          element.contains(document.elementFromPoint(hit.x, hit.y)),
      )
    }
    return observations
  }, point)
  expect(samples).toHaveLength(40)
  expect(samples.every(Boolean)).toBe(true)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.locator('[data-beat="first-light"]')).toBeVisible()
})
