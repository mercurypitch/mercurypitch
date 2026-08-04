// ============================================================
// First Light onboarding — end-to-end
// ============================================================
//
// Covers the paths a real visitor walks on their first load, at both a
// desktop and a phone viewport. See docs/plans/onboarding-first-light.md.
//
// This file runs WITHOUT a microphone, which is what makes the
// silent-input case here meaningful: `voice-session` rejects a dead
// stream on purpose, so the flow must route such a visitor onward
// rather than strand them. The beats that need audio live in
// onboarding-mic.spec.ts, driven by a generated tone.

import { expect, test } from '@playwright/test'
import { FRESH_VISITOR_INIT } from './helpers/tone-wav'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

const beat = (page: import('@playwright/test').Page, name: string) =>
  page.locator(`[data-beat="${name}"]`)

test.describe('First Light onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
  })

  test('a fresh visitor lands on beat 1, not a door and not a settings dialog', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    // No welcome card in front of the flow — it was beat 1 twice.
    await expect(beat(page, 'sky')).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: 'Show me around' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Sing one note' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Skip .* take me in/ }),
    ).toBeVisible()
    // The terms line moved here with the door, and has to be on screen
    // before anything is measured.
    await expect(beat(page, 'sky')).toContainText(/Terms of Use/)

    // The questions this screen used to ask before showing any value.
    // If any of these come back, the regression is the whole point of
    // the redesign being undone.
    await expect(page.getByText('Enable Mic')).toHaveCount(0)
    await expect(page.getByText(/Select your singing voice range/)).toHaveCount(
      0,
    )
    await expect(page.getByText(/Choose your accuracy level/)).toHaveCount(0)
  })

  test('a silent input is not treated as a working microphone', async ({
    page,
  }) => {
    // No fake-audio file in this block, so the stream is silent. The probe
    // must reject it rather than run the whole script against a dead mic,
    // and the visitor must still be offered a way onward.
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sing one note' }).click()
    await expect(beat(page, 'first-light')).toBeVisible()

    const micAsk = page.getByRole('button', { name: 'Allow microphone' })
    await expect(micAsk).toBeVisible()
    await micAsk.click()

    const onward = page.getByRole('button', {
      name: /Continue without the mic/,
    })
    await expect(onward).toBeVisible({ timeout: 20000 })
    await onward.click()

    // Refusing the mic makes every beat except the Map inapplicable, so
    // one advance lands there — the fork is deliberately never offered
    // to someone we cannot hear.
    await expect(beat(page, 'map')).toBeVisible({ timeout: 10000 })
    await expect(beat(page, 'fork')).toHaveCount(0)
  })

  test('the Map recommends a first stop with a reason, not a bare label', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.evaluate(() => {
      ;(
        window as unknown as { __startOnboarding?: () => void }
      ).__startOnboarding?.()
    })
    await page.goto('/#/map')

    const map = beat(page, 'map')
    await expect(map).toBeVisible({ timeout: 10000 })

    // With no voiceprint the fallback is Practice, and it must carry the
    // reason line — a recommendation without one reads as a guess.
    const first = map.locator('[data-room="practice"]')
    await expect(first).toBeVisible()
    await expect(first).toContainText(/Start here/)

    // Every room is present and clickable, not just the recommended one.
    for (const room of [
      'practice',
      'exercises',
      'ascent',
      'karaoke',
      'jam',
      'analysis',
    ]) {
      await expect(map.locator(`[data-room="${room}"]`)).toBeVisible()
    }
  })

  test('skipping at beat 1 sticks across a reload', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: /Skip .* take me in/ }).click()
    await expect(page.locator('#app-tabs')).toBeVisible()

    await page.reload()
    await expect(page.locator('#app-tabs')).toBeVisible({ timeout: 10000 })
    // The flow must not come back — that bug (keying the seen-flag off
    // APP_VERSION) is what this redesign fixed.
    await expect(beat(page, 'sky')).toHaveCount(0)
  })

  test('Settings can reopen the intro after onboarding is finished', async ({
    page,
  }) => {
    // Regression: the door was gated on `isFirstRun()` as well as its own
    // flag, so once onboarding had been finished or skipped the Settings
    // action was a dead button — it set `showWelcome` and nothing
    // happened. The real fix was to make `finishOnboarding` spend
    // `welcomeSeen`, so the extra gate is not needed at all.
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.getByRole('button', { name: /Skip .* take me in/ }).click()
    await expect(page.locator('#app-tabs')).toBeVisible()
    await expect(beat(page, 'sky')).toHaveCount(0)

    await page.goto('/#/settings/account')
    const replay = page.getByRole('button', { name: 'Replay the intro' })
    await expect(replay).toBeVisible({ timeout: 10000 })
    await replay.click()

    await expect(beat(page, 'sky')).toBeVisible()
  })

  test('the Map replay does not rewind the seen-flag', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.getByRole('button', { name: /Skip .* take me in/ }).click()
    await expect(page.locator('#app-tabs')).toBeVisible()

    await page.goto('/#/map')
    await expect(beat(page, 'map')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Done|Start singing/ }).click()

    await page.goto('/')
    await expect(page.locator('#app-tabs')).toBeVisible({ timeout: 10000 })
    await expect(beat(page, 'sky')).toHaveCount(0)
  })

  test('the flow fits a phone without sideways scroll', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/')

    await expect(beat(page, 'sky')).toBeVisible()

    // The page body must never scroll horizontally — the single most
    // common phone-layout failure, and invisible on a desktop run.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows).toBe(false)

    // The primary action has to be reachable without hunting for it.
    const cta = page.getByRole('button', { name: 'Sing one note' })
    await expect(cta).toBeVisible()
    const box = await cta.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeLessThan(PHONE.height)
  })

  test('the Map collapses to one column on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/')
    await page.goto('/#/map')

    const map = beat(page, 'map')
    await expect(map).toBeVisible({ timeout: 10000 })

    const cards = map.locator('[data-room]')
    await expect(cards.first()).toBeVisible()

    // One column: every card shares the same left edge.
    const lefts = await cards.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    )
    expect(new Set(lefts).size).toBe(1)

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflows).toBe(false)
  })

  test('reduced motion still reaches the Map', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await expect(beat(page, 'sky')).toBeVisible()

    // Beats must be fully opaque immediately — under reduced motion the
    // entrance animation is replaced by an instant state, so a visitor
    // must never be left looking at a half-faded screen.
    const opacity = await beat(page, 'sky').evaluate(
      (el) => getComputedStyle(el).opacity,
    )
    expect(Number(opacity)).toBe(1)

    await page.goto('/#/map')
    await expect(beat(page, 'map')).toBeVisible({ timeout: 10000 })
  })
})
