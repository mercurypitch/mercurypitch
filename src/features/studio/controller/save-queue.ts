// Studio save queue — serialize immutable revisions and retain failed imported assets.
import type { StudioEditorToken, StudioWriteToken, } from '@/db/services/studio-service'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'
import { createRetainedStudioAudio } from './retained-audio'

export type StudioSaveState = 'saved' | 'unsaved' | 'saving' | 'error'

export interface StudioSaveQueueOptions {
  project: StudioProject
  token: StudioEditorToken
  save(
    project: StudioProject,
    token: StudioWriteToken,
    assets: readonly StudioAssetData[],
  ): Promise<StudioProject>
  changed(state: StudioSaveState, error: unknown | null): void
}

export function createStudioSaveQueue(options: StudioSaveQueueOptions) {
  let latest = options.project
  let durableRevision = latest.revision
  let closed = false
  let failed = false
  let running: Promise<boolean> | null = null
  const prepared = createRetainedStudioAudio()

  function acknowledgeSave(
    snapshot: StudioProject,
    saved: StudioProject,
    inputs: readonly StudioAssetData[],
  ): void {
    if (saved.id !== snapshot.id || saved.revision !== snapshot.revision)
      throw new Error(
        'The saved project revision did not match the requested revision.',
      )
    durableRevision = saved.revision
    prepared.release(inputs)
  }

  async function saveLoop(): Promise<boolean> {
    options.changed('saving', null)
    try {
      while (!closed && !failed && latest.revision > durableRevision) {
        const snapshot = latest
        const inputs = prepared.values()
        const saved = await options.save(
          snapshot,
          { ...options.token, expectedRevision: durableRevision },
          inputs,
        )
        if (closed) return false
        acknowledgeSave(snapshot, saved, inputs)
      }
      if (!closed && !failed) options.changed('saved', null)
      return !closed && !failed
    } catch (error) {
      if (!closed) {
        failed = true
        options.changed('error', error)
      }
      return false
    }
  }

  function flush(): Promise<boolean> {
    if (closed || failed) return Promise.resolve(false)
    if (running) return running
    if (latest.revision === durableRevision) return Promise.resolve(true)
    running = saveLoop().finally(() => {
      running = null
      if (closed) prepared.clear()
      if (!closed && !failed && latest.revision > durableRevision) void flush()
    })
    return running
  }

  return {
    stage(
      project: StudioProject,
      assets: readonly StudioAssetData[] = [],
    ): void {
      if (closed) throw new Error('This project editor has closed.')
      if (project.id !== latest.id || project.revision <= latest.revision)
        throw new Error(
          'Studio edits must advance the active project revision.',
        )
      prepared.retain(assets)
      latest = project
      if (!failed) options.changed(running ? 'saving' : 'unsaved', null)
    },
    flush,
    retry(): Promise<boolean> {
      failed = false
      // Nothing left to write: the pause is over, and so is its error.
      if (!closed && !running && latest.revision === durableRevision)
        options.changed('saved', null)
      return flush()
    },
    pause(error: unknown): void {
      if (!closed) {
        failed = true
        options.changed('error', error)
      }
    },
    preparedAssets: prepared.values,
    durableRevision: () => durableRevision,
    dispose(): void {
      closed = true
      if (!running) prepared.clear()
    },
  }
}

export type StudioSaveQueue = ReturnType<typeof createStudioSaveQueue>
