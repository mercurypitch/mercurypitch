// ============================================================
// MicCheckStage — the ribbon, the falling notes and the keys
// ============================================================
//
// Reads the controller's per-frame analysis (`live`) on its own animation
// frame and paints it. The stage owns only visual state — the ribbon's
// motion, the notes in flight, the glow on the keys — so a dropped frame
// costs a frame of picture, never a reading.
//
// Once the check stops and everything has settled, the loop parks itself
// and the canvas keeps its resting frame; it wakes for the next check or a
// resize. Reduced motion keeps what carries information — the ribbon's
// height and the lit key — and drops the rest: no wandering lobes, no
// thrown notes.
//
// Two surfaces draw it. Settings shows the full strip, octaves named, and
// labels the note that lands. First Light's waiting screen asks for `soft`
// keys, a slim strip that stays dim until a note lands on it, and no labels:
// there the keys are a target, not the subject, and the note's name belongs
// to the beat's own reveal, which waits for a settled note.

import { createEffect, onCleanup, onMount } from 'solid-js'
import { createDprWatcher, syncCanvasBacking } from '@/lib/canvas-size-sync'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { KeyRect } from './keyboard-strip'
import { layoutKeys, pitchToX } from './keyboard-strip'
import type { MicCheckLive } from './live-analysis'
import styles from './MicCheckStage.module.css'
import { createNoteRain, emitNote, stepNoteRain } from './note-rain'
import type { HeldNote } from './note-tracker'
import type { StageInk } from './stage-paint'
import { DARK_STAGE_INK, drawKeys, drawRainNote, drawSparks, KEY_FLASH_S, LIGHT_STAGE_INK, SOFT_DARK_STAGE_INK, SOFT_LIGHT_STAGE_INK, } from './stage-paint'
import type { RibbonGeometry, RibbonLevels } from './voice-ribbon'
import { createRibbonMotion, DARK_STAGE_RIBBON, drawRibbon, LIGHT_STAGE_RIBBON, stepRibbonMotion, } from './voice-ribbon'

/** While a note is held, one more glyph leaves the ribbon this often. */
const HOLD_EMIT_MS = 150
/** Clear space a thrown note keeps from the top of the stage, px. */
const STAGE_MARGIN = 6
/** Phase the ribbon keeps under reduced motion: a still, readable shape. */
const STILL_PHASE = 1.8
const SILENCE: RibbonLevels = { rms: 0, peak: 0, low: 0, mid: 0, high: 0 }

export type StageKeys = 'piano' | 'soft'

export interface MicCheckStageProps {
  live: MicCheckLive
  /** True while the check is listening; the stage settles to rest otherwise. */
  listening: boolean
  /** The key strip: full height with the octaves named (the default), or a
   *  slim strip that stays dim until a note lands. Read once, at mount. */
  keys?: StageKeys
  /** Name the note beside the glyph that marks its onset. Default on.
   *  Read once, at mount. */
  labels?: boolean
}

interface StageLayout extends RibbonGeometry {
  keyTop: number
  keyHeight: number
}

/** Where everything sits on a stage of this size, in CSS px. */
function layoutStage(
  width: number,
  height: number,
  keys: StageKeys,
): StageLayout {
  const keyHeight =
    keys === 'soft'
      ? Math.min(18, Math.max(12, height * 0.09))
      : Math.min(44, Math.max(26, height * 0.17))
  const keyTop = height - keyHeight
  return {
    keyTop,
    keyHeight,
    centreX: width / 2,
    centreY: keyTop * 0.52,
    halfWidth: width * 0.46,
    maxAmplitude: Math.min(width * 0.14, keyTop * 0.36),
  }
}

/** Where a held note sits along the ribbon, -1..1, or null when none is. */
function focusOf(
  held: HeldNote | null,
  layout: StageLayout,
  keys: readonly KeyRect[],
): number | null {
  if (held === null) return null
  const x = pitchToX(held.midi + held.cents / 100, keys)
  return (x - layout.centreX) / layout.halfWidth
}

/** Relative luminance of a computed `rgb()` colour, or null if unreadable. */
function luminance(colour: string): number | null {
  const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(colour)
  if (match === null) return null
  const [r, g, b] = [match[1], match[2], match[3]].map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function MicCheckStage(props: MicCheckStageProps) {
  let canvas: HTMLCanvasElement | undefined
  let wake = (): void => undefined

  onMount(() => {
    const element = canvas
    const ctx = element?.getContext('2d')
    if (element === undefined || ctx === null || ctx === undefined) return

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const keyStyle: StageKeys = props.keys ?? 'piano'
    const labelled = props.labels !== false
    const motion = createRibbonMotion()
    const rain = createNoteRain()
    const flashes = new Map<number, number>()
    let keys: KeyRect[] = []
    let width = 0
    let height = 0
    let dark = true
    let frameCount = 0
    let lastAt = 0
    let lastEmitAt = 0
    let seenOnsets = props.live.onsets
    let frameId = 0

    const dpr = (): number => Math.min(window.devicePixelRatio || 1, 2)

    const measure = (): void => {
      syncCanvasBacking(element, dpr())
      const rect = element.getBoundingClientRect()
      width = rect.width
      height = rect.height
      keys = layoutKeys(width)
    }

    // The stage's own background decides the palette, so every theme gets
    // the blend that suits it without a list of theme names here.
    const readTheme = (): void => {
      const host = element.parentElement ?? element
      const value = luminance(window.getComputedStyle(host).backgroundColor)
      if (value !== null) dark = value < 0.45
    }

    /** While a note is held, throw a glyph on its onset and every so often after. */
    const throwNotes = (
      held: HeldNote,
      layout: StageLayout,
      now: number,
    ): void => {
      const onset = props.live.onsets !== seenOnsets
      if (!onset && now - lastEmitAt < HOLD_EMIT_MS) return
      lastEmitAt = now
      emitNote(rain, {
        x: pitchToX(held.midi + held.cents / 100, keys),
        y:
          layout.centreY -
          layout.maxAmplitude * Math.pow(motion.energy, 0.8) * 0.6,
        targetX: pitchToX(held.midi, keys),
        floorY: layout.keyTop,
        ceilingY: STAGE_MARGIN,
        midi: held.midi,
        level: motion.energy,
        label: onset && labelled ? midiToNoteName(held.midi) : null,
        random: Math.random,
      })
    }

    /** Fly the notes, light the keys they land on, and fade what was lit. */
    const advanceRain = (dt: number, layout: StageLayout): void => {
      for (const landing of stepNoteRain(
        rain,
        dt,
        layout.keyTop,
        Math.random,
      )) {
        flashes.set(landing.midi, 1)
      }
      for (const [midi, glow] of flashes) {
        const left = glow - dt / KEY_FLASH_S
        if (left <= 0) flashes.delete(midi)
        else flashes.set(midi, left)
      }
    }

    const inkFor = (): StageInk => {
      if (keyStyle === 'soft') {
        return dark ? SOFT_DARK_STAGE_INK : SOFT_LIGHT_STAGE_INK
      }
      return dark ? DARK_STAGE_INK : LIGHT_STAGE_INK
    }

    const paint = (layout: StageLayout, heldMidi: number | null): void => {
      const scale = dpr()
      const ink = inkFor()
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, width, height)
      drawRibbon(
        ctx,
        motion,
        layout,
        dark ? DARK_STAGE_RIBBON : LIGHT_STAGE_RIBBON,
      )
      for (const note of rain.notes) drawRainNote(ctx, note, ink)
      const light = { held: heldMidi, flashes }
      drawKeys(ctx, keys, layout.keyTop, layout.keyHeight, light, ink, {
        octaveNames: keyStyle === 'piano',
      })
      drawSparks(ctx, rain.sparks)
    }

    const settled = (listening: boolean): boolean =>
      !listening &&
      motion.energy < 0.001 &&
      motion.leanWeight < 0.01 &&
      rain.notes.length === 0 &&
      rain.sparks.length === 0 &&
      flashes.size === 0

    const draw = (now: number): void => {
      frameId = 0
      const dt = lastAt === 0 ? 1 / 60 : Math.min(0.05, (now - lastAt) / 1000)
      lastAt = now
      if (frameCount++ % 60 === 0) readTheme()
      if (width <= 0 || height <= 0) return

      const live = props.live
      const listening = props.listening && live.active
      const held = listening ? live.note : null
      const layout = layoutStage(width, height, keyStyle)
      stepRibbonMotion(
        motion,
        listening ? live : SILENCE,
        dt,
        focusOf(held, layout, keys),
      )
      if (reduceMotion) motion.phase = STILL_PHASE
      if (held !== null && !reduceMotion) throwNotes(held, layout, now)
      seenOnsets = live.onsets
      advanceRain(dt, layout)
      paint(layout, held?.midi ?? null)

      if (settled(listening)) {
        lastAt = 0
        return
      }
      frameId = requestAnimationFrame(draw)
    }

    wake = (): void => {
      if (frameId === 0) frameId = requestAnimationFrame(draw)
    }

    measure()
    readTheme()
    const observer = new ResizeObserver(() => {
      measure()
      wake()
    })
    observer.observe(element)
    const dprWatcher = createDprWatcher(() => {
      measure()
      wake()
    })
    wake()

    onCleanup(() => {
      if (frameId !== 0) cancelAnimationFrame(frameId)
      frameId = 0
      observer.disconnect()
      dprWatcher.dispose()
      wake = () => undefined
    })
  })

  createEffect(() => {
    if (props.listening) wake()
  })

  return <canvas ref={canvas} class={styles.canvas} aria-hidden="true" />
}
