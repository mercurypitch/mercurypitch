// ============================================================
// Beat strip — the beat machine's compact state, a drawing of bars
// ============================================================
//
// The beat machine folded small (Lesson 8 WEB-SPEC, Toys 1, Compact): rows
// of beat cells, the numbers over each bar, a syllable in each cell (one
// held over two beats spans both), the claps drawn as dots under their
// beats, and the small metronome in a 44 px column at the left of the first
// row. The hero's cold open draws two rows of two bars, the first two lines
// of "Twinkle"; Sing it's guide one row, the first line; the tap take one
// bar, then the four it timed, one row a bar, with a tick where each tap
// fell. Its cells are drawings, never targets: the strip is hidden from a
// screen reader, and the page's polite line speaks for it.
//
// The claps slide to new beats in 0.4 s, at once under reduced motion or
// Pause animations, as every move on the page does. A lit cell takes its
// singer's colour; nothing lights or moves until something plays.

import { angleAtBeats } from './beat-patterns'
import { qa } from './dom'
import { metronomeSVG } from './explorer-figures'
import { Motion } from './motion-switch'

/** A cell: its syllable ('' for none) and the beats it spans. */
export interface StripCell {
  readonly text: string
  readonly span: 1 | 2
}

/** A row of the strip: its cells, whose spans add up to its beats. */
export interface StripRow {
  readonly cells: readonly StripCell[]
}

export interface BeatStripOptions {
  readonly rows: readonly StripRow[]
  readonly beatsPerBar: number
  /** The gradient id of a small metronome at the left of the first row, if it has one. */
  readonly metronome?: string
}

/** A tap drawn where it fell: its beat in the row (fractional), and whether it is on the backbeat. */
export interface StripTick {
  readonly beat: number
  readonly gold: boolean
}

export interface BeatStrip {
  /** The claps under these beats of every bar (from 0), sliding there over `seconds`. */
  claps(beats: readonly number[], seconds?: number): void
  /** A faint dashed copy of the claps on these beats, beside the real ones, or none. */
  ghost(beats: readonly number[] | null): void
  /** Beat 1's numbers larger, and the backbeat's numbers and claps in gold; `glow` glows them once. */
  marks(o: { accent: boolean; backbeat: boolean; glow?: boolean }): void
  /** Lights the cell under beat `beat`, counted from the strip's first, in `color`; null lights none. */
  light(beat: number | null, color?: string): void
  /** The small metronome as heard: its arm by the beats since the first, and its lamp. */
  swing(beats: number | null, lamp: boolean): void
  /** Outlines these beats of every bar: the take's two targets. */
  outline(beats: readonly number[]): void
  /** Draws the taps of row `row` as ticks. */
  ticks(row: number, at: readonly StripTick[]): void
  /** Rebuilds the strip on new rows. */
  setRows(rows: readonly StripRow[]): void
}

/** The beats a row holds. */
export const rowBeats = (row: StripRow): number =>
  row.cells.reduce((n, c) => n + c.span, 0)

/** A row of `beats` empty cells, a bar's worth or more. */
export const emptyRow = (beats: number): StripRow => ({
  cells: Array.from({ length: beats }, () => ({ text: '', span: 1 as const })),
})

export function mountBeatStrip(
  root: HTMLElement,
  o: BeatStripOptions,
): BeatStrip {
  root.setAttribute('aria-hidden', 'true')
  root.classList.add('strip')
  let rows = o.rows
  let clapBeats: readonly number[] = []
  let ghostBeats: readonly number[] | null = null
  let backbeat = false
  let outlined: readonly number[] = []
  let arm: SVGGElement | null = null
  let lamp: HTMLElement | null = null
  const per = o.beatsPerBar

  function build(): void {
    root.replaceChildren()
    root.classList.toggle('with-metro', o.metronome !== undefined)
    rows.forEach((row, r) => {
      const el = document.createElement('div')
      el.className = 'strip-row'
      const n = rowBeats(row)
      el.style.setProperty('--n', String(n))
      if (r === 0 && o.metronome !== undefined) {
        const m = document.createElement('div')
        m.className = 'strip-metro'
        m.innerHTML = `${metronomeSVG(o.metronome)}<i class="strip-lamp"></i>`
        el.append(m)
        arm = m.querySelector<SVGGElement>('.arm')
        lamp = m.querySelector('.strip-lamp')
      }
      const nums = document.createElement('div')
      nums.className = 'strip-nums'
      for (let b = 0; b < n; b++) {
        const s = document.createElement('span')
        const inBar = b % per
        s.textContent = String(inBar + 1)
        if (inBar === 0) s.className = 'one'
        if (per === 4 && inBar % 2 === 1) s.classList.add('bb')
        s.dataset.beat = String(b)
        nums.append(s)
      }
      const cells = document.createElement('div')
      cells.className = 'strip-cells'
      let at = 0
      for (const c of row.cells) {
        const s = document.createElement('span')
        s.className = 'sc'
        s.textContent = c.text
        s.style.gridColumn = `span ${c.span}`
        s.dataset.from = String(at)
        s.dataset.to = String(at + c.span - 1)
        at += c.span
        cells.append(s)
      }
      const marks = document.createElement('div')
      marks.className = 'strip-marks'
      el.append(nums, cells, marks)
      root.append(el)
    })
    drawClaps(0)
    drawOutline()
  }

  /** Each row's claps and ghost, placed at their beats. */
  function drawClaps(seconds: number): void {
    const slide = seconds > 0 && !Motion.paused
    qa<HTMLElement>('.strip-row', root).forEach((el, r) => {
      const marks = el.querySelector('.strip-marks')
      if (marks === null) return
      const n = rowBeats(rows[r])
      const want = Math.floor(n / per) * clapBeats.length
      let dots = qa<HTMLElement>('i.clap:not(.ghost)', marks)
      if (dots.length !== want) {
        dots.forEach((d) => d.remove())
        dots = Array.from({ length: want }, () => {
          const d = document.createElement('i')
          d.className = 'clap'
          marks.append(d)
          return d
        })
      }
      dots.forEach((d, i) => {
        const bar = Math.floor(i / clapBeats.length)
        const beat = clapBeats[i % clapBeats.length]
        d.style.transitionDuration = slide ? `${seconds}s` : '0s'
        d.style.setProperty('--at', String(bar * per + beat))
        d.classList.toggle('gold', backbeat && per === 4 && beat % 2 === 1)
      })
      qa('i.ghost', marks).forEach((g) => g.remove())
      if (ghostBeats === null) return
      for (let bar = 0; bar < Math.floor(n / per); bar++)
        for (const beat of ghostBeats) {
          const g = document.createElement('i')
          g.className = 'clap ghost'
          g.style.setProperty('--at', String(bar * per + beat))
          marks.append(g)
        }
    })
  }

  function drawOutline(): void {
    qa<HTMLElement>('.strip-row', root).forEach((el) =>
      qa<HTMLElement>('.sc', el).forEach((s) => {
        const from = Number(s.dataset.from) % per
        s.classList.toggle('target', outlined.includes(from))
      }),
    )
  }

  build()

  return {
    claps(beats, seconds = 0) {
      clapBeats = beats
      drawClaps(seconds)
    },
    ghost(beats) {
      ghostBeats = beats
      drawClaps(0)
    },
    marks({ accent, backbeat: bb, glow = false }) {
      backbeat = bb
      root.classList.toggle('accented', accent)
      root.classList.toggle('backbeat', bb)
      drawClaps(0)
      if (!glow || Motion.paused) return
      for (const s of qa<HTMLElement>('.strip-nums .bb, i.clap.gold', root))
        s.animate(
          [
            { filter: 'drop-shadow(0 0 0 rgba(255, 216, 77, 0))' },
            { filter: 'drop-shadow(0 0 8px rgba(255, 216, 77, .9))' },
            { filter: 'drop-shadow(0 0 0 rgba(255, 216, 77, 0))' },
          ],
          { duration: 1200, easing: 'ease-out' },
        )
    },
    light(beat, color = 'var(--ink)') {
      let base = 0
      qa<HTMLElement>('.strip-row', root).forEach((el, r) => {
        const n = rowBeats(rows[r])
        for (const s of qa<HTMLElement>('.sc', el)) {
          const on =
            beat !== null &&
            beat - base >= Number(s.dataset.from) &&
            beat - base <= Number(s.dataset.to)
          s.classList.toggle('is-lit', on)
          if (on) s.style.setProperty('--lit', color)
        }
        base += n
      })
    },
    swing(beats, on) {
      if (arm !== null)
        arm.style.transform =
          beats === null || Motion.paused
            ? ''
            : `rotate(${angleAtBeats(beats)}deg)`
      lamp?.classList.toggle('is-lit', on)
    },
    outline(beats) {
      outlined = beats
      drawOutline()
    },
    ticks(row, at) {
      const el = qa<HTMLElement>('.strip-row', root)[row]
      const marks = el?.querySelector('.strip-marks')
      if (marks === undefined || marks === null) return
      qa('i.tick', marks).forEach((t) => t.remove())
      for (const t of at) {
        const i = document.createElement('i')
        i.className = t.gold ? 'tick gold' : 'tick'
        i.style.setProperty('--at', String(t.beat))
        marks.append(i)
      }
    },
    setRows(next) {
      rows = next
      build()
    },
  }
}
