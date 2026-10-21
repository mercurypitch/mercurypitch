// Creator gallery — native-accessible art studies keep separate identities from the campaign.
import type { LevelDefinition } from '@irchiinnuss/glass-game'
import type { ProceduralGeneratorOptions } from '@irchiinnuss/glass-game/creator-levels'
import { decodeProceduralCourseCode, encodeProceduralCourseCode, normalizeProceduralCourseOptions, PROCEDURAL_CODE_LIMIT, PROCEDURAL_SEED_LIMIT, } from '@irchiinnuss/glass-game/creator-levels'
import { CLOUDWAY_PRISMATIC_CAUSEWAY, CLOUDWAY_THAWING_SONG_ALCOVE, createProceduralCourse, crystalInteriorStudy, GLASS_ARCHIVE_HUSH, GLASS_UNBROKEN_ARCHIVE, GLASSWARE_TRIO_STUDY, livingCrystalStudy, } from '@irchiinnuss/glass-game/creator-levels'
import { createSignal, For, Show } from 'solid-js'
import { AdventureScreen } from './AdventureScreen'
import styles from './CreatorGallery.module.css'

const curatedSeeds = [
  'celestial-prime',
  'aurora-spire',
  'serpent-glissade',
  'crystal-crossroads',
  'twilight-arch',
  'prism-cascade',
] as const

const difficultyOptions: readonly {
  id: NonNullable<ProceduralGeneratorOptions['difficulty']>
  label: string
}[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'virtuoso', label: 'Virtuoso' },
]

const lessonOptions: readonly {
  id: NonNullable<ProceduralGeneratorOptions['melodyLessonId']>
  label: string
}[] = [
  { id: 'first-arc-v1', label: 'First Arc (3 notes)' },
  { id: 'sunlit-steps-v1', label: 'Sunlit Steps (5 notes)' },
  { id: 'gallery-arch-v1', label: 'Gallery Arch (7 notes)' },
  { id: 'two-windows-v1', label: 'Two Windows (10 notes)' },
]

const fogOptions: readonly {
  id: NonNullable<ProceduralGeneratorOptions['fogTheme']>
  label: string
}[] = [
  { id: 'celestial', label: 'Celestial' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'twilight', label: 'Twilight' },
]

const studies = [
  {
    id: 'archive-hush',
    title: 'The archive after dark',
    description:
      'Protect three rooms with humming, glass covers and curtains. Open the doors and find your way out.',
    create: () => GLASS_ARCHIVE_HUSH,
  },
  {
    id: 'unbroken-archive',
    title: 'The unbroken archive',
    description:
      'Find three sleeping vessels. Hold each note to wake the glass and open the way, keeping every piece whole.',
    create: () => GLASS_UNBROKEN_ARCHIVE,
  },
  {
    id: 'celestial-promenade',
    title: 'The Celestial Promenade',
    description:
      'Ascend a seven-act 3D glass viaduct across twin aurora ferries, frost glissades and a singing sky sanctuary.',
    create: () => CLOUDWAY_PRISMATIC_CAUSEWAY,
  },
  {
    id: 'glassware-trio',
    title: 'Three notes in glass',
    description:
      'Sing to a gilded goblet, an aqua carafe and a lotus bowl. Watch each one crack and scatter.',
    create: () => GLASSWARE_TRIO_STUDY,
  },
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

export const CLOUDWAY_RECIPE_STORAGE_KEY = 'beside-cue:cloudway-studio:v1'

function initialRecipe() {
  const fallback = {
    recipe: normalizeProceduralCourseOptions({
      seed: 'celestial-prime',
      melodyLessonId: 'sunlit-steps-v1',
    }),
    unreadableSavedRecipe: false,
    storageUnavailable: false,
  }
  let saved: string | null
  try {
    saved = window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)
  } catch {
    return { ...fallback, storageUnavailable: true }
  }
  if (saved === null) return fallback
  try {
    return { ...fallback, recipe: decodeProceduralCourseCode(saved) }
  } catch {
    return { ...fallback, unreadableSavedRecipe: true }
  }
}

export function CreatorGallery(props: { onExit(): void; assetBase?: string }) {
  const initial = initialRecipe()
  const [level, setLevel] = createSignal<LevelDefinition>()
  const [recipe, setRecipe] = createSignal(initial.recipe)
  const [courseCode, setCourseCode] = createSignal('')
  const [importCode, setImportCode] = createSignal('')
  const [notice, setNotice] = createSignal('')
  const [error, setError] = createSignal('')
  const [storageUnavailable, setStorageUnavailable] = createSignal(
    initial.storageUnavailable,
  )
  const [unreadableSavedRecipe, setUnreadableSavedRecipe] = createSignal(
    initial.unreadableSavedRecipe,
  )
  const seed = () => String(recipe().seed)
  const difficulty = () => recipe().difficulty
  const lesson = () => recipe().melodyLessonId
  const fog = () => recipe().fogTheme

  function persistRecipe(next: ProceduralGeneratorOptions) {
    let code: string
    try {
      code = encodeProceduralCourseCode(next)
    } catch {
      return // A partly entered seed is not a saved recipe.
    }
    try {
      window.localStorage.setItem(CLOUDWAY_RECIPE_STORAGE_KEY, code)
      setStorageUnavailable(false)
      setUnreadableSavedRecipe(false)
    } catch {
      setStorageUnavailable(true)
    }
  }

  function updateRecipe(changes: Partial<ProceduralGeneratorOptions>) {
    const current = recipe()
    const changed = (
      Object.keys(changes) as (keyof ProceduralGeneratorOptions)[]
    ).some((key) => changes[key] !== current[key])
    if (changed) {
      const next = { ...current, ...changes }
      setRecipe(next)
      persistRecipe(next)
    }
    setCourseCode('')
    setNotice('')
    setError('')
  }

  function randomizeSeed() {
    const current = seed().trim()
    const nextCandidates = curatedSeeds.filter((item) => item !== current)
    const picked =
      nextCandidates[Math.floor(Math.random() * nextCandidates.length)] ??
      'celestial-prime'
    const suffix = Math.floor(10 + Math.random() * 89)
    updateRecipe({ seed: `${picked}-${suffix}` })
  }

  function launchProceduralCourse() {
    setError('')
    try {
      const options = normalizeProceduralCourseOptions(recipe())
      setLevel(createProceduralCourse(options).compiledLevel)
    } catch {
      setError(
        'This course could not be built. Check the seed or try another one.',
      )
    }
  }

  async function copyCourseCode() {
    setError('')
    let code: string
    try {
      code = encodeProceduralCourseCode(recipe())
      setCourseCode(code)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Check the course settings.',
      )
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      if (courseCode() === code)
        setNotice(
          'Course code copied. Paste it into Cloudway Studio on another device.',
        )
    } catch {
      if (courseCode() === code)
        setNotice(
          'Select and copy the course code below. Clipboard access is unavailable here.',
        )
    }
  }

  function importCourseCode() {
    setError('')
    setNotice('')
    try {
      const decoded = decodeProceduralCourseCode(importCode())
      setRecipe(decoded)
      persistRecipe(decoded)
      setCourseCode('')
      setNotice('Course settings loaded. Launch when you are ready.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Check the course code.',
      )
    }
  }

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
            A place to try new treasures, procedural 3D causeways and living
            crystal. Your main journey stays just as you left it.
          </p>

          <section
            class={styles.studioCard}
            aria-label="Procedural Cloudway Studio"
          >
            <div class={styles.studioHeader}>
              <div>
                <p class={styles.eyebrow}>Procedural 3D Course Composer</p>
                <h2>Cloudway Expedition Studio</h2>
              </div>
              <div class={styles.studioActions}>
                <button
                  type="button"
                  class={styles.secondaryButton}
                  onClick={() => void copyCourseCode()}
                >
                  Copy course code
                </button>
                <button
                  type="button"
                  class={styles.primaryButton}
                  onClick={launchProceduralCourse}
                >
                  Launch expedition
                </button>
              </div>
            </div>

            <div class={styles.studioControls}>
              <div class={styles.controlGroup}>
                <label class={styles.controlLabel} for="cloudway-seed-input">
                  Course seed
                </label>
                <div class={styles.seedRow}>
                  <input
                    id="cloudway-seed-input"
                    class={styles.seedInput}
                    type="text"
                    maxLength={PROCEDURAL_SEED_LIMIT}
                    value={seed()}
                    onInput={(e) =>
                      updateRecipe({ seed: e.currentTarget.value })
                    }
                  />
                  <button
                    type="button"
                    class={styles.secondaryButton}
                    onClick={randomizeSeed}
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div class={styles.controlGroup}>
                <span class={styles.controlLabel}>Melody arc</span>
                <div class={styles.pillRow}>
                  <For each={lessonOptions}>
                    {(item) => (
                      <button
                        type="button"
                        class={styles.pillButton}
                        aria-pressed={lesson() === item.id}
                        onClick={() =>
                          updateRecipe({ melodyLessonId: item.id })
                        }
                      >
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class={styles.controlGroup}>
                <span class={styles.controlLabel}>Pacing</span>
                <div class={styles.pillRow}>
                  <For each={difficultyOptions}>
                    {(item) => (
                      <button
                        type="button"
                        class={styles.pillButton}
                        aria-pressed={difficulty() === item.id}
                        onClick={() => updateRecipe({ difficulty: item.id })}
                      >
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class={styles.controlGroup}>
                <span class={styles.controlLabel}>Atmosphere</span>
                <div class={styles.pillRow}>
                  <For each={fogOptions}>
                    {(item) => (
                      <button
                        type="button"
                        class={styles.pillButton}
                        aria-pressed={fog() === item.id}
                        onClick={() => updateRecipe({ fogTheme: item.id })}
                      >
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class={styles.recipeSwitches}>
              <label>
                <input
                  type="checkbox"
                  checked={recipe().includeLivingCrystals}
                  onChange={(event) =>
                    updateRecipe({
                      includeLivingCrystals: event.currentTarget.checked,
                    })
                  }
                />
                Living crystal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={recipe().includeOptionalAlcoves}
                  onChange={(event) =>
                    updateRecipe({
                      includeOptionalAlcoves: event.currentTarget.checked,
                    })
                  }
                />
                Side treasures
              </label>
            </div>
            <section class={styles.sharing} aria-label="Share a course">
              <p>
                Send a course code to play the same expedition in Cloudway
                Studio. Paste a code here to load its settings.
              </p>
              <label class={styles.controlLabel} for="cloudway-import-code">
                Course code to import
              </label>
              <textarea
                id="cloudway-import-code"
                class={styles.codeInput}
                rows={3}
                maxLength={PROCEDURAL_CODE_LIMIT}
                value={importCode()}
                spellcheck={false}
                autocapitalize="off"
                onInput={(event) => setImportCode(event.currentTarget.value)}
              />
              <button
                type="button"
                class={styles.secondaryButton}
                onClick={importCourseCode}
              >
                Load course code
              </button>
              <Show when={courseCode()}>
                <label class={styles.controlLabel} for="cloudway-export-code">
                  Your course code
                </label>
                <textarea
                  id="cloudway-export-code"
                  class={styles.codeInput}
                  rows={3}
                  readOnly
                  value={courseCode()}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                />
              </Show>
              <Show when={unreadableSavedRecipe() || notice()}>
                <p role="status" class={styles.notice}>
                  <Show when={unreadableSavedRecipe()}>
                    Your saved course code cannot be read here. It has been
                    kept. A valid settings change or code import will replace
                    it.{' '}
                  </Show>
                  {notice()}
                </p>
              </Show>
              <Show when={error()}>
                <p role="alert" class={styles.error}>
                  {error()}
                </p>
              </Show>
              <Show when={storageUnavailable()}>
                <p class={styles.notice}>
                  Saved settings are unavailable on this device. Keep a course
                  code to return to this expedition.
                </p>
              </Show>
            </section>
          </section>

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
