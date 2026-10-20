// ============================================================
// The first screen: every lesson's title at load, and where its opening sits
// ============================================================
//
// A lesson opens on one question the learner hears and sees at once
// (docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md § 3.1): its title, and
// the opening's first control, a Play or the predict's choices, belong on
// the first screen. Every lesson the e2e bundle carries is loaded at seven
// sizes, from a phone to a desktop, the four short landscape screens of
// learn-stage-fit.spec.ts among them:
//
// - the title is wholly on the first screen at load, which is held;
// - where the opening's first control and the predict's choices sit, in px
//   from the top of the page against the screen's height, is a report: each
//   test records it as an annotation (type "fold") and asserts nothing on
//   it. Enforcing it is a later decision, once the pages that miss it have
//   moved their opening up.
//
// The opening is the hero and, where a page has one, its cold-open section
// (`#cold`, Lesson 4's); a recall asked in the hero (Lesson 3's) is not part
// of it. Reduced motion lands every entrance at once, so the title is
// measured where it rests.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { lessonPages, lessonPath } from '../../tools/draft-lessons'

const REPO = fileURLToPath(new URL('../..', import.meta.url))

/** Every lesson page the e2e bundle carries: every build carries every one. */
const LESSONS = lessonPages(REPO)

/** Phones, tablets less their browser's bars, a laptop's window and a desktop. */
const SIZES = [
  { width: 390, height: 844, touch: true, name: 'a phone' },
  { width: 844, height: 390, touch: true, name: 'a phone held sideways' },
  {
    width: 1024,
    height: 640,
    touch: true,
    name: 'an iPad in Safari, tab bar shown',
  },
  { width: 1133, height: 631, touch: true, name: 'an iPad mini in Safari' },
  {
    width: 1280,
    height: 680,
    touch: true,
    name: 'an Android tablet in Chrome',
  },
  {
    width: 1366,
    height: 657,
    touch: false,
    name: "a 1366 x 768 laptop's window",
  },
  { width: 1440, height: 900, touch: false, name: 'a desktop' },
] as const

/** A box's top and bottom, px from the top of the page. */
interface Span {
  top: number
  bottom: number
}

interface Fold {
  /** The first screen's height, px. */
  screen: number
  /** How far the page had scrolled when measured: 0 at load. */
  scrolled: number
  title: Span | null
  /** The opening's highest Play or choice, the recall's left out. */
  first: (Span & { name: string }) | null
  /** The predict's choices, the first one's top to the last one's bottom. */
  choices: Span | null
}

/** Measures the title, the opening's first control and the predict's choices where they rest. */
function measureFold(): Fold {
  const shown = (el: Element): boolean =>
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden'
  const span = (el: Element): Span => {
    const r = el.getBoundingClientRect()
    return {
      top: Math.round(r.top + window.scrollY),
      bottom: Math.round(r.bottom + window.scrollY),
    }
  }
  const opening = [
    document.querySelector('main > section.hero'),
    document.querySelector('#cold'),
  ].filter((el): el is Element => el !== null)
  const controls = opening
    .flatMap((scope) =>
      Array.from(scope.querySelectorAll<HTMLButtonElement>('button')),
    )
    .filter(
      (b) =>
        shown(b) &&
        // Lesson 3 asks its recall in the hero: its Plays are the recall's
        b.closest('#recall') === null &&
        (b.dataset.choice !== undefined ||
          /^Play\b/.test(b.textContent?.trim() ?? '')),
    )
  // the one met first going down the page: a two-column hero can set a
  // later control higher than an earlier one
  const first = controls.reduce<HTMLButtonElement | undefined>(
    (top, b) =>
      top === undefined ||
      b.getBoundingClientRect().top < top.getBoundingClientRect().top
        ? b
        : top,
    undefined,
  )
  const choices = Array.from(
    document.querySelectorAll('#predict [data-choice]'),
  ).filter(shown)
  const title = document.querySelector('h1#hook')
  return {
    screen: window.innerHeight,
    scrolled: Math.round(window.scrollY),
    title: title === null ? null : span(title),
    first:
      first === undefined
        ? null
        : {
            ...span(first),
            name: (first.textContent ?? '').replace(/\s+/g, ' ').trim(),
          },
    choices:
      choices.length === 0
        ? null
        : {
            top: span(choices[0]).top,
            bottom: span(choices[choices.length - 1]).bottom,
          },
  }
}

/** Loads lesson `n` and waits until its module has run and its fonts have landed. */
async function load(page: Page, n: number): Promise<void> {
  await page.goto(lessonPath(n))
  // the season map draws near the end of the module's boot; its list of
  // rows is drawn at every width, where a phone hides the graph
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

/** Where a box sits against the first screen, in words for the report. */
function where(box: Span | null, screen: number): string {
  if (box === null) return 'none'
  const place =
    box.bottom <= screen
      ? 'on the first screen'
      : box.top < screen
        ? 'cut by its foot'
        : `${box.top - screen} px below it`
  return `${box.top} to ${box.bottom} px, ${place}`
}

test('the spec walks every lesson page, the drafts among them', () => {
  // later lessons join on their own; the first three are on main
  expect(LESSONS.slice(0, 3)).toEqual([1, 2, 3])
})

for (const size of SIZES) {
  test.describe(`at ${size.width} x ${size.height}, ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
      contextOptions: { reducedMotion: 'reduce' },
    })

    for (const n of LESSONS) {
      test(`Lesson ${n}: the title is on the first screen at load`, async ({
        page,
      }) => {
        // Arrange
        await load(page, n)

        // Act
        const fold = await page.evaluate(measureFold)
        test.info().annotations.push({
          type: 'fold',
          description: [
            `Lesson ${n} at ${size.width} x ${size.height}, a ${fold.screen} px first screen`,
            `title ${where(fold.title, fold.screen)}`,
            `first control ${fold.first === null ? 'none' : `"${fold.first.name}" ${where(fold.first, fold.screen)}`}`,
            `choices ${where(fold.choices, fold.screen)}`,
          ].join('; '),
        })

        // Assert: the page has not moved, and the whole title is on screen
        expect(fold.scrolled).toBe(0)
        expect(fold.title, `Lesson ${n}: a title`).not.toBeNull()
        expect(fold.title?.top ?? -1).toBeGreaterThanOrEqual(0)
        expect(
          fold.title?.bottom ?? Infinity,
          `Lesson ${n}: the title's foot against the ${fold.screen} px screen`,
        ).toBeLessThanOrEqual(fold.screen)
      })
    }
  })
}
