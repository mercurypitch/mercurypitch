// ============================================================
// Studio master level — the measured master gain a run starts at, kept for the song until a new measurement replaces it
// ============================================================
//
// Export and Compare measure the whole song and set the master gain for one
// revision. An edit makes that measurement stale: a playing song no longer
// glides to it, and the panel says the levels are a preview. The gain it set
// is still the level the listener just heard, though, so a run built after
// the edit, by Play or by a seek that needs a new run, starts there too, not
// at the unmeasured 0 dB, which could be several dB away. It is kept until a
// new measurement replaces it, or another song is opened.
import type { StudioMasterGain, StudioMasterGainToken, } from '../export/sound-graph'
import type { StudioProject } from '../model/types'

/** Refuse a measured gain the master chain cannot take. */
export function checkStudioMasterGain(value: StudioMasterGainToken): void {
  if (
    !Number.isFinite(value.gainDb) ||
    value.gainDb < -24 ||
    value.gainDb > 36 ||
    !Number.isFinite(value.safetyGainDb) ||
    value.safetyGainDb > 0 ||
    value.safetyGainDb < -24
  )
    throw new Error('The prepared master has invalid gain settings.')
}

const UNMEASURED: StudioMasterGain = { gainDb: 0, safetyGainDb: 0 }

export function createStudioMasterLevel() {
  // The measurement for the revision heard; null once an edit makes it stale.
  let fresh: StudioMasterGainToken | null = null
  // The song's newest measurement, stale or not.
  let last: StudioMasterGainToken | null = null
  return {
    /** The measurement for the revision heard, or null once an edit makes it stale. */
    fresh: () => fresh,
    /** A new measurement; null forgets the song's, as when another song opens. */
    set(value: StudioMasterGainToken | null): void {
      if (value) checkStudioMasterGain(value)
      fresh = value === null ? null : { ...value }
      last = fresh
    },
    /** Follow the song: another revision makes the measurement stale. True while it is fresh. */
    observe(project: StudioProject): boolean {
      if (
        fresh &&
        (fresh.projectId !== project.id || fresh.revision !== project.revision)
      )
        fresh = null
      return fresh !== null
    },
    /**
     * The gain a new run starts at: a fresh measurement; else the level of
     * the run it takes over from; else the song's last measurement, the
     * level heard before an edit or a pause. 0 dB only before any.
     */
    startingGain(
      project: StudioProject,
      heard: StudioMasterGain | null,
    ): StudioMasterGain {
      const gain =
        fresh ?? heard ?? (last?.projectId === project.id ? last : null)
      return gain
        ? { gainDb: gain.gainDb, safetyGainDb: gain.safetyGainDb }
        : { ...UNMEASURED }
    },
  }
}
