// Runner session publication — real sessions preserve observer order through reentry, removal and disposal.

import { expect, it } from 'vitest'
import { runnerSessionHarness } from './__fixtures__/runner-session'

it('finishes each frame before delivering an update caused by a listener', () => {
  const { session } = runnerSessionHarness()
  const heard: string[] = []
  session.subscribe(({ state }) => {
    heard.push(`first:${state.musicMuted}`)
    if (state.musicMuted) session.setMusicMuted(false)
  })
  session.subscribe(({ state }) => heard.push(`second:${state.musicMuted}`))
  heard.length = 0
  try {
    session.setMusicMuted(true)
    expect(heard).toEqual([
      'first:true',
      'second:true',
      'first:false',
      'second:false',
    ])
    expect(session.state().musicMuted).toBe(false)
  } finally {
    session.dispose()
  }
})

it('respects removal during delivery and isolates a failing presentation listener', () => {
  const { session } = runnerSessionHarness()
  const heard: string[] = []
  let unsubscribe = () => {}
  session.subscribe(({ state }) => {
    if (!state.musicMuted) return
    unsubscribe()
    throw new Error('Presentation failed')
  })
  unsubscribe = session.subscribe(({ state }) => {
    heard.push(`removed:${state.musicMuted}`)
  })
  session.subscribe(({ state }) => heard.push(`remaining:${state.musicMuted}`))
  heard.length = 0
  try {
    session.setMusicMuted(true)
    session.setMusicMuted(false)
    expect(heard).toEqual(['remaining:true', 'remaining:false'])
    expect(session.state().musicMuted).toBe(false)
  } finally {
    session.dispose()
  }
})

it('delivers the initial state synchronously and retires subscribers on disposal', () => {
  const { session } = runnerSessionHarness()
  const phases: string[] = []
  session.subscribe(({ state }) => phases.push(state.phase))
  expect(phases).toEqual(['idle'])
  session.dispose()
  session.setMusicMuted(true)
  session.subscribe(({ state }) => phases.push(`late:${state.phase}`))
  expect(phases).toEqual(['idle', 'disposed'])
})
