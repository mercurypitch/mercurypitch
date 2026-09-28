// Runs once, before any browser starts: the microphone's WAV has to exist
// when Chromium launches with --use-file-for-fake-audio-capture.
import { VOICE_WAV } from '../playwright.shots.config'
import { writeVoiceWav } from './voice'

export default function writeVoice(): void {
  writeVoiceWav(VOICE_WAV)
}
