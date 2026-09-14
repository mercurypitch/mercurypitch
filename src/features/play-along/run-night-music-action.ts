// Night action execution loads only after intent, checking source ownership before preparation and commit.
import type { NightMusicAction, NightMusicTask } from './night-music-import'

export async function runNightMusicAction(
  action: NightMusicAction,
  options: {
    audioMode?: 'local' | 'server'
    signal: AbortSignal
    isCurrent(): boolean
    initialSourceKey: string
    sourceKey(): string
    blockedReason?: () => string | null
    resolveAccess(section: 'account' | 'credits'): void
    warn(message: string): void
    report(message: string, progress?: number): void
  },
): Promise<void> {
  const assertCurrent = () => {
    if (!options.isCurrent()) throw new DOMException('Cancelled', 'AbortError')
    if (options.initialSourceKey !== options.sourceKey())
      throw new Error(
        'The music on stage changed. Choose the action again for the current session.',
      )
    const reason = options.blockedReason?.()
    if (reason != null && reason !== '') throw new Error(reason)
  }
  let task: NightMusicTask = {
    audioMode: options.audioMode,
    signal: options.signal,
    assertCurrent,
    warn: (message) => {
      if (options.isCurrent()) options.warn(message)
    },
    report: (message, progress) => {
      if (options.isCurrent())
        options.report(
          message,
          progress === undefined || !Number.isFinite(progress)
            ? undefined
            : Math.max(0, Math.min(1, progress)),
        )
    },
  }
  assertCurrent()
  if (action.audio) {
    const { admitNightAudio } = await import('./night-audio-access')
    task = await admitNightAudio(action.audio, task, options.resolveAccess)
  }
  task.assertCurrent()
  await action.run(task)
}
