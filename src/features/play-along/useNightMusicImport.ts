// Night music import coordinates explicit intent, cancellation and route-wide external drops.
import { batch, createSignal, onCleanup, onMount, untrack } from 'solid-js'
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
  onResolveAccess?: (section: 'account' | 'credits') => void
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
  let autoImportPending = false
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
    autoImportPending = false
    if (running()) cancel()
    setIsOpen(false)
    resetDrag()
  }
  const receive = (files: readonly File[]) => {
    resetDrag()
    if (running()) {
      setIsOpen(true)
      return // Do not supersede a running job with an accidental second drop.
    }
    const result = validateNightMusicFiles(options.room, files)
    autoImportPending = result.ok && result.kind === 'audio'
    batch(() => {
      setStatus('')
      setWarnings([])
      setRecovery(undefined)
      setError(result.ok ? null : result.message)
      setFile(result.ok ? result.file : null)
      setKind(result.ok ? result.kind : null)
      setIsOpen(true)
    })
    ensureActions()
  }
  const resolveAccess = (section: 'account' | 'credits') => {
    close()
    if (options.onResolveAccess) options.onResolveAccess(section)
    else window.open(`/#/settings/${section}`, '_blank', 'noopener,noreferrer')
  }
  const run = async (
    action: NightMusicAction,
    audioMode?: 'local' | 'server',
  ) => {
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
    const isCurrent = () =>
      !disposed && !abort.signal.aborted && intent === generation
    try {
      const { runNightMusicAction } = await import('./run-night-music-action')
      await runNightMusicAction(action, {
        audioMode,
        signal: abort.signal,
        isCurrent,
        initialSourceKey: sourceKey,
        sourceKey: options.sourceKey,
        blockedReason: options.blockedReason,
        resolveAccess,
        warn: (message) => {
          setWarnings((previous) => [...new Set([...previous, message])])
        },
        report: (message, value) => {
          setStatus(message)
          setProgress(value)
        },
      })
      if (!isCurrent()) return
      setFile(null)
      setKind(null)
      if (warnings().length)
        setStatus(
          'Your music is ready. Please review the storage notice before returning.',
        )
      else setIsOpen(false)
    } catch (caught) {
      if (isCurrent()) {
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
    resolveAccess,
    // Claim once per newly selected file, not on reopening, sign-in or preference changes.
    claimAutoImport: () => {
      const pending = autoImportPending
      autoImportPending = false
      return pending
    },
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
      if (!file()) {
        setError(null)
        setRecovery(undefined)
        setStatus('')
      }
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
