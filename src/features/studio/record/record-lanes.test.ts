// Studio record lanes tests — every armed lane gets a record of its own for the timeline, whose level and take each lane's own messages wake; the list of records changes only when a lane is armed or goes, and the armed lanes say which hold a microphone.
import { createComputed, createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { StudioRecorderView, StudioRecordLane, } from '@/lib/studio/record/studio-recorder'
import { createStudioRecordLanes } from './record-lanes'

const lane = (
  trackId: string | null,
  level = 0,
  microphone = true,
): StudioRecordLane => ({
  trackId,
  arming: false,
  level,
  live: null,
  microphone,
})

const view = (
  lanes: readonly StudioRecordLane[],
  phase: StudioRecorderView['phase'] = 'armed',
): StudioRecorderView => ({
  phase,
  level: 0,
  countBeat: null,
  error: null,
  notice: null,
  targetTrackId: lanes[0]?.trackId ?? null,
  live: null,
  lanes,
})

describe('the Studio record lanes', () => {
  it('gives each armed lane a record of its own, woken by its own level alone', () => {
    createRoot((dispose) => {
      // Arrange
      const lanes = createStudioRecordLanes()
      const woke: string[] = []
      lanes.update(view([lane('vox'), lane('keys', 0, false)]))
      const [vox, keys] = lanes.records()
      createComputed(() => woke.push(`vox ${vox.level}`))
      createComputed(() => woke.push(`keys ${keys.level}`))
      const list = lanes.records()

      // Act
      lanes.update(view([lane('vox', 0.4), lane('keys', 0, false)]))

      // Assert
      expect(lanes.records()).toBe(list)
      expect(woke).toEqual(['vox 0', 'keys 0', 'vox 0.4'])
      expect(
        lanes.lanes().map((each) => [each.trackId, each.microphone]),
      ).toEqual([
        ['vox', true],
        ['keys', false],
      ])
      dispose()
    })
  })

  it('lists the records again when a lane goes, and stops listening while the take is kept', () => {
    createRoot((dispose) => {
      // Arrange
      const lanes = createStudioRecordLanes()
      lanes.update(view([lane('vox'), lane(null)]))
      const before = lanes.records()

      // Act
      lanes.update(view([lane(null)], 'finishing'))

      // Assert
      expect(before.map((record) => record.trackId)).toEqual(['vox', null])
      expect(lanes.records().map((record) => record.trackId)).toEqual([null])
      expect(lanes.records()[0]).toBe(before[1])
      expect(lanes.records()[0].listening).toBe(false)
      lanes.update(view([], 'idle'))
      expect(lanes.records()).toEqual([])
      dispose()
    })
  })
})
