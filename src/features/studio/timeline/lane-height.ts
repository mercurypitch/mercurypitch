// ============================================================
// Studio lane height — compact lanes, or tall ones that bring each lane's lines, fader and pan back into its header
// ============================================================
//
// Device-local, as the record settings are: how tall the lanes stand is a
// habit of the person at this screen, not part of a song. One signal for the
// whole Studio, so every lane changes together. Compact is the default: the
// header keeps the lane's identity and its Arm, Mute and Solo, and volume and
// pan live in the Mix desk and Track details. Storage that throws or is
// missing keeps the lanes compact for the visit. A phone's lanes are always
// compact.
import { createSignal } from 'solid-js'

const KEY = 'mercurypitch.studio.lane-height'

export type StudioLaneHeight = 'compact' | 'tall'

function stored(): StudioLaneHeight {
  try {
    return localStorage.getItem(KEY) === 'tall' ? 'tall' : 'compact'
  } catch {
    return 'compact'
  }
}

const [height, setHeight] = createSignal<StudioLaneHeight>(stored())

/** How tall the lanes stand on this device. */
export const studioLaneHeight = height

export function setStudioLaneHeight(next: StudioLaneHeight): void {
  setHeight(next)
  try {
    if (next === 'tall') localStorage.setItem(KEY, 'tall')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage may be off (a private window): the choice lasts for this visit.
  }
}

/** Read the stored choice again, as a new visit would. For tests. */
export function reloadStudioLaneHeight(): void {
  setHeight(stored())
}
