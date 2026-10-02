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
import { mkdirSync, writeFileSync } from 'node:fs'
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
  systemSerif: [null, { option: true }],
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

/**
 * "Josh Woodward — Nothing in the Dark": a song credited as artist and
 * title, the one place a spaced dash is the convention rather than a
 * sentence. Two short runs of words with no sentence punctuation.
 */
const isCredit = (text: string): boolean =>
  /^[^\u2014.!?;:]{1,60} \u2014 [^\u2014.!?;:]{1,80}$/u.test(text.trim())

/**
 * An em dash used as punctuation: one text node that holds both a dash and
 * a word. A dash standing alone is the app's empty value ("—" on the pitch
 * pill before a voice is heard), not a sentence.
 */
const proseDash = (text: string): boolean =>
  /\u2014/u.test(text) && /\p{L}/u.test(text) && !isCredit(text)

/**
 * Nothing a store screenshot must not carry: build identity, a developer
 * surface, a desktop leaking through the emulation, an error, a score as a
 * percentage, or copy the owner has ruled out.
 */
async function expectCleanFrame(page: Page): Promise<void> {
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0)
  await expect(page.locator('[data-testid="portable-console"]')).toHaveCount(0)
  // What shows: text a clipping ancestor hides, or kept for screen readers
  // only, is not in the frame.
  const { words } = await wordsAndControls(page, 0)
  const texts = words
    .map((w) => w.text)
    .filter((t, i, all) => i === 0 || all[i - 1] !== t)
  // The owner's copy rule for visible English: no em dash in a sentence.
  expect(
    [...new Set(texts.filter(proseDash))],
    'sentences with an em dash',
  ).toEqual([])
  const text = texts.join(' ')
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

/** A box in the viewport, in CSS px. */
interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Where a capture's words and controls sit, written beside its PNG as
 * <name>.layout.json, so a composition built from the PNG can keep a cut or
 * an overlap clear of them. CSS px of the viewport; `scale` turns them into
 * the PNG's pixels.
 */
interface CaptureLayout {
  readonly viewport: { readonly width: number; readonly height: number }
  readonly scale: number
  /** The box of the landmark the capture waited for. */
  readonly landmark: Box | null
  /**
   * Each visible line of each text node, cut to what its clipping ancestors
   * let show. A line less than half visible is left out, and so is text
   * kept for screen readers only.
   */
  readonly words: readonly (Box & { readonly text: string })[]
  /** Each visible button, link, field, tab, slider or switch, cut the same way. */
  readonly controls: readonly (Box & { readonly label: string })[]
  /**
   * Controls that read as one object, which a cut must keep whole: a painted
   * container holding two or more of them (a pill, a bar), or a row of them
   * set close together (a chip row). `kind` says which; `size` is how many
   * controls it holds.
   */
  readonly groups: readonly (Box & {
    readonly kind: 'container' | 'row'
    readonly size: number
    readonly labels: readonly string[]
  })[]
  /** The Ear Lab's serif as this browser drew it (see `systemSerif`). */
  readonly serif?: {
    readonly text: string
    readonly faces: readonly string[]
    readonly expected: string | null
  }
}

/** The words, controls and control groups on screen, read right after a screenshot. */
function wordsAndControls(
  page: Page,
  minShare = 0.5,
): Promise<Pick<CaptureLayout, 'words' | 'controls' | 'groups'>> {
  return page.evaluate((share) => {
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }
    type Rect = { left: number; top: number; right: number; bottom: number }
    const meet = (a: Rect, b: Rect): Rect => ({
      left: Math.max(a.left, b.left),
      top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right),
      bottom: Math.min(a.bottom, b.bottom),
    })
    const area = (r: Rect) =>
      Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top)
    // What an element's clipping ancestors and the viewport leave of a box:
    // the stage that scrolls, a sheet, a screen-reader-only span (1 x 1 px,
    // overflow hidden) all clip.
    const clipped = (element: Element, box: Rect): Rect => {
      let out = meet(box, viewport)
      for (
        let e: Element | null = element;
        e !== null && e !== document.documentElement;
        e = e.parentElement
      ) {
        const style = window.getComputedStyle(e)
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) {
          return { left: 0, top: 0, right: 0, bottom: 0 }
        }
        if (
          e !== element &&
          (style.overflowX !== 'visible' || style.overflowY !== 'visible')
        ) {
          out = meet(out, e.getBoundingClientRect())
        }
        if (
          style.clip === 'rect(0px, 0px, 0px, 0px)' ||
          style.clipPath === 'inset(50%)'
        ) {
          return { left: 0, top: 0, right: 0, bottom: 0 }
        }
      }
      return out
    }
    const plain = (box: Rect) => ({
      x: Math.round(box.left * 100) / 100,
      y: Math.round(box.top * 100) / 100,
      width: Math.round((box.right - box.left) * 100) / 100,
      height: Math.round((box.bottom - box.top) * 100) / 100,
    })
    // Enough of it shows (half, for the layout file): the part that does is
    // what is recorded.
    const showing = (element: Element, box: Rect): Rect | null => {
      if (area(box) === 0) return null
      const left = clipped(element, box)
      return area(left) > 0 && area(left) >= area(box) * share ? left : null
    }

    const words: (ReturnType<typeof plain> & { text: string })[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent?.trim() ?? ''
      if (node.parentElement === null || text === '') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const box of range.getClientRects()) {
        const left = showing(node.parentElement, box)
        if (left !== null) words.push({ text, ...plain(left) })
      }
    }

    const shownControls = [
      ...document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="slider"], [role="switch"]',
      ),
    ].flatMap((element) => {
      const box = showing(element, element.getBoundingClientRect())
      if (box === null) return []
      const label =
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 60) ??
        ''
      return [{ element, label, box }]
    })
    const controls = shownControls.map((c) => ({
      label: c.label,
      ...plain(c.box),
    }))

    // Groups. A painted container: the nearest ancestor that draws a box
    // (a fill, an image, a border, a shadow or a backdrop blur) around two
    // or more controls, short of a page-sized surface.
    const alpha = (color: string): number => {
      if (color === 'transparent') return 0
      const slash = /\/\s*([\d.]+)(%?)\s*\)$/u.exec(color)
      if (slash) return Number(slash[1]) / (slash[2] === '%' ? 100 : 1)
      const comma = /^rgba\(.*,\s*([\d.]+)\s*\)$/u.exec(color)
      return comma ? Number(comma[1]) : 1
    }
    const paints = (style: CSSStyleDeclaration): boolean =>
      alpha(style.backgroundColor) > 0.05 ||
      style.backgroundImage !== 'none' ||
      style.boxShadow !== 'none' ||
      (style.backdropFilter !== '' && style.backdropFilter !== 'none') ||
      (['Top', 'Right', 'Bottom', 'Left'] as const).some(
        (side) =>
          Number.parseFloat(style[`border${side}Width`]) > 0 &&
          style[`border${side}Style`] !== 'none' &&
          alpha(style[`border${side}Color`]) > 0.05,
      )
    const pageArea = window.innerWidth * window.innerHeight
    const groups: (ReturnType<typeof plain> & {
      kind: 'container' | 'row'
      size: number
      labels: string[]
    })[] = []
    const seen = new Set<Element>()
    for (const c of shownControls) {
      for (
        let e = c.element.parentElement;
        e !== null && e !== document.body;
        e = e.parentElement
      ) {
        const box = e.getBoundingClientRect()
        if (box.width * box.height > pageArea / 2) break
        const inside = shownControls.filter(
          (o) => o.element !== e && e.contains(o.element),
        )
        if (inside.length < 2 || !paints(window.getComputedStyle(e))) continue
        if (!seen.has(e)) {
          seen.add(e)
          const left = showing(e, box)
          if (left !== null) {
            groups.push({
              kind: 'container',
              size: inside.length,
              labels: inside.map((o) => o.label.slice(0, 40)),
              ...plain(left),
            })
          }
        }
        break
      }
    }
    // A row: controls whose middles share a line and whose edges sit within
    // 24 px of the next, like a chip row or a transport.
    const parent = shownControls.map((_, i) => i)
    const root = (i: number): number =>
      parent[i] === i ? i : (parent[i] = root(parent[i]))
    shownControls.forEach((a, i) => {
      shownControls.forEach((b, j) => {
        if (j <= i) return
        const ha = a.box.bottom - a.box.top
        const hb = b.box.bottom - b.box.top
        if (Math.max(ha, hb) > 120) return
        const sameLine =
          Math.abs(
            (a.box.top + a.box.bottom) / 2 - (b.box.top + b.box.bottom) / 2,
          ) <=
          0.3 * Math.min(ha, hb)
        const gap =
          Math.max(a.box.left, b.box.left) - Math.min(a.box.right, b.box.right)
        if (sameLine && gap <= 24) parent[root(i)] = root(j)
      })
    })
    const rows = new Map<number, typeof shownControls>()
    shownControls.forEach((c, i) => {
      const r = root(i)
      rows.set(r, [...(rows.get(r) ?? []), c])
    })
    for (const row of rows.values()) {
      if (row.length < 2) continue
      groups.push({
        kind: 'row',
        size: row.length,
        labels: row.map((o) => o.label.slice(0, 40)),
        ...plain({
          left: Math.min(...row.map((o) => o.box.left)),
          top: Math.min(...row.map((o) => o.box.top)),
          right: Math.max(...row.map((o) => o.box.right)),
          bottom: Math.max(...row.map((o) => o.box.bottom)),
        }),
      })
    }
    return { words, controls, groups }
  }, minShare)
}

/**
 * The faces the browser drew an element's own text in, read through the
 * DevTools protocol: the first serif-set line inside `within`. The page is
 * marked to find the node and unmarked after.
 */
async function serifFaces(
  page: Page,
  within: string,
): Promise<{ text: string; faces: string[] }> {
  const text = await page.evaluate((selector) => {
    const scope = document.querySelector(selector)
    if (scope === null) return null
    for (const element of scope.querySelectorAll('*')) {
      if (!/Iowan Old Style/u.test(window.getComputedStyle(element).fontFamily))
        continue
      const own = [...element.childNodes].find(
        (n) =>
          n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? '') !== '',
      )
      if (own === undefined) continue
      element.setAttribute('data-shot-serif', '')
      return own.textContent?.trim() ?? ''
    }
    return null
  }, within)
  if (text === null) throw new Error(`No serif-set text inside ${within}.`)
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-shot-serif]',
    })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    return {
      text,
      faces: [...fonts]
        .sort((a, b) => b.glyphCount - a.glyphCount)
        .map((f) => f.familyName),
    }
  } finally {
    await page.evaluate(() =>
      document
        .querySelector('[data-shot-serif]')
        ?.removeAttribute('data-shot-serif'),
    )
    await cdp.detach()
  }
}

/** For a screen that moves on its own, like a live trace. */
interface Moment {
  /** Waits for the instant worth keeping; the screenshot follows at once. */
  readonly wait: () => Promise<void>
  /** Asked when the screenshot is done: was that instant still on screen? */
  readonly held: () => Promise<boolean>
  readonly attempts: number
}

interface CaptureOptions {
  /** For a screen that moves on its own. */
  readonly moment?: Moment
  /**
   * Where the screen sets type in the Ear Lab's serif: its face is read,
   * recorded in the layout file and held to the project's `systemSerif`.
   */
  readonly serif?: string
}

async function capture(
  page: Page,
  info: TestInfo,
  shotDir: string,
  name: string,
  landmark: Locator,
  { moment, serif }: CaptureOptions = {},
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
  let onScreen: Pick<CaptureLayout, 'words' | 'controls' | 'groups'> | null =
    null
  for (let attempt = 1; attempt <= (moment?.attempts ?? 1); attempt += 1) {
    await moment?.wait()
    const shot = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
    })
    const read = await wordsAndControls(page)
    if (moment === undefined || (await moment.held())) {
      png = shot
      onScreen = read
      break
    }
  }
  if (png === null || onScreen === null) {
    throw new Error(`${name}: the screen moved on during every screenshot`)
  }
  await expect(landmark, 'the screen held still for the capture').toBeVisible()
  expect(
    [...new Set(onScreen.words.map((w) => w.text).filter(proseDash))],
    'sentences with an em dash in the captured frame',
  ).toEqual([])

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
  let serifFact: CaptureLayout['serif']
  if (serif !== undefined) {
    const expected =
      (info.project.use as Partial<ShotOptions>).systemSerif ?? null
    const drawn = await serifFaces(page, serif)
    serifFact = { ...drawn, expected }
    if (expected === null) {
      // Iowan Old Style is Apple's: this machine cannot draw it, and no
      // other face is passed off as it. The capture says what it used.
      info.annotations.push({
        type: 'serif',
        description: `"${drawn.text}" is drawn in ${drawn.faces.join(', ')}, not Iowan Old Style, which only Apple ships`,
      })
      console.log(
        `    ${info.project.name} ${name}: the Ear Lab serif is drawn in ${drawn.faces.join(', ')} here, not Iowan Old Style (Apple only)`,
      )
    } else {
      expect(drawn.faces, `the face "${drawn.text}" is drawn in`).toEqual([
        expected,
      ])
    }
  }
  const layout: CaptureLayout = {
    viewport,
    scale,
    landmark: await landmark.boundingBox(),
    ...onScreen,
    ...(serifFact === undefined ? {} : { serif: serifFact }),
  }
  writeFileSync(
    join(folder, `${name}.layout.json`),
    `${JSON.stringify(layout, null, 2)}\n`,
  )
  console.log(
    `ok  ${info.project.name}/${name}.png  ${viewport.width * scale}x${viewport.height * scale}, ${onScreen.words.length} lines of words, ${onScreen.controls.length} controls, ${onScreen.groups.length} groups${serifFact === undefined ? '' : `, serif ${serifFact.faces.join(', ')}`}`,
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

/**
 * The Ear Lab bench scrolled so the six faculty dials lead its stage, read
 * in cents and milliseconds, instead of the index above them. Then the
 * nearest scroll position, within 160 px, where the dials show whole and no
 * line of words is sliced by the stage's top or bottom edge: a store frame
 * must not show half a "268" under the action row.
 */
async function benchAtFaculties(page: Page): Promise<void> {
  const left = await page.evaluate(() => {
    const faculties = document.querySelector<HTMLElement>(
      '[data-tour="ear.faculties"]',
    )
    if (faculties === null) return { error: 'no faculties', cut: [] }
    let stage = faculties.parentElement
    while (
      stage !== null &&
      !(
        /auto|scroll/u.test(window.getComputedStyle(stage).overflowY) &&
        stage.scrollHeight > stage.clientHeight
      )
    ) {
      stage = stage.parentElement
    }
    if (stage === null) return { error: 'the bench does not scroll', cut: [] }
    const scroller = stage
    const lines = (): { text: string; top: number; bottom: number }[] => {
      const out: { text: string; top: number; bottom: number }[] = []
      const walker = document.createTreeWalker(scroller, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        const text = node.textContent?.trim() ?? ''
        const parent = node.parentElement
        if (text === '' || parent === null) continue
        const style = window.getComputedStyle(parent)
        if (style.visibility === 'hidden' || Number(style.opacity) === 0)
          continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const box of range.getClientRects()) {
          if (box.width > 0 && box.height > 0) {
            out.push({ text, top: box.top, bottom: box.bottom })
          }
        }
      }
      return out
    }
    const cutAt = (): string[] => {
      const view = scroller.getBoundingClientRect()
      const dials = faculties.getBoundingClientRect()
      const whole = dials.top >= view.top && dials.bottom <= view.bottom
      const sliced = lines()
        .filter(
          (l) =>
            (l.top < view.top && l.bottom > view.top) ||
            (l.top < view.bottom && l.bottom > view.bottom),
        )
        .map((l) => l.text.slice(0, 40))
      return whole ? sliced : ['the faculty dials themselves', ...sliced]
    }
    const target =
      scroller.scrollTop +
      faculties.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      12
    const max = scroller.scrollHeight - scroller.clientHeight
    for (let step = 0; step <= 320; step += 1) {
      const delta = step % 2 === 0 ? step / 2 : -(step + 1) / 2
      scroller.scrollTop = Math.round(
        Math.min(max, Math.max(0, target + delta)),
      )
      if (cutAt().length === 0) return { error: null, cut: [] }
    }
    scroller.scrollTop = Math.round(Math.min(max, Math.max(0, target)))
    return { error: null, cut: cutAt() }
  })
  expect(left.error, 'the bench scrolls to its dials').toBeNull()
  expect(left.cut, 'lines the stage would slice').toEqual([])
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
    { moment: onTheTopNote(page) },
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
  await expect(page.locator('[data-testid="ear-bench-title"]')).toBeVisible()
  const faculties = page.locator('[data-tour="ear.faculties"]')
  await benchAtFaculties(page)
  // The units the store caption promises, on the dials that lead.
  await expect(faculties).toContainText('¢')
  await expect(faculties).toContainText('ms')
  await capture(page, info, shotDir, '06-ear-lab', faculties, {
    serif: '[data-tour="ear.faculties"]',
  })
})

test('09-ear-report', async ({ page, shotDir }, info) => {
  await openApp(page)
  await tapRail(page, 'ear')
  await expect(page.locator('[data-testid="ear-bench-title"]')).toBeVisible()
  await page.getByRole('button', { name: 'Ear Report' }).tap()
  const report = page.locator('[data-testid="ear-report"]')
  await expect(report).toBeVisible()
  // Mara's two threshold drills, traced in their own units.
  await expect(report).toContainText('Hairline · threshold')
  await expect(report).toContainText('The Grid · threshold')
  await capture(page, info, shotDir, '09-ear-report', report, {
    serif: '[data-testid="ear-report"]',
  })
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
