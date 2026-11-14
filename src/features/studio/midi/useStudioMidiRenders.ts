// Studio MIDI renders in the workspace — the render service on the open song: the song and audio the transport plays, the wait before an export, a lane's notice, the editor's API, and a hook for browser tests.
import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js'
import type { StudioNote } from '@/lib/studio/model/types'
import { exposeForE2E } from '@/lib/test-utils'
import type { StudioController } from '../useStudioController'
import { studioMidiEditorApi } from './midi-render-editor'
import type { StudioMidiRenderServiceOptions } from './midi-render-service'
import { createStudioMidiRenderService } from './midi-render-service'

/** What a browser test drives the renders with: the editor's calls, before there is an editor. */
export interface StudioMidiTestHook {
  /** Commit a clip's notes as the editor will: set-sequence-notes. */
  setNotes(clipId: string, notes: StudioNote[], nextNoteId: number): boolean
  renderState(clipId: string): string
  /** The asset the transport plays for a clip: its own, or its preview's. */
  playedAsset(clipId: string): string | undefined
  editorClosed(): Promise<void>
}

/** `over` stands in for the renderer and the timing in tests. */
export function useStudioMidiRenders(
  controller: Accessor<StudioController>,
  canKeep: Accessor<boolean>,
  over: Partial<StudioMidiRenderServiceOptions> = {},
) {
  const studio = untrack(controller)
  const service = createStudioMidiRenderService({
    project: () => studio.project(),
    assets: () => studio.assets(),
    keep: (render) => studio.keepMidiRender(render),
    travels: () => studio.travels(),
    canKeep,
    ...over,
  })
  // The timeline's notice is the latest said: a take with no room on its
  // lane, or a render that failed.
  const [notice, setNotice] = createSignal<{ text: string } | null>(null)
  createEffect(
    on(
      [() => studio.laneNotice(), service.notice],
      ([lane, render], before) => {
        const said = lane !== before?.[0] ? lane : render
        if (said !== null) setNotice(said)
      },
    ),
  )
  const hook: StudioMidiTestHook = {
    setNotes: (clipId, notes, nextNoteId) =>
      studio.dispatch({
        type: 'set-sequence-notes',
        clipId,
        notes,
        nextNoteId,
        forkSequenceId: globalThis.crypto.randomUUID(),
      }),
    renderState: (clipId) => service.renderState(clipId),
    playedAsset: (clipId) =>
      service.snapshot()?.project.clips.find((clip) => clip.id === clipId)
        ?.assetId,
    editorClosed: () => service.editorClosed(),
  }
  exposeForE2E('__studioMidi', hook)
  onCleanup(() => exposeForE2E('__studioMidi', undefined))

  return {
    /** The song the transport plays: each stale clip on its preview once ready. */
    project: () => service.snapshot()?.project ?? null,
    assets: () => service.snapshot()?.assets ?? studio.assets(),
    /** A preview's audio from memory; the song's own from storage. */
    readCanonicalAsset(assetId: string): Promise<Blob> {
      const preview = service.readPreview(assetId)
      return preview === undefined
        ? studio.readCanonicalAsset(assetId)
        : Promise.resolve(preview)
    },
    /** Keep every stale clip's render before an export renders the song. */
    settle: (signal?: AbortSignal) => service.settle(signal),
    keepsPending: service.keepsPending,
    waitingLanes: service.waitingLanes,
    notice,
    editor: studioMidiEditorApi(service),
  }
}
