// ============================================================
// Lesson 11 Sing it — one slow siren on "ng", with nothing read
// ============================================================
//
// The checkpoint (WEB-SPEC, Toys 4), under the Guided Voice Check's safety
// rules (docs/specs/guided-voice-check.ears.md), as Lessons 3, 5 and 7 hold
// theirs: the comfort check first on every visit and never stored
// (REQ-GVC-020, 021); "Just listen today" opens a listening mode in which
// Merc sings the slow siren on a tap and nothing listens, with the rest line
// and the doctor lines. Either answer goes on to the voice choice, which
// picks the Merc who sings. Singing then offers the optional warm-up, which
// never listens (REQ-GVC-074, 075), and the briefing, whose Start is the
// only control that asks for the microphone, and waits until Merc's slow
// siren has been heard with the sound on (playbook rule 16).
//
// What the card offers is the kit's pure rule (kit/siren-flow.ts), run
// without a reading: the app cannot tell a gear (FACTS 27, 64), so the take
// draws the singer's line and nothing marks it, and every sung siren closes
// on the page's one plain line. The take is sing-take.ts's, so this file
// draws what the rule says. "How did that feel?" follows every take that
// heard a voice (REQ-GVC-022); an answer locks once given, so it cannot be
// changed after it has set what follows, and the next take frees the four
// again. Nothing is scored or celebrated (FACTS 66). The microphone is held
// only around a take: acquired on the tap that starts one, released when it
// ends, when the viewer leaves the section, when the tab is hidden and when
// the page goes. Refused, missing, or a listener that fails to load: the
// page carries on listening only, with "No microphone? ...". Nothing is
// recorded, kept or sent; only the voice choice (`fyp-voice`) and the
// warm-up's Skip (`fyp-l11-warmup`) are stored. The ending picks the Wrap's
// card for the visit, in memory only (kit/comfort.ts).

import type { Feeling } from '@/features/lessons/kit/comfort'
import { mountComfort, mountFeelings, VisitEnding, } from '@/features/lessons/kit/comfort'
import { q, qa, store } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { MicHold } from '@/features/lessons/kit/mic-hold'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playLine } from '@/features/lessons/kit/run'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import type { SirenEvent, SirenOffers, SirenVisit, } from '@/features/lessons/kit/siren-flow'
import { freshVisit, next, offers as flowOffers, } from '@/features/lessons/kit/siren-flow'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { bindVoiceButtons, homeOf, mercOf, VoiceChoice, } from '@/features/lessons/kit/voice-choice'
import { warmUpContour } from '@/features/lessons/kit/warm-up'
import { playGears } from './gear-sound'
import { N, singSirenLine, SIREN_SEC, spoken } from './lines'
import type { LiveChart, TakeEnd } from './sing-take'
import { CONSUMER, mountLiveChart, RING_LABEL, TAKE_SAID, takeOne, } from './sing-take'

/** The warm-up's Skip, remembered so a return visit opens it folded. */
export const WARMUP_KEY = 'fyp-l11-warmup'

/** Every status line the checkpoint says. */
export const STATUS = {
  comfort: 'Before you sing: how is your voice today?',
  listen: 'Just listening today: the microphone stays off.',
  nomic:
    'No microphone? Sing along anyway: Merc sings the siren first, and nothing listens.',
  voice: "Choose the voice you'll sing with.",
  prepare: "Warm up if you like. Then play Merc's slow siren, and press Start.",
  merc: 'Merc sings the slow siren on “ng”: listen to the way it slides.',
  asking: 'Asking your browser for the microphone.',
  take: 'Breathe, then hum one slow siren on “ng”, up only as far as is easy and back. We stop listening when you stop.',
  noVoice: 'We didn’t hear you start that time. Hum “ng” as the ring turns.',
  stopped: 'Stopped listening: the microphone is off.',
  feel: 'How did that feel?',
  done: 'Done for today.',
} as const

/** The card's own lines, LESSON.md's. */
export const LINES = {
  plain:
    "That's it: one slow siren, done. Flip or no flip, that's a whole siren.",
  gentle: 'Keep it gentle: rest before you sing again.',
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
  startFirst: "Play Merc's slow siren first",
  startOff:
    "Sound is off, so nothing played. Turn sound on to hear Merc's slow siren, then press Start.",
  noAudio: "This browser can't play sound here.",
} as const

/** Whether the browser has Web Audio at all; asking makes no AudioContext. */
const webAudio = (): boolean =>
  typeof window.AudioContext !== 'undefined' || 'webkitAudioContext' in window

/** Writes a live line only when its words change, so a screen reader hears it once. */
function say(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text
}

/** Keeps the keyboard's place on text, never on a button. */
function focusText(el: HTMLElement): void {
  el.tabIndex = -1
  el.focus({ preventScroll: true })
}

/** What the card offers: the kit's flow, on a page that reads nothing. */
export const offers = (v: SirenVisit): SirenOffers => flowOffers(v)

/** The status line for the visit as the card stands after a take or an answer. */
export function afterStatus(o: SirenOffers): string {
  if (o.closing !== null)
    return o.closing === 'band' ? LINES.plain : LINES[o.closing]
  return o.ask ? `${TAKE_SAID} ${STATUS.feel}` : STATUS.noVoice
}

/** The live chart's words for Merc's slow siren: spoken names only. */
export function mercSaid(v: Voice): string {
  const lo = v === 'lower' ? N.E3 : N.E4
  return `Merc's slow siren, from ${spoken(lo)} up to ${spoken(lo + 9)} and back`
}

/** What the card is doing between the flow's states. */
type Phase = 'idle' | 'asking' | 'take' | 'after'

export interface SingCard {
  /** The card's live chart: Merc's siren and the singer's line. */
  readonly live: LiveChart
}

export function initSing(stills: RingStills): SingCard {
  const card = q('#singCard')
  const statusEl = q('#singStatus')
  const liveEl = q('#singLive')
  const startBtn = q<HTMLButtonElement>('[data-sing="start"]', card)
  const startHint = q('[data-start-hint]', card)
  const listenHint = q('[data-listen-hint]', card)
  const warmup = q<HTMLDetailsElement>('#warmup')
  const ring = mountRing(q('#ring'), {
    stills,
    calm: true,
    words: { listen: 'Listen', turn: () => 'Listening', done: 'Rest' },
  })
  const voiceNow = (): Voice => VoiceChoice.voice ?? 'lower'
  const live = mountLiveChart(q('#singChart'), voiceNow(), watch(q('#sing')))
  const mic = new MicHold(CONSUMER)
  let visit: SirenVisit = freshVisit()
  let phase: Phase = 'idle'
  // the voice stored when the comfort check was answered: which voice line shows
  let storedVoice = VoiceChoice.voice !== null
  let take: { cancelled: boolean } | null = null
  let merc: Run | null = null
  // where Merc's line stands, seconds of its 8.5
  let mercT = 0

  // ------------------------------------------------------------ drawing

  let shown = ''
  const show = (panels: readonly string[]): void => {
    for (const p of qa('[data-panel]', card))
      p.hidden = !panels.includes(p.dataset.panel ?? '')
    const now = panels.join(' ')
    const first = shown === ''
    if (now === shown) return
    shown = now
    if (first) return
    // a tall panel giving way to a short one can leave the card above the
    // screen (a phone, after Start): bring its top back at once, before the
    // section's leave watch below sees it gone and ends the take, as
    // Lesson 3's card does (lesson-03/sing-view.ts)
    const top = card.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.7)
      card.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function panelsNow(o: SirenOffers): string[] {
    if (visit.mode === null) return ['comfort']
    const voice = VoiceChoice.voice === null
    if (visit.mode !== 'sing') return voice ? ['voice'] : ['voice', 'listen']
    if (voice) return ['voice']
    if (phase === 'asking' || phase === 'take') return []
    if (o.start) return ['voice', 'prepare']
    if (phase !== 'after') return []
    return o.ask ? ['feel', ...(visit.feeling === null ? [] : ['after'])] : []
  }

  function render(): void {
    const o = offers(visit)
    show(panelsNow(o))
    const listening = visit.mode === 'listen' || visit.mode === 'nomic'
    // the visit's takes spent, the last abandoned: no Start, and Done for
    // today alone, or pressed
    const spent = phase === 'idle' && (o.done || visit.finished)
    // and the ring at rest beside it, unless Merc's siren is still running on it
    if (spent && !ring.busy) ring.stop('Rest')
    liveEl.hidden =
      visit.mode === null ||
      VoiceChoice.voice === null ||
      (visit.mode === 'sing' && phase === 'idle' && !o.start && !spent)
    for (const el of qa('[data-voice-line]', card))
      el.hidden = el.dataset.voiceLine !== (storedVoice ? 'stored' : 'none')
    for (const el of qa('[data-listen-why]', card))
      el.hidden = el.dataset.listenWhy !== visit.mode
    // Merc's slow siren stays to listen to once singing is over for the visit
    q('[data-listen-play]', card).hidden = !(
      listening ||
      (phase === 'after' && visit.effort)
    )
    listenHint.hidden = !(listening && !webAudio())
    listenHint.textContent = LINES.noAudio
    // Start: on the card while the flow offers it, available once Merc's siren is heard
    startBtn.hidden = !o.start
    startBtn.setAttribute('aria-disabled', String(!o.startReady))
    startHint.hidden = o.startHint === null
    startHint.textContent =
      o.startHint === 'off' ? LINES.startOff : LINES.startFirst
    // after a take with no voice: its line, and what comes next
    const noVoice = phase === 'after' && !o.ask
    const actions = q('[data-take-actions]', card)
    actions.hidden = !(noVoice || spent) || visit.finished
    q('.no-voice-line', actions).hidden = !noVoice
    q('[data-sing="again"]', actions).hidden = !o.again
    q('[data-sing="today"]', actions).hidden = !o.done
    renderAfter(o)
    const ending = o.restCard ? 'rest' : 'practise'
    if (VisitEnding.ending !== ending) VisitEnding.set(ending)
  }

  /** Under the answers: the closing line, the doctor lines and what comes next. */
  function renderAfter(o: SirenOffers): void {
    const after = q('[data-panel="after"]', card)
    const closing = o.closing === 'band' ? 'plain' : o.closing
    for (const el of qa('[data-closing]', after))
      el.hidden = el.dataset.closing !== closing
    q('[data-after-doctor]', after).hidden = !o.doctor
    q('[data-sing="again"]', after).hidden = !o.again
    q('[data-sing="today"]', after).hidden = !o.done
  }

  function dispatch(e: SirenEvent): void {
    visit = next(visit, e)
    render()
  }

  // ------------------------------------------------------------ Merc's slow siren

  function stopMerc(): void {
    if (merc === null) return
    merc.stop()
    merc = null
    ring.stop()
    live.merc(mercT, { glow: false })
    mercSing(mercOf(voiceNow()), homeOf(voiceNow()), false)
    for (const b of qa('[data-merc-siren]', card)) b.classList.remove('is-on')
    NowPlaying.release(stopMerc)
  }

  async function playMerc(): Promise<void> {
    const v = VoiceChoice.voice
    if (v === null || take !== null) return
    stopMerc()
    NowPlaying.claim(stopMerc)
    // without Web Audio it draws in silence, and asks nothing of the sound
    const audible = webAudio() && Sound.canPlay()
    // one gear the whole way, the voice's own (FACTS 81)
    const r = playGears(singSirenLine(v), audible)
    merc = r
    for (const b of qa('[data-merc-siren]', card)) b.classList.add('is-on')
    say(statusEl, STATUS.merc)
    mercSing(mercOf(v), homeOf(v), true)
    void ring.run({
      which: mercOf(v),
      label: RING_LABEL,
      listen: SIREN_SEC,
      turn: 0,
      // ready for the take Start offers; with none on offer, at rest
      words: { done: offers(visit).start ? 'Ready' : 'Rest' },
    })
    const t0 = performance.now()
    mercT = 0
    if (reducedMotion()) {
      mercT = SIREN_SEC
      live.merc(SIREN_SEC, { glow: true })
    } else
      live.chart.animate((now) => {
        if (merc !== r) return false
        mercT = Math.min(SIREN_SEC, (now - t0) / 1000)
        live.merc(mercT, { glow: true })
        return mercT < SIREN_SEC
      })
    const heard = await r.done
    if (merc !== r) return
    merc = null
    NowPlaying.release(stopMerc)
    for (const b of qa('[data-merc-siren]', card)) b.classList.remove('is-on')
    mercSing(mercOf(v), homeOf(v), false)
    mercT = SIREN_SEC
    live.merc(SIREN_SEC, { glow: false })
    live.chart.describe(mercSaid(v))
    // cut short (the page hidden, the Sound switch off): the ring stops with
    // the siren, rather than listening on to the end of a play that is over,
    // and says Ready only for a Start an earlier play readied
    if (!heard) {
      ring.stop(offers(visit).startReady ? 'Ready' : 'Rest')
      return
    }
    const sounded = audible && Sound.state === 'on'
    dispatch({ type: 'played', audible: sounded })
    say(statusEl, statusNow())
  }

  /** The status line for where the flow stands, outside a take. */
  function statusNow(): string {
    if (visit.mode === null) return STATUS.comfort
    if (VoiceChoice.voice === null) return STATUS.voice
    if (visit.mode === 'listen') return STATUS.listen
    if (visit.mode === 'nomic') return STATUS.nomic
    if (visit.finished) return STATUS.done
    if (phase === 'after') return afterStatus(offers(visit))
    return STATUS.prepare
  }

  // ------------------------------------------------------------ the take

  function recordTake(end: TakeEnd): void {
    if (end.abandoned) {
      dispatch({
        type: 'took',
        take: { abandoned: true, voiced: end.voiced },
      })
      phase = 'idle'
      live.endTake(false)
      render()
      say(statusEl, STATUS.stopped)
      return
    }
    phase = 'after'
    live.endTake(true)
    if (end.voiced) live.chart.describe(TAKE_SAID)
    feelings.reset()
    dispatch({ type: 'took', take: { abandoned: false, voiced: end.voiced } })
    say(statusEl, afterStatus(offers(visit)))
    focusText(statusEl)
  }

  /** Start, or Again (which the flow has already allowed): the microphone, asked inside the tap. */
  async function startTake(again: boolean): Promise<void> {
    const context = Sound.context()
    if (take !== null || phase === 'asking') return
    if (!again && !offers(visit).startReady) {
      focusText(startHint)
      return
    }
    const v = VoiceChoice.voice
    if (v === null) return
    stopMerc()
    phase = 'asking'
    render()
    say(statusEl, STATUS.asking)
    const ok = await mic.open(context)
    const { mod, listener } = mic
    if (!ok || mod === null || listener === null) {
      phase = 'idle'
      dispatch({ type: 'nomic' })
      say(statusEl, STATUS.nomic)
      focusText(q('[data-listen-why="nomic"]', card))
      return
    }
    // the tab hidden, or the section left, while the listener loaded: that
    // leave came before the microphone did, so let it go here as the leave
    // does, and end the take unstarted, as an abandoned one with no voice
    const hidden = document.hidden
    if (hidden || left) {
      leave(hidden)
      recordTake({ voiced: false, abandoned: true })
      return
    }
    const me = { cancelled: false }
    take = me
    phase = 'take'
    render()
    say(statusEl, STATUS.take)
    // whatever sounds stops; and nothing sounds while the take is open
    const hold = (): void => undefined
    NowPlaying.claim(hold)
    const end = await takeOne({
      mod,
      listener,
      live,
      ring,
      which: mercOf(v),
      cancelled: () => me.cancelled,
    })
    NowPlaying.release(hold)
    mic.release()
    if (take !== me) return
    take = null
    recordTake(end)
  }

  // ------------------------------------------------------------ answers

  function onFeel(f: Feeling): void {
    // one answer a take: once given it has set what follows
    if (phase !== 'after' || visit.feeling !== null) return
    dispatch({ type: 'feel', feeling: f })
    const o = offers(visit)
    // the singer's answer: "Uncomfortable" takes the line away, Merc's siren stays
    if (!o.keepLine) {
      live.endTake(false)
      live.chart.describe(mercSaid(voiceNow()))
    }
    say(statusEl, afterStatus(o))
    focusText(q('[data-panel="after"]', card))
  }
  // an answer locks once given, and `reset` frees the four for the next take
  const feelings = mountFeelings(card, onFeel)

  function again(): void {
    if (take !== null || !offers(visit).again) return
    dispatch({ type: 'again' })
    void startTake(true)
  }

  /** Done for today: the takes end here, and the card keeps its question, its answer and its last lines. */
  function finish(): void {
    dispatch({ type: 'done' })
    say(statusEl, STATUS.done)
    focusText(statusEl)
  }

  // ------------------------------------------------------------ the warm-up

  let demo: Run | null = null

  function stopDemo(): void {
    demo?.stop()
    demo = null
    mercSing(mercOf(voiceNow()), homeOf(voiceNow()), false)
    NowPlaying.release(stopDemo)
  }

  function playDemo(kind: 'sigh' | 'slide'): void {
    const v = VoiceChoice.voice
    if (v === null) return
    stopDemo()
    NowPlaying.claim(stopDemo)
    // the sigh down a fifth, the slide up to it and back, in Merc's "ooh" (Lesson 3 FACTS 37, 46a)
    const r = playLine(warmUpContour(kind, v), { audible: Sound.canPlay() })
    demo = r
    mercSing(mercOf(v), homeOf(v), true)
    void r.done.then(() => {
      if (demo === r) stopDemo()
    })
  }

  // ------------------------------------------------------------ wiring

  mountComfort(card, {
    onSing: () => {
      storedVoice = VoiceChoice.voice !== null
      dispatch({ type: 'comfort', sing: true })
      if (!webAudio()) dispatch({ type: 'nomic' })
      warmup.open = store.get<unknown>(WARMUP_KEY, false) !== true
      say(statusEl, statusNow())
      const panel = VoiceChoice.voice === null ? 'voice' : 'prepare'
      focusText(q(`[data-panel="${panel}"]`, card))
    },
    onListen: () => {
      storedVoice = VoiceChoice.voice !== null
      dispatch({ type: 'comfort', sing: false })
      say(statusEl, statusNow())
      focusText(q('[data-listen-why="listen"]', card))
    },
  })
  bindVoiceButtons(q('[data-panel="voice"]', card), (v) => {
    stopMerc()
    live.setVoice(v)
    render()
    say(statusEl, statusNow())
  })

  const on = (selector: string, fn: (b: HTMLButtonElement) => void): void => {
    for (const b of qa<HTMLButtonElement>(selector, card))
      b.addEventListener('click', () => fn(b))
  }
  on('[data-merc-siren]', () => void playMerc())
  on('[data-sing="start"]', () => void startTake(false))
  on('[data-sing="again"]', again)
  on('[data-sing="today"]', finish)
  on('[data-warm]', (b) => {
    const w = b.dataset.warm
    if (w === 'skip') {
      store.set(WARMUP_KEY, true)
      warmup.open = false
      q('summary', warmup).focus({ preventScroll: true })
    } else if (w === 'sigh' || w === 'slide') playDemo(w)
  })

  // let go of the microphone whenever the viewer leaves: the section, the tab, the page
  const leave = (now: boolean): void => {
    if (take !== null) take.cancelled = true
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
  render()
  return { live }
}
