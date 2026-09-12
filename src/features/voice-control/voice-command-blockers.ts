// Modal command holds stay lightweight so silent room surfaces need not load the voice vocabulary.
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'

const [blockers, setBlockers] = createSignal<readonly Accessor<boolean>[]>([])

export function registerVoiceCommandBlocker(
  blocked: Accessor<boolean>,
): () => void {
  setBlockers((previous) => [...previous, blocked])
  return () =>
    setBlockers((previous) => previous.filter((item) => item !== blocked))
}

export const voiceCommandsBlocked = (): boolean =>
  blockers().some((blocked) => blocked())
