// Audio choice integration tests exercise real admission and adapters with fake billing and preparation ports.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setUvrProcessingMode } from '@/stores/uvr-store'
import { nightAudioActions } from './night-audio-actions'
import { readNightAudioPreferences } from './night-audio-preferences'
import { NightMusicImport } from './NightMusicImport'
import type { NightMusicImportController } from './useNightMusicImport'
import { useNightMusicImport } from './useNightMusicImport'

const port = vi.hoisted(() => ({
  signedIn: false,
  accountId: 'one',
  balance: 10 as number | null,
  prices: { roformer: 2, 'demucs-6s': 4 } as Record<string, number> | null,
  parts: [] as string[],
  sessionId: null as string | null,
  prepare: vi.fn(),
  openSong: vi.fn(),
  separateBand: vi.fn(),
  resolveAccess: vi.fn(),
  inspect: vi.fn(),
  bumpAuth: () => {},
}))
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => port.signedIn,
  currentAccountId: () => (port.signedIn ? port.accountId : null),
}))
vi.mock('@/db/services/user-service', async () => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  port.bumpAuth = () => setVersion((value) => value + 1)
  return { authVersion: version }
})
vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: async () =>
    port.balance === null ? null : { creditBalance: port.balance },
  fetchPricing: async () =>
    port.prices === null ? null : { uvrModelCredits: port.prices },
}))
vi.mock('@/db/services/uvr-service', () => ({
  findSessionByFileHash: async () => {
    await port.inspect()
    return port.sessionId === null
      ? null
      : { sessionId: port.sessionId, status: 'completed' }
  },
}))
vi.mock('@/db/services/uvr-read-service', () => ({
  readUvrStemManifest: async () => port.parts,
}))
vi.mock('@/lib/file-hash', () => ({ computeFileHash: async () => 'hash' }))
vi.mock('@/lib/audio-duration', () => ({ audioDurationSecs: async () => 180 }))
vi.mock('@/stores/billing-store', () => ({ balanceVersion: () => 0 }))
vi.mock('@/stores/uvr-store', async () => {
  const { createSignal } = await import('solid-js')
  const [mode, setMode] = createSignal<'local' | 'server'>('local')
  return {
    uvrProcessingMode: mode,
    setUvrProcessingMode: setMode,
    refreshUvrSessionFromDb: async () => true,
    getUvrSession: () => ({ stemMeta: { instrumental: { duration: 180 } } }),
  }
})

function setup(options: { blockedReason?: () => string | null } = {}) {
  let controller!: NightMusicImportController
  render(() => {
    controller = useNightMusicImport({
      room: 'guitar',
      currentTitle: () => 'Old song',
      sourceKey: () => 'old',
      blockedReason: options.blockedReason,
      onResolveAccess: port.resolveAccess,
      actions: (file) =>
        file
          ? nightAudioActions(file, {
              target: 'guitar',
              loadPreparationPort: async () => ({ prepare: port.prepare }),
              openSong: port.openSong,
              separateBand: port.separateBand,
            })
          : [],
    })
    return <NightMusicImport controller={controller} />
  })
  const receive = () =>
    controller.receive([new File(['wav'], 'idea.wav', { type: 'audio/wav' })])
  receive()
  return { controller, receive }
}
const vocals = () => screen.getByRole('button', { name: /^Prepare vocals/ })
const band = () => screen.getByRole('button', { name: /^Separate guitar/ })
const cloud = () => screen.getByRole('button', { name: /^Cloud/ })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  Object.assign(port, {
    signedIn: false,
    accountId: 'one',
    balance: 10,
    prices: { roformer: 2, 'demucs-6s': 4 },
    parts: [],
    sessionId: null,
  })
  port.inspect.mockResolvedValue(undefined)
  port.prepare.mockResolvedValue({ status: 'completed', sessionId: 'new' })
  port.openSong.mockResolvedValue(undefined)
  port.separateBand.mockResolvedValue(undefined)
  setUvrProcessingMode('local')
})
afterEach(cleanup)

describe('Night audio choices', () => {
  it('queues first, explains the local/cloud boundary and offers sign-in before any work', async () => {
    const { controller } = setup()
    await waitFor(() => expect(vocals()).toBeEnabled())
    expect(band()).toBeDisabled()
    expect(port.prepare).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    fireEvent.click(cloud())
    expect(vocals()).toBeDisabled()
    expect(band()).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Sign in' })).toHaveLength(1)
    expect(screen.getAllByText(/Cloud requires sign-in/)).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]!)
    expect(port.resolveAccess).toHaveBeenCalledWith('account')
    expect(controller.file()?.name).toBe('idea.wav')
    expect(screen.queryByRole('dialog')).toBeNull()
    port.signedIn = true
    port.bumpAuth()
    controller.open()
    await waitFor(() => expect(band()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('checks the total before enabling band and does not start the local first stage when unaffordable', async () => {
    port.signedIn = true
    port.balance = 5
    setUvrProcessingMode('server')
    setup()
    await waitFor(() => expect(vocals()).toBeEnabled())
    expect(band()).toBeDisabled()
    expect(screen.getByText(/This needs 6 credits/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Get credits' }),
    ).toBeInTheDocument()
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('rechecks admission at click time and rejects a balance that changed after the quote', async () => {
    port.signedIn = true
    setUvrProcessingMode('server')
    setup()
    await waitFor(() => expect(band()).toBeEnabled())
    port.balance = 1
    fireEvent.click(band())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This needs 6 credits',
      ),
    )
    expect(port.prepare).not.toHaveBeenCalled()
    expect(port.separateBand).not.toHaveBeenCalled()
  })
  it('passes Cloud through the preparation port and then runs the band stage exactly once', async () => {
    port.signedIn = true
    setUvrProcessingMode('server')
    setup()
    await waitFor(() => expect(band()).toBeEnabled())
    fireEvent.click(band())
    await waitFor(() => expect(port.separateBand).toHaveBeenCalledOnce())
    expect(port.prepare).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ mode: 'server' }),
    )
    expect(port.openSong).not.toHaveBeenCalled()
  })
  it('reuses a complete saved band while signed out', async () => {
    port.sessionId = 'saved'
    port.parts = [
      'vocal',
      'instrumental',
      'guitar',
      'bass',
      'drums',
      'piano',
      'other',
    ]
    setUvrProcessingMode('server')
    setup()
    await waitFor(() => expect(band()).toBeEnabled())
    expect(screen.getAllByText(/No separation or credits needed/)).toHaveLength(
      1,
    )
  })
  it('offers Retry for an unknown balance and updates after recovery without automatically running', async () => {
    port.signedIn = true
    port.balance = null
    setUvrProcessingMode('server')
    setup()
    await screen.findAllByRole('button', { name: 'Retry check' })
    expect(band()).toBeDisabled()
    port.balance = 10
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry check' })[0]!)
    await waitFor(() => expect(band()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('remembers the opt-in, but applying it to the current song still needs an explicit choice', async () => {
    const { controller, receive } = setup()
    await waitFor(() => expect(vocals()).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    expect(readNightAudioPreferences('guitar').auto).toBe(true)
    expect(port.prepare).not.toHaveBeenCalled()
    fireEvent.click(vocals())
    await waitFor(() => expect(controller.running()).toBe(false))
    expect(port.prepare).toHaveBeenCalledOnce()
    receive()
    await waitFor(() => expect(port.prepare).toHaveBeenCalledTimes(2))
    expect(port.prepare).toHaveBeenLastCalledWith(
      expect.any(File),
      expect.objectContaining({ mode: 'local' }),
    )
  })
  it('leaves an unavailable automatic preference queued, including after sign-in and reopening', async () => {
    localStorage.setItem(
      'pitchperfect_night_audio_guitar',
      JSON.stringify({ auto: true, output: 'band' }),
    )
    setUvrProcessingMode('server')
    const { controller } = setup()
    await screen.findByText(/Auto-separation unavailable/)
    port.signedIn = true
    port.bumpAuth()
    await waitFor(() => expect(band()).toBeEnabled())
    controller.close()
    controller.open()
    await waitFor(() => expect(band()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('does not defer an automatic run until a capture blocker disappears', async () => {
    localStorage.setItem(
      'pitchperfect_night_audio_guitar',
      JSON.stringify({ auto: true, output: 'vocals' }),
    )
    const [blocked, setBlocked] = createSignal<string | null>(
      'Stop the recorder first.',
    )
    setup({ blockedReason: blocked })
    await screen.findByText(/Auto-separation unavailable/)
    setBlocked(null)
    await waitFor(() => expect(vocals()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('ignores a late inspection after closing and cannot auto-run when reopened', async () => {
    localStorage.setItem(
      'pitchperfect_night_audio_guitar',
      JSON.stringify({ auto: true, output: 'vocals' }),
    )
    let finish!: () => void
    port.inspect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const { controller } = setup()
    await waitFor(() => expect(port.inspect).toHaveBeenCalledOnce())
    controller.close()
    finish()
    await Promise.resolve()
    controller.open()
    await waitFor(() => expect(vocals()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('does not auto-start after an account changes while the first inspection is pending', async () => {
    localStorage.setItem(
      'pitchperfect_night_audio_guitar',
      JSON.stringify({ auto: true, output: 'band' }),
    )
    setUvrProcessingMode('server')
    let finish!: () => void
    port.inspect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    setup()
    await waitFor(() => expect(port.inspect).toHaveBeenCalledOnce())
    port.signedIn = true
    port.bumpAuth()
    finish()
    await waitFor(() => expect(band()).toBeEnabled())
    expect(port.prepare).not.toHaveBeenCalled()
  })
  it('keeps the pending song when preparation fails and never retries it on reopening', async () => {
    port.prepare.mockResolvedValue({
      status: 'error',
      message: 'The separator could not run.',
    })
    const { controller } = setup()
    await waitFor(() => expect(vocals()).toBeEnabled())
    fireEvent.click(vocals())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'separator could not run',
      ),
    )
    expect(controller.file()?.name).toBe('idea.wav')
    expect(port.openSong).not.toHaveBeenCalled()
    controller.close()
    controller.open()
    await waitFor(() => expect(vocals()).toBeEnabled())
    expect(port.prepare).toHaveBeenCalledOnce()
  })
})
