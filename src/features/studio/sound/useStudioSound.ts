// Studio balance lifecycle — analyze a frozen mix and keep faders separate from the measured correction.
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { analyzeStudioBalance } from '@/lib/studio/export/analyze-balance'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioRenderJob } from '../export/render-job'

export interface StudioSoundControllerOptions {
  project(): StudioProject | null
  assets(): readonly StudioAsset[]
  canStart(): boolean
  readCanonicalAsset(id: string): Promise<Blob>
  releaseAudio(): Promise<void>
  onCommand(command: StudioSoundEdit): boolean
  analyze?: typeof analyzeStudioBalance
}

export function useStudioSound(options: StudioSoundControllerOptions) {
  const [busy, setBusy] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)
  const [progress, setProgress] = createSignal<{
    completed: number
    total: number
  } | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)
  let active: StudioRenderJob | null = null
  let disposed = false

  function isCurrent(token: { projectId: string; revision: number }): boolean {
    const project = options.project()
    return (
      !disposed &&
      project?.id === token.projectId &&
      project.revision === token.revision
    )
  }

  function cancel(): void {
    if (!active) return
    active.abort.abort()
    setCancelling(true)
  }
  createEffect(() => {
    const project = options.project()
    const allowed = options.canStart()
    if (
      active &&
      (!allowed ||
        project?.id !== active.projectId ||
        project.revision !== active.revision)
    )
      cancel()
  })

  function finishJob(job: StudioRenderJob): void {
    if (active === job) active = null
    if (disposed) return
    if (job.abort.signal.aborted && isCurrent(job))
      setNotice('Auto-balance cancelled.')
    setBusy(false)
    setCancelling(false)
  }

  async function autoBalance(): Promise<boolean> {
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
    setProgress(null)
    setError(null)
    setNotice(null)
    try {
      await options.releaseAudio()
      job.abort.signal.throwIfAborted()
      if (!isCurrent(job) || !options.canStart()) return false
      const proposal = await (options.analyze ?? analyzeStudioBalance)(
        snapshot,
        assets,
        options.readCanonicalAsset,
        {
          signal: job.abort.signal,
          isCurrent,
          onLane: (completed, total) => {
            if (!disposed && !job.abort.signal.aborted)
              setProgress({ completed, total })
          },
        },
      )
      if (
        job.abort.signal.aborted ||
        !isCurrent(proposal) ||
        !options.canStart()
      )
        return false
      active = null
      const applied = options.onCommand({
        type: 'apply-auto-balance',
        sourceRevision: proposal.revision,
        balanceGainDbByTrack: proposal.balanceGainDbByTrack,
      })
      if (applied)
        setNotice(
          Object.keys(proposal.balanceGainDbByTrack).length
            ? 'Balance applied. Your volume and pan settings are unchanged.'
            : 'No audible tracks to balance.',
        )
      return applied
    } catch (cause) {
      if (!disposed && !job.abort.signal.aborted && isCurrent(job))
        setError(
          cause instanceof Error
            ? cause.message
            : 'The tracks could not be balanced. Try again.',
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
  }
  onCleanup(dispose)
  return {
    busy,
    cancelling,
    progress,
    error,
    notice,
    autoBalance,
    cancel,
    dispose,
  }
}

export type StudioSoundController = ReturnType<typeof useStudioSound>
