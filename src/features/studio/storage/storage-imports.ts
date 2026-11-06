// ============================================================
// Studio storage imports — each import's ready-to-play copy kept as the storage choice says, asked for first when there is none
// ============================================================
//
// Wraps the importer's two preparers (controller/imports.ts) so the
// controller's import flow stays as it is. With the choice made, or for a
// take recorded here, a preparer runs at once with its format, as it ran
// before. Without one, the import waits on one question for all its takes;
// a cancelled question cancels the import, which then reports nothing.
import type { CanonicalPcmFormat } from '@/lib/studio/audio/canonical-pcm'
import type { prepareStudioAsset } from '@/lib/studio/audio/prepare-studio-asset'
import { chooseStudioStorage, studioCanonicalFormat, studioStorageChoice, } from '@/lib/studio/audio/storage-quality'
import type { SourceKind } from '@/lib/studio/model/types'
import type { prepareStudioSource } from '../integration/prepare-source'
import type { StudioStorageAnswer } from './studio-storage-ask'

export interface StudioStorageImportOptions {
  /** The question (StudioStorageAsk); absent, audio is kept as the setting stands. */
  ask?: (signal?: AbortSignal) => Promise<StudioStorageAnswer | null>
  /** Stops the import a cancelled question was holding. */
  cancelImport(): void
}

export function createStudioStorageImports(
  options: StudioStorageImportOptions,
) {
  let asking: Promise<StudioStorageAnswer | null> | null = null

  /** The format a take's copy is kept in, once the choice is made: null while it must be asked. */
  function settledFormat(kind: SourceKind): CanonicalPcmFormat | null {
    const chosen = studioStorageChoice()
    // A take recorded here never waits on the question: it is kept as the
    // setting stands, Full quality until a choice is made.
    if (chosen !== null || kind === 'recording' || options.ask === undefined)
      return studioCanonicalFormat(chosen ?? 'full')
    return null
  }

  async function askedFormat(
    ask: NonNullable<StudioStorageImportOptions['ask']>,
    signal?: AbortSignal,
  ): Promise<CanonicalPcmFormat> {
    asking ??= ask(signal).finally(() => {
      asking = null
    })
    const answer = await asking
    if (answer === null) {
      if (signal?.aborted !== true) options.cancelImport()
      throw new DOMException('Studio import cancelled', 'AbortError')
    }
    chooseStudioStorage(answer.quality, answer.remember)
    return studioCanonicalFormat(answer.quality)
  }

  /** Prepare with the choice's format: at once when no question waits, else after its answer. */
  function withFormat<T>(
    kind: SourceKind,
    signal: AbortSignal | undefined,
    prepare: (canonicalFormat: CanonicalPcmFormat) => Promise<T>,
  ): Promise<T> {
    const format = settledFormat(kind)
    if (format !== null) return prepare(format)
    return askedFormat(options.ask!, signal).then(prepare)
  }

  return {
    /** A picked file's or a recorded take's preparer, given its format. */
    prepareFile(prepare: typeof prepareStudioAsset): typeof prepareStudioAsset {
      return (blob, info, prepared = {}) =>
        withFormat(info.provenance.kind, prepared.signal, (canonicalFormat) =>
          prepare(blob, info, { ...prepared, canonicalFormat }),
        )
    },
    /** A kept take's preparer, given its format. */
    prepareTake(
      prepare: typeof prepareStudioSource,
    ): typeof prepareStudioSource {
      return (entry, info, prepared = {}) =>
        withFormat(entry.source, prepared.signal, (canonicalFormat) =>
          prepare(entry, info, { ...prepared, canonicalFormat }),
        )
    },
  }
}
