// ============================================================
// Lesson 9 Sing it — do-mi-so-do, sung back to Merc a rung at a time
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 4), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md), as Lessons 3, 5, 7 and 8
// hold theirs. What the card offers is the pure rule in ladder-flow.ts:
// this file draws what `offers` says, every control shown exactly when it
// is offered and absent otherwise, never disabled (Move do at its ends
// aside, as the kit has it), and sends the rule each event. The comfort
// check comes first on every visit and is never stored (REQ-GVC-020, 021);
// with no voice stored the voice choice comes before either path, since it
// picks the Merc who sings. "Just listen today" shows its line and the
// doctor lines at once, beside the voice choice; then the ladder choice,
// Move do and Play Merc's ladder, and nothing listens. Singing offers the
// optional warm-up, which never listens (REQ-GVC-074, 075), and the
// briefing. Without Web Audio the card listens only, with no Start, and
// Play Merc's ladder lights the rungs in silence beside the hint.
//
// The chart (#singChart) is the ladder chart's live frame: the pressed
// ladder's slots, faint, 1.5 s each, its rungs named, moving with Move do,
// its summary saying where do is. Play Merc's ladder sings the pressed
// ladder in the chosen voice, each rung lighting as he sings it, and is the
// page's one sound (kit/now-playing.ts). With the sound off a play still
// draws, and Start plays nothing and asks for nothing: the hint beside it
// says why, naming the button pressed (WEB-SPEC, state 5). The status line
// says each state's own words, from the card or the flow's lines, and is
// written only when they change, so a screen reader hears each once.
//
// Only the warm-up's Skip (`fyp-l09-warmup`) and the voice (`fyp-voice`,
// through the kit's voice choice) are stored. The ending picks the Wrap's
// card for the visit, in memory only (kit/comfort.ts's `VisitEnding`).
// Leaving the section, or the page hidden, stops whatever the card plays.
// With the sound on, Start does nothing more until the take is wired.

import { mountComfort, mountPractiseCard, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, store } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { nextShift, setMoveEnds } from '@/features/lessons/kit/move-do'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playLine, playNotes } from '@/features/lessons/kit/run'
import type { SoundState } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import type { LadderChart, PhraseDrawing } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import type { LadderId } from './ladder-data'
import type { LadderEvent, LadderOffers, LadderVisit } from './ladder-flow'
import { LADDER_LINES, LADDER_ORDER, next, offers, openVisit, } from './ladder-flow'
import { mercLadderNotes } from './sounds'

/** The warm-up's Skip, remembered so a return visit opens it folded. */
export const WARMUP_KEY = 'fyp-l09-warmup'

/** Whether the browser has Web Audio at all; asking makes no AudioContext. */
export const hasWebAudio = (): boolean =>
  typeof window.AudioContext !== 'undefined' || 'webkitAudioContext' in window

/** Whether a play would sound, as `Sound.canPlay` reads the switch: unset turns on at the first play. */
export const wouldSound = (s: SoundState): boolean => s !== 'off'

/** Writes a live line only when its words change, so a screen reader hears it once. */
function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** Keeps the keyboard's place on text, never on a button. */
function focusText(el: HTMLElement | null): void {
  if (el === null) return
  el.tabIndex = -1
  el.focus({ preventScroll: true })
}

/** The first line showing in the card's shown panels. */
function shownLine(card: HTMLElement): HTMLElement | null {
  const lines = card.querySelectorAll<HTMLElement>(
    '[data-panel]:not([hidden]) p',
  )
  return Array.from(lines).find((p) => p.closest('[hidden]') === null) ?? null
}

/** The card's own words that serve as status lines: the comfort question and the briefing's head. */
export interface CardWords {
  readonly comfort: string
  readonly turn: string
}

const VOICE_LINE = {
  stored: 'voiceStored',
  none: 'voiceNone',
  listen: 'voiceListen',
} as const

/**
 * The status line for where the card stands, outside Merc's ladder and the
 * take: each state's own words, from the card or the flow's lines.
 */
export function statusOf(o: LadderOffers, words: CardWords): string {
  switch (o.stage) {
    case 'comfort':
      return words.comfort
    case 'voice':
      return LADDER_LINES[VOICE_LINE[o.voiceLine]]
    case 'listen':
      return LADDER_LINES.listen
    case 'nomic':
      return LADDER_LINES.nomic
    case 'briefing':
      return words.turn
    case 'take':
      return LADDER_LINES.take
    default:
      return ''
  }
}

/** Which of the card's panels show for what the flow offers. */
const PANELS: Readonly<Record<string, (o: LadderOffers) => boolean>> = {
  comfort: (o) => o.stage === 'comfort',
  listen: (o) => o.listenLine || o.stage === 'nomic',
  voice: (o) => o.voiceChoice,
  prepare: (o) =>
    o.warmUp || o.ladders.length > 0 || o.moveDo || o.playMerc || o.start,
  feel: (o) => o.ask,
  after: (o) =>
    o.stage === 'noVoice' ||
    o.stage === 'spent' ||
    (o.stage === 'reading' && o.locked),
}

/** The briefing's words (state 5), which show with Start. */
const BRIEFING =
  '.turn, .turn-how, .stop-line, .brief, .brief-how, .brief-lines'

/** What Sing it hands back: the visit as it stands, for the page's tests. */
export interface SingIt {
  readonly visit: LadderVisit
  readonly chart: LadderChart
}

export function initSing(): SingIt {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panels = qa('[data-panel]', card)
  const prepare = q('[data-panel="prepare"]', card)
  const warmup = q<HTMLDetailsElement>('#warmup', card)
  const ladderBtns = qa<HTMLButtonElement>('[data-ladder]', prepare)
  const moves = qa<HTMLButtonElement>('[data-move-do]', prepare)
  const mercBtn = q<HTMLButtonElement>('[data-merc-ladder]', prepare)
  const startBtn = q<HTMLButtonElement>('[data-sing="start"]', prepare)
  const startHint = q('[data-start-hint]', prepare)
  const liveEl = q('#singLive', card)
  const words: CardWords = {
    comfort: (statusEl.textContent ?? '').trim(),
    turn: (q('.turn b', prepare).textContent ?? '').trim(),
  }
  const chart = mountLadderChart(q('#singChart', card), { state: 'ladder' })
  let visit = openVisit({
    voice: VoiceChoice.voice,
    sound: wouldSound(Sound.state),
    webAudio: hasWebAudio(),
  })
  // the ladder and do the chart shows
  let shownLadder: LadderId | null = null
  let shownShift = 0

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'

  // ------------------------------------------------------------ drawing

  let shown = ''

  /** The panels for `o`; a tall one giving way can leave the card above the screen, so its top comes back. */
  function showPanels(o: LadderOffers): void {
    const on = Object.keys(PANELS).filter((name) => PANELS[name](o))
    for (const p of panels) p.hidden = !on.includes(p.dataset.panel ?? '')
    const now = on.join(' ')
    const first = shown === ''
    if (now === shown) return
    shown = now
    if (first) return
    const top = card.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.7)
      card.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  /** The chart on the pressed ladder, do where Move do left it. */
  function syncChart(): void {
    if (shownLadder !== visit.ladder) {
      shownLadder = visit.ladder
      chart.showLive(visit.ladder)
    }
    if (shownShift !== visit.shift) {
      shownShift = visit.shift
      chart.move(visit.shift)
    }
  }

  /** The briefing's parts: the warm-up, the words, the ladder choice, Move do, the plays and the hint. */
  function renderPrepare(o: LadderOffers): void {
    warmup.hidden = !o.warmUp
    for (const el of qa(BRIEFING, prepare)) el.hidden = !o.start
    q('.ladder-choice', prepare).hidden = o.ladders.length === 0
    for (const b of ladderBtns) {
      const id = b.dataset.ladder as LadderId
      b.hidden = !o.ladders.includes(id)
      b.setAttribute('aria-pressed', String(id === o.pressed))
    }
    q('.move-do', prepare).hidden = !o.moveDo
    setMoveEnds(moves, visit.shift)
    mercBtn.hidden = !o.playMerc
    startBtn.hidden = !o.start
    const hint =
      o.hint === 'soundOff' || o.hint === 'noAudio' ? LADDER_LINES[o.hint] : ''
    startHint.hidden = hint === ''
    say(startHint, hint)
  }

  function render(): void {
    const o = offers(visit)
    showPanels(o)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== o.voiceLine
    for (const el of qa('[data-listen-why]', card))
      el.hidden =
        el.dataset.listenWhy === 'listen' ? !o.listenLine : o.stage !== 'nomic'
    renderPrepare(o)
    liveEl.hidden = o.stage === 'comfort' || o.stage === 'voice'
    syncChart()
    say(statusEl, statusOf(o, words))
    if (VisitEnding.ending !== o.card) VisitEnding.set(o.card)
  }

  function dispatch(e: LadderEvent): void {
    visit = next(visit, e)
    render()
  }

  // ------------------------------------------------------------ Merc's ladder

  let merc: {
    readonly run: Run
    readonly drawing: PhraseDrawing
    readonly which: Which
    midi: number | null
  } | null = null

  /** Merc at rest, his button too. */
  function mercRests(m: NonNullable<typeof merc>): void {
    mercBtn.classList.remove('is-on')
    if (m.midi !== null) mercSing(m.which, m.midi, false)
  }

  /** Stops Merc's ladder where it stands: its sound, its drawing, its button. */
  function stopMerc(): void {
    const m = merc
    if (m === null) return
    merc = null
    m.run.stop()
    m.drawing.cancel()
    mercRests(m)
    NowPlaying.release(stopMerc)
  }

  /** Play Merc's ladder: the pressed ladder in the chosen voice, each rung lighting as he sings it. */
  async function playMerc(): Promise<void> {
    if (!offers(visit).playMerc) return
    // in the briefing, with the sound off, the hint says why nothing played
    dispatch({ type: 'play' })
    stopPlays()
    NowPlaying.claim(stopMerc)
    const notes = mercLadderNotes(visit.ladder, chart.doMidi)
    const drawing = chart.play({ notes })
    const which = mercOf(voiceNow())
    let mine: NonNullable<typeof merc> | null = null
    const run = playNotes(notes, {
      audible: Sound.canPlay(),
      onNote: (n, i) => {
        drawing.note(i)
        if (mine !== null) mine.midi = n.midi
        mercSing(which, n.midi, true)
      },
    })
    mine = { run, drawing, which, midi: null }
    merc = mine
    mercBtn.classList.add('is-on')
    const heard = await run.done
    // a newer play, or a stop, has taken over
    if (merc !== mine) return
    merc = null
    if (heard) drawing.end()
    else drawing.cancel()
    mercRests(mine)
    NowPlaying.release(stopMerc)
  }

  // ------------------------------------------------------------ the warm-up

  let demo: Run | null = null

  function stopDemo(): void {
    if (demo === null) return
    demo.stop()
    demo = null
    mercSing(mercOf(voiceNow()), homeOf(voiceNow()), false)
    NowPlaying.release(stopDemo)
  }

  function playDemo(kind: 'sigh' | 'slide'): void {
    const v = voiceNow()
    stopPlays()
    NowPlaying.claim(stopDemo)
    // the sigh down a fifth, the slide up to it and back (Lesson 3 FACTS 37, 46a)
    const r = playLine(warmUpContour(kind, v), { audible: Sound.canPlay() })
    demo = r
    mercSing(mercOf(v), homeOf(v), true)
    void r.done.then(() => {
      if (demo === r) stopDemo()
    })
  }

  function stopPlays(): void {
    stopMerc()
    stopDemo()
  }

  // ------------------------------------------------------------ the briefing

  function pickLadder(b: HTMLButtonElement): void {
    const ladder = LADDER_ORDER.find((id) => id === b.dataset.ladder)
    if (ladder === undefined || !offers(visit).ladders.includes(ladder)) return
    if (ladder !== visit.ladder) stopPlays()
    dispatch({ type: 'ladder', ladder })
  }

  function moveDo(b: HTMLButtonElement): void {
    // at its end the button is aria-disabled, so it keeps the keyboard's
    // place; a press there neither moves do nor stops what plays
    if (b.getAttribute('aria-disabled') === 'true') return
    if (!offers(visit).moveDo) return
    stopPlays()
    dispatch({ type: 'move', step: nextShift(visit.shift, b) - visit.shift })
  }

  /** Start: with the sound off, the hint, and nothing asked for. */
  function start(): void {
    if (!offers(visit).start) return
    // Merc sings the ladder first: with the sound off nothing plays and nothing listens
    if (!visit.sound) dispatch({ type: 'begin', ladder: visit.ladder })
  }

  // ------------------------------------------------------------ wiring

  mountComfort(card, {
    onSing: () => {
      dispatch({ type: 'comfort', sing: true })
      warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
      focusText(shownLine(card))
    },
    onListen: () => {
      dispatch({ type: 'comfort', sing: false })
      focusText(shownLine(card))
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), (v) => {
    stopPlays()
    dispatch({ type: 'voice', voice: v })
  })
  mountPractiseCard(q('#practiseCard'))

  const on = (
    els: readonly HTMLButtonElement[],
    fn: (b: HTMLButtonElement) => void,
  ): void => {
    for (const b of els) b.addEventListener('click', () => fn(b))
  }
  on(ladderBtns, pickLadder)
  on(moves, moveDo)
  on([mercBtn], () => void playMerc())
  on([startBtn], start)
  on(qa<HTMLButtonElement>('[data-warm]', warmup), (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(WARMUP_KEY, true)
      warmup.open = false
      q('summary', warmup).focus({ preventScroll: true })
    } else if (w === 'sigh' || w === 'slide') playDemo(w)
  })

  // whatever the card plays stops when the viewer leaves: the section, the tab, the page
  const leave = (): void => {
    stopPlays()
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop anything
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    // only #sing is watched, so a report's last entry is where it stands now
    const last = entries[entries.length - 1]
    if (last !== undefined && !last.isIntersecting)
      away = window.setTimeout(leave, 600)
  }).observe(q('#sing'))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) leave()
  })
  window.addEventListener('pagehide', leave)

  Sound.subscribe((s) => dispatch({ type: 'sound', on: wouldSound(s) }))
  return {
    get visit() {
      return visit
    },
    chart,
  }
}
