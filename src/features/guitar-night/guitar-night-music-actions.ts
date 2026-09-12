// Guitar import adapts shared audio actions and the existing score owner without combining their clocks.
import type { NightSongReplacementPort } from '@/features/play-along/night-audio-actions'
import { nightAudioActions } from '@/features/play-along/night-audio-actions'
import type { NightMusicAction, NightMusicTask, } from '@/features/play-along/night-music-import'
import { NightMusicActionError } from '@/features/play-along/night-music-import'
import type { UnifiedSongImportKind } from '@/features/play-along/song-import'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'
import type { GuitarNightPreparationPort } from './preparation-port'
import type { GuitarNightBackingLease } from './song-port'
import type { useGuitarNightReferenceController } from './useGuitarNightReferenceController'

export function guitarNightMusicActions(options: {
  song: NightSongReplacementPort
  reference: ReturnType<typeof useGuitarNightReferenceController>
  backing: () => GuitarNightBackingLease | null
  loadPreparationPort?: () => Promise<GuitarNightPreparationPort>
  loadBandPort: () => Promise<GuitarNightBandPreparationPort>
  checkBandPreflight: () => Promise<CloudSplitBlocker | null>
  onResolveBlocker: (blocker: CloudSplitBlocker) => void
  enterRoom(): void
  enterScoreRoom(): void
}) {
  const openSong = async (id: string, task: NightMusicTask) => {
    if (!(await options.song.refreshLibrary()))
      throw new Error(
        'The song library could not refresh. Retry to open the saved result.',
      )
    await options.song.replaceSession(id, task)
    options.enterRoom()
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
          update.detail ?? 'Separating guitar, bass, drums and keys…',
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
  return (
    file: File | null,
    kind: UnifiedSongImportKind | null,
  ): NightMusicAction[] => {
    if (file && kind === 'audio')
      return nightAudioActions(file, {
        target: 'guitar',
        loadPreparationPort: options.loadPreparationPort,
        openSong,
        separateBand,
      })
    if (file) {
      const actions: NightMusicAction[] = [
        {
          id: 'rehearse-score',
          label: 'Rehearse this score',
          detail:
            'Replace the visible score. Keep the song saved and paused; use the existing track chooser, loop and mixer.',
          run: async (task) => {
            task.report('Reading the score…')
            await options.reference.importForSession(file, task.assertCurrent)
            options.enterScoreRoom()
          },
        },
      ]
      if (options.backing())
        actions.push({
          id: 'attach-score',
          label: 'Attach to the current song',
          detail:
            'Keep this song and replace its score attachment. Use Align to place notes on the recording; timing is not guessed.',
          run: async (task) => {
            task.report('Reading the score…')
            await options.reference.importForSession(
              file,
              task.assertCurrent,
              true,
            )
            options.enterRoom()
          },
        })
      return actions
    }
    const backing = options.backing()
    return backing &&
      backing.source !== 'demo' &&
      backing.defaultMix.kind === 'mixed-instrumental'
      ? [
          {
            id: 'separate-current',
            label: 'Separate guitar + band from this song',
            detail:
              'Saved parts are reused first; a new cloud split uses credits. The current song stays ready until the new mix opens.',
            run: (task) => separateBand(backing.sessionId, task),
          },
        ]
      : []
  }
}
