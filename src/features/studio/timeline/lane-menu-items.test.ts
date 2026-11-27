import { describe, expect, it, vi } from 'vitest'
import type { StudioRecordSettings } from '@/lib/studio/record/record-settings'
import { DEFAULT_STUDIO_RECORD_SETTINGS } from '@/lib/studio/record/record-settings'
import { STUDIO_HEAR_YOURSELF_LABEL, studioHearYourself, studioLaneMenuItems, studioSpaceMenuItems, } from './lane-menu-items'

const TRACK = { id: 'lane-1', name: 'Vocal', mute: false, solo: true }

function laneMenu(
  overrides: Partial<Parameters<typeof studioLaneMenuItems>[0]> = {},
) {
  let monitoring = false
  const hearYourself = {
    on: () => monitoring,
    set: vi.fn((on: boolean) => {
      monitoring = on
    }),
  }
  const onCommand = vi.fn(() => true)
  const onDetails = vi.fn()
  const toggleLines = vi.fn()
  const items = studioLaneMenuItems({
    track: TRACK,
    writable: true,
    hearYourself,
    lines: { open: false, held: false, toggle: toggleLines },
    onCommand,
    onDetails,
    ...overrides,
  })
  const item = (key: string) => items.find((each) => each.key === key)!
  return { items, item, hearYourself, onCommand, onDetails, toggleLines }
}

describe('studioLaneMenuItems', () => {
  it('opens with Hear yourself, saying it is one switch for every lane and whether it is on', () => {
    const { items, hearYourself } = laneMenu()
    expect(items[0].key).toBe('hear-yourself')
    expect(items[0].label).toBe(STUDIO_HEAR_YOURSELF_LABEL)
    expect(STUDIO_HEAR_YOURSELF_LABEL).toMatch(/every lane/)
    expect(items[0].checked).toBe(false)

    items[0].select()
    expect(hearYourself.set).toHaveBeenCalledWith(true)
    expect(
      laneMenu({ hearYourself: { on: () => true, set: vi.fn() } }).items[0]
        .checked,
    ).toBe(true)
  })

  it("holds the lane's own actions, with the keys that do the same", () => {
    const { items, item, onCommand, onDetails, toggleLines } = laneMenu()
    expect(items.map((each) => each.key)).toEqual([
      'hear-yourself',
      'mute',
      'solo',
      'lines',
      'details',
      'remove',
    ])
    expect(item('mute')).toMatchObject({ shortcut: 'M', checked: false })
    expect(item('solo')).toMatchObject({ shortcut: 'S', checked: true })

    item('mute').select()
    item('solo').select()
    item('lines').select()
    item('details').select()
    item('remove').select()
    expect(onCommand.mock.calls).toEqual([
      [{ type: 'update-track', trackId: 'lane-1', changes: { mute: true } }],
      [{ type: 'update-track', trackId: 'lane-1', changes: { solo: false } }],
      [{ type: 'remove-track', trackId: 'lane-1' }],
    ])
    expect(toggleLines).toHaveBeenCalledOnce()
    expect(onDetails).toHaveBeenCalledOnce()
    expect(item('remove').danger).toBe(true)
  })

  it('offers the arm where the Studio records, and holds it while it can do nothing', () => {
    const toggle = vi.fn()
    const { item } = laneMenu({ arm: { armed: true, enabled: false, toggle } })
    expect(item('arm')).toMatchObject({ checked: true, disabled: true })
    expect(laneMenu().items.some((each) => each.key === 'arm')).toBe(false)
  })

  it('changes nothing in a song that takes no edits', () => {
    const { item, onCommand } = laneMenu({ writable: false })
    expect(item('mute').disabled).toBe(true)
    expect(item('remove').disabled).toBe(true)
    item('mute').select()
    item('remove').select()
    expect(onCommand).not.toHaveBeenCalled()
  })
})

describe('studioSpaceMenuItems', () => {
  const zoom = {
    canStep: (direction: 1 | -1) => direction === 1,
    step: vi.fn(),
    fit: vi.fn(),
    empty: false,
  }

  it('offers what empty lane space already does, and the zoom keys', () => {
    const onNewLane = vi.fn()
    const items = studioSpaceMenuItems({
      newClip: vi.fn(),
      onAddTakes: vi.fn(),
      onNewLane,
      zoom,
    })
    expect(items.map((each) => each.label)).toEqual([
      'New clip here',
      'Add takes',
      'New audio lane',
      'New piano lane',
      'New drums lane',
      'Zoom in',
      'Zoom out',
      'Fit the whole song',
    ])
    const by = (label: string) => items.find((each) => each.label === label)!
    expect(by('Zoom in')).toMatchObject({ shortcut: '=', disabled: false })
    expect(by('Zoom out')).toMatchObject({ shortcut: '-', disabled: true })
    expect(by('Fit the whole song').shortcut).toBe('Z')
    by('New drums lane').select()
    expect(onNewLane).toHaveBeenCalledWith('drums')
  })

  it('leaves out what this space cannot do', () => {
    const items = studioSpaceMenuItems({ zoom: { ...zoom, empty: true } })
    expect(items.map((each) => each.key)).toEqual([
      'zoom-in',
      'zoom-out',
      'zoom-fit',
    ])
    expect(items[2].disabled).toBe(true)
  })
})

describe('studioHearYourself', () => {
  it("switches the recorder's one monitoring setting and keeps the rest", () => {
    let kept: StudioRecordSettings = {
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
      countInBars: 2,
    }
    const hear = studioHearYourself({
      settings: () => kept,
      setSettings: (next) => {
        kept = next
      },
    })
    expect(hear.on()).toBe(false)
    hear.set(true)
    expect(kept).toEqual({
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
      countInBars: 2,
      monitor: true,
    })
    expect(hear.on()).toBe(true)
  })
})
