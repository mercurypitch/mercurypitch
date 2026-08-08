// ============================================================
// midi-truth — read a MIDI file into notes with real seconds
// ============================================================
//
// The app's own `parseMidiSong` keeps the FIRST set-tempo event and expresses
// notes in beats, which is right for its purpose and useless as ground truth
// for a recording: Dance of Death alone changes tempo ten times, so a single
// tempo puts the last note minutes away from where it is actually played.
//
// This reads the whole tempo map and converts ticks to seconds through it, so
// a note's time here is the time it happens in the audio. Bench-only — if the
// app ever needs a tempo map, it needs one in src/ with tests, not this.

import { readFile } from 'node:fs/promises'

class Reader {
  constructor(bytes) {
    this.bytes = bytes
    this.at = 0
  }
  u8() {
    return this.bytes[this.at++]
  }
  u16() {
    return (this.u8() << 8) | this.u8()
  }
  u32() {
    return ((this.u8() << 24) >>> 0) + (this.u8() << 16) + (this.u8() << 8) + this.u8()
  }
  varint() {
    let value = 0
    for (;;) {
      const byte = this.u8()
      value = (value << 7) | (byte & 0x7f)
      if ((byte & 0x80) === 0) return value
    }
  }
  bytesOf(length) {
    const slice = this.bytes.subarray(this.at, this.at + length)
    this.at += length
    return slice
  }
}

/** Every raw event of every track, in ticks, plus the file's tick division. */
function readEvents(bytes) {
  const reader = new Reader(bytes)
  if (reader.u32() !== 0x4d546864) throw new Error('Not a MIDI file')
  const headerLength = reader.u32()
  reader.u16() // format
  const trackCount = reader.u16()
  const division = reader.u16()
  reader.at = 8 + headerLength

  const tracks = []
  for (let index = 0; index < trackCount; index += 1) {
    if (reader.u32() !== 0x4d54726b) break
    const length = reader.u32()
    const end = reader.at + length
    const events = []
    let tick = 0
    let running = 0
    while (reader.at < end) {
      tick += reader.varint()
      let status = reader.u8()
      if (status < 0x80) {
        reader.at -= 1
        status = running
      } else if (status < 0xf0) {
        running = status
      }

      if (status === 0xff) {
        const metaType = reader.u8()
        const dataLength = reader.varint()
        events.push({ tick, meta: metaType, data: reader.bytesOf(dataLength) })
      } else if (status === 0xf0 || status === 0xf7) {
        reader.bytesOf(reader.varint())
      } else {
        const kind = status & 0xf0
        const first = reader.u8()
        const second =
          kind === 0xc0 || kind === 0xd0 ? 0 : reader.u8()
        events.push({ tick, status: kind, channel: status & 0x0f, first, second })
      }
    }
    reader.at = end
    tracks.push(events)
  }
  return { tracks, division }
}

/** Tick-to-second conversion built from every set-tempo event in the file. */
function buildTempoMap(tracks, division) {
  const changes = []
  for (const events of tracks) {
    for (const event of events) {
      if (event.meta === 0x51 && event.data.length === 3) {
        const usPerQuarter =
          (event.data[0] << 16) | (event.data[1] << 8) | event.data[2]
        changes.push({ tick: event.tick, usPerQuarter })
      }
    }
  }
  changes.sort((left, right) => left.tick - right.tick)
  if (changes.length === 0 || changes[0].tick > 0) {
    changes.unshift({ tick: 0, usPerQuarter: 500000 })
  }

  // Seconds elapsed at each change, accumulated at the tempo in force before it.
  const anchors = [{ tick: changes[0].tick, seconds: 0, usPerQuarter: changes[0].usPerQuarter }]
  for (let index = 1; index < changes.length; index += 1) {
    const previous = anchors[index - 1]
    const deltaTicks = changes[index].tick - previous.tick
    anchors.push({
      tick: changes[index].tick,
      seconds:
        previous.seconds + (deltaTicks * previous.usPerQuarter) / division / 1e6,
      usPerQuarter: changes[index].usPerQuarter,
    })
  }

  return {
    changes: changes.map((change) => ({
      tick: change.tick,
      bpm: Math.round(60000000 / change.usPerQuarter),
    })),
    toSeconds(tick) {
      let anchor = anchors[0]
      for (const candidate of anchors) {
        if (candidate.tick <= tick) anchor = candidate
        else break
      }
      return (
        anchor.seconds + ((tick - anchor.tick) * anchor.usPerQuarter) / division / 1e6
      )
    },
  }
}

function trackName(events) {
  for (const event of events) {
    if (event.meta === 0x03) return Buffer.from(event.data).toString('latin1')
  }
  return ''
}

/**
 * Notes per track, timed in seconds. Note-off is either 0x80 or a note-on with
 * zero velocity; both appear in real files and treating only one as an ending
 * leaves notes hanging to the end of the song.
 */
export async function readMidiTruth(path) {
  const bytes = new Uint8Array(await readFile(path))
  const { tracks, division } = readEvents(bytes)
  const tempoMap = buildTempoMap(tracks, division)

  const out = []
  for (const [index, events] of tracks.entries()) {
    const open = new Map()
    const notes = []
    for (const event of events) {
      if (event.status === 0x90 && event.second > 0) {
        const key = `${event.channel}:${event.first}`
        if (!open.has(key)) open.set(key, [])
        open.get(key).push(event.tick)
        continue
      }
      const isOff =
        event.status === 0x80 || (event.status === 0x90 && event.second === 0)
      if (!isOff) continue
      const key = `${event.channel}:${event.first}`
      const starts = open.get(key)
      if (starts === undefined || starts.length === 0) continue
      const startTick = starts.shift()
      const startSeconds = tempoMap.toSeconds(startTick)
      notes.push({
        midi: event.first,
        startSeconds,
        durationSeconds: tempoMap.toSeconds(event.tick) - startSeconds,
      })
    }
    if (notes.length === 0) continue
    notes.sort((left, right) => left.startSeconds - right.startSeconds)
    out.push({
      id: String(index),
      name: trackName(events) || `Track ${index}`,
      instrumentName: '',
      noteCount: notes.length,
      notes,
    })
  }

  return { tracks: out, tempoChanges: tempoMap.changes, division }
}
