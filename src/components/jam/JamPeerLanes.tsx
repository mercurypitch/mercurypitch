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

import type { Component } from 'solid-js'
import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { groupLinesBySinger, isComingUp, LEAD_IN_SEC, noteSingers, } from '@/lib/jam/jam-song-blocks'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import type { JamSongNote, TimeStampedPitchSample } from '@/lib/jam/types'
import { jamPeers, jamPitchHistory, jamSong, jamSongParts, } from '@/stores/jam-store'
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

/** Seconds of history a lane shows. Long enough to see a phrase. */
const WINDOW_SEC = 8
/**
 * Where "now" sits across the lane.
 *
 * Not at the right edge: with a target line to sing, you need to see what
 * is COMING more than what has gone, so the playhead sits three quarters
 * along and the next second or two is visible ahead of it.
 */
const NOW_AT = 0.75
/** The vocal range a lane spans, in MIDI. Roughly E2 to C6. */
const MIDI_MIN = 40
const MIDI_MAX = 84

export const JamPeerLanes: Component<JamPeerLanesProps> = (props) => {
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

  return (
    <div class={styles.lanes}>
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

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      // Transparent base: the lane's CSS background carries the room glass,
      // exactly as the drill canvases do.
      ctx.clearRect(0, 0, w, h)

      const samples: TimeStampedPitchSample[] =
        jamPitchHistory()[props.peerId] ?? []
      const now = Date.now()
      const pxPerMs = w / (WINDOW_SEC * 1000)
      const midiToY = (midi: number) =>
        h - ((midi - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)) * h

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
      const notes = props.notes?.() ?? []
      const pos = props.positionSec?.() ?? 0
      if (notes.length > 0) {
        const windowFrom = pos - WINDOW_SEC * (1 - NOW_AT)
        const windowTo = pos + WINDOW_SEC * NOW_AT
        const secToX = (t: number) => ((t - windowFrom) / WINDOW_SEC) * w
        const owners = props.noteOwners?.() ?? []
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i]
          if (n === undefined) continue
          if (n.endSec <= windowFrom || n.startSec >= windowTo) continue
          const owner = owners[i] ?? null
          const isMine = owner !== null && owner === props.peerId
          const weight = isMine
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
          // Your own notes take the lane's colour so the target and your
          // trail are visibly the same person's; everyone else's stay
          // neutral, or they would read as a second voice in your lane.
          ctx.fillStyle = isMine
            ? hexToRgba(props.color, weight)
            : `rgba(255,255,255,${weight})`
          ctx.beginPath()
          ctx.roundRect(x, y - 3, width, 6, 3)
          ctx.fill()
          // An outline on the ones about to arrive. Brightness alone is
          // hard to judge against a photo backdrop; an edge is not.
          if (isMine && n.startSec > pos && n.startSec - pos <= LEAD_IN_SEC) {
            ctx.strokeStyle = hexToRgba(props.color, 0.95)
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.roundRect(x, y - 4.5, width, 9, 4)
            ctx.stroke()
          }
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
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let drawing = false
      for (const s of samples) {
        if (s.frequency <= 0 || s.midi <= 0) continue
        const age = now - s.timestamp
        if (age > WINDOW_SEC * 1000) continue
        const x = w * NOW_AT - age * pxPerMs
        const y = midiToY(s.midi)
        // Break the stroke across a gap rather than drawing a straight line
        // through a breath -- a joined-up line implies a slide that was
        // never sung.
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
      style={{ '--lane-color': props.color }}
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
