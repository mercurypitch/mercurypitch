// ============================================================
// Lesson 3 Sing it — three notes back to Merc, the first page that listens
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 7), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md). The comfort check comes
// first on every visit and is never stored (REQ-GVC-020, 021); "Just listen
// today" opens a listening mode in which Merc sings each note on a tap and
// nothing listens, with the rest line and the doctor lines. Singing goes on
// to the voice choice (if Step 4 left none), the optional warm-up, which
// never listens (REQ-GVC-074, 075), and the briefing, whose Start is the
// only control that asks for the microphone.
//
// Each note is A, then G a tone below, then B a tone above, around the
// chosen voice's A (FACTS 45): Merc's note, then the take (sing-take.ts),
// then one line about the sound, with Again while the note has had fewer
// than three tries (FACTS 16) and Next note or Done. The microphone is held
// only around a take: acquired on the tap that starts one, released when it
// ends, when the viewer leaves the section, when the tab is hidden and when
// the page goes. "How did that feel?" follows the third note (REQ-GVC-022);
// its answer decides what may still be shown and offered (kit/comfort.ts),
// and picks the Wrap's practise card for the visit. If the microphone is
// refused, missing, or the listener fails to load, the page carries on in
// listening mode with "No microphone? ..." Nothing is recorded, kept or
// sent: a take's frames are read and dropped (REQ-GVC-003, 004), and only
// the voice choice and the warm-up's Skip are stored.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { afterFeeling, mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, store, wait } from '@/features/lessons/kit/dom'
import type { Listener, TakeReading } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercListen, mercSing, } from '@/features/lessons/kit/merc-duo'
import { hz, nameHtml, sharpOf, signName } from '@/features/lessons/kit/notes'
import type { RingStills } from '@/features/lessons/kit/sing'
import { playContour, playTone, Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import type { ListenModule } from './sing-take'
import { chartSummary, MERC_SEC, singOne } from './sing-take'
import type { SingView } from './sing-view'
import { createSingView } from './sing-view'

/** The page's consumer id with the app's microphone owner. */
const CONSUMER = 'lesson-03'
/** The warm-up's Skip, remembered so a return visit opens it folded. */
const WARMUP_KEY = 'fyp-l03-warmup'

/** A, then G a tone below, then B a tone above, around the voice's A (FACTS 45). */
export function notesFor(v: Voice): number[] {
  const a = homeOf(v)
  return [a, a - 2, a + 2]
}

const STATUS = {
  listen: 'Just listening today: the microphone stays off.',
  nomic:
    'No microphone? Sing along anyway: Merc sings each note, and nothing listens.',
  voice: "Choose the voice you'll sing with.",
  prepare: 'Warm up if you like, then press Start.',
  asking: 'Asking your browser for the microphone.',
  stopped: 'Stopped listening: the microphone is off.',
  feel: 'How did that feel?',
} as const

interface Run {
  readonly notes: readonly number[]
  readonly which: Which
  index: number
  readonly takes: TakeReading[][]
  readonly celebrated: boolean[]
}

const newRun = (v: Voice): Run => ({
  notes: notesFor(v),
  which: mercOf(v),
  index: 0,
  takes: [[], [], []],
  celebrated: [false, false, false],
})

const ringLabel = (midi: number): string =>
  `${nameHtml(sharpOf(midi))} · ${Math.round(hz(midi))} Hz`

export function initSing(stills: RingStills): void {
  const view: SingView = createSingView(stills)
  const card = q('#singCard')
  const warmup = q<HTMLDetailsElement>('#warmup')
  let mod: ListenModule | null = null
  let listener: Listener | null = null
  let run: Run | null = null
  let take: { cancelled: boolean } | null = null
  let mode: 'sing' | 'listen' | 'nomic' = 'sing'
  let rerunUsed = false
  let busyDemo = false

  const release = (now = false): void => {
    if (now) listener?.releaseNow()
    else listener?.release()
    listener = null
  }

  /** Loads the listener and holds the microphone, inside the tap that asked; false if either fails. */
  async function openMic(context: AudioContext | null): Promise<boolean> {
    if (context === null) return false
    try {
      mod ??= await import('@/features/lessons/kit/listen')
      if (listener === null || !listener.holding)
        listener = await mod.listen(CONSUMER, context)
      return true
    } catch {
      return false
    }
  }

  function showListening(): void {
    const v = VoiceChoice.voice
    view.listenWhy(mode === 'nomic' ? 'nomic' : 'listen')
    view.show(
      v === null ? ['listen', 'voice'] : ['listen'],
      v === null ? null : 'listen',
    )
    if (v !== null)
      view.listenNames(notesFor(v).map((m) => signName(sharpOf(m))))
    view.chart.setTarget(homeOf(v ?? 'lower'))
  }

  function toListening(why: 'listen' | 'nomic'): void {
    if (take !== null) take.cancelled = true
    take = null
    release()
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

  function toPrepare(): void {
    view.show(['prepare'], null)
    warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
    view.status(STATUS.prepare)
    view.focusText(q('[data-panel="prepare"]', card))
  }

  function noteActions(r: Run): void {
    const i = r.index
    const tries = r.takes[i].length
    view.actions({
      again: mod?.canTryAgain(tries) ?? false,
      next: i < r.notes.length - 1,
      done: i === r.notes.length - 1,
    })
  }

  function record(r: Run, reading: TakeReading): void {
    const i = r.index
    const midi = r.notes[i]
    r.takes[i].push(reading)
    view.reading(reading.line, reading.octaveLine)
    view.chart.describe(chartSummary(midi, reading))
    view.status(
      `Note ${i + 1} of 3: ${reading.line}${reading.octaveLine === null ? '' : ` ${reading.octaveLine}`}`,
    )
    // one celebration, for a note's first take in the band
    if (reading.landed && !r.celebrated[i]) {
      r.celebrated[i] = true
      mercCelebrate(r.which)
    }
    noteActions(r)
    view.focusText(view.readingEl)
  }

  async function takeNote(): Promise<void> {
    const r = run
    if (r === null) return
    const i = r.index
    const midi = r.notes[i]
    const name = signName(sharpOf(midi))
    view.show([], 'take')
    view.reading(null, null)
    view.actions(null)
    view.noteHead(`Note ${i + 1} of 3`)
    view.status(`Note ${i + 1} of 3, ${name}: listen to Merc.`)
    view.focusText(view.headEl)
    const me = { cancelled: false }
    take = me
    if (
      !(await openMic(Sound.context())) ||
      mod === null ||
      listener === null
    ) {
      toListening('nomic')
      return
    }
    // the tab hidden, or the section left, while the listener loaded: that
    // leave came before the microphone did, so let it go here as the leave
    // does, and end the take unstarted
    const hidden = document.hidden
    const gone = hidden || left
    if (gone) leave(hidden)
    const reading = gone
      ? null
      : await singOne({
          mod,
          listener,
          view,
          which: r.which,
          midi,
          label: ringLabel(midi),
          cancelled: () => me.cancelled,
          onTurn: () =>
            view.status(
              `Note ${i + 1} of 3, ${name}: your turn. Sing it back at about speaking volume.`,
            ),
        })
    release()
    if (take !== me) return
    take = null
    if (reading === null) {
      view.status(STATUS.stopped)
      noteActions(r)
      return
    }
    record(r, reading)
  }

  let asking = false

  /** A fresh run of the three notes: the microphone first, asked inside the tap. */
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
    const ok = await openMic(context)
    asking = false
    if (!ok) {
      toListening('nomic')
      return
    }
    run = newRun(v)
    await takeNote()
  }

  // the question, then its answer, take the take's place: a last reading's
  // "Listen again ..." must not stand beside "That's enough singing for today"
  function toFeel(): void {
    view.show(['feel'], null)
    view.status(STATUS.feel)
    view.focusText(q('#feelQ'))
  }

  function onFeel(f: Feeling): void {
    const r = run
    const m = mod
    if (r === null || m === null) return
    const a = afterFeeling(f)
    const count = m.countRun(r.takes)
    const countText = a.count ? (m.countLine(count) ?? m.NONE_HEARD_LINE) : null
    view.after({
      count: countText,
      tricky: a.tricky && m.trickyAfter(count),
      closing: a.closing,
      doctor: a.doctor,
      again: a.again && !rerunUsed,
    })
    view.show(['feel', 'after'], null)
    VisitEnding.set(a.rest ? 'rest' : 'practise')
    const closing =
      a.closing === null ? null : q(`[data-closing="${a.closing}"]`, card)
    view.status(countText ?? closing?.textContent?.trim() ?? STATUS.feel)
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /** The three notes once more from the start, offered once a visit after "Easy" or "Workable". */
  function rerun(): void {
    if (rerunUsed) return
    rerunUsed = true
    feelings.reset()
    void startRun()
  }

  async function listenTo(i: number): Promise<void> {
    const v = VoiceChoice.voice
    if (v === null || view.ring.busy) return
    const midi = notesFor(v)[i]
    const which = mercOf(v)
    const other: Which = which === 'blue' ? 'orange' : 'blue'
    const audible = Sound.canPlay()
    view.chart.setTarget(midi)
    view.chart.scene.glow = 1
    view.status(`Merc sings ${signName(sharpOf(midi))}.`)
    mercSing(which, midi, true)
    mercListen(other, true)
    void view.ring.run({
      which,
      label: ringLabel(midi),
      listen: MERC_SEC,
      turn: 0,
    })
    await playTone(hz(midi), MERC_SEC, { kind: 'merc', audible })
    view.chart.scene.glow = 0
    mercSing(which, midi, false)
    mercListen(other, false)
  }

  async function demo(kind: 'sigh' | 'slide'): Promise<void> {
    const v = VoiceChoice.voice
    if (v === null || busyDemo) return
    busyDemo = true
    const which = mercOf(v)
    // the sigh down a fifth, the slide up to it and back (FACTS 37, 46a)
    const points = warmUpContour(kind, v)
    mercSing(which, homeOf(v), true)
    await playContour(points, { kind: 'merc' })
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
  on('[data-sing="again"]', () => void takeNote())
  on('[data-sing="next"]', () => {
    if (run === null) return
    run.index = Math.min(run.notes.length - 1, run.index + 1)
    void takeNote()
  })
  on('[data-sing="done"]', toFeel)
  on('[data-sing="rerun"]', rerun)
  on('[data-listen-note]', (b) => void listenTo(Number(b.dataset.listenNote)))
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
    release(now)
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop a take; once
  // away, `left` holds until the section is back, for a take still opening
  let away = 0
  let left = false
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    if (entries.some((e) => !e.isIntersecting))
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
