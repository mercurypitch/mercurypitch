// Where "find my key" gets the singer's range: a measured take, else a picked voice type.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'

const voiceprints = vi.hoisted(() => ({
  list: vi.fn<() => Promise<VoiceprintRecord[]>>(),
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: voiceprints.list,
}))

const { resolveSingerRange, voiceTypeRange } = await import('./singer-range')
const { setVocalRangePreset } = await import('@/stores/settings-store')

function take(
  takenAt: string,
  lowMidi: number | null,
  highMidi: number | null,
): VoiceprintRecord {
  return {
    id: takenAt,
    takenAt,
    twin: null,
    source: 'mirror',
    summary: {
      lowMidi,
      highMidi,
      semitones:
        lowMidi !== null && highMidi !== null ? highMidi - lowMidi : null,
      accuracy: null,
      steadiness: null,
    },
  } as VoiceprintRecord
}

describe('resolveSingerRange', () => {
  beforeEach(() => {
    localStorage.clear()
    voiceprints.list.mockReset()
    voiceprints.list.mockResolvedValue([])
  })

  it('uses the newest take that measured a range', async () => {
    voiceprints.list.mockResolvedValue([
      take('2026-09-20', null, null),
      take('2026-09-10', 45, 67),
      take('2026-08-01', 40, 60),
    ])

    expect(await resolveSingerRange()).toEqual({
      range: { lowMidi: 45, highMidi: 67 },
      source: 'voiceprint',
    })
  })

  it('skips a take whose range is too narrow to be a range', async () => {
    voiceprints.list.mockResolvedValue([take('2026-09-20', 60, 63)])

    expect(await resolveSingerRange()).toBeNull()
  })

  it('falls back to the voice type the singer picked', async () => {
    setVocalRangePreset('baritone')

    const resolved = await resolveSingerRange()

    expect(resolved?.source).toBe('voice-type')
    expect(resolved?.range.highMidi).toBeGreaterThan(
      resolved?.range.lowMidi ?? 0,
    )
    expect(voiceTypeRange()).toEqual(resolved)
  })

  it('does not count the default voice type as a choice', async () => {
    expect(await resolveSingerRange()).toBeNull()
    expect(voiceTypeRange()).toBeNull()
  })

  it('still offers the voice type when the takes cannot be read', async () => {
    voiceprints.list.mockRejectedValue(new Error('offline'))
    setVocalRangePreset('bass')

    expect((await resolveSingerRange())?.source).toBe('voice-type')
  })
})
