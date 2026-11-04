// ============================================================
// The TV chooser: what a connected TV shows, asked once per TV
// ============================================================
//
// Screen Mirroring, or a cable, gives the iPhone a second screen, and the
// app can put something of the Karaoke room's own there instead of a mirror
// of the phone: the stage (the pitch lane, the lyrics under it and the
// score, TVStage.swift) or the lyrics full screen (TVLyrics.swift). The
// owner's call (3 Nov 2026), after both "worked great" on an LG C2: the
// stage is the better one, and the first time a TV connects the phone asks,
// with a box to remember the answer for that TV.
//
// A TV CONNECTS: the plugin says so (either view's event, or a read at
// launch for a TV that was already there). AirPlay's sound alone gives the
// phone no screen, so it never asks there. Then:
//
//   1. its name is waited for, briefly (tv-name.ts): the sound's route
//      names the TV a moment after the screen arrives, or never;
//   2. a TV with a remembered choice shows it at once (tv-memory.ts);
//   3. any other TV is asked about (TvChoiceSheet.tsx). While the sheet is
//      up both views are off, so the TV mirrors the phone and shows the
//      question too: the native side puts up whichever view was on last
//      the moment a screen connects, and a TV that has never been asked
//      should not be showing an answer;
//   4. the answer is shown, and kept for that TV if the box stays ticked.
//      Unticked, it holds for this connection only: the next one asks
//      again. Not now (and Back, the backdrop, a swipe) is the mirror for
//      this connection, kept for nothing.
//
// A CHOICE IS SHOWN through the plugin's own two switches: the stage on, the
// lyrics on (each turns the other off natively), or both off for the mirror.
// The native side keeps the last of them across launches, which is why a TV
// that was never asked can arrive showing a view.
//
// Settings changes a remembered TV's choice and shows it at once if that TV
// is the one connected (TvSettingsGroup.tsx). The Developer screen's TV
// switches (TvLyricsPanel.tsx) set what the TV shows now and leave this
// memory alone, so a tester can try either view without changing what the
// singer chose.
//
// Where the phone has no TV plugin (Android, the web: both reads answer
// null) nothing here runs: no sheet, and no TV group in Settings.
//
// Each step is a line in the console under `[tv]`, never with the TV's
// name: a name can name a person, and the console's lines are copied off
// the phone into bug reports (audio-route-store.ts says the same of ports).

import { onTvLyrics, onTvStage, readTvLyrics, readTvStage, setTvLyricsEnabled, setTvStageEnabled, } from '@irchiinnuss/mobile-runtime/platform'
import { createSignal } from 'solid-js'
import type { TvChoice } from './tv-memory'
import { rememberedChoice, rememberTv } from './tv-memory'
import type { TvNameWait } from './tv-name'
import { TV_NAME_WAIT_MS, waitForTvName } from './tv-name'

/** The plugin, as the chooser reaches it: the test seam. */
export interface TvDevice {
  /** Whether a TV is connected now, or null where the phone has no TV. */
  read(): Promise<boolean | null>
  /** A TV coming (true) and going (false), as often as either view says. */
  watch(handler: (connected: boolean) => void): () => void
  /** Show a choice: the stage on, the lyrics on, or both off. */
  show(choice: TvChoice): Promise<void>
}

/** The question the sheet asks, about the TV connected now. */
export interface TvAsk {
  /** The TV's name, or null for a TV whose name never came. */
  readonly name: string | null
}

/** The chooser's words for each choice, in the console. */
const SHOWS: Readonly<Record<TvChoice, string>> = {
  stage: 'the stage',
  lyrics: 'the lyrics',
  mirror: 'the phone, mirrored',
}

/** The TV plugin of the iPhone app (LyricsWindowPlugin.swift). */
export function createPlatformTvDevice(): TvDevice {
  return {
    read: async () => {
      const [stage, lyrics] = await Promise.all([readTvStage(), readTvLyrics()])
      if (stage === null || lyrics === null) return null
      return stage.connected || lyrics.connected
    },
    watch: (handler) => {
      const stops = [
        onTvStage((state) => {
          handler(state.connected)
        }),
        onTvLyrics((state) => {
          handler(state.connected)
        }),
      ]
      return () => {
        for (const stop of stops) stop()
      }
    },
    show: async (choice) => {
      if (choice === 'stage') await setTvStageEnabled(true)
      else if (choice === 'lyrics') await setTvLyricsEnabled(true)
      else {
        await Promise.all([setTvStageEnabled(false), setTvLyricsEnabled(false)])
      }
    },
  }
}

const [available, setAvailable] = createSignal(false)
const [asking, setAsking] = createSignal<TvAsk | null>(null)

let device: TvDevice | null = null
let waitMs = TV_NAME_WAIT_MS
let connected = false
/** Bumped on every coming and going: a wait that outlives its TV is dropped. */
let connection = 0
let naming: TvNameWait | null = null
/** The TV connected now, once its name is settled. */
let current: TvAsk | null = null

/** Whether this phone can put the room on a TV: the plugin answered. */
export const tvChoiceAvailable = available

/** The question on screen, or null. Reactive. */
export const tvChoiceAsking = asking

/** Whether the sheet is up: what Back answers to first. */
export function tvChoiceUp(): boolean {
  return asking() !== null
}

function say(line: string): void {
  console.info(`[tv] ${line}`)
}

function show(choice: TvChoice): void {
  const target = device
  if (target === null) return
  void target.show(choice).catch(() => undefined)
}

/** Once the name is settled: what it shows, or the question. */
function settle(name: string | null, waitedMs: number): void {
  current = { name }
  const kept = rememberedChoice(name)
  const named =
    name === null
      ? `no name within ${String(waitMs)} ms`
      : `named by its sound after ${String(waitedMs)} ms`
  if (kept !== null) {
    say(`${named}: it shows ${SHOWS[kept]}, as remembered`)
    show(kept)
    return
  }
  say(`${named}: asking what it shows`)
  // The mirror while the sheet is up, whatever the TV showed last time: it
  // shows the phone, the question included.
  show('mirror')
  setAsking({ name })
}

async function meet(id: number): Promise<void> {
  const started = Date.now()
  const wait = waitForTvName({ waitMs })
  naming = wait
  const name = await wait.name
  if (id !== connection) return
  naming = null
  settle(name, Date.now() - started)
}

/** A TV came or went; the same news from both views is heard once. */
function hear(now: boolean): void {
  if (now === connected) return
  connected = now
  connection += 1
  naming?.cancel()
  naming = null
  current = null
  setAsking(null)
  if (!now) {
    say('the TV went away')
    return
  }
  say('a TV connected')
  void meet(connection)
}

export interface TvChoiceOptions {
  /** How long a TV that just connected waits for its name, in ms. */
  readonly waitMs?: number
}

/**
 * Listen for TVs, from the shell's mount, for as long as it stands. Returns
 * the stop, which also takes the question down.
 */
export function installTvChoice(
  made: TvDevice = createPlatformTvDevice(),
  options: TvChoiceOptions = {},
): () => void {
  resetTvChoice()
  device = made
  waitMs = options.waitMs ?? TV_NAME_WAIT_MS
  let live = true
  // A read that comes back after a change was heard says less than the
  // change did, as the room's own TV watches say (native-device.ts).
  let heard = false
  const stop = made.watch((now) => {
    if (!live) return
    heard = true
    setAvailable(true)
    hear(now)
  })
  void made.read().then(
    (now) => {
      if (!live || now === null) return
      setAvailable(true)
      // A TV that was connected before the app was is met all the same.
      if (!heard && now) hear(true)
    },
    () => undefined,
  )
  return () => {
    live = false
    stop()
    resetTvChoice()
  }
}

/** The sheet's answer: shown now, and kept for this TV if `remember`. */
export function chooseTv(choice: TvChoice, remember: boolean): void {
  const ask = asking()
  if (ask === null) return
  setAsking(null)
  if (remember) rememberTv(ask.name, choice)
  say(`chosen: ${SHOWS[choice]}, ${remember ? 'remembered' : 'for now'}`)
  show(choice)
}

/** Not now, and Back, the backdrop or a swipe: the mirror, kept for nothing. */
export function notNowTv(): void {
  if (asking() === null) return
  setAsking(null)
  say(`not now: ${SHOWS.mirror}, for now`)
  show('mirror')
}

/**
 * Settings: keep another choice for a remembered TV, and show it now if
 * that TV is the one connected and past its question.
 */
export function changeTvChoice(name: string | null, choice: TvChoice): void {
  rememberTv(name, choice)
  if (current === null || current.name !== name || asking() !== null) return
  say(`changed in Settings: ${SHOWS[choice]}`)
  show(choice)
}

/** Nothing heard, nothing asked: as before the shell mounted. */
export function resetTvChoice(): void {
  naming?.cancel()
  naming = null
  device = null
  connected = false
  connection += 1
  current = null
  setAsking(null)
  setAvailable(false)
}
