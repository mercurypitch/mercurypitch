// ============================================================
// Lesson 14 Sing it — one phrase, twice, drawn, recorded and played back
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 4), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md). What the card offers is the
// pure rule in phrase-flow.ts: this file draws what `phraseView` says,
// every control shown exactly when it is offered and absent otherwise
// (Move do at its ends and the feelings once answered aside, as the kit has
// them), and sends the rule each event. The comfort check comes first on
// every visit and is never stored; the voice choice follows either answer
// and picks the Merc who sings. "Just listen today" shows its line and the
// doctor lines, Move do and Play Merc's phrase, and nothing listens.
// Without Web Audio the card listens only, with no Start, and Play Merc's
// phrase lights the bands in silence beside the hint.
//
// The chart (#singChart) is the song line in its live state: line 1's
// bands, do set by the voice and Move do, its summary saying where do is,
// then what the latest take ran over. Each take's line stays on it, take
// 1's faint once take 2 is drawn, each named at its end, redrawn against
// the bands it was sung to after Move do; while take 2 is next, the chart
// shows its plan, the breath after "star" and "star"'s swell in faint
// light. Play Merc's phrase sings take 2 in the chosen voice, each band
// lighting as he sings it, and is the page's one sound (kit/now-playing.ts);
// with the sound off it draws in silence.
//
// Start take 1 is the only control that asks for the microphone
// (MASTER-PLAN § 4.2 item 2): the listener, through the kit's holder, and
// the take (sing-take.ts) load inside its tap, so first paint carries
// neither, and a module that fails to load leaves the card as a refused
// microphone does. The recorder module (kit/record.ts) loads once the
// viewer chooses to sing, so a browser that can't record says so before
// Start. A take's recording lives in memory only, beside its line, until
// Delete, a new take in its place, or leaving the page: nothing is stored
// and nothing is sent. Each kept take has its own Play, reading "Stop your
// take N" while it plays, and one seek bar for the take last played, which
// moves the playhead along its line and never starts the sound; Space plays
// and stops a take only from its Play or the seek bar, and scrolls the page
// everywhere else.
//
// Leaving the section, the tab hidden or the page going stops whatever the
// card plays, abandons a take and lets the microphone go at once
// (kit/leave.ts). Only the voice (`fyp-voice`, through the kit's voice
// choice) and the warm-up's Skip (`fyp-l14-warmup`) are stored. The ending
// picks the Wrap's card for the visit, in memory only (`VisitEnding`).

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import type { SongTrace } from '@/features/lessons/kit/band-chart-song-scene'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, store } from '@/features/lessons/kit/dom'
import { addDrawer, wake } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import type { RangeReading } from '@/features/lessons/kit/listen'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { nextShift, setMoveEnds } from '@/features/lessons/kit/move-do'
import { sharpOf, wordName } from '@/features/lessons/kit/notes'
import { createSoundOwner, NowPlaying, } from '@/features/lessons/kit/now-playing'
import type * as RecordKit from '@/features/lessons/kit/record'
import type { KeptTake } from '@/features/lessons/kit/record'
import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import { liveSummary, seekText, takeSummary } from './lines'
import type { Panel, PhraseEvent, PhraseView, PhraseVisit } from './phrase-flow'
import { HINT, nextVisit, NOT_HEARD_LINE, openVisit, phraseView, } from './phrase-flow'
import type { PlayButton } from './plays'
import { bindPlay, singAlong, singNotes } from './plays'
import type * as TakeKit from './sing-take'
import type { TakeEnd } from './sing-take'
import type { TakeId } from './song'
import { doOf, lineNotes, SWELL_STAR, TAKE_BREATH } from './song'
import type { SongLine } from './song-line'
import { mountSongLine, takePlay } from './song-line'

/** The microphone's owner for this page. */
export const CONSUMER = 'lesson-14'

/** The warm-up's Skip, stored as Lessons 3 and 5 store theirs. */
export const WARMUP_KEY = 'fyp-l14-warmup'

/** Whether the browser has Web Audio at all: without it nothing plays and nothing listens. */
export const hasWebAudio = (): boolean =>
  typeof window.AudioContext === 'function' ||
  typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext ===
    'function'

/** A take as the card keeps it: its reading, its line in absolute cents, and its recording. */
interface Kept {
  readonly reading: Extract<RangeReading, { heard: true }>
  readonly trace: readonly TracePoint[]
  readonly audio: KeptTake | null
}

/** A note's name in words, for the chart's summary. */
const spoken = (midi: number): string => wordName(sharpOf(midi))

export interface SingIt {
  readonly visit: PhraseVisit
  readonly view: PhraseView
  readonly line: SongLine
}

export function initSing(): SingIt {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const panel = (name: string): HTMLElement => q(`[data-panel="${name}"]`, card)
  const prepare = panel('prepare')
  const after = panel('after')
  const warmup = q<HTMLDetailsElement>('#warmup', prepare)
  const singParts = [
    warmup,
    q('.turn', prepare),
    q('.stop-line', prepare),
    q('.brief', prepare),
  ]
  const cantRecordEl = q('[data-cant-record]', prepare)
  const moveGroup = q('.move-do', prepare)
  const moves = qa<HTMLButtonElement>('[data-move-do]', prepare)
  const mercBtn = q<HTMLButtonElement>('[data-merc-phrase]', prepare)
  const startBtn = q<HTMLButtonElement>('[data-sing="start"]', prepare)
  const startHint = q('[data-start-hint]', prepare)
  const live = q('#singLive')
  const tag = q('[data-octave-tag]', live)
  const takeLineEl = q('[data-take-line]', live)
  const playback = q('[data-playback]', after)
  const seek = q<HTMLInputElement>('[data-take-seek]', playback)
  const btn = (name: string): HTMLButtonElement =>
    q<HTMLButtonElement>(`[data-sing="${name}"]`, after)
  const againHint = q('[data-again-hint]', after)

  const line = mountSongLine(q('#singChart'), {
    state: 'live',
    followVoice: false,
  })
  const mic = new MicHold(CONSUMER)
  const owner = createSoundOwner()
  let visit = openVisit({
    voice: VoiceChoice.voice,
    sound: Sound.state !== 'off',
    webAudio: hasWebAudio(),
  })
  let view = phraseView(visit)
  let recordKit: typeof RecordKit | null = null
  const kept = new Map<TakeId, Kept>()
  let take: { cancelled: boolean } | null = null
  let stopSound: (() => void) | null = null

  // ------------------------------------------------------------ drawing

  const voiceNow = (): Voice => visit.voice ?? 'lower'
  const doNow = (): number => doOf(voiceNow(), visit.shift)

  /** The latest take heard, by the order the visit made them, and its number. */
  function latest(): (Kept & { readonly id: TakeId }) | null {
    const last = [...visit.takes]
      .reverse()
      .find((t) => t.voiced && !t.abandoned)
    const k = last === undefined ? undefined : kept.get(last.id)
    return last === undefined || k === undefined ? null : { ...k, id: last.id }
  }

  function summary(): string {
    const k = latest()
    if (k === null || visit.deleted) return liveSummary(line.doMidi)
    return takeSummary(k.id, spoken(k.reading.low), spoken(k.reading.high))
  }

  /** The kept takes and take 2's plan, laid over every scene the line draws. */
  function decorate(): void {
    const plan = view.plan
    const two = kept.has(2)
    line.decorate((scene, doMidi) => {
      const traces: SongTrace[] = []
      for (const id of [1, 2] as const) {
        const k = kept.get(id)
        if (k === undefined) continue
        traces.push({
          line: k.trace.map((p) => ({
            t: p.t,
            c: p.c === null ? null : p.c - doMidi * 100,
          })),
          faint: id === 1 && two,
          name: `take ${String(id)}`,
        })
      }
      if (!plan) return { ...scene, traces }
      return {
        ...scene,
        traces,
        bands: scene.bands.map((b, i) =>
          i === 6 ? { ...b, plan: SWELL_STAR } : b,
        ),
        breaths: [{ t: TAKE_BREATH[2], lit: false, word: true }],
      }
    })
    line.describe(summary())
  }

  // ------------------------------------------------------------ rendering

  const show = (el: HTMLElement, on: boolean): void => {
    el.hidden = !on
  }

  function say(el: HTMLElement, text: string): void {
    if (el.textContent !== text) el.textContent = text
  }

  function focusOn(el: HTMLElement): void {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
  }

  /** Each part shows exactly where its data attribute names what the view says. */
  function showBy(
    selector: string,
    key: string,
    value: string | null,
    root: ParentNode = card,
  ): void {
    for (const el of qa<HTMLElement>(selector, root))
      show(el, el.dataset[key] === value)
  }

  /** A hint's words, shown only when it has some. */
  function hintAt(el: HTMLElement, text: string): void {
    say(el, text)
    show(el, text !== '')
  }

  function renderPrepare(): void {
    for (const el of singParts) show(el, view.singParts)
    show(cantRecordEl, view.cantRecord)
    show(moveGroup, view.moveDo)
    setMoveEnds(moves, visit.shift)
    show(mercBtn, view.mercPhrase)
    show(startBtn, view.start === 'start')
    const first = view.hint === 'silent' && view.start === 'start'
    hintAt(
      startHint,
      view.hint === 'noAudio' ? HINT.noAudio : first ? HINT.silent : '',
    )
  }

  function renderPlayback(): void {
    show(playback, view.plays.length > 0)
    for (const b of takePlays)
      show(b, view.plays.includes(Number(b.dataset.takePlay) as TakeId))
    if (seekTake !== null && !view.plays.includes(seekTake)) seekTake = null
    seekTake ??= view.plays.at(-1) ?? null
    show(seek, seekTake !== null)
    showSeek()
  }

  function renderAfter(): void {
    showBy('[data-closing]', 'closing', view.closing, after)
    show(q('[data-after-doctor]', after), view.doctor)
    renderPlayback()
    for (const name of ['take2', 'again', 'retry'] as const)
      show(btn(name), view.start === name)
    say(q('[data-retry-word]', after), view.startWord)
    show(btn('delete'), view.del)
    show(btn('today'), view.today)
    const later = view.hint === 'silent' && view.start !== 'start'
    hintAt(againHint, later ? HINT.silent : '')
  }

  /** The line under the chart: the latest take's reading, or the not-heard line. */
  function lineText(): string {
    if (view.takeLine === 'notHeard') return NOT_HEARD_LINE
    const k = latest()
    if (view.takeLine !== 'reading' || k === null) return ''
    return [k.reading.line, k.reading.octaveLine].filter(Boolean).join(' ')
  }

  function render(): void {
    view = phraseView(visit)
    for (const p of qa<HTMLElement>('[data-panel]', card))
      show(p, view.panels.includes(p.dataset.panel as Panel))
    show(live, view.panels.includes('live'))
    showBy('[data-listen-why]', 'listenWhy', view.listenWhy)
    showBy('[data-voice-line]', 'voiceLine', view.voiceLine)
    renderPrepare()
    renderAfter()
    hintAt(takeLineEl, lineText())
    if (view.status !== null) say(statusEl, view.status)
    if (VisitEnding.ending !== view.card) VisitEnding.set(view.card)
    decorate()
  }

  function dispatch(e: PhraseEvent): void {
    visit = nextVisit(visit, e)
    render()
  }

  // ------------------------------------------------------------ Merc's phrase and the warm-up

  function stopPlays(): void {
    stopSound?.()
    stopSound = null
    for (const p of playButtons) p.stop()
  }

  function playMerc(): Run | null {
    const p = takePlay(2, line.doMidi)
    const audible = visit.webAudio && Sound.canPlay()
    const run = singNotes(p.notes, audible)
    const drawing = line.play(p)
    const quiet = singAlong(p.notes, mercOf(voiceNow()), audible)
    void run.done.then((heard) => {
      quiet()
      if (heard) drawing.end()
      else drawing.cancel()
      decorate()
    })
    return run
  }

  function playWarm(kind: 'sigh' | 'slide'): Run | null {
    const v = voiceNow()
    // the sigh down a fifth, the slide up to it and back (Lesson 3 FACTS 37, 46a)
    const run = playLine(warmUpContour(kind, v), {
      audible: visit.webAudio && Sound.canPlay(),
    })
    mercSing(mercOf(v), homeOf(v), true)
    void run.done.then(() => mercSing(mercOf(v), homeOf(v), false))
    return run
  }

  const playButtons: PlayButton[] = [
    bindPlay(mercBtn, playMerc),
    bindPlay(q<HTMLButtonElement>('[data-warm="sigh"]', warmup), () =>
      playWarm('sigh'),
    ),
    bindPlay(q<HTMLButtonElement>('[data-warm="slide"]', warmup), () =>
      playWarm('slide'),
    ),
  ]

  // ------------------------------------------------------------ playback

  const takePlays = qa<HTMLButtonElement>('[data-take-play]', playback)
  let seekTake: TakeId | null = null
  let seekAt: number | null = null
  let playing: {
    id: TakeId
    position: () => number
  } | null = null

  /** The seek bar's place, words and the chart's playhead, for the take last played. */
  function showSeek(): void {
    const audio = seekTake === null ? null : (kept.get(seekTake)?.audio ?? null)
    if (audio === null || seekTake === null) {
      line.chart.scene.playhead = null
      return
    }
    const at = playing?.id === seekTake ? playing.position() : (seekAt ?? 0)
    seek.max = audio.length.toFixed(1)
    seek.value = at.toFixed(1)
    seek.setAttribute('aria-label', `Position in take ${String(seekTake)}`)
    const t = at - audio.voicedAt
    const n = lineNotes(0, line.doMidi).find((x) => t >= x.from && t < x.to)
    seek.setAttribute(
      'aria-valuetext',
      seekText(at, audio.length, n === undefined ? null : n.syllable),
    )
    line.chart.scene.playhead =
      playing !== null || seekAt !== null ? Math.max(0, t) : null
    wake()
  }

  addDrawer({
    active: () => !live.hidden,
    wants: () => playing !== null,
    draw: showSeek,
  })

  function playYour(id: TakeId): Run | null {
    const audio = kept.get(id)?.audio ?? null
    if (audio === null || recordKit === null) return null
    const fromSeek =
      seekTake === id && seekAt !== null && seekAt < audio.length - 0.05
        ? seekAt
        : recordKit.startOf(audio)
    const context = Sound.context()
    if (context === null) return null
    const p = recordKit.playTake(audio, context, owner, fromSeek)
    if (p === null) return null
    seekTake = id
    playing = { id, position: () => p.position() }
    void p.done.then(() => {
      seekAt = p.position()
      playing = null
      showSeek()
    })
    showSeek()
    return p
  }

  for (const b of takePlays) {
    const id = Number(b.dataset.takePlay) as TakeId
    playButtons.push(bindPlay(b, () => playYour(id)))
  }

  seek.addEventListener('input', () => {
    // seeking never starts the sound; it stops a take that plays
    const p = playButtons.find((x) => x.playing)
    p?.stop()
    seekAt = Number(seek.value)
    showSeek()
  })
  seek.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || seekTake === null) return
    // Space plays and stops a take from its seek bar, as from its Play
    e.preventDefault()
    takePlays.find((b) => Number(b.dataset.takePlay) === seekTake)?.click()
  })

  // ------------------------------------------------------------ the take

  /** Another sound on the page, during a take, abandons it. */
  function stopTake(): void {
    if (take !== null) take.cancelled = true
    stopSound?.()
  }

  async function openTake(
    context: AudioContext | null,
  ): Promise<typeof TakeKit | null> {
    const [ok, kit] = await Promise.all([
      mic.open(context),
      import('./sing-take').catch(() => null),
    ])
    if (ok && kit !== null && mic.mod !== null && mic.listener !== null)
      return kit
    mic.release(true)
    return null
  }

  /** What a take ended with, sent to the flow; a heard take's line and recording kept in its place. */
  function ended(end: TakeEnd, id: TakeId): void {
    if (end.kind === 'silenced') {
      dispatch({ type: 'silenced' })
      return
    }
    if (end.kind === 'left') {
      dispatch({
        type: 'took',
        voiced: false,
        abandoned: true,
        recorded: false,
      })
      return
    }
    const { reading } = end
    if (reading.heard) {
      kept.set(id, { reading, trace: end.trace, audio: end.kept })
      if (seekTake === id) seekAt = null
      feelings.reset()
    }
    dispatch({
      type: 'took',
      voiced: reading.heard,
      abandoned: false,
      recorded: reading.heard && end.kept !== null,
    })
    focusOn(statusEl)
  }

  /** Start take 1, Start take 2, Again or the same Start again: the microphone first, inside the tap. */
  async function begin(): Promise<void> {
    if (take !== null) return
    if (!visit.sound) {
      render()
      return
    }
    // Start is a play like any other, so its tap turns a switch nothing has
    // set yet on (Sound.canPlay): Merc's phrase and the count-in sound, and
    // the take does not end on a count-in that could not be heard
    Sound.canPlay()
    // the AudioContext the take listens on, made inside the tap
    const context = Sound.context()
    dispatch({ type: 'begin' })
    const taking = visit.taking
    if (taking === null) return
    stopPlays()
    const me = { cancelled: false }
    take = me
    const kit = await openTake(context)
    if (kit === null || context === null) {
      take = null
      dispatch({ type: 'nomic' })
      focusOn(statusEl)
      return
    }
    // left while the listener loaded: the microphone goes at once and the
    // take ends unstarted, an abandoned one
    if (me.cancelled || mic.mod === null || mic.listener === null) {
      mic.release(true)
      take = null
      ended({ kind: 'left' }, taking.id)
      return
    }
    NowPlaying.claim(stopTake)
    line.setDo(doNow())
    const end = await kit.takePhrase({
      mod: mic.mod,
      listener: mic.listener,
      context,
      line,
      id: taking.id,
      mercFirst: taking.id === 1,
      which: mercOf(voiceNow()),
      tag,
      cancelled: () => me.cancelled,
      onSound: (stop) => {
        stopSound = stop
      },
      onListen: () => dispatch({ type: 'listen' }),
    })
    NowPlaying.release(stopTake)
    mic.release()
    if (take !== me) return
    take = null
    ended(end, taking.id)
  }

  // ------------------------------------------------------------ wiring

  function loadRecorder(): void {
    void import('@/features/lessons/kit/record').then(
      (m) => {
        recordKit = m
        dispatch({ type: 'recordable', can: m.canRecord() })
      },
      () => dispatch({ type: 'recordable', can: false }),
    )
  }

  mountComfort(card, {
    onSing: () => {
      dispatch({ type: 'comfort', comfort: 'sing' })
      warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
      loadRecorder()
      focusOn(statusEl)
    },
    onListen: () => {
      dispatch({ type: 'comfort', comfort: 'listen' })
      focusOn(statusEl)
    },
  })
  bindVoiceButtons(panel('voice'), (v) => {
    stopPlays()
    dispatch({ type: 'voice', voice: v })
    line.setDo(doNow())
    decorate()
  })
  for (const b of moves)
    b.addEventListener('click', () => {
      // at its end the button is aria-disabled and keeps the keyboard's place
      if (b.getAttribute('aria-disabled') === 'true' || take !== null) return
      stopPlays()
      dispatch({ type: 'move', shift: nextShift(visit.shift, b) })
      line.setDo(doNow())
      decorate()
    })
  const feelings = mountFeelings(panel('feel'), (f: Feeling) => {
    dispatch({ type: 'feel', feeling: f })
    focusOn(statusEl)
  })
  for (const name of ['start', 'take2', 'again', 'retry'])
    (name === 'start' ? startBtn : btn(name)).addEventListener(
      'click',
      () => void begin(),
    )
  btn('delete').addEventListener('click', () => {
    stopPlays()
    kept.clear()
    seekTake = null
    seekAt = null
    dispatch({ type: 'delete' })
    focusOn(statusEl)
  })
  btn('today').addEventListener('click', () => {
    stopPlays()
    dispatch({ type: 'done' })
    focusOn(statusEl)
  })
  q('[data-warm="skip"]', warmup).addEventListener('click', () => {
    store.set(WARMUP_KEY, true)
    warmup.open = false
    q('summary', warmup).focus({ preventScroll: true })
  })

  // whenever the viewer leaves (the section, the tab, the page) whatever
  // the card plays stops, a take is abandoned, and the microphone goes at once
  onLeave(q('#sing'), () => {
    stopPlays()
    if (take !== null) stopTake()
    mic.release(true)
  })
  Sound.subscribe(() => {
    const on = Sound.state !== 'off'
    if (on !== visit.sound) dispatch({ type: 'sound', on })
  })

  line.setDo(doNow())
  render()
  return {
    get visit() {
      return visit
    },
    get view() {
      return view
    },
    line,
  }
}
