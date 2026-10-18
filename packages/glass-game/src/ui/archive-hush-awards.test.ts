// Archive Hush award tests — successful humming and physical door access are separate boundaries.
import { describe, expect, it } from 'vitest'
import { createArchiveHushAwards } from './archive-hush-awards'

function setup() {
  let active = true
  let grounded = false
  let room = 'first'
  const accepted: string[] = []
  const attempts: string[] = []
  const saved: string[] = []
  let onCommit: ((id: string) => void) | undefined
  const awards = createArchiveHushAwards({
    canCommit: () => active,
    accept: (id) => {
      attempts.push(id)
      if (!grounded || id !== room) return false
      accepted.push(id)
      return true
    },
    onCommit: (id) => {
      saved.push(id)
      onCommit?.(id)
    },
  })
  return {
    awards,
    attempts,
    accepted,
    saved,
    setGrounded: (value: boolean) => {
      grounded = value
    },
    setActive: (value: boolean) => {
      active = value
    },
    setRoom: (id: string) => {
      room = id
    },
    setOnCommit: (callback: (id: string) => void) => {
      onCommit = callback
    },
  }
}

describe('Archive Hush earned room awards', () => {
  it('keeps airborne protection earned and commits exactly once after landing', () => {
    const fixture = setup()
    fixture.awards.award('first')
    fixture.awards.update()
    expect(fixture.awards.pending()).toEqual(['first'])
    expect(fixture.saved).toEqual([])
    fixture.setGrounded(true)
    fixture.awards.update()
    fixture.awards.update()
    fixture.awards.award('first')
    expect(fixture.accepted).toEqual(['first'])
    expect(fixture.saved).toEqual(['first'])
    expect(fixture.awards.pending()).toEqual([])
  })

  it('keeps each award attached to its original physical room', () => {
    const fixture = setup()
    fixture.awards.award('first')
    fixture.awards.award('second')
    fixture.setGrounded(true)
    fixture.setRoom('second')
    fixture.awards.update()
    expect(fixture.saved).toEqual(['second'])
    expect(fixture.awards.pending()).toEqual(['first'])
    fixture.setRoom('third')
    fixture.awards.update()
    expect(fixture.saved).toEqual(['second'])
    fixture.setRoom('first')
    fixture.awards.update()
    expect(fixture.saved).toEqual(['second', 'first'])
    expect(fixture.awards.pending()).toEqual([])
  })

  it('never attempts a door commit while paused and resumes only during an explicit update', () => {
    const fixture = setup()
    fixture.setActive(false)
    fixture.setGrounded(true)
    fixture.awards.award('first')
    fixture.awards.update()
    expect(fixture.attempts).toEqual([])
    expect(fixture.awards.pending()).toEqual(['first'])
    fixture.setActive(true)
    expect(fixture.saved).toEqual([])
    fixture.awards.update()
    expect(fixture.saved).toEqual(['first'])
  })

  it('does not lose pending work or duplicate commits during a synchronous refresh', () => {
    const fixture = setup()
    fixture.setGrounded(true)
    fixture.setOnCommit(() => {
      fixture.awards.award('first')
      fixture.awards.award('second')
      fixture.awards.update()
    })
    fixture.awards.award('first')
    expect(fixture.saved).toEqual(['first'])
    expect(fixture.awards.pending()).toEqual(['second'])
    fixture.setRoom('second')
    fixture.awards.update()
    expect(fixture.saved).toEqual(['first', 'second'])
    expect(fixture.awards.pending()).toEqual([])
  })

  it('stops processing queued awards if the host pauses after one commit', () => {
    const fixture = setup()
    fixture.awards.award('first')
    fixture.awards.award('second')
    fixture.setGrounded(true)
    fixture.setOnCommit(() => {
      fixture.setActive(false)
      fixture.setRoom('second')
    })
    const attempts = fixture.attempts.length
    fixture.awards.update()
    expect(fixture.attempts.slice(attempts)).toEqual(['first'])
    expect(fixture.saved).toEqual(['first'])
    expect(fixture.awards.pending()).toEqual(['second'])
  })

  it('exposes a defensive pending snapshot without inventing new earned rooms', () => {
    const fixture = setup()
    fixture.awards.award('first')
    fixture.awards.pending().push('second')
    fixture.setGrounded(true)
    fixture.setRoom('second')
    fixture.awards.update()
    expect(fixture.saved).toEqual([])
    expect(fixture.awards.pending()).toEqual(['first'])
  })
})
