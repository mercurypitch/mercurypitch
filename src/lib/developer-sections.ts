// ============================================================
// Extra panels for the in-app developer console
// ============================================================
//
// The floating console is a log and nothing else, and on a desktop that is
// enough — anything else worth poking at is one devtools console away. On a
// TestFlight build there are no devtools at all, so a switch that can only be
// flipped from a keyboard the tester does not have is a switch that does not
// exist. This is how a build adds one.
//
// A registry rather than an import, for the same reason `armDeveloperConsole`
// is not an unconditional import: whoever registers a section is whoever pays
// for it, so a section that only makes sense inside the app shell is
// registered from the shell's own entry point and the web bundle never
// contains it. Nothing here reaches into `src/stores`, so a standalone room
// bundle that happens to pull this in stays inside its isolation gate.
//
// Registration is idempotent by `id`: a re-registration replaces, which keeps
// a hot reload from stacking four copies of the same panel.

import type { Accessor, JSX } from 'solid-js'
import { createSignal } from 'solid-js'

export interface DeveloperSection {
  /** Stable, and the identity a re-registration replaces. */
  id: string
  /** The heading above the panel, in sentence case. */
  title: string
  render: () => JSX.Element
}

const [sections, setSections] = createSignal<DeveloperSection[]>([])

/** Every registered section, in registration order. */
export const developerSections: Accessor<DeveloperSection[]> = sections

export function registerDeveloperSection(section: DeveloperSection): void {
  setSections((current) => [
    ...current.filter((existing) => existing.id !== section.id),
    section,
  ])
}

/** Test seam, and what a fresh document starts as. */
export function clearDeveloperSections(): void {
  setSections([])
}
