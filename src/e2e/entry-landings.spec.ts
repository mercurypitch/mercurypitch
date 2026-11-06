// ============================================================
// Each search landing is a page of its own once the app is up
// ============================================================
//
// The SEO audit of 6 Nov 2026 rendered the landings the way a crawler that
// runs scripts does, and found two things. Once a room booted, the documents
// that share it read as copies of each other: /voice-type-test and
// /which-singer-has-my-vocal-range drew the Mirror's start screen word for
// word, /vocal-remover and /karaoke-app drew Karaoke Night's, and each
// document's own heading and questions were display:none. And First Light,
// the first-run welcome, took the screen on /ear-lab, /jam and
// /pitch-training for every first visit, crawlers included.
//
// Every test here is a fresh browser profile, as a first visit and a crawler
// are: nothing is seeded to skip the welcome.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { ENTRY_PAGES } from '../seo/entry-pages'
import { skipTheIntro } from './helpers/ui'

/** What each landing's room heads its page with, and the model behind it. */
const LANDINGS = [
  {
    path: '/mirror',
    slug: 'mirror',
    h1: 'Meet your voice twin.',
    foot: '.mirror-legal',
  },
  {
    path: '/vocal-range-test',
    slug: 'vocal-range-test',
    h1: 'Find your vocal range.',
    foot: '.mirror-legal',
  },
  {
    path: '/voice-type-test',
    slug: 'voice-type-test',
    h1: 'Find your voice type.',
    foot: '.mirror-legal',
  },
  {
    path: '/which-singer-has-my-vocal-range',
    slug: 'which-singer-has-my-vocal-range',
    h1: 'Which singer has your vocal range?',
    foot: '.mirror-legal',
  },
  {
    path: '/karaoke-night',
    slug: 'karaoke',
    h1: 'Your stage is set',
    foot: '.kn-footer',
  },
  {
    path: '/vocal-remover',
    slug: 'vocal-remover',
    h1: 'Vocal remover: take the voice out, keep the song',
    foot: '.kn-footer',
  },
  {
    path: '/karaoke-app',
    slug: 'karaoke-app',
    h1: 'A free karaoke app with lyrics and live scoring',
    foot: '.kn-footer',
  },
] as const

/**
 * Where the questions stand against the room's foot (`foot`, its legal row or
 * footer): above it, and is the foot what the page ends on, its lowest text?
 */
const footAfterQuestions = async (page: Page, foot: string) =>
  page.evaluate((selector) => {
    const faq = document.querySelector('.entry-faq')
    const end = document.querySelector(selector)
    let lowest: Node | null = null
    let bottom = -Infinity
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = texts.nextNode(); node !== null; node = texts.nextNode()) {
      if ((node.textContent ?? '').trim() === '') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.height === 0 || box.bottom + scrollY < bottom) continue
      bottom = box.bottom + scrollY
      lowest = node
    }
    return {
      questionsAboveFoot:
        faq !== null &&
        end !== null &&
        faq.getBoundingClientRect().bottom <= end.getBoundingClientRect().top,
      pageEndsOnFoot: end !== null && lowest !== null && end.contains(lowest),
    }
  }, foot)

/** First Light, by the name its dialog announces. */
const intro = (page: Page) =>
  page.getByRole('dialog', { name: 'Welcome to MercuryPitch' })

/** The page's headings at level 1 that a person or a crawler can see. */
const visibleH1s = async (page: Page): Promise<string[]> =>
  page
    .locator('h1')
    .filter({ visible: true })
    .evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
    )

test.describe('a landing once its room is up', () => {
  for (const landing of LANDINGS) {
    test(`${landing.path} heads its page with its own h1 and keeps its questions above the room's foot @smoke`, async ({
      page,
    }) => {
      const model = ENTRY_PAGES.find((entry) => entry.slug === landing.slug)
      expect(model?.faq?.length ?? 0).toBeGreaterThan(0)

      await page.goto(landing.path)
      await expect(
        page.getByRole('heading', { level: 1, name: landing.h1 }),
      ).toBeVisible()

      // One h1 a reader can see: the room's. The document's own stays in the
      // markup for a crawler that runs no script.
      expect(await visibleH1s(page)).toEqual([landing.h1])
      for (const item of model?.faq ?? []) {
        await expect(
          page.getByRole('heading', { level: 2, name: item.q }),
        ).toBeVisible()
      }
      // The room's own legal row or footer still closes the page, with the
      // questions above it: kept after #root, they drew under it, and the
      // page ended on an answer.
      expect(await footAfterQuestions(page, landing.foot)).toEqual({
        questionsAboveFoot: true,
        pageEndsOnFoot: true,
      })
    })
  }
})

test.describe('First Light on a first visit', () => {
  for (const { path, room } of [
    { path: '/ear-lab', room: '#ear-lab-panel' },
    { path: '/jam', room: '#jam-panel' },
    { path: '/pitch-training', room: '#exercises-panel' },
  ]) {
    test(`stays shut on ${path}, which opens its room @smoke`, async ({
      page,
    }) => {
      await page.goto(path)

      await expect(page.locator(room)).toBeVisible()
      // First Light is a lazy chunk opened from an effect: once the boot has
      // fetched everything, a welcome that was going to open has done so.
      await page.waitForLoadState('networkidle')
      await expect(intro(page)).toHaveCount(0)
    })
  }

  test('waits for the first visit to /, where it opens over the home page @smoke', async ({
    page,
  }) => {
    await page.goto('/ear-lab')
    await expect(page.locator('#ear-lab-panel')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(intro(page)).toHaveCount(0)

    await page.goto('/')

    await expect(intro(page)).toBeVisible()
  })

  test('leaves / its brand h1 under the welcome, and the greeting a paragraph', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(intro(page)).toBeVisible()

    // The home document's own h1, which names the site: rendered, out of
    // sight, while the welcome is up and after.
    const brand = page.locator('.entry-prelude h1')
    await expect(brand).toHaveText(/^MercuryPitch/)
    expect(
      await brand.evaluate((node) => getComputedStyle(node).display),
    ).not.toBe('none')
    expect(
      await brand.evaluate((node) => node.getBoundingClientRect().height),
    ).toBeGreaterThan(0)

    // Under the welcome, Home: its greeting is a paragraph, drawn as before.
    // It was the page's other visible h1.
    await skipTheIntro(page)
    await expect(
      page.locator('p', { hasText: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible()
    await expect(page.locator('h1', { hasText: /^Good / })).toHaveCount(0)
    await expect(brand).toHaveText(/^MercuryPitch/)
  })

  // The brand h1 is Home's heading. Every other screen the home document
  // serves heads itself, and there the kept h1 was a second subject and a
  // heading the coach could hand the focus back to, clipped to a pixel.
  test('counts the brand h1 while Home is the screen, and on no other @smoke', async ({
    page,
  }) => {
    const brand = page.getByRole('heading', {
      level: 1,
      name: /^MercuryPitch — /,
    })
    await page.goto('/')
    await skipTheIntro(page)
    await expect(brand).toHaveCount(1)

    await page.goto('/#/analysis')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Analysis' }),
    ).toBeVisible()
    await expect(brand).toHaveCount(0)

    await page.goto('/#/home')
    await expect(brand).toHaveCount(1)
  })
})
