// ============================================================
// Lesson 18 Sing it — two tunes read from the page and sung in time
// ============================================================
//
// The card on this page's flow (sing-flow.ts), WEB-SPEC Toys 5: the
// comfort check, every visit and never stored; the voice choice, which
// picks who sings, Merc for the lower voice and Tavi for the higher, and
// the learner's staff, the bass clef or the treble; Your turn with the stop
// line and "What this does"; then Start, the only control that asks for
// the microphone.
//
// The staff is the reading staff's sing state (sung.ts draws on it): the
// tune in the learner's clef and octave, its breath mark at the bar line,
// the house on do, the beat grid and the count-in strip, with a Names on ·
// off switch, off, which changes only what is drawn, a take included. It
// takes no taps and has no pitch-line switch. Start opens the microphone,
// then the voice sings do, 1.0 s, the house's note lit, and after 0.4 s of
// quiet the click counts in one bar, "Counting in: one bar.". The take
// opens half a beat before bar 1 (kit/take-in-time.ts, loaded on the first
// Start): from bar 1's first beat the cursor crosses the bars at 60 BPM in
// silence and the beat grid lights each beat, "Your turn: sing in time
// with the cursor.", while Merc and Tavi listen in the hero (kit/merc-duo.ts
// `mercListen`). Nothing else on the page plays from Start: every other
// play button is disabled until the take ends, and a press on one enabled
// since, or a tap on the tap pad, falls on nothing. When bar 2 ends the
// cursor stops at the final bar line and the take listens on until the
// last note's window closes. Half a second later come the pitch line,
// drawn only now, the lines, one a note, and "How did that feel?". Beside
// the staff stands the still of the one who sings. Nothing celebrates a
// note.
//
// With no microphone both tunes are drawn, one above the other, each with
// its own Play the start: do, the count-in, then the cursor through that
// tune's bars in silence, 13.4 s. Play Merc's tunes, once the singing has
// ended, sings do, counts in, sings tune 1, then after 1.0 s counts in
// again and sings tune 2, each note lighting amber as it sounds, 26.4 s,
// on the one staff or, with both drawn, on each tune's own.
//
// The take's module loads with the microphone at Start: one that fails to
// load is a listener that failed, and Sing it takes the no-microphone path
// (state 9). The start, Play the start and Play Merc's tunes are the page's
// one sound (kit/now-playing.ts). Sound turned off during the start ends
// it with no take counted. Leaving the section or hiding the page during a
// take abandons it, and it counts (kit/leave.ts; FACTS 57). Focus moves
// only to text, never to a button, so Space never starts a take by itself
// (REQ-GVC-080). Only the voice is stored, by the kit's voice choice; the
// visit's ending picks the Wrap's card (kit/comfort.ts `VisitEnding`).

import type { Run } from '@/features/lessons/kit/beat-clock'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { WrittenNote } from '@/features/lessons/kit/read-in-time'
import { createReadMarks } from '@/features/lessons/kit/read-marks'
import type { RhythmView } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import { Sound } from '@/features/lessons/kit/sound'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice, midiOf } from '@/features/lessons/kit/staff-places'
import type * as TakeKit from '@/features/lessons/kit/take-in-time'
import type { TakeEnd } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import { COUNT_IN } from './reads'
import type { SingEvent, SingView, SingVisit, TuneNo } from './sing-flow'
import { HINT, nextVisit, openVisit, viewOf } from './sing-flow'
import type { SungPart, SungStaff } from './sung'
import { startSung } from './sung'
import type { Tune } from './tunes'
import { beatsOf, BPM, breathMarks, DO, notesOf, SING_1, SING_2, spaceFor, tuneLabel, tuneScene, } from './tunes'

/** The page's id with the microphone's owner. */
export const CONSUMER = 'lesson-18'

/** The wait after a take before its pitch line and lines show, s (WEB-SPEC, Toys 5, state 7). */
export const AFTER_SEC = 0.5

/** The two tunes. */
export const TUNES: Readonly<Record<TuneNo, Tune>> = { 1: SING_1, 2: SING_2 }

/** Whether this browser can play and listen at all. */
export const hasWebAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext ===
    'function'

/** The still beside the staff: the one who sings, for each voice. */
const STILL: Readonly<Record<Voice, { src: string; alt: string }>> = {
  lower: {
    src: mercBlue,
    alt: 'Merc, who sings the start for the lower voice',
  },
  higher: {
    src: mercOrange,
    alt: 'Tavi, who sings the start for the higher voice',
  },
}

/** Every play on the page outside Sing it: none sounds during a take. */
export const PAGE_PLAYS =
  '[data-play], [data-read-play], [data-read-mark], [data-word-play], [data-quiz-play], [data-read-tap], .read-spot'

/** Whether `e` would play something outside Sing it: a press on a play, or a key on the tap pad. */
function playsElsewhere(e: Event): boolean {
  const t = e.target
  if (!(t instanceof Element) || t.closest('#sing') !== null) return false
  if (e instanceof KeyboardEvent) return t.closest('[data-read-tap]') !== null
  return t.closest(PAGE_PLAYS) !== null
}

/** The events a play answers. */
const PLAY_EVENTS = ['pointerdown', 'click', 'keydown'] as const

/** The syllable a degree from do is sung on, as a line starts it. */
const SYLLABLES = ['Do', 'Re', 'Mi', 'Fa', 'So'] as const

/** Each note's label in a tune's lines: "Re". */
export const labelsOf = (n: TuneNo): string[] =>
  TUNES[n].degrees.map((d) => SYLLABLES[d])

/** A tune's written notes in `clef`: each MIDI note with its first beat and length from bar 1's first beat. */
export function writtenOf(n: TuneNo, clef: Clef): WrittenNote[] {
  const sounds = beatsOf(TUNES[n])
  return notesOf(TUNES[n], clef).map((note, i) => ({
    midi: midiOf(note),
    beat: sounds[i].beat,
    beats: sounds[i].beats,
  }))
}

/** A tune's staff, as a screen reader names it. */
export const singLabel = (n: TuneNo, clef: Clef): string =>
  `${tuneLabel(TUNES[n], clef)}, with a breath mark at the bar line`

export interface SingIt {
  readonly visit: () => SingVisit
}

/** One of Sing it's staves: its figure, its marks and the tune it shows. */
interface Staff extends SungStaff {
  readonly fig: HTMLElement
  tune: TuneNo
  space: number
}

export function initSing(
  o: {
    /** The take's module, loaded on the first Start; a test passes its own. */
    readonly loadTake?: () => Promise<typeof TakeKit>
  } = {},
): SingIt {
  const root = q('#sing')
  const card = q('#singCard', root)
  const status = q('#singStatus', root)
  const namesSeg = q('[data-sing-names]', root)
  const hint = q('#startHint', root)
  const readings = q<HTMLOListElement>('[data-readings]', root)
  const live = q('#singLive', root)
  const chart = q('#singChart', live)
  const still = q<HTMLImageElement>('.sing-merc', root)
  const second = q('#singStaff2', root)
  const button = (name: string): HTMLButtonElement =>
    q<HTMLButtonElement>(`[data-sing="${name}"]`, root)
  const playStart = (n: TuneNo): HTMLButtonElement =>
    q<HTMLButtonElement>(`[data-sing="play-start"][data-tune="${n}"]`, root)
  const loadTake =
    o.loadTake ?? (() => import('@/features/lessons/kit/take-in-time'))

  let visit = openVisit({
    voice: VoiceChoice.voice,
    // unset turns on at the first tap: only off is silent
    sound: Sound.state !== 'off',
    webAudio: hasWebAudio(),
  })
  const mic = new MicHold(CONSUMER)
  // what plays now: the start and its silent bars, Play the start or Play Merc's tunes
  let run: Run | null = null
  // the take under way: how to cancel it, and whether sound off cut its start
  let leaving = false
  let cutStart = false
  let names = false

  const clef = (): Clef =>
    visit.voice === null ? 'bass' : clefForVoice(visit.voice)

  function mountStaff(fig: HTMLElement, tune: TuneNo): Staff {
    const marks = createReadMarks()
    const bar = mountRhythmBar({
      figure: fig,
      pads: null,
      said: q('[data-sing-said]', fig),
      freq: () => hz(midiOf(DO[clef()])),
      voice: () => 'merc',
      owner: NowPlaying,
      onDraw: (f, svg) => {
        const v = bar.view
        if (v !== null) marks.draw(f, svg, v.scene)
      },
    })
    return { fig, bar, marks, tune, space: 0 }
  }
  const main = mountStaff(q('[data-sing-viz="1"]', root), 1)
  const other = mountStaff(q('[data-sing-viz="2"]', root), 2)

  /** Staff `s` shows tune `n` in the learner's clef, at its figure's size, with nothing lit. */
  function show(s: Staff, n: TuneNo): void {
    const c = clef()
    s.tune = n
    s.space = spaceFor(figureSize(s.fig).w)
    const view: RhythmView = {
      scene: tuneScene(TUNES[n], c, { space: s.space }),
      label: singLabel(n, c),
      pads: null,
    }
    s.bar.show(view, () => true)
    s.marks.set({
      home: DO[c],
      syllables: names,
      marks: breathMarks(TUNES[n]),
      names: [],
      tags: [],
      brackets: [],
      cursor: null,
      countIn: { dots: COUNT_IN, lit: null },
      level: null,
    })
    if (s === main) {
      const st = STILL[c === 'bass' ? 'lower' : 'higher']
      if (still.getAttribute('src') !== st.src) still.src = st.src
      still.alt = st.alt
    }
  }
  show(main, 1)
  show(other, 2)

  /** A staff shown before its figure had its size, or since resized past a step of the space, drawn again while nothing plays. */
  function fit(s: Staff): void {
    if (run !== null || s.fig.offsetParent === null) return
    if (spaceFor(figureSize(s.fig).w) !== s.space) show(s, s.tune)
  }
  if (typeof ResizeObserver !== 'undefined')
    for (const s of [main, other])
      new ResizeObserver(() => fit(s)).observe(s.fig)

  function say(text: string | null): void {
    if (text !== null && status.textContent !== text) status.textContent = text
  }

  /** Stops what plays, its lights out; the take, if one listens, carries on. */
  function quiet(): void {
    const r = run
    run = null
    r?.stop()
    NowPlaying.release(quiet)
  }

  /** Starts a run of `parts`, the page's one sound, on `staffOf`'s staves. */
  function startRun(
    parts: readonly SungPart[],
    staffOf: (part: number) => Staff,
    more: {
      readonly show?: (part: number) => void
      readonly onCount?: () => void
      readonly onBeats?: (part: number, beats: number) => void
    } = {},
  ): Run {
    quiet()
    NowPlaying.claim(quiet)
    const r = startSung({
      clef: clef(),
      parts,
      staffOf,
      audible: Sound.canPlay(),
      ...more,
    })
    run = r
    void r.done.then(() => {
      if (run === r) {
        run = null
        NowPlaying.release(quiet)
      }
      // the count-in strip back at rest, unlit
      for (const s of [main, other])
        s.marks.set({ countIn: { dots: COUNT_IN, lit: null } })
    })
    return r
  }

  function send(e: SingEvent): void {
    visit = nextVisit(visit, e)
    render()
  }

  /** The panels and their lines: which show, and which line each says. */
  function renderPanels(v: SingView): void {
    for (const p of qa<HTMLElement>('[data-panel]', card))
      p.hidden = !v.panels.includes(p.dataset.panel as never)
    for (const l of qa<HTMLElement>('[data-voice-line]', card))
      l.hidden = l.dataset.voiceLine !== v.voiceLine
    for (const el of qa<HTMLElement>('.turn, .stop-line, .brief', card))
      el.hidden = !v.singParts
    q('[data-nomic]', card).hidden = v.listenWhy !== 'nomic'
    for (const p of qa<HTMLElement>('[data-after]', card))
      p.hidden = p.dataset.after !== v.closing
    q('[data-after-cue]', card).hidden = !v.cue
    for (const d of qa<HTMLElement>('.doctor', card)) d.hidden = !v.doctor
    // the pitch line and the lines: after a take with voice, never during one
    live.hidden = !v.readings
    readings.hidden = !v.readings || readings.childElementCount === 0
  }

  /** The controls: only those the flow offers, never one disabled. */
  function renderControls(v: SingView): void {
    button('start').hidden = v.start !== 'start'
    button('again').hidden = v.start !== 'again'
    button('tune-2').hidden = v.start !== 'tune-2'
    button('stop').hidden = !v.stopHere
    button('merc').hidden = !v.merc
    second.hidden = !v.both
    playStart(1).hidden = !v.both
    playStart(2).hidden = !v.both
    hint.textContent = v.hint === null ? '' : HINT[v.hint]
    namesSeg.hidden = !v.singParts
  }

  function render(): void {
    const v: SingView = viewOf(visit)
    renderPanels(v)
    renderControls(v)
    const tune: TuneNo = v.both ? 1 : v.tune
    if (visit.taking === null && run === null) {
      if (tune !== main.tune) show(main, tune)
      fit(main)
      fit(other)
    }
    VisitEnding.set(v.card)
    say(v.status)
  }

  /** The lines under the staff after a take: one a note, in order. */
  function writeLines(lines: readonly string[]): void {
    readings.replaceChildren(
      ...lines.map((text) => {
        const li = document.createElement('li')
        li.textContent = text
        return li
      }),
    )
  }

  // the plays Start disabled, given back as the take ends
  let held: HTMLButtonElement[] = []
  const letFall = (e: Event): void => {
    if (!root.isConnected || !playsElsewhere(e)) return
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  /** While a take runs Merc and Tavi listen. */
  function listening(on: boolean): void {
    mercListen('blue', on)
    mercListen('orange', on)
  }

  /** From Start to the take's end nothing else on the page plays. */
  function hold(on: boolean): void {
    for (const b of held) b.disabled = false
    held = on
      ? qa<HTMLButtonElement>(PAGE_PLAYS).filter(
          (b) => !b.disabled && b.closest('#sing') === null,
        )
      : []
    for (const b of held) b.disabled = true
    for (const type of PLAY_EVENTS)
      if (on) document.addEventListener(type, letFall, true)
      else document.removeEventListener(type, letFall, true)
  }

  /** Ends a Start before its take: the microphone let go, and no take counted. */
  function cut(): void {
    mic.release()
    if (visit.taking !== null) send({ type: 'silenced' })
  }

  /** Start, Start again or Start tune 2: the microphone, then do, the count-in and the bars. */
  async function begin(): Promise<void> {
    if (!Sound.canPlay()) {
      send({ type: 'sound', on: false })
      send({ type: 'begin' })
      return
    }
    quiet()
    send({ type: 'sound', on: true })
    const [ok, kit] = await Promise.all([
      mic.open(Sound.context()),
      loadTake().catch(() => null),
    ])
    if (!ok || kit === null) {
      mic.release(true)
      send({ type: 'nomic' })
      return
    }
    send({ type: 'begin' })
    const tune = visit.taking
    if (tune === null) {
      mic.release()
      return
    }
    hold(true)
    show(main, tune)
    readings.replaceChildren()
    leaving = false
    cutStart = false
    const notes = writtenOf(tune, clef())
    let take: Promise<TakeEnd> | null = null
    let begun = false
    // the run, for its first beat's time: set as it starts, before any frame reaches the take
    let started: Run | null = null
    const r = startRun([{ tune: TUNES[tune], sing: false }], () => main, {
      onCount: () => send({ type: 'count' }),
      onBeats: (_part, beats) => {
        // the take opens half a beat before bar 1, 0.5 s after the last click starts
        if (take === null && beats >= -kit.OPEN_BEATS - 1e-6 && !cutStart) {
          const first = started?.pageTimeOfBeat(0) ?? null
          if (first === null || mic.mod === null || mic.listener === null)
            return
          listening(true)
          take = kit.runTake({
            mod: mic.mod,
            listener: mic.listener,
            notes,
            labels: labelsOf(tune),
            bpm: BPM,
            bar1: first + (COUNT_IN * 60000) / BPM,
            cancelled: () => leaving || cutStart,
          })
        }
        if (!begun && beats >= 0 && !cutStart) {
          begun = true
          send({ type: 'listen' })
        }
      },
    })
    started = r
    await r.done
    const opened = take as Promise<TakeEnd> | null
    if (opened === null) {
      hold(false)
      cut()
      return
    }
    const end = await opened
    mic.release()
    listening(false)
    hold(false)
    if (cutStart) {
      // sound off as the take opened: the start was cut, no take counted
      cut()
      return
    }
    if (end.kind === 'left') {
      send({ type: 'took', voiced: true, abandoned: true })
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, AFTER_SEC * 1000))
    writeLines(end.lines)
    if (end.pitch !== null)
      kit.drawPitchLine(
        chart,
        end.pitch,
        notes.map((n) => n.midi),
        labelsOf(tune),
      )
    feelings.reset()
    send({ type: 'took', voiced: end.voiced, abandoned: false })
  }

  /** Play the start for tune `n` with no microphone: do, the count-in, then the cursor through its bars. */
  function playTheStart(n: TuneNo): void {
    const s = n === 1 ? main : other
    if (s.tune !== n) show(s, n)
    startRun([{ tune: TUNES[n], sing: false }], () => s)
  }

  /** Play Merc's tunes: both, sung, on the one staff or each on its own. */
  function playMerc(): void {
    const both = viewOf(visit).both
    const parts: SungPart[] = [
      { tune: TUNES[1], sing: true },
      { tune: TUNES[2], sing: true },
    ]
    if (both) {
      startRun(parts, (part) => (part === 0 ? main : other))
      return
    }
    show(main, 1)
    startRun(parts, () => main, {
      show: (part) => show(main, part === 0 ? 1 : 2),
    })
  }

  // ---------------------------------------------------------------- wiring
  mountComfort(card, {
    onSing: () => send({ type: 'comfort', comfort: 'sing' }),
    onListen: () => send({ type: 'comfort', comfort: 'listen' }),
  })
  bindVoiceButtons(card, (voice) => {
    send({ type: 'voice', voice })
    if (visit.taking === null) {
      quiet()
      show(main, main.tune)
      show(other, 2)
    }
  })
  const feelings = mountFeelings(card, (feeling: Feeling) =>
    send({ type: 'feel', feeling }),
  )
  for (const name of ['start', 'again', 'tune-2'])
    button(name).addEventListener('click', () => void begin())
  button('stop').addEventListener('click', () => {
    quiet()
    send({ type: 'halt' })
  })
  for (const n of [1, 2] as const)
    playStart(n).addEventListener('click', () => playTheStart(n))
  button('merc').addEventListener('click', playMerc)
  for (const b of qa<HTMLButtonElement>('[data-names]', namesSeg))
    b.addEventListener('click', () => {
      names = b.dataset.names === 'on'
      for (const x of qa<HTMLButtonElement>('[data-names]', namesSeg))
        x.setAttribute('aria-pressed', String(x === b))
      // it changes only what is drawn, a take included
      for (const s of [main, other]) s.marks.set({ syllables: names })
    })
  Sound.subscribe((state) => {
    const on = state !== 'off'
    // sound off during the start ends it, with no take counted
    if (!on && visit.taking !== null && !visit.listening) {
      cutStart = true
      quiet()
    }
    send({ type: 'sound', on })
  })
  onLeave(root, () => {
    quiet()
    leaving = true
  })
  render()
  return { visit: () => visit }
}
