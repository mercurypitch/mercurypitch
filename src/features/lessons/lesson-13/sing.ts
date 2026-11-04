// ============================================================
// Lesson 13 Sing it — one note, ten seconds, five vowels
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md), as Lessons 3 and 5 have
// it: the comfort check first on every visit and never stored (REQ-GVC-020,
// 021); "Just listen today" opens a listening mode in which Play Merc's ten
// seconds sings the five vowels on a tap and nothing listens, with the
// doctor lines. Singing goes on to the voice choice (if none is stored),
// the optional warm-up, which never listens (REQ-GVC-074, 075), the note,
// which Lower and Higher move a semitone a tap, up to four either way, for
// the visit, Merc's ‘ah’ sounding on each new note (FACTS 52, 66), and the
// briefing, whose Start is the only control that asks for the microphone.
//
// One hold, ten seconds, on the kit's hold run (kit/hold-run.ts): Merc's
// five vowels are its Listen phase, the strip lighting with his model; the
// strip goes dark as the take opens, and the names row lights each vowel at
// 0, 2, 4, 6 and 8 s from the first voiced frame, on the frames' clock: a
// pace, never a check. Nothing reads anything from the microphone but pitch
// frames, and nothing compares the voice with the vowel lit. "How did that
// feel?" follows every take that heard a voice (REQ-GVC-022), and only its
// answer offers more singing: the flow is the kit's rule (kit/hold-flow.ts)
// for one hold, with "Effortful" picking the rest card, so this file draws
// what that rule says. A visit has at most three takes, every take
// counted, one abandoned when the page was hidden too. The microphone is
// held only around a take: acquired on the tap that starts one, released
// when it ends, when the viewer leaves the section, when the tab is hidden
// and when the page goes. If it is refused, missing, or the listener fails
// to load, the page carries on in listening mode with "No microphone? ..."
// Nothing is recorded, kept or sent: a take's frames are read and dropped
// (REQ-GVC-003, 004), and only the voice choice and the warm-up's Skip are
// stored. The checkpoint's ending picks the Wrap's card for the visit
// (kit/comfort.ts `VisitEnding`), in memory only.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { clamp, q, qa, store } from '@/features/lessons/kit/dom'
import type { FlowStep, HoldPlan, HoldRecord, } from '@/features/lessons/kit/hold-flow'
import { afterFeeling, afterTake, againAllowed, emptyRecord, withCelebration, withTake, } from '@/features/lessons/kit/hold-flow'
import type { HoldModule, HoldPhase } from '@/features/lessons/kit/hold-run'
import { GAP_SEC, holdOne } from '@/features/lessons/kit/hold-run'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { hz, nameHtml, sharpOf } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import type { RingStills } from '@/features/lessons/kit/sing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import { lightName } from './controls'
import { spokenNote } from './lines'
import type { Line } from './plays'
import { MOVE_SEC, oneVowel, VOWEL_SEC, vowelRun } from './plays'
import type { AfterLines, SingView } from './sing-view'
import { createSingView } from './sing-view'
import type { Vowel } from './vowels'
import { HOME, VOWELS } from './vowels'

/** The page's consumer id with the app's microphone owner. */
const CONSUMER = 'lesson-13'
/** The warm-up's Skip, remembered so a return visit opens it folded. */
export const WARMUP_KEY = 'fyp-l13-warmup'
/** Semitones Lower and Higher may move the note either way (FACTS 52). */
export const MAX_MOVE = 4
/** One hold of ten seconds, and "Effortful" picks the rest card (FACTS 53, 54). */
export const PLAN: HoldPlan = { lengths: [10], restAfterEffort: true }
const HOLD = 1
const LENGTH = PLAN.lengths[0]

/** Every status line the checkpoint says, beside the reader's own. */
export const STATUS = {
  listen: 'Just listening today: the microphone stays off.',
  nomic:
    'No microphone? Sing along anyway: Merc sings the note first, and nothing listens.',
  noAudio: "This browser can't play sound here.",
  voice: "Choose the voice you'll sing with.",
  prepare: 'Warm up if you like, then press Start.',
  asking: 'Asking your browser for the microphone.',
  stopped: 'Stopped listening: the microphone is off.',
  feel: 'How did that feel?',
  breathe: 'Breathe in, low and quiet.',
  sing: 'Sing ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’, two seconds each, moving on as each name lights up.',
  rest: 'Rest for a few easy breaths. Ready when you are.',
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  done: 'Done for today.',
} as const

export const HOLD_HEAD = 'One hold: ten seconds'

/** The note the hold is sung on: the voice's A, moved `move` semitones. */
export const holdNote = (v: Voice, move: number): number =>
  HOME[v] + clamp(move, -MAX_MOVE, MAX_MOVE)

/** The ring's label and the note's readout: "A3 · 220 Hz". */
export const ringLabel = (midi: number): string =>
  `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`

/** The status line after Lower or Higher: "Your note: G sharp 3". */
export const noteStatus = (midi: number): string =>
  `Your note: ${spokenNote(midi)}`

/** The status line as Merc's ten seconds play in the listening mode. */
export const listenStatus = (midi: number): string =>
  `Merc sings ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’ on ${spokenNote(midi)}, two seconds each.`

/** The status line as a hold's phase begins. */
export function phaseStatus(midi: number, p: HoldPhase): string {
  if (p === 'listen')
    return `${HOLD_HEAD}, on ${spokenNote(midi)}. Listen to Merc's note and vowels.`
  return p === 'breathe' ? STATUS.breathe : STATUS.sing
}

/** The vowel the names row lights `t` seconds after the first voiced frame: a pace, never a check. */
export const cueAt = (t: number): Vowel =>
  VOWELS[clamp(Math.floor(t / VOWEL_SEC), 0, VOWELS.length - 1)]

/** The status line after an answer to "How did that feel?". */
export function stepStatus(step: FlowStep): string {
  if (step.next === 'gentle') return STATUS.gentle
  if (step.next === 'enough') return STATUS.enough
  return STATUS.rest
}

/** What the card shows after an answer: the flow's step. */
export const afterLines = (step: FlowStep): AfterLines => ({
  tricky: step.tricky,
  closing: step.next === 'end' ? null : step.next,
  doctor: step.doctor,
  again: step.offers.again,
  done: step.offers.done !== null,
})

/** Whether the browser can make sound at all: without Web Audio nothing plays and nothing listens. */
const hasAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as unknown as { webkitAudioContext?: unknown })
    .webkitAudioContext === 'function'

export function initSing(stills: RingStills): SingView {
  const view = createSingView(stills)
  const card = q('#singCard')
  const warmup = q<HTMLDetailsElement>('#warmup')
  const mic = new MicHold(CONSUMER)
  const light = playLights()
  const storedBefore = VoiceChoice.voice !== null
  let reader: HoldModule | null = null
  let record: HoldRecord = emptyRecord()
  let take: { cancelled: boolean } | null = null
  let mode: 'sing' | 'listen' | 'nomic' = 'sing'
  let move = 0
  // once "Effortful" or "Uncomfortable" is answered, or Done for today
  // pressed, no hold and no Start for the rest of the visit
  let closed = false
  let sung: { readonly which: Which; readonly midi: number } | null = null
  let warm: { readonly run: Run; readonly stop: () => void } | null = null

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'
  const quiet = (): void => {
    if (sung !== null) mercSing(sung.which, sung.midi, false)
    sung = null
  }

  /** Merc sings `line` on the figure, the strip lighting and the names row with it: true if heard to its end. */
  function sing(line: Line, btn: HTMLButtonElement | null): Promise<boolean> {
    quiet()
    const mine = { which: mercOf(line.voice), midi: line.midi }
    const done = view.figure.play(line, {
      onVowel: (v) => lightName(view.names, v),
    })
    sung = mine
    mercSing(mine.which, mine.midi, true)
    if (btn !== null) light(btn, done)
    void done.then(() => {
      if (sung === mine) quiet()
    })
    return done
  }

  /** The figure at rest on the hold's note: Merc's ‘ee’ there, its frame ten seconds. */
  function restOn(midi: number): void {
    view.figure.show({ voice: voiceNow(), midi, vowel: 'ee' })
    view.chart.setWindow(LENGTH)
  }

  // the voice choice shows after either comfort answer: pressed where a
  // voice is stored, and with none, the next state waits for one
  function showListening(): void {
    const v = VoiceChoice.voice
    view.listenWhy(mode === 'nomic' ? 'nomic' : 'listen')
    view.voiceLine(storedBefore)
    view.show(['voice', 'listen'], v === null ? null : 'listen')
    restOn(holdNote(voiceNow(), mode === 'nomic' ? move : 0))
  }

  function toListening(why: 'listen' | 'nomic'): void {
    if (take !== null) take.cancelled = true
    take = null
    mic.release()
    mode = why
    showListening()
    view.status(
      why === 'nomic' && !hasAudio()
        ? `${STATUS.nomic} ${STATUS.noAudio}`
        : STATUS[why],
    )
    view.focusText(q(`[data-listen-why="${why}"]`, card))
  }

  function toVoice(): void {
    view.voiceLine(storedBefore)
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
    view.voiceLine(storedBefore)
    view.show(['voice', 'prepare'], 'note')
    warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
    showNote()
    restOn(holdNote(voiceNow(), move))
    view.status(STATUS.prepare)
    view.focusText(q('[data-panel="prepare"]', card))
  }

  /** Lower or Higher: a semitone a tap, Merc's ‘ah’ on the new note for a second. */
  function moveNote(d: -1 | 1, b: HTMLButtonElement): void {
    move = clamp(move + d, -MAX_MOVE, MAX_MOVE)
    showNote()
    const v = voiceNow()
    const midi = holdNote(v, move)
    view.status(noteStatus(midi))
    void sing(oneVowel(v, midi, 'ah', MOVE_SEC), null)
    // at the end of the range the button goes: keep the keyboard's place on the note
    if (b.hidden) view.focusText(view.noteEl)
  }

  /** Back to Start, while the visit has takes left; else only Done for today. */
  function backToStart(): void {
    if (!closed && againAllowed(record.takes[HOLD])) {
      toPrepare()
      view.status(STATUS.stopped)
      return
    }
    view.show([], 'take')
    view.takeActions({ again: false })
    view.status(STATUS.stopped)
  }

  function recordTake(midi: number, reading: HoldReading, r: HoldModule): void {
    record = withTake(record, HOLD, {
      kind: reading.kind,
      share: reading.share,
    })
    view.reading(reading.line, reading.octaveLine)
    view.chart.describe(r.holdChartWords(spokenNote(midi), reading))
    view.chart.scene.marks =
      reading.settled === null ? [] : [{ t: reading.settled, label: 'settled' }]
    view.now('–')
    const said = `${HOLD_HEAD}. ${reading.line}${reading.octaveLine === null ? '' : ` ${reading.octaveLine}`}`
    const next = afterTake(HOLD, record)
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

  /** Loads the listener and the hold reader and holds the microphone, inside the tap; false if any fails. */
  async function openMic(): Promise<boolean> {
    try {
      reader ??= await import('@/features/lessons/kit/hold-take')
    } catch {
      return false
    }
    return mic.open(Sound.context())
  }

  async function takeHold(): Promise<void> {
    const v = VoiceChoice.voice
    if (take !== null || closed || v === null) return
    if (!againAllowed(record.takes[HOLD])) return
    const which = mercOf(v)
    const midi = holdNote(v, move)
    feelings.reset()
    view.show([], 'take')
    view.reading(null, null)
    view.takeActions(null)
    view.listenPlay(false)
    view.chart.clear()
    view.figure.dark(midi)
    view.status(STATUS.asking)
    view.focusText(view.headEl)
    const me = { cancelled: false }
    take = me
    const ok = await openMic()
    const { mod, listener } = mic
    if (!ok || mod === null || listener === null || reader === null) {
      toListening('nomic')
      return
    }
    // the tab hidden, or the section left, while the listener loaded: that
    // leave came before the microphone did, so let it go here as the leave
    // does, and end the take unstarted
    const hidden = document.hidden
    const gone = hidden || left
    if (gone) leave(hidden)
    let opened = false
    let cue = 0
    const run = vowelRun(v, midi, VOWELS)
    const reading = gone
      ? null
      : await holdOne({
          mod,
          reader,
          listener,
          view,
          which,
          midi,
          length: LENGTH,
          label: ringLabel(midi),
          listen: {
            sec: run.end,
            play: async (audible) => {
              const heard = await view.figure.play(run, {
                audible,
                onVowel: (x) => lightName(view.names, x),
              })
              // the strip goes dark: while the viewer sings, nothing in it is theirs
              view.figure.dark(midi)
              opened = heard && !me.cancelled
              return heard
            },
          },
          cancelled: () => me.cancelled,
          onPhase: (p) => {
            view.phase(p)
            view.status(phaseStatus(midi, p))
            // ‘ee’ lights as the take opens
            if (p === 'breathe')
              cue = window.setTimeout(
                () => lightName(view.names, 'ee'),
                GAP_SEC * 1000,
              )
          },
          onSung: (t) => lightName(view.names, cueAt(t)),
        })
    window.clearTimeout(cue)
    lightName(view.names, null)
    mic.release()
    view.phase(null)
    if (take !== me) return
    take = null
    if (reading !== null) recordTake(midi, reading, reader)
    else {
      // a take that opened counts, though it was left; a demonstration cut short does not
      if (opened) record = withTake(record, HOLD, { kind: 'silent', share: 0 })
      backToStart()
    }
  }

  function onFeel(f: Feeling): void {
    const v = VoiceChoice.voice
    if (v === null) return
    const step = afterFeeling(PLAN, HOLD, f, record)
    if (step.celebrate) {
      record = withCelebration(record, HOLD)
      mercCelebrate(mercOf(v))
    }
    view.after(afterLines(step))
    // the singer's answer outranks the reading: "Uncomfortable" takes the chart and its line away
    view.show(['feel', 'after'], step.reading ? 'take' : null)
    if (step.next === 'gentle' || step.next === 'enough') closed = true
    // after "Effortful" the reading stays, and so does Play Merc's ten seconds
    view.listenPlay(step.next === 'gentle')
    VisitEnding.set(step.restCard ? 'rest' : 'practise')
    view.status(stepStatus(step))
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /** Done for today, on either of its buttons: the checkpoint ends here, the Wrap's card as the answers have set it. */
  function finish(): void {
    closed = true
    for (const b of qa<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button, [data-take-actions] button',
      card,
    ))
      b.hidden = true
    view.status(STATUS.done)
    view.focusText(q('#singStatus'))
  }

  /** Play Merc's ten seconds: the five vowels on the note, nothing listening; a second press stops them. */
  function listenTo(b: HTMLButtonElement): void {
    const v = VoiceChoice.voice
    if (v === null) return
    if (b.classList.contains('is-on')) {
      view.figure.stop()
      return
    }
    const midi = holdNote(v, mode === 'listen' ? 0 : move)
    view.status(listenStatus(midi))
    void sing(vowelRun(v, midi, VOWELS), b)
  }

  /** The warm-up's sigh or slide, Lesson 3's, in Merc's "ooh"; the page's one sound, and a second press stops it. */
  function demo(kind: 'sigh' | 'slide', b: HTMLButtonElement): void {
    const v = VoiceChoice.voice
    if (v === null) return
    const again = b.classList.contains('is-on')
    warm?.stop()
    if (again) return
    const which = mercOf(v)
    const run = playLine(warmUpContour(kind, v), {
      audible: Sound.canPlay(),
      kind: 'merc',
    })
    const stop = (): void => {
      if (warm?.run !== run) return
      warm = null
      run.stop()
      NowPlaying.release(stop)
      mercSing(which, HOME[v], false)
    }
    NowPlaying.claim(stop)
    warm = { run, stop }
    mercSing(which, HOME[v], true)
    light(b, run.done)
    void run.done.then(stop)
  }

  mountComfort(card, {
    onSing: () => {
      mode = 'sing'
      if (!hasAudio()) toListening('nomic')
      else if (VoiceChoice.voice === null) toVoice()
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
  on('[data-sing="start"]', () => void takeHold())
  on('[data-sing="again"]', () => void takeHold())
  on('[data-sing="today"]', finish)
  on('[data-note]', (b) => moveNote(b.dataset.note === 'lower' ? -1 : 1, b))
  on('[data-listen-play]', listenTo)
  on('[data-warm]', (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(WARMUP_KEY, true)
      warmup.open = false
      q('summary', warmup).focus({ preventScroll: true })
    } else if (w === 'sigh' || w === 'slide') demo(w, b)
  })

  // let go of the microphone whenever the viewer leaves: the section, the
  // tab, the page; Merc's demonstration stops with it, cancelling the hold
  const leave = (now: boolean): void => {
    if (take !== null) {
      take.cancelled = true
      view.figure.stop()
    }
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
  return view
}
