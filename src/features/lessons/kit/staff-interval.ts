// ============================================================
// Staff interval — the staff toy's interval state: two notes on the learner's staff, counted beside the pitch line
// ============================================================
//
// Season 2's staff toy in one more state (Lesson 23's WEB-SPEC, Toys 1),
// mounted on a figure as the staff toy is (`[data-staff-svg]` in a `.viz`):
// the learner's staff, the bass clef from C3 or the treble from C4, beside
// the pitch line, a lane a semitone from that C up to the C an octave above.
// The bottom note is C and does not move. The top note moves a letter at a
// time, by Step up and Step down (`[data-staff-step]`), by a tap on a place
// or by the Up and Down arrows on the focused staff, from the unison to the
// octave; a move to a new letter clears its sign. Sharp and Flat
// (`[data-iv-sign]`, toggles) raise or lower it a semitone, offered only
// where the page names the spelling (intervals.ts `signsOf`). Each move and
// each sign plays the interval as Lesson 6's pair (kit/pair.ts) and writes
// both notes as they sound, so a state opens with its clef and lines alone.
// The readout under the drawing (`[data-iv-readout]`) gives the letters,
// the semitones and the name, and a polite live region
// (`[data-staff-said]`) says them in words, every note with its letter and
// octave.
//
// Fold (`[data-iv-fold]`) plays the interval and then its upside down, the
// bottom note lifted an octave: the staff writes the four notes, the pitch
// line lays the two spans end to end, and as they meet the octave's bracket
// turns gold with the sums beside it. A move or a sign brings back the
// single interval from C. Curl into a ring (`[data-iv-curl]`, in a state
// that offers it) bends the line round into Lesson 2's ring, and Straighten
// the line brings it back; it plays nothing, and the ring holds for the
// visit. A page's plays (`play`) are pairs, one note after the other or
// both together, written as they sound, the whole play on one clock
// (kit/run.ts `playNotes`), and every play and move is the page's one sound
// (`owner`): a newer sound anywhere stops it.
//
// Held back (`locked`) until the cold open's choice (`unlock`): Sharp and
// Flat, Fold and Curl into a ring, and the pitch line's black-key lanes, of
// which only one that has sounded draws; at the choice they draw in. The
// toy owns its controls' enabled state, so the rule for the signs holds
// before the choice and after it. Under reduced motion or Pause animations
// the lanes and the spans appear in place and the curl cross-fades.

import { qa } from './dom'
import { addDrawer, wake, watch } from './frame-loop'
import { countLine, intervalOf, liftedOf, nameOf, pairLine, saidLine, signsOf, sumsLine, upsideDown, } from './intervals'
import { reducedMotion } from './motion-switch'
import type { Spelled } from './notes'
import { isBlack, signsHtml } from './notes'
import type { SoundOwner } from './now-playing'
import { PAIR, PAIR_SEC } from './pair'
import type { Run, RunNote } from './run'
import { playNotes } from './run'
import { Sound } from './sound'
import { PitchLine } from './staff'
import type { Mark, Tone } from './staff-draw'
import { figureSize } from './staff-draw'
import type { IntervalLayout, IntervalScene } from './staff-interval-draw'
import { drawInterval } from './staff-interval-draw'
import type { Clef } from './staff-places'
import { midiOf, noteAt, placeOf, staffName } from './staff-places'

/** A step's state of the toy. */
export interface IntervalState {
  /** The top note it opens on, written for the higher voice (C4 to C5), unwritten until a sound. */
  readonly top: Spelled
  /** The B lane below the foot (Step 4). */
  readonly bLane?: boolean
  /** Curl into a ring offered, and the ring drawn when curled (Step 4, free play). */
  readonly ring?: boolean
}

/** Two notes, written for the higher voice; the bass staff sounds them an octave lower. */
export interface IntervalPair {
  readonly lo: Spelled
  readonly hi: Spelled
  /** Both at once, 1.5 s, not one after the other. */
  readonly together?: boolean
}

/** A page's play on the toy: one pair or more, one after another. */
export interface IntervalPlay {
  readonly pairs: readonly IntervalPair[]
  /** The second pair is the first turned upside down, drawn as Fold draws it. */
  readonly fold?: boolean
}

export interface IntervalToy {
  readonly state: IntervalState
  readonly clef: Clef
  readonly locked: boolean
  readonly curled: boolean
  /** The top note, written or waiting, as it sounds. */
  readonly top: Spelled
  /** What the readout says, its words: '' before a sound. */
  readonly readout: string
  /** Shows `s`: stops what plays and opens the state afresh. */
  setState(s: IntervalState): void
  /** The learner's clef: stops what plays; the interval keeps its letters. */
  setClef(c: Clef): void
  /** Plays `p`; resolves true when heard to its end with nothing cutting it short. */
  play(p: IntervalPlay): Promise<boolean>
  step(dir: 1 | -1): void
  tapPlace(place: number): void
  sign(which: 'sharp' | 'flat'): void
  fold(): Promise<boolean>
  curl(): void
  /** The cold open's choice is in: what was held back is offered. */
  unlock(): void
  stop(): void
}

export interface IntervalOptions {
  readonly state: IntervalState
  /** One sound at a time: the page's owner (kit/now-playing.ts). */
  readonly owner: SoundOwner
  /** The learner's clef: the bass for the lower voice, or none stored; the treble for the higher. */
  readonly clef: Clef
  /** Held back until `unlock` (Lesson 23 WEB-SPEC, Toys 1, Before the choice). */
  readonly locked?: boolean
}

/** Two pairs one after the other are 0.5 s apart: 3.6 s (Lesson 23 FACTS 66). */
export const PAIRS_GAP = 0.5
/** Two notes together sound 1.5 s (FACTS 70, 72, 73). */
export const TOGETHER_SEC = 1.5
/** The black-key lanes draw in, the second span lays down, the line curls, ms (FACTS 71; WEB-SPEC, Look). */
const LANES_MS = 400
const FOLD_MS = 600
const CURL_MS = 800
const FADE_MS = 400

/** A play's length, s: a pair 1.55, two pairs 3.6, a pair together 1.5 and two 3.0. */
export function playLength(p: IntervalPlay): number {
  return p.pairs.reduce(
    (t, pair, i) =>
      t +
      (pair.together === true ? TOGETHER_SEC : PAIR_SEC) +
      (i > 0 && pair.together !== true ? PAIRS_GAP : 0),
    0,
  )
}

const clamp01 = (u: number): number => Math.min(1, Math.max(0, u))
/** A time to the millisecond, so a play's onsets add up as the facts give them. */
const ms = (t: number): number => Math.round(t * 1000) / 1000
const sameNote = (a: Spelled, b: Spelled): boolean =>
  a.letter === b.letter && a.alter === b.alter && a.octave === b.octave

/** A readout part that breaks only after its commas, so "a perfect fifth" never splits. */
const partHtml = (part: string): string =>
  part
    .split(', ')
    .map((c) => `<span class="iv-part">${signsHtml(c)}</span>`)
    .join(', ')

/** The readout's count in signs, each sign spoken, its separators hidden from a screen reader. */
const countHtml = (text: string): string =>
  text
    .split(' · ')
    .map(partHtml)
    .join('<span class="iv-dot" aria-hidden="true"> · </span>')

export function mountIntervalStaff(
  root: HTMLElement,
  o: IntervalOptions,
): IntervalToy {
  const el = root.querySelector<SVGSVGElement>('[data-staff-svg]')
  const said = root.querySelector<HTMLElement>('[data-staff-said]')
  const readoutEl = root.querySelector<HTMLElement>('[data-iv-readout]')
  if (el === null || said === null || readoutEl === null)
    throw new Error('staff interval: no figure')
  const svgEl = el
  const readoutBox = readoutEl

  let state = o.state
  let clef: Clef = o.clef
  let open = o.locked !== true
  const octaveOf = (c: Clef): number => (c === 'bass' ? 3 : 4)
  const foot = (): Spelled => ({
    letter: 'C',
    alter: 0,
    octave: octaveOf(clef),
  })
  /** A note written for the higher voice, as the learner's staff sounds it. */
  const voiced = (n: Spelled): Spelled =>
    clef === 'bass' ? { ...n, octave: n.octave - 1 } : n

  // the interval: its bottom and top notes as they sound
  let lo = foot()
  let hi = voiced(state.top)
  // what the drawing shows
  let marks = new Map<string, Mark>()
  let cols = 2
  let lit: number[] = []
  let named: Spelled[] = []
  let spans: { lo: number; hi: number; u: number }[] = []
  let fit: readonly [string, string] | null = null
  let own: number[] = []
  let readout = ''
  // the moving parts: when each began, ms on the page's clock
  let blacksAt: number | null = null
  let curled = false
  let curlAt: number | null = null
  let curlFrom = 0
  let spanAt: number | null = null
  let layout: IntervalLayout | null = null
  // what sounds
  let playing: Run | null = null
  let timers: number[] = []
  let plays = 0

  const reach = (): readonly [number, number] => {
    const c = placeOf(foot(), clef)
    return [c, c + 7]
  }

  /** The curl, 0 straight to 1 the ring, now. */
  function curlNow(now: number): number {
    const to = curled && state.ring === true ? 1 : 0
    if (curlAt === null) return to
    const ms = reducedMotion() ? FADE_MS : CURL_MS
    const u = clamp01((now - curlAt) / ms)
    if (u >= 1) curlAt = null
    return curlFrom + (to - curlFrom) * u
  }

  function scene(now: number): IntervalScene {
    let blacks = open ? 1 : 0
    if (open && blacksAt !== null) {
      blacks = clamp01((now - blacksAt) / LANES_MS)
      if (blacks >= 1) blacksAt = null
    }
    let grown = 1
    if (spanAt !== null) {
      grown = clamp01((now - spanAt) / FOLD_MS)
      if (grown >= 1) spanAt = null
    }
    return {
      clef,
      base: midiOf(foot()),
      bLane: state.bLane === true,
      lanes: PitchLine.on,
      open,
      blacks,
      own,
      lit,
      named,
      spans: spans.map((s, i) =>
        i === spans.length - 1 && spanAt !== null ? { ...s, u: grown } : s,
      ),
      fit: spanAt === null ? fit : null,
      curl: curlNow(now),
      fade: reducedMotion(),
      marks: [...marks.values()],
      cols,
    }
  }

  const moving = (): boolean =>
    blacksAt !== null || curlAt !== null || spanAt !== null

  function draw(now = performance.now()): void {
    layout = drawInterval(svgEl, scene(now), figureSize(svgEl))
  }

  const seen = watch(svgEl)
  addDrawer({
    active: () => seen() && moving(),
    wants: moving,
    draw: (now) => draw(now),
  })
  const animate = (): void => {
    draw()
    wake()
  }

  function say(text: string): void {
    if (said !== null && said.textContent !== text) said.textContent = text
  }

  function setReadout(pairText: string, count: string): void {
    readout = `${pairText}: ${count}`
    readoutBox.innerHTML = `<span class="iv-pair">${signsHtml(pairText)}:</span> <span class="iv-count">${countHtml(count)}</span>`
  }

  function clearReadout(): void {
    readout = ''
    readoutBox.replaceChildren()
  }

  /** The figure's name: the staff, and the pitch line beside it, straight or curled. */
  function label(): void {
    const line = !PitchLine.on
      ? ''
      : curled && state.ring === true
        ? ', beside the pitch line curled into a ring'
        : ', beside the pitch line'
    svgEl.setAttribute('aria-label', `${staffName(clef)}${line}`)
  }

  /** Each control's state, by the toy's own rules: the signs per letter, the ends of the reach, what is held. */
  function refresh(): void {
    const at = placeOf({ ...hi, alter: 0 }, clef)
    const [bottom, top] = reach()
    const signs = signsOf(hi.letter)
    const set = (b: HTMLElement, off: boolean): void =>
      b.setAttribute('aria-disabled', String(off))
    for (const b of qa<HTMLButtonElement>('[data-staff-step]', root))
      set(b, Number(b.dataset.staffStep) > 0 ? at >= top : at <= bottom)
    for (const b of qa<HTMLButtonElement>('[data-iv-sign]', root)) {
      const sharp = b.dataset.ivSign === 'sharp'
      set(b, !open || !(sharp ? signs.sharp : signs.flat))
      b.setAttribute('aria-pressed', String(hi.alter === (sharp ? 1 : -1)))
    }
    for (const b of qa<HTMLButtonElement>('[data-iv-fold]', root)) set(b, !open)
    for (const b of qa<HTMLButtonElement>('[data-iv-curl]', root)) {
      set(b, !open)
      b.textContent = curled ? 'Straighten the line' : 'Curl into a ring'
    }
    for (const b of qa<HTMLButtonElement>('button[data-clef]', root))
      b.setAttribute('aria-pressed', String(b.dataset.clef === clef))
    label()
  }

  function rest(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    lit = []
    for (const [k, m] of marks) marks.set(k, { ...m, tone: 'rest' })
  }

  function stop(): void {
    if (playing === null) return
    plays += 1
    playing.stop()
    playing = null
    rest()
    o.owner.release(stop)
    draw()
  }

  /** Black keys that have sounded keep their own lanes while the rest wait. */
  const keepOwn = (n: Spelled): void => {
    const m = midiOf(n)
    if (!open && isBlack(m) && !own.includes(m)) own = [...own, m]
  }

  function sayPairs(
    pairs: readonly { lo: Spelled; hi: Spelled }[],
    fold: boolean,
  ): string {
    const ivs = pairs.map((p) => intervalOf(p.lo, p.hi))
    const words = pairs
      .map((p, i) => {
        const iv = ivs[i]
        return iv === null ? '' : saidLine(p.lo, p.hi, iv)
      })
      .join(' ')
    const first = ivs[0]
    if (!fold || first === null) return words
    const up = upsideDown(first)
    return `${words} ${first.number} and ${up.number} make 9, ${first.semitones} and ${up.semitones} make 12.`
  }

  /** What the readout shows for the pair just sounded, and for a fold both and the sums. */
  function showRead(
    pairs: readonly { lo: Spelled; hi: Spelled }[],
    upTo: number,
    fold: boolean,
  ): void {
    const p = pairs[upTo]
    const iv = intervalOf(p.lo, p.hi)
    if (iv === null) return
    if (!fold || upTo === 0) {
      setReadout(pairLine(p.lo, p.hi), countLine(iv))
      return
    }
    const a = pairs[0]
    const first = intervalOf(a.lo, a.hi)
    if (first === null) return
    setReadout(
      `${pairLine(a.lo, a.hi)}, then ${pairLine(p.lo, p.hi)}`,
      `${nameOf(first)}, then ${nameOf(iv)} · ${sumsLine(first)}`,
    )
  }

  /** A note sounds: written in its column in the singer's colour, and named. */
  function write(key: string, note: Spelled, col: number, tone: Tone): void {
    marks.set(key, { note, col, tone })
    keepOwn(note)
    if (!named.some((x) => sameNote(x, note))) named = [...named, note]
  }

  /** A note has ended: its lane and its head go back to rest. */
  function rested(key: string, midi: number): void {
    lit = lit.filter((x) => x !== midi)
    const mk = marks.get(key)
    if (mk !== undefined) marks.set(key, { ...mk, tone: 'rest' })
    draw()
  }

  /**
   * A pair's top note sounds: its span lies beside the lanes, end to end
   * with the first in a fold, where the second meets the octave's gold
   * bracket; the readout and the live line follow.
   */
  function topSounds(
    pairs: readonly { lo: Spelled; hi: Spelled }[],
    at: number,
    fold: boolean,
  ): void {
    const p = pairs[at]
    spans = [
      ...(fold ? spans : []),
      { lo: midiOf(p.lo), hi: midiOf(p.hi), u: 1 },
    ]
    if (fold && at === 1) {
      const first = intervalOf(pairs[0].lo, pairs[0].hi)
      if (first !== null) {
        const [add, total] = sumsLine(first).split(' · ')[1].split(' = ')
        fit = [add, `= ${total}`]
      }
      if (!reducedMotion()) spanAt = performance.now()
    }
    showRead(pairs, at, fold)
    if (at === pairs.length - 1) say(sayPairs(pairs, fold))
  }

  /**
   * Plays `pairs`, notes as they sound, each written as it sounds on one
   * clock; the toy keeps the last pair, folded for a fold.
   */
  function start(
    pairs: readonly { lo: Spelled; hi: Spelled; together?: boolean }[],
    fold: boolean,
  ): Promise<boolean> {
    stop()
    o.owner.claim(stop)
    const mine = ++plays
    const together = pairs.some((p) => p.together === true)
    marks = new Map()
    cols = fold ? 4 : together ? pairs.length : 2
    named = []
    spans = []
    fit = null
    spanAt = null
    lit = []
    const notes: RunNote[] = []
    const meta: { pair: number; hi: boolean; col: number }[] = []
    let t = 0
    pairs.forEach((p, i) => {
      const cLo = fold ? i * 2 : together ? i : 0
      const cHi = fold ? i * 2 + 1 : together ? i : 1
      if (p.together === true) {
        notes.push(
          { t, midi: midiOf(p.lo), dur: TOGETHER_SEC, kind: 'soft' },
          { t, midi: midiOf(p.hi), dur: TOGETHER_SEC, kind: 'soft' },
        )
        t = ms(t + TOGETHER_SEC)
      } else {
        if (i > 0) t = ms(t + PAIRS_GAP)
        notes.push(
          { t, midi: midiOf(p.lo), dur: PAIR.first, kind: 'soft' },
          {
            t: ms(t + PAIR.first + PAIR.gap),
            midi: midiOf(p.hi),
            dur: PAIR.second,
            kind: 'soft',
          },
        )
        t = ms(t + PAIR_SEC)
      }
      meta.push(
        { pair: i, hi: false, col: cLo },
        { pair: i, hi: true, col: cHi },
      )
    })
    const tone = clef === 'bass' ? 'blue' : 'orange'
    const last = pairs[pairs.length - 1]
    lo = fold ? pairs[0].lo : last.lo
    hi = fold ? pairs[0].hi : last.hi
    const r = playNotes(notes, {
      audible: Sound.canPlay(),
      kind: 'soft',
      onNote: (n, i) => {
        if (mine !== plays) return
        const m = meta[i]
        const key = `${m.col}${m.hi && together ? 'h' : ''}`
        // a new pair in the same columns writes over the one before
        if (!fold && !together && !m.hi && m.pair > 0) {
          marks.delete('1')
          named = []
          spans = []
        }
        write(key, m.hi ? pairs[m.pair].hi : pairs[m.pair].lo, m.col, tone)
        lit = [...lit, n.midi]
        if (m.hi) topSounds(pairs, m.pair, fold)
        timers.push(
          window.setTimeout(() => {
            if (mine === plays) rested(key, n.midi)
          }, n.dur * 1000),
        )
        refresh()
        animate()
      },
    })
    playing = r
    refresh()
    return r.done.then((heard) => {
      if (mine !== plays) return false
      playing = null
      rest()
      o.owner.release(stop)
      draw()
      return heard
    })
  }

  /** Plays the interval shown, from C, as a pair. */
  const playShown = (): void => {
    void start([{ lo, hi }], false)
  }

  function moveTo(place: number): void {
    const [bottom, top] = reach()
    const at = Math.min(top, Math.max(bottom, place))
    lo = foot()
    hi = noteAt(at, clef)
    playShown()
  }

  const toy: IntervalToy = {
    get state() {
      return state
    },
    get clef() {
      return clef
    },
    get locked() {
      return !open
    },
    get curled() {
      return curled
    },
    get top() {
      return hi
    },
    get readout() {
      return readout
    },
    setState(s) {
      stop()
      state = s
      lo = foot()
      hi = voiced(s.top)
      marks = new Map()
      cols = 2
      named = []
      spans = []
      fit = null
      spanAt = null
      curlAt = null
      own = []
      clearReadout()
      say('')
      refresh()
      draw()
    },
    setClef(c) {
      stop()
      if (c === clef) return
      const shift = c === 'bass' ? -1 : 1
      const move = (n: Spelled): Spelled => ({ ...n, octave: n.octave + shift })
      clef = c
      lo = move(lo)
      hi = move(hi)
      for (const [k, m] of marks) marks.set(k, { ...m, note: move(m.note) })
      named = named.map(move)
      spans = spans.map((s) => ({
        ...s,
        lo: s.lo + shift * 12,
        hi: s.hi + shift * 12,
      }))
      own = own.map((m) => m + shift * 12)
      refresh()
      draw()
      say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
    },
    play(p) {
      return start(
        p.pairs.map((x) => ({ ...x, lo: voiced(x.lo), hi: voiced(x.hi) })),
        p.fold === true,
      )
    },
    step(dir) {
      const [bottom, top] = reach()
      const next = placeOf({ ...hi, alter: 0 }, clef) + dir
      if (next < bottom || next > top) return
      moveTo(next)
    },
    tapPlace: moveTo,
    sign(which) {
      const signs = signsOf(hi.letter)
      if (!open || !(which === 'sharp' ? signs.sharp : signs.flat)) return
      const alter = which === 'sharp' ? 1 : -1
      hi = { ...hi, alter: hi.alter === alter ? 0 : alter }
      lo = foot()
      playShown()
    },
    fold() {
      if (!open) return Promise.resolve(false)
      const base = foot()
      return start(
        [
          { lo: base, hi },
          { lo: hi, hi: liftedOf(base) },
        ],
        true,
      )
    },
    curl() {
      if (!open || state.ring !== true) return
      const now = performance.now()
      curlFrom = curlNow(now)
      curled = !curled
      curlAt = now
      refresh()
      animate()
    },
    unlock() {
      if (open) return
      open = true
      own = []
      blacksAt = reducedMotion() ? null : performance.now()
      refresh()
      animate()
    },
    stop,
  }

  // ------------------------------------------------------------ input

  svgEl.addEventListener('pointerdown', (e) => {
    if (layout === null) return
    const box = svgEl.getBoundingClientRect()
    if (e.clientX - box.left < layout.staffX) return
    toy.tapPlace(layout.staff.placeAt(e.clientY - box.top))
  })
  svgEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    toy.step(e.key === 'ArrowUp' ? 1 : -1)
  })
  const on = (sel: string, fn: (b: HTMLButtonElement) => void): void => {
    for (const b of qa<HTMLButtonElement>(sel, root))
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return
        fn(b)
      })
  }
  on('[data-staff-step]', (b) =>
    toy.step(Number(b.dataset.staffStep) > 0 ? 1 : -1),
  )
  on('[data-iv-sign]', (b) =>
    toy.sign(b.dataset.ivSign === 'flat' ? 'flat' : 'sharp'),
  )
  on('[data-iv-fold]', () => void toy.fold())
  on('[data-iv-curl]', () => toy.curl())
  on('button[data-clef]', (b) =>
    toy.setClef(b.dataset.clef === 'treble' ? 'treble' : 'bass'),
  )
  on('[data-staff-lanes]', () => PitchLine.set(!PitchLine.on))
  PitchLine.subscribe((lanesOn) => {
    for (const b of qa<HTMLButtonElement>('[data-staff-lanes]', root))
      b.setAttribute('aria-pressed', String(lanesOn))
    label()
    if (layout !== null) draw()
  })
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => {
      if (layout !== null) draw()
    }).observe(svgEl)

  refresh()
  draw()
  return toy
}
