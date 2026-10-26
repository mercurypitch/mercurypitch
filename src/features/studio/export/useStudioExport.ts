// Studio export lifecycle — one frozen revision, cancellable native work and explicitly owned WAV output.
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { StudioExportStage, StudioExportToken, StudioWavExport, } from '@/lib/studio/export/render-wav'
import { renderStudioWav } from '@/lib/studio/export/render-wav'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { OwnedStudioExport } from './export-download'
import { ownStudioExport } from './export-download'
import type { StudioRenderJob } from './render-job'

export interface StudioExportControllerOptions {
  project(): StudioProject | null
  assets(): readonly StudioAsset[]
  canStart(): boolean
  readCanonicalAsset(id: string): Promise<Blob>
  releaseAudio(): Promise<void>
  render?: typeof renderStudioWav
}

export function useStudioExport(options: StudioExportControllerOptions) {
  const [busy, setBusy] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)
  const [stage, setStage] = createSignal<StudioExportStage>('preparing')
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [result, setResult] = createSignal<StudioWavExport | null>(null)
  const retained = new Set<OwnedStudioExport>()
  let owner: OwnedStudioExport | null = null
  let active: StudioRenderJob | null = null
  let disposed = false

  function isCurrent(
    token: Pick<StudioExportToken, 'projectId' | 'revision'>,
  ): boolean {
    const project = options.project()
    return (
      !disposed &&
      project?.id === token.projectId &&
      project.revision === token.revision
    )
  }

  function clearResult(): void {
    owner?.retire()
    owner = null
    setResult(null)
  }

  function cancel(): void {
    if (!active) return
    active.abort.abort()
    setCancelling(true)
  }

  function sync(): void {
    const project = options.project()
    if (owner && !isCurrent(owner.value.token)) clearResult()
    if (
      active &&
      (project?.id !== active.projectId || project.revision !== active.revision)
    )
      cancel()
  }
  createEffect(sync)

  function finishJob(job: StudioRenderJob): void {
    if (active !== job) return
    active = null
    if (disposed) return
    if (job.abort.signal.aborted && isCurrent(job))
      setNotice('Export cancelled.')
    setBusy(false)
    setCancelling(false)
  }

  async function exportWav(): Promise<boolean> {
    const project = options.project()
    if (!project || disposed || busy() || !options.canStart()) return false
    const snapshot = structuredClone(project)
    const assets = structuredClone(options.assets())
    const job = {
      abort: new AbortController(),
      projectId: snapshot.id,
      revision: snapshot.revision,
    }
    active = job
    setBusy(true)
    setCancelling(false)
    setError(null)
    setNotice(null)
    setStage('preparing')
    clearResult()
    try {
      await options.releaseAudio()
      job.abort.signal.throwIfAborted()
      if (!isCurrent(job)) return false
      const rendered = await (options.render ?? renderStudioWav)(
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
      if (job.abort.signal.aborted || !isCurrent(rendered.token)) {
        rendered.release()
        return false
      }
      const owned = ownStudioExport(rendered, () => retained.delete(owned))
      owner = owned
      retained.add(owned)
      setResult(rendered)
      return true
    } catch (cause) {
      if (!disposed && !job.abort.signal.aborted && isCurrent(job))
        setError(
          cause instanceof Error
            ? cause.message
            : 'The WAV could not be created. Try exporting again.',
        )
      return false
    } finally {
      finishJob(job)
    }
  }

  function download(): boolean {
    if (!owner || !isCurrent(owner.value.token)) {
      clearResult()
      return false
    }
    try {
      owner.download(options.project()?.title ?? 'Studio song')
      setError(null)
      setNotice('Download requested. Your browser handles the file.')
      return true
    } catch {
      setError('The WAV could not download. Try Download WAV again.')
      return false
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    active?.abort.abort()
    for (const item of retained) item.dispose()
    retained.clear()
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
    exportWav,
    cancel,
    download,
    dispose,
  }
}

export type StudioExportController = ReturnType<typeof useStudioExport>
