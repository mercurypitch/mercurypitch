// ============================================================
// The room's lit instruments, by the name each web instrument exports
// itself under (instrument-skin.ts). The room provides this to the drills
// it draws; an instrument not named here draws itself as on the web.
// Hairline's lens comes the older way, through the stage skin's
// VernierLoupe (skin.tsx).
// ============================================================

import type { Component } from 'solid-js'
import type { BeadChainProps } from '@/features/ear-lab/BeadChain'
import type { BeatPendulumsProps } from '@/features/ear-lab/BeatPendulums'
import type { EscapementLatticeProps } from '@/features/ear-lab/EscapementLattice'
import type { GearTrainProps } from '@/features/ear-lab/GearTrain'
import type { IndexArcProps } from '@/features/ear-lab/IndexArc'
import type { InstrumentSkin } from '@/features/ear-lab/instrument-skin'
import type { MetreLatticeProps } from '@/features/ear-lab/MetreLattice'
import type { MetronomeColumnProps } from '@/features/ear-lab/MetronomeColumn'
import type { MixingDeskProps } from '@/features/ear-lab/MixingDesk'
import type { ProgressionTrainProps } from '@/features/ear-lab/ProgressionTrain'
import type { PullBeamProps } from '@/features/ear-lab/PullBeam'
import type { RhythmDrumProps } from '@/features/ear-lab/RhythmDrum'
import type { StylusTraceProps } from '@/features/ear-lab/StylusTrace'
import type { TuningForkProps } from '@/features/ear-lab/TuningFork'
import { LitBeam } from './LitBeam'
import { LitChain } from './LitChain'
import { LitDesk } from './LitDesk'
import { LitDial } from './LitDial'
import { LitDiscs } from './LitDiscs'
import { LitLanes } from './LitLanes'
import { LitOrbs } from './LitOrbs'
import { LitPendulum } from './LitPendulum'
import { LitProbe } from './LitProbe'
import { LitRhythm } from './LitRhythm'
import { LitRods } from './LitRods'
import { LitStrings } from './LitStrings'
import { LitTrace } from './LitTrace'

export const LIT_INSTRUMENTS = {
  // Resolution
  BeatPendulums: LitStrings satisfies Component<BeatPendulumsProps>,
  // Time
  EscapementLattice: LitRods satisfies Component<EscapementLatticeProps>,
  MetronomeColumn: LitPendulum satisfies Component<MetronomeColumnProps>,
  MetreLattice: LitLanes satisfies Component<MetreLatticeProps>,
  RhythmDrum: LitRhythm satisfies Component<RhythmDrumProps>,
  // Colour
  MixingDesk: LitDesk satisfies Component<MixingDeskProps>,
  GearTrain: LitDiscs satisfies Component<GearTrainProps>,
  ProgressionTrain: LitOrbs satisfies Component<ProgressionTrainProps>,
  // Colour and Shape: Bassline, Span and Echo share the ladder
  BeadChain: LitChain satisfies Component<BeadChainProps>,
  // Shape
  StylusTrace: LitTrace satisfies Component<StylusTraceProps>,
  IndexArc: LitDial satisfies Component<IndexArcProps>,
  // Function
  TuningFork: LitProbe satisfies Component<TuningForkProps>,
  PullBeam: LitBeam satisfies Component<PullBeamProps>,
} as const satisfies InstrumentSkin
