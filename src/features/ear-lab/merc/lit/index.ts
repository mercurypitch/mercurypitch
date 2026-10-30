// ============================================================
// The room's lit instruments, by the name each web instrument exports
// itself under (instrument-skin.ts). The room provides this to the drills
// it draws; an instrument not named here draws itself as on the web.
// Hairline's lens comes the older way, through the stage skin's
// VernierLoupe (skin.tsx).
// ============================================================

import type { Component } from 'solid-js'
import type { BeatPendulumsProps } from '@/features/ear-lab/BeatPendulums'
import type { EscapementLatticeProps } from '@/features/ear-lab/EscapementLattice'
import type { InstrumentSkin } from '@/features/ear-lab/instrument-skin'
import type { MetreLatticeProps } from '@/features/ear-lab/MetreLattice'
import type { MetronomeColumnProps } from '@/features/ear-lab/MetronomeColumn'
import type { RhythmDrumProps } from '@/features/ear-lab/RhythmDrum'
import { LitLanes } from './LitLanes'
import { LitPendulum } from './LitPendulum'
import { LitRhythm } from './LitRhythm'
import { LitRods } from './LitRods'
import { LitStrings } from './LitStrings'

export const LIT_INSTRUMENTS = {
  // Resolution
  BeatPendulums: LitStrings satisfies Component<BeatPendulumsProps>,
  // Time
  EscapementLattice: LitRods satisfies Component<EscapementLatticeProps>,
  MetronomeColumn: LitPendulum satisfies Component<MetronomeColumnProps>,
  MetreLattice: LitLanes satisfies Component<MetreLatticeProps>,
  RhythmDrum: LitRhythm satisfies Component<RhythmDrumProps>,
} as const satisfies InstrumentSkin
