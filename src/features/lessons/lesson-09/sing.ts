// ============================================================
// Lesson 9 Sing it — do-mi-so-do, sung back to Merc a rung at a time
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 4), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md), as Lessons 3, 5, 7 and 8
// hold theirs. What the card offers is the pure rule in ladder-flow.ts:
// this file draws what `offers` says, every control shown exactly when it
// is offered and absent otherwise, never disabled (Move do at its ends and
// the feelings once answered aside, as the kit has them), and sends the
// rule each event. The comfort check comes first on every visit and is
// never stored (REQ-GVC-020, 021); with no voice stored the voice choice
// comes before either path, since it picks the Merc who sings. "Just
// listen today" shows its line and the doctor lines at once, beside the
// voice choice; then the ladder choice, Move do and Play Merc's ladder, and
// nothing listens. Singing offers the optional warm-up, which never listens
// (REQ-GVC-074, 075), and the briefing. Without Web Audio the card listens
// only, with no Start, and Play Merc's ladder lights the rungs in silence
// beside the hint.
//
// The chart (#singChart) is the ladder chart's live frame: the pressed
// ladder's slots, faint, 1.5 s each, its rungs named, moving with Move do,
// its summary saying where do is. Play Merc's ladder sings the pressed
// ladder in the chosen voice, each rung lighting as he sings it, and is the
// page's one sound (kit/now-playing.ts). With the sound off a play still
// draws, and Start, Start again and the Agains play nothing and ask for
// nothing: the hint beside the button says why, naming it (WEB-SPEC, state
// 5). The status line says each state's own words, from the card or the
// flow's lines, and is written only when they change, so a screen reader
// hears each once; asking for the microphone and Merc's ladder before the
// take have no words of their own, so the line stands as it was until the
// take listens.
//
// Start is the only control that asks for the microphone (MASTER-PLAN
// § 4.2 item 2): the listener, through the kit's holder, and the take
// (sing-take.ts) load inside its tap, so first paint carries neither, and
// a module that fails to load leaves the card as a refused microphone
// does. After a take with voice, one line a rung under the chart and "How
// did that feel?" (REQ-GVC-022), whose answer locks until the next take;
// then the count, the closing lines, Again, Again smaller, Start again and
// Done for today as the flow offers them. Merc celebrates once, when the
// flow says a take earned it. Refused, missing, or a listener that fails
// to load: the card listens only, with "No microphone? ...". The
// microphone is held only around a take, and let go at once when the tab
// is hidden, the section is left or the page goes, the take then
// abandoned; the card, which brings its top back when a tall panel gives
// way, never pulls back a viewer who has gone.
//
// Only the warm-up's Skip (`fyp-l09-warmup`) and the voice (`fyp-voice`,
// through the kit's voice choice) are stored: nothing from a take. The
// ending picks the Wrap's card for the visit, in memory only (kit/comfort.ts's
// `VisitEnding`). Leaving the section, or the page hidden, stops whatever
// the card plays.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, mountPractiseCard, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, store } from '@/features/lessons/kit/dom'
import type { Listener } from '@/features/lessons/kit/listen'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import { MicHold } from '@/features/lessons/kit/mic-hold'
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
import { againName, LADDER_LINES, LADDER_ORDER, next, offers, openVisit, } from './ladder-flow'
import type * as TakeKit from './sing-take'
import type { ReadOut, TakeEnd } from './sing-take'
import { mercLadderNotes } from './sounds'

/** The page's consumer id with the app's microphone owner. */
export const CONSUMER = 'lesson-09'

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

/** An element's words as one line, as the markup's wrapping leaves them. */
const textOf = (el: Element): string =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim()

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

/** The card's own words that serve as status lines: the comfort question, the briefing's head, the tricky line. */
export interface CardWords {
  readonly comfort: string
  readonly turn: string
  readonly tricky: string
}

/** Where a take stands, for the status line: listening, and the latest take read out. */
export interface TakeState {
  readonly listening: boolean
  readonly out: ReadOut | null
}

const VOICE_LINE = {
  stored: 'voiceStored',
  none: 'voiceNone',
  listen: 'voiceListen',
} as const

/** The lines under an answer, in the card's order: the count, the tricky line, the closing line. */
export function afterLine(
  o: LadderOffers,
  out: ReadOut | null,
  words: CardWords,
): string {
  const lines = [
    o.count ? out?.count : undefined,
    o.tricky && out?.tricky === true ? words.tricky : undefined,
    o.closing === null ? undefined : LADDER_LINES[o.closing],
  ]
  return lines.filter((l) => l !== undefined).join(' ')
}

/**
 * The status line for where the card stands: each state's own words, from
 * the card or the flow's lines; null keeps the line as it stands, while a
 * take asks for the microphone and Merc sings before it listens.
 */
export function statusOf(
  o: LadderOffers,
  words: CardWords,
  take: TakeState,
): string | null {
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
      return take.listening ? LADDER_LINES.take : null
    case 'noVoice':
      return o.noVoiceLine === null ? null : LADDER_LINES[o.noVoiceLine]
    case 'reading':
      return o.locked ? afterLine(o, take.out, words) : LADDER_LINES.feel
    case 'spent':
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

/** A take ready to begin: its module, the listener's and the listener, all loaded inside Start's tap. */
interface Opened {
  readonly kit: typeof TakeKit
  readonly mod: ListenModule
  readonly listener: Listener
}

/** The card's parts after a take, in the after panel. */
function afterParts(card: HTMLElement) {
  const after = q('[data-panel="after"]', card)
  return {
    after,
    count: q('[data-count-line]', after),
    closings: qa('[data-closing]', after),
    doctor: q('[data-after-doctor]', after),
    again: q<HTMLButtonElement>('[data-sing="again"]', after),
    smaller: q<HTMLButtonElement>('[data-sing="again-smaller"]', after),
    startAgain: q<HTMLButtonElement>('[data-sing="start-again"]', after),
    today: q<HTMLButtonElement>('[data-sing="today"]', after),
    hint: q('[data-again-hint]', after),
  }
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
  const readingsEl = q('[data-readings]', liveEl)
  const tag = q('[data-octave-tag]', liveEl)
  const parts = afterParts(card)
  const words: CardWords = {
    comfort: textOf(statusEl),
    turn: textOf(q('.turn b', prepare)),
    tricky: textOf(q('[data-closing="tricky"]', card)),
  }
  const chart = mountLadderChart(q('#singChart', card), { state: 'ladder' })
  const mic = new MicHold(CONSUMER)
  let visit = openVisit({
    voice: VoiceChoice.voice,
    sound: wouldSound(Sound.state),
    webAudio: hasWebAudio(),
  })
  // the ladder and do the chart shows, and whether it shows a take's reading
  let shownLadder: LadderId | null = null
  let shownShift = 0
  let chartRead = false
  // the take in flight, Merc's ladder in it, and whether it listens yet;
  // `left` holds while the section is away, for a take still opening
  let take: { cancelled: boolean } | null = null
  let left = false
  let mercRun: Run | null = null
  let listening = false
  // the latest take read out, and whether Merc celebrated as the flow last said
  let out: ReadOut | null = null
  let celebrating = false

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'

  /** The ladder of the take before, for its Again. */
  const lastLadder = (): LadderId =>
    visit.takes[visit.takes.length - 1]?.ladder ?? visit.ladder

  // ------------------------------------------------------------ drawing

  // the panels last shown: '' while a take runs, null before the first draw
  let shown: string | null = null

  /** The panels for `o`; a tall one giving way can leave the card above the screen, so its top comes back. */
  function showPanels(o: LadderOffers): void {
    const on = Object.keys(PANELS).filter((name) => PANELS[name](o))
    for (const p of panels) p.hidden = !on.includes(p.dataset.panel ?? '')
    const now = on.join(' ')
    const first = shown === null
    if (now === shown) return
    shown = now
    // never at load, and never once the viewer has gone: a take that ends
    // because they left must not bring them back
    if (first || left || document.hidden) return
    // before the section's leave watch sees the card gone and ends a take
    const top = card.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.7)
      card.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  /** The live frame on `ladder` again: Merc's rungs only, no line, no lit edge. */
  function showLive(ladder: LadderId): void {
    shownLadder = ladder
    chartRead = false
    chart.showLive(ladder)
  }

  /** The chart on the pressed ladder, do where Move do left it, and no reading once the lines are gone. */
  function syncChart(o: LadderOffers): void {
    if (shownLadder !== visit.ladder || (chartRead && !o.lines))
      showLive(visit.ladder)
    if (shownShift !== visit.shift) {
      shownShift = visit.shift
      chartRead = false
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

  /** After a take: the count, the closing lines, the doctor lines and what the flow still offers. */
  function renderAfter(o: LadderOffers): void {
    parts.count.hidden = !o.count
    say(parts.count, o.count ? (out?.count ?? '') : '')
    for (const el of parts.closings) {
      const which = el.dataset.closing
      el.hidden =
        which === 'tricky'
          ? !(o.tricky && out?.tricky === true)
          : which !== o.closing
    }
    parts.doctor.hidden = !(o.stage === 'reading' && o.doctor)
    const last = lastLadder()
    parts.again.hidden = !o.again.includes(last)
    parts.again.setAttribute('aria-label', againName(last, last))
    parts.smaller.hidden = !(last === 'full' && o.again.includes('smaller'))
    parts.smaller.setAttribute('aria-label', againName('smaller', 'full'))
    parts.startAgain.hidden = !o.startAgain
    parts.today.hidden = !o.done
    const hint =
      o.hint === 'soundOffStartAgain' || o.hint === 'soundOffAgain'
        ? LADDER_LINES[o.hint]
        : ''
    parts.hint.hidden = hint === ''
    say(parts.hint, hint)
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
    renderAfter(o)
    liveEl.hidden = o.stage === 'comfort' || o.stage === 'voice'
    readingsEl.hidden = !o.lines
    syncChart(o)
    const line = statusOf(o, words, { listening, out })
    if (line !== null) say(statusEl, line)
    // Merc's one celebration, as the flow says it was earned (FACTS 83)
    if (o.celebrate && !celebrating) mercCelebrate(mercOf(voiceNow()))
    celebrating = o.celebrate
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

  // ------------------------------------------------------------ answers

  function onFeel(f: Feeling): void {
    dispatch({ type: 'feel', feeling: f })
    focusText(parts.after)
  }
  const feelings = mountFeelings(q('[data-panel="feel"]', card), onFeel)

  // ------------------------------------------------------------ the take

  /** Another sound on the page, during a take, abandons it. */
  function stopTake(): void {
    if (take !== null) take.cancelled = true
    mercRun?.stop()
  }

  /** A take that ended unread, sent to the flow: silenced, or abandoned. */
  function ended(r: Exclude<TakeEnd, { kind: 'read' }>): void {
    listening = false
    if (r.kind === 'silenced') {
      dispatch({ type: 'silenced' })
      return
    }
    // a ladder abandoned after its voice was heard is the visit's one retry
    dispatch({ type: 'took', kind: r.voiced ? 'leftVoiced' : 'leftSilent' })
    showLive(visit.ladder)
  }

  /** A take that ran its length, read out a rung a line, drawn and sent to the flow. */
  function read(r: Extract<TakeEnd, { kind: 'read' }>, o: Opened): void {
    listening = false
    const kind = o.kit.takeKind(r.reading, r.voiced)
    out = kind === 'none' ? null : o.kit.readOut(o.mod, visit.ladder, r.reading)
    readingsEl.replaceChildren(
      ...(out?.lines ?? []).map((line) => {
        const li = document.createElement('li')
        li.textContent = line
        return li
      }),
    )
    if (out !== null) o.kit.showReading(chart, out)
    chartRead = out !== null
    // asked afresh, with no answer pressed
    feelings.reset()
    dispatch({ type: 'took', kind })
    focusText(out === null ? statusEl : readingsEl)
  }

  /**
   * The take's module and the listener, loaded, and the microphone held,
   * all inside the tap that asked; null, the microphone let go, if any fails.
   */
  async function openTake(
    context: AudioContext | null,
  ): Promise<Opened | null> {
    const [ok, kit] = await Promise.all([
      mic.open(context),
      import('./sing-take').catch(() => null),
    ])
    const { mod, listener } = mic
    if (ok && kit !== null && mod !== null && listener !== null)
      return { kit, mod, listener }
    mic.release(true)
    return null
  }

  /**
   * Start, Start again or an Again, on `ladder`: the microphone first, asked
   * inside the tap, then Merc's ladder and the take. With the sound off it
   * asks for nothing, and the hint beside the button says why.
   */
  async function begin(ladder: LadderId): Promise<void> {
    if (take !== null) return
    // the AudioContext the take listens on, made inside the tap
    const context = visit.sound ? Sound.context() : null
    dispatch({ type: 'begin', ladder })
    if (visit.taking === null) return
    stopPlays()
    const me = { cancelled: false }
    take = me
    out = null
    readingsEl.replaceChildren()
    showLive(ladder)
    const opened = await openTake(context)
    if (opened === null) {
      take = null
      dispatch({ type: 'nomic' })
      focusText(q<HTMLElement>('[data-listen-why="nomic"]', card))
      return
    }
    // the tab hidden, the section left or another sound begun while the
    // listener loaded: that leave came before the microphone did, so let it
    // go now, as the leave does, and end the take unstarted, an abandoned
    // one with no voice
    if (me.cancelled) {
      mic.release(true)
      take = null
      ended({ kind: 'left', voiced: false })
      return
    }
    NowPlaying.claim(stopTake)
    const end = await opened.kit.takeLadder({
      mod: opened.mod,
      listener: opened.listener,
      chart,
      ladder,
      which: mercOf(voiceNow()),
      tag,
      cancelled: () => me.cancelled,
      onMerc: (r) => {
        mercRun = r
      },
      onListen: () => {
        listening = true
        render()
      },
    })
    NowPlaying.release(stopTake)
    mic.release()
    if (take !== me) return
    take = null
    if (end.kind === 'read') read(end, opened)
    else ended(end)
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
  on([startBtn, parts.startAgain], () => void begin(visit.ladder))
  on([parts.again], () => void begin(lastLadder()))
  on([parts.smaller], () => void begin('smaller'))
  on([parts.today], () => {
    dispatch({ type: 'done' })
    focusText(statusEl)
  })
  on(qa<HTMLButtonElement>('[data-warm]', warmup), (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(WARMUP_KEY, true)
      warmup.open = false
      q('summary', warmup).focus({ preventScroll: true })
    } else if (w === 'sigh' || w === 'slide') playDemo(w)
  })

  // whenever the viewer leaves (the section, the tab, the page) whatever
  // the card plays stops, a take is abandoned, and the microphone goes at once
  const leave = (): void => {
    stopPlays()
    if (take !== null) stopTake()
    mic.release(true)
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop a take
  let away = 0
  new IntersectionObserver((entries) => {
    window.clearTimeout(away)
    // only #sing is watched, so a report's last entry is where it stands now
    const last = entries[entries.length - 1]
    if (last !== undefined && !last.isIntersecting)
      away = window.setTimeout(() => {
        left = true
        leave()
      }, 600)
    else left = false
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
