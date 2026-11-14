// ============================================================
// Lesson 28 Sing it — your part of the song, read from the staff
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 6), on the kit's pieces under the Guided
// Voice Check's safety rules (docs/specs/guided-voice-check.ears.md): the
// comfort check first on every visit and never stored (kit/comfort.ts);
// the voice choice when none is stored (kit/voice-choice.ts), Merc's part
// in the bass clef for the lower voice and Tavi's in the treble for the
// higher, with no Move do and no other octave; "Just listen today", whose
// Play the song plays both parts and asks for nothing; the headphones
// check (kit/headphones.ts), its answer held for the visit; and the
// briefing, whose Start is the only control that asks for the microphone,
// under the consumer id `lesson-28`.
//
// A run, with headphones (sing-run.ts): the quiet check first, the other
// part's first 2.0 s alone while the listener reads the frames (loaded on
// Start), where any voiced run of 0.3 s or more stops it before it starts,
// its line over Start, beside No headphones; then do, sung by Merc or Tavi,
// 1.0 s; 0.4 s of quiet; one bar of woodblock; and the take, read in time
// from the singer's first note, while the other part sounds from bar 1's
// first beat. The cursor moves at the beat and the notes light as their
// beats come, the learner's amber and the other's chrome. After No
// headphones the run is alone: no check, nothing plays during the take and
// the reader has no other part, and before each run Hear Tavi's part first
// plays the other part alone, outside any take.
//
// Half a second after the take come the pitch line and the lines, one a
// note, then "How did that feel?" (sing-plan.ts `afterRun`). A take with
// voice is kept in memory, decoded on the page's context, and Hear it with
// Tavi's part plays it back with that part, lined up on the singer's first
// note as it came against bar 1 (kit/record.ts `playWithPart`, the note
// found in the recording by kit/take-onset.ts); Delete your take drops it
// and keeps the lines. A visit allows three takes, Again's taking the last
// one's place. The sing-along, for no microphone or a refused one, sings
// do, counts in and plays the other part while the cursor moves; nothing
// listens. From Start until a run ends every other play on the page is
// held and any sound stops (WEB-SPEC, Audio); leaving the section for 600
// ms, or hiding the page, ends what plays here, abandons a take, which
// counts, and releases the microphone; leaving the page drops the take.
// Until the cold open's choice the staffs draw the hero's ten empty bars
// and the card's plays wait under the lock line (FACTS 46). Nothing is
// sent, stored or celebrated.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, wait } from '@/features/lessons/kit/dom'
import { Headphones, mountHeadphones } from '@/features/lessons/kit/headphones'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { ALONE_NEXT, heardLine } from '@/features/lessons/kit/quiet-words'
import type { KeptTake } from '@/features/lessons/kit/record'
import { canRecord, keepTake, playWithPart, TakeShelf, } from '@/features/lessons/kit/record'
import { Sound } from '@/features/lessons/kit/sound'
import type { TakeEnd } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import type { RunMark } from './sing-plan'
import { AFTER_SEC, afterRun, againAllowed, aloneStatus, BOTH_STAFFS, firstStatus, mineOf, OPEN_BEATS, otherOf, otherStaff, PART_SEC, partName, playbackStatus, START_SOUND_OFF, STATUS, title, } from './sing-plan'
import type { Flight, Kits, Run } from './sing-run'
import { createRunSteps } from './sing-run'
import { bookPart, QUIET_GAP_SEC, startFirst, startSong } from './sing-sounds'
import type { AfterView, Panel, SingView } from './sing-view'
import { createSingView, NO_AFTER } from './sing-view'
import { BEAT_SEC } from './song'

/** Every play on the page outside Sing it, held from Start until a run ends. */
export const PAGE_PLAYS =
  '[data-play], [data-word-play], [data-word-show], [data-step-play], [data-toy-play], [data-quiz-play], [data-form-block], [data-state], [data-pitch-line]'

export interface SingOptions {
  /** The cold open's choice: the staffs and the plays wait for it, and it may come before this chunk loads. */
  readonly chosen?: Promise<unknown>
  /** The page's hooks for its tests: the modules Start loads. */
  readonly loadKits?: () => Promise<Kits>
}

/** Mounts Sing it on the page's #singCard. */
export function initSing(o: SingOptions = {}): void {
  // the learner has left Sing it: off screen for 600 ms (the leave watch below)
  let left = false
  const view: SingView = createSingView(
    () => !left,
    document.querySelector('[data-hero-strip]'),
  )
  const fig = view.figure
  const card = q('#singCard')
  const mic = new MicHold('lesson-28')
  const shelf = new TakeShelf()
  const loadKits =
    o.loadKits ??
    (async (): Promise<Kits> => {
      const [take, quiet, onset] = await Promise.all([
        import('@/features/lessons/kit/take-in-time'),
        import('@/features/lessons/kit/quiet-check'),
        import('@/features/lessons/kit/take-onset'),
      ])
      return { take, quiet, onset }
    })
  const runs: RunMark[] = []
  let mode: 'runs' | 'along' = 'runs'
  let alongAgain = false
  let flight: Flight | null = null
  let sounding: { stop(): void } | null = null
  let resting = false
  let begun = false
  // when the kept take's first note came against bar 1, for its playback
  let onset = 0
  // takes begun or deleted: a recording still being kept for an older one is dropped
  let takes = 0

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'
  const phones = (): boolean => Headphones.answer === 'on'

  // the card's plays wait for the cold open's choice
  view.lock(true)
  void o.chosen?.then(() => {
    fig.unlock()
    view.lock(false)
  })

  // from Start until a run ends: every other play held
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
  // a play enabled during a run still waits for its end
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

  const steps = createRunSteps({
    view,
    mic,
    sound,
    voice: voiceNow,
    phones,
  })

  /** Draws the card for the chosen voice: its names, its staffs' colours, and the briefing for the headphones answer. */
  function drawSet(): void {
    const v = voiceNow()
    view.voice(v)
    fig.voice(v)
    view.phones(phones())
  }

  /** The voice choice shows with the panel after it until the first run. */
  const withVoice = (p: Panel[]): Panel[] => (begun ? p : ['voice', ...p])

  function toVoice(): void {
    view.voiceLine(false)
    view.show(['voice'])
    view.status(STATUS.voice)
    view.focusText(q('[data-panel="voice"]', card))
  }

  function toListen(): void {
    // both parts in their own colours: nothing here uses a voice
    fig.voice(null)
    view.show(['listen'], { fig: true })
    view.status(STATUS.listen)
    view.focusText(q('[data-panel="listen"]', card))
  }

  function toPhones(): void {
    drawSet()
    view.show(withVoice(['phones']))
    view.status(STATUS.phones)
    view.focusText(q('[data-panel="phones"]', card))
  }

  function toBrief(): void {
    drawSet()
    view.startHint('')
    view.quietFailed(false)
    view.cantRecord(!canRecord())
    view.show(withVoice(['brief', 'start']), { fig: true })
    view.status(phones() ? STATUS.brief : aloneStatus(voiceNow()))
    view.focusText(q('[data-panel="brief"]', card))
  }

  /** The sing-along's panel: no microphone, or a refused one. */
  function toAlong(): void {
    if (flight !== null) flight.cancelled = true
    flight = null
    opening(false)
    mic.release(true)
    mode = 'along'
    drawSet()
    view.after(NO_AFTER)
    view.show(withVoice(['along']), { fig: true })
    view.status(STATUS.nomic)
    view.focusText(q('[data-panel="along"]', card))
  }

  /** A quiet check that heard a note: no run, its line over Start, beside No headphones. */
  function toHeard(): void {
    flight = null
    opening(false)
    mic.release(true)
    drawSet()
    view.quietFailed(true)
    view.show(['phones', 'start'], { fig: true })
    view.status(heardLine(partName(voiceNow()), ALONE_NEXT))
    view.focusText(q('[data-quiet-failed]', card))
  }

  /**
   * A take's recording kept for its playback: decoded on the page's
   * context, the singer's first note found in it near where the frames
   * heard it, since the recorder gives no time for its first sample; null
   * where nothing was recorded or it will not decode.
   */
  async function keep(
    kits: Kits,
    blob: Blob | null,
    first: number,
  ): Promise<KeptTake | null> {
    const context = Sound.context()
    if (blob === null || context === null) return null
    const raw = await keepTake(blob, context, 0)
    if (raw === null) return null
    // seconds from the take's open, where the recording starts or a little before
    const near = first + OPEN_BEATS * BEAT_SEC
    const found = await kits.onset.voiceOnsetOf(raw.buffer, {
      from: Math.max(0, near - 1),
      to: near + 1,
    })
    return { ...raw, voicedAt: found ?? near }
  }

  /** One run: the quiet check with headphones, do, the count-in and the take; then the lines and the question. */
  async function runOnce(): Promise<void> {
    if (flight !== null || resting || !againAllowed(runs)) return
    sounding?.stop()
    mode = 'runs'
    feelings.reset()
    // Again's take takes the last one's place
    takes += 1
    shelf.clear()
    view.kept(false)
    const me: Flight = { cancelled: false, left: false }
    flight = me
    begun = true
    opening(true)
    drawSet()
    view.after(NO_AFTER)
    view.readings(null)
    view.quietFailed(false)
    view.cantRecord(false)
    view.show([], { fig: true })
    view.status(STATUS.asking)
    const [ok, kits] = await Promise.all([
      mic.open(Sound.context()),
      loadKits().catch(() => null),
    ])
    if (!ok || kits === null) {
      toAlong()
      return
    }
    if (document.hidden || left) {
      cut(me)
      return
    }
    if (phones()) {
      const quiet = await steps.quietCheck(kits, me)
      if (quiet === 'heard') {
        toHeard()
        return
      }
      if (quiet === 'cut') {
        cut(me)
        return
      }
    }
    if (!(await steps.sayDo(me))) {
      cut(me)
      return
    }
    await wait(QUIET_GAP_SEC)
    if (me.cancelled) {
      cut(me)
      return
    }
    const { end, tape } = await steps.countAndSing(me, kits)
    if (end === null || end === 'along' || end.kind === 'left') {
      tape?.discard()
      tape?.dispose()
      mic.release()
      cut(me)
      return
    }
    // the recording, kept only for a take with a first note to line up on
    const first = end.onset
    const blob =
      tape !== null && end.voiced && first !== null ? await tape.stop() : null
    if (blob === null) tape?.discard()
    tape?.dispose()
    mic.release()
    ended(
      me,
      end,
      first === null ? Promise.resolve(null) : keep(kits, blob, first),
      kits,
    )
  }

  /**
   * A run cut short: abandoned by the viewer, which counts, with Start
   * again while the visit allows; or stopped by the sound going off, which
   * does not, back to the briefing.
   */
  function cut(me: Flight): void {
    if (flight !== me) return
    flight = null
    opening(false)
    mic.release(document.hidden)
    if (!me.left) {
      toBrief()
      return
    }
    runs.push({ kind: 'left' })
    const restart = againAllowed(runs)
    view.after({
      ...NO_AFTER,
      restart,
      first: restart && !phones(),
      today: true,
    })
    view.show(['after'], { fig: true })
    view.status(STATUS.left)
  }

  /** A take's end: counted, then the pitch line, the lines, the playback and "How did that feel?"; or the no-voice line. */
  function ended(
    me: Flight,
    end: Extract<TakeEnd, { kind: 'read' }>,
    kept: Promise<KeptTake | null>,
    kits: Kits,
  ): void {
    if (flight !== me) return
    flight = null
    opening(false)
    if (!end.voiced) {
      runs.push({ kind: 'silent' })
      const restart = againAllowed(runs)
      view.after({
        ...NO_AFTER,
        closing: 'silent',
        restart,
        first: restart && !phones(),
        today: true,
      })
      view.show(['after'], { fig: true })
      view.status(restart ? STATUS.silent : STATUS.spent)
      view.focusText(q('[data-panel="after"]', card))
      return
    }
    const v = voiceNow()
    const mine = mineOf(v)
    runs.push({ kind: 'read', inBand: end.inBand, notes: mine.midis.length })
    onset = end.onset ?? 0
    const mineTake = takes
    void kept.then((take) => {
      // a take another run has since replaced, or deleted, is not this one
      if (mineTake !== takes) return
      if (take !== null) shelf.set(1, take)
      view.kept(take !== null)
      // a take with a first note to line up on, which this browser could not keep
      view.cantRecord(take === null && end.onset !== null)
    })
    window.setTimeout(() => {
      if (end.pitch !== null)
        kits.take.drawPitchLine(
          view.chart,
          end.pitch,
          mine.midis,
          mine.syllables.map(title),
        )
      view.readings(end.lines)
      view.show(['playback', 'feel'], { fig: true, lines: true })
      view.status(STATUS.feel)
      view.focusText(q('#singLive'))
    }, AFTER_SEC * 1000)
  }

  function onFeel(f: Feeling): void {
    const a = afterRun(runs, f, mode === 'along' ? { again: alongAgain } : null)
    const after: AfterView = {
      closing: a.closing,
      tricky: a.tricky,
      doctor: a.doctor,
      again: a.offers.again,
      restart: false,
      // the other part first, before each run on the alone path
      first: a.offers.again && !phones(),
      alongAgain: a.offers.alongAgain,
      today: a.offers.today,
    }
    view.after(after)
    if (!a.readings) view.readings(null)
    if (a.rest) {
      resting = true
      VisitEnding.set('rest')
    }
    if (f === 'uncomfortable') mic.release(true)
    // the take stays to play back or delete, whatever the answer
    view.show(
      mode === 'runs' ? ['playback', 'feel', 'after'] : ['feel', 'after'],
      {
        fig: true,
        lines: a.readings,
      },
    )
    view.status(
      a.closing === 'ok'
        ? STATUS.ok
        : a.closing === 'gentle'
          ? STATUS.gentle
          : a.closing === 'enough'
            ? STATUS.enough
            : STATUS.alongDone,
    )
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /** The sing-along: do, the count-in and the other part; nothing listens. */
  async function runAlong(): Promise<void> {
    if (flight !== null || resting) return
    sounding?.stop()
    mode = 'along'
    feelings.reset()
    const me: Flight = { cancelled: false, left: false }
    flight = me
    begun = true
    opening(true)
    drawSet()
    view.after(NO_AFTER)
    view.readings(null)
    view.show([], { fig: true })
    const whole =
      (await steps.sayDo(me)) &&
      !me.cancelled &&
      (await wait(QUIET_GAP_SEC).then(() => !me.cancelled)) &&
      (await steps.countAndSing(me, null)).end === 'along'
    if (flight !== me) return
    flight = null
    opening(false)
    if (!whole) {
      // cut short: nothing was listening, so its own line again
      view.show(withVoice(['along']), { fig: true })
      view.status(STATUS.nomic)
      return
    }
    view.show(['feel'], { fig: true })
    view.status(STATUS.feel)
    view.focusText(q('[data-panel="feel"]', card))
  }

  // how many plays have begun, so one cut short by the next leaves its button to it
  let plays = 0

  /** One of the card's plays: its sound, the cursor and its lights from now, its button lit while it sounds. */
  async function playOn(
    b: HTMLButtonElement,
    start: () => Run,
    staffs: readonly number[],
  ): Promise<void> {
    if (b.disabled || flight !== null) return
    sounding?.stop()
    const mine = ++plays
    b.classList.add('is-on')
    const from = performance.now()
    const run = start()
    let over = false
    void run.done.then(() => {
      over = true
    })
    void fig.track(from, staffs, () => over || mine !== plays)
    await sound(run)
    if (mine !== plays) return
    fig.at(null)
    b.classList.remove('is-on')
  }

  /** "Just listen today"'s play: bars 1 to 8, both parts, again on each tap. */
  function playSong(b: HTMLButtonElement): void {
    void playOn(b, () => startSong(Sound.canPlay()), BOTH_STAFFS)
  }

  /** Hear the other part first, on the alone path: that part alone, outside any take. */
  function playFirst(b: HTMLButtonElement): void {
    const v = voiceNow()
    view.status(firstStatus(v))
    void playOn(b, () => startFirst(v, Sound.canPlay()), [otherStaff(v)]).then(
      () => {
        if (flight === null && !b.classList.contains('is-on'))
          view.status(aloneStatus(v))
      },
    )
  }

  /** Hear it with the other part: the kept take with that part from its bar 1, lined up as it was sung. */
  function playBack(b: HTMLButtonElement): void {
    const take = shelf.get(1)
    const context = Sound.context()
    if (take === null || context === null || flight !== null) return
    const v = voiceNow()
    void playOn(
      b,
      () => {
        const p = playWithPart(take, context, NowPlaying, {
          book: (at) => bookPart(otherOf(v), at),
          seconds: PART_SEC,
          onset,
        })
        if (p === null) {
          view.status(STATUS.soundOff)
          return { done: Promise.resolve(false), stop: () => undefined }
        }
        view.status(playbackStatus(v))
        return p
      },
      BOTH_STAFFS,
    )
  }

  /** Delete your take: the recording goes, the lines stay. */
  function deleteTake(): void {
    sounding?.stop()
    takes += 1
    shelf.clear()
    view.kept(false)
    view.status(STATUS.deleted)
    view.focusText(q('#singStatus'))
  }

  /** Done for today, on any of its buttons: the checkpoint ends here, the Wrap's card as the visit's ending picks it. */
  function finish(): void {
    for (const b of qa<HTMLButtonElement>(
      '[data-panel="after"] .sing-btns button',
      card,
    ))
      b.hidden = true
    mic.release()
    view.status(STATUS.done)
    view.focusText(q('#singStatus'))
  }

  /**
   * A run, from Start, Start again or Again: the microphone's question,
   * unless sound is off, when it asks for nothing and says why (WEB-SPEC,
   * Toys 6, state 5).
   */
  function begin(): void {
    if (fig.held) return
    const silent = !Sound.canPlay({ needsSound: true })
    view.startHint(silent ? START_SOUND_OFF : '')
    if (silent) {
      // said on the status line too: the buttons after a run have no hint of their own
      view.status(START_SOUND_OFF)
      return
    }
    void runOnce()
  }

  /** After the voice choice: the headphones check, or the briefing once it is answered. */
  function afterVoice(): void {
    sounding?.stop()
    if (mode === 'along') toAlong()
    // the headphones answer holds for the visit (Toys 6, state 4)
    else if (Headphones.answer === null) toPhones()
    else toBrief()
  }

  mountComfort(card, {
    onSing: () => {
      if (VoiceChoice.voice === null) toVoice()
      else {
        view.voiceLine(true)
        toPhones()
      }
    },
    onListen: () => {
      resting = true
      VisitEnding.set('rest')
      toListen()
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), () => {
    afterVoice()
  })
  mountHeadphones(q('[data-phones-check]', card), {
    onOn: toBrief,
    onOff: toBrief,
  })

  const on = (selector: string, fn: (b: HTMLButtonElement) => void): void => {
    for (const b of qa<HTMLButtonElement>(selector, card))
      b.addEventListener('click', () => {
        fn(b)
      })
  }
  on('[data-sing="start"]', begin)
  on('[data-sing="again"]', begin)
  on('[data-sing="restart"]', begin)
  on('[data-sing="first"]', playFirst)
  on('[data-sing="playback"]', playBack)
  on('[data-sing="delete"]', deleteTake)
  on('[data-sing="along"]', () => void runAlong())
  on('[data-sing="along-again"]', () => {
    alongAgain = true
    void runAlong()
  })
  on('[data-sing="today"]', finish)
  on('[data-listen-play]', playSong)

  // let go of the microphone, and of what plays here, whenever the viewer leaves
  const leave = (now: boolean): void => {
    if (flight !== null) {
      flight.cancelled = true
      flight.left = true
    }
    sounding?.stop()
    mic.release(now)
  }
  // leaving is staying away: a panel that grows or shrinks can take the
  // section off screen for a moment, and that must not stop a run
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
  // leaving the page drops the take with it
  window.addEventListener('pagehide', () => {
    leave(true)
    shelf.clear()
  })
}
