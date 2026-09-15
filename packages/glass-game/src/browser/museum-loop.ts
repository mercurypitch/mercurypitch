// Museum loop repair — join the actual decoded samples without relying on codec padding metadata.
export function repairMuseumLoop(
  context: Pick<BaseAudioContext, 'createBuffer'>,
  decoded: AudioBuffer,
  seconds = 0.08,
): AudioBuffer {
  const overlap = Math.min(
    Math.floor(decoded.length / 4),
    Math.max(2, Math.round(decoded.sampleRate * seconds)),
  )
  if (overlap < 2) throw new Error('The museum loop is too short.')
  const middle = decoded.length - overlap * 2
  const repaired = context.createBuffer(
    decoded.numberOfChannels,
    decoded.length - overlap,
    decoded.sampleRate,
  )
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const source = decoded.getChannelData(channel)
    const target = repaired.getChannelData(channel)
    target.set(source.subarray(overlap, decoded.length - overlap))
    for (let frame = 0; frame < overlap; frame++) {
      // Constant-sum cosine overlap cannot amplify correlated content. Both ends
      // retain the adjacent original sample, including the AudioBuffer wrap.
      const weight = (1 - Math.cos((Math.PI * frame) / (overlap - 1))) / 2
      target[middle + frame] =
        source[decoded.length - overlap + frame] * (1 - weight) +
        source[frame] * weight
    }
  }
  return repaired
}
