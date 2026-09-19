// ── JamPeerLanes ──────────────────────────────────────────────────────
// The right half of a song room: one scrolling pitch lane per singer.
//
// This is the thing that makes a song room feel like a band rather than a
// karaoke machine -- you can see whether the person next to you is on the
// note, not just hear it. One lane each, in that peer's own colour, so a
// lane is instantly readable as a person.
//
// Separate from JamSharedPitchCanvas, which stacks every peer on ONE set
// of axes. That is right for a drill, where everyone sings the same line
// and the overlap is the information. In a song the lines can differ, and
// six trails on one axis is a smear.
//
// Three things decide how big the picture is, and all three used to be
// constants: the time window (a fixed eight seconds stretched across any
// width, so a wider lane drew fatter pills rather than more song), the
// pitch band (the WHOLE song's range, so a two-octave number gave a
// semitone three pixels) and the backing store (one device pixel per CSS
// pixel, so a phone drew it soft on top of small). Zoom, a visible-window
// band and a devicePixelRatio-sized canvas are the three answers.

import type { Component } from 'solid-js'
import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { JamLaneZoomControl } from '@/components/jam/JamLaneZoomControl'
import { computeBackingSize } from '@/lib/canvas-size-sync'
import { colorTokenVars } from '@/lib/css-color-token'
import { laneSecToX, laneWindow, laneWindowSec, liveSampleX, NOW_AT, } from '@/lib/jam/jam-lane-geometry'
import { JAM_NOTE_LABEL_MIN_PILL, jamLaneMinSpan, jamPillHeight, jamTrailWidth, laneBandMidis, steppedJamZoom, zoomFromPinch, zoomFromWheel, } from '@/lib/jam/jam-lane-zoom'
import { jamPitchBanner } from '@/lib/jam/jam-pitch-provision'
import type { NoteAccuracy } from '@/lib/jam/jam-pitch-view'
import { blankNoteAccuracy, easeToward, JAM_BAND_FALLBACK, jamPitchBand, judgeAgainstNote, midiLabel, noteVerdict, observeNoteFrame, sampleMidi, tintForVerdict, } from '@/lib/jam/jam-pitch-view'
import { groupLinesBySinger, isComingUp, LEAD_IN_SEC, noteSingers, } from '@/lib/jam/jam-song-blocks'
import { jamLaneZoom, setJamLaneZoom } from '@/lib/jam/jam-view-prefs'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import type { JamSongNote, TimeStampedPitchSample } from '@/lib/jam/types'
import { jamPitchProvision, retryJamSongPitch, } from '@/stores/jam-pitch-provision-store'
import { jamIsHost, jamPeers, jamPitchHistory, jamSong, jamSongParts, MIN_SUNG_CLARITY, } from '@/stores/jam-store'
import styles from './JamPeerLanes.module.css'

interface JamPeerLanesProps {
  myPeerId: () => string | null
  /** The line to aim at, drawn behind every trail. Empty is legal. */
  notes?: () => JamSongNote[]
  /** Where the song is, so the target scrolls with it. */
  positionSec?: () => number
}

/**
 * How bright a target note is drawn, by who has to sing it.
 *
 * Nothing is ever hidden. Somebody who cannot see the other parts cannot
 * follow the song -- they would have no idea whether the silence they are
 * hearing is theirs to fill. So the other singers' notes stay visible and
 * merely recede, and only the weighting says whose turn it is.
 */
const NOTE_ALPHA = {
  /** Yours, and you are singing them now. */
  mine: 0.85,
  /** Yours, arriving within the lead-in -- the "you're up" signal. */
  soon: 0.6,
  /** Yours, but a long way off. */
  later: 0.34,
  /** Everybody's, because nobody was given this stretch. */
  shared: 0.22,
  /** Somebody else's. Present, and quiet. */
  theirs: 0.1,
} as const

/**
 * A hole this wide means the singer stopped, not that they slid.
 *
 * Samples arrive about twenty times a second, so a quarter second is
 * several missing frames -- comfortably past jitter, well short of a
 * phrase.
 */
const GAP_BREAK_MS = 250

/**
 * The faintest a note may be drawn once it has been judged.
 *
 * Notes nobody was given are drawn very quiet, which is right while
 * they are ahead of you and wrong the moment you are singing one --
 * the verdict is the whole point and it cannot be read at 0.22.
 */
const JUDGED_ALPHA_FLOOR = 0.5

export const JamPeerLanes: Component<JamPeerLanesProps> = (props) => {
  let listRef: HTMLDivElement | undefined

  const colors = createMemo(() => {
    const ids = jamPeers().map((p) => p.id)
    const mine = props.myPeerId()
    if (mine !== null && mine !== '') ids.push(mine)
    return buildPeerColorMap(ids)
  })

  /** Me first -- you look at your own lane most. */
  const lanes = createMemo(() => {
    const mine = props.myPeerId()
    const others = jamPeers().map((p) => ({
      id: p.id,
      name: p.displayName,
    }))
    return mine === null || mine === ''
      ? others
      : [{ id: mine, name: 'You' }, ...others]
  })

  const blocks = createMemo(() =>
    groupLinesBySinger(jamSong()?.lines ?? [], jamSongParts()),
  )

  /**
   * Who owns each note, derived once per song rather than per frame.
   *
   * Same source as the lyric column's blocks, so the words and the pitch
   * can never disagree about whose part this is.
   */
  const owners = createMemo(() => noteSingers(props.notes?.() ?? [], blocks()))

  /**
   * Wheel and pinch, bound by hand rather than through JSX.
   *
   * A wheel handler has to be able to preventDefault, and that means
   * registering it non-passively -- which the JSX prop cannot promise.
   * The pinch is here for a different reason: the lane list is what a
   * finger lands on, and the canvases inside it are recreated whenever
   * the roster changes.
   */
  onMount(() => {
    const list = listRef
    if (list === undefined) return

    const onWheel = (event: WheelEvent): void => {
      // ctrl/cmd is what a trackpad pinch reports, and it always means
      // zoom. A plain wheel belongs to the scrollbar whenever there IS
      // one -- a twelve-person room must still scroll.
      const forced = event.ctrlKey || event.metaKey
      if (!forced && list.scrollHeight > list.clientHeight + 1) return
      event.preventDefault()
      setJamLaneZoom(zoomFromWheel(jamLaneZoom(), event.deltaY))
    }

    /** Live touch points, so a second finger turns a pan into a pinch. */
    const touches = new Map<number, { x: number; y: number }>()
    let pinchStartDistance = 0
    let pinchStartZoom = 1

    const spread = (): number => {
      const [a, b] = [...touches.values()]
      if (a === undefined || b === undefined) return 0
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const armPinch = (): void => {
      pinchStartDistance = spread()
      pinchStartZoom = jamLaneZoom()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size === 2) armPinch()
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') return
      const point = touches.get(event.pointerId)
      if (point === undefined) return
      point.x = event.clientX
      point.y = event.clientY
      if (touches.size !== 2 || pinchStartDistance <= 0) return
      event.preventDefault()
      setJamLaneZoom(
        zoomFromPinch(pinchStartZoom, pinchStartDistance, spread()),
      )
    }

    const onPointerGone = (event: PointerEvent): void => {
      touches.delete(event.pointerId)
      // A finger lifted mid-pinch must not leave the next one scaling
      // against a distance measured with two.
      pinchStartDistance = 0
      if (touches.size === 2) armPinch()
    }

    list.addEventListener('wheel', onWheel, { passive: false })
    list.addEventListener('pointerdown', onPointerDown)
    list.addEventListener('pointermove', onPointerMove, { passive: false })
    list.addEventListener('pointerup', onPointerGone)
    list.addEventListener('pointercancel', onPointerGone)
    onCleanup(() => {
      list.removeEventListener('wheel', onWheel)
      list.removeEventListener('pointerdown', onPointerDown)
      list.removeEventListener('pointermove', onPointerMove)
      list.removeEventListener('pointerup', onPointerGone)
      list.removeEventListener('pointercancel', onPointerGone)
    })
  })

  /**
   * What, if anything, the lanes have to say for themselves.
   *
   * A blank lane is the one state a singer cannot read: a song with no
   * pitch guide and a song whose guide failed to load looked identical,
   * and both looked like a bug.
   */
  const banner = createMemo(() =>
    jamPitchBanner(jamPitchProvision(), jamSong(), jamIsHost()),
  )
  const working = createMemo(() => {
    const shown = banner()
    return shown.kind === 'working' ? shown : null
  })
  const unavailable = createMemo(() => {
    const shown = banner()
    return shown.kind === 'unavailable' ? shown : null
  })

  return (
    <div class={styles.root}>
      {/* Above the lanes, not over them: a song with no pitch guide is
          still a song you can sing, so the lanes, the words and your own
          trail all stay where they are and this explains the empty
          target. Above rather than below because the room's chat bubble
          is fixed in the viewport's bottom-right corner, and a strip
          down there puts its one button underneath it. */}
      <Show when={working()}>
        {(shown) => (
          <div
            class={styles.notice}
            data-state="working"
            data-testid="jam-pitch-notice"
          >
            <span class={styles.noticeText} aria-live="polite">
              Working out the pitch guide
            </span>
            <div
              class={styles.progress}
              role="progressbar"
              aria-label="Working out the pitch guide"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown().progress}
            >
              <div
                class={styles.progressFill}
                style={{ width: `${shown().progress}%` }}
              />
            </div>
            <span class={styles.percent}>{shown().progress}%</span>
          </div>
        )}
      </Show>
      <Show when={unavailable()}>
        {(shown) => (
          <div
            class={styles.notice}
            data-state="unavailable"
            role="status"
            aria-live="polite"
            data-testid="jam-pitch-notice"
          >
            <span class={styles.noticeText}>{shown().message}</span>
            <Show when={shown().retry}>
              <button
                type="button"
                class={styles.retry}
                onClick={() => retryJamSongPitch()}
              >
                Try again
              </button>
            </Show>
          </div>
        )}
      </Show>
      <div class={styles.laneArea}>
        <div class={styles.lanes} ref={listRef}>
          <For each={lanes()}>
            {(lane) => (
              <Lane
                peerId={lane.id}
                name={lane.name}
                color={colors()[lane.id] ?? '#58a6ff'}
                notes={props.notes}
                noteOwners={owners}
                positionSec={props.positionSec}
                cued={() =>
                  isComingUp(blocks(), lane.id, props.positionSec?.() ?? 0)
                }
              />
            )}
          </For>
        </div>
        {/* Outside the scroller on purpose: inside it, the control scrolls
            away the moment a fourth singer joins. */}
        <div class={styles.zoomDock}>
          <JamLaneZoomControl
            zoom={jamLaneZoom}
            onZoomIn={() => setJamLaneZoom(steppedJamZoom(jamLaneZoom(), 1))}
            onZoomOut={() => setJamLaneZoom(steppedJamZoom(jamLaneZoom(), -1))}
            onReset={() => setJamLaneZoom(1)}
          />
        </div>
      </div>
    </div>
  )
}

/** #rrggbb plus an alpha, since canvas has no colour-mix. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (m === null) return `rgba(255,255,255,${alpha})`
  return `rgba(${parseInt(m[1] ?? '0', 16)},${parseInt(m[2] ?? '0', 16)},${parseInt(m[3] ?? '0', 16)},${alpha})`
}

const Lane: Component<{
  peerId: string
  name: string
  color: string
  notes?: () => JamSongNote[]
  /** Who sings each note, aligned to `notes`. */
  noteOwners?: () => Array<string | null>
  positionSec?: () => number
  /** True while this lane's singer is the one due in. */
  cued?: () => boolean
}> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let frame: number | null = null

  onMount(() => {
    const ctx = canvasRef?.getContext('2d') ?? null
    if (ctx === null || canvasRef === undefined) return
    const canvas = canvasRef
    // Eased so the lane does not pump every time somebody's range
    // widens. NaN until the first frame decides where to start.
    let bandMin = Number.NaN
    let bandMax = Number.NaN
    // How each note has gone so far, keyed by where it sits in the
    // song. Keyed by position rather than by array index because the
    // notes prop may hand back a fresh array each frame.
    const accuracy = new Map<string, NoteAccuracy>()
    let lastPos = 0

    const draw = () => {
      // The backing store is device pixels; everything below is written
      // in CSS pixels and scaled once, here. Without this a phone at
      // dpr 3 drew every pill and every trail a third of the resolution
      // its screen can show, which reads as blur rather than as small.
      const dpr =
        typeof window === 'undefined' ? 1 : (window.devicePixelRatio ?? 1)
      const size = computeBackingSize(
        canvas.clientWidth,
        canvas.clientHeight,
        dpr,
      )
      if (size === null) {
        frame = requestAnimationFrame(draw)
        return
      }
      if (canvas.width !== size.deviceW || canvas.height !== size.deviceH) {
        canvas.width = size.deviceW
        canvas.height = size.deviceH
      }
      const w = size.cssW
      const h = size.cssH
      // Writing canvas.width resets the transform, so it is restated
      // every frame rather than once on resize.
      ctx.setTransform(size.deviceW / w, 0, 0, size.deviceH / h, 0, 0)
      // Transparent base: the lane's CSS background carries the room glass,
      // exactly as the drill canvases do.
      ctx.clearRect(0, 0, w, h)

      const samples: TimeStampedPitchSample[] =
        jamPitchHistory()[props.peerId] ?? []
      const now = Date.now()
      const notes = props.notes?.() ?? []
      const pos = props.positionSec?.() ?? 0
      const zoom = jamLaneZoom()
      const windowSec = laneWindowSec(w, zoom)
      const { from: windowFrom, to: windowTo } = laneWindow(pos, windowSec)

      // A jump backwards is a restart or a seek, and the verdicts
      // behind it are about a pass that is over.
      if (pos < lastPos - 0.25) accuracy.clear()
      lastPos = pos

      // What this lane needs to show: the notes in view plus whatever
      // this singer is actually producing, so the trail can never leave
      // the lane. Feeding the WHOLE song in gave a two-octave number
      // three pixels a semitone, and a perfect note and a whole-tone
      // miss drew the same picture.
      const sungMidis: number[] = []
      for (const s of samples) {
        if (s.frequency <= 0 || s.midi <= 0) continue
        if (s.clarity < MIN_SUNG_CLARITY) continue
        if (now - s.timestamp > windowSec * 1000) continue
        sungMidis.push(sampleMidi(s))
      }
      const visibleBand = jamPitchBand(
        laneBandMidis({ notes, windowFrom, windowTo, sungMidis }),
        jamLaneMinSpan(zoom),
      )
      // Nothing in view is an instrumental gap, not a reason to move.
      // Snapping to the fallback there made the lane lurch twice per
      // break -- away, and back again when the words returned.
      const targetBand =
        visibleBand ??
        (Number.isFinite(bandMin) && Number.isFinite(bandMax)
          ? { minMidi: bandMin, maxMidi: bandMax }
          : JAM_BAND_FALLBACK)
      bandMin = easeToward(bandMin, targetBand.minMidi)
      bandMax = easeToward(bandMax, targetBand.maxMidi)
      const span = bandMax - bandMin
      const pxPerSemitone = span > 0 ? h / span : h
      const midiToY = (midi: number) => h - ((midi - bandMin) / span) * h
      const secToX = (t: number) => laneSecToX(t, pos, w, windowSec)

      const latest: TimeStampedPitchSample | undefined =
        samples[samples.length - 1]

      // A faint centre line gives the eye something to judge against when
      // a singer is silent; without it an empty lane looks broken.
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // The target line, behind the trail. Drawn from the SONG clock, not
      // from sample ages: the notes are pinned to the recording, and
      // sliding them by wall time would drift away from the music.
      if (notes.length > 0) {
        const owners = props.noteOwners?.() ?? []
        const labels: { x: number; y: number; text: string }[] = []
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i]
          if (n === undefined) continue
          if (n.endSec <= windowFrom || n.startSec >= windowTo) continue
          const owner = owners[i] ?? null
          const isMine = owner !== null && owner === props.peerId
          // Notes nobody was given belong to everybody, so this singer
          // is on the hook for them too -- and in a song with no parts
          // assigned that is every note there is.
          const singsThis = owner === null || owner === props.peerId
          let weight: number = isMine
            ? n.startSec <= pos
              ? NOTE_ALPHA.mine
              : n.startSec - pos <= LEAD_IN_SEC
                ? NOTE_ALPHA.soon
                : NOTE_ALPHA.later
            : owner === null
              ? NOTE_ALPHA.shared
              : NOTE_ALPHA.theirs

          const x = secToX(n.startSec)
          const width = Math.max(2, secToX(n.endSec) - x)
          const y = midiToY(n.midi)

          // How this note is going, judged only while it is under the
          // playhead. Silence counts as a frame, and counts against
          // you: a note nobody sang is a note nobody hit, which is
          // precisely the case worth showing.
          let verdict = null
          if (singsThis) {
            const key = `${n.startSec.toFixed(3)}:${n.midi}`
            let acc = accuracy.get(key)
            if (n.startSec <= pos && pos < n.endSec) {
              if (acc === undefined) {
                acc = blankNoteAccuracy()
                accuracy.set(key, acc)
              }
              observeNoteFrame(acc, judgeAgainstNote(latest, n.midi, now))
            }
            verdict = acc === undefined ? null : noteVerdict(acc)
          }
          if (verdict !== null) weight = Math.max(weight, JUDGED_ALPHA_FLOOR)

          // Your own notes take the lane's colour so the target and your
          // trail are visibly the same person's; everyone else's stay
          // neutral, or they would read as a second voice in your lane.
          // A judged note is pulled towards green, amber or red from
          // there, rather than repainted, so it still reads as yours.
          const base = isMine ? props.color : '#ffffff'
          ctx.fillStyle = hexToRgba(tintForVerdict(base, verdict), weight)
          const pillH = jamPillHeight(verdict ?? 'neutral', zoom, pxPerSemitone)
          ctx.beginPath()
          ctx.roundRect(x, y - pillH / 2, width, pillH, pillH / 2)
          ctx.fill()
          // An outline on the ones about to arrive. Brightness alone is
          // hard to judge against a photo backdrop; an edge is not.
          if (isMine && n.startSec > pos && n.startSec - pos <= LEAD_IN_SEC) {
            ctx.strokeStyle = hexToRgba(props.color, 0.95)
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.roundRect(
              x,
              y - pillH / 2 - 1.5,
              width,
              pillH + 3,
              pillH / 2 + 1,
            )
            ctx.stroke()
          }
          // The note's NAME, once there is room for it. Only on your own
          // notes and only ahead of the playhead: a name over a pill
          // already gone is decoration, and a name in somebody else's
          // lane is noise in a lane you are not singing.
          if (
            isMine &&
            n.endSec > pos &&
            pillH >= JAM_NOTE_LABEL_MIN_PILL &&
            x + width + 6 < w
          ) {
            labels.push({
              x: x + width + 5,
              y,
              text: midiLabel(n.midi),
            })
          }
        }
        // Labels last, so no later pill paints over one.
        if (labels.length > 0) {
          ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = hexToRgba(props.color, 0.85)
          for (const label of labels) ctx.fillText(label.text, label.x, label.y)
        }
        // Where "now" is, so the target and the trail meet somewhere the
        // eye can find.
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(w * NOW_AT, 0)
        ctx.lineTo(w * NOW_AT, h)
        ctx.stroke()
      }

      ctx.strokeStyle = props.color
      ctx.lineWidth = jamTrailWidth(zoom)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let drawing = false
      let prevTs = 0
      for (const s of samples) {
        // A skipped sample BREAKS the line. This used to `continue`
        // without clearing the flag, so the next real sample drew a
        // straight line back across the silence -- the trail appeared to
        // hang in the air making shapes while nobody sang.
        if (s.frequency <= 0 || s.midi <= 0 || s.clarity < MIN_SUNG_CLARITY) {
          drawing = false
          continue
        }
        const age = now - s.timestamp
        if (age > windowSec * 1000) {
          drawing = false
          continue
        }
        // And a hole in the buffer breaks it too: samples arrive ~20/s, so
        // a gap several frames wide is a breath, not a slide.
        if (prevTs !== 0 && s.timestamp - prevTs > GAP_BREAK_MS) drawing = false
        prevTs = s.timestamp
        const x = liveSampleX(age, w, windowSec)
        const y = midiToY(sampleMidi(s))
        if (!drawing) {
          ctx.moveTo(x, y)
          drawing = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
  })

  onCleanup(() => {
    if (frame !== null) cancelAnimationFrame(frame)
  })

  return (
    <div
      class={styles.lane}
      classList={{ [styles.laneCued]: props.cued?.() === true }}
      style={colorTokenVars('--lane-color', props.color)}
    >
      <span class={styles.laneName} style={{ color: props.color }}>
        {props.name}
        {/* Said in words as well as in colour: the border alone is a
            convention you have to have learnt, and a singer meeting this
            for the first time is mid-song. */}
        <Show when={props.cued?.() === true}>
          <span class={styles.cue}>you're up</span>
        </Show>
      </span>
      <canvas ref={canvasRef} class={styles.laneCanvas} />
    </div>
  )
}
