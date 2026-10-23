// ============================================================
// Beat machine — a metronome whose arm becomes the grid of a step sequencer
// ============================================================
//
// One object across a lesson's steps (Lesson 8 WEB-SPEC, Toys 1): a
// metronome whose arm swings one way, then the other, one swing a beat
// (Steps 1 and 2, with Tempo); its beats laid in a row of pads, a bar of 2,
// 3 or 4 (Step 3, with Bars); the row as the header of a beat grid with a
// lane for each sound, Kick, Clap and Hi-hat (Step 4); the grid playing two
// patterns, each at its own tempo (Step 5); and every control together
// (free play). Generic over its lanes and patterns, so a later rhythm
// lesson can draw its own.
//
// The figure is HTML and the kit's metronome drawing: its parts sit where
// beat-layout.ts puts them for the state, and glide there when the state
// changes (0.6 s on the kit's expoOut; at once under reduced motion or
// Pause animations). The cells are real toggle buttons on a layer laid
// over the figure after the controls, so they come last in the tab order,
// Kick before Clap before Hi-hat, beat 1 to 4. Every sound goes through
// the beat clock (beat-clock.ts), booked ahead on the audio clock into the
// run's own bus, and the page's one-sound owner (now-playing.ts): starting
// the machine stops any other sound, and any other sound stops the
// machine. The arm, the lamp and the lit beat follow the sound as heard;
// under reduced motion the arm stands upright and the lamp still lights.
// A polite line says what each action changed, once; the figure's summary
// says what it shows.

import { triggerDrumVoice } from '@/lib/drum-voices'
import type { Bar, Run, RunOptions, Spot } from './beat-clock'
import { BeatClock } from './beat-clock'
import type { MachineLayout, MachineState, Rect } from './beat-layout'
import { machineLayout } from './beat-layout'
import type { Lane, MachineHit, Pattern } from './beat-patterns'
import { angleAtBeats, capital, cellName, CLICK, clickBar, describeLane, describePattern, isBackbeat, patternBar, resizePattern, toggleCell, } from './beat-patterns'
import { clamp, q, qa } from './dom'
import { metronomeSVG } from './explorer-figures'
import { Motion } from './motion-switch'
import type { SoundOwner } from './now-playing'
import { Sound } from './sound'
import type { Bus } from './sound-ahead'
import { bindTapPad, createTapTempo } from './tap-pad'

/** A pattern the machine can play, with its own tempo. */
export interface PatternChoice {
  /** Its name, as the readout and the live line say it: "March". */
  readonly name: string
  readonly pattern: Pattern
  readonly bpm: number
}

export interface BeatMachineOptions {
  /** The toy or card: the figure (`[data-bm]`), its controls and the cells' layer (`[data-bm-hits]`). */
  readonly root: HTMLElement
  readonly lanes: readonly Lane[]
  readonly patterns: Readonly<Record<string, PatternChoice>>
  /** The pattern the grid opens on, and Reset puts back. */
  readonly grid: string
  /** The pattern Step 5 opens on. */
  readonly shown: string
  /** The metronome's tempo to begin with. */
  readonly bpm: number
  /** The metronome drawing's gradient id: one per copy on the page. */
  readonly id: string
  readonly owner: SoundOwner
  /** The state it opens in. */
  readonly state: MachineState
}

export interface BeatMachine {
  readonly state: MachineState
  setState(state: MachineState): void
  readonly playing: boolean
  /** Stops what it plays: the run's bus fades and nothing more is booked. */
  stop(): void
  /** Plays a pattern for `bars` bars on the grid, at `bpm`; true once heard to its end. */
  playPattern(
    name: string,
    bpm: number,
    bars: number,
    audible: boolean,
  ): Promise<boolean>
}

/** The figure's name for a screen reader, by state. */
const GROUP: Readonly<Record<MachineState, string>> = {
  metronome: 'Metronome',
  tempo: 'Metronome',
  bars: 'Beat row',
  grid: 'Beat grid',
  patterns: 'Beat grid',
  free: 'Beat grid',
}

/** The lamp's light after each beat, seconds. */
const LAMP_SEC = 0.12
/** The live line as the metronome starts (Toys 5). */
export const METRONOME_STARTED =
  'Metronome started. Tap the pad, or press Space, with each click.'
/** The slider's spoken value. */
export const tempoText = (bpm: number): string => `${bpm} beats per minute`

/** The tapped tempo is spoken at most this often, ms. */
export const TAPS_SAID_MS = 2000

const isMetronome = (s: MachineState): boolean =>
  s === 'metronome' || s === 'tempo'
const isGrid = (s: MachineState): boolean =>
  s === 'grid' || s === 'patterns' || s === 'free'

/** Books a hit's sound into the run's bus: the kit's tick for a click, the app's drum voice for a drum. */
export function bookHit(hit: MachineHit, when: number, bus: Bus): void {
  if (hit.kind === 'click') {
    const c = hit.high ? CLICK.high : CLICK.plain
    Sound.tick(c.hz, c.gain, { when, to: bus.node })
  } else triggerDrumVoice(hit.voice, bus.context, when, hit.level, bus.node)
}

/** Writes text only when it changes, so a live line is heard once. */
function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

function place(el: HTMLElement, r: Rect): void {
  el.style.left = `${r.x}px`
  el.style.top = `${r.y}px`
  el.style.width = `${r.w}px`
  el.style.height = `${r.h}px`
}

/** The figure's parts, made once. */
function buildFigure(figure: HTMLElement, o: BeatMachineOptions) {
  const metro = document.createElement('div')
  metro.className = 'bm-part bm-metro'
  metro.innerHTML = metronomeSVG(o.id)
  const lamp = document.createElement('i')
  lamp.className = 'bm-part bm-lamp'
  const pads = Array.from({ length: 4 }, (_, i) => {
    const p = document.createElement('div')
    p.className = i === 0 ? 'bm-part bm-pad one' : 'bm-part bm-pad'
    p.textContent = String(i + 1)
    return p
  })
  const labels = o.lanes.map((lane) => {
    const l = document.createElement('div')
    l.className = 'bm-part bm-label'
    l.textContent = lane.name
    return l
  })
  const read = document.createElement('div')
  read.className = 'bm-read'
  read.innerHTML =
    '<p class="ro bm-ro-tempo"><span class="k">Tempo</span><span class="v" data-bm-ro-tempo></span></p><p class="ro bm-ro-taps"><span class="k">Your taps</span><span class="v" data-bm-ro-taps>tap four times</span></p>'
  // the line in the grid's bar label band: "Bar 3 · beat 2", "March · 90 BPM"
  const line = document.createElement('p')
  line.className = 'bm-ro-line'
  const visual = document.createElement('div')
  visual.className = 'bm-visual'
  visual.setAttribute('aria-hidden', 'true')
  visual.append(metro, lamp, ...pads, ...labels, read, line)
  figure.prepend(visual)
  return {
    metro,
    arm: q<SVGGElement>('.arm', metro),
    lamp,
    pads,
    labels,
    tempoRo: q('[data-bm-ro-tempo]', read),
    tapsRo: q('[data-bm-ro-taps]', read),
    lineRo: line,
  }
}

/** The cells, every lane by its beats, on the layer over the figure. */
function buildCells(hits: HTMLElement, lanes: readonly Lane[]) {
  return lanes.map((lane) =>
    Array.from({ length: 4 }, (_, cell) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `bm-cell bm-${lane.id}`
      b.dataset.lane = lane.id
      b.dataset.cell = String(cell)
      b.setAttribute('aria-pressed', 'false')
      b.innerHTML =
        lane.perBeat === 2
          ? '<i class="tk"></i><i class="tk"></i>'
          : '<i class="mk"></i>'
      hits.append(b)
      return b
    }),
  )
}

export function mountBeatMachine(o: BeatMachineOptions): BeatMachine {
  const root = o.root
  const figure = q('[data-bm]', root)
  const hits = q('[data-bm-hits]', root)
  const summary = q('[data-bm-summary]', figure)
  const said = q('[data-bm-said]', figure)
  const parts = buildFigure(figure, o)
  const cells = buildCells(hits, o.lanes)
  const starts = qa<HTMLButtonElement>('[data-bm-start]', root)
  const rows = qa('[data-bm-for]', root)
  const barsBtns = qa<HTMLButtonElement>('[data-bars]', root)
  const patternBtns = qa<HTMLButtonElement>('[data-bm-pattern]', root)
  const tempos = qa<HTMLInputElement>('input[data-bm-tempo]', root)
  const clickSwitch = root.querySelector<HTMLButtonElement>('[data-bm-click]')
  const taps = createTapTempo()

  let state: MachineState = o.state
  let metroBpm = o.bpm
  let barsBeats = 4
  let edited: Pattern = o.patterns[o.grid].pattern
  let free: Pattern = edited
  let freeBpm = o.patterns[o.grid].bpm
  let clickOn = false
  // Step 5: the pattern chosen, each pattern's tempo for the visit, and the one on the grid
  let chosen = o.shown
  const visitBpm: Record<string, number> = {}
  for (const [k, p] of Object.entries(o.patterns)) visitBpm[k] = p.bpm
  let onGrid = o.shown
  let run: Run | null = null
  let runBpm: () => number = () => metroBpm
  // the patterns of the bars booked so far, by bar, for a change at the bar line
  let barNames: string[] = []
  let lit = -1
  let lampOn = false
  let lastLine = ''
  let laidOut: MachineLayout | null = null

  const freeBeats = (): number => free.beats
  const beatsNow = (): number => {
    if (state === 'bars') return barsBeats
    if (state === 'free') return freeBeats()
    return 4
  }
  const shownPattern = (): Pattern => {
    if (state === 'grid') return edited
    if (state === 'free') return free
    return o.patterns[onGrid].pattern
  }
  const bpmOf = (s: MachineState): number => {
    if (s === 'grid') return o.patterns[o.grid].bpm
    if (s === 'patterns') return visitBpm[chosen]
    if (s === 'free') return freeBpm
    return metroBpm
  }

  // ---------------------------------------------------------------- drawing

  function layout(): void {
    const w = figure.clientWidth
    const h = figure.clientHeight
    if (w === 0 || h === 0) return
    const l = machineLayout(state, w, h, beatsNow(), o.lanes.length)
    laidOut = l
    figure.dataset.compact = String(l.compact)
    place(parts.metro, l.metro)
    place(parts.lamp, l.lamp)
    parts.pads.forEach((p, i) => {
      const r = l.pads[i]
      p.hidden = r === undefined
      if (r !== undefined) place(p, r)
    })
    parts.labels.forEach((el, i) => place(el, l.labels[i]))
    cells.forEach((row, lane) =>
      row.forEach((b, i) => {
        const r = l.cells[lane][i]
        b.hidden = r === undefined
        if (r !== undefined) place(b, r)
      }),
    )
  }

  /** The cells' state, marks and names, and the numbers' gold, from the pattern shown. */
  function paintCells(): void {
    const p = shownPattern()
    const editable = state === 'grid' || state === 'free'
    o.lanes.forEach((lane, li) =>
      cells[li].forEach((b, i) => {
        const v = p.cells[lane.id]?.[i] ?? 0
        b.setAttribute('aria-pressed', String(v > 0))
        b.setAttribute('aria-label', cellName(lane, i, v))
        b.classList.toggle('acc', v === 2)
        b.classList.toggle(
          'gold',
          lane.backbeat === true && v > 0 && isBackbeat(p.beats, i),
        )
        b.disabled = !editable
      }),
    )
    parts.pads.forEach((pad, i) => {
      const gold =
        isGrid(state) &&
        isBackbeat(p.beats, i) &&
        o.lanes.some(
          (l) => l.backbeat === true && (p.cells[l.id]?.[i] ?? 0) > 0,
        )
      pad.classList.toggle('gold', gold)
    })
  }

  function summaryText(): string {
    const playing = run !== null
    const on = playing ? 'playing' : 'stopped'
    if (isMetronome(state)) return `Metronome at ${tempoText(metroBpm)}, ${on}`
    if (state === 'bars') return `One bar of ${barsBeats} beats, ${on}`
    const words = describePattern(shownPattern(), o.lanes)
    const head =
      state === 'patterns'
        ? `${o.patterns[onGrid].name} at ${tempoText(gridBpm())}. `
        : ''
    return `${head}${words}${playing ? ', playing' : ''}`
  }

  /** The tempo the grid's pattern plays at: the run's while it plays, else the pattern's own for the visit. */
  const gridBpm = (): number =>
    Math.round(run !== null ? runBpm() : (visitBpm[onGrid] ?? bpmOf(state)))

  function readouts(): void {
    say(parts.tempoRo, `${metroBpm} BPM`)
    const line =
      state === 'patterns'
        ? `${o.patterns[onGrid].name} · ${gridBpm()} BPM`
        : state === 'free'
          ? `${freeBpm} BPM`
          : lastLine
    say(parts.lineRo, line)
    if (laidOut !== null) place(parts.lineRo, laidOut.band)
  }

  function paint(): void {
    figure.dataset.state = state
    hits.dataset.state = state
    figure.setAttribute('aria-label', GROUP[state])
    for (const r of rows)
      r.hidden = !(r.dataset.bmFor ?? '').split(' ').includes(state)
    barsBtns.forEach((b) =>
      b.setAttribute(
        'aria-pressed',
        String(
          Number(b.dataset.bars) ===
            (state === 'free' ? free.beats : barsBeats),
        ),
      ),
    )
    patternBtns.forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.bmPattern === chosen)),
    )
    if (clickSwitch !== null)
      clickSwitch.setAttribute('aria-pressed', String(clickOn))
    paintCells()
    readouts()
    say(summary, summaryText())
  }

  /** The lit beat, the lamp and the arm, as heard. */
  function frame(spot: Spot): void {
    const beat = spot.beat
    if (state === 'patterns' && beat === 0) {
      const name = barNames[spot.bar]
      if (name !== undefined && name !== onGrid) {
        onGrid = name
        paint()
      }
    }
    if (beat !== lit) light(beat)
    const into = (spot.beats % 1) * (60 / runBpm())
    const on = into < LAMP_SEC
    if (on !== lampOn) {
      lampOn = on
      parts.lamp.classList.toggle('is-lit', on)
    }
    const angle = Motion.paused ? 0 : angleAtBeats(spot.beats)
    parts.arm.style.transform = `rotate(${angle}deg)`
    if (state === 'bars') {
      lastLine = `Bar ${spot.bar + 1} · beat ${beat + 1}`
      say(parts.lineRo, lastLine)
    }
  }

  function light(beat: number): void {
    lit = beat
    parts.pads.forEach((p, i) => p.classList.toggle('is-now', i === beat))
    cells.forEach((row) =>
      row.forEach((b, i) => b.classList.toggle('is-now', i === beat)),
    )
  }

  function setPlaying(): void {
    const playing = run !== null
    for (const b of starts) {
      const label = q('[data-label]', b)
      say(label, playing ? 'Stop' : (b.dataset.bmStart ?? 'Start'))
      b.classList.toggle('is-on', playing)
      q('use', b).setAttribute('href', playing ? '#i-pause' : '#i-play')
    }
    if (!playing) {
      light(-1)
      lampOn = false
      parts.lamp.classList.remove('is-lit')
      parts.arm.style.transform = ''
      lastLine = state === 'bars' ? `${barsBeats} beats a bar` : ''
    }
    paint()
  }

  // ---------------------------------------------------------------- sound

  function stop(): void {
    const r = run
    run = null
    r?.stop()
    o.owner.release(stop)
    setPlaying()
  }

  function begin(
    bar: (i: number) => Bar<MachineHit> | null,
    bpm: () => number,
    audible: boolean,
    tail = 0,
  ): Run {
    stop()
    o.owner.claim(stop)
    runBpm = bpm
    barNames = []
    const options: RunOptions<MachineHit> = {
      bar,
      bpm,
      audible,
      tail,
      book: bookHit,
      onFrame: frame,
    }
    const r = BeatClock.start(options)
    run = r
    void r.done.then(() => {
      if (run !== r) return
      run = null
      o.owner.release(stop)
      setPlaying()
    })
    setPlaying()
    return r
  }

  /** The loop a state's Start plays, endless until stopped. */
  function loopBar(i: number): Bar<MachineHit> {
    if (isMetronome(state)) return clickBar(4, 'plain')
    if (state === 'bars') return clickBar(barsBeats, 'bars')
    if (state === 'grid') return patternBar(edited, o.lanes)
    if (state === 'free')
      return patternBar(free, o.lanes, clickOn ? 'bars' : 'none')
    barNames[i] = chosen
    return patternBar(o.patterns[chosen].pattern, o.lanes)
  }

  function toggle(): void {
    if (run !== null) {
      stop()
      say(said, 'Stopped')
      return
    }
    const loopState = state
    begin(
      (i) => (state === loopState ? loopBar(i) : null),
      // a pattern's tempo changes with it, at the bar line: each beat takes
      // the tempo of the pattern its bar plays, booked before its beats
      loopState === 'patterns'
        ? () => visitBpm[barNames.at(-1) ?? chosen]
        : () => bpmOf(loopState),
      Sound.canPlay(),
    )
    if (isMetronome(state)) {
      say(said, METRONOME_STARTED)
      // Space and Enter tap at once (Toys 5)
      qa<HTMLButtonElement>('[data-bm-pad]', root)
        .find((p) => p.closest('[hidden]') === null)
        ?.focus()
    } else say(said, 'Playing')
  }

  // ---------------------------------------------------------------- controls

  function onCell(b: HTMLButtonElement): void {
    const lane = o.lanes.find((l) => l.id === b.dataset.lane)
    if (lane === undefined || b.disabled) return
    const cell = Number(b.dataset.cell)
    if (state === 'grid') edited = toggleCell(edited, lane.id, cell)
    else if (state === 'free') free = toggleCell(free, lane.id, cell)
    else return
    paint()
    say(said, capital(describeLane(lane, shownPattern())))
  }

  function onBars(b: HTMLButtonElement): void {
    const n = Number(b.dataset.bars)
    if (state === 'free') free = resizePattern(free, n)
    else barsBeats = n
    if (run === null && state === 'bars') lastLine = `${n} beats a bar`
    layout()
    paint()
    say(said, `Bars of ${n}`)
  }

  function onPattern(b: HTMLButtonElement): void {
    const name = b.dataset.bmPattern ?? ''
    const choice = o.patterns[name]
    if (choice === undefined) return
    if (state === 'free') {
      free = resizePattern(choice.pattern, choice.pattern.beats)
      freeBpm = choice.bpm
      // the pattern just loaded is the one pressed, as the live line says
      chosen = name
      syncTempos()
      layout()
    } else {
      chosen = name
      if (run === null) onGrid = name
      syncTempos()
    }
    paint()
    say(said, `${choice.name} at ${tempoText(bpmOf(state))}`)
  }

  function onTempo(input: HTMLInputElement): void {
    const bpm = Number(input.value)
    const which = input.dataset.bmTempo
    if (which === 'pattern') visitBpm[chosen] = bpm
    else if (which === 'free') freeBpm = bpm
    else metroBpm = bpm
    showTempo(input, bpm)
    paint()
  }

  function showTempo(input: HTMLInputElement, bpm: number): void {
    input.value = String(bpm)
    input.setAttribute('aria-valuetext', tempoText(bpm))
    const min = Number(input.min)
    const max = Number(input.max)
    input.style.setProperty('--p', `${((bpm - min) / (max - min)) * 100}%`)
    const label = root.querySelector(`label[for="${input.id}"] b`)
    if (label !== null) label.textContent = `${bpm} BPM`
  }

  /** Each slider shows its own tempo: the metronome's, the chosen pattern's, free play's. */
  function syncTempos(): void {
    for (const t of tempos) {
      const which = t.dataset.bmTempo
      const bpm =
        which === 'pattern'
          ? visitBpm[chosen]
          : which === 'free'
            ? freeBpm
            : metroBpm
      showTempo(t, bpm)
    }
  }

  function bind(): void {
    starts.forEach((b) => b.addEventListener('click', toggle))
    hits.addEventListener('click', (e) => {
      const b =
        e.target instanceof Element
          ? e.target.closest<HTMLButtonElement>('.bm-cell')
          : null
      if (b !== null) onCell(b)
    })
    barsBtns.forEach((b) => b.addEventListener('click', () => onBars(b)))
    patternBtns.forEach((b) => b.addEventListener('click', () => onPattern(b)))
    for (const t of tempos) {
      t.addEventListener('input', () => onTempo(t))
      // Page Up and Page Down move the tempo by 10, as the spec asks
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'PageUp' && e.key !== 'PageDown') return
        e.preventDefault()
        const step = e.key === 'PageUp' ? 10 : -10
        t.value = String(
          clamp(Number(t.value) + step, Number(t.min), Number(t.max)),
        )
        onTempo(t)
      })
    }
    root.querySelector('[data-bm-reset]')?.addEventListener('click', () => {
      edited = o.patterns[o.grid].pattern
      paint()
      const words = o.lanes.map((l) => describeLane(l, edited)).join(', ')
      say(said, `${o.patterns[o.grid].name} is back: ${words}`)
    })
    root.querySelector('[data-bm-clear]')?.addEventListener('click', () => {
      free = resizePattern({ beats: free.beats, cells: {} }, free.beats)
      paint()
      say(said, 'Every cell off')
    })
    clickSwitch?.addEventListener('click', () => {
      clickOn = !clickOn
      paint()
      say(said, clickOn ? 'Click on' : 'Click off')
    })
    // The readout is drawn in the figure's hidden layer, so the tapped tempo
    // is spoken on the live line too: at most every TAPS_SAID_MS, and once
    // more after the taps stop, never a word a tap.
    let tapWords = ''
    let tapTimer = 0
    const sayTaps = (): void => {
      tapTimer = 0
      if (tapWords === '') return
      say(said, tapWords)
      tapWords = ''
      tapTimer = window.setTimeout(sayTaps, TAPS_SAID_MS)
    }
    for (const pad of qa<HTMLButtonElement>('[data-bm-pad]', root))
      bindTapPad(pad, (at) => {
        const r = taps.tap(at)
        say(parts.tapsRo, r.bpm === null ? 'tap four times' : `${r.bpm} BPM`)
        if (r.bpm === null) return
        tapWords = `Your taps: ${tempoText(r.bpm)}`
        if (tapTimer === 0) sayTaps()
      })
  }

  function setState(next: MachineState): void {
    if (next === state && laidOut !== null) return
    stop()
    state = next
    if (state === 'patterns') onGrid = chosen
    if (state === 'bars' && lastLine === '')
      lastLine = `${barsBeats} beats a bar`
    layout()
    paint()
  }

  bind()
  syncTempos()
  layout()
  paint()
  // the morph glides from the first change on, never from the page's load
  requestAnimationFrame(() => figure.classList.add('bm-ready'))
  let frameAsked = 0
  new ResizeObserver(() => {
    if (frameAsked !== 0) return
    frameAsked = requestAnimationFrame(() => {
      frameAsked = 0
      layout()
    })
  }).observe(figure)

  return {
    get state() {
      return state
    },
    setState,
    get playing() {
      return run !== null
    },
    stop,
    playPattern(name, bpm, bars, audible) {
      const choice = o.patterns[name]
      onGrid = name
      paint()
      const r = begin(
        (i) => {
          if (i >= bars) return null
          barNames[i] = name
          return patternBar(choice.pattern, o.lanes)
        },
        () => bpm,
        audible,
        0.3,
      )
      return r.done
    },
  }
}
