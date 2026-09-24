// Encore audio ownership — only the newest quiet lease may restore shared museum sound.

export interface EncoreAudioLease {
  readonly quiet: Promise<void>
  release(): void
}

export async function retireEncoreAudioLease(
  lease: EncoreAudioLease | undefined,
  retire: () => Promise<void>,
): Promise<void> {
  try {
    await retire()
  } catch {
    // Optional playback failure cannot strand shared audio ownership.
  } finally {
    lease?.release()
  }
}

export function createEncoreAudioLeaseOwner(
  silence: () => Promise<void>,
  restore: () => void,
) {
  let generation = 0
  let held = false

  return {
    acquire(): EncoreAudioLease {
      const token = ++generation
      held = true
      let open = true
      let quiet: Promise<void>
      try {
        // Audio factories must still be reached synchronously from the gesture.
        quiet = silence()
      } catch (cause) {
        quiet = Promise.reject(cause)
      }
      return {
        quiet,
        release(): void {
          if (!open) return
          open = false
          if (!held || token !== generation) return
          held = false
          restore()
        },
      }
    },
    releaseAll(): void {
      generation++
      if (!held) return
      held = false
      restore()
    },
  }
}
