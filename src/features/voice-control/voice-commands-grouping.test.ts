// ============================================================
// Command-center grouping — every command has a home
// ============================================================
//
// The overlay sorts commands into named sections by id prefix. A prefix
// the map does not know lands in "Other", which is where "Mercury Sing"
// sat until someone noticed. This locks the contract: every id prefix any
// surface registers must resolve to a real section title.

import { describe, expect, it } from 'vitest'
import { groupTitleFor } from './VoiceCommandsOverlay'

/**
 * One representative id per registered command family, drawn from the
 * actual command modules. New families must be added here AND to the
 * overlay's GROUP_TITLES — this test is what reminds you.
 */
const REPRESENTATIVE_IDS = [
  'transport.play',
  'seek.forwardSeconds',
  'speed.faster',
  'tempo.set',
  'countIn.set',
  'loop.toggle',
  'mode.repeat',
  'mic.toggle',
  'ui.closeThis',
  'nav.home',
  'nav.voiceHelp',
  'karaoke.play',
  'karaoke.mute.vocal',
  'karaoke.solo.drums',
  'karaoke.soloOff',
  'karaoke.fullMix',
  'karaoke.volumeSet.bass',
  'karaoke.end',
  'karaoke.role.guitar',
  'karaoke.loopRange',
  'karaoke.speedPreset.1.5',
  'karaoke.nextSong',
  'karaoke.randomSong',
  'karaoke.songsOpen',
  'karaoke.songsClose',
  'guitarNight.play',
  'guitarNight.mute.drums',
  'mercurySing.start',
  'mercurySing.cancel',
  'mercurySing.pick',
]

describe('groupTitleFor', () => {
  it.each(REPRESENTATIVE_IDS)('%s does not fall into Other', (id) => {
    expect(groupTitleFor(id)).not.toBe('Other')
  })

  it('splits karaoke into its named sections', () => {
    expect(groupTitleFor('karaoke.mute.vocal')).toBe('Karaoke — stems')
    // fullMix and soloOff act on stems even though their names do not say
    // mute/solo/volume — they must not drift into the transport fallback.
    expect(groupTitleFor('karaoke.fullMix')).toBe('Karaoke — stems')
    expect(groupTitleFor('karaoke.soloOff')).toBe('Karaoke — stems')
    expect(groupTitleFor('karaoke.role.guitar')).toBe(
      'Karaoke — who plays what',
    )
    expect(groupTitleFor('karaoke.loopRange')).toBe('Karaoke — loop and speed')
    expect(groupTitleFor('karaoke.songsOpen')).toBe('Karaoke — songs')
    expect(groupTitleFor('karaoke.play')).toBe('Karaoke — transport')
  })

  it('gives the newer surfaces their own sections', () => {
    expect(groupTitleFor('mercurySing.start')).toBe('Mercury Sing')
    expect(groupTitleFor('guitarNight.play')).toBe('Guitar Night')
  })
})
