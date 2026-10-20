// ============================================================
// No lesson page shows a learner the team's planning words
// ============================================================
//
// The season's planning fields (season.ts: a lesson's signature image, the
// link its drill still needs, a film made but not published) stay in the
// data for the team and the admin console. A page a learner reads says only
// what they can do now: Ready, Coming later, Done.
// Each lesson page this bundle carries is read the way a learner meets it,
// after its script has run: every word of the document, every label a
// screen reader speaks, every lesson's explorer card, opened from the map in
// turn, and the season in the masthead's lesson menu, which is drawn as it
// opens.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { builtLessons, lessonPath } from '../../tools/draft-lessons'

/** The team's words, each a sign that planning has reached a learner's screen. */
const PLANNING: readonly RegExp[] = [
  /\bSignature\b/,
  /deep link/i,
  /\bslug\b/i,
  /\bin production\b/i,
  /\bplanned\b/i,
  /durationSec/,
  /launch field/i,
  /placeholder/i,
  /proof episode/i,
  /Written lesson,/,
  /still rendering/i,
  /one a week after launch/i,
  /for the team/i,
  /\bblueprint\b/i,
  // a topic's code (T01, S05) in place of its name
  /\b[TS]\d\d\b/,
]

/** What no reader meets. */
const LEFT_OUT = 'script, style, template, noscript'

// the e2e bundle shows drafts (`build:e2e`), so it carries every lesson page
const LESSONS = builtLessons(process.cwd(), true)

/** What a learner can read or hear inside `scope`: its text and its labels. */
function learnerText(page: Page, scope: string): Promise<string> {
  return page.evaluate(
    ([at, skip]) => {
      const root = document.querySelector(at)
      if (root === null) return ''
      const copy = root.cloneNode(true) as Element
      copy.querySelectorAll(skip).forEach((el) => el.remove())
      const labels = Array.from(
        copy.querySelectorAll('[aria-label], [alt], [title]'),
      ).flatMap((el) =>
        ['aria-label', 'alt', 'title'].map((a) => el.getAttribute(a) ?? ''),
      )
      return [copy.textContent ?? '', ...labels].join('\n')
    },
    [scope, LEFT_OUT] as const,
  )
}

/** Each planning word found in `text`, with the words around it. */
function planningIn(text: string, where: string): string[] {
  const flat = text.replace(/\s+/g, ' ')
  return PLANNING.flatMap((word) => {
    const at = flat.search(word)
    return at < 0
      ? []
      : [`${where}: …${flat.slice(Math.max(0, at - 50), at + 50)}…`]
  })
}

for (const n of LESSONS) {
  test(`Lesson ${n}'s page shows a learner none of the team's planning words`, async ({
    page,
  }) => {
    // Arrange: every move lands at once
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(lessonPath(n))
    const map = page.locator('#graph .node')
    await expect(map).toHaveCount(15)
    const found = planningIn(await learnerText(page, 'body'), 'the page')

    // Act: open every lesson's card from the map, then the lesson menu
    for (let i = 0; i < 15; i += 1) {
      await map.nth(i).click()
      const card = page.locator('#exCardHost .ex-card')
      await expect(card).toBeVisible()
      const name = (await map.nth(i).getAttribute('aria-label')) ?? `${i}`
      found.push(...planningIn(await learnerText(page, '#exCardHost'), name))
    }
    await page.getByRole('button', { name: /: all lessons$/ }).click()
    await expect(page.locator('#lessonMenu .lm-row').first()).toBeVisible()
    found.push(
      ...planningIn(await learnerText(page, '#lessonMenu'), 'the lesson menu'),
    )

    // Assert
    expect(found).toEqual([])
  })
}
