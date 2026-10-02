// ============================================================
// Store shots — the app's screens, reached the way a person reaches them
// ============================================================
//
// Each test seeds a device (fixtures.ts), walks to its screen with real taps,
// proves the screen is the right one and clean, then writes one
// full-viewport PNG flattened to RGB. How to run it: the header of
// ../playwright.shots.config.ts. What each screen is for: README.md.

import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test as base } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ShotOptions } from '../playwright.shots.config'
import { readPngFacts } from './contact-sheet'
import { marasPhone, SHOT_NOW, singTakes } from './fixtures'
import type { StandInLog } from './stand-in-api'
import { installStandInApi } from './stand-in-api'

/** Every face main.tsx ships; each must be loaded before a capture. */
const FONT_FACES = [
  '400 1em "Inter Variable"',
  '600 1em "Outfit Variable"',
  '700 1em "Plus Jakarta Sans Variable"',
]

type Singer = 'mara' | 'first-run'

interface ShotFixtures {
  /** Whose phone this is: Mara's lived-in one, or a fresh install. */
  singer: Singer
  standIn: StandInLog
  /** Skips a screen this device drops (the config's `dropped`). */
  notDropped: void
}

const test = base.extend<ShotOptions & ShotFixtures>({
  shotDir: ['', { option: true }],
  safeArea: [{ top: 0, bottom: 0 }, { option: true }],
  dropped: [{}, { option: true }],
  singer: ['mara', { option: true }],
  notDropped: [
    async ({ dropped }, use, info) => {
      // Set up before the page: a dropped screen is never opened.
      const reason: string | undefined = dropped[info.title]
      info.skip(reason !== undefined, `dropped on this device: ${reason}`)
      await use()
    },
    { auto: true },
  ],
  standIn: async ({ context, singer }, use) => {
    await use(await installStandInApi(context, { signedIn: singer === 'mara' }))
  },
  page: async ({ page, safeArea, singer, standIn }, use, info) => {
    // The device's safe area: env(safe-area-inset-*) answers with the
    // insets WebKit gives the app on the device, so its bars and sheets sit
    // where the phone puts them. capture() checks it took.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: {
        top: safeArea.top,
        topMax: safeArea.top,
        bottom: safeArea.bottom,
        bottomMax: safeArea.bottom,
        left: 0,
        leftMax: 0,
        right: 0,
        rightMax: 0,
      },
    })
    // The fictional calendar starts at SHOT_NOW and runs at the real rate,
    // so a take still lasts as long as it was sung.
    await page.clock.setSystemTime(new Date(SHOT_NOW))
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(
      (storage: Record<string, string>) => {
        // Once per test: a reload keeps what the app wrote since.
        if (window.localStorage.getItem('shots:seeded') !== null) return
        for (const [key, value] of Object.entries(storage)) {
          window.localStorage.setItem(key, value)
        }
        window.localStorage.setItem('shots:seeded', '1')
      },
      marasPhone({ firstRun: singer === 'first-run' }).localStorage,
    )
    await use(page)
    const refused = [...new Set(standIn.refused)]
    console.log(
      `    ${info.project.name} ${info.title}: stand-in answered ${standIn.answered.length}, refused ${refused.length === 0 ? 'none' : refused.join(', ')}${errors.length === 0 ? '' : `; page errors: ${errors.join(' | ')}`}`,
    )
  },
})

/** Fonts loaded and every on-screen image decoded. */
async function settle(page: Page): Promise<void> {
  const missingFonts = await page.evaluate(async (faces) => {
    const loaded = await Promise.all(
      faces.map((face) => document.fonts.load(face)),
    )
    await document.fonts.ready
    return faces.filter((_, index) => loaded[index].length === 0)
  }, FONT_FACES)
  expect(missingFonts, 'app fonts that never loaded').toEqual([])

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.images]
            .filter((image) => {
              const box = image.getBoundingClientRect()
              const onScreen =
                box.width > 0 &&
                box.height > 0 &&
                box.bottom > 0 &&
                box.right > 0 &&
                box.top < window.innerHeight &&
                box.left < window.innerWidth
              return onScreen && (!image.complete || image.naturalWidth === 0)
            })
            .map((image) => image.currentSrc || image.src),
        ),
      { message: 'every on-screen image has decoded', timeout: 20_000 },
    )
    .toEqual([])
  await page.evaluate(() =>
    Promise.all(
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => image.decode().catch(() => undefined)),
    ),
  )
}

/** The words a person can see on screen right now. */
function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const text: string[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    while (walker.nextNode()) {
      const node = walker.currentNode
      const parent = node.parentElement
      if (parent === null) continue
      const style = window.getComputedStyle(parent)
      if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.top < window.innerHeight &&
        box.right > 0 &&
        box.left < window.innerWidth
      )
        text.push(node.textContent ?? '')
    }
    return text.join(' ')
  })
}

/**
 * Nothing a store screenshot must not carry: build identity, a developer
 * surface, a desktop leaking through the emulation, an error, a score as a
 * percentage, or copy the owner has ruled out.
 */
async function expectCleanFrame(page: Page): Promise<void> {
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0)
  await expect(page.locator('[data-testid="portable-console"]')).toHaveCount(0)
  const text = await visibleText(page)
  for (const forbidden of [
    /Developer/u,
    /\bconsole\b/iu,
    /\bX11\b|\bLinux\b|Windows|Macintosh|HeadlessChrome/u,
    /\b(?:dev|ci) · \d+\.\d+\.\d+/u,
    /TestFlight|localhost|127\.0\.0\.1/iu,
    /\d\s?%/u,
    /Nothing uploaded/iu,
    /practis/iu,
    /\bAI\b/u,
    /could not|couldn't|went wrong|failed|offline|unreachable/iu,
  ]) {
    expect(text, `visible text must not match ${forbidden}`).not.toMatch(
      forbidden,
    )
  }
}

/** The top and bottom safe-area insets the page resolves, in CSS px. */
function insetsInForce(page: Page): Promise<{ top: number; bottom: number }> {
  return page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);' +
      'padding-bottom:env(safe-area-inset-bottom,0px)'
    document.body.append(probe)
    const style = window.getComputedStyle(probe)
    const insets = {
      top: Number.parseFloat(style.paddingTop),
      bottom: Number.parseFloat(style.paddingBottom),
    }
    probe.remove()
    return insets
  })
}

/** For a screen that moves on its own, like a live trace. */
interface Moment {
  /** Waits for the instant worth keeping; the screenshot follows at once. */
  readonly wait: () => Promise<void>
  /** Asked when the screenshot is done: was that instant still on screen? */
  readonly held: () => Promise<boolean>
  readonly attempts: number
}

async function capture(
  page: Page,
  info: TestInfo,
  shotDir: string,
  name: string,
  landmark: Locator,
  moment?: Moment,
): Promise<void> {
  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    'the documented motion preference is active',
  ).toBe(true)
  await expect(landmark).toBeVisible()
  const safeArea = (info.project.use as Partial<ShotOptions>).safeArea ?? {
    top: 0,
    bottom: 0,
  }
  expect(await insetsInForce(page), 'the device safe area').toEqual(safeArea)
  await settle(page)
  await expectCleanFrame(page)
  let png: Buffer | null = null
  for (let attempt = 1; attempt <= (moment?.attempts ?? 1); attempt += 1) {
    await moment?.wait()
    const shot = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
    })
    if (moment === undefined || (await moment.held())) {
      png = shot
      break
    }
  }
  if (png === null) {
    throw new Error(`${name}: the screen moved on during every screenshot`)
  }
  await expect(landmark, 'the screen held still for the capture').toBeVisible()

  const folder = join(shotDir, info.project.name)
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `${name}.png`)
  // Chromium writes RGBA; the stores want no alpha. PNG24 is 8-bit RGB, and
  // without ImageMagick's date chunks the same pixels give the same bytes.
  execFileSync(
    'magick',
    [
      'png:-',
      '-background',
      'black',
      '-alpha',
      'remove',
      '-alpha',
      'off',
      '-strip',
      '-define',
      'png:exclude-chunks=date,time',
      `PNG24:${file}`,
    ],
    { input: png },
  )

  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('The shot projects set a viewport.')
  const scale = info.project.use.deviceScaleFactor ?? 1
  expect(readPngFacts(file), file).toEqual({
    width: viewport.width * scale,
    height: viewport.height * scale,
    bitDepth: 8,
    colorType: 2,
    hasTransparency: false,
  })
  console.log(
    `ok  ${info.project.name}/${name}.png  ${viewport.width * scale}x${viewport.height * scale}`,
  )
}

// ── Walking the app ─────────────────────────────────────────

async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('#root.loaded')).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('[data-testid="rooms-alley"]')).toBeVisible({
    timeout: 30_000,
  })
}

/** A rail tab, tapped. */
async function tapRail(page: Page, item: string): Promise<void> {
  await page.locator(`[data-rail-item="${item}"]`).tap()
}

/** An item in the More sheet, tapped. */
async function tapMore(page: Page, item: string): Promise<void> {
  await tapRail(page, 'more')
  await page.locator(`[data-more-item="${item}"]`).tap()
}

/** A door in the alley, tapped where a thumb would: its middle. */
async function tapDoor(page: Page, key: string): Promise<void> {
  const door = page.locator(`[data-testid="alley-door-${key}"]`)
  await expect(door).toBeVisible()
  const box = await door.boundingBox()
  if (box === null) throw new Error(`The ${key} door has no box.`)
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

/** Wait until the pitch pill names `note` (as "E5"). */
async function heard(page: Page, note: string, timeout = 30_000) {
  await expect(page.locator('[data-testid="sing-note-chip"]')).toHaveAttribute(
    'aria-label',
    new RegExp(`^${note},`, 'u'),
    { timeout },
  )
}

/**
 * Into the Sing room, listening. Mara's phone granted the microphone before,
 * so the room starts listening on the way in, with no capsule to tap
 * (sing-room-settings.ts, `singMicGranted`). The microphone is the config's
 * synthesised phrase (voice.ts), which Chromium loops.
 */
async function enterSingRoom(page: Page): Promise<void> {
  await tapRail(page, 'stage')
  await expect(page.locator('[data-testid="sing-room"]')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Listening\. Tap to mute/u }),
  ).toBeVisible({ timeout: 30_000 })
}

/**
 * The phrase's top note, held and in tune. E5 is sung once per pass, near
 * the end, for 2.6 seconds, long enough to outlast a 13-inch screenshot: the
 * trace then holds nearly the whole phrase, and the pill names a held note
 * rather than a breath or a glide.
 */
function onTheTopNote(page: Page): Moment {
  const pill = page.locator('[data-testid="sing-note-chip"]')
  return {
    wait: async () => {
      await page.waitForFunction(
        () => {
          const chip = document.querySelector<HTMLElement>(
            '[data-testid="sing-note-chip"]',
          )
          return (
            chip?.getAttribute('aria-label')?.startsWith('E5,') === true &&
            chip.dataset.variant === 'in'
          )
        },
        null,
        { timeout: 45_000 },
      )
      // Past the glide into E5, with most of the note still to come.
      await page.waitForTimeout(150)
    },
    held: async () =>
      (await pill.getAttribute('aria-label'))?.startsWith('E5,') === true,
    attempts: 3,
  }
}

// ── The screens ─────────────────────────────────────────────

// Screens 01 and 03 are a first run: nothing kept, nothing granted.

test.describe('a fresh install', () => {
  test.use({ singer: 'first-run' })

  test('01-rooms-welcome', async ({ page, shotDir }, info) => {
    await openApp(page)
    const headline = page.getByText('Pick a room. Make a sound.')
    await expect(headline).toBeVisible()
    await capture(page, info, shotDir, '01-rooms-welcome', headline)
  })
})

test('02-rooms-sing-door', async ({ page, shotDir }, info) => {
  await openApp(page)
  await tapDoor(page, 'sing')
  const name = page.locator('[data-testid="alley-name"]')
  await expect(name).toHaveText(/^Sing · /u)
  await expect(page.locator('[data-testid="alley-enter"]')).toBeVisible()
  await capture(page, info, shotDir, '02-rooms-sing-door', name)
})

test.describe('a fresh install, asked for the microphone', () => {
  test.use({ singer: 'first-run' })

  test('03-sing-priming', async ({ page, shotDir }, info) => {
    await openApp(page)
    await tapDoor(page, 'sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    await expect(page.locator('[data-testid="sing-room"]')).toBeVisible()
    await page.locator('[data-testid="sing-capsule"]').tap()
    const priming = page.locator('[data-testid="sing-priming"]')
    await expect(priming).toBeVisible()
    await expect(priming).toContainText('Only you can hear you.')
    await capture(page, info, shotDir, '03-sing-priming', priming)
  })
})

test('04-sing-live', async ({ page, shotDir }, info) => {
  await openApp(page)
  await enterSingRoom(page)
  await capture(
    page,
    info,
    shotDir,
    '04-sing-live',
    page.locator('[data-testid="sing-note-chip"]'),
    onTheTopNote(page),
  )
})

test('05-sing-take', async ({ page, shotDir }, info) => {
  await openApp(page)
  await enterSingRoom(page)
  // The whole phrase, up to E5 and down to the C5 it settles on, then Stop.
  await heard(page, 'E5', 45_000)
  await heard(page, 'C5', 10_000)
  await page.waitForTimeout(800)
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .tap()
  const sheet = page.locator('[data-testid="sing-take-sheet"]')
  await expect(sheet).toBeVisible()
  // Against the newest take this phone kept (fixtures.ts).
  const previous = singTakes().at(-1)
  expect(previous).toBeDefined()
  await expect(page.locator('[data-testid="sing-take-history"]')).toContainText(
    `${previous?.lowNote} to ${previous?.highNote}`,
  )
  await capture(page, info, shotDir, '05-sing-take', sheet)
})

test('06-ear-lab', async ({ page, shotDir }, info) => {
  await openApp(page)
  await tapRail(page, 'ear')
  const title = page.locator('[data-testid="ear-bench-title"]')
  await expect(title).toBeVisible()
  await capture(page, info, shotDir, '06-ear-lab', title)
})

test('07-karaoke', async ({ page, shotDir }, info) => {
  await openApp(page)
  await tapMore(page, 'karaoke')
  const stage = page.locator('[data-testid="karaoke-mobile-stage"]')
  await expect(stage).toBeVisible({ timeout: 30_000 })
  await stage.locator('button[aria-label="Play"]').tap()
  await expect(stage.locator('button[aria-label="Pause"]')).toBeVisible()
  // A line in the song's middle, tapped: the song jumps there, the way a
  // singer skips to the part they want to practice.
  const line = stage.locator('p', { hasText: /\w/u }).nth(6)
  await line.tap()
  await page.waitForTimeout(2500)
  await capture(
    page,
    info,
    shotDir,
    '07-karaoke',
    page.locator('[data-testid="karaoke-songline"]'),
  )
})

test('08-settings', async ({ page, shotDir }, info) => {
  await openApp(page)
  await tapMore(page, 'settings')
  const screen = page.locator('[data-testid="shell-pushed"]')
  await expect(screen).toBeVisible()
  await expect(page.getByText('Only you can hear you.')).toBeVisible()
  await capture(page, info, shotDir, '08-settings', screen)
})
