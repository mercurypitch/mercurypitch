// ============================================================
// The sign-in sheet fits a phone without scrolling
// ============================================================
//
// Owner test on a phone, 2026-10-11: the sheet scrolled. Measured before the
// compact layout at 375x812, sign-up was 759px of content and sign-in 720px,
// against 617px of sheet once Safari's toolbars take their share (a 375x635
// viewport). Field labels took a row each, three method rows came before the
// form, and Cloudflare's widget always took 81px. This spec holds the sheet to
// the phone it was built for, with the toolbars and without.
//
// Cloudflare is stubbed. The production site key answers 110200 on localhost,
// and a stub is the only way to say "no click needed" and "click needed" on
// demand.
//
// This build has no API, so the sheet never offers a passkey here. Measured
// with one on the dev server, "Use a passkey" joins the link row under the
// password without wrapping it, at every size above.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Stands in for challenges.cloudflare.com/turnstile/v0/api.js, drawing what
 * Cloudflare drew in the probes of 2026-10-11. On its default appearance the
 * widget is always on screen: 65px of "Verifying" and then "Success". Asked
 * for 'interaction-only', it draws nothing unless the person has to click,
 * and then a 69px checkbox, announced through before-interactive-callback.
 * Ticked, the checkbox turns into Cloudflare's "Success" at the same 69px,
 * and the token follows. A visitor who needs no click gets a token either way.
 */
const TURNSTILE_STUB = `
window.turnstile = {
  render: function (el, opts) {
    var needsClick = window.__turnstileNeedsClick === true
    if (needsClick || opts.appearance !== 'interaction-only') {
      var box = document.createElement('div')
      box.style.height = needsClick ? '69px' : '65px'
      box.setAttribute('data-stub', needsClick ? 'checkbox' : 'success')
      el.appendChild(box)
    }
    if (needsClick) {
      box.addEventListener('click', function () {
        box.setAttribute('data-stub', 'success')
        if (opts['after-interactive-callback']) opts['after-interactive-callback']()
        opts.callback('stub-token')
      })
      if (opts['before-interactive-callback']) opts['before-interactive-callback']()
    } else {
      setTimeout(function () { opts.callback('stub-token') }, 50)
    }
    return 'stub-widget'
  },
  reset: function () {},
  remove: function () {},
}
`

type Mode = 'login' | 'register'

const TITLES: Record<Mode, string> = {
  login: 'Sign in',
  register: 'Create your account',
}

async function openSheet(
  page: Page,
  mode: Mode,
  needsClick = false,
): Promise<Locator> {
  await page.addInitScript((click) => {
    const w = window as unknown as {
      E2E_TEST_MODE?: boolean
      __turnstileNeedsClick?: boolean
    }
    w.E2E_TEST_MODE = true
    w.__turnstileNeedsClick = click
    // A first visit opens First Light over the app. This is someone who
    // has been here before and taps Sign in.
    localStorage.setItem('pitchperfect_onboarding_done', '1')
  }, needsClick)
  await page.route(/^https:\/\/challenges\.cloudflare\.com\//, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB }),
  )
  await page.goto('/')
  await page.waitForFunction(
    () =>
      typeof (
        window as unknown as {
          __pp?: { appStore?: { openAuthModal?: unknown } }
        }
      ).__pp?.appStore?.openAuthModal === 'function',
  )
  await page.evaluate((which) => {
    const w = window as unknown as {
      __pp: { appStore: { openAuthModal: (m: string) => void } }
    }
    w.__pp.appStore.openAuthModal(which)
  }, mode)
  const dialog = page.getByRole('dialog', { name: TITLES[mode], exact: true })
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  return dialog
}

/** Pixels of the sheet that would have to be scrolled to. */
function hiddenOverflow(dialog: Locator): Promise<number> {
  return dialog.evaluate((el) => el.scrollHeight - el.clientHeight)
}

async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  return box === null ? Number.POSITIVE_INFINITY : box.y + box.height
}

// 375x812 is the phone; 375x635 is the same phone in Safari with both
// toolbars showing, which is what a visitor actually has to fit into.
for (const viewport of [
  { width: 375, height: 812 },
  { width: 375, height: 635 },
]) {
  test.describe(`a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true })

    for (const mode of ['login', 'register'] as const) {
      test(`shows all of ${TITLES[mode]} without scrolling`, async ({
        page,
      }) => {
        const dialog = await openSheet(page, mode)
        // The token is in, so Cloudflare has drawn all it was going to.
        await expect(page.getByTestId('auth-submit')).toBeEnabled()

        await expect.poll(() => hiddenOverflow(dialog)).toBeLessThanOrEqual(0)
        // Polled: the sheet rises into place as it opens.
        await expect
          .poll(() => bottomOf(dialog))
          .toBeLessThanOrEqual(viewport.height)
        expect(await bottomOf(page.getByTestId('auth-submit'))).toBeLessThan(
          viewport.height,
        )
      })
    }
  })
}

interface Inset {
  top: number
  bottom: number
  left: number
}

/**
 * How far inside its box a field's own words sit. Read in one frame: the sheet
 * scales up as it opens, and two separate reads can catch it at two sizes.
 */
function labelInset(field: Locator): Promise<Inset> {
  return field.evaluate((input) => {
    const words = input.nextElementSibling
    if (words === null) {
      return { top: Number.NaN, bottom: Number.NaN, left: Number.NaN }
    }
    const box = input.getBoundingClientRect()
    const label = words.getBoundingClientRect()
    return {
      top: label.top - box.top,
      bottom: box.bottom - label.bottom,
      left: label.left - box.left,
    }
  })
}

test.describe('the compact sheet on a phone', () => {
  test.use({
    viewport: { width: 375, height: 635 },
    isMobile: true,
    hasTouch: true,
  })

  test('draws each label inside its field, and lifts it once typed into', async ({
    page,
  }) => {
    await openSheet(page, 'register')

    // Found by name, so each label still names its field.
    for (const name of ['Display name (optional)', 'Email']) {
      const inset = await labelInset(
        page.getByRole('textbox', { name, exact: true }),
      )
      expect(inset.top).toBeGreaterThan(0)
      expect(inset.bottom).toBeGreaterThan(0)
      expect(inset.left).toBeGreaterThan(0)
    }

    // By test id from here: a typed value can join a field's computed name.
    const email = page.getByTestId('auth-email')
    const resting = await labelInset(email)
    await email.fill('singer@example.com')
    await email.blur()
    // Lifted to the top edge, still inside the box, in the small size.
    await expect
      .poll(async () => (await labelInset(email)).top)
      .toBeLessThan(resting.top)
    expect((await labelInset(email)).top).toBeGreaterThan(0)
    await expect(email.locator('xpath=following-sibling::span[1]')).toHaveCSS(
      'font-size',
      '11px',
    )
  })

  test('keeps the security check out of sight while Cloudflare needs nothing', async ({
    page,
  }) => {
    await openSheet(page, 'register')

    // The token came all the same, so the button is open, and the check has
    // finished drawing whatever it was going to draw.
    await expect(page.getByTestId('auth-submit')).toBeEnabled()
    const host = page.getByTestId('turnstile-host')
    await expect(host).toHaveAttribute('data-turnstile', 'hidden')
    expect((await host.boundingBox())?.height).toBe(0)
  })

  test('draws the check across the form when Cloudflare needs a click, and still fits', async ({
    page,
  }) => {
    const dialog = await openSheet(page, 'register', true)

    await expect(page.getByTestId('turnstile-host')).toHaveAttribute(
      'data-turnstile',
      'drawn',
    )
    // The checkbox itself, not its host: a centred host shrinks the widget
    // to its 300px minimum and leaves it short of the fields around it.
    // Layout widths, which the opening motion does not scale.
    const [checkbox, field] = await dialog.evaluate((el) => [
      el.querySelector<HTMLElement>('[data-stub="checkbox"]')?.offsetWidth,
      el.querySelector<HTMLElement>('[data-testid="auth-email"]')?.offsetWidth,
    ])
    expect(checkbox).toBe(field)
    await expect.poll(() => hiddenOverflow(dialog)).toBeLessThanOrEqual(0)

    // A tap before the click is held, and the button says so, rather than
    // sitting disabled.
    await page.getByTestId('auth-email').fill('singer@example.com')
    await page.getByTestId('auth-password').fill('scales4days')
    const submit = page.getByTestId('auth-submit')
    await submit.click()
    await expect(submit).toHaveText('Checking…')
    await expect(submit).toHaveAttribute('aria-busy', 'true')

    // Ticked: Cloudflare's "Success" stays at 69px, so its spacing stays too.
    // Dropping it lifted the widget 4px and left no gap above the button.
    const host = page.getByTestId('turnstile-host')
    await page.locator('[data-stub="checkbox"]').click()
    await expect(page.locator('[data-stub="success"]')).toBeVisible()
    await expect(host).toHaveAttribute('data-turnstile', 'drawn')
    const gap = await dialog.evaluate((el) => {
      const h = el.querySelector('[data-testid="turnstile-host"]')
      const b = el.querySelector('[data-testid="auth-submit"]')
      if (h === null || b === null) return Number.NaN
      return b.getBoundingClientRect().top - h.getBoundingClientRect().bottom
    })
    expect(gap).toBeCloseTo(12, 0)
    await expect(submit).not.toHaveText('Checking…')
  })
})

// The narrowest phone still sold. Cloudflare's checkbox is never narrower
// than 300px, and inside the usual padding the form was 274px, so a drawn
// check scrolled the sheet sideways by 12px (review of PR #979).
test.describe('a 320x568 phone', () => {
  test.use({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  })

  for (const mode of ['login', 'register'] as const) {
    test(`fits a drawn check across ${TITLES[mode]} without sideways scroll`, async ({
      page,
    }) => {
      const dialog = await openSheet(page, mode, true)
      await expect(page.getByTestId('turnstile-host')).toHaveAttribute(
        'data-turnstile',
        'drawn',
      )
      const [form, overflowX] = await dialog.evaluate((el) => [
        el.querySelector<HTMLElement>('[data-testid="auth-email"]')
          ?.offsetWidth,
        el.scrollWidth - el.clientWidth,
      ])
      expect(form).toBeGreaterThanOrEqual(300)
      expect(overflowX).toBeLessThanOrEqual(0)
    })
  }
})

interface Band {
  top: number
  bottom: number
}

/**
 * Where a field's label words and its typed text sit, top to bottom, as em
 * boxes measured from the top of the input. The text is centered in the
 * input's content box; the words in their own line box. Read in one frame.
 */
function wordsAndText(
  field: Locator,
): Promise<{ words: Band; text: Band; inputTop: number; height: number }> {
  return field.evaluate((el) => {
    const input = el as HTMLInputElement
    const words = input.closest('label')?.querySelector(':scope > span')
    if (words == null) throw new Error('field has no words')
    const box = input.getBoundingClientRect()
    const cs = getComputedStyle(input)
    const contentTop =
      box.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop)
    const contentBottom =
      box.bottom -
      parseFloat(cs.borderBottomWidth) -
      parseFloat(cs.paddingBottom)
    const textSize = parseFloat(cs.fontSize)
    const textTop = (contentTop + contentBottom - textSize) / 2 - box.top
    const line = words.getBoundingClientRect()
    const wordsSize = parseFloat(getComputedStyle(words).fontSize)
    const wordsTop = (line.top + line.bottom - wordsSize) / 2 - box.top
    return {
      words: { top: wordsTop, bottom: wordsTop + wordsSize },
      text: { top: textTop, bottom: textTop + textSize },
      inputTop: box.top,
      height: box.height,
    }
  })
}

/** Pixels the two bands share. Zero or less is clear of each other. */
function overlap(a: Band, b: Band): number {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
}

// Owner test on a desktop, 2026-10-11: as Proton Pass opened its menu beside
// the email field, the word "Email" dropped down over the address already in
// it. Proton Pass puts its icon element straight after the input (it steps
// past the next sibling only when that is a <label>) and pins the input's
// padding-right. The sheet's `.input + .floatLabel` rules stopped matching
// once anything sat between the two, focused or not. This does what Proton
// Pass does, with a value written the way an extension can write it, without
// an input event, and then moves on to the next field.
test.describe('a password manager filling the sheet on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

  for (const [id, next] of [
    ['auth-email', 'auth-password'],
    ['auth-password', 'auth-email'],
  ] as const) {
    test(`keeps the ${id} label off the filled text once its icon arrives`, async ({
      page,
    }) => {
      const dialog = await openSheet(page, 'login')
      // Settled first: the sheet scales up as it opens.
      await dialog.evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished)),
      )
      const field = page.getByTestId(id)
      await field.focus()
      await field.evaluate((el) => {
        ;(el as HTMLInputElement).value = 'singer@example.com'
      })
      const before = await wordsAndText(field)

      await field.evaluate((el) => {
        const icon = document.createElement('protonpass-control-e2e')
        icon.style.setProperty('position', 'absolute', 'important')
        icon.style.setProperty('top', '12px')
        icon.style.setProperty('right', '10px')
        icon.style.setProperty('width', '24px')
        icon.style.setProperty('height', '24px')
        el.after(icon)
        el.style.setProperty('padding-right', '44px', 'important')
      })
      await page.getByTestId(next).focus()
      await expect(field).not.toBeFocused()

      // The label eases between its two places: measure where it comes to
      // rest, not where it set off from.
      await field.evaluate(async (el) => {
        await new Promise((done) => requestAnimationFrame(done))
        const words = el.closest('label')?.querySelector(':scope > span')
        await Promise.all(words?.getAnimations().map((a) => a.finished) ?? [])
      })
      const after = await wordsAndText(field)
      expect(overlap(after.words, after.text)).toBeLessThanOrEqual(0)
      expect(after.words.top).toBeGreaterThan(0)
      // The field holds still: nothing the icon brings moves or grows it.
      expect(after.inputTop).toBe(before.inputTop)
      expect(after.height).toBe(before.height)
    })
  }
})
