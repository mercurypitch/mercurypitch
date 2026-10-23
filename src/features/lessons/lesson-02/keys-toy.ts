// ============================================================
// Lesson 2 keys toy — one copy of the spiral, unrolled, straightened, named
// ============================================================
//
// A spiral copy (spiral-copy.ts) whose unrolled keys are this lesson's own
// layer (keys-layer.ts), with whichever of these controls its root holds:
//   [data-unroll]      Unroll the spiral / Roll it back up
//   [data-straighten]  Straighten / Bend it back
//   [data-lift]        Lift out the five / Drop back
//   [data-sharp], [data-flat]  an arrow one semitone up or down from the
//                      selected white tile, writing the name it gives
//   [data-both-ways]   C4 to C♯4, then D4 to D♭4 (FACTS 49), with the arrows
//   [data-rare]        Show the rare ones (B♯, C♭, E♯, F♭)
//   [data-names-lock]  what unlocks the three above, then what to do
//   [data-names]       the page-wide Sharps · Flats · Both toggle
//   [data-keys-pan]    on a phone narrower than 386 px, one key at a time
// The page's examples play on it too (`play`): each note lights its key or
// tile as it sounds, and a step's bar draws under the keyboard.

import { bindModeToggle, Names, spokenNames, } from '@/features/lessons/kit/names'
import { fmtHz, hz, nameOf, wordName } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { SpiralState } from '@/features/lessons/kit/spiral'
import { LO, WHITE } from '@/features/lessons/kit/spiral-keys'
import { toast } from '@/features/lessons/kit/toast'
import type { NoteEvent } from './examples'
import { lengthOf, pair, schedule, TWO_WAYS } from './examples'
import { phonePanMax, phoneWhites } from './keys-geometry'
import type { Span } from './keys-layer'
import { clearNames, isStraight, keysLayer, keysModel, keysRange, liftFive, sendArrow, tileSpan, } from './keys-layer'
import type { ArrowDir, ArrowStep } from './names-arrows'
import { arrowFrom } from './names-arrows'
import type { SpiralCopy } from './spiral-copy'
import { mountSpiralCopy } from './spiral-copy'

export interface KeysToyOptions {
  /** The tile row on a wide stage and on a phone, semitones from A2. */
  readonly tiles: Span
  readonly phoneTiles: Span
  /** The "1" under each neighbouring pair of tiles. */
  readonly pairs: boolean
  /** How the copy opens: the spiral, the keyboard or the tile row. */
  readonly opens: 'spiral' | 'keys' | 'tiles'
  /** When it draws: a deck's `toyActive(n)`. */
  readonly active?: () => boolean
  /**
   * On a phone, the row that Lift out the five shows when the phone row is a
   * close-up: free play lifts the whole octave, as step 4 does, and goes
   * back to step 5's close-up for the names.
   */
  readonly liftTiles?: Span
}

export interface KeysToy {
  readonly copy: SpiralCopy
  setUnrolled(on: boolean): void
  setStraight(on: boolean): void
  setLifted(on: boolean): void
  /**
   * Plays an example on this copy: each note lights its key as it sounds,
   * with `bars` (pairs of MIDI notes) drawn under the keyboard and `arrows`
   * sent, each at its time. If the copy is a spiral and `keys` asks for
   * the keyboard, it unrolls as the notes sound.
   */
  play(
    events: readonly NoteEvent[],
    o: {
      audible: boolean
      bars?: readonly (readonly [number, number])[]
      arrows?: readonly { step: ArrowStep; at: number }[]
      keys?: boolean
    },
  ): Promise<void>
  /** Step 5's opening: the two arrows to the one key, silently, and its gold ring. */
  signature(): void
  /**
   * Enables Sharp, Flat and Show the rare ones, and hides the line that says
   * they wait (step 5's predict unlocks them).
   */
  unlock(): void
}

/** A3 to G4 or B3 to A4: the phone keyboard's window, by its pan. */
function windowLabel(pan: number, W: number): string {
  const first = WHITE[7 + Math.round(pan)]
  const last = WHITE[7 + Math.round(pan) + phoneWhites(W) - 1]
  return `${nameOf(LO + first) ?? ''} to ${nameOf(LO + last) ?? ''}`
}

/** Swaps a two-state button's label: `span` text and pressed state. */
function setLabel(
  b: HTMLButtonElement | null,
  on: boolean,
  labels: readonly [string, string],
): void {
  if (b === null) return
  const span = b.querySelector('span')
  if (span !== null) span.textContent = on ? labels[1] : labels[0]
  b.setAttribute('aria-pressed', String(on))
}

export function mountKeysToy(root: HTMLElement, o: KeysToyOptions): KeysToy {
  const model = keysModel({
    tiles: o.tiles,
    phoneTiles: o.phoneTiles,
    pairs: o.pairs,
    straight: o.opens === 'tiles' ? 1 : 0,
  })
  let unrolled = o.opens !== 'spiral'
  const said = root.querySelector<HTMLElement>('[data-tiles-said]')
  // queried before the copy mounts: its first hint reads whether there is an Unroll button
  const unrollBtn = root.querySelector<HTMLButtonElement>('[data-unroll]')
  const straightBtn = root.querySelector<HTMLButtonElement>('[data-straighten]')
  const liftBtn = root.querySelector<HTMLButtonElement>('[data-lift]')
  const climbRow = root.querySelector<HTMLElement>('[data-climb-ro]')
  const copy = mountSpiralCopy(root, {
    active: o.active,
    keyLabels: 'all',
    span: null,
    keys: keysLayer(model),
    range: () => (unrolled ? keysRange(model) : [45, 81]),
    hint: (s) => hintFor(s),
    valueText: (m) => `${spokenNames(m)}, ${fmtHz(hz(m))} hertz`,
  })
  const spiral = copy.spiral
  model.keysOn = unrolled
  if (unrolled) spiral.setUnrolled(true)
  spiral.setTurning(!unrolled)

  function hintFor(s: SpiralState): string {
    if (s.focused) return 'Arrows pick a key · Enter plays it'
    if (!s.unrolled)
      return unrollBtn === null
        ? 'Drag to turn · tap a bead to hear it'
        : 'Unroll it, or tap a bead'
    if (!isStraight(model)) return 'Tap any key to hear it'
    return model.narrow
      ? 'Equal tiles, one per semitone'
      : 'Tap any tile to hear it'
  }

  const say = (line: string): void => {
    if (said !== null) said.textContent = line
  }
  model.onLand = (step) => {
    const name = wordName(step.name)
    say(
      model.written.ringed(step.to)
        ? `One key, two names: ${model.written
            .on(step.to)
            .map((n) => wordName(n))
            .join(' and ')}.`
        : `${name} written on the key it lands on.`,
    )
  }

  function sync(): void {
    setLabel(unrollBtn, unrolled, ['Unroll the spiral', 'Roll it back up'])
    setLabel(straightBtn, isStraight(model), ['Straighten', 'Bend it back'])
    setLabel(liftBtn, model.lifted, ['Lift out the five', 'Drop back'])
    syncPan()
    spiral.refresh()
  }

  function setUnrolled(on: boolean): void {
    unrolled = on
    model.keysOn = on
    // the climb's step count belongs to the spiral
    if (on && climbRow !== null) {
      climbRow.hidden = true
      root.classList.remove('has-climb')
    }
    if (!on) bendBack()
    if (on && copy.lookingDown) copy.setLookDown(false)
    spiral.setUnrolled(on)
    spiral.setTurning(!on && !copy.lookingDown)
    sync()
  }

  /** Back to the keyboard: the five drop in place, and the row's sum is not owed. */
  function bendBack(): void {
    model.straightTo = 0
    if (model.lifted) setLifted(false)
    model.sumDue = false
    model.sumAt = null
  }

  function setStraight(on: boolean): void {
    if (on && !unrolled) setUnrolled(true)
    if (on) model.straightTo = 1
    else bendBack()
    sync()
  }

  function setLifted(on: boolean): void {
    if (on && !isStraight(model)) setStraight(true)
    if (on && o.liftTiles !== undefined) model.phoneTiles = o.liftTiles
    liftFive(model, on, performance.now())
    // the risen tiles take the figure's top, where its readout and hint sit
    root.classList.toggle('is-lifted', on)
    say(
      on
        ? 'The five dark tiles lifted out: five holes a tone wide, and two pairs, B and C, E and F, that touch, a semitone apart.'
        : 'Dropped back, one by one: seven letters plus five, twelve notes.',
    )
    sync()
  }

  unrollBtn?.addEventListener('click', () => setUnrolled(!unrolled))
  straightBtn?.addEventListener('click', () => setStraight(!isStraight(model)))
  liftBtn?.addEventListener('click', () => setLifted(!model.lifted))

  // the phone keyboard's pan, one white key at a time, where eight do not fit
  const panBox = root.querySelector<HTMLElement>('[data-keys-pan]')

  function syncPan(): void {
    if (panBox === null) return
    const max = phonePanMax(model.W)
    panBox.hidden = !(model.narrow && unrolled && !isStraight(model) && max > 0)
    const win = panBox.querySelector('[data-keys-window]')
    if (win !== null) win.textContent = windowLabel(model.panTo, model.W)
    panBox
      .querySelectorAll<HTMLButtonElement>('[data-keys-step]')
      .forEach((b) => {
        const d = Number(b.dataset.keysStep)
        b.setAttribute(
          'aria-disabled',
          String(d < 0 ? model.panTo <= 0 : model.panTo >= max),
        )
      })
  }
  panBox?.querySelectorAll<HTMLButtonElement>('[data-keys-step]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      model.panTo += Number(b.dataset.keysStep)
      syncPan()
    }),
  )
  // the canvas width is known only once it draws: the layer says when it changes
  model.onResize = sync

  bindModeToggle(root, Names, 'data-names')
  Names.subscribe(() => spiral.refresh())

  async function play(
    events: readonly NoteEvent[],
    p: Parameters<KeysToy['play']>[1],
  ): Promise<void> {
    // the notes sound at once; the keys unroll under them (at once under reduced motion)
    if (p.keys === true && !unrolled) setUnrolled(true)
    const t0 = performance.now()
    model.quietUntil = t0 + lengthOf(events) * 1000
    for (const a of p.arrows ?? [])
      window.setTimeout(
        () => sendArrow(model, a.step, performance.now()),
        a.at * 1000,
      )
    await schedule(events, (e, i) => {
      void spiral.play(e.midi, { audible: p.audible, dur: e.dur })
      const bar = p.bars?.find(([, to], k) => to === e.midi && i === 2 * k + 1)
      if (bar !== undefined) model.bars.add(bar[0], bar[1], t0 + e.at * 1000)
    })
  }

  // Sharp and Flat: an arrow from the selected white tile, the step heard as it goes
  const sharpBtn = root.querySelector<HTMLButtonElement>('[data-sharp]')
  const flatBtn = root.querySelector<HTMLButtonElement>('[data-flat]')
  const rareBtn = root.querySelector<HTMLButtonElement>('[data-rare]')

  /** Back to the phone's close-up for the names, unless the five are lifted. */
  function closeUp(): void {
    if (o.liftTiles === undefined || model.lifted) return
    model.phoneTiles = o.phoneTiles
    spiral.refresh()
  }

  function arrow(dir: ArrowDir): void {
    closeUp()
    const from = spiral.selected
    const step = arrowFrom(from, dir)
    if (step === null) {
      toast('Pick a white tile first: a sharp or a flat steps from a letter.')
      return
    }
    const [lo, hi] = tileSpan(model, model.narrow)
    if (step.to - LO < lo || step.to - LO > hi) {
      const way = dir === 'sharp' ? 'up' : 'down'
      toast(
        `One semitone ${way} from ${nameOf(from) ?? ''} lands off this row.`,
      )
      return
    }
    void play(pair(from, step.to), {
      audible: Sound.canPlay(),
      arrows: [{ step, at: 0 }],
    })
  }
  sharpBtn?.addEventListener('click', () => arrow('sharp'))
  flatBtn?.addEventListener('click', () => arrow('flat'))

  rareBtn?.addEventListener('click', () => {
    closeUp()
    model.rare = !model.rare
    rareBtn.setAttribute('aria-pressed', String(model.rare))
    say(
      model.rare
        ? 'The rare names show: B sharp on C, C flat on B, E sharp on F and F flat on E.'
        : 'The rare names are hidden.',
    )
  })

  const twoWays = (): readonly { step: ArrowStep; at: number }[] => {
    const up = arrowFrom(60, 'sharp')
    const down = arrowFrom(62, 'flat')
    return up === null || down === null
      ? []
      : [
          { step: up, at: 0 },
          { step: down, at: 1.9 },
        ]
  }
  root.querySelector('[data-both-ways]')?.addEventListener('click', () => {
    closeUp()
    clearNames(model)
    void play(TWO_WAYS, { audible: Sound.canPlay(), arrows: twoWays() })
  })

  sync()
  return {
    copy,
    setUnrolled,
    setStraight,
    setLifted,
    play,
    signature() {
      clearNames(model)
      const now = performance.now()
      for (const a of twoWays())
        sendArrow(model, a.step, now + (a.at === 0 ? 300 : 1300))
    },
    unlock() {
      for (const b of [sharpBtn, flatBtn, rareBtn])
        if (b !== null) b.disabled = false
      root.querySelector('[data-names-lock]')?.classList.add('is-open')
    },
  }
}
