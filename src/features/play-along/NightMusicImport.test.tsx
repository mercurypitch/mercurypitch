// Shared night import tests cover explicit intent, file rejection, cancellation and modal ownership.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activeVoiceCommands, registerVoiceCommands, } from '@/features/voice-control/voice-command-registry'
import { NightMusicImportButton } from './DeferredNightMusicImport'
import type { NightMusicAction, NightMusicRoom } from './night-music-import'
import { NightMusicActionError, performanceTakeImportBlocker, validateNightMusicFiles, } from './night-music-import'
import { NightMusicImport } from './NightMusicImport'
import type { NightMusicImportController } from './useNightMusicImport'
import { useNightMusicImport } from './useNightMusicImport'

const midi = () => new File(['midi'], 'melody.mid')
const audio = () => new File(['audio'], 'song.wav')
const gp = () => new File(['score'], 'song.gp')
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function harness(
  options: {
    room?: NightMusicRoom
    run?: NightMusicAction['run']
    blocked?: () => string | null
    key?: () => string
  } = {},
) {
  let controller!: NightMusicImportController
  const run = options.run ?? vi.fn(async () => undefined)
  const view = render(() => {
    controller = useNightMusicImport({
      room: options.room ?? 'guitar',
      sourceKey: options.key ?? (() => 'old-song'),
      currentTitle: () => 'The existing song',
      blockedReason: options.blocked,
      actions: (file) =>
        file
          ? [
              {
                id: 'load',
                label: 'Load this score',
                detail: 'Replace the score, not its saved source.',
                run,
              },
            ]
          : [],
    })
    return (
      <>
        <NightMusicImportButton onClick={controller.open} />
        <NightMusicImport controller={controller} />
      </>
    )
  })
  return { controller, run, ...view }
}

afterEach(cleanup)

describe('night music file contract', () => {
  it.each(['guitar', 'drums'] as const)(
    '%s accepts all existing song formats',
    (room) => {
      for (const file of [midi(), audio(), gp()])
        expect(validateNightMusicFiles(room, [file]).ok).toBe(true)
    },
  )
  it('only offers Piano and Karaoke the formats their players support', () => {
    expect(validateNightMusicFiles('piano', [audio()]).ok).toBe(false)
    expect(validateNightMusicFiles('piano', [gp()]).ok).toBe(false)
    expect(validateNightMusicFiles('piano', [midi()]).ok).toBe(true)
    expect(validateNightMusicFiles('karaoke', [gp()]).ok).toBe(false)
    expect(validateNightMusicFiles('karaoke', [audio()]).ok).toBe(true)
  })
  it('rejects a whole multi-file drop, empty files and unknown files', () => {
    for (const files of [
      [],
      [midi(), gp()],
      [new File([], 'empty.mid')],
      [new File(['x'], 'notes.txt')],
    ])
      expect(validateNightMusicFiles('guitar', files).ok).toBe(false)
  })
  it('rejects oversized audio before a parser or upload', () => {
    const file = audio()
    Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 })
    expect(validateNightMusicFiles('karaoke', [file])).toMatchObject({
      ok: false,
      message: expect.stringContaining('100 MB'),
    })
  })
  it.each(['capturing', 'processing', 'saving', 'ready'])(
    'protects temporary %s takes',
    (state) => expect(performanceTakeImportBlocker(state)).not.toBeNull(),
  )
  it.each(['idle', 'saved', 'unsupported'])(
    'allows replacing after %s',
    (state) => expect(performanceTakeImportBlocker(state)).toBeNull(),
  )
})

describe('NightMusicImport', () => {
  it('offers account recovery after a blocked action, closes its own modal and retains the file', async () => {
    const recover = vi.fn(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    const run = vi.fn(async () => {
      throw new NightMusicActionError('Sign in to separate the band.', {
        label: 'Sign in',
        run: recover,
      })
    })
    const { controller } = harness({ run })
    controller.receive([audio()])
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(recover).toHaveBeenCalledOnce()
    expect(controller.file()?.name).toBe('song.wav')
    controller.open()
    expect(run).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  })
  it('retains storage warnings after success until the player returns', async () => {
    const { controller } = harness({
      run: async (task) => {
        task.warn?.(
          'Cloud backup is unavailable; this song is saved on this device.',
        )
        task.report('Ready', 1)
      },
    })
    controller.receive([audio()])
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    await waitFor(() => expect(controller.running()).toBe(false))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Cloud backup is unavailable/)).toBeInTheDocument()
    expect(controller.file()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to session' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('choosing a file opens options without running them; explicit action is required', async () => {
    const { controller, run } = harness()
    controller.receive([midi()])
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Add music')
    expect(screen.getByText('The existing song')).toBeInTheDocument()
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run).toHaveBeenCalledOnce()
  })
  it('shows supported types for invalid drops and can choose the same file again', () => {
    const { controller } = harness({ room: 'piano' })
    controller.receive([gp()])
    expect(screen.getByRole('alert')).toHaveTextContent('MIDI')
    fireEvent.change(screen.getByTestId('night-music-file'), {
      target: { files: [midi()] },
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('night-music-file')).toHaveValue('')
  })
  it('keeps a file pending while the player returns to finish a take', () => {
    const [blocked, setBlocked] = createSignal<string | null>(
      'Stop recording first.',
    )
    const { controller } = harness({ blocked })
    controller.receive([midi()])
    expect(
      screen.getByRole('button', { name: /Load this score/ }),
    ).toBeDisabled()
    controller.close()
    setBlocked(null)
    controller.open()
    expect(
      screen.getByRole('button', { name: /Load this score/ }),
    ).toBeEnabled()
    expect(controller.file()?.name).toBe('melody.mid')
  })
  it('cancels real work and rejects a late result without closing a newer dialog', async () => {
    const pending = deferred()
    const committed = vi.fn()
    let signal!: AbortSignal
    const { controller } = harness({
      run: async (task) => {
        signal = task.signal
        await pending.promise
        task.assertCurrent()
        committed()
      },
    })
    controller.receive([midi()])
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    controller.close()
    expect(signal.aborted).toBe(true)
    controller.receive([gp()])
    pending.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(committed).not.toHaveBeenCalled()
    expect(controller.file()?.name).toBe('song.gp')
    expect(controller.isOpen()).toBe(true)
  })
  it('rejects a result when the source changed during preparation', async () => {
    const pending = deferred()
    let source = 'first'
    const committed = vi.fn()
    const { controller } = harness({
      key: () => source,
      run: async (task) => {
        await pending.promise
        task.assertCurrent()
        committed()
      },
    })
    controller.receive([midi()])
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    source = 'second'
    pending.resolve()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'music on stage changed',
      ),
    )
    expect(committed).not.toHaveBeenCalled()
  })
  it('rejects a result if capture started while preparation was pending', async () => {
    const pending = deferred()
    let recording = false
    const committed = vi.fn()
    const { controller } = harness({
      blocked: () => (recording ? 'Stop your take first.' : null),
      run: async (task) => {
        await pending.promise
        task.assertCurrent()
        committed()
      },
    })
    controller.receive([midi()])
    fireEvent.click(screen.getByRole('button', { name: /Load this score/ }))
    recording = true
    pending.resolve()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Stop your take first.',
      ),
    )
    expect(committed).not.toHaveBeenCalled()
  })
  it('owns only external file drags, prevents browser navigation and clears nested hover', () => {
    const { controller } = harness()
    const internal = new Event('dragenter', { bubbles: true, cancelable: true })
    Object.defineProperty(internal, 'dataTransfer', {
      value: { types: ['text/plain'], files: [] },
    })
    window.dispatchEvent(internal)
    expect(internal.defaultPrevented).toBe(false)
    expect(controller.dragging()).toBe(false)
    const dataTransfer = { types: ['Files'], files: [midi()] }
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.dragEnter(document.body, { dataTransfer })
    fireEvent.dragLeave(document.body, { dataTransfer })
    expect(controller.dragging()).toBe(true)
    fireEvent.drop(document.body, { dataTransfer })
    expect(controller.dragging()).toBe(false)
    expect(controller.isOpen()).toBe(true)
  })
  it('suppresses voice actions only while open, restores focus and disposes listeners', async () => {
    const release = registerVoiceCommands(() => [
      {
        id: 'test-play',
        label: 'Play',
        phrases: ['play'],
        run: () => undefined,
      },
    ])
    const { controller, unmount } = harness()
    const trigger = screen.getByRole('button', { name: 'Add music' })
    trigger.focus()
    fireEvent.click(trigger)
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toContainElement(
        document.activeElement as HTMLElement,
      ),
    )
    expect(activeVoiceCommands()).toEqual([])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(activeVoiceCommands()).toHaveLength(1)
    unmount()
    fireEvent.dragEnter(document.body, {
      dataTransfer: { types: ['Files'], files: [midi()] },
    })
    expect(controller.dragging()).toBe(false)
    release()
  })
})
