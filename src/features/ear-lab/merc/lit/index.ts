// ============================================================
// The room's lit instruments, by the name each web instrument exports
// itself under (instrument-skin.ts). The room provides this to the drills
// it draws; an instrument not named here draws itself as on the web.
// Hairline's lens comes the older way, through the stage skin's
// VernierLoupe (skin.tsx).
// ============================================================

import type { Component } from 'solid-js'
import type { BeatPendulumsProps } from '@/features/ear-lab/BeatPendulums'
import type { InstrumentSkin } from '@/features/ear-lab/instrument-skin'
import { LitStrings } from './LitStrings'

export const LIT_INSTRUMENTS = {
  BeatPendulums: LitStrings satisfies Component<BeatPendulumsProps>,
} as const satisfies InstrumentSkin
