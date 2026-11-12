// ============================================================
// Lesson 18 reading staff — the staff every step reads from, and its plays
// ============================================================
//
// Lesson 16's staff over Lesson 17's beat grid (WEB-SPEC, Toys 2): the
// kit's rhythm bar draws two bars of 4/4 on the learner's clef with the
// beat grid's eight pads, drawn and never pressed, and lights each note as
// it sounds and each pad on its beat; kit/read-marks.ts writes over it the
// house on do, the syllables while Names is on, the cursor, the count-in's
// dots, the gold brackets, the names and lag tags of the note-by-note read
// and a song sheet's marks. A step shows its own state, its plays the
// controls marked with its part; free play shows every play at once, each
// drawing its own tune. Step 1's plays stay disabled behind the lock line
// until the predict's choice, or for good once the lesson is done.
//
// Every play is booked on the beat clock and is the page's one sound
// (kit/now-playing.ts): the rhythm bar's own plays, Merc's way, the tunes,
// the count-in and the marks' examples, claim it as they start, and the
// page's own runs, the note-by-note read, a bracket's notes and a tapped
// note, claim it too. A drawn bracket and a written mark are buttons over
// the figure that play their notes again; each note is one too, which
// plays it for 0.8 s and says it, "B3, mi, a quarter note". Step 3's pad
// takes taps, sounding the clap and lighting the beat each fell nearest,
// and from the fourth reads their tempo, never judged.

import type { Run } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { q, qa } from '@/features/lessons/kit/dom'
import { Motion } from '@/features/lessons/kit/motion-switch'
import type { Spelled } from '@/features/lessons/kit/notes'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Bracket, MarkBox, SheetMark, } from '@/features/lessons/kit/read-marks'
import { createReadMarks } from '@/features/lessons/kit/read-marks'
import type { PlayPart, RhythmBar, RhythmView, } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { figureSize } from '@/features/lessons/kit/rhythm-draw'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import type { Bus } from '@/features/lessons/kit/sound-ahead'
import { bookNote, openBus } from '@/features/lessons/kit/sound-ahead'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { bindTapPad, createTapTempo } from '@/features/lessons/kit/tap-pad'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { triggerDrumVoice } from '@/lib/drum-voices'
import { startByName } from './by-name'
import { bracketsAt, breathAt, COUNT_IN, cursorAt, levelAt, MARK_LINES, marksAt, marksDrawn, noteWords, READ_LINES, tapTempoLine, TUNE_LINES, } from './reads'
import type { MarkId, Short, Tune } from './tunes'
import { beatsOf, BPM, bracketName, breathMarks, COLD, DO, notesOf, SHORTS, shortScene, spaceFor, TUNE_A, TUNE_B, TUNE_C, TUNE_C_BREATH, tuneLabel, tuneScene, tuneShape, } from './tunes'

/** A tapped note sounds this long, s (WEB-SPEC, Toys 2). */
export const TAP_NOTE_SEC = 0.8
/** A tap's clap, at Lesson 17's level. */
export const CLAP_LEVEL = 0.7

export type Part = 1 | 2 | 3 | 4
export type PlayId = 'by-name' | 'way' | 'tune-a' | 'tune-b' | 'count-in'

/** Each step's figure label, after its "Fig. n": one line on a phone, as the stage's budget counts it. */
export const FIG_LABELS: Readonly<Record<Part, string>> = {
  1: "Merc's tune, read two ways.",
  2: 'Patterns in tunes A and B.',
  3: 'Tune C, counted in.',
  4: 'The marks, as they sound.',
}

/** What the staff shows: a tune with its brackets drawn so far, or a short figure. */
type Shown =
  | { readonly kind: 'tune'; readonly tune: Tune }
  | { readonly kind: 'short'; readonly short: Short }

/** A play under way: how its frames move the cursor and the marks. */
interface Playing {
  /** Beats of the click alone before bar 1. */
  readonly countIn: number
  /** Beats across its bars. */
  readonly total: number
  /** Each frame, beats into its bars (below 0 in the count-in). */
  frame(beats: number): void
}

export interface ReadingStaffOptions {
  /** Free play: every play shown at once, each drawing its own tune. */
  readonly free: boolean
  /** Step 1's plays open from the start: the lesson is done (`Done.has(18)`). */
  readonly unlocked: boolean
}

export interface ReadingStaff {
  /** Shows a step's state, its tune and its controls, and stops what plays. */
  setPart(part: Part): void
  /** The predict's choice is in: Step 1's plays open. */
  unlock(): void
  /** Stops what the staff plays. */
  stop(): void
  readonly bar: RhythmBar
}

/** The staff's plays, in a toy's root: the steps' `#toyRead` or free play's card. */
export function mountReadingStaff(
  root: HTMLElement,
  o: ReadingStaffOptions,
): ReadingStaff {
  const figure = q<HTMLElement>('[data-read-viz]', root)
  const said = q<HTMLElement>('[data-read-said]', root)
  const label = root.querySelector<HTMLElement>('[data-fig-label]')
  const lockLines = qa<HTMLElement>('[data-read-lock]', root)
  const light = playLights()
  const marks = createReadMarks()
  const spots = document.createElement('div')
  spots.className = 'read-spots'
  figure.append(spots)

  const state = {
    part: 1 as Part,
    clef: (VoiceChoice.voice === 'higher' ? 'treble' : 'bass') as Clef,
    unlocked: o.unlocked,
    shown: { kind: 'tune', tune: COLD } as Shown,
  }
  // the brackets drawn of the tune shown, which stay until its next play
  let brackets: Bracket[] = []
  // a short figure's marks once heard, or written as it sounds
  let sheet: SheetMark[] = []
  let playing: Playing | null = null
  // the page's own run on the beat clock, when one plays
  let run: Run | null = null
  // the beats into the bars of the play that runs, for a tap's pad
  let nowBeats: number | null = null

  const bar = mountRhythmBar({
    figure,
    pads: null,
    said,
    freq: () => hz(midiOf(DO[state.clef])),
    voice: () => 'merc',
    owner: NowPlaying,
    onFrame: (beats) => {
      if (beats === null) {
        nowBeats = null
        return
      }
      const p = playing
      if (p === null) return
      nowBeats = beats - p.countIn
      p.frame(beats - p.countIn)
    },
    onDraw: (fig, svg) => {
      const view = bar.view
      if (view === null || bar.seen.lanes) {
        spots.replaceChildren()
        return
      }
      marks.draw(fig, svg, view.scene)
      drawSpots()
    },
  })

  // ---------------------------------------------------------------- what shows

  const notes = (): Spelled[] =>
    state.shown.kind === 'tune'
      ? notesOf(state.shown.tune, state.clef)
      : state.shown.short.degrees.map(
          (d) => notesOf({ ...TUNE_C, degrees: [d] }, state.clef)[0],
        )

  function viewOf(shown: Shown): RhythmView {
    const space = spaceFor(figureSize(figure).w)
    if (shown.kind === 'tune')
      return {
        scene: tuneScene(shown.tune, state.clef, { space }),
        label: tuneLabel(shown.tune, state.clef),
        pads: null,
      }
    return {
      scene: shortScene(shown.short, state.clef, { space }),
      label: `${state.clef === 'bass' ? 'Bass' : 'Treble'} staff, a short figure: ${notes()
        .map((n) => n.letter)
        .join(', ')}`,
      pads: null,
    }
  }

  /** Draws what shows, every note written, with its marks so far. */
  function show(shown: Shown): void {
    state.shown = shown
    bar.show(viewOf(shown), () => true)
    marks.set({
      home: DO[state.clef],
      brackets,
      marks: sheet,
      names: [],
      tags: [],
      cursor: null,
      countIn: null,
      level: null,
    })
    drawSpots()
  }

  // ---------------------------------------------------------------- the buttons over the figure

  /** A box as a button's place over the figure, in the figure's pixels. */
  function place(btn: HTMLButtonElement, box: MarkBox): void {
    btn.style.left = `${box.x}px`
    btn.style.top = `${box.y}px`
    btn.style.width = `${box.w}px`
    btn.style.height = `${box.h}px`
  }

  function spot(
    kind: string,
    name: string,
    box: MarkBox,
    press: (btn: HTMLButtonElement) => void,
  ): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `read-spot ${kind}`
    b.setAttribute('aria-label', name)
    place(b, box)
    b.addEventListener('click', () => press(b))
    return b
  }

  /** The notes, the drawn brackets and the written marks, each a button over the figure. */
  function drawSpots(): void {
    if (bar.seen.lanes) return spots.replaceChildren()
    const out: HTMLButtonElement[] = []
    const shown = state.shown
    // a tapped note plays alone (the steps and free play)
    const ns = notes()
    const sounds =
      shown.kind === 'tune'
        ? beatsOf(shown.tune)
        : shown.short.bars.flat().map((w) => ({ beat: 0, beats: w.value }))
    const degrees =
      shown.kind === 'tune' ? shown.tune.degrees : shown.short.degrees
    marks.noteBoxes().forEach((box, i) => {
      const n = ns[i]
      if (n === undefined) return
      const b = spot(
        'is-note',
        noteWords(n, degrees[i], sounds[i]?.beats ?? 1),
        box,
        () => playNote(i),
      )
      b.tabIndex = i === 0 ? 0 : -1
      out.push(b)
    })
    if (shown.kind === 'tune') {
      const tune = shown.tune
      marks.bracketBoxes().forEach((box, k) => {
        const br = brackets[k]
        if (br === undefined) return
        out.push(
          spot('is-bracket', bracketName(tune, br, state.clef), box, (b) =>
            playBracket(br, b),
          ),
        )
      })
    }
    marks.markBoxes().forEach(({ box, mark }) => {
      const id = markIdOf(mark)
      if (id === null) return
      out.push(
        spot('is-mark', `Play the ${MARK_NAMES[id]} again`, box, (b) =>
          playMark(id, b),
        ),
      )
    })
    spots.replaceChildren(...out)
  }

  // the notes' buttons are one stop, the arrow keys moving between them
  spots.addEventListener('keydown', (e) => {
    const t = e.target
    if (!(t instanceof HTMLButtonElement) || !t.classList.contains('is-note'))
      return
    const list = Array.from(
      spots.querySelectorAll<HTMLButtonElement>('.is-note'),
    )
    const i = list.indexOf(t)
    const next =
      e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
    if (next === null || next < 0 || next >= list.length) return
    e.preventDefault()
    t.tabIndex = -1
    list[next].tabIndex = 0
    list[next].focus()
  })

  // ---------------------------------------------------------------- stopping

  /** Stops whatever the staff plays, its lights out; what a play wrote stays. */
  function stop(): void {
    const r = run
    run = null
    r?.stop()
    if (bar.playing) bar.stop()
    playing = null
    nowBeats = null
    bar.light({ pad: null, sounding: null })
    marks.set({ countIn: null, level: null })
    NowPlaying.release(stop)
  }

  /** Clears what the last play wrote, for the next one. */
  function fresh(): void {
    brackets = []
    sheet = []
    marks.set({ brackets, marks: sheet, names: [], tags: [], cursor: null })
  }

  // ---------------------------------------------------------------- the note-by-note read

  /** Step 1's note-by-note read: names and lag tags, the cursor pulling ahead (FACTS 38). */
  function playByName(btn: HTMLButtonElement): void {
    if (!state.unlocked) return
    stop()
    fresh()
    show({ kind: 'tune', tune: COLD })
    NowPlaying.claim(stop)
    const r = startByName({
      bar,
      marks,
      notes: notesOf(COLD, state.clef),
      withDo: false,
      kind: 'soft',
      tags: true,
      onBeats: (b) => {
        nowBeats = b
      },
    })
    run = r
    light(btn, r.done)
    void r.done.then((heard) => {
      if (run !== r) return
      run = null
      NowPlaying.release(stop)
      if (heard) bar.say(READ_LINES.byName)
    })
  }

  // ---------------------------------------------------------------- the rhythm bar's plays

  /** A tune played on the rhythm bar, its brackets fading in as the cursor reaches them. */
  function playTune(
    tune: Tune,
    btn: HTMLButtonElement,
    o: {
      readonly countIn?: number
      readonly line: string
      readonly marks?: (beats: number) => SheetMark[]
    },
  ): void {
    stop()
    fresh()
    show({ kind: 'tune', tune })
    const countIn = o.countIn ?? 0
    const jumps = Motion.paused || Motion.locked
    playing = {
      countIn,
      total: 8,
      frame: (beats) => {
        const reached = bracketsAt(tune, beats)
        const next: Parameters<typeof marks.set>[0] = {
          cursor: cursorAt(beats, 8, jumps),
          countIn:
            countIn > 0
              ? {
                  dots: countIn,
                  lit: beats < 0 ? Math.floor(beats + countIn) : null,
                }
              : null,
        }
        if (reached.length !== brackets.length) {
          brackets = reached
          Object.assign(next, { brackets })
        }
        if (o.marks !== undefined) {
          const m = o.marks(beats)
          if (m.length !== sheet.length) {
            sheet = m
            Object.assign(next, { marks: sheet })
          }
        }
        marks.set(next)
        if ('brackets' in next || 'marks' in next) drawSpots()
      },
    }
    const parts: PlayPart[] = [
      {
        view: bar.view ?? viewOf(state.shown),
        bpm: () => BPM,
        ...(countIn > 0 ? { countIn } : {}),
        shape: tuneShape(tune),
      },
    ]
    const done = bar.play(parts, { line: o.line })
    light(btn, done)
    void done.then((heard) => {
      playing = null
      marks.set({ countIn: null, cursor: heard ? 8 : null })
    })
  }

  /** A short figure's example: its marks written as their sounds play, the note's light its level. */
  function playShort(short: Short, btn: HTMLButtonElement): void {
    stop()
    fresh()
    show({ kind: 'short', short })
    playing = {
      countIn: 0,
      total: short.beats,
      frame: (beats) => {
        const m = marksAt(short, beats)
        sheet = m
        marks.set({ marks: sheet, level: levelAt(short, beats) })
        drawSpots()
      },
    }
    const done = bar.play(
      [
        {
          view: bar.view ?? viewOf(state.shown),
          bpm: () => BPM,
          click: false,
          shape: short.shape,
        },
      ],
      { line: MARK_LINES[short.id] },
    )
    light(btn, done)
    void done.then((heard) => {
      playing = null
      if (heard) sheet = marksDrawn(short)
      marks.set({ marks: sheet, level: null })
      drawSpots()
    })
  }

  function playMark(id: MarkId, btn: HTMLButtonElement): void {
    if (id !== 'breath') return playShort(SHORTS[id], btn)
    const at = breathAt(TUNE_C_BREATH) ?? 3.6
    playTune(TUNE_C_BREATH, btn, {
      line: MARK_LINES.breath,
      marks: (beats) => (beats + 1e-6 >= at ? breathMarks(TUNE_C_BREATH) : []),
    })
  }

  /** The run for a few of the shown notes alone, each lighting as it sounds. */
  function playNotes(
    which: readonly {
      readonly i: number
      readonly at: number
      readonly dur: number
    }[],
    btn: HTMLButtonElement | null,
  ): void {
    stop()
    NowPlaying.claim(stop)
    const ns = notes()
    const r = BeatClock.start<number>({
      bar: bars([
        {
          beats: Math.max(1, ...which.map((w) => Math.ceil(w.at + w.dur))),
          hits: which.map((w) => ({ beat: w.at, data: w.i })),
        },
      ]),
      bpm: () => BPM,
      audible: Sound.canPlay(),
      book: (i, when, bus: Bus) => {
        const w = which.find((x) => x.i === i)
        bookNote(hz(midiOf(ns[i])), {
          when,
          dur: w?.dur ?? TAP_NOTE_SEC,
          kind: 'soft',
          to: bus.node,
        })
      },
      onHit: (i) => bar.light({ pad: null, sounding: i }),
    })
    run = r
    if (btn !== null) light(btn, r.done)
    void r.done.then(() => {
      if (run !== r) return
      run = null
      bar.light({ pad: null, sounding: null })
      NowPlaying.release(stop)
    })
  }

  function playNote(i: number): void {
    const shown = state.shown
    const degrees =
      shown.kind === 'tune' ? shown.tune.degrees : shown.short.degrees
    const n = notes()[i]
    if (n === undefined) return
    const beats =
      shown.kind === 'tune'
        ? (beatsOf(shown.tune)[i]?.beats ?? 1)
        : (shown.short.bars.flat()[i]?.value ?? 1)
    bar.say(noteWords(n, degrees[i], beats))
    playNotes([{ i, at: 0, dur: TAP_NOTE_SEC }], null)
  }

  /** A drawn bracket's notes, alone at 60 BPM as written. */
  function playBracket(br: Bracket, btn: HTMLButtonElement): void {
    if (state.shown.kind !== 'tune') return
    const sounds = beatsOf(state.shown.tune)
    const from = sounds[br.first].beat
    playNotes(
      sounds.slice(br.first, br.last + 1).map((s, k) => ({
        i: br.first + k,
        at: s.beat - from,
        dur: heldSeconds(s.beats, BPM),
      })),
      btn,
    )
  }

  // ---------------------------------------------------------------- the controls

  const playBtns = qa<HTMLButtonElement>('[data-read-play]', root)
  const markBtns = qa<HTMLButtonElement>('[data-read-mark]', root)

  function onPlay(id: PlayId, btn: HTMLButtonElement): void {
    switch (id) {
      case 'by-name':
        return playByName(btn)
      case 'way':
        if (!state.unlocked) return
        return playTune(COLD, btn, { countIn: COUNT_IN, line: READ_LINES.way })
      case 'tune-a':
        return playTune(TUNE_A, btn, { line: TUNE_LINES.a })
      case 'tune-b':
        return playTune(TUNE_B, btn, { line: TUNE_LINES.b })
      case 'count-in':
        return playTune(TUNE_C, btn, {
          countIn: COUNT_IN,
          line: TUNE_LINES.countIn,
        })
    }
  }

  for (const btn of playBtns)
    btn.addEventListener('click', () =>
      onPlay(btn.dataset.readPlay as PlayId, btn),
    )
  for (const btn of markBtns)
    btn.addEventListener('click', () =>
      playMark(btn.dataset.readMark as MarkId, btn),
    )

  // Count: Lesson 17's switch, on by default in Step 3 (FACTS 18)
  const countBtn = root.querySelector<HTMLButtonElement>('[data-read-count]')
  countBtn?.addEventListener('click', () => {
    const on = countBtn.getAttribute('aria-pressed') !== 'true'
    countBtn.setAttribute('aria-pressed', String(on))
    bar.see({ counts: on })
  })

  // Bass · Treble: the staff and the sound move together, for the visit
  const clefBtns = qa<HTMLButtonElement>('[data-staff-clef] [data-clef]', root)

  function setClef(c: Clef, redraw = true): void {
    state.clef = c
    for (const b of clefBtns)
      b.setAttribute('aria-pressed', String(b.dataset.clef === c))
    if (!redraw) return
    stop()
    show(state.shown)
  }
  for (const b of clefBtns)
    b.addEventListener('click', () => {
      const c: Clef = b.dataset.clef === 'treble' ? 'treble' : 'bass'
      if (c !== state.clef) setClef(c)
    })
  // a voice chosen in Sing it sets the clef from then on (FACTS 8)
  VoiceChoice.subscribe((v) => {
    if (v === null) return
    const c: Clef = v === 'higher' ? 'treble' : 'bass'
    if (c !== state.clef) setClef(c)
  })

  // Names on · off: each note's syllable under it
  const nameBtns = qa<HTMLButtonElement>(
    '[data-staff-names] [data-names]',
    root,
  )
  for (const b of nameBtns)
    b.addEventListener('click', () => {
      const on = b.dataset.names === 'on'
      for (const x of nameBtns)
        x.setAttribute(
          'aria-pressed',
          String(x.dataset.names === b.dataset.names),
        )
      marks.set({ syllables: on })
    })

  // See it on the pitch line: the figure redrawn as bands, no buttons over it
  const lanesBtn = root.querySelector<HTMLButtonElement>('[data-staff-lanes]')
  lanesBtn?.addEventListener('click', () => {
    const on = lanesBtn.getAttribute('aria-pressed') !== 'true'
    lanesBtn.setAttribute('aria-pressed', String(on))
    bar.see({ lanes: on })
    drawSpots()
  })

  // Step 3's pad: a clap a tap, the pad of the nearest beat lit, the tempo from the fourth
  const pad = root.querySelector<HTMLButtonElement>('[data-read-tap]')
  const readout = root.querySelector<HTMLElement>('[data-tap-tempo]')
  if (pad !== null) {
    const tempo = createTapTempo()
    let tapBus: Bus | null = null
    bindTapPad(pad, (at) => {
      const reading = tempo.tap(at)
      if (readout !== null && reading.bpm !== null) {
        readout.hidden = false
        readout.textContent = tapTempoLine(reading.bpm)
      }
      if (Sound.canPlay()) {
        if (tapBus === null || !tapBus.open) tapBus = openBus()
        const b = tapBus
        if (b !== null)
          triggerDrumVoice(
            'clap',
            b.context,
            b.context.currentTime,
            CLAP_LEVEL,
            b.node,
          )
      }
      if (nowBeats !== null && nowBeats >= 0) {
        const beat = Math.min(7, Math.max(0, Math.round(nowBeats)))
        bar.light({ pad: beat, sounding: null })
      }
    })
  }

  // ---------------------------------------------------------------- the lock and the parts

  function showLock(): void {
    for (const line of lockLines) line.hidden = state.unlocked
    for (const b of playBtns)
      if (b.dataset.readPlay === 'by-name' || b.dataset.readPlay === 'way')
        b.disabled = !state.unlocked
  }

  const SHOWN: Readonly<Record<Part, () => Shown>> = {
    1: () => ({ kind: 'tune', tune: COLD }),
    2: () => ({ kind: 'tune', tune: TUNE_A }),
    3: () => ({ kind: 'tune', tune: TUNE_C }),
    4: () => ({ kind: 'short', short: SHORTS.dynamics }),
  }

  function setPart(part: Part): void {
    stop()
    state.part = part
    for (const el of qa<HTMLElement>('[data-part]', root))
      if (!el.matches('[data-read-lock]'))
        el.hidden = el.dataset.part !== String(part)
    for (const line of lockLines) line.hidden = part !== 1 || state.unlocked
    if (label !== null) {
      const fig = document.createElement('span')
      fig.className = 'fig'
      fig.textContent = `Fig. ${part}`
      label.replaceChildren(fig, ` ${FIG_LABELS[part]}`)
    }
    // Count shows its counts in Step 3 only
    bar.see({
      counts: part === 3 && countBtn?.getAttribute('aria-pressed') === 'true',
    })
    fresh()
    show(SHOWN[part]())
  }

  setClef(state.clef, false)
  showLock()
  show(o.free ? { kind: 'tune', tune: COLD } : SHOWN[1]())

  return {
    setPart,
    unlock() {
      state.unlocked = true
      showLock()
      if (!o.free) for (const line of lockLines) line.hidden = true
    },
    stop,
    bar,
  }
}

/** The marks' examples by name, for their buttons over the figure. */
const MARK_NAMES: Readonly<Record<MarkId, string>> = {
  dynamics: 'p, then f',
  hairpins: 'hairpins',
  staccato: 'staccato',
  slur: 'slur',
  breath: 'breath mark',
}

/** The example a written mark belongs to. */
function markIdOf(m: SheetMark): MarkId | null {
  switch (m.kind) {
    case 'p':
    case 'f':
      return 'dynamics'
    case 'cresc':
    case 'dim':
      return 'hairpins'
    case 'staccato':
      return 'staccato'
    case 'slur':
      return 'slur'
    case 'breath':
      return 'breath'
  }
}
