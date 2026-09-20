// ============================================================
// copyVoiceprintLink — the link on its own
// ============================================================
//
// The share for wherever a link is what is wanted: a desktop with no share
// sheet, a chat that drops the text beside a picture. Two things have to
// hold. The clipboard write starts inside the tap (Safari accepts nothing
// later), so it comes before any drawing. And the card is stored only once
// the link is really copied — "it all happens on your device" is a promise.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SharedVoiceprintModule from '@/lib/mirror/shared-voiceprint'
import { MIRROR_SHARE_URL, parseVoiceprintLink, } from '@/lib/mirror/shared-voiceprint'
import type * as CardRendererModule from './card-renderer'

const mocks = vi.hoisted(() => ({
  cardToUnfurlBlob: vi.fn(),
  uploadOgCard: vi.fn(),
}))

vi.mock('./card-renderer', async (original) => ({
  ...(await original<typeof CardRendererModule>()),
  cardToUnfurlBlob: mocks.cardToUnfurlBlob,
}))

vi.mock('@/lib/mirror/shared-voiceprint', async (original) => ({
  ...(await original<typeof SharedVoiceprintModule>()),
  uploadOgCard: mocks.uploadOgCard,
}))

import { copyVoiceprintLink } from './voiceprint-share'

const SUMMARY = {
  lowMidi: 48,
  highMidi: 74,
  semitones: 26,
  accuracy: 87,
  steadiness: 92,
}
const canvas = {} as HTMLCanvasElement
const jpeg = new Blob(['x'], { type: 'image/jpeg' })

function mockClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

/** Let the fire-and-forget draw-and-store chain run out. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  mocks.cardToUnfurlBlob.mockReset().mockResolvedValue(jpeg)
  mocks.uploadOgCard.mockReset()
})

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  })
})

describe('copyVoiceprintLink', () => {
  it('copies a link that opens this take, and stores its card', async () => {
    const copied: string[] = []
    mockClipboard(async (text) => {
      copied.push(text)
    })

    expect(
      await copyVoiceprintLink(SUMMARY, 'Freddie Mercury', () => canvas),
    ).toBe('copied')
    await settle()

    expect(copied).toHaveLength(1)
    const url = new URL(copied[0])
    expect(parseVoiceprintLink(url.search)?.tw).toBe('Freddie Mercury')
    const id = url.searchParams.get('og')
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/)
    // The card stored is the one the link names.
    expect(mocks.uploadOgCard).toHaveBeenCalledWith(id, jpeg)
  })

  it('starts the clipboard write before it draws anything', async () => {
    const order: string[] = []
    mockClipboard(async () => {
      order.push('copy')
    })
    await copyVoiceprintLink(SUMMARY, null, () => {
      order.push('draw')
      return canvas
    })
    await settle()
    expect(order).toEqual(['copy', 'draw'])
  })

  it('stores nothing when the link could not be copied', async () => {
    mockClipboard(() => Promise.reject(new Error('denied')))
    const draw = vi.fn(() => canvas)
    expect(await copyVoiceprintLink(SUMMARY, null, draw)).toBe('failed')
    await settle()
    expect(draw).not.toHaveBeenCalled()
    expect(mocks.uploadOgCard).not.toHaveBeenCalled()
  })

  it('copies the plain Mirror link for a take with nothing to carry', async () => {
    const copied: string[] = []
    mockClipboard(async (text) => {
      copied.push(text)
    })
    const draw = vi.fn(() => canvas)
    expect(await copyVoiceprintLink({}, null, draw)).toBe('copied')
    await settle()
    expect(copied).toEqual([MIRROR_SHARE_URL])
    // No card is named, so none is drawn or stored.
    expect(draw).not.toHaveBeenCalled()
    expect(mocks.uploadOgCard).not.toHaveBeenCalled()
  })

  it('still copies when no card can be drawn', async () => {
    mockClipboard(() => Promise.resolve())
    expect(await copyVoiceprintLink(SUMMARY, null, () => null)).toBe('copied')
    await settle()
    expect(mocks.uploadOgCard).not.toHaveBeenCalled()
  })

  it('swallows a card that fails to draw', async () => {
    mockClipboard(() => Promise.resolve())
    expect(
      await copyVoiceprintLink(SUMMARY, null, () =>
        Promise.reject(new Error('portrait failed to load')),
      ),
    ).toBe('copied')
    await settle()
    expect(mocks.uploadOgCard).not.toHaveBeenCalled()
  })
})
