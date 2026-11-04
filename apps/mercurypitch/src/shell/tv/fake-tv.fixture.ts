// ============================================================
// A stand-in for the TV plugin, as the native side behaves
// ============================================================
//
// For the TV chooser's suites. It behaves as LyricsWindowPlugin.swift does:
// the view switched on last goes up the moment a TV connects (TVStage.swift
// and TVLyrics.swift keep their switch across launches), a choice is that
// view switched on, or both off for the mirror, and every switch and every
// coming and going is said by both views, as the two events are.

import type { TvDevice } from './tv-choice'
import type { TvChoice } from './tv-memory'

export interface FakeTv {
  readonly device: TvDevice
  /** What the TV shows now: null while none is connected. */
  readonly screen: () => TvChoice | null
  /** Each choice the chooser showed, in order. */
  readonly shown: TvChoice[]
  /** A TV connects: both views say so. */
  connect(): void
  /** The TV goes away: both views say so. */
  leave(): void
}

export interface FakeTvOptions {
  /** The view a test build left switched on: up as a TV connects. */
  readonly last?: TvChoice
  /** A TV connected before the chooser listened. */
  readonly connected?: boolean
  /** False for a phone with no TV plugin: Android, the web. */
  readonly plugin?: boolean
}

export function fakeTv(options: FakeTvOptions = {}): FakeTv {
  const handlers = new Set<(connected: boolean) => void>()
  let switched: TvChoice = options.last ?? 'mirror'
  let connected = options.connected ?? false
  const shown: TvChoice[] = []
  const tell = (): void => {
    for (const handler of [...handlers]) handler(connected)
  }
  return {
    device: {
      read: async () =>
        Promise.resolve(options.plugin === false ? null : connected),
      watch: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
      show: async (choice) => {
        switched = choice
        shown.push(choice)
        tell()
        return Promise.resolve()
      },
    },
    screen: () => (connected ? switched : null),
    shown,
    connect: () => {
      connected = true
      tell()
      tell()
    },
    leave: () => {
      connected = false
      tell()
      tell()
    },
  }
}
