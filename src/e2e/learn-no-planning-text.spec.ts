// ============================================================
// No lesson page shows a learner the team's planning words
// ============================================================
//
// The season's planning fields (season.ts: a lesson's signature image, the
// link its drill still needs, a film made but not published) stay in the
// data for the team and the admin console, and so does the note that says
// why each hook or tease variant exists (kit/lesson-copy.ts). A page a
// learner reads says only what they can do now: Ready, Coming later, Done.
// Each lesson page this bundle carries is read the way a learner meets it,
// after its script has run: every word of the document, every label a
// screen reader speaks, every lesson's explorer card, opened from the map in
// turn, and the season in the masthead's lesson menu, which is drawn as it
// opens.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { lessonPages, lessonPath } from '../../tools/draft-lessons'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

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

/** Why each hook or tease variant exists: the team's note, never a learner's words. */
const NOTES: readonly string[] = Object.values(LESSON_COPY).flatMap((c) =>
  [...(c?.hookAlts ?? []), ...(c?.teaseAlts ?? [])].map((v) => v.note),
)

/** What no reader meets. */
const LEFT_OUT = 'script, style, template, noscript'

// every build carries every lesson page, and the e2e bundle shows the drafts
// (`build:e2e`), so each page lists every lesson written
const LESSONS = lessonPages(process.cwd())

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

/** Each planning word and each variant's note found in `text`, with the words around it. */
function planningIn(text: string, where: string): string[] {
  const flat = text.replace(/\s+/g, ' ')
  const words = PLANNING.flatMap((word) => {
    const at = flat.search(word)
    return at < 0
      ? []
      : [`${where}: …${flat.slice(Math.max(0, at - 50), at + 50)}…`]
  })
  const notes = NOTES.filter((note) => flat.includes(note)).map(
    (note) => `${where}: a variant's note, "${note}"`,
  )
  return [...words, ...notes]
}

test("the guard knows every variant's note", () => {
  // a note is a whole sentence, so a page can only show one by drawing it
  expect(NOTES.length).toBeGreaterThan(0)
  for (const note of NOTES) expect(note).toMatch(/^\S.{20,}$/)
})

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
