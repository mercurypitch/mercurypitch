// ============================================================
// Studio microphone share — the one audio input every armed audio lane records from: opened once, and held until its last lane lets go
// ============================================================
//
// Reaper, Logic and Ableton record from one audio device at a time, or
// from an aggregate the operating system makes of several: two devices run
// on clocks of their own and drift apart, and WebKit keeps one capture at a
// time anyway (src/lib/mic-input-loss.ts). So the Studio records from one
// audio input at a time. Every armed audio lane on it is handed the one
// stream MicManager opened for the Studio (its one scoped hold), and takes
// its own input or pair of it (armed-input.ts); the hold goes with the last
// lane that held it, so arming, disarming or re-arming a lane on it never
// reopens it. A lane that follows the Studio's input and a lane set to that
// same input are on one input: they are compared as the arm plans them
// (lane-inputs.ts). A lane asking for another input while one is held is
// refused, in words that name both lanes and both inputs.
import { joinNames } from '@/lib/jam/jam-arrivals'

/** A lane's arm refused before it opened anything, in words for its card. */
export class StudioInputRefusal extends Error {
  constructor(readonly words: string) {
    super(words)
    this.name = 'StudioInputRefusal'
  }
}

/** What MicManager opened for the Studio: its one scoped hold. */
export interface StudioOpenedInput {
  readonly stream: MediaStream
  /** The input asked for was gone as it opened: the default opened instead. */
  readonly missing: boolean
  release(): void
}

/** The input a lane's arm asks for: as its plan resolved it, and by its name. */
export interface StudioInputAsk {
  /** The input to open; null for the system's default. */
  readonly deviceId: string | null
  readonly name: string
}

export interface StudioMicShareOptions {
  /** Open `deviceId` (null: the default) as the Studio's one scoped hold, inside the press. */
  open(deviceId: string | null): Promise<StudioOpenedInput>
  /** Lane `trackId` is still armed, or still opening: a lane that left is not in the way. */
  armed(trackId: string | null): boolean
  /** A lane's name, for the words. */
  laneName(trackId: string | null): string
}

interface Holder {
  /** The lane that holds it; undefined for a re-arm keeping it open. */
  readonly trackId?: string | null
}

interface Shared {
  readonly device: string
  readonly name: string
  readonly opening: Promise<StudioOpenedInput>
  readonly holders: Set<Holder>
}

const deviceKey = (deviceId: string | null) => deviceId ?? 'default'

/** The words for a lane refused because others are armed on another input. */
export function studioOneInputWords(
  lane: string,
  input: string,
  armedOn: readonly string[],
  held: string,
): string {
  const who =
    armedOn.length === 1 ? `${armedOn[0]} is` : `${joinNames(armedOn)} are`
  const them = armedOn.length === 1 ? armedOn[0] : 'them'
  return `${lane} records from ${input}, and ${who} armed on ${held}. Studio records from one audio input at a time: disarm ${them}, or choose ${held} for ${lane}.`
}

export function createStudioMicShare(options: StudioMicShareOptions) {
  let shared: Shared | null = null

  /** The lanes armed on the shared input, other than `trackId`. */
  function inTheWay(trackId: string | null): string[] {
    if (shared === null) return []
    const names: string[] = []
    for (const holder of shared.holders) {
      if (holder.trackId === undefined || holder.trackId === trackId) continue
      if (!options.armed(holder.trackId)) continue
      const name = options.laneName(holder.trackId)
      if (!names.includes(name)) names.push(name)
    }
    return names
  }

  function letGo(share: Shared, holder: Holder): void {
    share.holders.delete(holder)
    if (share.holders.size > 0) return
    if (shared === share) shared = null
    void share.opening.then((opened) => opened.release()).catch(() => undefined)
  }

  /**
   * Lane `trackId`'s input: the shared one when it is the input asked for,
   * else opened now, inside the press; refused while other lanes are armed
   * on another input.
   */
  async function open(
    trackId: string | null,
    ask: StudioInputAsk,
  ): Promise<StudioOpenedInput> {
    const device = deviceKey(ask.deviceId)
    if (shared !== null && shared.device !== device) {
      const armedOn = inTheWay(trackId)
      if (armedOn.length > 0)
        throw new StudioInputRefusal(
          studioOneInputWords(
            options.laneName(trackId),
            ask.name,
            armedOn,
            shared.name,
          ),
        )
      // Every lane on it has left: their late releases end nothing now.
      shared = null
    }
    const share = (shared ??= {
      device,
      name: ask.name,
      opening: options.open(ask.deviceId),
      holders: new Set(),
    })
    const holder: Holder = { trackId }
    share.holders.add(holder)
    let opened: StudioOpenedInput
    try {
      opened = await share.opening
    } catch (error) {
      share.holders.delete(holder)
      if (shared === share && share.holders.size === 0) shared = null
      throw error
    }
    let released = false
    return {
      stream: opened.stream,
      missing: opened.missing,
      release: () => {
        if (released) return
        released = true
        letGo(share, holder)
      },
    }
  }

  return {
    open,
    /**
     * Keep the input open for `deviceId` while a lane on it re-arms, as a
     * lane whose channel changed does: the release for the hold this takes.
     * Nothing is held for an input not open now.
     */
    retain(deviceId: string | null): () => void {
      const share = shared
      if (share === null || share.device !== deviceKey(deviceId))
        return () => undefined
      const holder: Holder = {}
      share.holders.add(holder)
      return () => letGo(share, holder)
    },
    /** The input the lanes share, by its name; null while none is held. */
    name: (): string | null => shared?.name ?? null,
  }
}

export type StudioMicShare = ReturnType<typeof createStudioMicShare>
