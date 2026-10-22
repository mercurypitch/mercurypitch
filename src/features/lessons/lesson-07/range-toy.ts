// ============================================================
// Lesson 7 range toy — the steps' chart in its five states, and free play's
// ============================================================
//
// One range chart (kit/range-chart.ts) under its own rows of controls, in
// the state a step asks for (WEB-SPEC, Toys 1): Merc's siren sweeping the
// column, with Play (Pause while playing), Slow and a scrub bar; the same
// siren in three sounds; "Twinkle" on the column, with Start lower and
// Start higher (and, with a mouse or pen, a vertical drag); the push note
// and its gauge, with Lower and Higher held to repeat and a handle to drag;
// and Step 5's two singers and the six bands. Free play mounts the same toy
// with every state under one switch. Each state keeps its settings for the
// visit (the sound, the slide, the note, the singer), and the voice switch,
// shown in the four states that use a voice, changes the chart's voice for
// the visit and stores nothing.
//
// Every sound is the page's one sound (kit/now-playing.ts): a new press
// anywhere stops the last, and leaving the step stops the toy (steps.ts).
// The canvas is a picture: its words are the readout under it, and a
// polite live line in spoken names, written only when its words change.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { RangeLine } from '@/features/lessons/kit/range-chart'
import { mountRangeChart, RANGE_COLOR, } from '@/features/lessons/kit/range-chart'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { SirenSound } from '@/features/lessons/kit/timbre'
import { TIMBRES } from '@/features/lessons/kit/timbre'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindHoldRepeat } from './hold-repeat'
import type { Run } from './play'
import { playLine, playNote, playNotes } from './play'
import type { ChartVoice, SingerId, VoiceBand } from './range-data'
import { bandLabel, bandMiddle, BANDS, bandSpan, columnOf, pushFill, pushReadout, SINGERS, SIREN_SEC, SIREN_UP, sirenAt, sirenContourFrom, sirenEnds, sirenLine, sirenWhere, slideBounds, slideReadout, twinkle, TWINKLE_SEC, twinkleDo, TYPES_WINDOW, WINDOWS, } from './range-data'
import { singerLines, sirenSaid, sirenShown, songSaid, typesSaid, typesShown, } from './range-words'

export type RangeState = 'siren' | 'sounds' | 'song' | 'push' | 'types'

export const RANGE_STATES: readonly RangeState[] = [
  'siren',
  'sounds',
  'song',
  'push',
  'types',
]

/** Merc's "ooh" on the push note: one fixed, quiet level, since the gauge draws what the note needs. */
export const PUSH_GAIN = 0.1
/** A band's middle note, in the soft tone, seconds. */
export const BAND_SEC = 1
/** The push note goes quiet this long after its last move, ms. */
const PUSH_LINGER_MS = 600
/** The scrub bar's arrow keys move this far, seconds; Page Up and Page Down a second. */
const SCRUB_STEP = 0.1

export interface RangeToyOptions {
  /** When the chart draws: the deck's `toyActive(1)`, or free play's own watch. */
  readonly active: () => boolean
}

export interface RangeToy {
  readonly state: RangeState
  setState(s: RangeState): void
  /** Stops what the toy is sounding, and the drawing that goes with it. */
  stop(): void
  /** Step 5's Singer A, Singer B and Show all six, which its predict unlocks. */
  readonly typeControls: readonly HTMLButtonElement[]
}

/** What a sound in flight is. */
type RunKind = 'siren' | 'song' | 'band' | 'push'

export function mountRangeToy(
  root: HTMLElement,
  opts: RangeToyOptions,
): RangeToy {
  const viz = q('[data-range-viz]', root)
  const chart = mountRangeChart(viz, {
    window: WINDOWS.lower,
    active: opts.active,
  })
  const said = q('[data-range-said]', root)
  const readout = q('[data-range-readout]', root)
  const parts = qa('[data-part]', root)
  const gauge = q('[data-push-gauge]', root)
  const fill = q('[data-push-fill]', root)
  const handle = q('[data-push-handle]', root)
  const scrub = q('[data-siren-scrub]', root)
  const playBtn = q<HTMLButtonElement>('[data-siren-play]', root)
  const slowBtn = q<HTMLButtonElement>('[data-siren-slow]', root)
  const songBtn = q<HTMLButtonElement>('[data-song-play]', root)
  const slides = qa<HTMLButtonElement>('[data-slide]', root)
  const bandGrid = q('[data-band-grid]', root)
  const singerBtns = qa<HTMLButtonElement>('[data-singer]', root)
  const allBtn = q<HTMLButtonElement>('[data-show-types]', root)

  let state: RangeState = 'siren'
  let voice: ChartVoice = VoiceChoice.voice ?? 'lower'
  let sound: SirenSound = 'ng'
  let slow = false
  // where the siren's drawn line stands, seconds of its 6
  let sirenT = 0
  // under reduced motion a playing siren is drawn whole, its glow resting at the turn
  let restAtTurn = false
  // "Twinkle": semitones from where Merc sang it; the bead sounding
  let move = 0
  let litBead: number | null = null
  // the push note: semitones above the column's bottom
  let push = 0
  let singer: SingerId | null = null
  let all = false
  let bandOn: VoiceBand | null = null
  let run: Run | null = null
  let kind: RunKind | null = null
  let pushVoice: Voice | null = null
  let pushTimer = 0
  // a press of Lower or Higher asks once whether it may sound, not on every repeat
  let pushAudible: boolean | null = null
  // the live line speaks for what the viewer did, not for the page loading
  let speaking = false

  const which = () => mercOf(voice)
  const doNow = (): number => twinkleDo(voice) + move
  const pushMidi = (): number => columnOf(voice).lo + push

  function say(text: string): void {
    if (speaking && said.textContent !== text) said.textContent = text
  }

  function show(html: string): void {
    if (readout.innerHTML !== html) readout.innerHTML = html
    readout.hidden = html === ''
  }

  // ------------------------------------------------------------ the scene

  function sirenLines(): RangeLine[] {
    // Merc's whole siren before it plays: the mark each figure exists to
    // show. At 0.22 it read at 1.6:1 on the chart; 0.6 is 3.5:1 (WCAG
    // 1.4.11), and playback still draws the bright line and glow over it.
    const ghost: RangeLine = {
      points: sirenLine(voice),
      color: RANGE_COLOR.target,
      alpha: 0.6,
    }
    if (sirenT <= 0) return [ghost]
    const playing = kind === 'siren'
    const headT = restAtTurn ? SIREN_UP + 0.2 : sirenT
    return [
      ghost,
      {
        points: sirenLine(voice, sirenT),
        color: RANGE_COLOR.target,
        head: {
          t: headT,
          midi: sirenAt(voice, headT),
          glow: playing ? 1 : 0.45,
        },
      },
    ]
  }

  /** Step 5's view: the six bands, or the two singers' bar, and no column. */
  function drawTypes(): void {
    const s = chart.scene
    chart.setWindow(TYPES_WINDOW)
    chart.setForm('none')
    s.column = null
    s.lines = []
    s.beads = []
    s.note = null
    s.bands = all
      ? BANDS.map((b) => ({
          lo: b.lo,
          hi: b.hi,
          name: b.name,
          span: bandSpan(b),
          on: b.id === bandOn?.id,
        }))
      : []
    const shared = SINGERS.a
    s.bar = all
      ? null
      : {
          lo: shared.lo,
          hi: shared.hi,
          lit: singer === null ? null : SINGERS[singer].lit,
          lines: singerLines(singer),
        }
  }

  /** Every other state's view: the voice's column, and the siren, the tune or the note. */
  function drawColumnState(): void {
    const s = chart.scene
    const col = columnOf(voice)
    chart.setWindow(WINDOWS[voice])
    chart.setForm('bar')
    s.column = { lo: col.lo, hi: col.hi, lit: col.lit }
    s.bands = []
    s.bar = null
    s.lines = state === 'siren' || state === 'sounds' ? sirenLines() : []
    s.beads =
      state === 'song'
        ? twinkle(doNow()).map((n, i) => ({
            t: n.t,
            midi: n.midi,
            lit: i === litBead,
          }))
        : []
    s.note = state === 'push' ? pushMidi() : null
    chart.setSeconds(state === 'song' ? TWINKLE_SEC : SIREN_SEC)
  }

  function draw(): void {
    if (state === 'types') drawTypes()
    else drawColumnState()
    chart.changed()
    if (state === 'push') placePush()
  }

  /** The words for the state as it stands: the readout, and the live line. */
  function describe(): void {
    if (state === 'siren' || state === 'sounds') {
      const on = state === 'sounds' ? sound : null
      show(sirenShown(voice, on))
      say(sirenSaid(voice, on))
    } else if (state === 'song') {
      show(slideReadout(voice, doNow()))
      say(songSaid(voice, doNow()))
    } else if (state === 'push') {
      const r = pushReadout(voice, pushMidi())
      show(r.html)
      say(r.spoken)
    } else {
      show(all ? '' : typesShown(singer))
      say(typesSaid({ singer, all, band: bandOn }))
    }
  }

  // ------------------------------------------------------------ stopping

  /** Stops whatever sounds, where it stands: its drawing, its button and its Merc. */
  function stop(): void {
    if (run === null && pushVoice === null && kind === null) return
    const was = kind
    run?.stop()
    run = null
    kind = null
    chart.animate(null)
    window.clearTimeout(pushTimer)
    pushVoice?.stop(0.1)
    pushVoice = null
    pushAudible = null
    restAtTurn = false
    litBead = null
    bandOn = null
    playWord(false)
    songBtn.classList.remove('is-on')
    for (const b of qa<HTMLButtonElement>('[data-band]', bandGrid))
      b.classList.remove('is-on')
    mercSing('blue', 57, false)
    mercSing('orange', 69, false)
    NowPlaying.release(stop)
    if (was !== null) draw()
  }

  /** Takes the page's one sound for this toy: whatever else sounds stops. */
  function claim(next: RunKind, r: Run | null): void {
    stop()
    NowPlaying.claim(stop)
    kind = next
    run = r
  }

  /** A run that ended by itself: the toy rests. */
  function ended(r: Run): void {
    if (run !== r) return
    run = null
    stop()
  }

  // ------------------------------------------------------------ the siren

  function playWord(playing: boolean): void {
    q('use', playBtn).setAttribute('href', playing ? '#i-pause' : '#i-play')
    q('[data-play-word]', playBtn).textContent = playing ? 'Pause' : 'Play'
    playBtn.classList.toggle('is-on', playing)
  }

  /**
   * The scrub bar follows the line: its thumb, and its value and words when
   * they change. The words name the voice's note, so a voice switch changes
   * them at the same moment.
   */
  function syncScrub(): void {
    scrub.style.setProperty('--u', String(sirenT / SIREN_SEC))
    const now = sirenT.toFixed(1)
    if (scrub.getAttribute('aria-valuenow') !== now)
      scrub.setAttribute('aria-valuenow', now)
    const where = sirenWhere(voice, sirenT)
    if (scrub.getAttribute('aria-valuetext') !== where)
      scrub.setAttribute('aria-valuetext', where)
  }

  function playSiren(): void {
    if (kind === 'siren') {
      // Pause: the line stays where it stands, and Play carries on from there
      stop()
      return
    }
    const from = sirenT >= SIREN_SEC - 0.05 ? 0 : sirenT
    const speed = slow ? 0.5 : 1
    const audible = Sound.canPlay()
    const r = playLine(sirenContourFrom(voice, from, speed), {
      audible,
      timbre: TIMBRES[state === 'sounds' ? sound : 'ng'],
    })
    claim('siren', r)
    playWord(true)
    mercSing(which(), sirenEnds(voice).low, true)
    if (reducedMotion()) {
      sirenT = SIREN_SEC
      restAtTurn = true
      draw()
      syncScrub()
    } else {
      const t0 = performance.now()
      chart.animate((now) => {
        if (run !== r) return false
        sirenT = Math.min(SIREN_SEC, from + ((now - t0) / 1000) * speed)
        chart.scene.lines = sirenLines()
        syncScrub()
        return sirenT < SIREN_SEC
      })
    }
    void r.done.then((heard) => {
      if (!heard || run !== r) return
      sirenT = SIREN_SEC
      ended(r)
      syncScrub()
    })
  }

  /** The scrub bar: the line drawn to that moment, without sound. */
  function scrubTo(t: number): void {
    if (kind === 'siren') stop()
    sirenT = clamp(t, 0, SIREN_SEC)
    chart.scene.lines = sirenLines()
    chart.changed()
    syncScrub()
  }

  scrub.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = {
      ArrowRight: SCRUB_STEP,
      ArrowUp: SCRUB_STEP,
      ArrowLeft: -SCRUB_STEP,
      ArrowDown: -SCRUB_STEP,
      PageUp: 1,
      PageDown: -1,
    }
    if (e.key === 'Home') scrubTo(0)
    else if (e.key === 'End') scrubTo(SIREN_SEC)
    else if (e.key in steps)
      scrubTo(Math.round((sirenT + steps[e.key]) * 10) / 10)
    else return
    e.preventDefault()
  })
  const scrubAt = (e: PointerEvent): void => {
    const track = q('.scrub-track', scrub).getBoundingClientRect()
    const u = clamp((e.clientX - track.left) / Math.max(1, track.width), 0, 1)
    scrubTo(Math.round(u * SIREN_SEC * 10) / 10)
  }
  scrub.addEventListener('pointerdown', (e) => {
    scrub.setPointerCapture(e.pointerId)
    scrubAt(e)
  })
  scrub.addEventListener('pointermove', (e) => {
    if (scrub.hasPointerCapture(e.pointerId)) scrubAt(e)
  })

  playBtn.addEventListener('click', playSiren)
  slowBtn.addEventListener('click', () => {
    slow = !slow
    slowBtn.setAttribute('aria-pressed', String(slow))
    if (kind === 'siren') {
      // the new speed from where the line stands
      stop()
      playSiren()
    }
  })
  for (const b of qa<HTMLButtonElement>('[data-sound]', root))
    b.addEventListener('click', () => {
      const s = b.dataset.sound
      if (s !== 'ng' && s !== 'trill' && s !== 'oo') return
      sound = s
      for (const o of qa('[data-sound]', root))
        o.setAttribute('aria-pressed', String(o === b))
      stop()
      describe()
    })

  // ------------------------------------------------------------ "Twinkle"

  function slideTo(next: number): void {
    const { min, max } = slideBounds(voice)
    const d = clamp(next, min, max)
    if (kind === 'song') stop()
    move = d - twinkleDo(voice)
    for (const b of slides) {
      const up = Number(b.dataset.slide) > 0
      b.disabled = up ? d >= max : d <= min
    }
    draw()
    describe()
  }

  function playSong(): void {
    const audible = Sound.canPlay()
    const notes = twinkle(doNow())
    const who = which()
    const r = playNotes(notes, {
      audible,
      onNote: (n, i) => {
        if (run !== r) return
        litBead = i
        mercSing(who, n.midi, true)
        draw()
      },
    })
    claim('song', r)
    songBtn.classList.add('is-on')
    void r.done.then((heard) => {
      if (heard) ended(r)
    })
  }

  for (const b of slides)
    b.addEventListener('click', () =>
      slideTo(doNow() + Number(b.dataset.slide)),
    )
  songBtn.addEventListener('click', playSong)
  // with a mouse or pen a vertical drag slides the tune; on touch the stage scrolls
  let dragFrom: { midi: number; doMidi: number } | null = null
  viz.addEventListener('pointerdown', (e) => {
    if (state !== 'song' || e.pointerType === 'touch') return
    viz.setPointerCapture(e.pointerId)
    dragFrom = { midi: chart.midiAt(e.clientY), doMidi: doNow() }
  })
  viz.addEventListener('pointermove', (e) => {
    if (dragFrom === null || !viz.hasPointerCapture(e.pointerId)) return
    const d = Math.round(chart.midiAt(e.clientY) - dragFrom.midi)
    if (dragFrom.doMidi + d !== doNow()) slideTo(dragFrom.doMidi + d)
  })
  const dragEnd = (): void => {
    dragFrom = null
  }
  viz.addEventListener('pointerup', dragEnd)
  viz.addEventListener('pointercancel', dragEnd)

  // ------------------------------------------------------------ the push gauge

  /** The handle over the note, the gauge's fill, and the slider's words. */
  function placePush(): void {
    const midi = pushMidi()
    const col = columnOf(voice)
    fill.style.width = `${(pushFill(push) * 100).toFixed(1)}%`
    handle.setAttribute('aria-valuemin', String(col.lo))
    handle.setAttribute('aria-valuemax', String(col.hi))
    handle.setAttribute('aria-valuenow', String(midi))
    handle.setAttribute('aria-valuetext', pushReadout(voice, midi).spoken)
    if (chart.canvas.clientWidth === 0) return
    const p = chart.pointOf(midi)
    handle.style.left = `${(p.x - 22).toFixed(1)}px`
    handle.style.top = `${(p.y - 22).toFixed(1)}px`
  }

  /** Merc's "ooh" on the note as it moves, quiet again once it rests. */
  function soundPush(): void {
    const f = hz(pushMidi())
    if (kind !== 'push') {
      claim('push', null)
      pushAudible = Sound.canPlay()
    }
    if (pushVoice?.alive === true) pushVoice.setFreq(f, 0.02)
    else if (pushAudible === true)
      pushVoice = Sound.voice(f, { kind: 'merc', gain: PUSH_GAIN })
    mercSing(which(), pushMidi(), true)
    window.clearTimeout(pushTimer)
    pushTimer = window.setTimeout(stop, PUSH_LINGER_MS)
  }

  /** The note a semitone a tap; false at the column's end, so a held press stops. */
  function pushBy(d: number): boolean {
    const next = clamp(push + d, 0, 24)
    if (next === push) return false
    push = next
    soundPush()
    draw()
    describe()
    return d > 0 ? push < 24 : push > 0
  }

  for (const b of qa<HTMLButtonElement>('[data-push]', root))
    bindHoldRepeat(b, () => pushBy(Number(b.dataset.push)))
  handle.addEventListener('keydown', (e) => {
    const to: Record<string, number> = {
      ArrowUp: push + 1,
      ArrowRight: push + 1,
      ArrowDown: push - 1,
      ArrowLeft: push - 1,
      PageUp: push + 3,
      PageDown: push - 3,
      Home: 0,
      End: 24,
    }
    if (!(e.key in to)) return
    e.preventDefault()
    pushBy(clamp(to[e.key], 0, 24) - push)
  })
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId)
    e.preventDefault()
  })
  handle.addEventListener('pointermove', (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return
    const s = Math.round(chart.midiAt(e.clientY)) - columnOf(voice).lo
    const next = clamp(s, 0, 24)
    if (next !== push) pushBy(next - push)
  })
  new ResizeObserver(() => {
    if (state === 'push') placePush()
  }).observe(viz)

  // ------------------------------------------------------------ the voice types

  function pickSinger(id: SingerId): void {
    singer = id
    all = false
    stop()
    for (const b of singerBtns)
      b.setAttribute('aria-pressed', String(b.dataset.singer === id))
    allBtn.setAttribute('aria-pressed', 'false')
    bandGrid.hidden = true
    draw()
    describe()
  }

  function showAll(): void {
    all = !all
    stop()
    allBtn.setAttribute('aria-pressed', String(all))
    for (const b of singerBtns)
      b.setAttribute(
        'aria-pressed',
        String(!all && b.dataset.singer === singer),
      )
    bandGrid.hidden = !all
    draw()
    describe()
  }

  function playBand(b: VoiceBand, button: HTMLButtonElement): void {
    const r = playNote(bandMiddle(b), BAND_SEC, {
      audible: Sound.canPlay(),
      kind: 'soft',
    })
    claim('band', r)
    bandOn = b
    button.classList.add('is-on')
    draw()
    describe()
    void r.done.then((heard) => {
      if (heard) ended(r)
    })
  }

  for (const b of singerBtns)
    b.addEventListener('click', () => {
      const id = b.dataset.singer
      if (id === 'a' || id === 'b') pickSinger(id)
    })
  allBtn.addEventListener('click', showAll)
  for (const b of qa<HTMLButtonElement>('[data-band]', bandGrid)) {
    const band = BANDS.find((x) => x.id === b.dataset.band)
    if (band === undefined) continue
    b.setAttribute('aria-label', bandLabel(band))
    b.addEventListener('click', () => playBand(band, b))
  }

  // ------------------------------------------------------------ the voice switch

  const voiceBtns = qa<HTMLButtonElement>('[data-chart-voice]', root)

  function setVoice(v: ChartVoice): void {
    stop()
    voice = v
    for (const b of voiceBtns)
      b.setAttribute('aria-pressed', String(b.dataset.chartVoice === v))
    // the slide keeps its move and the note its place on the column
    slideTo(twinkleDo(v) + move)
    syncScrub()
    draw()
    describe()
  }
  for (const b of voiceBtns)
    b.addEventListener('click', () => {
      const v = b.dataset.chartVoice
      if (v === 'lower' || v === 'higher') setVoice(v)
    })

  // ------------------------------------------------------------ the state

  function setState(s: RangeState): void {
    if (s !== state) {
      stop()
      // the last state's words go, and the new state speaks at the next press
      said.textContent = ''
    }
    state = s
    root.dataset.state = s
    for (const el of parts)
      el.hidden = !(el.dataset.part ?? '').split(' ').includes(s)
    bandGrid.hidden = !(s === 'types' && all)
    gauge.hidden = s !== 'push'
    handle.hidden = s !== 'push'
    draw()
    describe()
  }

  for (const b of qa<HTMLButtonElement>('[data-free-state]', root))
    b.addEventListener('click', () => {
      const s = RANGE_STATES.find((x) => x === b.dataset.freeState)
      if (s === undefined) return
      speaking = true
      for (const o of qa('[data-free-state]', root))
        o.setAttribute('aria-pressed', String(o === b))
      setState(s)
    })
  // from the viewer's first press on, the live line speaks
  root.addEventListener(
    'click',
    () => {
      speaking = true
    },
    { capture: true },
  )
  root.addEventListener(
    'keydown',
    () => {
      speaking = true
    },
    { capture: true },
  )

  for (const b of voiceBtns)
    b.setAttribute('aria-pressed', String(b.dataset.chartVoice === voice))
  slideTo(twinkleDo(voice))
  setState('siren')
  syncScrub()

  return {
    get state() {
      return state
    },
    setState,
    stop,
    typeControls: [...singerBtns, allBtn],
  }
}
