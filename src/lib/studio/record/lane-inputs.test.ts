// Studio lane inputs — a lane's input, channel and pair come back as kept, per song, sanitized (a row from before pairs is one input), at most two hundred, and forgotten with a lane that is gone; an input's channel count is found by its id or its name; and an arm opens the lane's own input and pick where it is listed, else the Studio's and its default, saying so.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FOLLOW_STUDIO_INPUT, knownInputChannels, laneChannelPick, laneInputChannels, MAX_INPUT_CHANNEL_COUNTS, MAX_LANE_INPUTS, planStudioLaneInput, pruneStudioLaneInputs, readInputChannelCounts, readStudioLaneInputs, rememberInputChannels, sameStudioLaneInput, sanitizeStudioLaneInput, writeStudioLaneInput, } from './lane-inputs'

const LANES_KEY = 'mercurypitch.studio.lane-inputs'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const scarlett = {
  deviceId: 'scarlett',
  label: 'Scarlett 2i2 USB',
  channel: 1,
  pair: false,
}

describe('Studio lane inputs', () => {
  it('keeps a lane its own input, channel and pair, by song and lane, and reads them back', () => {
    writeStudioLaneInput('song-1', 'lane-1', scarlett)
    writeStudioLaneInput('song-2', 'lane-1', {
      ...scarlett,
      channel: 2,
      pair: true,
    })

    expect(readStudioLaneInputs('song-1')).toEqual(
      new Map([['lane-1', scarlett]]),
    )
    expect(readStudioLaneInputs('song-2').get('lane-1')).toEqual({
      ...scarlett,
      channel: 2,
      pair: true,
    })
    expect(readStudioLaneInputs('song-3').size).toBe(0)
  })

  it('keeps nothing for a lane that follows the Studio again', () => {
    writeStudioLaneInput('song-1', 'lane-1', scarlett)

    const lanes = writeStudioLaneInput('song-1', 'lane-1', FOLLOW_STUDIO_INPUT)

    expect(lanes.size).toBe(0)
    expect(JSON.parse(localStorage.getItem(LANES_KEY)!)).toEqual([])
  })

  it('keeps the two hundred chosen last, and a lane chosen again comes first', () => {
    for (let n = 0; n <= MAX_LANE_INPUTS; n++)
      writeStudioLaneInput('song-1', `lane-${n}`, scarlett)
    writeStudioLaneInput('song-1', 'lane-1', { ...scarlett, channel: 0 })

    const rows = JSON.parse(localStorage.getItem(LANES_KEY)!) as {
      trackId: string
    }[]
    expect(rows).toHaveLength(MAX_LANE_INPUTS)
    expect(rows[0].trackId).toBe('lane-1')
    // The first lane chosen, never chosen again, is the one let go.
    expect(rows.some((row) => row.trackId === 'lane-0')).toBe(false)
  })

  it("forgets a song's lanes that are gone when the song opens, and leaves other songs alone", () => {
    writeStudioLaneInput('song-1', 'kept', scarlett)
    writeStudioLaneInput('song-1', 'removed', scarlett)
    writeStudioLaneInput('song-2', 'removed', scarlett)

    const lanes = pruneStudioLaneInputs('song-1', ['kept', 'new-lane'])

    expect([...lanes.keys()]).toEqual(['kept'])
    expect(readStudioLaneInputs('song-1').has('removed')).toBe(false)
    expect(readStudioLaneInputs('song-2').has('removed')).toBe(true)
  })

  it('reads what does not fit as following the Studio, and drops rows it cannot place', () => {
    expect(
      sanitizeStudioLaneInput({ deviceId: 42, label: 'Lost', channel: 1.5 }),
    ).toEqual(FOLLOW_STUDIO_INPUT)
    expect(
      sanitizeStudioLaneInput({ deviceId: 'usb', label: '', channel: 32 }),
    ).toEqual({ deviceId: 'usb', label: null, channel: null, pair: false })
    // A name without an id is let go: the lane follows the Studio's input.
    expect(sanitizeStudioLaneInput({ label: 'Desk mic', channel: 0 })).toEqual({
      deviceId: null,
      label: null,
      channel: 0,
      pair: false,
    })
    localStorage.setItem(
      LANES_KEY,
      JSON.stringify([
        { projectId: 'song-1', trackId: 'lane-1', ...scarlett },
        { projectId: 'song-1', trackId: 'lane-1', deviceId: 'older' },
        { projectId: 'song-1', deviceId: 'no-lane' },
        'not a row',
      ]),
    )
    expect(readStudioLaneInputs('song-1')).toEqual(
      new Map([['lane-1', scarlett]]),
    )
  })

  it('reads a row kept before pairs as one input, and a pair only where it is an aligned one', () => {
    // As rows were kept before pairs: no pair at all.
    localStorage.setItem(
      LANES_KEY,
      JSON.stringify([
        {
          projectId: 'song-1',
          trackId: 'lane-1',
          deviceId: 'scarlett',
          label: 'Scarlett 2i2 USB',
          channel: 1,
        },
      ]),
    )
    expect(readStudioLaneInputs('song-1').get('lane-1')).toEqual(scarlett)

    const pair = (channel: unknown, value: unknown = true) =>
      sanitizeStudioLaneInput({ deviceId: 'usb', channel, pair: value })
    expect(pair(2)).toMatchObject({ channel: 2, pair: true })
    expect(pair(30)).toMatchObject({ channel: 30, pair: true })
    // Not aligned, past what a split addresses, or with no channel: the default.
    expect(pair(1)).toMatchObject({ channel: null, pair: false })
    expect(pair(31)).toMatchObject({ channel: null, pair: false })
    expect(pair(null)).toMatchObject({ channel: null, pair: false })
    // Anything but true is one input.
    expect(pair(2, 'yes')).toMatchObject({ channel: 2, pair: false })
  })

  it('keeps nothing from damaged storage, and the choice for the session when storage refuses', () => {
    localStorage.setItem(LANES_KEY, '{not json')
    expect(readStudioLaneInputs('song-1').size).toBe(0)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(
      writeStudioLaneInput('song-1', 'lane-1', scarlett).get('lane-1'),
    ).toEqual(scarlett)
  })
})

describe('laneChannelPick', () => {
  it("is the lane's input or pair, or null for the default", () => {
    expect(laneChannelPick(scarlett)).toEqual({ channel: 1, pair: false })
    expect(laneChannelPick({ ...scarlett, channel: 2, pair: true })).toEqual({
      channel: 2,
      pair: true,
    })
    expect(laneChannelPick(FOLLOW_STUDIO_INPUT)).toBeNull()
  })
})

describe('input channel counts', () => {
  it('finds a count by the id it opened with, then by its name', () => {
    rememberInputChannels(
      { deviceId: 'scarlett', label: 'Scarlett 2i2 USB' },
      2,
    )
    const counts = readInputChannelCounts()

    expect(
      knownInputChannels(counts, { deviceId: 'scarlett', label: null }),
    ).toBe(2)
    // A PipeWire profile switch changes the id; the name still finds it.
    expect(
      knownInputChannels(counts, {
        deviceId: 'changed',
        label: 'Scarlett 2i2 USB',
      }),
    ).toBe(2)
    expect(
      knownInputChannels(counts, { deviceId: 'other', label: 'Other' }),
    ).toBeNull()
  })

  it('keeps the latest count for an input, the fifty opened last, and no count that cannot be a channel count', () => {
    rememberInputChannels({ deviceId: 'scarlett', label: 'Scarlett' }, 2)
    rememberInputChannels({ deviceId: 'scarlett', label: 'Scarlett' }, 4)
    for (let n = 0; n < MAX_INPUT_CHANNEL_COUNTS; n++)
      rememberInputChannels({ deviceId: `device-${n}`, label: null }, 1)
    rememberInputChannels({ deviceId: 'too-wide', label: null }, 64)
    rememberInputChannels({ deviceId: null, label: null }, 2)

    const counts = readInputChannelCounts()
    expect(counts).toHaveLength(MAX_INPUT_CHANNEL_COUNTS)
    expect(
      knownInputChannels(counts, { deviceId: 'scarlett', label: null }),
    ).toBeNull()
    expect(
      knownInputChannels(counts, { deviceId: 'too-wide', label: null }),
    ).toBeNull()
    expect(counts[0]).toEqual({
      deviceId: 'device-49',
      label: null,
      channels: 1,
    })
  })

  it("knows a lane's channels through its own input, else the Studio's, else the system default", () => {
    rememberInputChannels(
      { deviceId: 'scarlett', label: 'Scarlett 2i2 USB' },
      2,
    )
    rememberInputChannels({ deviceId: 'desk', label: 'Desk mic' }, 1)
    const counts = readInputChannelCounts()
    const studio = { deviceId: 'desk', label: 'Desk mic' }

    expect(laneInputChannels(scarlett, studio, counts, [])).toBe(2)
    expect(laneInputChannels(FOLLOW_STUDIO_INPUT, studio, counts, [])).toBe(1)
    // Firefox opens the default as the device it is; the roster names it.
    expect(
      laneInputChannels(
        FOLLOW_STUDIO_INPUT,
        { deviceId: null, label: null },
        counts,
        [
          {
            deviceId: 'scarlett',
            groupId: 'g',
            kind: 'audioinput',
            label: 'Scarlett 2i2 USB',
          },
        ],
      ),
    ).toBe(2)
    // Chromium opens it as `default`.
    rememberInputChannels({ deviceId: 'default', label: 'Default' }, 4)
    expect(
      laneInputChannels(
        FOLLOW_STUDIO_INPUT,
        { deviceId: null, label: null },
        readInputChannelCounts(),
        [],
      ),
    ).toBe(4)
  })
})

describe('planStudioLaneInput', () => {
  const listed = [
    { deviceId: 'desk', label: 'Desk mic' },
    { deviceId: 'scarlett', label: 'Scarlett 2i2 USB' },
  ]

  it("opens the Studio's input, and the lane's pick of it, for a lane that follows it", () => {
    expect(
      planStudioLaneInput(
        { ...FOLLOW_STUDIO_INPUT, channel: 0, pair: true },
        'desk',
        listed,
      ),
    ).toEqual({
      deviceId: 'desk',
      own: false,
      laneInputMissing: false,
      pick: { channel: 0, pair: true },
    })
  })

  it("opens the lane's own input as listed, by its id or else its name", () => {
    expect(planStudioLaneInput(scarlett, null, listed)).toEqual({
      deviceId: 'scarlett',
      own: true,
      laneInputMissing: false,
      pick: { channel: 1, pair: false },
    })
    expect(
      planStudioLaneInput({ ...scarlett, deviceId: 'stale' }, null, listed)
        .deviceId,
    ).toBe('scarlett')
  })

  it("opens the Studio's input and its default when the lane's own is not listed, and says so", () => {
    expect(
      planStudioLaneInput(
        { deviceId: 'gone', label: 'Old interface', channel: 2, pair: true },
        'desk',
        listed,
      ),
    ).toEqual({
      deviceId: 'desk',
      own: false,
      laneInputMissing: true,
      pick: null,
    })
  })

  it('asks for the kept id before the browser names any input', () => {
    expect(
      planStudioLaneInput(scarlett, 'desk', [{ deviceId: '', label: '' }]),
    ).toEqual({
      deviceId: 'scarlett',
      own: true,
      laneInputMissing: false,
      pick: { channel: 1, pair: false },
    })
  })
})

describe('sameStudioLaneInput', () => {
  it('moves an arm between lanes only on the same input and channels', () => {
    expect(sameStudioLaneInput(FOLLOW_STUDIO_INPUT, FOLLOW_STUDIO_INPUT)).toBe(
      true,
    )
    expect(sameStudioLaneInput(scarlett, { ...scarlett, label: null })).toBe(
      true,
    )
    expect(sameStudioLaneInput(scarlett, { ...scarlett, channel: 0 })).toBe(
      false,
    )
    expect(
      sameStudioLaneInput(
        { ...scarlett, channel: 0 },
        { ...scarlett, channel: 0, pair: true },
      ),
    ).toBe(false)
    expect(sameStudioLaneInput(FOLLOW_STUDIO_INPUT, scarlett)).toBe(false)
  })
})
