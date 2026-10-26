import { describe, expect, it } from 'vitest'
import type { EffectDraft, TrackRole } from './role-chains'
import { normalizeTrackRole, ROLE_BALANCE_DB, ROLE_LABELS, roleTemplate, tempoMs, TRACK_ROLES, } from './role-chains'

function find(role: TrackRole, id: string): EffectDraft {
  const effect = roleTemplate(role, { bpm: 120 }).find((e) => e.id === id)
  if (effect === undefined) throw new Error(`${role} has no ${id}`)
  return effect
}

function kinds(role: TrackRole): string[] {
  return roleTemplate(role, { bpm: 120 }).map((effect) => effect.kind)
}

describe('role templates', () => {
  it('give every role its own chain: no two roles share one', () => {
    const shapes = TRACK_ROLES.map((role) =>
      JSON.stringify(roleTemplate(role, { bpm: 120 })),
    )
    expect(new Set(shapes).size).toBe(TRACK_ROLES.length)
  })

  it('give every role a label and a balance, and keep the lead vocal on top', () => {
    for (const role of TRACK_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy()
      if (role !== 'voice') expect(ROLE_BALANCE_DB[role]).toBeLessThan(0)
    }
    expect(ROLE_BALANCE_DB.voice).toBe(0)
  })

  it('treat drums as a bus: transient shaping, bus glue and parallel smash, mono kick', () => {
    expect(kinds('drums')).toEqual(
      expect.arrayContaining(['transient', 'compressor', 'stereo', 'limiter']),
    )
    expect(find('drums', 'punch').params).toMatchObject({
      attack: 25,
      sustain: -10,
    })
    expect(find('drums', 'smash').params).toMatchObject({ ratio: 8, mix: 30 })
    expect(find('drums', 'spread').params).toMatchObject({ monoBelowHz: 120 })
  })

  it('keep the bass mono and dry, with drive so it reads on small speakers', () => {
    expect(find('bass', 'spread').params).toMatchObject({ widthPct: 0 })
    expect(kinds('bass')).not.toContain('reverb')
    expect(find('bass', 'dynamics').params).toMatchObject({ ratio: 4 })
    expect(kinds('bass')).toContain('saturation')
  })

  it('set the backing vocals behind the lead: cut higher, de-essed harder, wider, wetter', () => {
    const leadCut = find('voice', 'cleanup-eq').params.lowCutHz
    const backCut = find('backing-vocals', 'cleanup-eq').params.lowCutHz
    expect(backCut).toBeGreaterThan(leadCut)
    expect(find('backing-vocals', 'harsh').params.rangeDb).toBeGreaterThan(
      find('voice', 'harsh').params.rangeDb,
    )
    expect(find('backing-vocals', 'space').params.mix).toBeGreaterThan(
      find('voice', 'space').params.mix,
    )
    expect(find('backing-vocals', 'spread').params.widthPct).toBeGreaterThan(
      100,
    )
  })

  it('tell the two guitars apart: the electric loses its fizz, the acoustic its boom', () => {
    expect(find('electric-guitar', 'cleanup-eq').params.highCutHz).toBe(11000)
    expect(find('electric-guitar', 'fizz').params.frequencyHz).toBe(4000)
    expect(find('acoustic-guitar', 'boom').params.frequencyHz).toBe(180)
    expect(find('acoustic-guitar', 'cleanup-eq').params.highShelfDb).toBe(2)
  })

  it('spread mono sources with the mono-safe Haas widener', () => {
    for (const role of [
      'acoustic-guitar',
      'electric-guitar',
      'backing-vocals',
      'keys',
    ] as const) {
      expect(find(role, 'spread').params.haasAmount).toBeGreaterThan(0)
    }
  })

  it('time the vocal and keys echoes to the song: a quarter and a dotted eighth', () => {
    expect(find('voice', 'echo').params.timeMs).toBe(500)
    expect(find('keys', 'echo').params.timeMs).toBe(375)
    expect(find('voice', 'echo').params.duck).toBe(70)
  })

  it('fall back to a short slap echo when the tempo is unknown', () => {
    const echo = roleTemplate('voice').find((effect) => effect.id === 'echo')!
    expect(echo.params).toMatchObject({ timeMs: 120, feedback: 10 })
  })

  it('give every effect an id unique within its chain', () => {
    for (const role of TRACK_ROLES) {
      const ids = roleTemplate(role).map((effect) => effect.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('normalizeTrackRole', () => {
  it('keeps current roles and maps the plan’s original names onto them', () => {
    expect(normalizeTrackRole('drums')).toBe('drums')
    expect(normalizeTrackRole('guitar')).toBe('acoustic-guitar')
    expect(normalizeTrackRole('vocals')).toBe('voice')
  })

  it('treats anything unknown as other', () => {
    expect(normalizeTrackRole('kazoo')).toBe('other')
    expect(normalizeTrackRole(42)).toBe('other')
    expect(normalizeTrackRole('toString')).toBe('other')
  })
})

describe('tempoMs', () => {
  it('turns note values into milliseconds', () => {
    expect(tempoMs(120, 1)).toBe(500)
    expect(tempoMs(140, 0.25)).toBeCloseTo(107.14, 2)
  })
})
