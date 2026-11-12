// ============================================================
// Lesson 16 Sing it — two phrases read from the page, each found from do
// ============================================================
//
// The card on this page's flow (sing-flow.ts), WEB-SPEC Toys 6: the
// comfort check, every visit and never stored; the voice choice, which
// picks who sings, Merc for the lower voice and Tavi for the higher, and
// the learner's staff, the bass clef or the treble; Your turn with the stop
// line and "What this does"; then Start, the only control that asks for
// the microphone.
//
// The staff is the kit's staff toy with the phrase as plain noteheads
// (kit/staff.ts): the first phrase, do, re, mi, re, do, with its syllables
// and the house on do; the second, do, so, mi, re, do, with only the house
// and a Names on · off switch, off. It takes no taps and has no pitch-line
// switch. Start opens the microphone, then the voice sings the start, do
// and then do, mi, so, mi, do, 4.4 s, lighting only the written do's amber,
// so the start never shows where mi or so sit (FACTS 42). 0.4 s after it
// the first note lights and the take reads along (sing-take.ts, loaded on
// the first Start): nothing plays during a take, and each next note lights
// as the voice passes the one lit, while Merc and Tavi listen in the hero
// (kit/merc-duo.ts `mercListen`). Then the pitch line, drawn only now
// (sing-chart.ts), the lines, one a note, and "How did that feel?". Beside
// the staff stands the still of the one who sings: Merc for the lower
// voice, Tavi for the higher. Nothing celebrates a note.
//
// The start, Play the start and Play Merc's phrases are the page's one
// sound (kit/now-playing.ts). Sound turned off during the start ends it
// with no take counted. Leaving the section or hiding the page during a
// take abandons it, and it counts (kit/leave.ts; FACTS 50). Focus moves
// only to text, never to a button, so Space never starts a take by itself
// (REQ-GVC-080). Only the voice is stored, by the kit's voice choice; the
// visit's ending picks the Wrap's card (kit/comfort.ts `VisitEnding`).

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { clefForVoice, midiOf } from '@/features/lessons/kit/staff-places'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import mercBlue from '@/features/lessons/lesson-01/assets/merc-blue.png'
import mercOrange from '@/features/lessons/lesson-01/assets/merc-orange.png'
import type { PhraseId, SingEvent, SingView, SingVisit } from './sing-flow'
import { HINT, nextVisit, openVisit, viewOf } from './sing-flow'
import type * as TakeKit from './sing-take'
import type { SungNote } from './sounds'
import { DO, mercPhrases, phraseOf, PHRASES, runOf, startNotes } from './sounds'

/** The page's id with the microphone's owner. */
export const CONSUMER = 'lesson-16'

/** The quiet between the start's end and the first note lighting, s (FACTS 42). */
export const OPEN_SEC = 0.4

/** Whether this browser can play and listen at all. */
export const hasWebAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext ===
    'function'

/** The still beside the staff: the one who sings, for each voice. */
const STILL: Readonly<Record<Voice, { src: string; alt: string }>> = {
  lower: {
    src: mercBlue,
    alt: 'Merc, who sings the start for the lower voice',
  },
  higher: {
    src: mercOrange,
    alt: 'Tavi, who sings the start for the higher voice',
  },
}

/** The syllable a degree from do is sung on. */
const SYLLABLES = ['Do', 'Re', 'Mi', 'Fa', 'So'] as const

/** Each note's label in a phrase's lines: "Re". */
export const labelsOf = (id: PhraseId): string[] =>
  PHRASES[id].map((d) => SYLLABLES[d])

/** The staff's state for phrase `id` in `clef`: plain noteheads, the house under the first do, no taps and no pitch line. */
export function singStaff(
  id: PhraseId,
  clef: Clef,
  names: boolean,
): StaffState {
  return {
    staff: 'single',
    clef,
    tap: 'none',
    noLanes: true,
    // the house on do, under the phrase's first note
    score: phraseOf(id, clef).map((note, i) => ({ note, home: i === 0 })),
    solfa: DO[clef],
    names,
  }
}

export interface SingIt {
  readonly visit: () => SingVisit
}

export function initSing(
  o: {
    /** The take's module, loaded on the first Start; a test passes its own. */
    readonly loadTake?: () => Promise<typeof TakeKit>
  } = {},
): SingIt {
  const root = q('#sing')
  const card = q('#singCard', root)
  const status = q('#singStatus', root)
  const staffRoot = q('#singStaff', root)
  const namesSeg = q('[data-sing-names]', root)
  const hint = q('#startHint', root)
  const readings = q<HTMLOListElement>('[data-readings]', root)
  const live = q('#singLive', root)
  const chart = q('#singChart', live)
  const still = q<HTMLImageElement>('.sing-merc', staffRoot)
  const button = (name: string): HTMLButtonElement =>
    q<HTMLButtonElement>(`[data-sing="${name}"]`, root)
  const loadTake = o.loadTake ?? (() => import('./sing-take'))

  let visit = openVisit({
    voice: VoiceChoice.voice,
    // unset turns on at the first tap: only off is silent
    sound: Sound.state !== 'off',
    webAudio: hasWebAudio(),
  })
  const mic = new MicHold(CONSUMER)
  // what plays now: the start, Play the start or Play Merc's phrases
  let run: Run | null = null
  let timers: number[] = []
  // the take under way: how to cancel it
  let leaving = false
  // the phrase the staff shows, and the second phrase's names choice
  let shown: PhraseId = 1
  let names2 = false

  const clef = (): Clef =>
    visit.voice === null ? 'bass' : clefForVoice(visit.voice)

  const staff: StaffToy = mountStaff(staffRoot, {
    state: singStaff(1, clef(), true),
    owner: NowPlaying,
  })
  show(1)

  /** The staff shows phrase `id`, and the still the one who sings it. */
  function show(id: PhraseId): void {
    shown = id
    staff.setState(singStaff(id, clef(), id === 1 ? true : names2))
    const s = STILL[clef() === 'bass' ? 'lower' : 'higher']
    if (still.getAttribute('src') !== s.src) still.src = s.src
    still.alt = s.alt
  }

  function say(text: string | null): void {
    if (text !== null && status.textContent !== text) status.textContent = text
  }

  /** Lights the columns of `n` amber as it sounds, the phrase it belongs to showing. */
  function lightAt(n: SungNote): void {
    if (n.lights === null) return
    const { phrase, cols } = n.lights
    timers.push(
      window.setTimeout(() => {
        if (shown !== phrase) show(phrase)
        staff.light([...cols], 'amber')
      }, n.t * 1000),
      window.setTimeout(() => staff.light(null), (n.t + n.dur) * 1000),
    )
  }

  /** Stops what plays, its lights out; the take, if one runs, carries on. */
  function quiet(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    const r = run
    run = null
    r?.stop()
    staff.light(null)
    NowPlaying.release(quiet)
  }

  /** Sings `notes` in the chosen voice, lighting as they sound; true when heard to the end. */
  async function sing(notes: readonly SungNote[]): Promise<boolean> {
    quiet()
    NowPlaying.claim(quiet)
    const r = playNotes(runOf(notes), {
      audible: Sound.canPlay(),
      kind: 'merc',
    })
    run = r
    notes.forEach(lightAt)
    const heard = await r.done
    if (run !== r) return false
    run = null
    timers = []
    staff.light(null)
    NowPlaying.release(quiet)
    return heard
  }

  function send(e: SingEvent): void {
    visit = nextVisit(visit, e)
    render()
  }

  /** The panels and their lines: which show, and which line each says. */
  function renderPanels(v: SingView): void {
    for (const p of qa<HTMLElement>('[data-panel]', card))
      p.hidden = !v.panels.includes(p.dataset.panel as never)
    for (const l of qa<HTMLElement>('[data-voice-line]', card))
      l.hidden = l.dataset.voiceLine !== v.voiceLine
    for (const el of qa<HTMLElement>('.turn, .stop-line, .brief', card))
      el.hidden = !v.singParts
    q('[data-nomic]', card).hidden = v.listenWhy !== 'nomic'
    for (const p of qa<HTMLElement>('[data-after]', card))
      p.hidden = p.dataset.after !== v.closing
    q('[data-after-cue]', card).hidden = !v.cue
    for (const d of qa<HTMLElement>('.doctor', card)) d.hidden = !v.doctor
    // the pitch line and the lines: after a take with voice, never during one
    live.hidden = !v.readings
    readings.hidden = !v.readings || readings.childElementCount === 0
  }

  /** The controls: only those the flow offers, never one disabled. */
  function renderControls(v: SingView): void {
    button('start').hidden = v.start !== 'start'
    button('again').hidden = v.start !== 'again'
    button('phrase-2').hidden = v.start !== 'phrase-2'
    button('stop').hidden = !v.stopHere
    button('play-start').hidden = !v.playStart
    button('merc').hidden = !v.merc
    hint.textContent = v.hint === null ? '' : HINT[v.hint]
    namesSeg.hidden = v.phrase !== 2 || v.listenWhy !== null
  }

  function render(): void {
    const v: SingView = viewOf(visit)
    renderPanels(v)
    renderControls(v)
    if (visit.taking === null && v.phrase !== shown) show(v.phrase)
    VisitEnding.set(v.card)
    say(v.status)
  }

  /** The lines under the staff after a take: one a note, in order. */
  function writeLines(lines: readonly string[]): void {
    readings.replaceChildren(
      ...lines.map((text) => {
        const li = document.createElement('li')
        li.textContent = text
        return li
      }),
    )
  }

  /** Merc and Tavi listen while a take runs, and stand easy after it. */
  function listening(on: boolean): void {
    mercListen('blue', on)
    mercListen('orange', on)
  }

  /** Ends a Start before its take: the microphone let go, and no take counted. */
  function cut(): void {
    mic.release()
    if (visit.taking !== null) send({ type: 'silenced' })
  }

  /** Start, Start again or Start phrase 2: the microphone, then the start sung. */
  async function begin(): Promise<void> {
    if (!Sound.canPlay()) {
      send({ type: 'sound', on: false })
      send({ type: 'begin' })
      return
    }
    quiet()
    send({ type: 'sound', on: true })
    if (!(await mic.open(Sound.context()))) {
      send({ type: 'nomic' })
      return
    }
    send({ type: 'begin' })
    const phrase = visit.taking
    if (phrase === null) {
      mic.release()
      return
    }
    show(phrase)
    readings.replaceChildren()
    leaving = false
    const heard = await sing(startNotes(clef(), phrase))
    if (!heard || visit.taking !== phrase) {
      cut()
      return
    }
    await new Promise((r) => window.setTimeout(r, OPEN_SEC * 1000))
    if (leaving || Sound.state === 'off' || visit.taking !== phrase) {
      cut()
      return
    }
    await take(phrase)
  }

  /** The take: the first note lit, the reader along the phrase, then its lines. */
  async function take(phrase: PhraseId): Promise<void> {
    staff.light(0)
    send({ type: 'listen' })
    listening(true)
    const kit = await loadTake()
    const notes = phraseOf(phrase, clef()).map(midiOf)
    const labels = labelsOf(phrase)
    const end =
      mic.mod === null || mic.listener === null
        ? null
        : await kit.runTake({
            mod: mic.mod,
            listener: mic.listener,
            notes,
            labels,
            light: (i) => staff.light(i),
            cancelled: () => leaving,
          })
    mic.release()
    listening(false)
    staff.light(null)
    if (end === null || end.kind === 'left') {
      send({ type: 'took', voiced: true, abandoned: true })
      return
    }
    writeLines(end.lines)
    if (end.pitch !== null) kit.drawPitchLine(chart, end.pitch, notes, labels)
    feelings.reset()
    send({ type: 'took', voiced: end.voiced, abandoned: false })
  }

  // ---------------------------------------------------------------- wiring
  mountComfort(card, {
    onSing: () => send({ type: 'comfort', comfort: 'sing' }),
    onListen: () => send({ type: 'comfort', comfort: 'listen' }),
  })
  bindVoiceButtons(card, (voice) => {
    send({ type: 'voice', voice })
    if (visit.taking === null) show(shown)
  })
  const feelings = mountFeelings(card, (feeling: Feeling) =>
    send({ type: 'feel', feeling }),
  )
  for (const name of ['start', 'again', 'phrase-2'])
    button(name).addEventListener('click', () => void begin())
  button('stop').addEventListener('click', () => {
    quiet()
    send({ type: 'halt' })
  })
  button('play-start').addEventListener('click', () => {
    show(1)
    void sing(startNotes(clef(), 1))
  })
  button('merc').addEventListener('click', () => void sing(mercPhrases(clef())))
  for (const b of qa<HTMLButtonElement>('[data-names]', namesSeg))
    b.addEventListener('click', () => {
      names2 = b.dataset.names === 'on'
    })
  Sound.subscribe((state) => {
    const on = state !== 'off'
    // sound off during the start ends it, with no take counted
    if (!on && visit.taking !== null && !visit.listening) quiet()
    send({ type: 'sound', on })
  })
  onLeave(root, () => {
    quiet()
    leaving = true
  })
  render()
  return { visit: () => visit }
}
