// Studio comparison auditions — gesture activation and stale completion guards share the app preview player.
import { createEffect, createSignal } from 'solid-js'
import type { OwnedStudioComparison } from './comparison-resource'

export type StudioComparisonSide = 'before' | 'after'
export interface StudioComparisonTransport {
  primeAudio(): Promise<boolean>
  previewSource(
    blob: Blob,
    options: { gainDb: number; startSeconds: number; durationSeconds: number },
  ): Promise<boolean>
  releaseAudio(): Promise<void>
  stopPreview(): void
  previewing(): boolean
  previewPending(): boolean
  previewPositionSeconds(): number
}

export function createComparisonPreview(options: {
  transport: StudioComparisonTransport
  current(): OwnedStudioComparison | null
  allowed(): boolean
  onError(message: string | null): void
}) {
  const [pending, setPending] = createSignal(false)
  const [ownedPlayback, setOwnedPlayback] = createSignal(false)
  const [side, setSide] = createSignal<StudioComparisonSide>('after')
  let active: { generation: number; release(): void } | null = null
  let generation = 0
  let disposed = false

  function stop(): void {
    const previous = active
    active = null
    generation++
    setPending(false)
    setOwnedPlayback(false)
    if (!previous) return
    options.transport.stopPreview()
    void options.transport
      .releaseAudio()
      .catch(() => undefined)
      .finally(previous.release)
  }
  createEffect(() => {
    const starting = pending()
    const previewing = options.transport.previewing()
    const loading = options.transport.previewPending()
    if (active && !starting && !previewing && !loading) stop()
  })

  function finishAttempt(
    token: number,
    played: boolean,
    release: () => void,
  ): void {
    release()
    if (generation !== token) return
    setPending(false)
    if (!played) stop()
  }

  async function play(next: StudioComparisonSide): Promise<boolean> {
    const current = options.current()
    if (!current || disposed || !options.allowed()) return false
    const position = active ? options.transport.previewPositionSeconds() : 0
    stop()
    const token = ++generation
    const releasePending = current.use()
    active = { generation: token, release: current.use() }
    setPending(true)
    setOwnedPlayback(true)
    setSide(next)
    options.onError(null)
    let played = false
    try {
      const primed = options.transport.primeAudio()
      if (!(await primed))
        throw new Error('Audio could not start. Try Compare again.')
      if (disposed || generation !== token || options.current() !== current)
        return false
      const comparison = current.value
      played = await options.transport.previewSource(comparison[next], {
        gainDb:
          next === 'before' ? comparison.beforeGainDb : comparison.afterGainDb,
        startSeconds: Math.min(
          position,
          Math.max(0, comparison.durationSeconds - 1 / 48000),
        ),
        durationSeconds: comparison.durationSeconds,
      })
      if (disposed || generation !== token) return false
      if (!played) options.onError('Compare could not play. Try again.')
      return played
    } catch (cause) {
      if (!disposed && generation === token)
        options.onError(
          cause instanceof Error
            ? cause.message
            : 'Compare could not play. Try again.',
        )
      return false
    } finally {
      finishAttempt(token, played, releasePending)
    }
  }
  return {
    pending,
    side,
    play,
    stop,
    playing: () => ownedPlayback() && options.transport.previewing(),
    dispose() {
      disposed = true
      stop()
    },
  }
}
