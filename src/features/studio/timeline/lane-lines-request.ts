// ============================================================
// Studio lane lines request — a lane's volume and pan lines opened from outside the timeline, as from its details
// ============================================================
//
// A compact lane's header has no Lines toggle, and a phone's never has: its
// details sheet opens the lines instead. The sheet asks here and the timeline,
// which owns the one open line (line-editor.ts), answers; the same way the
// record card and the timeline speak through record-card-aside.ts rather than
// through the workspace between them. Each request is new, so asking twice for
// the same lane asks twice.
import { createSignal } from 'solid-js'

const [request, setRequest] = createSignal<{ readonly trackId: string } | null>(
  null,
  { equals: false },
)

/** The latest request: the lane whose lines to open. */
export const studioLaneLinesRequest = request

export function requestStudioLaneLines(trackId: string): void {
  setRequest({ trackId })
}
