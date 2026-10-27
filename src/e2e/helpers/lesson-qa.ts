// ============================================================
// Lesson page QA — the keyboard's reach, the live regions, the tap targets, the rest
// ============================================================
//
// A lesson page's whole-page checks (its WEB-SPEC's keyboard, live-region,
// target and reduced-motion checks), measured in the browser rather than
// read off the markup: which controls a viewer can reach by Tab alone,
// from wherever the focus stands; whether each toggle's `aria-pressed`
// follows a key press; every text a live region takes, and where; every
// target's tap box, found as app-check's `hitBox` finds it
// (`elementFromPoint` in 1 px steps out from its centre, so a link's
// `::after` counts and anything laid over it does not), at least 44 px
// square with none overlapping; and what moves: the frames the page asks
// for, the animations it runs, and each drawing a canvas shows. Lesson 9's
// QA spec measures its page the same way; Lesson 10's uses these.

import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** What the keyboard can stop on: a link, a form control, or anything with a tab index. */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]'

/** A control's name, as a reader meets it: its label, or its words. */
export const nameIn = (el: Element): string =>
  (el.getAttribute('aria-label') ?? el.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** What has the focus, by name. */
export const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement
    return (el?.getAttribute('aria-label') ?? el?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })

/** A text a live region took, as a reader hears it, and the region's place: the closest element with an id. */
export interface Said {
  readonly where: string
  readonly text: string
}

/** Records every text a live region takes, from before the page's first script. */
export async function watchLive(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { said: { where: string; text: string }[] }
    w.said = []
    const regionOf = (n: Node | null): Element | null =>
      (n instanceof Element ? n : (n?.parentElement ?? null))?.closest(
        '[aria-live], [role="status"], [role="alert"]',
      ) ?? null
    // what a reader hears of it: no text hidden from sight or from readers
    const spoken = (region: Element): string => {
      let out = ''
      const walk = document.createTreeWalker(region, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
        const p = n.parentElement
        if (p === null || p.closest('[aria-hidden="true"]') !== null) continue
        if (p.checkVisibility({ visibilityProperty: true }))
          out += n.textContent ?? ''
      }
      return out.replace(/\s+/g, ' ').trim()
    }
    new MutationObserver((records) => {
      for (const r of records) {
        const region = regionOf(r.target)
        if (region === null) continue
        const text = spoken(region)
        if (text === '') continue
        const where =
          region.id ||
          (region.hasAttribute('data-announcer')
            ? 'announcer'
            : region.closest('[id]')?.id) ||
          ''
        // each region's text once per change, whatever other regions say between
        const last = w.said.findLast((x) => x.where === where)
        if (last?.text !== text) w.said.push({ where, text })
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
}

/** Every text the live regions have taken so far. */
export const liveSaid = (page: Page): Promise<Said[]> =>
  page.evaluate(() => (window as unknown as { said: Said[] }).said)

/** A control a viewer acts on: whatever its tab index, Tab must reach it. */
const CONTROL = 'a[href], button, input, select, textarea'

/**
 * Tags every control showing inside `scope` that Tab must stop on with
 * `data-qa-<tag>`, its place in page order, and returns how many: each
 * enabled, visible control, whatever its tab index, and anything else the
 * page gave a tab index of 0 or more (the spiral's canvas). A control with
 * a tab index of -1 is left out only as one of a roving group, its kin
 * beside it all -1 but the one tab stop the arrow keys go on from (the
 * explorer's map).
 */
export const tagReachable = (
  page: Page,
  scope: string,
  tag: string,
): Promise<number> =>
  page.locator(scope).evaluate(
    (root, [sel, control, attr]) => {
      const roving = (el: HTMLElement): boolean => {
        const kin = Array.from(el.parentElement?.children ?? []).filter(
          (k): k is HTMLElement =>
            k instanceof HTMLElement && k.tagName === el.tagName,
        )
        return kin.length > 1 && kin.filter((k) => k.tabIndex >= 0).length === 1
      }
      const all = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
        (el) =>
          !(el as HTMLButtonElement).disabled &&
          el.checkVisibility({ visibilityProperty: true }) &&
          (el.tabIndex >= 0 || (el.matches(control) && !roving(el))),
      )
      all.forEach((el, i) => el.setAttribute(attr, String(i)))
      return all.length
    },
    [FOCUSABLE, CONTROL, `data-qa-${tag}`] as const,
  )

/**
 * Puts the keyboard's place at the start of `start` (the page's top, with
 * null), as a skip link would: on the element itself, which takes the
 * focus by script only, so the next Tab goes to the first control inside.
 */
async function placeAt(page: Page, start: string | null): Promise<void> {
  await page.evaluate((sel) => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    if (sel === null) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) throw new Error(`no ${sel}`)
    if (!el.hasAttribute('tabindex')) {
      el.dataset.qaPlace = ''
      el.tabIndex = -1
    }
    el.focus({ preventScroll: true })
  }, start)
}

/** Takes back the tab index `placeAt` gave. */
const unplace = (page: Page): Promise<void> =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-qa-place]',
    )) {
      el.removeAttribute('tabindex')
      el.removeAttribute('data-qa-place')
    }
  })

/**
 * Presses Tab from the start of `start` (the page's top, with null) until
 * the focus has met every control tagged `tag`, or `limit` presses; returns
 * the names of those it never met.
 */
export async function unreached(
  page: Page,
  start: string | null,
  tag: string,
  count: number,
  limit = count * 2 + 20,
): Promise<string[]> {
  const attr = `data-qa-${tag}`
  await placeAt(page, start)
  const met = new Set<string>()
  for (let i = 0; i < limit && met.size < count; i++) {
    await page.keyboard.press('Tab')
    const at = await page.evaluate(
      (a) => document.activeElement?.getAttribute(a) ?? null,
      attr,
    )
    if (at !== null) met.add(at)
  }
  await unplace(page)
  return page.evaluate(
    ([a, seen]) =>
      Array.from(document.querySelectorAll(`[${a}]`))
        .filter((el) => !seen.includes(el.getAttribute(a) ?? ''))
        .map((el) =>
          (el.getAttribute('aria-label') ?? el.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim(),
        ),
    [attr, Array.from(met)] as const,
  )
}

/**
 * The names Tab meets for as long as the focus stays inside `scope`, `limit`
 * at most: from the start of `start`, or, with null, from wherever the
 * focus stands.
 */
export async function tabsWithin(
  page: Page,
  start: string | null,
  scope: string,
  limit = 30,
): Promise<string[]> {
  if (start !== null) await placeAt(page, start)
  const met: string[] = []
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(
      (sel) => document.activeElement?.closest(sel) !== null,
      scope,
    )
    if (!inside) break
    met.push(await focusedName(page))
  }
  await unplace(page)
  return met
}

/** A toggle to press: its tag, name and state, and the half of its segmented switch that is pressed, if it is one. */
interface Toggle {
  readonly tag: string
  readonly name: string
  readonly pressed: string
  readonly partner: string | null
}

/** Tags every toggle showing inside `scope` (`data-qa-toggle`), and reads each one. */
const togglesIn = (page: Page, scope: string): Promise<Toggle[]> =>
  page.locator(scope).evaluate((root) => {
    for (const el of document.querySelectorAll('[data-qa-toggle]'))
      el.removeAttribute('data-qa-toggle')
    const all = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'),
    ).filter(
      (b) => !b.disabled && b.checkVisibility({ visibilityProperty: true }),
    )
    all.forEach((b, i) => b.setAttribute('data-qa-toggle', String(i)))
    return all.map((b) => {
      // a segmented switch: pressed halves side by side in their own group
      const group = b.parentElement?.matches('[role="group"]') === true
      const halves = Array.from(
        (group ? b.parentElement : null)?.querySelectorAll(
          ':scope > button[aria-pressed]',
        ) ?? [],
      )
      const partner =
        halves.length > 1
          ? halves.find((h) => h.getAttribute('aria-pressed') === 'true')
          : undefined
      return {
        tag: b.getAttribute('data-qa-toggle') ?? '',
        name: (b.getAttribute('aria-label') ?? b.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
        pressed: b.getAttribute('aria-pressed') ?? 'false',
        partner:
          halves.length > 1
            ? (partner?.getAttribute('data-qa-toggle') ?? '')
            : null,
      }
    })
  })

/**
 * Presses each toggle showing inside `scope` by keyboard, Space and Enter in
 * turn, and checks that its `aria-pressed` follows: a switch flips, and a
 * segmented switch's other half takes it from the half that had it. Each is
 * put back as it was, by keyboard. Returns how many it pressed.
 */
export async function expectTogglesFlip(
  page: Page,
  scope: string,
  what: string,
): Promise<number> {
  const toggle = (tag: string): Locator =>
    page.locator(`[data-qa-toggle="${tag}"]`)
  let pressed = 0
  for (const [i, t] of (await togglesIn(page, scope)).entries()) {
    // a segmented switch's pressed half has nothing to flip by itself
    if (t.partner !== null && t.pressed === 'true') continue
    const key = i % 2 === 0 ? 'Space' : 'Enter'
    const said = `${what}: ${t.name}, by ${key}`
    await toggle(t.tag).focus()
    await page.keyboard.press(key)
    await expect(toggle(t.tag), said).toHaveAttribute(
      'aria-pressed',
      t.pressed === 'true' ? 'false' : 'true',
    )
    pressed += 1
    // put back: the switch pressed again, or the other half pressed
    const back = t.partner === null ? t.tag : t.partner
    if (t.partner !== null)
      await expect(toggle(back), `${said}, its other half`).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    await toggle(back).focus()
    await page.keyboard.press(key)
    await expect(toggle(t.tag), `${said}, put back`).toHaveAttribute(
      'aria-pressed',
      t.pressed,
    )
  }
  return pressed
}

interface Box {
  readonly name: string
  /** Its box on the page, px from the document's top left. */
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** How far a tap lands on it through its centre, across and down; 121 at most. */
  readonly wide: number
  readonly tall: number
}

/**
 * Every target showing inside `scope`: buttons, inputs and links that are
 * not words inside a line of text, each brought to the screen's middle and
 * measured at rest. The scroll can start an entrance on it or on a box
 * around it: `kit/reveal.ts` lands a card from 97.5 % over a second, which
 * leaves a 44 px button 42.9 px tall in its first frame. So two frames let
 * the reveal's observer answer, and what it started plays out first.
 */
const targetsIn = (page: Page, scope: string): Promise<Box[]> =>
  page
    .locator(scope)
    .first()
    .evaluate(async (root) => {
      const frame = (): Promise<number> =>
        new Promise((resolve) => requestAnimationFrame(resolve))
      const boxes: Box[] = []
      for (const el of Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, input, select, [role="slider"], a[href]',
        ),
      ).filter(
        (el) =>
          el.checkVisibility({ visibilityProperty: true }) &&
          !(
            el instanceof HTMLAnchorElement &&
            getComputedStyle(el).display === 'inline'
          ),
      )) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' })
        await frame()
        await frame()
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => {
              const e = a.effect
              return (
                a.playState === 'running' &&
                e instanceof KeyframeEffect &&
                e.target?.contains(el) === true &&
                Number.isFinite(e.getComputedTiming().endTime)
              )
            })
            .map((a) => a.finished.catch(() => undefined)),
        )
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const on = (x: number, y: number): boolean => {
          const t = document.elementFromPoint(x, y)
          return t !== null && el.contains(t)
        }
        const reach = (dx: number, dy: number): number => {
          let n = 0
          while (n < 60 && on(cx + dx * (n + 1), cy + dy * (n + 1))) n++
          return n
        }
        const centre = on(cx, cy)
        boxes.push({
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim(),
          x: r.x + window.scrollX,
          y: r.y + window.scrollY,
          w: r.width,
          h: r.height,
          wide: centre ? reach(-1, 0) + reach(1, 0) + 1 : 0,
          tall: centre ? reach(0, -1) + reach(0, 1) + 1 : 0,
        })
      }
      return boxes
    })

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w - 0.5 &&
  b.x < a.x + a.w - 0.5 &&
  a.y < b.y + b.h - 0.5 &&
  b.y < a.y + a.h - 0.5

/** Every target inside `scope` a tap box at least 44 px square, none overlapping, and the page no wider than the screen; returns how many. */
export async function expectTargets(
  page: Page,
  scope: string,
  what: string,
): Promise<number> {
  const targets = await targetsIn(page, scope)
  const small = targets
    .filter((t) => t.wide < 44 || t.tall < 44)
    .map((t) => `${t.name}: ${t.wide} x ${t.tall}`)
  const overlapping = targets.flatMap((a, i) =>
    targets
      .slice(i + 1)
      .filter((b) => overlap(a, b))
      .map((b) => `${a.name} / ${b.name}`),
  )
  expect(small, `${what}: under 44 px`).toEqual([])
  expect(overlapping, `${what}: overlapping`).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
    `${what}: sideways scroll`,
  ).toBeLessThanOrEqual(0)
  return targets.length
}

/** The frames the page asks for, counted from before its first script. */
export async function watchFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number }
    w.frames = 0
    const ask = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => {
      w.frames += 1
      return ask(cb)
    }
  })
}

/** The frames the page asks for over the next second. */
export const framesOverASecond = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const w = window as unknown as { frames: number }
        const before = w.frames
        window.setTimeout(() => resolve(w.frames - before), 1000)
      }),
  )

/** The animations running on the page, CSS and Web Animations alike, each by its target and its name. */
export const runningAnimations = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const t = a.effect instanceof KeyframeEffect ? a.effect.target : null
        const what =
          a instanceof CSSAnimation
            ? a.animationName
            : a instanceof CSSTransition
              ? a.transitionProperty
              : a.id
        return `${t?.id || t?.getAttribute('class') || t?.tagName || '?'} ${what}`
      }),
  )

/**
 * The drawings the canvas `sel` shows, frame by frame, from two frames on
 * for `ms`: a fingerprint of each new one, in turn. One, where what changed
 * was drawn whole at once and then held still.
 */
export const drawingsOver = (
  page: Page,
  sel: string,
  ms: number,
): Promise<string[]> =>
  page.locator(sel).evaluate(
    (c: HTMLCanvasElement, span) =>
      new Promise<string[]>((resolve) => {
        const seen: string[] = []
        // FNV-1a over the canvas's PNG
        const print = (): string => {
          const s = c.toDataURL()
          let h = 0x811c9dc5
          for (let i = 0; i < s.length; i++)
            h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
          return (h >>> 0).toString(16)
        }
        let t0 = -1
        const look = (now: number): void => {
          if (t0 < 0) t0 = now
          const p = print()
          if (seen.at(-1) !== p) seen.push(p)
          if (now - t0 < span) requestAnimationFrame(look)
          else resolve(seen)
        }
        requestAnimationFrame(() => requestAnimationFrame(look))
      }),
    ms,
  )

/** Nothing moves on its own: the page, once settled, asks for no frame and runs no animation. */
export async function expectStill(page: Page, what: string): Promise<void> {
  await expect
    .poll(() => framesOverASecond(page), {
      timeout: 20_000,
      message: `${what}: frames asked for`,
    })
    .toBe(0)
  expect(await runningAnimations(page), `${what}: animations`).toEqual([])
}

/** `act` changes the canvas `sel` whole in its first frame, which then holds still, as under reduced motion. */
export async function expectAtOnce(
  page: Page,
  sel: string,
  what: string,
  act: () => Promise<void>,
): Promise<void> {
  const [before] = await drawingsOver(page, sel, 0)
  await act()
  const after = await drawingsOver(page, sel, 900)
  expect(after, `${what}: one drawing, from its first frame`).toHaveLength(1)
  expect(after[0], `${what}: drawn`).not.toBe(before)
}

/** Whether the page has kept its scroll still for 300 ms. */
export const scrollStill = (page: Page): Promise<boolean> =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const y = window.scrollY
        window.setTimeout(() => resolve(window.scrollY === y), 300)
      }),
  )

/**
 * Opens step `n` of the lesson at `path` from the address, as a step link
 * does, and waits for the deck's scroll to bring it beside the stage.
 */
export async function openStep(
  page: Page,
  path: string,
  n: number,
): Promise<void> {
  await page.goto(`${path}#step-${n}`)
  await expect(page.locator('#stepNow')).toHaveText(String(n))
  await expect.poll(() => scrollStill(page)).toBe(true)
}
