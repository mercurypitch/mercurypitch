// ============================================================
// Web Speech API Wrapper — Browser-native speech recognition
//
// Thin wrapper around SpeechRecognition / webkitSpeechRecognition.
// Continuous mode, interim results. For testing lyric capture
// feasibility before Whisper.cpp integration.
// ============================================================

export interface SpeechRecognizerOptions {
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  lang?: string
}

export interface SpeechRecognizer {
  start: () => void
  stop: () => string
  isSupported: boolean
}

export function createSpeechRecognizer(
  options: SpeechRecognizerOptions = {},
): SpeechRecognizer {
  const w = window as unknown as Record<string, unknown>
  const SpeechRecognition = (w.SpeechRecognition ??
    w.webkitSpeechRecognition) as
    | (new () => {
        continuous: boolean
        interimResults: boolean
        lang: string
        maxAlternatives: number
        onresult:
          | ((event: {
              resultIndex: number
              results: Array<{
                isFinal: boolean
                0: { transcript: string }
                length: number
              }>
            }) => void)
          | null
        onerror: ((event: Event & { error: string }) => void) | null
        start: () => void
        stop: () => void
      })
    | undefined

  const isSupported = SpeechRecognition !== undefined

  if (!isSupported) {
    return {
      start: () => {},
      stop: () => '',
      isSupported: false,
    }
  }

  let finalTranscript = ''
  const recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = options.lang ?? 'en-US'
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalTranscript += ` ${result[0].transcript}`
        options.onResult?.(finalTranscript.trim(), true)
      } else {
        interim += result[0].transcript
      }
    }
    if (interim) {
      options.onResult?.(`${finalTranscript} ${interim}`.trim(), false)
    }
  }

  recognition.onerror = (event: Event & { error: string }) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return
    options.onError?.(event.error)
  }

  return {
    start: () => {
      try {
        recognition.start()
      } catch {
        // Already started — ignore
      }
    },
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // Already stopped — ignore
      }
      const text = finalTranscript.trim()
      finalTranscript = ''
      return text
    },
    isSupported: true,
  }
}
