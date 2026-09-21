// ============================================================
// VoiceSection Component Tests — portrait and stats-card transitions
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthToken } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'

const mocks = vi.hoisted(() => ({
  copyVoiceprintRecordLink: vi.fn(),
  listVoiceprints: vi.fn(),
  renderVoiceprintCard: vi.fn(),
  shareVoiceprintRecord: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: mocks.listVoiceprints,
  listAdoptableVoiceprints: vi.fn(() => []),
  adoptionNoticeDue: vi.fn(() => false),
  adoptDeviceVoiceprints: vi.fn(async () => 0),
  declineAdoption: vi.fn(),
}))

vi.mock('@/features/mirror/LegendCaricature', () => ({
  legendArt: (legend: string) => ({
    imageSrc: `/legends/${legend.toLowerCase().replaceAll(' ', '-')}.webp`,
  }),
  legendThumbSrc: (legend: string) =>
    `/legends/thumbs/${legend.toLowerCase().replaceAll(' ', '-')}.webp`,
  LegendCaricature: () => null,
}))

vi.mock('@/features/mirror/voiceprint-share', () => ({
  copyVoiceprintRecordLink: mocks.copyVoiceprintRecordLink,
  renderVoiceprintCard: mocks.renderVoiceprintCard,
  shareVoiceprintRecord: mocks.shareVoiceprintRecord,
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mocks.trackEvent,
}))

vi.mock('@/features/voice-constellation/navigation', () => ({
  openVoiceConstellation: vi.fn(),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

import { showNotification } from '@/stores/notifications-store'
import { VoiceSection } from '../account/VoiceSection'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function record(id: string, twin: string): VoiceprintRecord {
  return {
    id,
    twin,
    source: 'mirror',
    takenAt: '2026-08-05T12:00:00.000Z',
    summary: {
      lowMidi: 48,
      highMidi: 72,
      semitones: 24,
      accuracy: 88,
      steadiness: 91,
    },
  }
}

function statsCanvas(src: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'toDataURL').mockReturnValue(src)
  return canvas
}

const freddie = record('voiceprint-freddie', 'Freddie Mercury')
const bowie = record('voiceprint-bowie', 'David Bowie')

let currentPrints: VoiceprintRecord[]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  currentPrints = [bowie]
  mocks.listVoiceprints.mockImplementation(async () => currentPrints)
  mocks.shareVoiceprintRecord.mockResolvedValue('shared')
})

// A desktop has no share sheet, so Share there only ever saved a picture and
// the link that opens the voiceprint had no way out of this page.
describe('VoiceSection — copy link', () => {
  it('copies the latest voiceprint’s link and says so', async () => {
    mocks.copyVoiceprintRecordLink.mockResolvedValue('copied')
    render(() => <VoiceSection signedIn />)

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))

    await waitFor(() => {
      expect(mocks.copyVoiceprintRecordLink).toHaveBeenCalledWith(bowie)
    })
    expect(showNotification).toHaveBeenCalledWith(
      expect.stringMatching(/link copied/i),
      'success',
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('voice_link_copied')
  })

  it('says when the link could not be copied, rather than nothing', async () => {
    mocks.copyVoiceprintRecordLink.mockResolvedValue('failed')
    render(() => <VoiceSection signedIn />)

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.stringMatching(/could not be copied/i),
        'error',
      )
    })
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })
})

// Until 0.9.12 this page reported nothing at all: every share and every copy
// here was invisible in the funnel, and the Mirror's own names could not be
// borrowed — `card_shared` is a live Ads conversion that has to keep meaning
// a share from the Voice Mirror.
describe('VoiceSection — share metrics', () => {
  it.each(['shared', 'downloaded', 'downloaded-link-copied'] as const)(
    'counts a share that left as %s',
    async (outcome) => {
      mocks.shareVoiceprintRecord.mockResolvedValue(outcome)
      render(() => <VoiceSection signedIn />)

      fireEvent.click(await screen.findByRole('button', { name: 'Share' }))

      await waitFor(() => {
        expect(mocks.trackEvent).toHaveBeenCalledWith('voice_share')
      })
    },
  )

  it.each(['dismissed', 'unavailable'] as const)(
    'counts nothing when the share ended as %s',
    async (outcome) => {
      mocks.shareVoiceprintRecord.mockResolvedValue(outcome)
      render(() => <VoiceSection signedIn />)

      fireEvent.click(await screen.findByRole('button', { name: 'Share' }))

      await waitFor(() => {
        expect(mocks.shareVoiceprintRecord).toHaveBeenCalled()
      })
      expect(mocks.trackEvent).not.toHaveBeenCalled()
    },
  )
})

describe('VoiceSection portrait flip', () => {
  it('keeps the selected portrait visible until its stats card is ready', async () => {
    const bowieCard = deferred<HTMLCanvasElement | null>()
    mocks.renderVoiceprintCard.mockReturnValue(bowieCard.promise)
    render(() => <VoiceSection signedIn />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'See David Bowie full size',
      }),
    )
    const portrait = screen.getByAltText('David Bowie — your voice twin')
    fireEvent.click(portrait)

    await waitFor(() => {
      expect(mocks.renderVoiceprintCard).toHaveBeenCalledWith(bowie, 'stats')
    })
    expect(screen.getByAltText('David Bowie — your voice twin')).toBeTruthy()
    expect(
      screen.queryByAltText('David Bowie — your voiceprint card'),
    ).toBeNull()

    bowieCard.resolve(statsCanvas('data:image/png;base64,bowie'))
    const stats = await screen.findByAltText(
      'David Bowie — your voiceprint card',
    )
    expect(stats).toHaveAttribute('src', 'data:image/png;base64,bowie')
  })

  it('never exposes a retained stats card from the previous voiceprint', async () => {
    const freddieCard = deferred<HTMLCanvasElement | null>()
    const bowieCard = deferred<HTMLCanvasElement | null>()
    mocks.renderVoiceprintCard.mockImplementation((print: VoiceprintRecord) =>
      print.id === freddie.id ? freddieCard.promise : bowieCard.promise,
    )
    currentPrints = [freddie]
    render(() => <VoiceSection signedIn />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'See Freddie Mercury full size',
      }),
    )
    fireEvent.click(screen.getByAltText('Freddie Mercury — your voice twin'))
    freddieCard.resolve(statsCanvas('data:image/png;base64,freddie'))
    expect(
      await screen.findByAltText('Freddie Mercury — your voiceprint card'),
    ).toHaveAttribute('src', 'data:image/png;base64,freddie')

    fireEvent.click(screen.getByRole('dialog'))
    currentPrints = [bowie]
    setAuthToken(null)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'See David Bowie full size',
      }),
    )
    fireEvent.click(screen.getByAltText('David Bowie — your voice twin'))

    await waitFor(() => {
      expect(mocks.renderVoiceprintCard).toHaveBeenCalledWith(bowie, 'stats')
    })
    expect(
      document.querySelector('img[src="data:image/png;base64,freddie"]'),
    ).toBeNull()
    expect(screen.getByAltText('David Bowie — your voice twin')).toBeTruthy()

    bowieCard.resolve(statsCanvas('data:image/png;base64,bowie'))
    expect(
      await screen.findByAltText('David Bowie — your voiceprint card'),
    ).toHaveAttribute('src', 'data:image/png;base64,bowie')
  })

  it('hides the previous account portrait while keyed history reloads', async () => {
    const nextAccount = deferred<VoiceprintRecord[]>()
    mocks.listVoiceprints
      .mockResolvedValueOnce([freddie])
      .mockReturnValueOnce(nextAccount.promise)

    render(() => <VoiceSection signedIn />)

    const freddieButton = await screen.findByRole('button', {
      name: 'See Freddie Mercury full size',
    })
    fireEvent.click(freddieButton)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'Freddie Mercury portrait',
    )

    setAuthToken('next-account')
    await waitFor(() => expect(mocks.listVoiceprints).toHaveBeenCalledTimes(2))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: 'See Freddie Mercury full size',
      }),
    ).toBeNull()
    expect(document.querySelector('img[src*="freddie-mercury"]')).toBeNull()
    expect(screen.getByText('Checking your saved voiceprints…')).toBeTruthy()

    nextAccount.resolve([bowie])
    expect(
      await screen.findByRole('button', {
        name: 'See David Bowie full size',
      }),
    ).toBeTruthy()
    expect(screen.queryByText('Freddie Mercury')).toBeNull()
  })
})
