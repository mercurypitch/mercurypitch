// ============================================================
// Lesson 5 Sing it — one comfortable note, ten seconds, then fifteen
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md), as Lesson 3's is: the
// comfort check first on every visit and never stored (REQ-GVC-020, 021);
// "Just listen today" opens a listening mode in which Merc holds the note
// for 10 or 15 seconds on a tap and nothing listens, with the rest line and
// the doctor lines. Singing goes on to the voice choice (if none is
// stored), the optional warm-up, which never listens (REQ-GVC-074, 075),
// the note, which Lower and Higher move a semitone a tap, up to four either
// way, for the visit (FACTS 55), and the briefing, whose Start is the only
// control that asks for the microphone.
//
// Each take is one hold (sing-hold.ts): ten seconds, then fifteen only
// after an "Easy" or "Workable" first hold and a rest the singer ends.
// "How did that feel?" follows every take that heard a voice
// (REQ-GVC-022), and only its answer offers more singing: the flow is the
// pure rule in hold-flow.ts, so this file draws what that rule says. The
// microphone is held only around a take: acquired on the tap that starts
// one, released when it ends, when the viewer leaves the section, when the
// tab is hidden and when the page goes. If it is refused, missing, or the
// listener fails to load, the page carries on in listening mode with "No
// microphone? ..." Nothing is recorded, kept or sent: a take's frames are
// read and dropped (REQ-GVC-003, 004), and only the voice choice and the
// warm-up's Skip are stored. The checkpoint's ending picks the Wrap's card
// for the visit (kit/comfort.ts `VisitEnding`), in memory only.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { clamp, q, qa, store, wait } from '@/features/lessons/kit/dom'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type { Listener } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercListen, mercSing, } from '@/features/lessons/kit/merc-duo'
import { hz, nameHtml, sharpOf, signName } from '@/features/lessons/kit/notes'
import type { RingStills } from '@/features/lessons/kit/sing'
import type { Voice as Note } from '@/features/lessons/kit/sound'
import { playContour, playTone, Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import type { FlowStep, HoldNo, HoldRecord } from './hold-flow'
import { afterFeeling, afterTake, againAllowed, emptyRecord, HOLD_SEC, withCelebration, withTake, } from './hold-flow'
import type { HoldModule, ListenModule } from './sing-hold'
import { holdOne, holdSummaryFor } from './sing-hold'
import type { AfterLines, HoldPhase, SingView } from './sing-view'
import { createSingView } from './sing-view'

/** The page's consumer id with the app's microphone owner. */
const CONSUMER = 'lesson-05'
/** The warm-up's Skip, remembered so a return visit opens it folded. */
const WARMUP_KEY = 'fyp-l05-warmup'
/** Semitones Lower and Higher may move the note either way (FACTS 55). */
export const MAX_MOVE = 4
/** Seconds of the note each Lower or Higher tap plays (FACTS 77). */
const TAP_SEC = 1

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

export const HOLD_HEAD: Readonly<Record<HoldNo, string>> = {
  1: 'Hold 1: ten seconds',
  2: 'Hold 2: fifteen seconds',
}

/** The note the holds are sung on: the voice's A, moved `move` semitones. */
export const holdNote = (v: Voice, move: number): number =>
  homeOf(v) + clamp(move, -MAX_MOVE, MAX_MOVE)

/** The ring's label and the note's readout: "A3 · 220 Hz", its sign spoken. */
export const ringLabel = (midi: number): string =>
  `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`

/** The status line as a hold's phase begins. */
export function phaseStatus(hold: HoldNo, name: string, p: HoldPhase): string {
  if (p === 'listen')
    return `${HOLD_HEAD[hold]}, on ${name}. Listen to Merc's note.`
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
    hold15: step.offers.hold15,
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

async function loadModules(): Promise<Modules> {
  const [listen, reader] = await Promise.all([
    import('@/features/lessons/kit/listen'),
    import('@/features/lessons/kit/hold-take'),
  ])
  return { listen, reader }
}

/** The microphone and the reader, held across the takes of a visit. */
class Mic {
  mods: Modules | null = null
  listener: Listener | null = null

  /** Loads the listener and holds the microphone, inside the tap that asked; false if either fails. */
  async open(context: AudioContext | null): Promise<boolean> {
    if (context === null) return false
    try {
      this.mods ??= await loadModules()
      if (this.listener === null || !this.listener.holding)
        this.listener = await this.mods.listen.listen(CONSUMER, context)
      return true
    } catch {
      return false
    }
  }

  release(now = false): void {
    if (now) this.listener?.releaseNow()
    else this.listener?.release()
    this.listener = null
  }
}

export function initSing(stills: RingStills): void {
  const view: SingView = createSingView(stills)
  const card = q('#singCard')
  const warmup = q<HTMLDetailsElement>('#warmup')
  const mic = new Mic()
  let run: Run | null = null
  let take: { cancelled: boolean } | null = null
  let mode: 'sing' | 'listen' | 'nomic' = 'sing'
  let move = 0
  let busyDemo = false
  let asking = false
  let tap: Note | null = null

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'

  function showListening(): void {
    const v = VoiceChoice.voice
    view.listenWhy(mode === 'nomic' ? 'nomic' : 'listen')
    view.show(
      v === null ? ['listen', 'voice'] : ['listen'],
      v === null ? null : 'listen',
    )
    view.chart.setTarget(holdNote(voiceNow(), mode === 'nomic' ? move : 0))
    view.chart.setWindow(HOLD_SEC[1])
  }

  function toListening(why: 'listen' | 'nomic'): void {
    if (take !== null) take.cancelled = true
    take = null
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
    warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
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
    view.chart.describe(holdSummaryFor(reader, r.midi, reading))
    view.chart.scene.marks =
      reading.settled === null ? [] : [{ t: reading.settled, label: 'settled' }]
    view.now('–')
    const said = `${HOLD_HEAD[r.hold]}. ${reading.line}${reading.octaveLine === null ? '' : ` ${reading.octaveLine}`}`
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
    view.holdHead(HOLD_HEAD[hold])
    view.focusText(view.headEl)
    const me = { cancelled: false }
    take = me
    const ok = await mic.open(Sound.context())
    const { mods, listener } = mic
    if (!ok || mods === null || listener === null) {
      toListening('nomic')
      return
    }
    // the tab hidden while the listener loaded: its visibilitychange came
    // before the microphone did, so let it go here and end the take unstarted
    const hidden = document.hidden
    if (hidden) leave(true)
    const name = signName(sharpOf(r.midi))
    const reading = hidden
      ? null
      : await holdOne({
          mod: mods.listen,
          reader: mods.reader,
          listener,
          view,
          which: r.which,
          midi: r.midi,
          length: HOLD_SEC[hold],
          label: ringLabel(r.midi),
          cancelled: () => me.cancelled,
          onPhase: (p) => {
            view.phase(p)
            view.status(phaseStatus(hold, name, p))
          },
        })
    mic.release()
    view.phase(null)
    if (take !== me) return
    take = null
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
    asking = true
    view.status(STATUS.asking)
    const ok = await mic.open(context)
    asking = false
    if (!ok) {
      toListening('nomic')
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
    const step = afterFeeling(r.hold, f, r.record)
    if (step.celebrate) {
      r.record = withCelebration(r.record, r.hold)
      mercCelebrate(r.which)
    }
    const summary = reader.holdSummary(
      reader.countedTake(r.readings[1]),
      reader.countedTake(r.readings[2]),
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

  /** Done for today, on either of its buttons: the checkpoint ends here, and the Wrap keeps the Voice Mirror card. */
  function finish(): void {
    for (const b of qa<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button, [data-take-actions] button',
      card,
    ))
      b.hidden = true
    VisitEnding.set('practise')
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
  on('[data-sing="hold15"]', () => void takeHold(2))
  on('[data-sing="today"]', finish)
  on('[data-sing="done"]', finish)
  on('[data-note]', (b) => moveNote(b.dataset.note === 'lower' ? -1 : 1, b))
  on('[data-listen-len]', (b) => void listenTo(Number(b.dataset.listenLen)))
  on('[data-warm]', (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(WARMUP_KEY, true)
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
  // section off screen for a moment, and that must not stop a take
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    if (entries.some((e) => !e.isIntersecting))
      away = window.setTimeout(() => leave(false), 600)
  }).observe(q('#sing'))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave(true)
  })
  window.addEventListener('pagehide', () => leave(true))
}
