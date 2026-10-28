// ============================================================
// Karaoke Night: Merc's tour from an ad's landing (?tour=first)
// ============================================================
//
// Review focus 5: `/karaoke?tour=first` with the consent bar unanswered. The
// bar's buttons stay on top and clickable, and the tour starts under it. The
// e2e build mounts no consent banner (it configures no tag), so a stand-in
// plays its part (R22): the real one's markup, words, CSS and foot space, so
// it is as tall as the real one on a phone, with its dialog name and z-index.
// It proves the order of the layers, and the unit tests pin that an ad's tour
// waits for the real bar (start-karaoke-tour.test.ts).
//
// Then the tour itself, on a phone and a wide screen: three stops, 1 of 3 to
// 3 of 3, and between the last two a quiet wait through the song that draws
// nothing. The first bubble rings Sing this song; the singer's part after
// that (a sung note, the score card closing) is played by the coach's own
// events, by name (src/lib/coach-events.ts). Every ring holds its target,
// fits the window and leaves the bubble off it; the last stop rings Add a
// song on a wide screen, and on a phone the stage's Back, which it names,
// with the bubble centred off the stage's transport. A tap on Back turns the
// phone's stop to Add a song, scrolled into view and ringed. Done leaves nothing
// behind, the address has lost `tour`, and a reload offers nothing more: the
// offer was spent when the tour started.
//
// The wait through the song also ends the ways a singer ends a song: it
// plays out with the mic off (a wide screen, a short demo), or Back takes
// the phone stage away mid-song. Either brings the last stop, nothing sent
// by hand.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { localKaraokeDemo } from './helpers/karaoke-demo'

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
 * The stand-in consent bar: the real banner's markup and words, its module
 * CSS with the phone rule (max-width: 460px puts the buttons on a row of
 * their own, full width), its dialog name and z-index, and the foot space it
 * publishes on <html> while open: its height plus its gap to the foot, as
 * lib/foot-space.ts measures it. So it stands as tall as the real one, about
 * 158 px at 390x844 (src/components/ConsentBanner.tsx and .module.css).
 */
const CONSENT_CSS = `
.consent-stand-in{position:fixed;left:1rem;right:1rem;bottom:max(1rem,env(safe-area-inset-bottom),calc(var(--tabbar-space,0px) + 0.5rem));margin-inline:auto;max-width:640px;z-index:2147483000;display:flex;align-items:center;gap:.75rem 1.25rem;flex-wrap:wrap;justify-content:space-between;padding:.8rem 1rem;border-radius:.9rem;background:rgba(18,20,28,.92);color:#eef0f6;border:1px solid rgba(255,255,255,.14);font-family:inherit}
.consent-stand-in .copy{display:flex;align-items:flex-start;gap:.6rem;flex:1 1 260px;min-width:0}
.consent-stand-in .icon{flex-shrink:0;margin-top:.1rem}
.consent-stand-in .text{margin:0;font-size:.8rem;line-height:1.45;color:#c7cbe0}
.consent-stand-in .text strong{color:#eef0f6;font-weight:600}
.consent-stand-in .link{color:#8fa3ff;text-decoration:none;white-space:nowrap}
.consent-stand-in .actions{display:flex;gap:.5rem;flex-shrink:0;margin-left:auto}
.consent-stand-in .choice{min-height:44px;min-width:96px;padding:0 1.1rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#eef0f6;font-size:.85rem;font-weight:600;font-family:inherit}
@media (max-width:460px){.consent-stand-in .actions{width:100%}.consent-stand-in .choice{flex:1}}
`

const CONSENT_MARKUP =
  '<div class="copy"><svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"></svg>' +
  '<p class="text">We\'d like to use Google cookies to measure our ads and see how the site is used. ' +
  '<strong>Pitch detection runs on your device either way.</strong> ' +
  '<a class="link" href="#">Privacy&nbsp;Notice</a></p></div>' +
  '<div class="actions"><button type="button" class="choice">Decline</button>' +
  '<button type="button" class="choice">Accept</button></div>'

async function standInConsentBar(page: Page): Promise<void> {
  await page.addInitScript(
    ({ css, markup }) => {
      const mount = (): void => {
        const style = document.createElement('style')
        style.textContent = css
        document.head.append(style)
        const bar = document.createElement('section')
        bar.className = 'consent-stand-in'
        bar.setAttribute('role', 'dialog')
        bar.setAttribute('aria-label', 'Cookie consent')
        bar.setAttribute('aria-live', 'polite')
        bar.innerHTML = markup
        document.body.append(bar)
        const root = document.documentElement
        const publish = (): void => {
          const gap = Number.parseFloat(getComputedStyle(bar).bottom)
          const space = bar.offsetHeight + (Number.isFinite(gap) ? gap : 0)
          root.style.setProperty(
            '--consent-banner-space',
            `${Math.ceil(space)}px`,
          )
        }
        publish()
        const resized = new ResizeObserver(publish)
        resized.observe(bar)
        for (const button of bar.querySelectorAll('button')) {
          button.addEventListener('click', () => {
            resized.disconnect()
            bar.remove()
            root.style.removeProperty('--consent-banner-space')
          })
        }
      }
      if (document.body !== null) mount()
      else document.addEventListener('DOMContentLoaded', mount, { once: true })
    },
    { css: CONSENT_CSS, markup: CONSENT_MARKUP },
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
    await localKaraokeDemo(page)

    await page.goto('/karaoke?tour=first')

    // The tour starts under the bar, and the bar stays on top: a tap at the
    // middle of each of its buttons reaches that button.
    await expect(heading(page, 'Start with the demo')).toBeVisible({
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

    // 1 of 3: the first bubble rings Sing this song.
    const demo = page.locator('[data-tour="karaoke.demo"]')
    await ringsTarget(page, demo, screen)
    await expect(bubble(page)).toContainText('1 of 3')

    // Putting the demo on stage moves the tour on by itself.
    await demo.click()
    await expect(heading(page, 'Sing along')).toBeVisible({ timeout: 15_000 })
    const mic = page.locator(
      screen.phone ? '[data-tour="karaoke.mic"]' : '[data-tour="mixer.mic"]',
    )
    await ringsTarget(page, mic, screen)
    await expect(bubble(page)).toContainText('2 of 3')

    // The song has the stage: nothing of the coach is drawn until its score
    // card has closed.
    await singerDid(page, 'pitch-detected')
    await expect(bubble(page)).toHaveCount(0)
    await expect(ring(page)).toHaveCount(0)
    await expect(page.getByTestId('coach-layer').locator('*')).toHaveCount(0)

    await singerDid(page, 'score-closed')
    await expect(heading(page, 'Bring your own song')).toBeVisible()
    await expect(bubble(page)).toContainText('3 of 3')
    if (screen.phone) {
      // The phone stage covers the page, Add a song with it: the stop rings
      // the stage's Back, the way there, names it, and stands centred, off
      // the transport.
      await ringsTarget(
        page,
        page.locator('[data-tour="karaoke.stage-back"]'),
        screen,
      )
      await expect(bubble(page)).toContainText('Tap Back to add any song.')
      await expect(bubble(page)).toHaveAttribute('data-place', 'centre')

      // Back takes the stage away. Add a song was above the window: the stop
      // turns to it, scrolls it into view, rings it and docks off it.
      await page.locator('[data-tour="karaoke.stage-back"]').click()
      const own = page.locator('[data-tour="karaoke.own-song"]').first()
      const frame = { x: 0, y: 0, width: screen.width, height: screen.height }
      await expect
        .poll(async () => inside(await boxOf(own), frame), {
          message: 'Add a song is scrolled into the window',
        })
        .toBe(true)
      await ringsTarget(page, own, screen)
      await expect(bubble(page)).toContainText('Add any song.')
      await expect(bubble(page)).not.toContainText('Tap Back')
      await expect(bubble(page)).not.toHaveAttribute('data-place', 'centre')
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

    // A reload of the page the landing left behind (on a wide screen the
    // demo still on its stage) offers nothing more.
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
    await localKaraokeDemo(page)
    await page.goto('/karaoke-night')

    const chip = page.getByTestId('tour-chip')
    await expect(chip).toBeVisible()
    // Floating under the top bar and inside the window, over the page's free
    // room: tour-chip-floats.spec.ts holds that it moves and covers nothing.
    await expect(chip).toHaveAttribute('data-place', 'column')
    const top = await boxOf(page.locator('.kn-topbar'))
    const box = await boxOf(chip)
    expect(box.y).toBeGreaterThanOrEqual(top.y + top.height)
    expect(box.y + box.height).toBeLessThanOrEqual(screen.height)

    await chip.getByRole('button', { name: 'Sing the demo with Merc' }).click()
    await expect(chip).toHaveCount(0)
    await expect(heading(page, 'Start with the demo')).toBeVisible({
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

test('a song that plays out with the mic off ends the wait through it, at 1440x900 @smoke', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  // Eight seconds: the walk reaches the wait while it plays.
  await localKaraokeDemo(page, 8)
  await page.goto('/karaoke-night')
  await page
    .getByTestId('tour-chip')
    .getByRole('button', { name: 'Sing the demo with Merc' })
    .click()
  await expect(heading(page, 'Start with the demo')).toBeVisible({
    timeout: 15_000,
  })
  await page.locator('[data-tour="karaoke.demo"]').click()
  await expect(heading(page, 'Sing along')).toBeVisible({ timeout: 15_000 })
  await bubble(page).getByRole('button', { name: 'Skip this step' }).click()
  await expect(bubble(page)).toHaveCount(0)

  // Nothing is played for the singer here: the song reaches its end with no
  // score card to close, and the last stop shows.
  await expect(heading(page, 'Bring your own song')).toBeVisible({
    timeout: 20_000,
  })
  await expect(bubble(page)).toContainText('3 of 3')
  await ringsTarget(
    page,
    page.locator('[data-tour="karaoke.own-song"]').first(),
    { width: 1440, height: 900 },
  )
  expect(errors).toEqual([])
})

test('Back during the wait through the song brings the last stop at once, at 390x844 @smoke', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const screen = { width: 390, height: 844 }
  await page.setViewportSize(screen)
  await localKaraokeDemo(page)
  await page.goto('/karaoke-night')
  await page
    .getByTestId('tour-chip')
    .getByRole('button', { name: 'Sing the demo with Merc' })
    .click()
  await expect(heading(page, 'Start with the demo')).toBeVisible({
    timeout: 15_000,
  })
  await page.locator('[data-tour="karaoke.demo"]').click()
  await expect(heading(page, 'Sing along')).toBeVisible({ timeout: 15_000 })
  await bubble(page).getByRole('button', { name: 'Skip this step' }).click()
  await expect(bubble(page)).toHaveCount(0)

  // The singer leaves the stage mid-song, with no score card: the last stop
  // shows over the page, ringing Add a song, scrolled into the window.
  await page.locator('[data-tour="karaoke.stage-back"]').click()
  await expect(heading(page, 'Bring your own song')).toBeVisible()
  await expect(bubble(page)).toContainText('3 of 3')
  const own = page.locator('[data-tour="karaoke.own-song"]').first()
  const frame = { x: 0, y: 0, ...screen }
  await expect.poll(async () => inside(await boxOf(own), frame)).toBe(true)
  await ringsTarget(page, own, screen)
  await expect(bubble(page)).toContainText('Add any song.')
  expect(errors).toEqual([])
})

test('the vocal remover keeps its page to itself @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await localKaraokeDemo(page)
  await page.goto('/vocal-remover?tour=first')

  await expect(
    page.getByRole('heading', { name: 'Your stage is set' }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(new URL(page.url()).searchParams.has('tour')).toBe(false)
  await expect(page.getByTestId('tour-chip')).toHaveCount(0)
  await expect(page.getByTestId('coach-bubble')).toHaveCount(0)
})
