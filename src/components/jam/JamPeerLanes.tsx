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
import { createMemo, For, onCleanup, onMount } from 'solid-js'
import { notesInWindow } from '@/lib/jam/jam-song'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import type { JamSongNote, TimeStampedPitchSample } from '@/lib/jam/types'
import { jamPeers, jamPitchHistory } from '@/stores/jam-store'
import styles from './JamPeerLanes.module.css'

interface JamPeerLanesProps {
  myPeerId: () => string | null
  /** The line to aim at, drawn behind every trail. Empty is legal. */
  notes?: () => JamSongNote[]
  /** Where the song is, so the target scrolls with it. */
  positionSec?: () => number
}

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

  return (
    <div class={styles.lanes}>
      <For each={lanes()}>
        {(lane) => (
          <Lane
            peerId={lane.id}
            name={lane.name}
            color={colors()[lane.id] ?? '#58a6ff'}
            notes={props.notes}
            positionSec={props.positionSec}
          />
        )}
      </For>
    </div>
  )
}

const Lane: Component<{
  peerId: string
  name: string
  color: string
  notes?: () => JamSongNote[]
  positionSec?: () => number
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
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        for (const n of notesInWindow(notes, windowFrom, windowTo)) {
          const x = secToX(n.startSec)
          const width = Math.max(2, secToX(n.endSec) - x)
          const y = midiToY(n.midi)
          ctx.beginPath()
          ctx.roundRect(x, y - 3, width, 6, 3)
          ctx.fill()
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
    <div class={styles.lane}>
      <span class={styles.laneName} style={{ color: props.color }}>
        {props.name}
      </span>
      <canvas ref={canvasRef} class={styles.laneCanvas} />
    </div>
  )
}
