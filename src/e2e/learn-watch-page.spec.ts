// ============================================================
// A lesson film's watch page, as built and served
// ============================================================
//
// Each published film has a page of its own, learn/NN/watch.html at
// /learn/NN/watch (src/features/lessons/kit/watch-pages.ts), so Search can
// list the film as a video. That needs the film to be the page's main
// content, so it is measured here where a visitor meets it: on a phone and
// on a desktop the title and the whole player sit on the first screen, and
// nothing scrolls sideways. The page's script adds the chapters and the
// transcript to it, and its ways to the lesson and back lead where they say.
//
// The film itself is never fetched: media.mercurypitch.com is production's
// bucket, so its requests are refused, and the video stays on its poster.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { watchPages } from '../../tools/draft-lessons'
import { watchPath } from '../features/lessons/kit/watch-pages'

const REPO = process.cwd()
const WATCHED = watchPages(REPO)

const SIZES = [
  { width: 390, height: 844, name: 'a phone' },
  { width: 1440, height: 900, name: 'a desktop' },
] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/** The film's chapters, as its lesson's assets hold them. */
function chapterCount(n: number): number {
  const file = resolve(
    REPO,
    `src/features/lessons/lesson-${pad(n)}/assets/chapters.json`,
  )
  return (JSON.parse(readFileSync(file, 'utf8')) as unknown[]).length
}

async function open(page: Page, n: number): Promise<void> {
  await page.route('https://media.mercurypitch.com/**', (route) =>
    route.abort(),
  )
  const response = await page.goto(watchPath(n))
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe(watchPath(n))
}

for (const n of WATCHED) {
  for (const size of SIZES) {
    test(`Lesson ${n}'s watch page puts its title and film on the first screen of ${size.name}`, async ({
      page,
    }) => {
      // Arrange
      await page.setViewportSize({ width: size.width, height: size.height })
      await open(page, n)

      // Act
      const at = await page.evaluate(() => {
        const box = (selector: string) => {
          const r = document.querySelector(selector)?.getBoundingClientRect()
          return r === undefined
            ? null
            : { top: r.top, bottom: r.bottom, width: r.width }
        }
        return {
          screen: window.innerHeight,
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          title: box('h1'),
          player: box('.player'),
        }
      })

      // Assert
      expect(at.scrollWidth, 'sideways scroll').toBeLessThanOrEqual(at.width)
      expect(at.title?.top ?? -1).toBeGreaterThanOrEqual(0)
      expect(at.player?.top ?? -1).toBeGreaterThan(at.title?.bottom ?? 0)
      expect(at.player?.bottom ?? Infinity).toBeLessThanOrEqual(at.screen)
      // the film fills the column on a phone, and most of it on a desktop
      expect(at.player?.width ?? 0).toBeGreaterThanOrEqual(
        size.width < 900 ? size.width - 40 : 700,
      )
    })
  }

  test(`Lesson ${n}'s watch page adds its chapters and transcript, and leads to the lesson`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, n)

    // Act + Assert: the script's chapters and transcript
    await expect(page.locator('#chapters button')).toHaveCount(chapterCount(n))
    await expect(page.locator('#tx p').first()).toBeAttached()
    const video = page.locator('video#ep')
    await expect(video).toHaveAttribute('controls', '')
    await expect(video).toHaveAttribute('preload', 'metadata')

    // the way to the lesson, and back from the lesson's hero
    await page
      .locator('.watch-about')
      .getByRole('link', { name: 'Take the lesson' })
      .click()
    await expect(page).toHaveURL(new RegExp(`/learn/${pad(n)}$`))
    const hero = page.locator('.hero-film a')
    await expect(hero).toContainText('Watch the film')
    await expect(hero).toHaveAttribute('href', watchPath(n))
    await hero.click()
    await expect(page).toHaveURL(new RegExp(`/learn/${pad(n)}/watch$`))
  })
}
