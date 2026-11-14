// ============================================================
// Lesson 26 Sing it — your part with Merc's, then the swap
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 5), on the kit's pieces under the Guided
// Voice Check's safety rules (docs/specs/guided-voice-check.ears.md): the
// comfort check first on every visit and never stored (kit/comfort.ts);
// the voice choice when none is stored (kit/voice-choice.ts), Merc for the
// lower voice in G on G3 and Tavi for the higher on G4, with no Move do and
// no other octave; "Just listen today", whose Play the two parts plays the
// tune, the part, then both, and asks for nothing; the headphones check
// (kit/headphones.ts), whose "No headphones" opens the sing-along; and the
// briefing, whose Start is the only control that asks for the microphone,
// under the consumer id `lesson-26`.
//
// A set is one part sung in runs: the learner's part, then, after Easy or
// Workable, the tune in the swap (sing-plan.ts). Before every run the
// quiet check plays the first 2.0 s of the other part alone while the
// listener reads the frames (kit/quiet-check.ts, loaded on Start): any
// voiced run of 0.3 s or more releases the microphone and opens the
// sing-along, with Start under it to try again. Then the run: the model,
// Merc or Tavi singing the learner's part alone, its bands lighting as its
// notes sound, the other listening; 0.4 s of quiet; one bar of woodblock;
// and the take (kit/take-in-time.ts), opened half a beat before bar 1 and
// read in time from the singer's first note, while the other part sounds
// from bar 1's first beat, one voice booked on the audio clock and the one
// sound the take keeps (kit/sound.ts `Sound.hush`), its beads lighting as
// they sound and the cursor moving at the beat, drawn every frame of the
// take since the hush stops the beat clock that counted in. Nothing draws
// the learner's line during a run. Half a second after the take come the
// pitch line and the lines, one a note, which say where each note sat, or
// "That was Merc's note: mi.", and "How did that feel?" (sing-plan.ts
// `afterRun`): Easy or Workable offers the swap after the learner's part,
// Again while the set has takes left, and Done for today; Effortful keeps
// the lines and offers only Done for today, with the rest card;
// Uncomfortable takes the lines away, releases the microphone and leaves
// the doctor lines and the rest card. Nothing celebrates a run.
//
// The sing-along, for No headphones, no microphone or a quiet check that
// heard a note, sings the model, counts in, then plays the other part while
// the bands light as their beats come; nothing listens. From Start until a
// run ends every other play on the page is held and any sound stops (WEB-
// SPEC, Audio, rule 4); leaving the section for 600 ms, or hiding the page,
// ends what plays here, abandons a take, which counts, and releases the
// microphone. Nothing is recorded, kept or sent.

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, wait } from '@/features/lessons/kit/dom'
import { mountHeadphones } from '@/features/lessons/kit/headphones'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercListen, mercSing } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as QuietKit from '@/features/lessons/kit/quiet-check'
import { heardLine, QUIET_SEC, quietLine, } from '@/features/lessons/kit/quiet-words'
import type { RunNote } from '@/features/lessons/kit/run'
import type { Voice as Tone } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type * as TakeKit from '@/features/lessons/kit/take-in-time'
import type { TakeEnd } from '@/features/lessons/kit/take-in-time'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { axisAt } from './sing-figure'
import type { RunMark, SetId } from './sing-plan'
import { AFTER_SEC, afterRun, againAllowed, AXIS, beatsOf, BPM, COUNT_IN, figureWords, modelStatus, noteAt, ownerOf, PART_SEC, partName, partOf, pitchWords, setParts, startSoundOff, STATUS, swapLine, takeStatus, title, tuneOf, turnFirst, } from './sing-plan'
import { bookPart, CHECK_SEC, QUIET_GAP_SEC, startCountIn, startListen, startModel, } from './sing-sounds'
import type { AfterView, Panel, SingView } from './sing-view'
import { createSingView, NO_AFTER } from './sing-view'

/** Every play on the page outside Sing it, held from Start until a run ends. */
export const PAGE_PLAYS =
  '[data-play], [data-word-play], [data-step-play], [data-toy-play], [data-quiz-play], [data-pair], [data-copy], [data-side], [data-state]'

/** What loads on Start: the take with its reader, and the quiet check, which bring the pitch code. */
interface Kits {
  readonly take: typeof TakeKit
  readonly quiet: typeof QuietKit
}

/** The page's hooks for its tests: the modules Start loads. */
export interface SingOptions {
  readonly loadKits?: () => Promise<Kits>
}

/** A run in flight: cut when the viewer leaves, or by the page. */
interface Flight {
  cancelled: boolean
  /** The viewer left or hid the page: the run counts. */
  left: boolean
}

/** Mounts Sing it on the page's #singCard. */
export function initSing(o: SingOptions = {}): void {
  // the learner has left Sing it: off screen for 600 ms (the leave watch below)
  let left = false
  const view: SingView = createSingView(() => !left)
  const fig = view.figure
  const card = q('#singCard')
  const mic = new MicHold('lesson-26')
  const loadKits =
    o.loadKits ??
    (async (): Promise<Kits> => {
      const [take, quiet] = await Promise.all([
        import('@/features/lessons/kit/take-in-time'),
        import('@/features/lessons/kit/quiet-check'),
      ])
      return { take, quiet }
    })
  let set: SetId = 'part'
  const runs: Record<SetId, RunMark[]> = { part: [], swap: [] }
  let mode: 'sets' | 'along' = 'sets'
  let alongAgain = false
  let flight: Flight | null = null
  let sounding: { stop(): void } | null = null
  let resting = false
  let begun = false

  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'
  const singer = (): Which => mercOf(voiceNow())
  const listener = (): Which => (singer() === 'blue' ? 'orange' : 'blue')

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
  // a play enabled during a run (the cold open's choice, say) still waits for its end
  document.addEventListener(
    'click',
    (e) => {
      if (open && e.target instanceof Element && e.target.closest(PAGE_PLAYS))
        e.stopImmediatePropagation()
    },
    true,
  )

  /** Plays `run` as the page's one sound; true once it has ended by itself. */
  async function sound(run: {
    readonly done: Promise<boolean>
    stop(): void
  }): Promise<boolean> {
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

  /** Draws the set's figure and its lines for the chosen voice. */
  function drawSet(): void {
    const v = voiceNow()
    const { mine, other } = setParts(v, set)
    view.voice(v)
    view.turn(turnFirst(v, set))
    fig.set(mine, other, figureWords(v, set))
  }

  /** The voice choice shows with the panel after it until the first run. */
  const withVoice = (p: Panel[]): Panel[] => (begun ? p : ['voice', ...p])

  function toVoice(listen: boolean): void {
    view.voiceLine(false)
    view.show(['voice'])
    view.status(listen ? STATUS.voiceListen : STATUS.voice)
    view.focusText(q('[data-panel="voice"]', card))
  }

  function toListen(): void {
    set = 'part'
    drawSet()
    view.show(withVoice(['listen']), { fig: true })
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
    view.show(withVoice(['brief', 'start']), { fig: true })
    view.status(STATUS.brief)
    view.focusText(q('[data-panel="brief"]', card))
  }

  /** The sing-along's panel: after No headphones, no microphone, or a quiet check that heard a note. */
  function toAlong(why: 'phones' | 'nomic' | 'heard'): void {
    if (flight !== null) flight.cancelled = true
    flight = null
    opening(false)
    mic.release(why !== 'phones')
    mode = 'along'
    drawSet()
    view.quietFailed(why === 'heard')
    view.after(NO_AFTER)
    view.show(withVoice(['along']), { fig: true })
    view.status(
      why === 'heard'
        ? heardLine(partName(voiceNow()))
        : why === 'nomic'
          ? STATUS.nomic
          : STATUS.along,
    )
    view.focusText(q('[data-panel="along"]', card))
  }

  // how many notes each part has lit, so a note's end puts out only its own
  const lights = { mine: 0, other: 0 }

  /** Lights a note of a play for as long as it sounds. */
  function flash(which: 'mine' | 'other', i: number, sec: number): void {
    const n = ++lights[which]
    if (which === 'mine') fig.mine(i)
    else fig.other(i)
    window.setTimeout(() => {
      // the next note starts as this one ends, and its timer may run first
      if (lights[which] !== n) return
      if (which === 'mine') fig.mine(null)
      else fig.other(null)
    }, sec * 1000)
  }

  /** The other part playing from bar 1 at `bar1` ms on the page's clock: its beads lit and the cursor at the beat, every frame. */
  function follow(bar1: number): () => void {
    let last: number | null = -1
    return () => {
      const t = (performance.now() - bar1) / 1000
      fig.cursor(t < PART_SEC + 0.25 ? axisAt((t * BPM) / 60) : null)
      const i = noteAt(t)
      if (i !== last) fig.other(i)
      last = i
    }
  }

  /** The quiet check: the other part's first 2.0 s alone, while the listener reads the frames. */
  async function quietCheck(
    kits: Kits,
    me: Flight,
  ): Promise<'quiet' | 'heard' | 'cut'> {
    const { other } = setParts(voiceNow(), set)
    const l = mic.listener
    const mod = mic.mod
    if (l === null || mod === null) return 'cut'
    view.status(quietLine(partName(voiceNow())))
    const part = bookPart(other.midis, 0, CHECK_SEC)
    Sound.hush(true, part)
    flash('other', 0, 1)
    window.setTimeout(() => {
      if (!me.cancelled) flash('other', 1, 1)
    }, 1000)
    const frames = await mod.framesFor(l, QUIET_SEC, () => me.cancelled)
    part?.stop(0.1)
    Sound.hush(false)
    fig.other(null)
    if (frames === null || me.cancelled) return 'cut'
    return kits.quiet.heardNothing(frames) ? 'quiet' : 'heard'
  }

  /** The model: the learner's part sung alone, its bands lit as its notes sound; false if cut short. */
  async function model(me: Flight): Promise<boolean> {
    const v = voiceNow()
    const { mine } = setParts(v, set)
    view.status(modelStatus(v))
    mercSing(singer(), mine.midis[0], true)
    mercListen(listener(), true)
    const heard = await sound(
      startModel(mine.midis, Sound.canPlay(), (i) => {
        fig.mine(i)
      }),
    )
    fig.mine(null)
    mercSing(singer(), mine.midis[0], false)
    return heard && !me.cancelled
  }

  /** Calls `fn` about 30 times a second until it says it is done. */
  function ticking(fn: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const tick = (): void => {
        if (fn()) resolve()
        else window.setTimeout(tick, 1000 / 30)
      }
      tick()
    })
  }

  /**
   * The count-in, then the other part from bar 1's first beat: one voice
   * booked on the audio clock half a beat before it, and in a run the take
   * opened then too, which keeps the part through its hush. In the
   * sing-along nothing listens and the learner's bands light as their beats
   * come. Resolves with the take's end, 'along' for a sing-along played
   * through, or null when cut short.
   */
  async function countAndSing(
    me: Flight,
    kits: Kits | null,
  ): Promise<TakeEnd | 'along' | null> {
    const v = voiceNow()
    const { mine, other } = setParts(v, set)
    view.status(STATUS.counting)
    let part: Tone | null = null
    let take: Promise<TakeEnd> | null = null
    let bar1: number | null = null
    const clock = startCountIn(
      Sound.canPlay(),
      (beat) => {
        fig.count(beat + 1)
      },
      (spot) => {
        if (bar1 !== null || me.cancelled) return
        if (spot.beats < COUNT_IN - AXIS.lead - 1e-6) return
        const first = clock.pageTimeOfBeat(0)
        const audio = clock.audioTimeOfBeat(0)
        const now = Sound.context()?.currentTime
        if (first === null) return
        bar1 = first + (COUNT_IN * 60000) / BPM
        // built before the take opens, and booked on bar 1's first beat
        if (audio !== null && now !== undefined)
          part = bookPart(other.midis, audio + (COUNT_IN * 60) / BPM - now)
        if (kits === null || mic.mod === null || mic.listener === null) return
        take = kits.take.runTake({
          mod: mic.mod,
          listener: mic.listener,
          notes: beatsOf(mine.midis),
          labels: mine.syllables.map(title),
          bpm: BPM,
          bar1,
          cancelled: () => me.cancelled,
          whose: "your part's note",
          other: {
            notes: beatsOf(other.midis),
            whose: ownerOf(v),
            labels: other.syllables,
          },
          onFrame: follow(bar1),
        })
      },
    )
    const counted = await sound(clock)
    fig.count(0)
    const booked = part as Tone | null
    const opened = take as Promise<TakeEnd> | null
    const from = bar1 as number | null
    if (
      !counted ||
      me.cancelled ||
      from === null ||
      (kits !== null && (opened === null || booked === null))
    ) {
      me.cancelled = true
      booked?.stop(0.1)
      if (opened !== null) await opened
      return null
    }
    view.status(kits === null ? STATUS.along : takeStatus(v))
    mercSing(singer(), other.midis[0], true)
    let end: TakeEnd | 'along' | null
    if (opened !== null) {
      Sound.hush(true, booked)
      end = await opened
      Sound.hush(false)
    } else {
      // the sing-along: the cursor and the beads as in a run, and the learner's bands lit as their beats come
      const draw = follow(from)
      await ticking(() => {
        if (me.cancelled) return true
        draw()
        const t = (performance.now() - from) / 1000
        fig.mine(t < PART_SEC ? noteAt(t) : null)
        return t >= PART_SEC
      })
      end = me.cancelled ? null : 'along'
    }
    booked?.stop(0.1)
    mercSing(singer(), other.midis[0], false)
    mercListen(listener(), false)
    fig.cursor(null)
    fig.other(null)
    fig.mine(null)
    return end
  }

  /** One run of `s`: the quiet check, the model, the count-in and the take; then the lines and the question. */
  async function runSet(s: SetId): Promise<void> {
    if (flight !== null || resting || sounding !== null) return
    set = s
    mode = 'sets'
    feelings.reset()
    const me: Flight = { cancelled: false, left: false }
    flight = me
    begun = true
    opening(true)
    drawSet()
    view.after(NO_AFTER)
    view.readings(null)
    view.show([], { fig: true })
    view.status(STATUS.asking)
    const [ok, kits] = await Promise.all([
      mic.open(Sound.context()),
      loadKits().catch(() => null),
    ])
    if (!ok || kits === null) {
      toAlong('nomic')
      return
    }
    if (document.hidden || left) {
      cut(me)
      return
    }
    const quiet = await quietCheck(kits, me)
    if (quiet === 'heard') {
      toAlong('heard')
      return
    }
    if (quiet === 'cut' || !(await model(me))) {
      cut(me)
      return
    }
    await wait(QUIET_GAP_SEC)
    if (me.cancelled) {
      cut(me)
      return
    }
    const end = await countAndSing(me, kits)
    mic.release()
    if (end === null || end === 'along' || end.kind === 'left') {
      cut(me)
      return
    }
    ended(me, end)
  }

  /**
   * A run cut short: abandoned by the viewer, which counts, with Start
   * again while the set allows; or stopped by the sound going off, which
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
    runs[set].push({ kind: 'left' })
    view.after({
      ...NO_AFTER,
      restart: againAllowed(runs[set]),
      today: true,
    })
    view.show(['after'], { fig: true })
    view.status(STATUS.left)
  }

  /** A take's end: counted, then the lines and "How did that feel?", or the no-voice line. */
  function ended(me: Flight, end: Extract<TakeEnd, { kind: 'read' }>): void {
    if (flight !== me) return
    flight = null
    opening(false)
    const v = voiceNow()
    if (!end.voiced) {
      runs[set].push({ kind: 'silent' })
      const restart = againAllowed(runs[set])
      view.after({ ...NO_AFTER, closing: 'silent', restart, today: true })
      view.show(['after'], { fig: true })
      view.status(restart ? STATUS.silent : STATUS.spent)
      view.focusText(q('[data-panel="after"]', card))
      return
    }
    runs[set].push({ kind: 'read', inBand: end.inBand, notes: 5 })
    window.setTimeout(() => {
      fig.pitch(end.pitch, pitchWords(v, set, end.pitch?.octaves ?? 0))
      view.readings(end.lines)
      view.show(['feel'], { fig: true, lines: true })
      view.status(STATUS.feel)
      view.focusText(q('#singLive'))
    }, AFTER_SEC * 1000)
  }

  function onFeel(f: Feeling): void {
    const v = voiceNow()
    const a = afterRun(
      set,
      runs[set],
      f,
      mode === 'along' ? { again: alongAgain } : null,
    )
    const after: AfterView = {
      closing: a.closing,
      tricky: a.tricky,
      doctor: a.doctor,
      swap: a.offers.swap,
      again: a.offers.again,
      restart: false,
      alongAgain: a.offers.alongAgain,
      today: a.offers.today,
    }
    view.after(after)
    if (!a.readings) {
      fig.pitch(null)
      view.readings(null)
    }
    if (a.rest) {
      resting = true
      VisitEnding.set('rest')
    }
    if (f === 'uncomfortable') mic.release(true)
    view.show(['feel', 'after'], {
      fig: a.readings || mode === 'along',
      lines: a.readings,
    })
    view.status(
      a.closing === 'swap'
        ? swapLine(v)
        : a.closing === 'gentle'
          ? STATUS.gentle
          : a.closing === 'enough'
            ? STATUS.enough
            : mode === 'along'
              ? STATUS.alongDone
              : STATUS.both,
    )
    view.focusText(q('[data-panel="after"]', card))
  }

  const feelings = mountFeelings(card, onFeel)

  /** The sing-along of `s`: the model, the count-in and the other part; nothing listens. */
  async function runAlong(s: SetId): Promise<void> {
    if (flight !== null || resting || sounding !== null) return
    set = s
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
      (await model(me)) &&
      !me.cancelled &&
      (await wait(QUIET_GAP_SEC).then(() => !me.cancelled)) &&
      (await countAndSing(me, null)) === 'along'
    if (flight !== me) return
    flight = null
    opening(false)
    if (!whole) {
      // cut short: nothing was listening, so its own line again, with Start the sing-along
      view.show(withVoice(['along']), { fig: true })
      view.status(STATUS.along)
      return
    }
    view.show(['feel'], { fig: true })
    view.status(STATUS.feel)
    view.focusText(q('[data-panel="feel"]', card))
  }

  // how many listening plays have begun, so one cut short by the next leaves the button and Merc to it
  let listens = 0

  /** "Just listen today"'s play: the tune, the part, then both, again on each tap. */
  async function playListen(b: HTMLButtonElement): Promise<void> {
    if (b.disabled) return
    sounding?.stop()
    const mine = ++listens
    const v = voiceNow()
    const tune = tuneOf(v)
    const part = partOf(v)
    b.classList.add('is-on')
    mercSing(singer(), tune.midis[0], true)
    await sound(
      startListen(tune, part, Sound.canPlay(), (n: RunNote, i: number) => {
        // the notes in the play's order: the tune, the part, then both
        const k = i % 5
        const isTune = i < 5 || (i >= 10 && i < 15)
        flash(isTune ? 'other' : 'mine', k, n.dur)
      }),
    )
    if (mine !== listens) return
    mercSing(singer(), tune.midis[0], false)
    b.classList.remove('is-on')
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
   * A run of set `s`, from Start, Start again, Again or Swap parts: the
   * microphone's question, unless sound is off, when it asks for nothing
   * and says why ("Start waits for sound", WEB-SPEC, Edge cases).
   */
  function begin(s: SetId): void {
    const silent = !Sound.canPlay({ needsSound: true })
    view.startHint(silent ? startSoundOff(voiceNow()) : '')
    if (silent) {
      // said on the status line too: Start under the sing-along, and the
      // buttons after a run, have no hint of their own
      view.status(startSoundOff(voiceNow()))
      return
    }
    void runSet(s)
  }

  /** After the voice choice: listening only, the headphones check, or where the visit had got to. */
  function afterVoice(): void {
    if (resting) toListen()
    else if (mode === 'along') toAlong('phones')
    else toPhones()
  }

  mountComfort(card, {
    onSing: () => {
      if (VoiceChoice.voice === null) toVoice(false)
      else {
        view.voiceLine(true)
        toPhones()
      }
    },
    onListen: () => {
      resting = true
      VisitEnding.set('rest')
      if (VoiceChoice.voice === null) toVoice(true)
      else {
        view.voiceLine(true)
        toListen()
      }
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), () => {
    afterVoice()
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
  on('[data-sing="start"]', () => {
    begin(set)
  })
  on('[data-sing="again"]', () => {
    begin(set)
  })
  on('[data-sing="restart"]', () => {
    begin(set)
  })
  on('[data-sing="swap"]', () => {
    if (mode === 'along') void runAlong('swap')
    else begin('swap')
  })
  on('[data-sing="along"]', () => void runAlong(set))
  on('[data-sing="along-again"]', () => {
    alongAgain = true
    void runAlong(set)
  })
  on('[data-sing="today"]', finish)
  on('[data-listen-play]', (b) => void playListen(b))

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
  window.addEventListener('pagehide', () => {
    leave(true)
  })
}
