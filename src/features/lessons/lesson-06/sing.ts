// ============================================================
// Lesson 6 Sing it — one tune from two starting notes, nothing listening
// ============================================================
//
// The comfort check, the voice choice, Merc's two versions, the guide with
// its count-in and breath mark, Move do and "How did that feel?" after
// every sweep (WEB-SPEC, Toys 6). What shows when is the pure flow's
// (sing-flow.ts); this plays and draws it. Play the first version sings
// both lines from do = D3, or D4 for the higher voice, in Merc's "ooh", and
// Play the second version the same three semitones higher, the path
// lighting in the app's target amber while the ring shows the still of the
// Merc singing. Start the guide, once a version has played, is the
// viewer's turn: do of the version last played, once and softly, then a
// chrome line sweeps the path for 9.6 s while the ring breathes. The page
// has no microphone and scores nothing; only the voice is stored.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { hz } from '@/features/lessons/kit/notes'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import { mountGuide } from '@/features/lessons/kit/slide-guide'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import type { Playing } from './examples'
import { playNotes } from './examples'
import type { Panel, SingEvent } from './sing-flow'
import { nextState, openState, singView } from './sing-flow'
import type { VersionNo } from './sing-guide'
import { BREATH_SEC, clampMove, COUNT_IN, COUNT_IN_SEC, guidePath, guideRows, MOVE_MAX, readoutHtml, ringLabel, VERSION_SEC, versionDo, versionNotes, } from './sing-guide'

/** The status line while Merc sings, and while the guide sweeps. */
export const RUNNING = {
  model: (n: VersionNo): string =>
    `Merc sings the ${n === 1 ? 'first' : 'second'} version.`,
  guide: 'Your turn: sing with the line.',
} as const

/** Keeps the keyboard's place on text, never on a button. */
function focusText(el: HTMLElement | null): void {
  if (el === null) return
  el.tabIndex = -1
  el.focus({ preventScroll: true })
}

export function initSing(stills: RingStills): void {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panels = qa('[data-panel]', card)
  const guideRoot = q('#tuneGuide', card)
  const startBtn = q<HTMLButtonElement>('[data-guide-start]', card)
  const hint = q('[data-guide-hint]', card)
  const versionBtns = qa<HTMLButtonElement>('[data-version]', card)
  const moves = qa<HTMLButtonElement>('[data-move-do]', card)
  const readout = q('[data-do-readout]', card)
  const feelPanel = q('[data-panel="feel"]', card)
  const ringEl = q('.ring', card)
  const ring = mountRing(ringEl, {
    stills,
    calm: true,
    words: {
      listen: 'Listen',
      turn: (n) => `Sing with the line · ${n}`,
      done: 'Rest',
    },
  })

  let state = openState(VoiceChoice.voice)
  let shift = 0
  // the version the guide shows: the one last played
  let shown: VersionNo = 1
  let playing: Playing | null = null

  const voice = (): Voice => state.voice ?? 'lower'
  const doMidi = (): number => versionDo(voice(), shown, shift)
  const guide = mountGuide(guideRoot, {
    rows: guideRows(doMidi()),
    path: guidePath(doMidi()),
    rest: 'amber',
    breaths: [BREATH_SEC],
  })
  const busy = (): boolean => guide.busy || playing !== null

  function render(): void {
    const v = singView(state)
    for (const p of panels)
      p.hidden = !v.panels.includes(p.dataset.panel as Panel)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== v.voiceLine
    for (const el of qa('[data-sing-part]', card)) el.hidden = !v.singParts
    startBtn.setAttribute('aria-disabled', String(!v.startEnabled))
    // the hint belongs to the guide: just listening, there is no guide to start
    hint.hidden = !v.singParts || v.startEnabled
    for (const el of qa('[data-after]', feelPanel))
      el.hidden = el.dataset.after !== v.after
    q('[data-after-doctor]', feelPanel).hidden = !v.doctor
    statusEl.textContent = v.status
    if (VisitEnding.ending !== v.card) VisitEnding.set(v.card)
  }

  function dispatch(e: SingEvent): void {
    state = nextState(state, e)
    render()
  }

  /** The guide, the readout, the ring's label and Move do's ends follow the voice, the version and Move do. */
  function relabel(): void {
    guide.set(guideRows(doMidi()), guidePath(doMidi()))
    readout.innerHTML = readoutHtml(voice(), shift)
    q('.ring-note', ringEl).innerHTML = ringLabel(doMidi())
    for (const b of moves) {
      const d = Number(b.dataset.moveDo)
      b.disabled = (d < 0 && shift <= -MOVE_MAX) || (d > 0 && shift >= MOVE_MAX)
    }
  }

  async function playVersion(b: HTMLButtonElement): Promise<void> {
    if (busy() || state.voice === null) return
    const n: VersionNo = b.dataset.version === '2' ? 2 : 1
    shown = n
    relabel()
    const d = doMidi()
    b.classList.add('is-on')
    statusEl.textContent = RUNNING.model(n)
    const run = playNotes(versionNotes(d), {
      audible: Sound.canPlay(),
      kind: 'merc',
    })
    playing = run
    void ring.run({
      which: mercOf(voice()),
      label: ringLabel(d),
      listen: VERSION_SEC,
      turn: 0,
    })
    await Promise.all([run.done, guide.model()])
    playing = null
    b.classList.remove('is-on')
    dispatch({ type: 'played', version: n })
  }

  /** The ring through the guide: ready through the count-in, then breathing with the sweep. */
  function ringThroughGuide(d: number): void {
    const quiet = {
      which: mercOf(voice()),
      label: ringLabel(d),
      ripples: false,
    } as const
    void ring.run({
      ...quiet,
      listen: COUNT_IN_SEC,
      turn: 0,
      words: { listen: 'Get ready' },
    })
    window.setTimeout(
      () => void ring.run({ ...quiet, listen: 0, turn: VERSION_SEC }),
      COUNT_IN_SEC * 1000,
    )
  }

  async function startGuide(): Promise<void> {
    const v = singView(state)
    const last = state.played
    if (!v.singParts || last === null || busy()) return
    shown = last
    relabel()
    const d = doMidi()
    dispatch({ type: 'sweepStart' })
    feelings.reset()
    statusEl.textContent = RUNNING.guide
    startBtn.classList.add('is-on')
    // the count-in: do of the version last played, once and softly
    if (Sound.canPlay())
      Sound.voice(hz(d), { dur: COUNT_IN.note, gain: COUNT_IN.gain })
    ringThroughGuide(d)
    await guide.sweep(COUNT_IN_SEC)
    startBtn.classList.remove('is-on')
    dispatch({ type: 'sweepEnd' })
    focusText(q<HTMLElement>('.feel-q', feelPanel))
  }

  mountComfort(card, {
    onSing: () => {
      dispatch({ type: 'comfort', comfort: 'sing' })
      focusText(card.querySelector('[data-panel]:not([hidden]) p'))
    },
    onListen: () => {
      dispatch({ type: 'comfort', comfort: 'listen' })
      focusText(card.querySelector('[data-panel]:not([hidden]) p'))
    },
  })
  bindVoiceButtons(card, (v) => {
    dispatch({ type: 'voice', voice: v })
    if (!busy()) relabel()
  })
  const feelings = mountFeelings(
    feelPanel,
    (f: Feeling) => dispatch({ type: 'feel', feeling: f }),
    { changeable: true },
  )
  for (const b of versionBtns)
    b.addEventListener('click', () => void playVersion(b))
  startBtn.addEventListener('click', () => void startGuide())
  for (const b of moves)
    b.addEventListener('click', () => {
      if (busy()) return
      shift = clampMove(shift + Number(b.dataset.moveDo))
      relabel()
    })

  relabel()
  render()
}
