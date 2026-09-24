// Compile original melody sketches into one bounded contour for visual and audio auditions.
export const melodies = [
  {
    id: 'first-arc',
    title: 'First arc',
    notes: 3,
    description: 'A small rise, then gently home.',
    phrases: [[0, 2, 0]],
  },
  {
    id: 'sunlit-steps',
    title: 'Sunlit steps',
    notes: 5,
    description: 'Two steps into the light, then back.',
    phrases: [[0, 2, 4, 2, 0]],
  },
  {
    id: 'gallery-arch',
    title: 'Gallery arch',
    notes: 7,
    description: 'A longer arch with a little more sky.',
    phrases: [[0, 2, 4, 7, 4, 2, 0]],
  },
  {
    id: 'two-windows',
    title: 'Two windows',
    notes: 10,
    description: 'Two short phrases. Take a breath between them.',
    phrases: [
      [0, 2, 4, 2, 0],
      [0, 2, 5, 2, 0],
    ],
  },
]

export function compile(melody, pace = 1) {
  if (!Number.isFinite(pace) || pace <= 0)
    throw new Error('Pace must be positive.')
  let time = 0
  const phrases = melody.phrases.map((notes, phraseIndex) => {
    const start = time
    const segments = []
    const anchors = []
    notes.forEach((pitch, index) => {
      const landing = (index === notes.length - 1 ? 0.6 : 0.4) * pace
      anchors.push({ time, pitch, completedAt: time + landing })
      segments.push({
        start: time,
        end: time + landing,
        from: pitch,
        to: pitch,
      })
      time += landing
      if (index < notes.length - 1) {
        const length = 0.65 * pace
        segments.push({
          start: time,
          end: time + length,
          from: pitch,
          to: notes[index + 1],
        })
        time += length
      }
    })
    const end = time
    if (phraseIndex < melody.phrases.length - 1) time += 0.85 * pace
    return { start, end, segments, anchors }
  })
  return { phrases, duration: time }
}

export function samplePhrase(phrase, time) {
  const segment =
    phrase.segments.find((part) => time < part.end) ?? phrase.segments.at(-1)
  const phase = Math.max(
    0,
    Math.min(1, (time - segment.start) / (segment.end - segment.start)),
  )
  const eased = phase * phase * (3 - 2 * phase)
  return segment.from + (segment.to - segment.from) * eased
}

export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}
