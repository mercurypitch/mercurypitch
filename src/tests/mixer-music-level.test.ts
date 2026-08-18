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
  const stage = mixer.slice(
    mixer.indexOf('<KaraokeMobileStage'),
    mixer.indexOf('ribbonNotes={pitchAnalysis.editableNotes}'),
  )

  it('is handed to the zen stage, where the phone can reach it', () => {
    // Under `isNarrow()` StemMixer renders KaraokeMobileStage INSTEAD of the
    // mixer, so a control in the mixer header is not on the page at all on a
    // phone — which is the one place iOS turns the backing track down.
    expect(stage).toContain('musicLevel={audio.musicLevel}')
    expect(stage).toContain('onMusicLevel={audio.setMusicLevel}')
    // Bounds come from the preference, not retyped in the markup — retyped
    // bounds are how a slider ends up able to set a value the store rejects.
    expect(stage).toContain('musicLevelRange={audio.musicLevelRange}')
  })

  it('is not left behind in the mixer header as well', () => {
    // Reported on the first cut: "the slider is basically only visible on
    // desktop in top of the stem mixer, and is ugly as hell." Two controls
    // for one value is also two places for the styling to rot.
    const header = mixer.slice(
      mixer.indexOf('data-tour="mixer.header"'),
      mixer.indexOf('<PremiumBackgroundPicker'),
    )
    expect(header).not.toContain('mixer-music-level')
    expect(header).not.toContain('sm-music-level-slider')
    expect(mixer).not.toContain('class="sm-music-level"')
  })

  it('travels beside the mic it exists because of', () => {
    // Adjacency in the props is the cheap proxy for adjacency on the bar;
    // the rendered pairing is asserted in
    // `src/components/__tests__/KaraokeMobileStage.musicLevel.test.tsx`.
    expect(stage.indexOf('onToggleMic=')).toBeLessThan(
      stage.indexOf('musicLevel='),
    )
  })

  it('is passed straight through, never behind a condition', () => {
    // The moment this matters most is a scored performance run, which hides
    // the stage settings. A `showStageSettings && ...` guard here would put
    // the control behind the very mode that needs it — the first cut of this
    // control had exactly that shape in the mixer header, deliberately not.
    // What the stage then does with it is asserted by rendering, in
    // `KaraokeMobileStage.musicLevel.test.tsx`.
    for (const prop of ['musicLevel', 'onMusicLevel', 'musicLevelRange']) {
      const line = stage
        .split('\n')
        .find((row) => row.trimStart().startsWith(`${prop}=`))
      expect(line, `${prop} is not passed`).toBeDefined()
      expect(line).not.toContain('?')
      expect(line).not.toContain('&&')
    }
  })
})

describe('the note when the mic goes on', () => {
  const effect = mixer.slice(
    mixer.indexOf('sm-music-level-hint-seen') - 900,
    mixer.indexOf('sm-music-level-hint-seen') + 900,
  )

  it('fires on the mic, not on playback', () => {
    expect(effect).toContain('on(mic.micActive')
  })

  it('says it once and never again', () => {
    // A notification every time the mic opens is noise, and the singer only
    // needs telling where the control is once.
    expect(effect).toContain('createPersistedSignal')
    expect(effect).toContain('setMusicLevelHintSeen(true)')
  })

  it('holds its peace until the control is on screen', () => {
    // The button lives on the zen stage. Telling a desktop mixer user about
    // a button that is not on their screen is worse than saying nothing —
    // and it would burn the once-ever flag doing it.
    expect(effect).toMatch(
      /if \(!micOn \|\| !zenStage\(\) \|\| musicLevelHintSeen\(\)\) return/,
    )
  })

  it('describes noise cancelling, not a lost backing track', () => {
    // Reported on the first wording: "it currently says that we lose a
    // backing track or whatever, but its not what happens, the volume is
    // just reduced in a typical noise cancelling scenario". Nothing is lost
    // and nothing is muted — the platform is simply quieter.
    expect(effect).toMatch(/noise cancelling/)
    expect(effect).toMatch(/turns the backing track down/)
    expect(effect).not.toMatch(/drops the backing track/)
  })

  it('points at the button, not at a slider up top', () => {
    // The old wording said "up top", which was true of the mixer header and
    // has never been true of the stage the phone actually shows.
    expect(effect).toContain('music button next to the mic')
    expect(effect).not.toMatch(/up top/)
  })
})
