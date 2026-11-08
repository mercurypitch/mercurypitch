// ============================================================
// Studio record lanes — every armed lane as the timeline draws it: its level and its take as it records, each woken by its own lane alone
// ============================================================
//
// The recorder's view changes with every level its lanes' captures send,
// many times a second for each armed lane. The timeline draws each armed
// lane's meter and growing take from a record of its own
// (StudioTimelineRecording), whose level and take are read through signals
// of its own: a level wakes the meter that draws it, not every lane, and the
// list of records changes only when a lane is armed or disarmed. Which lanes
// are armed, and which of them hold a microphone, changes as seldom.
import { batch, createSignal } from 'solid-js'
import type { StudioLiveTake, StudioRecorderView, StudioRecordLane, } from '@/lib/studio/record/studio-recorder'
import type { StudioTimelineRecording } from '../timeline/types'

/** An armed lane, as its arm button and the mic icon read it. */
export type StudioArmedLane = Pick<
  StudioRecordLane,
  'trackId' | 'arming' | 'microphone'
>

interface Entry {
  readonly record: StudioTimelineRecording
  setLevel(level: number): void
  setLive(live: StudioLiveTake | null): void
}

const sameLanes = (
  before: readonly StudioArmedLane[],
  next: readonly StudioArmedLane[],
) =>
  before.length === next.length &&
  before.every(
    (lane, index) =>
      lane.trackId === next[index].trackId &&
      lane.arming === next[index].arming &&
      lane.microphone === next[index].microphone,
  )

export function createStudioRecordLanes() {
  const [lanes, setLanes] = createSignal<readonly StudioArmedLane[]>([], {
    equals: sameLanes,
  })
  const [records, setRecords] = createSignal<
    readonly StudioTimelineRecording[]
  >([])
  const [listening, setListening] = createSignal(false)
  const entries = new Map<string | null, Entry>()

  function entry(trackId: string | null): Entry {
    const found = entries.get(trackId)
    if (found !== undefined) return found
    const [level, setLevel] = createSignal(0)
    const [live, setLive] = createSignal<StudioLiveTake | null>(null)
    const made: Entry = {
      record: {
        trackId,
        get level() {
          return level()
        },
        get live() {
          return live()
        },
        get listening() {
          return listening()
        },
      },
      setLevel,
      setLive,
    }
    entries.set(trackId, made)
    return made
  }

  return {
    /** The armed lanes, in the order they were armed; a new list only when one is armed, opens or goes. */
    lanes,
    /** Each armed lane's record for the timeline; a new list only when a lane is armed or goes. */
    records,
    /** Take the recorder's newest view. */
    update(view: StudioRecorderView): void {
      const now = view.lanes ?? []
      batch(() => {
        setListening(view.phase !== 'idle' && view.phase !== 'finishing')
        setLanes(
          now.map(({ trackId, arming, microphone }) => ({
            trackId,
            arming,
            microphone,
          })),
        )
        const known =
          now.length === entries.size &&
          now.every((lane) => entries.has(lane.trackId))
        for (const lane of now) {
          const each = entry(lane.trackId)
          each.setLevel(lane.level)
          each.setLive(lane.live)
        }
        if (known) return
        for (const trackId of [...entries.keys()])
          if (!now.some((lane) => lane.trackId === trackId))
            entries.delete(trackId)
        setRecords(now.map((lane) => entry(lane.trackId).record))
      })
    },
  }
}

export type StudioRecordLanes = ReturnType<typeof createStudioRecordLanes>
