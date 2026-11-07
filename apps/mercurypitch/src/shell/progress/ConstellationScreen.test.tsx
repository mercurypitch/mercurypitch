// ============================================================
// Voice Constellation, pushed over Progress, and every way back out
// ============================================================
//
// The screen draws the web's own map (VoiceConstellationMap.tsx) under the
// shell's bar: the title, a 44 px Back that pops it, and a swipe from the
// left edge. Android's back closes an open portrait's details first and the
// screen only on the next press. Only the read of the saved voiceprints is
// stood in for.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listVoiceprints: vi.fn(),
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NATIVE_PROGRESS: true,
}))
vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authVersion: () => 0,
}))
vi.mock('@/db/services/voiceprint-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listVoiceprints: mocks.listVoiceprints,
}))

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { popScreen, pushed, pushScreen, resetRunShell, } from '../run-shell-store'
import { performBack } from '../shell-navigation'
import { ShellScreens } from '../ShellScreens'
import { ConstellationScreen } from './ConstellationScreen'

function voiceprint(
  id: string,
  twin: string | null,
  takenAt: string,
): VoiceprintRecord {
  return {
    id,
    twin,
    takenAt,
    source: 'mirror',
    summary: {
      lowMidi: 43,
      highMidi: 72,
      semitones: 29,
      accuracy: 82,
      steadiness: 76,
    },
  }
}

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

let view: RenderedShell | null = null

async function open(): Promise<HTMLElement> {
  view = renderShell(() => (
    <ShellScreens voiceConstellation={ConstellationScreen} />
  ))
  pushScreen('voice-constellation')
  await settle()
  return view.container
}

const portraitDetail = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    '[aria-labelledby="voice-legend-detail-name"]',
  )

beforeEach(() => {
  mocks.listVoiceprints.mockResolvedValue([
    voiceprint('current', 'Freddie Mercury', '2026-08-05T10:00:00.000Z'),
    voiceprint('past', 'Elvis Presley', '2026-07-01T10:00:00.000Z'),
  ])
})

afterEach(() => {
  view?.unmount()
  view = null
  document.body.innerHTML = ''
  resetRunShell()
  mocks.listVoiceprints.mockReset()
})

describe('Voice Constellation on the phone', () => {
  it('draws the web map under the shell bar, titled and with Back', async () => {
    const root = await open()

    const screen = root.querySelector('[data-testid="shell-pushed"]')
    expect(screen?.getAttribute('aria-label')).toBe('Voice constellation')
    expect(root.querySelector('.mp-pushed__title')?.textContent).toBe(
      'Voice constellation',
    )
    expect(
      root
        .querySelector('[data-testid="shell-pushed-back"]')
        ?.getAttribute('aria-label'),
    ).toBe('Back')

    const page = root.querySelector('[data-testid="native-constellation"]')
    expect(page).not.toBeNull()
    // The web route's own chrome is not here: the shell's bar is the way back.
    expect(
      page?.querySelector('[aria-label="Back to MercuryPitch"]'),
    ).toBeNull()
    expect(
      page?.querySelector('[aria-label="Close voice constellation"]'),
    ).toBeNull()
    expect(document.querySelector('[data-voice-constellation]')).toBeNull()

    // The web's map, read from the saved voiceprints.
    expect(page?.querySelectorAll('[data-legend-card]')).toHaveLength(31)
    expect(page?.querySelector('h1')?.textContent).toBe(
      'See where your voice has landed',
    )
    expect(page?.textContent).toContain('Freddie Mercury')
    expect(page?.textContent).toContain('2 saved matches')
    expect(
      page
        ?.querySelector('[data-legend-card="freddie-mercury"] img')
        ?.getAttribute('src'),
    ).toBe('/legends/mid/freddie.webp')
    expect(
      page?.querySelector('[data-legend-card="frank-sinatra"] img'),
    ).toBeNull()
  })

  it('offers no link to a Mirror page the bundle does not carry', async () => {
    mocks.listVoiceprints.mockResolvedValue([])
    const root = await open()
    const page = root.querySelector('[data-testid="native-constellation"]')

    expect(page?.textContent).toContain('Your constellation is waiting.')
    expect(page?.querySelector('a[href="/mirror"]')).toBeNull()
    expect(
      [...(page?.querySelectorAll('a') ?? [])].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['https://about.mercurypitch.com/voice-legends/'])
  })

  it('carries the dock clearance in its own night ground', async () => {
    const root = await open()
    const page = root.querySelector('[data-voice-constellation-page]')
    expect(page?.classList.contains('mp-constellation')).toBe(true)
    // The body is the screen's scroller; the page is its only content.
    expect(
      root.querySelector(
        '.mp-pushed__body > [data-testid="native-constellation"]',
      ),
    ).not.toBeNull()
  })

  it('pops back to the tab from the bar', async () => {
    const root = await open()
    root
      .querySelector<HTMLButtonElement>('[data-testid="shell-pushed-back"]')
      ?.click()
    expect(pushed()).toBeNull()
    expect(
      root.querySelector('[data-testid="native-constellation"]'),
    ).toBeNull()
  })

  it('is the one pushed screen a swipe from the edge takes off', async () => {
    const root = await open()
    const swipes = (): boolean | undefined =>
      root
        .querySelector('[data-testid="shell-pushed"]')
        ?.classList.contains('mp-pushed--swipe')
    expect(swipes()).toBe(true)
    popScreen()
    pushScreen('settings')
    await settle()
    expect(pushed()).toBe('settings')
    expect(swipes()).toBe(false)
  })

  it("closes a portrait's details on Android's back, then the screen", async () => {
    const root = await open()
    root
      .querySelector<HTMLButtonElement>(
        '[aria-label="Open Freddie Mercury portrait details"]',
      )
      ?.click()
    await settle()
    expect(portraitDetail()).not.toBeNull()

    expect(performBack(host())).toBe('room-overlay')
    await settle()
    expect(portraitDetail()).toBeNull()
    expect(pushed()).toBe('voice-constellation')

    expect(performBack(host())).toBe('pushed')
    expect(pushed()).toBeNull()
  })

  it('keeps the portrait details clear of the status bar', async () => {
    const root = await open()
    root
      .querySelector<HTMLButtonElement>(
        '[aria-label="Open Elvis Presley portrait details"]',
      )
      ?.click()
    await settle()
    const detail = portraitDetail()
    expect(detail).not.toBeNull()
    expect(detail?.className).toMatch(/detailBackdropSafe/)
    // Close is the dialog's own; nothing in it leads to /mirror.
    expect(
      detail?.querySelector('[aria-label="Close portrait details"]'),
    ).not.toBeNull()
    expect(detail?.querySelector('a[href="/mirror"]')).toBeNull()
  })
})
