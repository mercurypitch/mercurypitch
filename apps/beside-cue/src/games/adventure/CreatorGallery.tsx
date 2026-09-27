// Creator gallery — native-accessible art studies keep separate identities from the campaign.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import { CLOUDWAY_THAWING_SONG_ALCOVE, crystalInteriorStudy, livingCrystalStudy, } from '@irchiinnuss/glass-game/creator-levels'
import { createSignal, For, Show } from 'solid-js'
import { AdventureScreen } from './AdventureScreen'
import styles from './CreatorGallery.module.css'

const studies = [
  {
    id: 'alcove',
    title: 'The pearl alcove',
    description:
      'A little detour through the Thawing Song. Find two optional treasures beside the garden.',
    create: () => CLOUDWAY_THAWING_SONG_ALCOVE,
  },
  {
    id: 'pearl-roots-v2',
    title: 'The living pearl',
    description:
      'Cross a thick rose crystal grown around dimensional pearl-gold roots.',
    create: () => livingCrystalStudy('pearl-roots'),
  },
  {
    id: 'living-amber-v2',
    title: 'The living amber',
    description:
      'Try the same walkable crystal with a warmer travelling amber heart.',
    create: () => livingCrystalStudy('living-amber'),
  },
  {
    id: 'resonance-veins',
    title: 'Resonance veins',
    description: 'Follow warm threads of light beneath the crystal scroll.',
    create: () => crystalInteriorStudy('resonance-veins'),
  },
  {
    id: 'frost-roots',
    title: 'Frost roots',
    description: 'Delicate branching light grows through the ice.',
    create: () => crystalInteriorStudy('frost-roots'),
  },
  {
    id: 'aurora-heart',
    title: 'Aurora heart',
    description: 'A soft ribbon of colour moves inside the crystal.',
    create: () => crystalInteriorStudy('aurora-heart'),
  },
] as const

export function CreatorGallery(props: { onExit(): void; assetBase?: string }) {
  const [level, setLevel] = createSignal<LevelDefinition>()
  return (
    <Show
      when={level()}
      keyed
      fallback={
        <main class={styles.gallery}>
          <header class={styles.header}>
            <div>
              <p class={styles.eyebrow}>Glassworks · Studies</p>
              <h1>Little discoveries</h1>
            </div>
            <button type="button" onClick={() => props.onExit()}>
              Back to games
            </button>
          </header>
          <p class={styles.intro}>
            A place to try new treasures and living crystal. Your main journey
            stays just as you left it.
          </p>
          <section class={styles.grid} aria-label="Art studies">
            <For each={studies}>
              {(study, index) => (
                <button
                  class={styles.card}
                  type="button"
                  onClick={() => setLevel(study.create())}
                >
                  <span class={styles.number} aria-hidden="true">
                    0{index() + 1}
                  </span>
                  <span>
                    <strong>{study.title}</strong>
                    <span class={styles.description}>{study.description}</span>
                  </span>
                </button>
              )}
            </For>
          </section>
        </main>
      }
    >
      {(selected) => (
        <AdventureScreen
          level={selected}
          assetBase={props.assetBase}
          onExit={() => setLevel(undefined)}
        />
      )}
    </Show>
  )
}
