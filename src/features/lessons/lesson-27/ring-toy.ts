// ============================================================
// Lesson 27's steps' toy — the ring of rooms beside the learner's staff
// ============================================================
//
// One toy in five places, Steps 1 to 4 and free play (WEB-SPEC, Toys 1).
// Lesson 12's ring of rooms is the kit's (kit/ring-rooms.ts), mounted inert:
// its beads and rooms are drawn, never tapped, and the chips under it play.
// Beside it the learner's staff, the kit's staff toy, writes each chord as
// it sounds, a column a chord, in the clef's singer's colour, blue on the
// bass staff and orange on the treble, and sounds it: a three-note chord at
// 0.075 a voice, a four-note one at 0.056, Step 3's two notes together at
// 0.13 (FACTS 73). The ring lights the sounding chord's room and its beads
// on the same clock, and names it in its centre.
//
// Step 1: chips I and V and Add the seventh, I lit at first paint; a chip
// plays its triad, or with the switch on its seventh chord, and switching
// it on plays the lit chord with its seventh, the fourth corner growing out
// as it sounds; the readout gives the root's distance to the seventh.
// Step 2: I's and V's rooms, each with its fourth corner. Step 3: V7's room
// with the dashed diagonal from B to F, labelled in the readout, and I's;
// as I sounds after V7, two arrows show B moving to C and F to E. Step 4:
// chips I and V7 and Turn over, which moves the lit chord's lowest note up
// an octave and plays it: the staff restacks it, that note climbing, the
// bass mark moves round the ring to the new bass's corner, and the room
// stays. The press after the last inversion brings back the first pitches
// (kit/inversions.ts; FACTS 50). Free play has every control.
//
// Until the cold open's choice (`unlock`) the toy holds back what would
// answer it: the V chip, V's seventh and V7's plays, under the steps' lock
// line, and every V7 room is drawn with three corners, growing its fourth
// as the choice comes in (FACTS 39). Step 4's chips and Turn over, and free
// play's Turn over, wait for Step 4's choice (`unlock4`), and the bass mark
// with them; the positions' names, and a turned chord's name, in the
// centre, the figure's name and its live line alike, wait for Step 4's
// reveal (`reveal4`), its letters standing in for it until then, so its
// plays sound their evidence without naming its answer (FACTS 1b, 48). The
// clef follows the learner's voice and the Clef switch, the whole toy an
// octave apart, as Lesson 25's does. Every sound is the page's one
// (`NowPlaying`).

import { q, qa } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { signName } from '@/features/lessons/kit/notes'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import { mountRing } from '@/features/lessons/kit/ring-rooms'
import type { Spiral } from '@/features/lessons/kit/spiral'
import type { PlayNote, StaffState, StaffToy, } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { Tone } from '@/features/lessons/kit/staff-draw'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { figureSaid, lettersSaid, positionName, seventhReadout, } from './chord-words'
import type { RingView, ViewRoom } from './ring-view'
import { drawRingFrame, ringMoving } from './ring-view'
import type { ChordId, Figure, PlayId } from './sounds'
import { CHIP_SEC, chordFigure, CHORDS, climbOf, gainOf, playOf, positionsIn, } from './sounds'

/** The places the staff keeps room for: G3 under the treble staff, G4 over the bass (FACTS 51). */
const ROOM: Readonly<Record<Clef, readonly [number, number]>> = {
  treble: [-5, 12],
  bass: [-4, 14],
}

/** What the toy offers in one place on the page. */
export interface RingState {
  /** Its chips: Step 1's I, V and Add the seventh; Step 4's I, V7 and Turn over; free play's every one; none. */
  readonly chips: 'seventh' | 'turn' | 'free' | 'none'
  /** The rooms as the place opens, the first lit (V7's drawn as V until the choice). */
  readonly rooms: readonly ChordId[]
  /** The diagonal from B to F while V7 is lit. */
  readonly diagonal: boolean
}

/** Steps 1 to 4 and free play (WEB-SPEC, Toys 1). */
export const RING_STATES = {
  1: { chips: 'seventh', rooms: ['I', 'V'], diagonal: false },
  2: { chips: 'none', rooms: ['I7', 'V7'], diagonal: false },
  3: { chips: 'none', rooms: ['V7', 'I'], diagonal: true },
  4: { chips: 'turn', rooms: ['I', 'V7'], diagonal: false },
  free: { chips: 'free', rooms: ['I', 'V'], diagonal: true },
} as const satisfies Readonly<Record<string | number, RingState>>

export interface RingToy {
  readonly spiral: Spiral
  readonly staff: StaffToy
  readonly clef: Clef
  /** Opens one place's state: stops what plays, I lit in root position, the switch off. */
  setState(state: RingState): void
  /** The learner's clef: through the staff's own switch, which hands it back. */
  setClef(clef: Clef): void
  /** The cold open's choice: V, its seventh and V7's plays open, and V7's rooms grow their fourth corner. */
  unlock(): void
  /** Step 4's choice: its chips and Turn over open, with the bass mark. */
  unlock4(): void
  /** Step 4's reveal: the positions' names in the readout and a turned chord's in the centre. */
  reveal4(): void
  /** Plays `id`; true when heard to its end with nothing cutting it short. */
  play(id: PlayId): Promise<boolean>
  stop(): void
  /** What the ring shows now, as its next frame draws it. */
  view(): RingView
}

export function mountRingToy(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on its step. */
    readonly active: () => boolean
    readonly clef: Clef
    readonly state: RingState
    readonly light?: PlayLight
  },
): RingToy {
  const light = o.light ?? playLights()
  const viz = q('[data-ring-viz]', root)
  const canvas = q<HTMLCanvasElement>('[data-ring-canvas]', root)
  const readout = q('[data-ring-readout]', root)
  const said = q('[data-ring-said]', root)
  const chipBtns = qa<HTMLButtonElement>('[data-chip]', root)
  const seventhBtn = root.querySelector<HTMLButtonElement>('[data-seventh]')
  const turnBtn = root.querySelector<HTMLButtonElement>('[data-turn]')
  const lockLine = root.querySelector<HTMLElement>(
    '[data-lock-line]:not([data-lock-line="4"])',
  )
  const lockLine4 = root.querySelector<HTMLElement>('[data-lock-line="4"]')
  const playBtns = qa<HTMLButtonElement>('[data-ring-play]', root)

  let state: RingState = o.state
  let clef: Clef = o.clef
  let held = true
  let held4 = true
  let named = false
  /** The chord the chips have lit, in root position or turned. */
  let chip: 'I' | 'V' = 'I'
  let seventh = false
  let position = 0
  /** The figure sounding, while a play runs: the ring shows it. */
  let showing: Figure | null = null
  /** When moves on the ring started, ms: a corner growing, the arrows, the bass mark leaving a corner. */
  let growing: { id: string; since: number } | null = null
  let arrows: number | null = null
  let bassFrom: { pc: number; since: number } | null = null
  let token = 0
  let timers: number[] = []
  let dirty = true

  // ------------------------------------------------------------ what the ring shows

  /** A chord as the hold allows it: V7 drawn as V until the cold open's choice. */
  const allowed = (id: ChordId): ChordId => (held && id === 'V7' ? 'V' : id)

  /** The chord the chips light at rest. */
  function litId(): ChordId {
    if (state.chips === 'turn') return allowed(chip === 'V' ? 'V7' : 'I')
    if (state.chips === 'seventh' || state.chips === 'free') {
      if (chip === 'I') return seventh ? 'I7' : 'I'
      return allowed(seventh ? 'V7' : 'V')
    }
    return allowed(state.rooms[0])
  }

  /** The rooms drawn at rest: the state's, each as the switch and the hold have it, the chips' one lit. */
  function restRooms(): ViewRoom[] {
    const lit = litId()
    const rooms = state.rooms.map((id) => {
      if (state.chips === 'seventh' || state.chips === 'free') {
        if (id === 'I') return seventh ? 'I7' : 'I'
        if (id === 'V') return allowed(seventh ? 'V7' : 'V')
      }
      return allowed(id)
    })
    // the lit chord's own room, whatever the state lists
    const ids = rooms.includes(lit) ? rooms : [lit, ...rooms.slice(1)]
    return ids.map((id) => ({ chord: CHORDS[id], lit: id === lit }))
  }

  const bassShown = (): boolean =>
    !held4 && (state.chips === 'turn' || state.chips === 'free')

  /** The lit chord's notes now, in the learner's voice. */
  const litNotes = (id = litId()): ReturnType<typeof positionsIn>[number] => {
    const all = positionsIn(CHORDS[id], clef)
    return all[position % all.length]
  }

  /** The bass's corner on the ring, semitones from C. */
  const pcOf = (midi: number): number => ((midi % 12) + 12) % 12

  function view(): RingView {
    const id = showing?.chord?.id ?? litId()
    const notes = showing?.notes ?? litNotes()
    const chord = CHORDS[id]
    const rooms: ViewRoom[] =
      showing === null
        ? restRooms()
        : showing.chord === undefined
          ? restRooms().map((r) => ({ ...r, lit: false }))
          : [
              { chord, lit: true },
              ...restRooms()
                .filter((r) => r.chord.id !== id)
                .map((r) => ({ ...r, lit: false })),
            ]
    const turned = (showing?.position ?? position) > 0
    // a turned chord's name waits for Step 4's reveal: its letters until then
    const centre =
      showing !== null && showing.chord === undefined
        ? ''
        : turned && !named
          ? notes.map((n) => signName(n, { octave: false })).join(' ')
          : chord.centre
    const bass =
      bassShown() && (showing === null || showing.chord !== undefined)
        ? pcOf(midiOf(notes[0]))
        : null
    return {
      rooms,
      growing,
      diagonal: diagonalShown(id),
      arrows,
      bass:
        bass === null
          ? null
          : {
              at: bass,
              from: bassFrom?.pc ?? bass,
              since: bassFrom?.since ?? 0,
            },
      sounding: showing === null ? [] : showing.notes.map((n) => midiOf(n)),
      centre,
      still: Motion.paused,
    }
  }

  /**
   * The diagonal, B to F across the centre: while V7 is lit, and while
   * Step 3's pair of B and F, or the arrows from them, sound.
   */
  const diagonalShown = (id: ChordId): boolean =>
    state.diagonal &&
    !held &&
    (id === 'V7' ||
      (showing !== null &&
        (showing.chord === undefined || showing.arrows === true)))

  /** The readout under the ring: the position's name, the diagonal's label, or the root's distance to its seventh. */
  function readoutText(): string {
    const id = showing?.chord?.id ?? litId()
    const lines: string[] = []
    if (bassShown() && named)
      lines.push(positionName(showing?.position ?? position))
    if (diagonalShown(id)) lines.push('B to F: 6 semitones')
    else if (
      (state.chips === 'seventh' || state.chips === 'free') &&
      lines.length === 0
    )
      lines.push(seventhReadout(CHORDS[id]))
    return lines.filter((l) => l !== '').join(' · ')
  }

  /** The figure's name in words: the lit room, the others faint, the diagonal and the bass. */
  function nameFigure(): void {
    const id = litId()
    // a turned chord's name waits for Step 4's reveal, as the centre's does
    const lit =
      position > 0 && !named
        ? lettersSaid(litNotes())
        : figureSaid(CHORDS[id], litNotes(), {
            position: bassShown() && named ? position : null,
            seventh: state.chips === 'seventh' || state.chips === 'free',
          })
    const faint = restRooms()
      .filter((r) => !r.lit)
      .map((r) => figureSaid(r.chord, r.chord.notes))
    const parts = [lit]
    if (faint.length > 0) parts.push(`faint, ${faint.join('; ')}`)
    if (diagonalShown(id))
      parts.push('a line from B straight across the ring to F: 6 semitones')
    canvas.setAttribute(
      'aria-label',
      `Lesson 12's ring of rooms: ${parts.join('; ')}`,
    )
  }

  function changed(): void {
    readout.textContent = readoutText()
    nameFigure()
    dirty = true
    wake()
  }

  const spiral = mountRing(viz, {
    active: o.active,
    inert: true,
    // a frame drawn while something moves asks for the next, so the one
    // after the last that moved is drawn too, landed
    overlay: (f) => {
      dirty = drawRingFrame(f, view())
    },
    overlayWants: () => dirty || ringMoving(view(), performance.now()),
  })

  // ------------------------------------------------------------ the staff

  // the staff's sound is the toy's: a staff play claims the page's owner
  // with the toy's own stop
  const owner: SoundOwner = {
    claim: () => NowPlaying.claim(halt),
    release: () => undefined,
  }
  const staffState = (): StaffState => ({
    staff: 'single',
    clef,
    tap: 'place',
    room: ROOM[clef],
  })
  const staff = mountStaff(root, {
    state: staffState(),
    owner,
    onClef: (c) => clefChanged(c),
  })
  const tone = (): Tone => (clef === 'bass' ? 'blue' : 'orange')

  // ------------------------------------------------------------ the plays

  function halt(): void {
    token += 1
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    staff.stop()
    showing = null
    arrows = null
    bassFrom = null
    changed()
    NowPlaying.release(halt)
  }

  /** The staff's notes for figures, each in its own column at its own level, a climbing note marked. */
  const staffNotes = (figures: readonly Figure[], tone: Tone): PlayNote[] =>
    figures.flatMap((f, col) =>
      f.notes.map((note) => ({
        t: f.at,
        dur: f.dur,
        note,
        col,
        tone,
        gain: gainOf(f.notes.length),
        from:
          f.climb !== undefined && midiOf(note) === midiOf(f.climb.to)
            ? f.climb.from
            : undefined,
      })),
    )

  /** The ring shows `f` as it sounds: its room and beads, its arrows, the bass mark moving to its bass. */
  function show(f: Figure): void {
    const before = showing ?? null
    const now = performance.now()
    if (f.arrows === true) arrows = now
    if (bassShown() && f.chord !== undefined) {
      const was = (before?.notes ?? litNotes())[0]
      const pc = pcOf(midiOf(f.notes[0]))
      if (pcOf(midiOf(was)) !== pc)
        bassFrom = { pc: pcOf(midiOf(was)), since: now }
    }
    showing = f
    // two notes alone, or a turned chord before Step 4's reveal: its letters
    said.textContent =
      f.chord === undefined || ((f.position ?? 0) > 0 && !named)
        ? lettersSaid(f.notes)
        : figureSaid(f.chord, f.notes, {
            position: bassShown() && named ? (f.position ?? 0) : null,
          })
    changed()
  }

  /** Sounds figures on the staff, the ring showing each as it starts; true when heard. */
  async function sound(figures: readonly Figure[]): Promise<boolean> {
    halt()
    NowPlaying.claim(halt)
    const mine = token
    for (const f of figures)
      timers.push(
        window.setTimeout(() => {
          if (mine === token) show(f)
        }, f.at * 1000),
      )
    const heard = await staff.play({
      show: 'run',
      notes: staffNotes(figures, tone()),
    })
    if (mine !== token) return false
    // back to the chips' chord, the mark on its bass at once
    showing = null
    arrows = null
    bassFrom = null
    changed()
    NowPlaying.release(halt)
    return heard
  }

  /** A chip's or Turn over's chord: the lit chord at its position, 1.2 s. */
  function soundLit(climb?: Figure['climb']): Promise<boolean> {
    const f = chordFigure(litId(), clef, 0, CHIP_SEC, position)
    return sound([{ ...f, climb }])
  }

  // ------------------------------------------------------------ the controls

  /** The chips, each held as its choice holds it, the lit chord's marked. */
  function syncChips(): void {
    for (const b of chipBtns) {
      const v = b.dataset.chip !== 'I'
      const row4 = b.closest('[data-part="4"]') !== null
      b.disabled = (v && held) || (row4 && held4)
      // Step 4's V7 says V until the cold open's choice, as its room is drawn
      if (b.dataset.chip === 'V7') b.textContent = held ? 'V' : 'V7'
      // the lit chord's chip, marked while its chord is the ring's lit room;
      // `is-on` is the play light's, lit only while a chip's chord sounds
      b.classList.toggle(
        'is-lit',
        b.dataset.chip === chip || (b.dataset.chip === 'V7' && chip === 'V'),
      )
    }
  }

  function syncControls(): void {
    syncChips()
    if (seventhBtn !== null)
      seventhBtn.setAttribute('aria-pressed', String(seventh))
    if (turnBtn !== null) turnBtn.disabled = held4
    for (const b of playBtns)
      b.disabled = held && b.dataset.ringPlay !== 'i-seventh'
    // the steps' line shows on Steps 1 to 4 (kit/step-parts.ts), each
    // holding V7's room as V; the choice puts it away
    if (lockLine !== null) {
      if (!lockLine.hasAttribute('data-part')) lockLine.hidden = !held
      else if (!held) lockLine.hidden = true
    }
    if (lockLine4 !== null) lockLine4.hidden = !held4
  }

  /** A chip lights its chord in root position and plays it. */
  function pressChip(id: string): Promise<boolean> {
    chip = id === 'I' ? 'I' : 'V'
    position = 0
    bassFrom = null
    syncControls()
    changed()
    return soundLit()
  }

  /** Add the seventh: the lit chord with or without it, its fourth corner growing out as it sounds. */
  function toggleSeventh(): Promise<boolean> {
    seventh = !seventh
    position = 0
    bassFrom = null
    if (seventh) growing = { id: litId(), since: performance.now() }
    syncControls()
    changed()
    return soundLit()
  }

  /** Turn over: the lowest note up an octave, the bass mark to the next corner; after the last inversion, the first pitches. */
  function turnOver(): Promise<boolean> {
    const all = positionsIn(CHORDS[litId()], clef)
    const before = all[position % all.length]
    // the corner the mark shows: a sounding chord's, or the lit chord's
    const was = (showing?.chord === undefined ? before : showing.notes)[0]
    position = (position + 1) % all.length
    const climb = position === 0 ? undefined : climbOf(before)
    const heard = soundLit(climb)
    // after the play has begun, which lands every move where it stands:
    // the mark leaves that corner for the new bass's, in 0.3 s
    bassFrom = { pc: pcOf(midiOf(was)), since: performance.now() }
    changed()
    return heard
  }

  for (const b of chipBtns) {
    const id = b.dataset.chip ?? 'I'
    b.addEventListener('click', () => light(b, pressChip(id)))
  }
  seventhBtn?.addEventListener('click', () => {
    if (seventhBtn !== null) light(seventhBtn, toggleSeventh())
  })
  turnBtn?.addEventListener('click', () => {
    if (turnBtn !== null) light(turnBtn, turnOver())
  })
  for (const b of playBtns) {
    const id = b.dataset.ringPlay as PlayId
    b.addEventListener('click', () => light(b, play(id)))
  }

  function play(id: PlayId): Promise<boolean> {
    return sound(playOf(id, clef))
  }

  // ------------------------------------------------------------ the clef and the states

  /** The staff's clef changed, by its switch or by the learner's voice: the whole toy moves an octave. */
  function clefChanged(c: Clef): void {
    halt()
    clef = c
    staff.setState(staffState())
    changed()
  }

  function setState(next: RingState): void {
    halt()
    state = next
    chip = 'I'
    seventh = false
    position = 0
    growing = null
    bassFrom = null
    staff.setState(staffState())
    syncControls()
    changed()
  }

  syncControls()
  changed()

  return {
    spiral,
    staff,
    get clef() {
      return clef
    },
    setState,
    setClef(c) {
      // the switch's own path: the staff changes its clef and hands it back
      if (c !== staff.clef) staff.setClef(c)
    },
    unlock() {
      if (!held) return
      held = false
      // V7's rooms grow their fourth corner as the choice comes in
      if (restRooms().some((r) => r.chord.id === 'V7'))
        growing = { id: 'V7', since: performance.now() }
      syncControls()
      changed()
    },
    unlock4() {
      if (!held4) return
      held4 = false
      syncControls()
      changed()
    },
    reveal4() {
      named = true
      changed()
    },
    play,
    stop: halt,
    view,
  }
}
