// Night music import coordinates explicit intent, cancellation and route-wide external drops.
import { createSignal, onCleanup, onMount, untrack } from 'solid-js'
import { registerVoiceCommandBlocker } from '@/features/voice-control/voice-command-blockers'
import type { NightMusicAction, NightMusicRoom } from './night-music-import'
import { isExternalFileDrag, NightMusicActionError, validateNightMusicFiles, } from './night-music-import'
import type { UnifiedSongImportKind } from './song-import'

type NightMusicActions = (
  file: File | null,
  kind: UnifiedSongImportKind | null,
) => readonly NightMusicAction[]
export interface NightMusicImportOptions {
  room: NightMusicRoom
  sourceKey: () => string
  currentTitle: () => string | null
  blockedReason?: () => string | null
  actions?: NightMusicActions
  loadActions?: () => Promise<NightMusicActions>
}

export function useNightMusicImport(options: NightMusicImportOptions) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [dragging, setDragging] = createSignal(false)
  const [file, setFile] = createSignal<File | null>(null)
  const [kind, setKind] = createSignal<UnifiedSongImportKind | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [recovery, setRecovery] =
    createSignal<NightMusicActionError['recovery']>()
  const [running, setRunning] = createSignal(false)
  const [status, setStatus] = createSignal('')
  const [progress, setProgress] = createSignal<number | undefined>()
  const [warnings, setWarnings] = createSignal<string[]>([])
  // The registry reads this accessor per utterance, without stopping input.
  // eslint-disable-next-line solid/reactivity
  onCleanup(registerVoiceCommandBlocker(() => isOpen()))
  let depth = 0
  let generation = 0
  let active: AbortController | null = null
  let disposed = false
  const [actions, setActions] = createSignal<NightMusicActions>(
    options.actions ?? (() => []),
  )
  let loadingActions: Promise<void> | null = null
  let actionsReady = !options.loadActions
  const ensureActions = () => {
    if (actionsReady || loadingActions || !options.loadActions) return
    setStatus('Opening music options…')
    loadingActions = options
      .loadActions()
      .then((loaded) => {
        if (disposed) return
        actionsReady = true
        // Store the factory itself; the sheet invokes it in its tracked render.
        setActions(() => loaded)
        if (!untrack(running)) setStatus('')
      })
      .catch(() => {
        if (!disposed)
          setError(
            'Music options could not load. Close this panel and try Add music again.',
          )
      })
      .finally(() => {
        loadingActions = null
      })
  }

  const resetDrag = () => {
    depth = 0
    setDragging(false)
  }
  const cancel = () => {
    generation += 1
    active?.abort()
    active = null
    setRunning(false)
    setProgress(undefined)
    setStatus('Cancelled. Your current music has not been replaced.')
  }
  const close = () => {
    if (running()) cancel()
    setIsOpen(false)
    resetDrag()
  }
  const receive = (files: readonly File[]) => {
    resetDrag()
    setIsOpen(true)
    if (running()) return // Do not supersede a running job with an accidental second drop.
    const result = validateNightMusicFiles(options.room, files)
    setStatus('')
    setWarnings([])
    setRecovery(undefined)
    setError(result.ok ? null : result.message)
    setFile(result.ok ? result.file : null)
    setKind(result.ok ? result.kind : null)
    ensureActions()
  }
  const run = async (action: NightMusicAction) => {
    if (running() || action.unavailable !== undefined) return
    const blocked = options.blockedReason?.()
    if (blocked != null && blocked !== '') {
      setError(blocked)
      return
    }
    const sourceKey = options.sourceKey()
    const intent = ++generation
    const abort = new AbortController()
    active = abort
    setRunning(true)
    setError(null)
    setRecovery(undefined)
    setWarnings([])
    setStatus('Getting ready…')
    setProgress(undefined)
    const assertCurrent = () => {
      if (disposed || abort.signal.aborted || intent !== generation)
        throw new DOMException('Cancelled', 'AbortError')
      if (sourceKey !== options.sourceKey())
        throw new Error(
          'The music on stage changed. Choose the action again for the current session.',
        )
      const reason = options.blockedReason?.()
      if (reason != null && reason !== '') throw new Error(reason)
    }
    try {
      await action.run({
        signal: abort.signal,
        assertCurrent,
        warn: (message) => {
          if (!disposed && !abort.signal.aborted && intent === generation)
            setWarnings((previous) => [...new Set([...previous, message])])
        },
        report: (message, value) => {
          if (disposed || abort.signal.aborted || intent !== generation) return
          setStatus(message)
          setProgress(
            value === undefined || !Number.isFinite(value)
              ? undefined
              : Math.max(0, Math.min(1, value)),
          )
        },
      })
      if (disposed || abort.signal.aborted || intent !== generation) return
      setFile(null)
      setKind(null)
      if (warnings().length)
        setStatus(
          'Your music is ready. Please review the storage notice before returning.',
        )
      else setIsOpen(false)
    } catch (caught) {
      if (!disposed && !abort.signal.aborted && intent === generation) {
        setRecovery(
          caught instanceof NightMusicActionError ? caught.recovery : undefined,
        )
        setError(
          caught instanceof Error
            ? caught.message
            : 'This file could not be opened. Try another file.',
        )
        setStatus('')
      }
    } finally {
      if (!disposed && intent === generation) {
        active = null
        setRunning(false)
      }
    }
  }

  onMount(() => {
    const enter = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) return
      event.preventDefault()
      event.stopPropagation()
      depth += 1
      setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer)
        event.dataTransfer.dropEffect = running() ? 'none' : 'copy'
    }
    const leave = (event: DragEvent) => {
      if (!dragging()) return
      event.preventDefault()
      depth = Math.max(0, depth - 1)
      if (depth === 0) resetDrag()
    }
    const drop = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) return
      event.preventDefault()
      event.stopPropagation()
      receive(Array.from(event.dataTransfer?.files ?? []))
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') resetDrag()
    }
    window.addEventListener('dragenter', enter, true)
    window.addEventListener('dragover', over, true)
    window.addEventListener('dragleave', leave, true)
    window.addEventListener('drop', drop, true)
    window.addEventListener('blur', resetDrag)
    window.addEventListener('keydown', escape)
    onCleanup(() => {
      window.removeEventListener('dragenter', enter, true)
      window.removeEventListener('dragover', over, true)
      window.removeEventListener('dragleave', leave, true)
      window.removeEventListener('drop', drop, true)
      window.removeEventListener('blur', resetDrag)
      window.removeEventListener('keydown', escape)
    })
  })
  onCleanup(() => {
    disposed = true
    generation += 1
    active?.abort()
  })

  return {
    room: options.room,
    currentTitle: options.currentTitle,
    blockedReason: () => options.blockedReason?.() ?? null,
    actions: () => actions()(file(), kind()),
    isOpen,
    dragging,
    file,
    error,
    recovery,
    recover: () => {
      const action = recovery()
      if (!action || running()) return
      close()
      setError(null)
      setRecovery(undefined)
      action.run()
    },
    running,
    status,
    progress,
    warnings,
    reportError: (message: string) => setError(message),
    open: () => {
      setIsOpen(true)
      ensureActions()
    },
    close,
    receive,
    run,
    cancel,
  }
}

export type NightMusicImportController = ReturnType<typeof useNightMusicImport>
