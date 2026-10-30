// ============================================================
// The instruments a stage may draw its own way.
//
// A drill renders its instrument by name (BeatPendulums, IndexArc, ...),
// with the props it has always passed. Each instrument module exports its
// component through `skinnable`, so under a stage that provides its own
// drawing for that name (the native room's lit instruments, merc/lit/)
// the drill gets that one, and everywhere else, the web's bench included,
// the instrument draws itself as it always has. No drill's logic moves.
//
// This module imports nothing of the Ear Lab's, so any instrument may
// import it without closing an import cycle.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createComponent, createContext, useContext } from 'solid-js'

/** A stage's own instruments, by the name each was exported under. */
export type InstrumentSkin = Readonly<Record<string, Component<never>>>

/** Provided by the native room only; the web's stage provides none. */
export const InstrumentSkinContext = createContext<InstrumentSkin | null>(null)

/** `drawn`, unless the stage draws the instrument `name` its own way. */
export function skinnable<P extends object>(
  name: string,
  drawn: Component<P>,
): Component<P> {
  return (props: P): JSX.Element => {
    const own = useContext(InstrumentSkinContext)?.[name] as
      | Component<P>
      | undefined
    return createComponent(own ?? drawn, props)
  }
}
