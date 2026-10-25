// ============================================================
// Karaoke Night: Merc's tour from an ad's landing (?tour=first)
// ============================================================
//
// Review focus 5: `/karaoke?tour=first` with the consent bar unanswered. The
// bar's buttons stay on top and clickable, and the tour starts under it. The
// e2e build mounts no consent banner (it configures no tag), so a stand-in
// bar with the real one's dialog name, two buttons and z-index plays its part
// (R22): it proves the order of the layers, and the unit tests pin that an
// ad's tour waits for the real bar (start-karaoke-tour.test.ts).
//
// Then the tour itself, on a phone and a wide screen. The first bubble rings
// Sing this song; the singer's part after that (a sung note, the score) is
// played by the coach's own events, by name (src/lib/coach-events.ts). Every
// ring holds its target, fits the window and leaves the bubble off it; the
// last stop rings Add a song on a wide screen and stands free over the phone
// stage. Done leaves nothing behind, the address has lost `tour`, and a
// reload offers nothing more: the offer was spent when the tour started.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 2)

const SCREENS = [
  { name: 'phone', width: 390, height: 844, phone: true },
  { name: 'desktop', width: 1440, height: 900, phone: false },
] as const

const OFFER_KEY = 'pitchperfect_page_tour_offered_karaoke-night'

// Route the demo's audio in the page itself, not behind a worker's back.
test.use({ serviceWorkers: 'block' })

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const inside = (inner: Box, outer: Box, slack = 1): boolean =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not laid out')
  return box
}

/**
 * The stand-in consent bar: the real banner's dialog name, its two buttons,
 * its z-index, and the foot space it publishes on <html> while open.
 */
async function standInConsentBar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mount = (): void => {
      const bar = document.createElement('div')
      bar.setAttribute('role', 'dialog')
      bar.setAttribute('aria-label', 'Cookie consent')
      bar.style.cssText =
        'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;' +
        'display:flex;gap:8px;justify-content:flex-end;padding:12px;' +
        'background:#1b1426;color:#fff;border-radius:12px'
      for (const name of ['Decline', 'Accept']) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = name
        button.style.cssText = 'min-height:44px;min-width:88px'
        button.addEventListener('click', () => {
          bar.remove()
          document.documentElement.style.removeProperty(
            '--consent-banner-space',
          )
        })
        bar.append(button)
      }
      document.body.append(bar)
      document.documentElement.style.setProperty(
        '--consent-banner-space',
        `${bar.offsetHeight + 16}px`,
      )
    }
    if (document.body !== null) mount()
    else document.addEventListener('DOMContentLoaded', mount, { once: true })
  })
}

/**
 * The demo's stems and lyrics, served from here. Anything else asked of the
 * demo's bucket is refused, so no case reaches the real one.
 */
async function localDemo(page: Page): Promise<void> {
  await page.route('**/*.r2.dev/**', (route) => route.abort())
  await page.route('**/demo/**/*.m4a', (route) =>
    route.fulfill({ path: TONE_WAV, contentType: 'audio/wav' }),
  )
  await page.route('**/demo/**/lyrics.lrc', (route) =>
    route.fulfill({ body: '[00:00.50]Tour words', contentType: 'text/plain' }),
  )
}

/** Plays the singer's part: what the stage host tells a waiting tour. */
async function singerDid(page: Page, name: string): Promise<void> {
  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('mp:coach', { detail }))
  }, name)
}

const bubble = (page: Page) => page.getByTestId('coach-bubble')
const ring = (page: Page) => page.getByTestId('coach-ring')
const heading = (page: Page, name: string) =>
  bubble(page).getByRole('heading', { name })

/** The ring holds `target`, fits the window, and the bubble stays off it. */
async function ringsTarget(
  page: Page,
  target: Locator,
  viewport: { width: number; height: number },
): Promise<void> {
  await expect(ring(page)).toBeVisible()
  await expect
    .poll(async () => inside(await boxOf(target), await boxOf(ring(page))))
    .toBe(true)
  const held = await boxOf(target)
  expect(held.height).toBeLessThanOrEqual(viewport.height * 0.7)
  expect(overlaps(await boxOf(bubble(page)), held)).toBe(false)
  const shown = await boxOf(bubble(page))
  expect(shown.y).toBeGreaterThanOrEqual(0)
  expect(shown.y + shown.height).toBeLessThanOrEqual(viewport.height)
}

for (const screen of SCREENS) {
  test(`an ad's landing starts Merc's tour under the consent bar and walks it to your own song, at ${screen.width}x${screen.height} @smoke`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: screen.width, height: screen.height })
    await standInConsentBar(page)
    await localDemo(page)

    await page.goto('/karaoke?tour=first')

    // The tour starts under the bar, and the bar stays on top: a tap at the
    // middle of each of its buttons reaches that button.
    await expect(heading(page, 'Start with the demo song')).toBeVisible({
      timeout: 15_000,
    })
    const bar = page.getByRole('dialog', { name: 'Cookie consent' })
    for (const name of ['Decline', 'Accept']) {
      const button = bar.getByRole('button', { name })
      const box = await boxOf(button)
      const hit = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y)
          return el?.closest('[aria-label="Cookie consent"]') !== null
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      )
      expect(hit, name).toBe(true)
    }
    // The landing's `tour` has gone from the address.
    expect(new URL(page.url()).searchParams.has('tour')).toBe(false)

    await bar.getByRole('button', { name: 'Accept' }).click()
    await expect(bar).toHaveCount(0)

    // 1 of 4: the first bubble rings Sing this song.
    const demo = page.locator('[data-tour="karaoke.demo"]')
    await ringsTarget(page, demo, screen)
    await expect(bubble(page)).toContainText('1 of 4')

    // Putting the demo on stage moves the tour on by itself.
    await demo.click()
    await expect(heading(page, 'Sing along')).toBeVisible({ timeout: 15_000 })
    const mic = page.locator(
      screen.phone ? '[data-tour="karaoke.mic"]' : '[data-tour="mixer.mic"]',
    )
    await ringsTarget(page, mic, screen)

    await singerDid(page, 'pitch-detected')
    await expect(heading(page, 'Sing to the end')).toBeVisible()
    // Nothing to ring while the song plays: the bubble stands aside.
    await expect(ring(page)).toHaveCount(0)

    await singerDid(page, 'score-shown')
    await expect(heading(page, 'Bring your own song')).toBeVisible()
    await expect(bubble(page)).toContainText('4 of 4')
    if (screen.phone) {
      // The phone stage covers the page: the stop stands with no ring.
      await expect(ring(page)).toHaveCount(0)
    } else {
      await ringsTarget(
        page,
        page.locator('[data-tour="karaoke.own-song"]'),
        screen,
      )
    }

    await bubble(page).getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('#coach-root')).toHaveCount(0)
    expect(
      await page.evaluate((key) => localStorage.getItem(key), OFFER_KEY),
    ).toBe('true')

    // A reload of the page the landing left behind (the demo still on its
    // stage) offers nothing more.
    await page.reload()
    await expect(page.locator('.kn-topbar')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('tour-chip')).toHaveCount(0)
    await expect(page.getByTestId('coach-bubble')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

for (const screen of SCREENS) {
  test(`a first visit is offered the tour by a chip under the top bar, once, at ${screen.width}x${screen.height} @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: screen.width, height: screen.height })
    await localDemo(page)
    await page.goto('/karaoke-night')

    const chip = page.getByTestId('tour-chip')
    await expect(chip).toBeVisible()
    // In the page's flow: under the top bar, inside the window, and on a row
    // of its own, with the rail (and on a wide screen the stage) below it.
    const top = await boxOf(page.locator('.kn-topbar'))
    const box = await boxOf(chip)
    expect(box.y).toBeGreaterThanOrEqual(top.y + top.height)
    expect(box.y + box.height).toBeLessThanOrEqual(screen.height)
    const rail = await boxOf(page.locator('aside.kn-rail'))
    expect(rail.y).toBeGreaterThanOrEqual(box.y + box.height)

    await chip.getByRole('button', { name: /show you around/ }).click()
    await expect(chip).toHaveCount(0)
    await expect(heading(page, 'Start with the demo song')).toBeVisible({
      timeout: 15_000,
    })
    await bubble(page).getByRole('button', { name: 'End tour' }).click()
    await expect(page.locator('#coach-root')).toHaveCount(0)

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('tour-chip')).toHaveCount(0)
  })
}

test('the vocal remover keeps its page to itself @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await localDemo(page)
  await page.goto('/vocal-remover?tour=first')

  await expect(
    page.getByRole('heading', { name: 'Your stage is set' }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(new URL(page.url()).searchParams.has('tour')).toBe(false)
  await expect(page.getByTestId('tour-chip')).toHaveCount(0)
  await expect(page.getByTestId('coach-bubble')).toHaveCount(0)
})
