// ============================================================
// Lesson 24 Sing it — do, so and mi over a drone, then so and mi for longer
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6), on the kit's pieces under the Guided
// Voice Check's safety rules (docs/specs/guided-voice-check.ears.md): the
// comfort check first on every visit and never stored (kit/comfort.ts);
// "Just listen today", whose play, Merc's three notes over the drone, waits
// for Step 2's choice, since his so and mi over it are the piano's fifth and
// third; the voice choice when none is stored (kit/voice-choice.ts); Move
// do, five higher and none lower, for the visit, in memory; the headphones
// check (kit/headphones.ts), whose "No headphones" opens the sing-along; and
// the briefing, whose Start is the only control that asks for the
// microphone. Before every set the quiet check plays the drone for two
// seconds while the listener reads the frames (kit/quiet-check.ts, which
// loads with the listener on Start, as it brings the pitch code): any
// voiced run of 0.3 s or more releases the microphone and opens the
// sing-along, with Start under it to try again.
//
// A set is sung in one take: do, so and mi for five seconds, then so and mi
// for ten (sing-plan.ts). Before each hold the singing Merc sings the note
// alone, the other listening; then the kit's hold run (kit/hold-run.ts) goes
// Listen · Breathe · Sing with the drone on do started in its Listen phase
// and kept through the take, the only sound it allows, released as it ends.
// No live band state: the line draws, and nothing says where it is until
// the hold ends, when the centre-line reader reads it (kit/hold-centre.ts,
// loaded with the listener after Start) and a found vibrato's middle draws
// itself in Lesson 22's dashed violet. A hold with no voice ends the set
// there. What follows each set is the kit's pure rule (kit/hold-flow.ts,
// `sets`): "How did that feel?" whenever anything was sung, the
// celebration only for a set read whole and in the band for 80 % of each
// hold, the tricky line, "Effortful" picking the rest card, and the second
// set only after an "Easy" or "Workable" first. The sing-along sings each
// note alone, then the drone with the singer for five seconds, nothing
// listening, offered again once a visit. From Start until a set ends every
// other play on the page is disabled and any sound stops (WEB-SPEC, Audio,
// rule 4); leaving the section for 600 ms, or hiding the page, ends what
// plays here and releases the microphone. Nothing is recorded, kept or sent.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling as alongFeeling, mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, wait } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import { mountHeadphones } from '@/features/lessons/kit/headphones'
import type { CentredReading } from '@/features/lessons/kit/hold-centre'
import type { FlowStep, HoldPlan, HoldRecord, TakeMark, } from '@/features/lessons/kit/hold-flow'
import { afterFeeling, afterTake, againAllowed, emptyRecord, setMark, withCelebration, withTake, } from '@/features/lessons/kit/hold-flow'
import type { HoldModule, ListenModule } from '@/features/lessons/kit/hold-run'
import { DRONE_RELEASE_SEC, GAP_SEC, holdOne, } from '@/features/lessons/kit/hold-run'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type { Listener } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercListen, mercSing, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { nextShift } from '@/features/lessons/kit/move-do'
import { hz, nameHtml, sharpOf, wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as QuietKit from '@/features/lessons/kit/quiet-check'
import { HEARD_LINE, QUIET_LINE, QUIET_SEC, } from '@/features/lessons/kit/quiet-words'
import type { Run } from '@/features/lessons/kit/run'
import type { RingStills } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { animate } from '@/features/lessons/kit/words-strip'
import type { Degree, HeldNote } from './sing-plan'
import { ALONG, alongStatus, doNow, doOf, DRONE_LISTEN_SEC, holdHead, listenStatus, modelStatus, MOVE_REACH, noteOf, SETS, setSummary, } from './sing-plan'
import { startAlongDrone, startDrone, startListen, startModel, } from './sing-sounds'
import type { SingView } from './sing-view'
import { createSingView } from './sing-view'

/** The kit's flow, with this page's two sets and the rest card after "Effortful" (FACTS 55, 59). */
export const PLAN: HoldPlan = {
  lengths: [SETS[1].sec, SETS[2].sec],
  restAfterEffort: true,
  sets: true,
}

/** Every status line Sing it says, beside the reader's own and the plan's. */
export const STATUS = {
  listen: 'Just listening today: the microphone stays off.',
  voice: "Choose the voice you'll sing with.",
  prepare: 'If do feels low, move it higher. Then the headphones.',
  brief: 'Read what this does, then press Start.',
  asking: 'Asking your browser for the microphone.',
  quiet: QUIET_LINE,
  heard: HEARD_LINE,
  along:
    'The sing-along: Merc sings each note alone, then the drone plays with you for five seconds. Nothing listens.',
  nomic:
    'No microphone? Sing along anyway: Merc sings each note first, and nothing listens.',
  stopped: 'Stopped listening: the microphone is off.',
  feel: 'How did that feel?',
  breathe: 'Breathe in, low and quiet.',
  sing: 'Sing, and hold the note until the ring closes.',
  rest: 'Rest for a few easy breaths. Ready when you are.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  alongDone: 'A unison, a fifth and a major third, each over the drone.',
  done: 'Done for today.',
} as const

/** What Start says under itself with sound off, asking for nothing (WEB-SPEC, Toys 6, state 5). */
export const START_SOUND_OFF =
  'Sound is off, so nothing played. Turn sound on to hear the drone, then press Start.'

/** Every play on the page outside Sing it, held while a set runs. */
export const PAGE_PLAYS =
  '[data-play], [data-word-play], [data-drone-play], [data-drone-bead], [data-step-play], [data-quiz-play], [data-free-state], input[data-drone-top], input[data-drone-mi]'

/** Seconds between a hold's reading and the next note, to read it. */
export const NEXT_NOTE_SEC = 1.5

/** Seconds the middle of a line with a vibrato takes to draw itself (Lesson 22's). */
export const MIDDLE_SEC = 0.6

/** The ring's label and the note's readout: "A3 · 220 Hz", its sign spoken. */
export const ringLabel = (midi: number): string =>
  `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`

const isCentred = (r: HoldReading): r is CentredReading => 'middle' in r

/** A set's take, as the summary reads its holds: each note with its reading, or none. */
export function heldNotes(
  notes: readonly Degree[],
  readings: readonly HoldReading[],
): HeldNote[] {
  return notes.map((d, i) => {
    const r = readings.at(i)
    return {
      d,
      read: r?.kind === 'read' ? { inBand: r.inBand, length: r.length } : null,
    }
  })
}

/** The status line after an answer to "How did that feel?" on a set. */
export function stepStatus(step: FlowStep, summary: string | null): string {
  if (step.next === 'rest') return STATUS.rest
  if (step.next === 'gentle') return STATUS.gentle
  if (step.next === 'enough') return STATUS.enough
  return summary ?? STATUS.feel
}

/** What loads on Start: the listener, the reader and the quiet check, which bring the pitch code. */
interface Modules {
  readonly listen: ListenModule
  readonly reader: HoldModule
  readonly quiet: typeof QuietKit
}

/** The microphone and the reader, held across a set's holds. */
class Mic {
  mods: Modules | null = null
  listener: Listener | null = null

  /** Loads the listener and holds the microphone, inside the tap that asked; false if either fails. */
  async open(context: AudioContext | null): Promise<boolean> {
    if (context === null) return false
    try {
      this.mods ??= await Mic.load()
      if (this.listener === null || !this.listener.holding)
        this.listener = await this.mods.listen.listen('lesson-24', context)
      return true
    } catch {
      return false
    }
  }

  private static async load(): Promise<Modules> {
    const [listen, take, centre, quiet] = await Promise.all([
      import('@/features/lessons/kit/listen'),
      import('@/features/lessons/kit/hold-take'),
      import('@/features/lessons/kit/hold-centre'),
      import('@/features/lessons/kit/quiet-check'),
    ])
    return {
      listen,
      reader: { ...take, readHold: centre.readCentredHold },
      quiet,
    }
  }

  release(now = false): void {
    if (now) this.listener?.releaseNow()
    else this.listener?.release()
    this.listener = null
  }
}

export interface Sing {
  /** Step 2's choice: "Just listen today"'s play sounds from now on, and its lock line goes. */
  unlockListen(): void
}

/** Mounts Sing it on the page's #singCard. */
export function initSing(stills: RingStills): Sing {
  const view: SingView = createSingView(stills)
  const card = q('#singCard')
  const mic = new Mic()
  let move = 0
  let record: HoldRecord = emptyRecord()
  // the latest take's readings, each set's, for the summary
  const latest: Record<1 | 2, HoldReading[]> = { 1: [], 2: [] }
  let set: 1 | 2 = 1
  let mode: 'sets' | 'along' = 'sets'
  let take: { cancelled: boolean } | null = null
  let sounding: Run | null = null
  let alongs = 0
  let resting = false
  let left = false
  // what the latest hold's reading said, which "How did that feel?" follows
  let said = ''

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'
  const which = (): Which => mercOf(voiceNow())

  // a set's window, from Start until its last hold ends: every other play held
  let held: HTMLButtonElement[] = []
  let open = false
  const opening = (on: boolean): void => {
    if (on === open) return
    open = on
    if (on) {
      NowPlaying.claim(() => undefined)
      held = qa<HTMLButtonElement>(PAGE_PLAYS).filter((b) => !b.disabled)
      for (const b of held) b.disabled = true
    } else {
      for (const b of held) b.disabled = false
      held = []
    }
  }
  // a play enabled during a set (the cold open's choice, say) still waits for its end
  document.addEventListener(
    'click',
    (e) => {
      if (open && e.target instanceof Element && e.target.closest(PAGE_PLAYS))
        e.stopImmediatePropagation()
    },
    true,
  )

  /** Plays `run` as the page's one sound; true once it has ended by itself. */
  async function sound(run: Run): Promise<boolean> {
    sounding = run
    const stop = (): void => {
      run.stop()
    }
    NowPlaying.claim(stop)
    const heard = await run.done
    NowPlaying.release(stop)
    if (sounding === run) sounding = null
    return heard
  }

  function showDo(): void {
    view.doNow(doNow(doOf(voiceNow(), move)), move)
  }

  function toVoice(): void {
    view.show(['voice'], false)
    view.status(STATUS.voice)
    view.focusText(q('[data-panel="voice"]', card))
  }

  function toPrepare(): void {
    showDo()
    view.show(['prepare'], false)
    view.status(STATUS.prepare)
    view.focusText(q('[data-panel="prepare"]', card))
  }

  function toBrief(): void {
    view.startHint('')
    view.show(['brief'], false)
    view.status(STATUS.brief)
    view.focusText(q('[data-panel="brief"]', card))
  }

  function toListen(): void {
    view.show(['listen'], false)
    view.status(STATUS.listen)
    view.focusText(q('[data-panel="listen"]', card))
  }

  /** The sing-along's panel: after No headphones, no microphone, or a quiet check that heard a note. */
  function toAlong(why: 'phones' | 'nomic' | 'heard'): void {
    if (take !== null) take.cancelled = true
    take = null
    opening(false)
    mic.release()
    mode = 'along'
    view.quietFailed(why === 'heard')
    view.show(['along'], false)
    view.status(why === 'phones' ? STATUS.along : STATUS[why])
    view.focusText(q('[data-panel="along"]', card))
  }

  /** The quiet check: the drone on do for two seconds, nothing else playing, while the listener reads. */
  async function quietCheck(
    m: Modules,
    l: Listener,
    doMidi: number,
    me: { cancelled: boolean },
  ): Promise<'quiet' | 'heard' | 'cut'> {
    view.chart.setTarget(doMidi)
    view.chart.setWindow(QUIET_SEC)
    view.drone(doMidi, doMidi)
    view.holdHead(holdHead('do', doMidi))
    view.reading(null, null)
    view.status(STATUS.quiet)
    void view.ring.run({
      which: which(),
      label: ringLabel(doMidi),
      listen: QUIET_SEC,
      turn: 0,
      ripples: false,
      words: { listen: 'Stay quiet' },
    })
    const drone = startDrone(doMidi)
    Sound.hush(true, drone)
    const frames = await m.listen.framesFor(l, QUIET_SEC, () => me.cancelled)
    drone?.stop(DRONE_RELEASE_SEC)
    Sound.hush(false)
    if (frames === null || me.cancelled) return 'cut'
    return m.quiet.heardNothing(frames) ? 'quiet' : 'heard'
  }

  /** The singing Merc's note before a hold, alone, the other listening; false if it was cut short. */
  async function modelNote(d: Degree, midi: number): Promise<boolean> {
    const v = voiceNow()
    const singer = mercOf(v)
    const other: Which = singer === 'blue' ? 'orange' : 'blue'
    view.chart.setTarget(midi)
    view.chart.setWindow(SETS[set].sec)
    view.drone(midi, doOf(v, move))
    view.holdHead(holdHead(d, midi))
    view.reading(null, null)
    view.status(modelStatus(v, d, midi))
    mercSing(singer, midi, true)
    mercListen(other, true)
    const heard = await sound(startModel(midi, Sound.canPlay()))
    mercSing(singer, midi, false)
    mercListen(other, false)
    return heard
  }

  /** After a reading with a vibrato: its middle draws itself over the line, over 0.6 s, at once under reduced motion. */
  let drawing = 0

  function drawMiddle(r: HoldReading): void {
    drawing += 1
    const middle = isCentred(r) && r.vibrato !== null ? r.middle : null
    if (middle === null) return
    const onset = middle[0]?.t ?? 0
    const points = middle.map((p) => ({ t: p.t - onset, c: p.cents }))
    const mine = drawing
    const draw = (share: number): void => {
      if (drawing !== mine) return
      view.chart.scene.middle = { points, tone: 'singer', share }
      wake()
    }
    if (reducedMotion()) draw(1)
    else void animate(MIDDLE_SEC, draw)
  }

  function showReading(
    d: Degree,
    midi: number,
    r: HoldReading,
    m: Modules,
  ): void {
    view.reading(r.line, r.octaveLine)
    drawMiddle(r)
    view.chart.describe(m.reader.holdChartWords(wordName(sharpOf(midi)), r))
    view.chart.scene.marks =
      r.settled === null ? [] : [{ t: r.settled, label: 'settled' }]
    view.chart.scene.lit = r.kind === 'read' && r.inBand > 0
    said = `${holdHead(d, midi)}. ${r.line}${r.octaveLine === null ? '' : ` ${r.octaveLine}`}`
    view.status(said)
  }

  /** One hold of a set, after its model note: the reading, or null if it was cut short. */
  async function holdNote(
    d: Degree,
    midi: number,
    m: Modules,
    l: Listener,
    me: { cancelled: boolean },
  ): Promise<HoldReading | null> {
    const doMidi = doOf(voiceNow(), move)
    let drone: ReturnType<typeof startDrone> = null
    return holdOne({
      mod: m.listen,
      reader: m.reader,
      listener: l,
      view,
      which: which(),
      midi,
      length: SETS[set].sec,
      label: ringLabel(midi),
      live: false,
      listen: {
        sec: DRONE_LISTEN_SEC,
        mercSings: false,
        play: async () => {
          drone = startDrone(doMidi)
          await wait(DRONE_LISTEN_SEC)
          return !me.cancelled
        },
      },
      kept: () => drone,
      cancelled: () => me.cancelled,
      onPhase: (p) => {
        // the hold run moves the chart to the note, which clears its scene: the drone and the band again
        if (p === 'listen') view.drone(midi, doMidi)
        view.phase(p)
        view.status(
          p === 'listen'
            ? listenStatus(d, midi)
            : p === 'breathe'
              ? STATUS.breathe
              : STATUS.sing,
        )
      },
    })
  }

  /** A set's holds in one take, after the quiet check; ends where a hold heard no voice. */
  async function singSet(
    m: Modules,
    l: Listener,
    me: { cancelled: boolean },
  ): Promise<HoldReading[]> {
    const readings: HoldReading[] = []
    const v = voiceNow()
    for (const [i, d] of SETS[set].notes.entries()) {
      if (i > 0) await wait(NEXT_NOTE_SEC)
      if (me.cancelled) break
      const midi = noteOf(v, move, d)
      if (!(await modelNote(d, midi)) || me.cancelled) break
      // the model note's release dies away before the drone comes in: the two never sound together
      await wait(GAP_SEC)
      const r = await holdNote(d, midi, m, l, me)
      if (r === null) break
      readings.push(r)
      showReading(d, midi, r, m)
      if (r.kind === 'silent') break
    }
    return readings
  }

  /** A set, from the microphone's opening to its last hold: Start, Again and the second set's button. */
  async function runSet(n: 1 | 2): Promise<void> {
    if (take !== null || resting) return
    set = n
    mode = 'sets'
    feelings.reset()
    const me = { cancelled: false }
    take = me
    opening(true)
    view.takeActions(null)
    view.status(STATUS.asking)
    const ok = await mic.open(Sound.context())
    const { mods, listener } = mic
    if (!ok || mods === null || listener === null) {
      toAlong('nomic')
      return
    }
    // the viewer left while the microphone opened: let it go before any panel is drawn
    if (document.hidden || left) {
      leave(document.hidden)
      ended(me, n, [])
      return
    }
    view.show([], true)
    const quiet = await quietCheck(mods, listener, doOf(voiceNow(), move), me)
    if (quiet === 'heard') {
      toAlong('heard')
      return
    }
    const readings = quiet === 'cut' ? [] : await singSet(mods, listener, me)
    mic.release()
    view.phase(null)
    ended(me, n, readings)
  }

  /** A set's end: its take counted, then "How did that feel?", or Again and Done for today. */
  function ended(
    me: { cancelled: boolean },
    n: 1 | 2,
    readings: HoldReading[],
  ): void {
    if (take !== me) return
    take = null
    opening(false)
    latest[n] = readings
    const marks: TakeMark[] = readings.map((r) => ({
      kind: r.kind,
      share: r.share,
    }))
    const mark = setMark(marks, SETS[n].notes.length)
    record = withTake(record, n, me.cancelled ? { ...mark, ended: true } : mark)
    if (me.cancelled) {
      view.status(STATUS.stopped)
      view.takeActions({ again: againAllowed(record.takes[n]) })
      return
    }
    const next = afterTake(n, record)
    if (!next.ask) {
      // nothing was sung, so there is nothing to ask about: Again, or Done for today
      view.takeActions({ again: next.again })
      return
    }
    view.show(['feel'], true)
    view.status(`${said} ${STATUS.feel}`)
    view.focusText(view.readingEl)
  }

  function onFeel(f: Feeling): void {
    if (mode === 'along') {
      afterAlong(f)
      return
    }
    const step = afterFeeling(PLAN, set, f, record)
    if (step.celebrate) {
      record = withCelebration(record, set)
      mercCelebrate(which())
    }
    const summary =
      set === 2 ? setSummary(heldNotes(SETS[2].notes, latest[2])) : null
    view.after({
      summary: step.summary ? summary : null,
      tricky: step.tricky,
      closing: step.next === 'end' ? null : step.next,
      doctor: step.doctor,
      nextSet: step.offers.nextHold,
      alongAgain: false,
      again: step.offers.again,
      done: step.offers.done,
    })
    view.show(['feel', 'after'], step.reading || step.summary)
    if (step.restCard) {
      resting = true
      VisitEnding.set('rest')
    }
    view.status(stepStatus(step, step.summary ? summary : null))
    view.focusText(q('[data-panel="after"]', card))
  }

  /** The sing-along's ending: the kit's rule for a run with no reading, its Again once a visit. */
  function afterAlong(f: Feeling): void {
    const a = alongFeeling(f, { restAfterEffort: true })
    const easy = a.closing === null
    view.after({
      summary: null,
      tricky: false,
      closing: easy ? 'along' : a.closing,
      doctor: a.doctor,
      nextSet: false,
      alongAgain: a.again && alongs < 2,
      again: false,
      done: a.closing === 'enough' ? null : 'today',
    })
    view.show(['feel', 'after'], false)
    if (a.rest) {
      resting = true
      VisitEnding.set('rest')
    }
    view.status(easy ? STATUS.alongDone : STATUS[a.closing])
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /** One note of the sing-along: the note alone, the quiet, then the drone while the ring closes; false if cut short. */
  async function alongNote(d: Degree): Promise<boolean> {
    const v = voiceNow()
    const midi = noteOf(v, move, d)
    const doMidi = doOf(v, move)
    const singer = mercOf(v)
    const other: Which = singer === 'blue' ? 'orange' : 'blue'
    view.chart.setTarget(midi)
    view.chart.setWindow(ALONG.drone)
    view.drone(midi, doMidi)
    view.holdHead(holdHead(d, midi))
    view.status(modelStatus(v, d, midi))
    view.phase('listen')
    void view.ring.run({
      which: singer,
      label: ringLabel(midi),
      listen: ALONG.note,
      breathe: ALONG.quiet,
      turn: ALONG.drone,
      exhale: true,
    })
    mercSing(singer, midi, true)
    mercListen(other, true)
    const audible = Sound.canPlay()
    const heard = await sound(startModel(midi, audible))
    mercSing(singer, midi, false)
    if (!heard) {
      mercListen(other, false)
      return false
    }
    view.phase('breathe')
    await wait(ALONG.quiet)
    view.phase('sing')
    view.status(alongStatus(d, midi))
    mercListen(singer, true)
    const sang = await sound(startAlongDrone(doMidi, audible))
    mercListen(singer, false)
    mercListen(other, false)
    return sang
  }

  /** The sing-along: do, so and mi, each alone then with the drone; nothing listens. */
  async function runAlong(): Promise<void> {
    if (take !== null || resting || sounding !== null) return
    mode = 'along'
    alongs += 1
    feelings.reset()
    view.show([], true)
    let whole = true
    for (const d of SETS[1].notes) {
      whole = await alongNote(d)
      if (!whole) break
    }
    view.phase(null)
    view.ring.stop()
    if (!whole) {
      // cut short by another sound: nothing was listening, so its own line
      // again, with Start the sing-along to sing it from the top
      view.show(['along'], false)
      view.status(STATUS.along)
      return
    }
    view.show(['feel'], true)
    view.status(STATUS.feel)
    view.focusText(q('[data-panel="feel"]', card))
  }

  /** "Just listen today"'s play: Merc's notes over the drone, again on each tap. */
  async function playListen(b: HTMLButtonElement): Promise<void> {
    if (b.disabled) return
    sounding?.stop()
    b.classList.add('is-on')
    const v = voiceNow()
    mercSing(mercOf(v), doOf(v, move), true)
    await sound(startListen(v, move, Sound.canPlay()))
    mercSing(mercOf(v), doOf(v, move), false)
    b.classList.remove('is-on')
  }

  /** Done for today, on any of its buttons: the checkpoint ends here, the Wrap's card as the visit's ending picks it. */
  function finish(): void {
    for (const b of qa<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button, [data-take-actions] button',
      card,
    ))
      b.hidden = true
    view.status(STATUS.done)
    view.focusText(q('#singStatus'))
  }

  /** Start: the microphone's question, unless sound is off, when it asks for nothing and says why. */
  function start(): void {
    const silent = !Sound.canPlay({ needsSound: true })
    view.startHint(silent ? START_SOUND_OFF : '')
    if (silent) {
      // said on the status line too: Start under the sing-along has no hint of its own
      view.status(START_SOUND_OFF)
      return
    }
    void runSet(set)
  }

  mountComfort(card, {
    onSing: () => {
      if (VoiceChoice.voice === null) toVoice()
      else toPrepare()
    },
    onListen: () => {
      resting = true
      VisitEnding.set('rest')
      if (VoiceChoice.voice === null) toVoice()
      else toListen()
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), () => {
    if (resting) toListen()
    else toPrepare()
  })
  mountHeadphones(q('[data-phones-check]', card), {
    onOn: toBrief,
    onOff: () => {
      toAlong('phones')
    },
  })

  const on = (selector: string, fn: (b: HTMLButtonElement) => void): void => {
    for (const b of qa<HTMLButtonElement>(selector, card))
      b.addEventListener('click', () => {
        fn(b)
      })
  }
  on('[data-move-do]', (b) => {
    if (b.getAttribute('aria-disabled') === 'true') return
    move = nextShift(move, b, MOVE_REACH)
    showDo()
  })
  on('[data-sing="start"]', start)
  on('[data-sing="again"]', () => void runSet(set))
  on('[data-sing="hold2"]', () => void runSet(2))
  on('[data-sing="along"]', () => void runAlong())
  on('[data-sing="along-again"]', () => void runAlong())
  on('[data-sing="today"]', finish)
  on('[data-sing="done"]', finish)
  on('[data-listen-play]', (b) => void playListen(b))

  // let go of the microphone, and of what plays here, whenever the viewer leaves
  const leave = (now: boolean): void => {
    if (take !== null) take.cancelled = true
    sounding?.stop()
    mic.release(now)
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop a take
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
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
  window.addEventListener('pagehide', () => {
    leave(true)
  })

  return {
    unlockListen() {
      q<HTMLButtonElement>('[data-listen-play]', card).disabled = false
      q('[data-listen-lock]', card).hidden = true
    },
  }
}
