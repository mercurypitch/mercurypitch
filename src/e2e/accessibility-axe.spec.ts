// ============================================================
// axe-core over the screens a singer passes through, as a ratchet
// ============================================================
//
// docs/accessibility-audit-2026-10.md is the audit this guards. axe sees only
// part of what stops a blind singer -- the lyrics, focus and announcement
// findings there need specs of their own -- but what it does see should only
// get better. Each screen's violations are counted rule by rule and compared
// with accessibility-axe.baseline.json: a new rule, or more nodes for a known
// one, fails; fewer passes. After a fix, lower the baseline with:
//
//   AXE_UPDATE_BASELINE=1 pnpm exec playwright test \
//     src/e2e/accessibility-axe.spec.ts
//
// Each test rewrites the shared file, so in that mode the screens run one
// after another in a single worker, whatever --workers says.
//
// The tags are Section 508's yardstick -- WCAG 2.0 A and AA, which its
// Revised Standards incorporate (E205.4) -- plus WCAG 2.1 A and AA.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import axe from 'axe-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openSeededSong } from './helpers/mixer-song'
import { dismissOverlays } from './helpers/ui'

test.use({ permissions: ['microphone'] })

const BASELINE = resolve(
  process.cwd(),
  'src/e2e/accessibility-axe.baseline.json',
)
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'section508']
const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

type Counts = Record<string, number>

/** axe's violations on the page as it stands: rule id -> node count. */
async function violations(page: Page): Promise<Counts> {
  await page.addScriptTag({ content: axe.source })
  return page.evaluate(async (tags) => {
    const run = (window as unknown as { axe: typeof axe }).axe.run
    const result = await run(document, {
      runOnly: { type: 'tag', values: tags },
      resultTypes: ['violations'],
    })
    return Object.fromEntries(
      result.violations.map((rule) => [rule.id, rule.nodes.length]),
    )
  }, TAGS)
}

function readBaseline(): Record<string, Counts> {
  return JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Counts>
}

/** Fails on anything worse than the baseline; rewrites it when asked to. */
function expectNoWorseThanBaseline(screen: string, counts: Counts): void {
  const baseline = readBaseline()
  if (process.env.AXE_UPDATE_BASELINE === '1') {
    baseline[screen] = Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    )
    const sorted = Object.fromEntries(
      Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)),
    )
    writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`)
    return
  }
  const known = baseline[screen] ?? {}
  const worse = Object.entries(counts)
    .filter(([rule, nodes]) => nodes > (known[rule] ?? 0))
    .map(([rule, nodes]) => `${rule}: ${known[rule] ?? 0} -> ${nodes}`)
  expect(worse, `new axe violations on ${screen}`).toEqual([])
}

async function openTab(
  page: Page,
  tab: string,
  viewport: { width: number; height: number },
  ready: string,
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto(`/#/${tab}`)
  await dismissOverlays(page)
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 15_000 })
}

test.describe('axe-core, Section 508 and WCAG 2.1 AA', () => {
  if (process.env.AXE_UPDATE_BASELINE === '1') {
    test.describe.configure({ mode: 'default' })
  }

  test('Home on a desk', async ({ page }) => {
    await openTab(page, 'home', DESK, '[data-testid="home-learn"]')
    expectNoWorseThanBaseline('home-desk', await violations(page))
  })

  test('Home on a phone', async ({ page }) => {
    await openTab(page, 'home', PHONE, '[data-testid="home-learn"]')
    expectNoWorseThanBaseline('home-phone', await violations(page))
  })

  test('Singing practice', async ({ page }) => {
    await openTab(page, 'singing', DESK, '#practice-panel')
    expectNoWorseThanBaseline('singing-desk', await violations(page))
  })

  test('Karaoke song library', async ({ page }) => {
    await openTab(page, 'karaoke', DESK, '.upload-zone')
    expectNoWorseThanBaseline('karaoke-library-desk', await violations(page))
  })

  test('Karaoke stem mixer with a song', async ({ page }) => {
    await openSeededSong(page, DESK)
    expectNoWorseThanBaseline('stem-mixer-desk', await violations(page))
  })

  test('Karaoke Zen stage', async ({ page }) => {
    await openSeededSong(page, DESK)
    await page.getByRole('button', { name: 'Zen', exact: true }).click()
    await expect(page.getByTestId('karaoke-mobile-stage')).toBeVisible()
    expectNoWorseThanBaseline('zen-stage-desk', await violations(page))
  })

  test('Settings', async ({ page }) => {
    await openTab(
      page,
      'settings',
      DESK,
      '[data-testid="settings-tab-account"]',
    )
    expectNoWorseThanBaseline('settings-desk', await violations(page))
  })
})
