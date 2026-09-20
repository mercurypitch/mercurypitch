// Gallery labels — original artwork stories shared by every room using a painting recipe.

export interface GalleryArtwork {
  title: string
  imageAsset: string
  description: string
  story: string
  invitation: string
}

const ARTWORKS: Readonly<Record<string, GalleryArtwork>> = {
  'garden-painting-v5': {
    title: 'The garden between notes',
    imageAsset: 'painting-garden-v5',
    description:
      'A crystal fern unfurls among ivory blossoms and amethyst bells, traced with golden waves.',
    story:
      'The gardener left no name. Only this: every blossom began as a breath, and every breath was allowed its own time.',
    invitation:
      'Take your time. A gentle note can grow into something wonderful.',
  },
  'archive-painting-v5': {
    title: 'The memory of a note',
    imageAsset: 'painting-archive-v5',
    description:
      'Ivory arches and impossible terraces cradle a small amber orb against indigo and plum.',
    story:
      'They say this gallery keeps the notes we thought we had lost. Listen closely: the smallest one still lights a room.',
    invitation: 'A wobbly beginning is still a beginning. Try again, softly.',
  },
  'portrait-painting-v5': {
    title: 'She who woke the glass',
    imageAsset: 'painting-portrait-v5',
    description:
      'An imaginary singing muse in rose quartz and opal, with golden ribbons around an ivory halo.',
    story:
      'No one remembers her loudest performance. Everyone remembers the quiet note that made the whole museum shimmer.',
    invitation: 'You do not need a bigger voice. Let your own voice shine.',
  },
}

export function galleryArtwork(recipeId: string | null): GalleryArtwork | null {
  return recipeId === null ? null : (ARTWORKS[recipeId] ?? null)
}
