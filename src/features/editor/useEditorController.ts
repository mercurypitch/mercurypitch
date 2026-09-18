// ============================================================
// useEditorController — Compose-tab actions (MIDI import/export, share)
// ============================================================
//
// The thin action layer over the piano-roll editor: import a MIDI file into
// the melody store, export the current melody, and build a share URL. Editing
// itself lives in @/lib/piano-roll.ts.

import type { AudioEngine } from '@/lib/audio-engine'
import { downloadMIDI, exportFilename, importMelodyFromMIDI, readMidiTempoBpm, } from '@/lib/piano-roll'
import { melodyTotalBeats } from '@/lib/scale-data'
import { generateShareURL } from '@/lib/share-url'
import { bpm, keyName, scaleType, setBpm, showNotification } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyItem } from '@/types'

interface Deps {
  audioEngine: AudioEngine
}

export interface EditorController {
  handleShare: () => void
  handleExportMIDI: () => void
  handleImportMIDI: () => void
  applyImportedMelody: (
    melody: MelodyItem[],
    name: string,
    importedBpm?: number,
  ) => void
}

export function useEditorController(_deps: Deps): EditorController {
  /**
   * Store an imported melody, and adopt the tempo it was written at.
   *
   * Both halves belong to the same import, so they live in one place. Writing
   * only the transport left the melody record on the store default, and every
   * later load path reads that record back — the song returned at the wrong
   * speed from the library, the session sequencer and a reload (issue #813).
   *
   * A file that declares no tempo leaves the transport where the user put it.
   */
  const applyImportedMelody = (
    melody: MelodyItem[],
    name: string,
    importedBpm?: number,
  ): void => {
    melodyStore.loadImportedMelody(
      melody,
      name,
      importedBpm === undefined ? undefined : { bpm: importedBpm },
    )
    if (importedBpm !== undefined) setBpm(importedBpm)
  }

  const handleShare = (): void => {
    const melody = melodyStore.items()
    const key = keyName()
    const scaleTypeVal = scaleType()
    const bpmVal = bpm()
    const totalBeats = melodyTotalBeats(melody)

    const url = generateShareURL(melody, bpmVal, key, scaleTypeVal, totalBeats)
    void navigator.clipboard.writeText(url).then(() => {
      showNotification('Share URL copied to clipboard!', 'success')
    })
  }

  const handleExportMIDI = (): void => {
    const melody = melodyStore.items()
    const bpmVal = bpm()
    const result = downloadMIDI(melody, bpmVal, exportFilename('mid'))
    if (result !== null) {
      showNotification('MIDI file exported!', 'success')
    }
  }

  const handleImportMIDI = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid,.midi'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        const melody = importMelodyFromMIDI(data)
        if (melody !== null && melody.length > 0) {
          // Name the melody after the file instead of dropping its notes into
          // whichever melody happened to be open under that melody's name,
          // and adopt the file's own tempo so it plays as written.
          const name = file.name.replace(/\.(mid|midi)$/i, '')
          const tempo = readMidiTempoBpm(data)
          applyImportedMelody(melody, name, tempo ?? undefined)
          showNotification(
            `Imported ${melody.length} note(s) from ${name}`,
            'success',
          )
        } else {
          showNotification('Could not parse MIDI file', 'error')
        }
      } catch (_err) {
        showNotification('Error reading MIDI file', 'error')
      }
    }
    input.click()
  }

  return {
    handleShare,
    handleExportMIDI,
    handleImportMIDI,
    applyImportedMelody,
  }
}
