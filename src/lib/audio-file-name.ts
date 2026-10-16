// ============================================================
// Song names from audio file names
// ============================================================
//
// A separated song is named after the file it came from, and its title can
// carry dots of its own: "Mr. Brightside", "A.B.C". Only a real audio
// extension is taken off. Stripping whatever follows the last dot turned
// "Mr. Brightside" into "Mr".

const AUDIO_EXTENSION =
  /\.(?:mp3|mp2|m4a|m4b|mp4|aac|wav|wave|flac|ogg|oga|opus|webm|weba|aif|aiff|aifc|caf|wma|amr|mka|3gp|mpga|mpeg|ape|wv|dsf|dff|mov|mkv)$/i

/** "Song.mp3" is "Song", "track.final.wav" is "track.final", and a name
 *  with no audio extension ("Mr. Brightside") stays as it is. */
export function stripAudioExtension(name: string): string {
  return name.replace(AUDIO_EXTENSION, '')
}
