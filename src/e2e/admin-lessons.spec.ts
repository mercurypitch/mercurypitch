// ============================================================
// Admin lessons — publish, unpublish and the wording, in a real browser
// ============================================================
//
// The Content Studio's Lessons page at a phone's width and a desktop's,
// driven by keyboard and pointer. The studio is unlocked as the other admin
// specs unlock it, with E2E_TEST_MODE and a placeholder key, so no real
// credential is used. The lesson-state API is a stand-in answered in the
// page (page.route) that keeps state and logs as the db-worker does; the
// site the page checks is this bundle as `serve` hands it out.

import type { Locator, Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

const ADMIN_KEY = 'e2e-admin-key'
const AT = '2026-10-20T14:02:00.000Z'
const FOLLOWS = 'The site follows within about a minute.'

/** The first lesson the kit gives an alternative hook, and that hook: Lesson 3's as the season stands. */
const [VARIED, VARIED_HOOK] = (() => {
  for (const [n, copy] of Object.entries(LESSON_COPY)) {
    const alt = copy?.hookAlts?.[0]
    if (alt !== undefined) return [Number(n), alt] as const
  }
  throw new Error('no lesson in lesson-copy.ts has an alternative hook')
})()

const VIEWPORTS = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
] as const

type Field = 'published' | 'hook' | 'tease'
type Value = boolean | string | null
type Override = Partial<Record<Field, Value>>

interface LessonApi {
  readonly lessons: Record<string, Override>
  /** Every save the page sent, in order. */
  readonly saves: { n: number; body: unknown }[]
}

const FIELDS: readonly Field[] = ['published', 'hook', 'tease']

/** Answer the lesson-state API in the page, as the db-worker would. */
async function serveLessonApi(
  page: Page,
  seed: Record<string, Override> = {},
): Promise<LessonApi> {
  const api: LessonApi = { lessons: structuredClone(seed), saves: [] }
  const log: Record<string, unknown>[] = Object.entries(seed).flatMap(
    ([lesson, override], i) =>
      FIELDS.filter((field) => override[field] !== undefined).map((field) => ({
        id: i + 1,
        lesson: Number(lesson),
        field,
        oldValue: null,
        newValue: override[field],
        changedAt: AT,
        changedBy: 'owner@example',
      })),
  )
  const rowOf = (n: number) => {
    const override = api.lessons[String(n)]
    if (override === undefined) return null
    return {
      lesson: n,
      published: override.published ?? null,
      hook: override.hook ?? null,
      tease: override.tease ?? null,
      updatedAt: AT,
      updatedBy: 'owner@example',
    }
  }
  const save = (n: number, patch: Override): Field[] => {
    const current: Override = { ...api.lessons[String(n)] }
    const changed = FIELDS.filter(
      (field) =>
        patch[field] !== undefined && patch[field] !== (current[field] ?? null),
    )
    for (const field of changed) {
      log.unshift({
        id: log.length + 1,
        lesson: n,
        field,
        oldValue: current[field] ?? null,
        newValue: patch[field],
        changedAt: AT,
        changedBy: 'owner@example',
      })
      if (patch[field] === null) delete current[field]
      else current[field] = patch[field]
    }
    if (Object.keys(current).length === 0) delete api.lessons[String(n)]
    else api.lessons[String(n)] = current
    return changed
  }

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    if (pathname === '/api/lessons/state') {
      await route.fulfill({
        json: { version: 1, updatedAt: AT, lessons: api.lessons },
      })
      return
    }
    if (request.headers()['x-admin-key'] !== ADMIN_KEY) {
      await route.fulfill({
        status: 403,
        json: { error: 'Admin key required' },
      })
      return
    }
    if (pathname === '/api/admin/lessons/log') {
      const n = Number(searchParams.get('lesson'))
      await route.fulfill({
        json: { changes: log.filter((change) => change.lesson === n) },
      })
      return
    }
    const lesson = /^\/api\/admin\/lessons\/(\d+)$/.exec(pathname)
    if (lesson !== null && request.method() === 'PUT') {
      const n = Number(lesson[1])
      const body = request.postDataJSON() as Override
      api.saves.push({ n, body })
      const changed = save(n, body)
      await route.fulfill({ json: { row: rowOf(n), changed } })
      return
    }
    await route.fulfill({ status: 404, json: { error: 'Not found' } })
  })
  return api
}

async function openLessonsPage(page: Page): Promise<Locator> {
  await page.addInitScript((key: string) => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_admin_key', key)
    localStorage.setItem('pitchperfect_welcome_version', '1')
  }, ADMIN_KEY)
  await page.goto('/#/admin/lessons')
  const lessons = page.getByTestId('admin-lessons')
  await expect(lessons.getByText(/^Lesson state read at/)).toBeVisible()
  return lessons
}

/** Lesson `n`'s row in the season table. */
const rowOf = (lessons: Locator, n: number): Locator =>
  lessons.locator(`tr[data-lesson="${n}"]`)

/** Lesson `n`'s card. */
const cardOf = (lessons: Locator, n: number): Locator =>
  lessons.locator(`details[data-lesson="${n}"]`)

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function expectTouchSize(control: Locator): Promise<void> {
  const box = await control.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
}

// Route requests in the page itself, not behind a service worker's back.
test.use({ serviceWorkers: 'block' })

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`the Lessons page on a ${name}`, () => {
    test.use({ viewport })

    test('unpublishes and publishes a lesson from its row by keyboard, saying who set it', async ({
      page,
    }) => {
      const api = await serveLessonApi(page)
      const lessons = await openLessonsPage(page)
      const row = rowOf(lessons, 1)
      // One switch whose words follow the state: found by either name.
      const toggle = row.getByRole('button', {
        name: /^(Unpublish|Publish) Lesson 1$/,
      })
      await expect(toggle).toHaveAccessibleName('Unpublish Lesson 1')

      await expectTouchSize(toggle)
      await toggle.focus()
      await page.keyboard.press('Enter')

      await expect(row).toContainText(
        `Lesson 1 is unpublished here. ${FOLLOWS}`,
      )
      await expect(row).toContainText(
        'Set here by owner@example, Oct 20, 2:02 PM',
      )
      await expect(toggle).toHaveAccessibleName('Publish Lesson 1')
      await expect(toggle).toBeFocused()
      await expect(lessons.getByRole('status')).toHaveText(
        `Lesson 1 is unpublished here. ${FOLLOWS}`,
      )

      await page.keyboard.press('Enter')

      await expect(toggle).toHaveAccessibleName('Unpublish Lesson 1')
      expect(api.saves).toEqual([
        { n: 1, body: { published: false } },
        { n: 1, body: { published: true } },
      ])
      await expectNoSidewaysScroll(page)
    })

    test('asks before publishing a draft early, and gives the focus back when the owner backs out', async ({
      page,
    }) => {
      const api = await serveLessonApi(page, { '3': { published: false } })
      const lessons = await openLessonsPage(page)
      const toggle = rowOf(lessons, 3).getByRole('button', {
        name: /^(Unpublish|Publish) Lesson 3$/,
      })
      await expect(toggle).toHaveAccessibleName('Publish Lesson 3')
      await expect(rowOf(lessons, 3)).toContainText('Set here by owner@example')

      await toggle.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('alertdialog', {
        name: 'Publish Lesson 3 before its sign-off?',
      })
      await expect(dialog).toHaveAccessibleDescription(
        /^Lesson 3 waits on .+\. Publish it anyway\?$/,
      )
      await page.keyboard.press('Escape')

      await expect(dialog).toBeHidden()
      await expect(toggle).toBeFocused()
      expect(api.saves).toEqual([])

      await toggle.click()
      await dialog.getByRole('button', { name: 'Publish anyway' }).click()

      await expect(toggle).toHaveAccessibleName('Unpublish Lesson 3')
      await expect(toggle).toBeFocused()
      expect(api.saves).toEqual([{ n: 3, body: { published: true } }])
    })

    test("puts a lesson back to the code's default from its card, and says what that is", async ({
      page,
    }) => {
      const api = await serveLessonApi(page, { '1': { published: false } })
      const lessons = await openLessonsPage(page)
      await rowOf(lessons, 1).getByRole('rowheader').getByRole('button').click()
      const panel = cardOf(lessons, 1).getByRole('region', {
        name: 'On this site',
      })
      const useDefault = panel.getByRole('button', {
        name: 'Use default for Lesson 1',
      })
      await expect(useDefault).toHaveAccessibleDescription(
        'The default here is published: it is released in code.',
      )
      await expect(panel).toContainText(
        'Unpublished by owner@example, Oct 20, 2:02 PM',
      )
      await expectTouchSize(useDefault)

      await useDefault.focus()
      await page.keyboard.press('Enter')

      await expect(panel).toContainText(
        `Lesson 1 is back to the default here: published. ${FOLLOWS}`,
      )
      await expect(useDefault).toBeHidden()
      await expect(
        panel.getByRole('button', { name: 'Unpublish Lesson 1' }),
      ).toBeFocused()
      expect(api.saves).toEqual([{ n: 1, body: { published: null } }])
      await expectNoSidewaysScroll(page)
    })

    test("offers a lesson's hooks from the kit, and saves the one chosen by keyboard", async ({
      page,
    }) => {
      const api = await serveLessonApi(page)
      const lessons = await openLessonsPage(page)
      await rowOf(lessons, VARIED)
        .getByRole('rowheader')
        .getByRole('button')
        .click()
      const hook = cardOf(lessons, VARIED).getByRole('group', { name: 'Hook' })
      const byDefault = hook.getByRole('button', {
        name: new RegExp(`^Lesson ${VARIED} hook: .+ Default$`),
      })
      const variant = hook.getByRole('button', {
        name: `Lesson ${VARIED} hook: ${VARIED_HOOK.text}`,
        exact: true,
      })
      await expect(byDefault).toHaveAttribute('aria-pressed', 'true')
      await expect(variant).toHaveAccessibleDescription(VARIED_HOOK.note)
      await expectTouchSize(variant)

      await variant.focus()
      await page.keyboard.press('Space')

      await expect(variant).toHaveAttribute('aria-pressed', 'true')
      await expect(variant).toBeFocused()
      await expect(hook).toContainText(
        `Lesson ${VARIED}'s hook is now “${VARIED_HOOK.id}”. ${FOLLOWS}`,
      )

      await byDefault.click()

      await expect(byDefault).toHaveAttribute('aria-pressed', 'true')
      expect(api.saves).toEqual([
        { n: VARIED, body: { hook: VARIED_HOOK.id } },
        { n: VARIED, body: { hook: null } },
      ])
      await expectNoSidewaysScroll(page)
    })

    test('flags a hook this build does not hold, and puts the default back', async ({
      page,
    }) => {
      // Lesson 2's code holds one hook, so clearing the unknown one leaves nothing to pick.
      expect(LESSON_COPY[2]?.hookAlts ?? []).toHaveLength(0)
      const api = await serveLessonApi(page, { '2': { hook: 'gone' } })
      const lessons = await openLessonsPage(page)
      await rowOf(lessons, 2).getByRole('rowheader').getByRole('button').click()
      const hook = cardOf(lessons, 2).getByRole('group', { name: 'Hook' })
      await expect(hook).toContainText('Saved here as “gone”')
      const choice = hook.getByRole('button', { name: /^Lesson 2 hook:/ })
      await expectTouchSize(choice)

      await choice.click()

      await expect(cardOf(lessons, 2)).toContainText(
        `Lesson 2's hook is back to the default. ${FOLLOWS}`,
      )
      await expect(hook).toBeHidden()
      expect(api.saves).toEqual([{ n: 2, body: { hook: null } }])
    })
  })
}
