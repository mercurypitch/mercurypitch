// ============================================================
// Home's plan card comes back: the X, Undo, a reload, Settings, new answers
// ============================================================
//
// The X on Home's "Your plan" hides the card for the plan it shows, on this
// device, and a toast says where the plan still is, with Undo. These walks
// hold that to a real browser, at a phone and a wide screen:
//
// - The X hides the card, the toast says where the plan is, and Undo puts the
//   card back where it was, with the focus on its X.
// - Hidden, it stays hidden after a reload, and Settings' Show on Home brings
//   it back for the next time Home draws.
// - The card's Change my answers opens the four questions with the answers
//   given picked; with one changed, Home's card is the new plan.
// - Answering again after a hide (from Settings) brings the card back.
// - Settings offers the four questions to someone with no answered plan, and
//   a Not now on them after a hide, which holds no answers, keeps the ask
//   hidden until Show on Home.
// - Each new control takes a press of its own: 44 px under a touch screen.
//
// Each walk keeps a screenshot of what it checked under test-results. The plan
// is seeded answered and dated now (helpers/plan-seed.ts), so its card is in
// its week, and the visit is a returning one, so no intro or takeover covers
// Home.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { buildPlan, planStops } from '@/features/plan/build-plan'
import type { PlanRecordV1 } from '@/features/plan/plan-record'
import { bringToMiddle, hitArea, neighbourAreas, sharePress, } from './helpers/hit-area'
import { thisWeeksPlanSeed } from './helpers/plan-seed'

const VIEWPORTS = [
  {
    name: 'phone',
    use: {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
    least: 44,
  },
  {
    name: 'desktop',
    use: { viewport: { width: 1440, height: 900 } },
    least: 24,
  },
] as const

interface Visit {
  version: string
  key: string
  value: string
}

/**
 * A singer who has met First Light, is on Home, and answered the plan this
 * week. The record is planted only on the first load, so a reload, or an
 * answer given since, keeps what the page wrote.
 */
function seedVisit(visit: Visit): void {
  ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
  localStorage.setItem('pitchperfect_welcome_version', visit.version)
  localStorage.setItem('pitchperfect_onboarding_done', '1')
  localStorage.setItem('pitchperfect_focus_mode', 'false')
  if (localStorage.getItem(visit.key) === null) {
    localStorage.setItem('pitchperfect_active_tab', 'home')
    localStorage.setItem(visit.key, visit.value)
  }
}

async function openHome(page: Page): Promise<void> {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
  const seed = thisWeeksPlanSeed(new Date().toISOString())
  await page.addInitScript(seedVisit, { version: pkg.version, ...seed })
  await page.goto('/#/home')
  await expect(card(page)).toBeVisible()
}

const card = (page: Page) => page.getByTestId('home-plan-card')
const hide = (page: Page) =>
  card(page).getByRole('button', { name: 'Hide your plan' })
const toast = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Your plan is off Home.' })
const layer = (page: Page) => page.getByRole('dialog', { name: 'Your plan' })
const settingsPlan = (page: Page) => page.getByTestId('settings-plan')

/** The stops the card draws, by destination, in its order. */
const cardStops = async (page: Page): Promise<string[]> =>
  card(page)
    .locator('[data-dest]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-dest')!))

/** The plan record as the page stored it. */
const storedRecord = async (page: Page): Promise<PlanRecordV1> =>
  page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem('pitchperfect_plan_v1') ?? 'null',
      ) as PlanRecordV1,
  )

/** The stops a record's plan has, for the whole menu, as the card builds them. */
const stopsOf = (record: PlanRecordV1): string[] =>
  planStops(buildPlan(record.choices, { voiceprint: record.voiceprint })).map(
    (stop) => stop.dest,
  )

/** Where an element stands on the page, not in the window: a scroll does not move it. */
const placeOf = async (target: Locator) =>
  target.evaluate((element) => {
    const r = element.getBoundingClientRect()
    return {
      left: Math.round(r.left + window.scrollX),
      top: Math.round(r.top + window.scrollY),
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  })

/** The height the card kept for Home's slot, as stored; null before it has kept one. */
const keptSlotHeight = async (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const kept = JSON.parse(
      localStorage.getItem('mp.plan.card.slot.v1') ?? 'null',
    ) as { h: number } | null
    return kept?.h ?? null
  })

/** The height an element is drawn at. */
const drawnHeight = async (target: Locator): Promise<number> =>
  target.evaluate((element) => element.getBoundingClientRect().height)

/** A control's press, and whether it shares any of it with a neighbour's. */
async function pressOf(control: Locator) {
  await bringToMiddle(control)
  const area = await hitArea(control)
  const neighbours = await neighbourAreas(control)
  return {
    area,
    shared: neighbours.some((other) => sharePress(area.rect, other.rect)),
  }
}

async function toSettings(page: Page): Promise<void> {
  await page.goto('/#/settings/account')
  await expect(settingsPlan(page)).toBeVisible()
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: false,
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`at ${vp.use.viewport.width}x${vp.use.viewport.height}`, () => {
    test.use(vp.use)

    test('the X hides the card with a toast, and Undo puts it back with the focus on its X', async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      await card(page)
        .getByRole('button', { name: 'Change my answers' })
        .scrollIntoViewIfNeeded()
      await shoot(page, `card-${vp.name}`)
      const before = await placeOf(card(page))
      // Home's slot for the card's next load holds its whole height, the
      // new button with it.
      await expect
        .poll(async () => keptSlotHeight(page))
        .toBe(await drawnHeight(card(page)))

      // Act
      await hide(page).click()
      await expect(card(page)).toBeHidden()
      await expect(toast(page)).toBeVisible()
      await shoot(page, `toast-${vp.name}`)
      await toast(page).getByRole('button', { name: 'Undo' }).click()

      // Assert
      await expect(card(page)).toBeVisible()
      await expect(hide(page)).toBeFocused()
      await expect(toast(page)).toBeHidden()
      expect(await placeOf(card(page))).toEqual(before)
      expect(
        await page.evaluate(() =>
          localStorage.getItem('mp.plan.card.dismissed.v1'),
        ),
      ).toBeNull()
    })

    test('hidden, it stays hidden after a reload, and Show on Home in Settings brings it back', async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      await hide(page).click()
      await page.reload()
      await expect(page.locator('.home-session-card')).toBeVisible()
      await expect(card(page)).toBeHidden()
      await toSettings(page)
      const showOnHome = settingsPlan(page).getByRole('button', {
        name: 'Show on Home',
      })
      await showOnHome.scrollIntoViewIfNeeded()
      await shoot(page, `settings-hidden-${vp.name}`)

      // Act
      await showOnHome.click()
      await page.goto('/#/home')

      // Assert
      await expect(card(page)).toBeVisible()
      await expect(showOnHome).toBeHidden()
    })

    test('Change my answers opens the questions with the answers picked, and new answers give Home a new plan', async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      const first = await storedRecord(page)
      expect(await cardStops(page)).toEqual(stopsOf(first))

      // Act
      await card(page)
        .getByRole('button', { name: 'Change my answers' })
        .click()
      await expect(layer(page)).toBeVisible()
      await expect(layer(page).getByText('Question 1 of 4')).toBeVisible()
      await expect(
        layer(page).getByRole('button', { name: 'Singing', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      await layer(page).getByRole('button', { name: 'Guitar' }).click()
      await expect(layer(page).getByText('Question 2 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-quiet').click()
      await expect(layer(page).getByText('Question 3 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-next').click()
      await expect(layer(page).getByText('Question 4 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-next').click()
      await expect(
        layer(page).locator('[data-beat="questions"]'),
      ).toHaveAttribute('data-phase', 'plan')
      await layer(page).getByRole('button', { name: 'Not now' }).click()

      // Assert
      await expect(layer(page)).toBeHidden()
      const second = await storedRecord(page)
      expect(second.choices.q1).toBe('guitar')
      expect(second.at).not.toBe(first.at)
      await expect(card(page)).toBeVisible()
      expect(await cardStops(page)).toEqual(stopsOf(second))
      expect(stopsOf(second)).not.toEqual(stopsOf(first))
    })

    test('answering again after a hide brings the card back', async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      await hide(page).click()
      await toSettings(page)
      await settingsPlan(page)
        .getByRole('button', { name: 'Change my answers' })
        .click()
      await expect(layer(page).getByText('Question 1 of 4')).toBeVisible()

      // Act
      await layer(page).getByTestId('plan-quiet').click()
      await expect(layer(page).getByText('Question 2 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-quiet').click()
      await expect(layer(page).getByText('Question 3 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-next').click()
      await expect(layer(page).getByText('Question 4 of 4')).toBeVisible()
      await layer(page).getByTestId('plan-next').click()
      await expect(
        layer(page).locator('[data-beat="questions"]'),
      ).toHaveAttribute('data-phase', 'plan')
      await layer(page).getByRole('button', { name: 'Not now' }).click()

      // Assert
      await expect(card(page)).toBeVisible()
      expect(
        await page.evaluate(() =>
          localStorage.getItem('mp.plan.card.dismissed.v1'),
        ),
      ).toBeNull()
    })

    test('Settings offers the four questions to someone with no answered plan', async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      await page.evaluate(() => {
        localStorage.setItem(
          'pitchperfect_plan_v1',
          JSON.stringify({
            v: 1,
            status: 'declined',
            choices: { q1: null, q2: null, q3: [], q4: [] },
            at: new Date().toISOString(),
            via: 'layer',
          }),
        )
      })
      await page.reload()

      // Act
      await toSettings(page)
      const answer = settingsPlan(page).getByRole('button', {
        name: 'Answer the four questions',
      })
      await answer.scrollIntoViewIfNeeded()
      await shoot(page, `settings-ask-${vp.name}`)
      await answer.click()

      // Assert
      await expect(layer(page).getByText('Question 1 of 4')).toBeVisible()
    })

    test('a hidden ask stays hidden after Not now on the four questions, until Show on Home', async ({
      page,
    }) => {
      // Arrange: the plan turned down a minute ago, and its ask hidden.
      await openHome(page)
      await page.evaluate(() => {
        localStorage.setItem(
          'pitchperfect_plan_v1',
          JSON.stringify({
            v: 1,
            status: 'declined',
            choices: { q1: null, q2: null, q3: [], q4: [] },
            at: new Date(Date.now() - 60_000).toISOString(),
            via: 'layer',
          }),
        )
      })
      await page.reload()
      await hide(page).click()
      await expect(card(page)).toBeHidden()
      const first = await storedRecord(page)

      // Act: the four questions from Settings, and Not now on the first.
      await toSettings(page)
      await settingsPlan(page)
        .getByRole('button', { name: 'Answer the four questions' })
        .click()
      await expect(layer(page).getByText('Question 1 of 4')).toBeVisible()
      await layer(page).getByRole('button', { name: 'Not now' }).click()

      // Assert: a new Not now, which holds no answers, so the ask is still
      // hidden, and Settings still offers it back.
      await expect(layer(page)).toBeHidden()
      const second = await storedRecord(page)
      expect(second.status).toBe('declined')
      expect(second.at).not.toBe(first.at)
      await toSettings(page)
      await settingsPlan(page)
        .getByRole('button', { name: 'Show on Home' })
        .click()
      await page.goto('/#/home')
      await expect(card(page)).toBeVisible()
    })

    test(`each new control takes a ${vp.least} px press of its own`, async ({
      page,
    }) => {
      // Arrange
      await openHome(page)
      const change = card(page).getByRole('button', {
        name: 'Change my answers',
      })
      const onCard = await pressOf(change)
      await hide(page).click()
      await toSettings(page)

      // Act
      const inSettings = []
      for (const name of ['See my plan', 'Change my answers', 'Show on Home']) {
        inSettings.push(
          await pressOf(settingsPlan(page).getByRole('button', { name })),
        )
      }

      // Assert
      for (const { area, shared } of [onCard, ...inSettings]) {
        expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
        expect(area.ownsItsBox).toBe(true)
        expect(shared).toBe(false)
      }
    })
  })
}
