// Glass product SFX — independently generated fracture recordings prepared before the first live rep.

import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createRecordedGlassFracture, readGlassEffectsVolume, } from '@irchiinnuss/glass-game/fracture-audio'

const players = new WeakMap<
  AudioContext,
  ReturnType<typeof createRecordedGlassFracture>
>()
const breaks = new WeakMap<AudioContext, number>()

export function prepareGlassShatter(context: AudioContext): Promise<void> {
  let player = players.get(context)
  if (player === undefined) {
    player = createRecordedGlassFracture({
      context,
      assetUrl: (id) => glassGameAssetUrl(id, '/glass-game-assets/'),
      profile: { form: 'panel', size: 'medium', material: 'thin-crystal' },
      volume: () => readGlassEffectsVolume('mercurypitch:glass-adventure'),
      seed: 20_261_002,
    })
    players.set(context, player)
  }
  return player.prepare()
}

/** The authoritative rep has ended; missing optional recordings stay silent. */
export function playGlassShatter(
  context: AudioContext,
  _epicness: number,
): void {
  const count = breaks.get(context) ?? 0
  breaks.set(context, count + 1)
  players.get(context)?.play(`glass-rep-${count}`)
}

export function disposeGlassShatter(context: AudioContext | null): void {
  if (context === null) return
  void players.get(context)?.dispose()
  players.delete(context)
  breaks.delete(context)
}
