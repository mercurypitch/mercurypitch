// ============================================================
// Hold Sing it — one comfortable note, held once or twice
// ============================================================
//
// The held-note checkpoint, Lesson 5's Sing it moved into the kit with
// options (Lesson 5 WEB-SPEC, Toys 6; Lesson 22 WEB-SPEC, Toys 6 and What
// the kit and the app still need, item 7), under the Guided Voice Check's
// safety rules (docs/specs/guided-voice-check.ears.md), as Lesson 3's is:
// the comfort check first on every visit and never stored (REQ-GVC-020,
// 021); "Just listen today" opens a listening mode in which Merc holds the
// note for the seconds a button names, on a tap, and nothing listens, with
// the rest line and the doctor lines. Singing goes on to the voice choice
// (if none is stored), the optional warm-up, which never listens
// (REQ-GVC-074, 075), the note, which Lower and Higher move a semitone a
// tap, up to four either way, for the visit (Lesson 5 FACTS 55), and the
// briefing, whose Start is the only control that asks for the microphone.
//
// Each take is one hold, on Merc's model note (`holdOne`). The page's plan
// gives the holds' lengths, a second only after an "Easy" or "Workable"
// first hold and a rest the singer ends, and whether "Effortful" picks the
// rest card (`HoldSingPlan`). "How did that feel?" follows every take that
// heard a voice (REQ-GVC-022), and only its answer offers more singing: the
// flow is the kit's pure rule (hold-flow.ts), so this file draws what that
// rule says. The microphone is held only around a take: acquired on the
// tap that starts one, released when it ends, when the viewer leaves the
// section, when the tab is hidden and when the page goes. If it is
// refused, missing, or the listener fails to load, the page carries on in
// listening mode with "No microphone? ..." Nothing is recorded, kept or
// sent: a take's frames are read and dropped (REQ-GVC-003, 004), and only
// the voice choice and the warm-up's Skip are stored. The checkpoint's
// ending picks the Wrap's card for the visit (comfort.ts `VisitEnding`),
// in memory only. A page may add to it through its plan: a painter over
// the chart, a word before Start asks for anything, word of a take's
// window opening and closing, and a turn after each reading (Lesson 22's
// sound-off hint, its other plays held during a take, and the line's
// middle and vibrato line).

import type { BandChartOptions } from './band-chart'
import type { Feeling } from './comfort'
import { mountComfort, mountFeelings, VisitEnding } from './comfort'
import { clamp, q, qa, store, wait } from './dom'
import type { FlowStep, HoldNo, HoldPlan, HoldRecord } from './hold-flow'
import { afterFeeling, afterTake, againAllowed, emptyRecord, withCelebration, withTake, } from './hold-flow'
import type { HoldContext as RunContext, HoldModule, ListenModule, } from './hold-run'
import { holdOne as runHold } from './hold-run'
import type { AfterLines, HoldPhase, HoldSingView } from './hold-sing-view'
import { createHoldSingView } from './hold-sing-view'
import type { HoldReading } from './hold-take'
import type { Listener } from './listen'
import type { Which } from './merc-duo'
import { mercCelebrate, mercListen, mercSing } from './merc-duo'
import { hz, nameHtml, sharpOf, signName, wordName } from './notes'
import type { RingStills } from './sing'
import type { Voice as Note } from './sound'
import { playContour, playTone, Sound } from './sound'
import type { Voice } from './voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice } from './voice-choice'
import { warmUpContour } from './warm-up'

export type { HoldModule, ListenModule } from './hold-run'

/** A page's held-note checkpoint: who it is, its holds, and how it reads and shows them. */
export interface HoldSingPlan {
  /** The page's consumer id with the app's microphone owner: "lesson-05". */
  readonly consumer: string
  /** The warm-up's Skip, remembered under this key so a return visit opens it folded. */
  readonly warmupKey: string
  /** The holds' lengths, one or two, and whether "Effortful" picks the rest card. */
  readonly holds: HoldPlan
  /** Each hold's name, for its head and its status lines: "Hold 1: ten seconds". */
  readonly heads: Readonly<Record<HoldNo, string>>
  /** The second hold's button in the markup, its `data-sing`: "hold15" on Lesson 5's card. */
  readonly nextHold: string
  /** The hold reader, loaded with the listener after Start: the kit's hold-take.ts unless a page gives its own. */
  readonly reader?: () => Promise<HoldModule>
  /** Whether a take lights the band's edge, glows and names the band state as it runs: on unless a page turns it off. */
  readonly liveBand?: boolean
  /** What the summary says was in the band: "your line" unless a page says otherwise. */
  readonly subject?: string
  /** A painter over the hold chart's plot: band-chart-wave.ts's `paintWave` where a page draws the line's middle (Lesson 22). */
  readonly paintOver?: BandChartOptions['paintOver']
  /** Asked as Start is pressed: false and Start asks for nothing and plays nothing (Lesson 22, sound off). */
  readonly mayStart?: () => boolean
  /** A take's window opening, from Start or Again, and closing as the take ends: Lesson 22 holds the page's other plays meanwhile. */
  readonly onTake?: (open: boolean) => void
  /** After a take's reading is shown: Lesson 22 draws the line's middle and says its vibrato. */
  readonly onReading?: (reading: HoldReading, view: HoldSingView) => void
}

/** Semitones Lower and Higher may move the note either way (Lesson 5 FACTS 55). */
export const MAX_MOVE = 4
/** Seconds of the note each Lower or Higher tap plays (Lesson 5 FACTS 77). */
const TAP_SEC = 1
/** Seconds of Merc's model note, each take's Listen phase. */
export const MERC_SEC = 2

/** Every status line the checkpoint says, beside the reader's own. */
export const STATUS = {
  listen: 'Just listening today: the microphone stays off.',
  nomic:
    'No microphone? Sing along anyway: Merc sings the note first, and nothing listens.',
  voice: "Choose the voice you'll sing with.",
  prepare: 'Warm up if you like, then press Start.',
  asking: 'Asking your browser for the microphone.',
  stopped: 'Stopped listening: the microphone is off.',
  feel: 'How did that feel?',
  breathe: 'Breathe in, low and quiet.',
  sing: 'Sing, and hold the note until the ring closes.',
  rest: 'Rest for a few easy breaths. Ready when you are.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  done: 'Done for today.',
} as const

/** The note the holds are sung on: the voice's A, moved `move` semitones. */
export const holdNote = (v: Voice, move: number): number =>
  homeOf(v) + clamp(move, -MAX_MOVE, MAX_MOVE)

/** The ring's label and the note's readout: "A3 · 220 Hz", its sign spoken. */
export const ringLabel = (midi: number): string =>
  `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`

/** The status line as a hold's phase begins: "Hold 1: ten seconds, on A3. Listen to Merc's note." */
export function phaseStatus(head: string, name: string, p: HoldPhase): string {
  if (p === 'listen') return `${head}, on ${name}. Listen to Merc's note.`
  return p === 'breathe' ? STATUS.breathe : STATUS.sing
}

/** The status line after an answer to "How did that feel?". */
export function stepStatus(step: FlowStep, summary: string | null): string {
  if (step.next === 'rest') return STATUS.rest
  if (step.next === 'gentle') return STATUS.gentle
  if (step.next === 'enough') return STATUS.enough
  return summary ?? STATUS.feel
}

/** What the card shows after an answer: the flow's step, with the holds' readings together where it asks for them. */
export function afterLines(step: FlowStep, summary: string | null): AfterLines {
  const closing = step.next === 'end' ? null : step.next
  return {
    summary: step.summary ? summary : null,
    tricky: step.tricky,
    closing,
    doctor: step.doctor,
    nextHold: step.offers.nextHold,
    again: step.offers.again,
    done: step.offers.done,
  }
}

/** A run of holds on one note, this visit. */
interface Run {
  readonly which: Which
  readonly midi: number
  hold: HoldNo
  record: HoldRecord
  readonly readings: Record<HoldNo, HoldReading[]>
}

interface Modules {
  readonly listen: ListenModule
  readonly reader: HoldModule
}

/** The kit's hold reader, the default. */
const todaysReader = (): Promise<HoldModule> => import('./hold-take')

/** The microphone and the reader, held across the takes of a visit. */
class Mic {
  mods: Modules | null = null
  listener: Listener | null = null

  constructor(private readonly plan: HoldSingPlan) {}

  /** Loads the listener and holds the microphone, inside the tap that asked; false if either fails. */
  async open(context: AudioContext | null): Promise<boolean> {
    if (context === null) return false
    try {
      this.mods ??= await this.load()
      if (this.listener === null || !this.listener.holding)
        this.listener = await this.mods.listen.listen(
          this.plan.consumer,
          context,
        )
      return true
    } catch {
      return false
    }
  }

  private async load(): Promise<Modules> {
    const [listen, reader] = await Promise.all([
      import('./listen'),
      (this.plan.reader ?? todaysReader)(),
    ])
    return { listen, reader }
  }

  release(now = false): void {
    if (now) this.listener?.releaseNow()
    else this.listener?.release()
    this.listener = null
  }
}

/** One take on the card: the kit's hold run, with Merc's model note, 2.0 s of his usual "ooh", as its Listen phase. */
export function holdOne(
  c: Omit<RunContext, 'listen'>,
): Promise<HoldReading | null> {
  return runHold({
    ...c,
    listen: {
      sec: MERC_SEC,
      play: async (audible) => {
        await playTone(hz(c.midi), MERC_SEC, { kind: 'merc', audible })
        return true
      },
    },
  })
}

/** The chart's words after a hold: "Merc's note A3; your line in the band for 8.4 of 10 seconds, ...". */
export function holdSummaryFor(
  reader: HoldModule,
  midi: number,
  r: HoldReading,
): string {
  return reader.holdChartWords(wordName(sharpOf(midi)), r)
}

/** Mounts the checkpoint on the page's #singCard, with the page's plan. */
export function initHoldSing(stills: RingStills, plan: HoldSingPlan): void {
  const view: HoldSingView = createHoldSingView(stills, {
    nextHold: plan.nextHold,
    paintOver: plan.paintOver,
  })
  const card = q('#singCard')
  const warmup = q<HTMLDetailsElement>('#warmup')
  const mic = new Mic(plan)
  /** A hold's length, seconds. */
  const lengthOf = (hold: HoldNo): number =>
    plan.holds.lengths[hold - 1] ?? plan.holds.lengths[0]
  let run: Run | null = null
  let take: { cancelled: boolean } | null = null
  let mode: 'sing' | 'listen' | 'nomic' = 'sing'
  let move = 0
  let busyDemo = false
  let asking = false
  let tap: Note | null = null

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'

  // a take's window, from Start until the take ends, told to the page once each way
  let open = false
  const opening = (on: boolean): void => {
    if (on === open) return
    open = on
    plan.onTake?.(on)
  }

  function showListening(): void {
    const v = VoiceChoice.voice
    view.listenWhy(mode === 'nomic' ? 'nomic' : 'listen')
    view.show(
      v === null ? ['listen', 'voice'] : ['listen'],
      v === null ? null : 'listen',
    )
    view.chart.setTarget(holdNote(voiceNow(), mode === 'nomic' ? move : 0))
    view.chart.setWindow(lengthOf(1))
  }

  function toListening(why: 'listen' | 'nomic'): void {
    if (take !== null) take.cancelled = true
    take = null
    opening(false)
    mic.release()
    mode = why
    showListening()
    view.status(STATUS[why])
    view.focusText(q(`[data-listen-why="${why}"]`, card))
  }

  function toVoice(): void {
    view.show(['voice'], null)
    view.status(STATUS.voice)
    view.focusText(q('[data-panel="voice"]', card))
  }

  function showNote(): void {
    view.note(
      ringLabel(holdNote(voiceNow(), move)),
      move > -MAX_MOVE,
      move < MAX_MOVE,
    )
  }

  function toPrepare(): void {
    view.show(['prepare'], null)
    warmup.open = store.get<unknown>(plan.warmupKey, false) !== true
    showNote()
    view.status(STATUS.prepare)
    view.focusText(q('[data-panel="prepare"]', card))
  }

  /** Lower or Higher: a semitone a tap, the new note sung for a second. */
  function moveNote(d: -1 | 1, b: HTMLButtonElement): void {
    move = clamp(move + d, -MAX_MOVE, MAX_MOVE)
    showNote()
    const v = voiceNow()
    const midi = holdNote(v, move)
    tap?.stop(0.05)
    tap = Sound.canPlay()
      ? Sound.voice(hz(midi), { kind: 'merc', dur: TAP_SEC })
      : null
    mercSing(mercOf(v), midi, true)
    window.setTimeout(() => mercSing(mercOf(v), midi, false), TAP_SEC * 1000)
    // at the end of the range the button goes: keep the keyboard's place on the note
    if (b.hidden) view.focusText(view.noteEl)
  }

  function recordTake(r: Run, reading: HoldReading, reader: HoldModule): void {
    r.readings[r.hold].push(reading)
    r.record = withTake(r.record, r.hold, {
      kind: reading.kind,
      share: reading.share,
    })
    view.reading(reading.line, reading.octaveLine)
    plan.onReading?.(reading, view)
    view.chart.describe(holdSummaryFor(reader, r.midi, reading))
    view.chart.scene.marks =
      reading.settled === null ? [] : [{ t: reading.settled, label: 'settled' }]
    view.now('–')
    const said = `${plan.heads[r.hold]}. ${reading.line}${reading.octaveLine === null ? '' : ` ${reading.octaveLine}`}`
    const next = afterTake(r.hold, r.record)
    if (!next.ask) {
      // nothing was sung, so there is nothing to ask about: Again, or Done for today
      view.takeActions({ again: next.again })
      view.status(said)
    } else {
      view.show(['feel'], 'take')
      view.status(`${said} ${STATUS.feel}`)
    }
    view.focusText(view.readingEl)
  }

  async function takeHold(hold: HoldNo): Promise<void> {
    const r = run
    if (r === null || take !== null) return
    r.hold = hold
    feelings.reset()
    view.show([], 'take')
    view.reading(null, null)
    view.takeActions(null)
    view.chart.clear()
    view.holdHead(plan.heads[hold])
    view.focusText(view.headEl)
    const me = { cancelled: false }
    take = me
    opening(true)
    const ok = await mic.open(Sound.context())
    const { mods, listener } = mic
    if (!ok || mods === null || listener === null) {
      toListening('nomic')
      return
    }
    // the tab hidden, or the section left, while the listener loaded: that
    // leave came before the microphone did, so let it go here as the leave
    // does, and end the take unstarted
    const hidden = document.hidden
    const gone = hidden || left
    if (gone) leave(hidden)
    const name = signName(sharpOf(r.midi))
    const reading = gone
      ? null
      : await holdOne({
          mod: mods.listen,
          reader: mods.reader,
          listener,
          view,
          which: r.which,
          midi: r.midi,
          length: lengthOf(hold),
          label: ringLabel(r.midi),
          live: plan.liveBand ?? true,
          cancelled: () => me.cancelled,
          onPhase: (p) => {
            view.phase(p)
            view.status(phaseStatus(plan.heads[hold], name, p))
          },
        })
    mic.release()
    view.phase(null)
    if (take !== me) return
    take = null
    opening(false)
    if (reading !== null) recordTake(r, reading, mods.reader)
    else {
      view.status(STATUS.stopped)
      view.takeActions({ again: againAllowed(r.record.takes[hold]) })
    }
  }

  /** A fresh run on the note found: the microphone first, asked inside the tap. */
  async function startRun(): Promise<void> {
    const context = Sound.context()
    const v = VoiceChoice.voice
    if (asking) return
    if (v === null) {
      toVoice()
      return
    }
    if (plan.mayStart?.() === false) return
    asking = true
    opening(true)
    view.status(STATUS.asking)
    const ok = await mic.open(context)
    asking = false
    if (!ok) {
      toListening('nomic')
      return
    }
    // the viewer left while the microphone opened: let it go before any
    // panel is drawn, which would bring the card back on screen
    const hidden = document.hidden
    if (hidden || left) {
      leave(hidden)
      opening(false)
      view.status(STATUS.stopped)
      return
    }
    run = {
      which: mercOf(v),
      midi: holdNote(v, move),
      hold: 1,
      record: emptyRecord(),
      readings: { 1: [], 2: [] },
    }
    await takeHold(1)
  }

  function onFeel(f: Feeling): void {
    const r = run
    const reader = mic.mods?.reader
    if (r === null || reader === undefined) return
    const step = afterFeeling(plan.holds, r.hold, f, r.record)
    if (step.celebrate) {
      r.record = withCelebration(r.record, r.hold)
      mercCelebrate(r.which)
    }
    const summary = reader.holdSummary(
      reader.countedTake(r.readings[1]),
      reader.countedTake(r.readings[2]),
      plan.subject,
    )
    view.after(afterLines(step, summary))
    // the singer's answer outranks the reading: "Uncomfortable" takes the chart and its line away
    const keep = step.reading || step.summary
    view.show(['feel', 'after'], keep ? 'take' : null)
    VisitEnding.set(step.restCard ? 'rest' : 'practise')
    view.status(stepStatus(step, step.summary ? summary : null))
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /**
   * Done for today, on either of its buttons: the checkpoint ends here. It
   * says nothing of the voice, so the Wrap's card stays as the visit's
   * ending has it: the rest card after "Effortful" where the page asks for
   * it, the practice card otherwise.
   */
  function finish(): void {
    for (const b of qa<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button, [data-take-actions] button',
      card,
    ))
      b.hidden = true
    view.status(STATUS.done)
    view.focusText(q('#singStatus'))
  }

  async function listenTo(len: number): Promise<void> {
    const v = VoiceChoice.voice
    if (v === null || view.ring.busy) return
    const midi = holdNote(v, mode === 'nomic' ? move : 0)
    const which = mercOf(v)
    const other: Which = which === 'blue' ? 'orange' : 'blue'
    const audible = Sound.canPlay()
    view.chart.setTarget(midi)
    view.chart.setWindow(len)
    view.chart.scene.glow = 1
    view.status(`Merc holds ${signName(sharpOf(midi))} for ${len} seconds.`)
    mercSing(which, midi, true)
    mercListen(other, true)
    void view.ring.run({ which, label: ringLabel(midi), listen: len, turn: 0 })
    await playTone(hz(midi), len, { kind: 'merc', audible })
    view.chart.scene.glow = 0
    mercSing(which, midi, false)
    mercListen(other, false)
  }

  async function demo(kind: 'sigh' | 'slide'): Promise<void> {
    const v = VoiceChoice.voice
    if (v === null || busyDemo) return
    busyDemo = true
    const which = mercOf(v)
    // the sigh down a fifth, the slide up to it and back (Lesson 3 FACTS 37, 46a)
    mercSing(which, homeOf(v), true)
    await playContour(warmUpContour(kind, v), { kind: 'merc' })
    await wait(0.3)
    mercSing(which, homeOf(v), false)
    busyDemo = false
  }

  mountComfort(card, {
    onSing: () => {
      mode = 'sing'
      if (VoiceChoice.voice === null) toVoice()
      else toPrepare()
    },
    onListen: () => {
      VisitEnding.set('rest')
      toListening('listen')
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), () => {
    if (mode === 'sing') toPrepare()
    else showListening()
  })

  const on = (selector: string, fn: (b: HTMLButtonElement) => void): void => {
    for (const b of qa<HTMLButtonElement>(selector, card))
      b.addEventListener('click', () => fn(b))
  }
  on('[data-sing="start"]', () => void startRun())
  on('[data-sing="again"]', () => {
    if (run !== null) void takeHold(run.hold)
  })
  on(`[data-sing="${plan.nextHold}"]`, () => void takeHold(2))
  on('[data-sing="today"]', finish)
  on('[data-sing="done"]', finish)
  on('[data-note]', (b) => moveNote(b.dataset.note === 'lower' ? -1 : 1, b))
  on('[data-listen-len]', (b) => void listenTo(Number(b.dataset.listenLen)))
  on('[data-warm]', (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(plan.warmupKey, true)
      warmup.open = false
      q('summary', warmup).focus({ preventScroll: true })
    } else if (w === 'sigh' || w === 'slide') void demo(w)
  })

  // let go of the microphone whenever the viewer leaves: the section, the tab, the page
  const leave = (now: boolean): void => {
    if (take !== null) take.cancelled = true
    mic.release(now)
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop a take; once
  // away, `left` holds until the section is back, for a take still opening
  let away = 0
  let left = false
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    // only #sing is watched, so a report's last entry is where it stands now
    const last = entries[entries.length - 1]
    if (last !== undefined && !last.isIntersecting)
      away = window.setTimeout(() => {
        left = true
        leave(false)
      }, 600)
    else left = false
  }).observe(q('#sing'))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave(true)
  })
  window.addEventListener('pagehide', () => leave(true))
}
