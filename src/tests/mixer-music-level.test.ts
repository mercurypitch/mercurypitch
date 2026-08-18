// ============================================================
// The mixer's master is reachable, and ends in a ceiling
// ============================================================
//
// Reported: "the music gets quieter the moment I turn the mic on, and I can't
// turn it back up." The first half is not ours — the audit found no ducking
// anywhere in the app; iOS switches the page to `playAndRecord` and jam asks
// for echo cancellation, and both attenuate. The second half was ours: the
// master gain was a hardcoded 0.7 with no control anywhere in the UI.
//
// The maths of the clipper is pinned in
// `src/features/stem-mixer/master-headroom.test.ts`. This pins the wiring —
// that the level is actually reachable and that nothing bypasses the ceiling.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const controller = repoFile(
  'src/features/stem-mixer/useStemMixerAudioController.ts',
)
const mixer = repoFile('src/components/StemMixer.tsx')

describe('the master gain', () => {
  it('reads the stored level instead of a constant', () => {
    // Two sites: the initial build and the restore after a track change. A
    // fix that misses either leaves the level snapping back to 0.7 mid-song.
    expect(controller).toContain('mainGain.gain.value = musicLevel()')
    expect(controller).toContain(
      'mainGain.gain.linearRampToValueAtTime(musicLevel(), now + 0.01)',
    )
  })

  it('has no hardcoded 0.7 left on it', () => {
    const masterLines = controller
      .split('\n')
      .filter((line) => line.includes('mainGain.gain'))
    expect(masterLines.length).toBeGreaterThan(0)
    for (const line of masterLines) {
      expect(line).not.toMatch(/\b0\.7\b/)
    }
  })

  it('ramps when the slider moves, never steps', () => {
    // A step on a live bus is a click, and this bus is carrying the song.
    const setter = controller.slice(
      controller.indexOf('const setMusicLevel'),
      controller.indexOf('const setMusicLevel') + 700,
    )
    expect(setter).toContain('linearRampToValueAtTime')
    expect(setter).toContain('cancelScheduledValues')
  })

  it('stores the value before trusting it', () => {
    // `persist` clamps; the signal takes what actually stuck, so a slider
    // driven past its range by a script cannot desync the UI from the bus.
    expect(controller).toMatch(
      /const stored = persistMusicLevel\(value\)\s*\n\s*setMusicLevelLocal\(stored\)/,
    )
  })
})

describe('the ceiling', () => {
  it('sits between the master and the speakers', () => {
    // Order matters: shaping before the gain would clip the mix and then
    // amplify the clipped result, which is worse than no clipper at all.
    const wiring = controller.slice(
      controller.indexOf('mainGain = audioCtx.createGain()'),
      controller.indexOf('vocalAnalyser = audioCtx.createAnalyser()'),
    )
    expect(wiring).toContain('createWaveShaper()')
    expect(wiring).toContain('mainGain.connect(softClip)')
    expect(wiring).toContain('softClip.connect(audioCtx.destination)')
    expect(wiring).not.toContain('mainGain.connect(audioCtx.destination)')
  })

  it('is a shaper and not a compressor, for the latency', () => {
    // Chromium's DynamicsCompressorNode carries an internal lookahead. The
    // mixer scores mic pitch against reference pitch frame by frame, so any
    // added output latency is a silent scoring error. A WaveShaper is a
    // per-sample function: zero latency, and `oversample: 'none'` keeps it
    // that way.
    expect(controller).not.toContain('createDynamicsCompressor')
    expect(controller).toContain("softClip.oversample = 'none'")
  })
})

describe('the control', () => {
  it("is on screen, bound to the store's own bounds", () => {
    expect(mixer).toContain('data-testid="mixer-music-level"')
    expect(mixer).toContain('aria-label="Music level"')
    // Bounds come from the preference, not retyped in the markup — retyped
    // bounds are how a slider ends up able to set a value the store rejects.
    expect(mixer).toContain('min={audio.musicLevelRange.min}')
    expect(mixer).toContain('max={audio.musicLevelRange.max}')
    expect(mixer).toContain('step={audio.musicLevelRange.step}')
  })

  it('survives the stage settings being hidden', () => {
    // The moment this matters most is a scored performance run, and that is
    // exactly the preset that hides `showStageSettings`. Being inside that
    // Show would put the control behind the very mode that needs it.
    const header = mixer.slice(
      mixer.indexOf('data-tour="mixer.header"'),
      mixer.indexOf('<PremiumBackgroundPicker'),
    )
    const control = header.indexOf('data-testid="mixer-music-level"')
    const gate = header.indexOf('props.showStageSettings !== false')
    expect(control).toBeGreaterThan(-1)
    expect(gate).toBeGreaterThan(-1)
    expect(control).toBeLessThan(gate)
  })
})

describe('the note when the mic goes on', () => {
  const effect = mixer.slice(
    mixer.indexOf('sm-music-level-hint-seen') - 400,
    mixer.indexOf('sm-music-level-hint-seen') + 700,
  )

  it('fires on the mic, not on playback', () => {
    expect(effect).toContain('on(mic.micActive')
  })

  it('says it once and never again', () => {
    // A notification every time the mic opens is noise, and the singer only
    // needs telling where the slider is once.
    expect(effect).toContain('createPersistedSignal')
    expect(effect).toMatch(/if \(!micOn \|\| musicLevelHintSeen\(\)\) return/)
    expect(effect).toContain('setMusicLevelHintSeen(true)')
  })

  it('points at the control rather than blaming the app', () => {
    // The app does not duck. Wording that implied it did would send people
    // hunting for a setting that does not exist.
    expect(effect).toMatch(/music level slider/)
  })
})
