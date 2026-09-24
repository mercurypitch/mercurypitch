// Encore audio ownership — only the newest quiet lease may restore shared museum sound.

export interface EncoreAudioLease {
  readonly quiet: Promise<void>
  release(): void
}

export interface EncoreAudioLeaseOwner {
  acquire(): EncoreAudioLease
}

export interface EncorePlaybackClaim {
  readonly assetId: string | null
  readonly lease: EncoreAudioLease
  readonly generation: number
}

export interface EncorePlaybackRelease {
  readonly latest: boolean
  readonly owned: boolean
}

export function createEncorePlaybackClaims() {
  let current: EncorePlaybackClaim | undefined
  let generation = 0

  return {
    claim(
      lease: EncoreAudioLease,
      assetId: string | null,
    ): EncorePlaybackClaim {
      const claim = { assetId, lease, generation: ++generation }
      current = claim
      return claim
    },
    currentAssetId(): string | null {
      return current?.assetId ?? null
    },
    isLatest(claim: EncorePlaybackClaim): boolean {
      return claim.generation === generation
    },
    takeCurrentLease(): EncoreAudioLease | undefined {
      const lease = current?.lease
      current = undefined
      generation++
      return lease
    },
    release(claim: EncorePlaybackClaim): EncorePlaybackRelease {
      const owned = current === claim
      if (owned) current = undefined
      claim.lease.release()
      return { latest: claim.generation === generation, owned }
    },
    clear(): void {
      current = undefined
      generation++
    },
  }
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
): EncoreAudioLeaseOwner {
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
  }
}
