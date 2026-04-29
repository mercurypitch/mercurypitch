import type { AudioEngine } from '@/lib/audio-engine'
import { downloadMIDI, importMelodyFromMIDI } from '@/lib/piano-roll'
import { melodyTotalBeats } from '@/lib/scale-data'
import { generateShareURL } from '@/lib/share-url'
import { appStore } from '@/stores'
import { melodyStore } from '@/stores/melody-store'

interface Deps {
  audioEngine: AudioEngine
}

export interface EditorController {
  handleShare: () => void
  handleExportMIDI: () => void
  handleImportMIDI: () => void
}

export function useEditorController(_deps: Deps): EditorController {
  const handleShare = (): void => {
    const melody = melodyStore.items()
    const key = appStore.keyName()
    const scaleType = appStore.scaleType()
    const bpm = appStore.bpm()
    const totalBeats = melodyTotalBeats(melody)

    const url = generateShareURL(melody, bpm, key, scaleType, totalBeats)
    void navigator.clipboard.writeText(url).then(() => {
      appStore.showNotification('Share URL copied to clipboard!', 'success')
    })
  }

  const handleExportMIDI = (): void => {
    const melody = melodyStore.items()
    const bpm = appStore.bpm()
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    const result = downloadMIDI(melody, bpm, `pitchperfect-${timestamp}.mid`)
    if (result !== null) {
      appStore.showNotification('MIDI file exported!', 'success')
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
          melodyStore.setMelody(melody)
          appStore.showNotification(
            `Imported ${melody.length} note(s) from MIDI`,
            'success',
          )
        } else {
          appStore.showNotification('Could not parse MIDI file', 'error')
        }
      } catch (_err) {
        appStore.showNotification('Error reading MIDI file', 'error')
      }
    }
    input.click()
  }

  return { handleShare, handleExportMIDI, handleImportMIDI }
}
