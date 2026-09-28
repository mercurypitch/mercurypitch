// ============================================================
// Settings, Karaoke: Play review access
// ============================================================
//
// Google Play's reviewer types the code from Play Console's "App access"
// field; the songs left update when the server grants them. Android only:
// iOS sells through in-app purchase and nothing else (App Store 3.1.1).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReviewAccess from '@/features/karaoke-room/karaoke-review-access'
import type { ReviewAccessOutcome } from '@/features/karaoke-room/karaoke-review-access'

const device = vi.hoisted(() => ({ platform: 'android' }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => device.platform },
}))

const server = vi.hoisted(() => ({
  answer: { kind: 'granted', songs: 3 } as ReviewAccessOutcome,
  codes: [] as string[],
  refreshes: 0,
}))
vi.mock(
  '@/features/karaoke-room/karaoke-review-access',
  async (importOriginal) => ({
    ...(await importOriginal<typeof ReviewAccess>()),
    redeemReviewAccess: vi.fn(async (code: string) => {
      server.codes.push(code)
      return Promise.resolve(server.answer)
    }),
  }),
)
vi.mock('@/features/karaoke-room/karaoke-songs', () => ({
  refreshKaraokeSongs: vi.fn(async () => {
    server.refreshes += 1
    return Promise.resolve({
      left: 3,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
  }),
}))

import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { KaraokeReviewAccess, reviewAccessShown } from './KaraokeReviewAccess'

let view: RenderedShell | null = null

beforeEach(() => {
  device.platform = 'android'
  server.answer = { kind: 'granted', songs: 3 }
  server.codes = []
  server.refreshes = 0
})

afterEach(() => {
  view?.unmount()
  view = null
})

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

function mount(): HTMLElement {
  view = renderShell(() => <KaraokeReviewAccess />)
  return view.container
}

function openAndType(root: HTMLElement, code: string): void {
  root
    .querySelector<HTMLElement>('[data-settings-row="karaoke-review-access"]')
    ?.click()
  const input = root.querySelector<HTMLInputElement>(
    '[data-testid="karaoke-review-code"]',
  )
  if (input === null) throw new Error('no code field')
  input.value = code
  input.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

function submit(root: HTMLElement): void {
  root
    .querySelector<HTMLFormElement>(
      '[data-testid="karaoke-review-access-form"]',
    )
    ?.requestSubmit()
}

describe('review access, on which phones', () => {
  it('is on Android', () => {
    expect(reviewAccessShown('android')).toBe(true)
  })

  it('is never on iOS or the web', () => {
    expect(reviewAccessShown('ios')).toBe(false)
    expect(reviewAccessShown('web')).toBe(false)
  })

  it('asks the phone it runs on when nothing is said', () => {
    device.platform = 'ios'
    expect(reviewAccessShown()).toBe(false)
    device.platform = 'android'
    expect(reviewAccessShown()).toBe(true)
  })
})

describe('Settings, Karaoke: review access', () => {
  it('opens a field for the code, and sends it as typed', async () => {
    const root = mount()
    expect(root.querySelector('[data-testid="karaoke-review-code"]')).toBeNull()

    openAndType(root, ' REVIEW-TEST-CODE ')
    submit(root)
    await settle()

    expect(server.codes).toEqual(['REVIEW-TEST-CODE'])
    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      '3 songs are yours.',
    )
    expect(server.refreshes).toBe(1)
    expect(
      root.querySelector<HTMLInputElement>(
        '[data-testid="karaoke-review-code"]',
      )?.value,
    ).toBe('')
  })

  it('says why, keeps what was typed, and asks for no songs, when refused', async () => {
    server.answer = { kind: 'refused', why: 'That code is not right.' }
    const root = mount()

    openAndType(root, 'REVIEW-WRONG')
    submit(root)
    await settle()

    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'That code is not right.',
    )
    expect(server.refreshes).toBe(0)
    expect(
      root.querySelector<HTMLInputElement>(
        '[data-testid="karaoke-review-code"]',
      )?.value,
    ).toBe('REVIEW-WRONG')
  })

  it('sends nothing for an empty field', async () => {
    const root = mount()

    openAndType(root, '   ')
    submit(root)
    await settle()

    expect(server.codes).toEqual([])
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="karaoke-review-redeem"]',
      )?.disabled,
    ).toBe(true)
  })

  it('says an account that had its songs already has them', async () => {
    server.answer = { kind: 'already' }
    const root = mount()

    openAndType(root, 'REVIEW-TEST-CODE')
    submit(root)
    await settle()

    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'This account has its review songs already.',
    )
  })
})
