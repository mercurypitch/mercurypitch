// Kept guitar recordings reopen their local melody review without requesting an input.
import { createMemo, Show } from 'solid-js'
import type { VoiceTakeRecord } from '@/db/entities'

export function recordedGuitarId(
  take: Pick<VoiceTakeRecord, 'source' | 'contextJson'>,
): string | null {
  if (take.source !== 'guitar-night') return null
  try {
    const context = JSON.parse(take.contextJson) as Record<string, unknown>
    return context?.kind === 'guitar-recording' &&
      context.version === 1 &&
      typeof context.recordingId === 'string' &&
      context.recordingId.length > 0 &&
      context.recordingId.length <= 256
      ? context.recordingId
      : null
  } catch {
    return null
  }
}

export function GuitarRecordedTakeLink(props: { take: VoiceTakeRecord }) {
  const id = createMemo(() => recordedGuitarId(props.take))
  return (
    <Show when={id()}>
      {(recordingId) => (
        <p>
          <a
            href={`/guitar-night?recording=${encodeURIComponent(recordingId())}`}
          >
            Open melody notes
          </a>
          {' · '}Correct, practice, attach to a song or export. Audio is the dry
          input.
        </p>
      )}
    </Show>
  )
}
