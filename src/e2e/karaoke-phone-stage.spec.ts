// ============================================================
// Karaoke on a phone: the stage, its More, and its key sheet
// ============================================================
//
// Phase 3 of the karaoke mixer rail plan, checked where only a browser can,
// on a touch screen (hasTouch and isMobile, so `pointer: coarse` matches):
//
//   - a phone gets the phone stage upright and on its side (844x390 and
//     780x360 are wider than the 768 px breakpoint, and got the desktop
//     mixer);
//   - every control on screen is at least 44 px, nothing runs past the
//     window, and the times read as played and length;
//   - More holds speed and the A/B loop in 44 px targets, refuses B on A
//     inside the sheet, and the bar draws the loop;
//   - the key sheet keeps Find my key on screen once it has named the key,
//     and says its answer inside the sheet, not in a toast over it;
//   - the mixer tour is not offered on the stage, so its one offer is kept.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

interface SongSeed {
  seedSong: (input: {
    name: string
    fileHash: string
    vocalWavBase64: string
  }) => Promise<string>
}

/**
 * A sung-like line as a mono 8 kHz WAV, base64 for page.evaluate: one note
 * per 0.7 s, a sine and two harmonics, so the pitch analysis finds a melody
 * and a key.
 */
function melodyWavBase64(seconds: number, midis: readonly number[]): string {
  const rate = 8000
  const samples = Math.floor(rate * seconds)
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)
  const noteSec = 0.6
  const step = 0.7
  let phase = 0
  for (let index = 0; index < samples; index += 1) {
    const t = index / rate
    const n = Math.floor(t / step)
    const inNote = t - n * step
    let value = 0
    if (inNote < noteSec) {
      const midi = midis[n % midis.length]
      phase += (2 * Math.PI * 440 * Math.pow(2, (midi - 69) / 12)) / rate
      const envelope = Math.min(1, inNote / 0.02, (noteSec - inNote) / 0.02)
      value =
        (envelope *
          (Math.sin(phase) +
            0.4 * Math.sin(2 * phase) +
            0.2 * Math.sin(3 * phase))) /
        1.6
    }
    buf.writeInt16LE(Math.round(value * 0.35 * 32767), 44 + index * 2)
  }
  return buf.toString('base64')
}

const SONG = {
  name: 'Phone Stage Song',
  fileHash: 'phone-stage-song',
  vocalWavBase64: melodyWavBase64(30, [62, 66, 69, 74, 78, 74, 69, 66]),
}

const PHONES = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 780, height: 360 },
] as const

const STAGE = '[data-testid="karaoke-mobile-stage"]'

test.use({ hasTouch: true, isMobile: true })

/** The song, seeded and opened on the phone stage; the tour never offered. */
async function openOnPhone(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport)
  // This server only. As the stage opens it asks lrclib.net for lyrics and
  // huggingface.co for a model; a run that waited on either would hang on
  // the network. Refused, both fail at once, as they do offline.
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(
    () =>
      (window as unknown as { __ppSongSeed?: unknown }).__ppSongSeed !==
      undefined,
  )
  const sessionId = await page.evaluate(
    (song) =>
      (window as unknown as { __ppSongSeed: SongSeed }).__ppSongSeed.seedSong(
        song,
      ),
    SONG,
  )
  await page.goto(`/#/karaoke/session/${sessionId}/mixer`)
  await dismissOverlays(page)
  await expect(page.locator(STAGE)).toContainText('0:30', { timeout: 20_000 })
}

interface Control {
  name: string
  w: number
  h: number
}

/** Every painted control under `selector` that is in the window. */
function controlsIn(page: Page, selector: string): Promise<Control[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel)
    if (root === null) throw new Error(`nothing matches ${sel}`)
    return [
      ...root.querySelectorAll<HTMLElement>(
        'button, [role="slider"], [role="radio"], [role="switch"]',
      ),
    ]
      .filter((element) => {
        const r = element.getBoundingClientRect()
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.bottom > 0 &&
          r.top < innerHeight &&
          getComputedStyle(element).visibility !== 'hidden'
        )
      })
      .map((element) => {
        const r = element.getBoundingClientRect()
        return {
          name:
            element.getAttribute('aria-label') ??
            element.textContent?.trim() ??
            '',
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
        }
      })
  }, selector)
}

const under44 = (controls: Control[]): string[] =>
  controls
    .filter((control) => Math.min(control.w, control.h) < 44)
    .map((control) => `${control.name} ${control.w}x${control.h}`)

for (const phone of PHONES) {
  test.describe(`a phone at ${phone.width}x${phone.height}`, () => {
    test.beforeEach(({ page }) => openOnPhone(page, phone))

    test('gets the phone stage, every control 44 px or more, and times as played and length', async ({
      page,
    }) => {
      const layout = await page.evaluate((sel) => {
        const times = document
          .querySelector(sel)
          ?.querySelectorAll('[class*="times"] span')
        return {
          desktopMixer: document.querySelector('.sm-transport') !== null,
          overflowX: document.documentElement.scrollWidth - innerWidth,
          times: [...(times ?? [])].map((span) => span.textContent?.trim()),
        }
      }, STAGE)

      expect(layout).toEqual({
        desktopMixer: false,
        overflowX: 0,
        times: ['0:00', '0:30'],
      })
      expect(under44(await controlsIn(page, STAGE))).toEqual([])
    })

    test('does not offer the mixer tour on the stage, and keeps the offer', async ({
      page,
    }) => {
      // The offer is made as the mixer mounts, and the stage has mounted.
      const offer = await page.evaluate(() => ({
        stored: localStorage.getItem('pitchperfect_mixer_tour_offered'),
        toast: [
          ...document.querySelectorAll(
            '[role="region"][aria-label="Notifications"] > *',
          ),
        ].some((toast) => /tour/i.test(toast.textContent ?? '')),
      }))

      expect(offer).toEqual({ stored: null, toast: false })
    })

    test('sets an A/B loop and a speed from More, refusing B on A inside the sheet', async ({
      page,
    }) => {
      const stage = page.locator(STAGE)
      await stage.getByRole('button', { name: 'More', exact: true }).click()
      const sheet = page.getByRole('dialog', { name: 'More' })
      await expect(sheet).toBeVisible()
      expect(under44(await controlsIn(page, '[role="dialog"]'))).toEqual([])
      expect(
        await sheet.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBe(0)

      // At 0:00, A, then B on top of it: refused, and said in the sheet.
      await sheet.getByRole('button', { name: 'Set A' }).click()
      await sheet.getByRole('button', { name: 'Set B' }).click()
      await expect(sheet.getByTestId('karaoke-more-loop-status')).toHaveText(
        'The loop end (B) has to be at least 0.1 s after its start (A).',
      )
      const loopSwitch = sheet.getByRole('switch', { name: 'Loop A to B' })
      await expect(loopSwitch).toBeDisabled()

      // Ten seconds on, by the bar's own keys, and B again.
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      const bar = stage.getByRole('slider', { name: 'Playback position' })
      await bar.focus()
      await page.keyboard.press('PageUp')
      await expect(bar).toHaveAttribute('aria-valuenow', '10')
      await stage.getByRole('button', { name: 'More', exact: true }).click()
      await sheet.getByRole('button', { name: 'Set B' }).click()

      await expect(sheet.getByTestId('karaoke-more-point-b')).toHaveText(
        '0:10.0',
      )
      await expect(loopSwitch).toBeEnabled()
      await expect(loopSwitch).toHaveAttribute('aria-checked', 'true')
      await sheet.getByRole('radio', { name: '1.5x' }).click()
      await expect(sheet.getByRole('radio', { name: '1.5x' })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await page.keyboard.press('Escape')
      await expect(stage.getByTestId('scrubber-loop-b')).toHaveAttribute(
        'style',
        /left: 33\.3/,
      )
    })
  })
}

/** Opens the key sheet and runs Find my key, picking a bass voice. */
async function findMyKey(page: Page) {
  await page.getByTestId('mobile-key-shift').click()
  const sheet = page.getByRole('dialog', { name: 'Key' })
  await sheet.getByRole('button', { name: 'Find my key' }).click()
  // No range known yet: Find my key asks for a voice first.
  await page.locator('[data-voice="bass"]').click()
  return sheet
}

/** The toasts on screen over the sheet's box. */
function toastsOver(page: Page): Promise<number> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Key"]')
    if (dialog === null) throw new Error('the key sheet is not open')
    const box = dialog.getBoundingClientRect()
    return [
      ...document.querySelectorAll(
        '[role="region"][aria-label="Notifications"] > *',
      ),
    ]
      .map((toast) => toast.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.bottom > box.top && r.top < box.bottom)
      .length
  })
}

test.describe('the key sheet at 360x780, once Find my key has named the key', () => {
  // A phone streams the vocal, and a streamed vocal is never analysed on
  // the phone: there the key is named only for a song with stored notes.
  // A browser of desktop class at the same width decodes the song whole
  // and finds its melody, which names the key the way stored notes do. The
  // sheet is the same sheet either way.
  test.use({ isMobile: false })
  test.beforeEach(({ page }) => openOnPhone(page, PHONES[0]))

  test('keeps Find my key on screen, the key on its own line, and answers in the sheet', async ({
    page,
  }) => {
    const sheet = await findMyKey(page)

    await expect(page.getByTestId('mobile-key-shift')).not.toHaveAttribute(
      'aria-label',
      /^Key 0\b/,
      { timeout: 20_000 },
    )
    await expect(sheet.getByRole('status')).toContainText('fits your voice')
    const layout = await sheet.evaluate((dialog) => {
      const label = dialog.querySelector('[data-testid="key-shift-label"]')
      const buttons = [
        ...dialog.querySelectorAll('[data-testid="key-shift-control"] button'),
      ].map((button) => button.getBoundingClientRect())
      return {
        overflowX: dialog.scrollWidth - dialog.clientWidth,
        findInside: buttons.every((r) => r.right <= innerWidth),
        labelOwnLine:
          label !== null &&
          buttons.every(
            (r) => r.top >= label.getBoundingClientRect().bottom - 0.5,
          ),
        steps44: buttons
          .slice(0, 3)
          .every((r) => r.width >= 44 && r.height >= 44),
      }
    })

    expect({ ...layout, toastsOver: await toastsOver(page) }).toEqual({
      overflowX: 0,
      findInside: true,
      labelOwnLine: true,
      steps44: true,
      toastsOver: 0,
    })
  })
})

test.describe('the key sheet on a phone that streams the song, 360x780', () => {
  test.beforeEach(({ page }) => openOnPhone(page, PHONES[0]))

  test('says why Find my key cannot find the melody, in the sheet and not over it', async ({
    page,
  }) => {
    const sheet = await findMyKey(page)

    await expect(sheet.getByRole('status')).toHaveText(
      "Find my key needs the song's melody, and it cannot be found on this device. Set the key with \u2212 and + instead.",
    )
    expect(await toastsOver(page)).toBe(0)
  })
})
