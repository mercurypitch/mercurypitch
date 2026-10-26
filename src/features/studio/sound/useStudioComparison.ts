// Studio comparison lifecycle — explicit preparation and attenuation-matched auditions of one revision.
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { StudioComparison } from '@/lib/studio/export/prepare-comparison'
import { prepareStudioComparison } from '@/lib/studio/export/prepare-comparison'
import type { StudioExportStage } from '@/lib/studio/export/render-wav'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioRenderJob } from '../export/render-job'
import type { StudioComparisonTransport } from './comparison-preview'
import { createComparisonPreview } from './comparison-preview'
import type { OwnedStudioComparison } from './comparison-resource'
import { ownStudioComparison } from './comparison-resource'

export interface StudioComparisonControllerOptions {
  project(): StudioProject | null
  assets(): readonly StudioAsset[]
  canStart(): boolean
  readCanonicalAsset(id: string): Promise<Blob>
  transport: StudioComparisonTransport
  beforePrepare?(): void
  onPrepared?(comparison: StudioComparison): void
  prepareRender?: typeof prepareStudioComparison
}

export function useStudioComparison(
  options: StudioComparisonControllerOptions,
) {
  const [busy, setBusy] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)
  const [stage, setStage] = createSignal<StudioExportStage>('preparing')
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [result, setResult] = createSignal<StudioComparison | null>(null)
  const retained = new Set<OwnedStudioComparison>()
  let owner: OwnedStudioComparison | null = null
  let active: StudioRenderJob | null = null
  let disposed = false
  const preview = createComparisonPreview({
    transport: options.transport,
    current: () => owner,
    allowed: () => !busy() && options.canStart(),
    onError: setError,
  })

  function isCurrent(token: { projectId: string; revision: number }): boolean {
    const project = options.project()
    return (
      !disposed &&
      project?.id === token.projectId &&
      project.revision === token.revision
    )
  }

  function clearResult(): void {
    preview.stop()
    owner?.retire()
    owner = null
    setResult(null)
  }

  function cancel(): void {
    if (!active) return
    active.abort.abort()
    setCancelling(true)
  }
  createEffect(() => {
    const project = options.project()
    if (owner && !isCurrent(owner.value)) clearResult()
    if (
      active &&
      (project?.id !== active.projectId || project.revision !== active.revision)
    )
      cancel()
  })

  function finishJob(job: StudioRenderJob): void {
    if (active !== job) return
    active = null
    if (disposed) return
    if (job.abort.signal.aborted && isCurrent(job))
      setNotice('Compare cancelled.')
    setBusy(false)
    setCancelling(false)
  }

  async function prepare(): Promise<boolean> {
    const project = options.project()
    if (!project || disposed || busy() || !options.canStart()) return false
    const snapshot = structuredClone(project)
    const assets = structuredClone(options.assets())
    const job = {
      abort: new AbortController(),
      projectId: project.id,
      revision: project.revision,
    }
    active = job
    setBusy(true)
    setCancelling(false)
    setStage('preparing')
    setError(null)
    setNotice(null)
    clearResult()
    try {
      options.beforePrepare?.()
      await options.transport.releaseAudio()
      job.abort.signal.throwIfAborted()
      if (!isCurrent(job)) return false
      const prepared = await (options.prepareRender ?? prepareStudioComparison)(
        snapshot,
        assets,
        options.readCanonicalAsset,
        {
          signal: job.abort.signal,
          isCurrent,
          onStage: (next) => {
            if (!disposed && !job.abort.signal.aborted) setStage(next)
          },
        },
      )
      if (job.abort.signal.aborted || !isCurrent(prepared)) {
        prepared.release()
        return false
      }
      const owned = ownStudioComparison(prepared, () => retained.delete(owned))
      owner = owned
      retained.add(owned)
      setResult(prepared)
      options.onPrepared?.(prepared)
      return true
    } catch (cause) {
      if (!disposed && !job.abort.signal.aborted && isCurrent(job))
        setError(
          cause instanceof Error
            ? cause.message
            : 'Compare could not be prepared. Try again.',
        )
      return false
    } finally {
      finishJob(job)
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    active?.abort.abort()
    preview.dispose()
    for (const item of retained) item.retire()
    owner = null
    setResult(null)
  }
  onCleanup(dispose)
  return {
    busy,
    cancelling,
    stage,
    error,
    notice,
    result,
    ready: () => result() !== null,
    prepare,
    cancel,
    dispose,
    play: preview.play,
    stop: preview.stop,
    pending: preview.pending,
    playing: preview.playing,
    side: preview.side,
  }
}

export type StudioComparisonController = ReturnType<typeof useStudioComparison>
