// ============================================================
// EchoRoom: Merc sings a phrase, the singer sings it back, stars light
// ============================================================
//
// The premium Echo (design: DESIGN-echo.md, storyboard 01-echo; art:
// ART-FIDELITY.md 3). One room over a painted night sky:
//
//   intro     the empty sky, Merc on the ridge, his line, the mic button
//   call      Merc sings the phrase; a ring fades in on each of his notes
//   response  "Your turn": each note the singer lands lights its star, and
//             the ribbon draws the voice from the last star to the note
//             being sung
//   between   the phrase's constellation, and Merc's one line about it
//   result    the five constellations over the lit town, "17 of 20" notes
//             on pitch, Again and Done
//
// Drawn full-bleed (the shell's premium-rooms.ts, D1): the sky runs under
// the status bar and the floating bar, and the room keeps its controls
// clear of them by the shell's --pushed-top and --pushed-bottom. The head's
// heights are CSS custom properties (EchoRoom.module.css), read here once a
// resize, so the sky's stars always stay under the chip and the result.
//
// The sky is EchoSky (the plates, the take's clouds, rings, stars and
// lines, the celebration star), the voice EchoRibbon and Merc the room
// kit's MercView on the ridge (EchoMerc). The chip, the bubble, the result
// card, the mic, the result's buttons and the level control are the room
// kit's; this room brings its world, its words and its test ids.
//
// "How it works" (demo/) plays over the same room: Merc sings the phrase
// and sings it back twice through the room's own engine, not like this and
// like this, with the demo kit's layer, cards and take pill over it. A
// first visit opens on it, and the "?" in the bar plays it again.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Match, on, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { DemoLayer } from '@/components/demo-kit/DemoLayer'
import { DemoTakePill } from '@/components/demo-kit/DemoTakePill'
import { Volume2 } from '@/components/icons'
import { createFocusHandoff } from '@/components/room-kit/focus-handoff'
import { MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { RoomAsk, RoomBarEnd } from '@/components/room-kit/RoomBar'
import { MicBlocked, MicButton, ResultActions, } from '@/components/room-kit/RoomControls'
import { ResultCard, RoomBubble, RoomChip, } from '@/components/room-kit/RoomHeader'
import { DEMO_COPY } from './demo/demo-cues'
import { aimEchoTip } from './demo/tip-targets'
import { useEchoDemo } from './demo/useEchoDemo'
import type { CityLightState } from './echo-art'
import type { EchoSummary } from './echo-controller-contract'
import { echoMicState } from './echo-machine'
import type { CloudState } from './EchoClouds'
import { EchoLevel } from './EchoLevel'
import { EchoMerc, mercBox } from './EchoMerc'
import type { EchoRibbonApi } from './EchoRibbon'
import { EchoRibbon, RIBBON_REFERENCE_W } from './EchoRibbon'
import styles from './EchoRoom.module.css'
import { EchoSky } from './EchoSky'
import type { SkyLayout } from './sky-layout'
import { inSky, layoutSky } from './sky-layout'
import { useEchoController } from './useEchoController'
import type { VoicePoint } from './voice-path'

export interface EchoRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
}

/** The ribbon's band, plate v: the voice never goes outside it (voiceV). */
const RIBBON_BAND_V = [0.2, 0.5] as const
/** Merc's bubble sits this far down his canvas: just over his head. */
const BUBBLE_OVER_MERC = 0.3

/** The room's box and the head's clearances, px. */
interface RoomBox {
  readonly width: number
  readonly height: number
  readonly top: number
  readonly chipClear: number
  readonly resultClear: number
}

const px = (style: CSSStyleDeclaration, name: string): number => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

/** What the mic says at rest: a tap starts a run. */
const START_LABEL = 'Start: Merc sings, you sing it back'

/** "17 of 20": the result's big number counts the lit stars. */
export function landedText(summary: EchoSummary): string {
  return `${summary.landed} of ${summary.notes}`
}

/** The line under "notes on pitch": the accuracy, and at Pro the timing. */
export function resultDetail(summary: EchoSummary): string | null {
  const parts: string[] = []
  if (summary.accuracy !== null) {
    parts.push(`Accuracy ${Math.round(summary.accuracy)}`)
  }
  if (summary.inTime !== null) {
    parts.push(`In time ${summary.inTime} of ${summary.notes}`)
  }
  return parts.length === 0 ? null : parts.join(' · ')
}

export function EchoRoom(props: EchoRoomProps): JSX.Element {
  const room = useEchoController()
  const demo = useEchoDemo(room)
  const phase = (): string => room.state().phase
  /** The demo has the room: its controls are out of reach. */
  const demoBusy = (): boolean => demo.mode() !== 'idle'
  /**
   * The demo is singing a take: Merc's bubble and the chip keep quiet, so
   * the take's pill and the tooltip speak one at a time.
   */
  const demoTake = (): boolean => demo.take() !== null
  let rootEl: HTMLDivElement | undefined
  const [box, setBox] = createSignal<RoomBox | null>(null)

  onMount(() => {
    const measure = (): void => {
      if (rootEl === undefined) return
      const style = window.getComputedStyle(rootEl)
      const top = Number.parseFloat(style.paddingTop) || 0
      setBox({
        width: rootEl.clientWidth,
        height: rootEl.clientHeight,
        top,
        chipClear: top + px(style, '--echo-chip-clear'),
        resultClear: top + px(style, '--echo-result-clear'),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (rootEl !== undefined) observer.observe(rootEl)
    onCleanup(() => observer.disconnect())
  })

  const layout = createMemo((): SkyLayout | null => {
    const b = box()
    if (b === null || b.width <= 0 || b.height <= 0) return null
    return layoutSky({
      width: b.width,
      height: b.height,
      edgeClear: b.top,
      chipClear: b.chipClear,
      resultClear: b.resultClear,
    })
  })

  // ── The voice ──────────────────────────────────────────────
  let ribbon: EchoRibbonApi | null = null
  let lastPoints: readonly VoicePoint[] | null = null
  /** The ribbon's widths: the storyboard's at its width, scaled with the sky. */
  const ribbonScale = (l: SkyLayout): number =>
    (l.unit / RIBBON_REFERENCE_W) * l.k
  const ribbonBox = (l: SkyLayout) => {
    const top = inSky(l, { u: 0.5, v: RIBBON_BAND_V[0] }, l.k).y
    const bottom = inSky(l, { u: 0.5, v: RIBBON_BAND_V[1] }, l.k).y
    return { left: 0, top, width: l.width, height: Math.max(1, bottom - top) }
  }
  const drawVoice = (points: readonly VoicePoint[] | null): void => {
    lastPoints = points
    const l = untrack(layout)
    if (ribbon === null || l === null) return
    if (points === null || points.length < 2) {
      ribbon.draw(null)
      return
    }
    ribbon.draw({
      points: points.map((p) => ({ ...inSky(l, p, l.k), filling: p.filling })),
      scale: ribbonScale(l),
    })
  }
  room.drawVoice(drawVoice)
  // A new size redraws the voice where the sky now puts it.
  createEffect(on(layout, () => drawVoice(lastPoints), { defer: true }))

  // ── Merc and his bubble ────────────────────────────────────
  const merc = createMemo(() => {
    const l = layout()
    return l === null ? null : mercBox(l)
  })
  const bubbleBottom = (): number => {
    const l = layout()
    const m = merc()
    if (l === null || m === null) return 0
    return l.height - (m.top + m.size * BUBBLE_OVER_MERC)
  }
  const running = (): boolean =>
    phase() === 'call' || phase() === 'response' || phase() === 'between'
  /**
   * The take's clouds (art round 3): loaded once the run starts, up from the
   * first response on (the first call is the storyboard's intro, whose dim
   * clouds are the plate's own), gone at the result and back at the intro.
   */
  const clouds = (): CloudState => {
    const { phase: now, phrase } = room.state()
    // The demo: screen 3's clouds through the take not to copy, a take's
    // through the one to copy; none at its result, its start or its end.
    const take = demo.take()
    if (room.script.active()) {
      return {
        present: take !== null,
        on: take !== null && now !== 'result',
        look: take === 'off' ? 'demo-off' : 'mid-take',
      }
    }
    return {
      present: now === 'starting' || now === 'settle' || running(),
      on:
        now === 'response' ||
        now === 'between' ||
        (now === 'call' && phrase > 0),
    }
  }
  /**
   * The town's city light (art round 5): the intro's while the take's
   * clouds are down, the clouds' own state's with them (the demo's first
   * take has screen 3's), none at the result (its plate lights the town
   * its own way).
   */
  const cityLight = (): CityLightState | null => {
    if (phase() === 'result') return null
    const sky = clouds()
    return sky.on ? (sky.look ?? 'mid-take') : 'intro'
  }
  /** Merc's line shows but while the singer sings the phrase back. */
  const showLine = (): boolean =>
    room.line() !== '' &&
    phase() !== 'response' &&
    phase() !== 'blocked' &&
    !demoTake()
  const showLevel = (): boolean =>
    !room.script.active() &&
    (phase() === 'intro' || phase() === 'result' || phase() === 'blocked')

  /**
   * What a screen reader hears, from one polite region there from the
   * start: the chip while the phrase is sung back, the result and Merc's
   * line at the result, his line otherwise.
   */
  const said = (): string => {
    // The demo speaks for itself (its layer's region).
    if (demoBusy() || room.script.active()) return ''
    if (phase() === 'response') return room.chip() ?? ''
    const summary = phase() === 'result' ? room.summary() : null
    if (summary === null) return room.line()
    const detail = resultDetail(summary)
    return `${landedText(summary)} notes on pitch.${detail === null ? '' : ` ${detail}.`} ${room.line()}`
  }

  // Focus on a control the room takes away goes to the one in its place.
  const focus = createFocusHandoff()
  const mainControl = (): HTMLElement | null => {
    const mode = demo.mode()
    // The demo's cards take focus themselves.
    if (mode === 'card' || mode === 'end') return null
    let id = 'echo-mic'
    if (mode === 'playing') id = 'echo-demo-skip'
    else if (phase() === 'result' && !room.script.active()) id = 'echo-again'
    else if (phase() === 'blocked') id = 'echo-retry'
    return rootEl?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null
  }
  createEffect(
    on([phase, demo.mode], () => focus.handOff(mainControl), { defer: true }),
  )
  /** The mic: ready, waiting through Merc's call, or hearing the reply. */
  const micState = (): MicState =>
    echoMicState(room.state().phase, room.script.active())

  const micLabel = (): string => {
    if (room.script.active()) return START_LABEL
    if (phase() === 'starting') return 'Opening the microphone'
    if (phase() === 'settle') return 'Listening for your note. Tap to stop'
    return labelFor(micState(), START_LABEL)
  }

  return (
    <div
      ref={rootEl}
      class={`${styles.room} mp-dark-stage`}
      data-phase={phase()}
      data-demo={demo.mode()}
      data-testid="echo-room"
      onFocusIn={(event) => focus.noteFocus(event)}
    >
      <Show when={layout()}>
        {(l) => (
          <EchoSky
            layout={l()}
            scene={room.scene()}
            still={false}
            clouds={clouds()}
            cityLight={cityLight()}
            ribbon={
              <EchoRibbon
                box={ribbonBox(l())}
                scale={ribbonScale(l())}
                onReady={(api) => {
                  ribbon = api
                  drawVoice(lastPoints)
                }}
              />
            }
          >
            <Show when={merc()}>
              {(m) => (
                <EchoMerc box={m()}>
                  <MercView
                    state={room.mercState}
                    voice={room.mercVoice}
                    sparkles="right"
                    testId="echo-merc"
                  />
                </EchoMerc>
              )}
            </Show>
          </EchoSky>
        )}
      </Show>

      <div class={styles.head} data-testid="echo-header" inert={demoBusy()}>
        <Switch>
          <Match when={phase() === 'result' ? room.summary() : null}>
            {(summary) => (
              <div class={styles.result}>
                <ResultCard
                  value={landedText(summary())}
                  detail="notes on pitch"
                  testId="echo-result"
                  detailTestId="echo-result-label"
                />
                <Show when={resultDetail(summary())}>
                  {(detail) => (
                    <p class={styles.detail} data-testid="echo-result-detail">
                      {detail()}
                    </p>
                  )}
                </Show>
              </div>
            )}
          </Match>
          <Match when={phase() !== 'result'}>
            <div class={styles.chip}>
              <RoomChip
                text={demoTake() ? null : room.chip()}
                testId="echo-chip"
              />
            </div>
          </Match>
        </Switch>
      </div>

      <RoomBarEnd>
        <Show when={showLevel()}>
          <EchoLevel />
        </Show>
        <Show when={demo.canAsk()}>
          <RoomAsk
            onAsk={() => demo.ask()}
            label={DEMO_COPY.ask}
            testId="echo-ask"
          />
        </Show>
      </RoomBarEnd>
      <Show when={demo.mode() === 'playing'}>
        <button
          type="button"
          class={styles.skip}
          onClick={() => demo.skip()}
          data-testid="echo-demo-skip"
        >
          {DEMO_COPY.skip}
        </button>
      </Show>
      <Show when={room.canReplay()}>
        <button
          type="button"
          class={styles.replay}
          onClick={() => room.replay()}
          aria-label="Hear it again"
          data-testid="echo-replay"
        >
          <Volume2 />
        </button>
      </Show>

      <Show when={showLine()}>
        <div class={styles.bubble} style={{ bottom: `${bubbleBottom()}px` }}>
          <RoomBubble testId="echo-bubble">{room.line()}</RoomBubble>
        </div>
      </Show>

      <div
        class={styles.bottom}
        classList={{
          [styles.bottomAway]: demo.mode() === 'card' || demo.mode() === 'end',
        }}
        inert={demoBusy()}
      >
        <Switch>
          <Match when={phase() === 'result' && !room.script.active()}>
            <ResultActions
              onAgain={() => room.start()}
              onDone={() => props.onDone()}
              againTestId="echo-again"
              doneTestId="echo-done"
            />
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={room.state().block}
              onRetry={() => room.start()}
              retryTestId="echo-retry"
            />
          </Match>
          <Match when={true}>
            {/* The demo's take pill stands over the mic while it sings. */}
            <Show when={room.script.active()}>
              <DemoTakePill
                take={demo.take()}
                copy={DEMO_COPY}
                testId="echo-demo-take"
              />
            </Show>
            <MicButton
              state={micState()}
              level={room.micLevel}
              pulse={demo.micPulse()}
              disabled={phase() === 'starting'}
              label={micLabel()}
              onClick={() => {
                if (phase() === 'intro') room.start()
                else room.stop()
              }}
              testId="echo-mic"
            />
          </Match>
        </Switch>
      </div>
      <div class={styles.said} aria-live="polite" data-testid="echo-said">
        {said()}
      </div>
      <DemoLayer
        demo={demo}
        aim={(tip, layer) => aimEchoTip(tip.target, layer)}
        copy={DEMO_COPY}
        testId="echo-demo"
      />
    </div>
  )
}
