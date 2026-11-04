// ============================================================
// Studio record card aside — whether a phone's line bar stands at the arrangement's foot, where the record card floats
// ============================================================
//
// A phone has one foot for one bar. While a lane is only armed, its lines
// may open there, and the record card (StudioRecordNotices.tsx) steps aside
// until they close; a take closes them, so the card is back for the
// count-in. The timeline says when its bar stands there
// (StudioTimeline.tsx), and the card reads it here instead of through the
// workspace between them, as the controls that wait for a take read
// take-running.ts.
import { createSignal } from 'solid-js'

const [aside, setAside] = createSignal(false)

/** True while a phone's open line bar holds the foot the record card stands in. */
export const studioRecordCardAside = aside

/** The timeline's report, each time a phone's line bar opens or closes. */
export function setStudioRecordCardAside(next: boolean): void {
  setAside(next)
}
