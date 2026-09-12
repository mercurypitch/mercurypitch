// Drum import commits parsed arrangements or prepared audio only after the current project's save succeeds.
import type { PlayAlongBandPreparationPort } from '@/features/play-along/band-preparation-port'
import type { NightSongReplacementPort } from '@/features/play-along/night-audio-actions'
import { nightAudioActions } from '@/features/play-along/night-audio-actions'
import type { NightMusicAction, NightMusicTask, } from '@/features/play-along/night-music-import'
import { NightMusicActionError } from '@/features/play-along/night-music-import'
import type { UnifiedSongImportKind } from '@/features/play-along/song-import'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { DrumProjectController } from './persistence/drum-project-controller'
import { drumSessionStateCopy } from './session/DrumSessionStateView'
import type { DrumSessionImportController } from './session/import-drum-session'

export function createDrumNightMusicActions(options: {
  song: NightSongReplacementPort
  session: DrumSessionImportController
  project: () => DrumProjectController | null
  backingId: () => string | null
  loadBandPort: () => Promise<PlayAlongBandPreparationPort>
  checkBandPreflight: (
    id: string,
  ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
  onResolveBlocker: (blocker: CloudSplitBlocker) => void
  onBackingLoaded(): void
  onScoreLoaded(): void
}) {
  let parsing = false
  const flushProject = async (task: NightMusicTask) => {
    const project = options.project()
    if (project?.currentProject() && !(await project.flush()))
      throw new Error(
        'Your project is not saved yet. Retry its local save before replacing music.',
      )
    task.assertCurrent()
    return () => {
      task.assertCurrent()
      if (project?.currentProject() && !project.detach().ok)
        throw new Error('Finish saving this project before replacing music.')
    }
  }
  const openSong = async (id: string, task: NightMusicTask) => {
    if (!(await options.song.refreshLibrary()))
      throw new Error(
        'The song library could not refresh. Retry to open the saved result.',
      )
    const detach = await flushProject(task)
    await options.song.replaceSession(id, { ...task, beforeCommit: detach })
    options.onBackingLoaded()
  }
  const separateBand = async (id: string, task: NightMusicTask) => {
    const { prepareBandWithPreflight } =
      await import('@/features/play-along/prepare-band')
    task.assertCurrent()
    const port = await options.loadBandPort()
    const blocker = await prepareBandWithPreflight(port, id, {
      signal: task.signal,
      assertCurrent: task.assertCurrent,
      checkPreflight: options.checkBandPreflight,
      onUpdate: (update) =>
        task.report(
          update.detail ?? 'Separating drums and the rest of the band…',
          update.progress / 100,
        ),
    })
    if (blocker)
      throw new NightMusicActionError(
        blocker.message,
        blocker.cta
          ? {
              label:
                blocker.cta.section === 'credits'
                  ? `${blocker.cta.label} (new tab)`
                  : blocker.cta.label,
              run: () => options.onResolveBlocker(blocker),
            }
          : undefined,
      )
    await openSong(id, task)
  }
  const actions = (
    file: File | null,
    kind: UnifiedSongImportKind | null,
  ): NightMusicAction[] => {
    if (file && kind === 'audio')
      return nightAudioActions(file, {
        target: 'drums',
        openSong,
        separateBand,
      })
    if (file)
      return [
        {
          id: 'load-score',
          label: 'Load this score',
          detail:
            'Replace the arrangement using the shared MIDI/Guitar Pro drum mapper. Your saved project remains in the library.',
          run: async (task) => {
            task.report('Reading the drum arrangement…')
            parsing = true
            let detach: (() => void) | undefined
            try {
              const attempt = await options.session.importFile(file, {
                signal: task.signal,
                beforeApply: async (state) => {
                  if (state.status !== 'ready')
                    throw new Error(
                      state.status === 'error'
                        ? state.message
                        : (drumSessionStateCopy(state)?.title ??
                            'This file has no playable arrangement.'),
                    )
                  detach = await flushProject(task)
                },
                beforeCommit: () => detach?.(),
              })
              task.signal.throwIfAborted()
              if (attempt.status === 'stale')
                throw new Error(
                  'The source changed while importing. Choose the file again.',
                )
              if (attempt.state.status !== 'ready')
                throw new Error(
                  attempt.state.status === 'error'
                    ? attempt.state.message
                    : (drumSessionStateCopy(attempt.state)?.title ??
                        'This arrangement could not be loaded.'),
                )
              options.onScoreLoaded()
            } finally {
              parsing = false
            }
          },
        },
      ]
    const id = options.backingId()
    return id !== null && id !== ''
      ? [
          {
            id: 'separate-current',
            label: 'Separate drums + band from this song',
            detail:
              'Reuse saved parts, or run a new cloud split using credits.',
            run: (task) => separateBand(id, task),
          },
        ]
      : []
  }
  return { actions, parsing: () => parsing }
}
