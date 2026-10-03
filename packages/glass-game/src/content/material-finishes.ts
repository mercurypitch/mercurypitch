// Authored material finishes — portable Blender optical recipes and compact shared texture IDs.

export const MATERIAL_FINISH_FILES = {
  'finish-champagne-crystal-roughness':
    'material-finish-v1/champagne-crystal-roughness.png',
  'finish-champagne-crystal-normal':
    'material-finish-v1/champagne-crystal-normal.png',
  'finish-amethyst-cut-crystal-roughness':
    'material-finish-v1/amethyst-cut-crystal-roughness.png',
  'finish-amethyst-cut-crystal-normal':
    'material-finish-v1/amethyst-cut-crystal-normal.png',
  'finish-opal-ribbon-glass-basecolor':
    'material-finish-v1/opal-ribbon-glass-basecolor.png',
  'finish-opal-ribbon-glass-roughness':
    'material-finish-v1/opal-ribbon-glass-roughness.png',
  'finish-opal-ribbon-glass-normal':
    'material-finish-v1/opal-ribbon-glass-normal.png',
  'finish-etched-frost-glass-roughness':
    'material-finish-v1/etched-frost-glass-roughness.png',
  'finish-etched-frost-glass-normal':
    'material-finish-v1/etched-frost-glass-normal.png',
  'finish-celadon-porcelain-basecolor':
    'material-finish-v1/celadon-porcelain-basecolor.png',
  'finish-celadon-porcelain-roughness':
    'material-finish-v1/celadon-porcelain-roughness.png',
  'finish-celadon-porcelain-normal':
    'material-finish-v1/celadon-porcelain-normal.png',
} as const

export const MATERIAL_FINISH_RECIPES = {
  'champagne-crystal': {
    parameters: {
      color: '#fff7e6',
      metalness: 0,
      transmission: 0.97,
      ior: 1.46,
      thickness: 0.045,
      clearcoat: 0.35,
      clearcoatRoughness: 0.075,
      normalScale: [1, 1],
      attenuationColor: '#eac778',
      attenuationDistance: 1.8,
      roughness: 1,
      opacity: 1,
      transparent: false,
      depthWrite: true,
    },
    maps: {
      roughness: {
        assetId: 'finish-champagne-crystal-roughness',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.4285714285714286, 1.4285714285714286],
        flipY: false,
        anisotropy: 4,
      },
      normal: {
        assetId: 'finish-champagne-crystal-normal',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.4285714285714286, 1.4285714285714286],
        flipY: false,
        anisotropy: 4,
      },
    },
    fallbackRoughness: 0.0655,
  },
  'amethyst-cut-crystal': {
    parameters: {
      color: '#e8def5',
      metalness: 0,
      transmission: 0.91,
      ior: 1.54,
      thickness: 0.07,
      clearcoat: 0.5,
      clearcoatRoughness: 0.065,
      normalScale: [1, 1],
      attenuationColor: '#8060b0',
      attenuationDistance: 0.55,
      roughness: 1,
      opacity: 1,
      transparent: false,
      depthWrite: true,
    },
    maps: {
      roughness: {
        assetId: 'finish-amethyst-cut-crystal-roughness',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.8181818181818181, 1.8181818181818181],
        flipY: false,
        anisotropy: 4,
      },
      normal: {
        assetId: 'finish-amethyst-cut-crystal-normal',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.8181818181818181, 1.8181818181818181],
        flipY: false,
        anisotropy: 4,
      },
    },
    fallbackRoughness: 0.09,
  },
  'opal-ribbon-glass': {
    parameters: {
      color: '#ffffff',
      metalness: 0,
      transmission: 0.78,
      ior: 1.48,
      thickness: 0.055,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
      normalScale: [1, 1],
      attenuationColor: '#a9d9cd',
      attenuationDistance: 0.85,
      iridescence: 0.24,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [310, 430],
      roughness: 1,
      opacity: 1,
      transparent: false,
      depthWrite: true,
    },
    maps: {
      baseColor: {
        assetId: 'finish-opal-ribbon-glass-basecolor',
        colorSpace: 'srgb',
        wrap: 'repeat',
        repeat: [1.25, 1.25],
        flipY: false,
        anisotropy: 4,
      },
      roughness: {
        assetId: 'finish-opal-ribbon-glass-roughness',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.25, 1.25],
        flipY: false,
        anisotropy: 4,
      },
      normal: {
        assetId: 'finish-opal-ribbon-glass-normal',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.25, 1.25],
        flipY: false,
        anisotropy: 4,
      },
    },
    fallbackColor: '#d9e5df',
    fallbackRoughness: 0.17,
  },
  'etched-frost-glass': {
    parameters: {
      color: '#eff9f8',
      metalness: 0,
      transmission: 0.94,
      ior: 1.47,
      thickness: 0.045,
      clearcoat: 0.08,
      clearcoatRoughness: 0.14,
      normalScale: [1, 1],
      attenuationColor: '#cbe6dc',
      attenuationDistance: 2.2,
      roughness: 1,
      opacity: 1,
      transparent: false,
      depthWrite: true,
    },
    maps: {
      roughness: {
        assetId: 'finish-etched-frost-glass-roughness',
        colorSpace: 'linear',
        wrap: 'clamp',
        repeat: [1, 1],
        flipY: false,
        anisotropy: 4,
      },
      normal: {
        assetId: 'finish-etched-frost-glass-normal',
        colorSpace: 'linear',
        wrap: 'clamp',
        repeat: [1, 1],
        flipY: false,
        anisotropy: 4,
      },
    },
    fallbackRoughness: 0.28750000000000003,
  },
  'celadon-porcelain': {
    parameters: {
      color: '#ffffff',
      metalness: 0,
      transmission: 0,
      ior: 1.5,
      thickness: 0,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
      normalScale: [1, 1],
      roughness: 1,
      opacity: 1,
      transparent: false,
      depthWrite: true,
    },
    maps: {
      baseColor: {
        assetId: 'finish-celadon-porcelain-basecolor',
        colorSpace: 'srgb',
        wrap: 'repeat',
        repeat: [1.5384615384615383, 1.5384615384615383],
        flipY: false,
        anisotropy: 4,
      },
      roughness: {
        assetId: 'finish-celadon-porcelain-roughness',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.5384615384615383, 1.5384615384615383],
        flipY: false,
        anisotropy: 4,
      },
      normal: {
        assetId: 'finish-celadon-porcelain-normal',
        colorSpace: 'linear',
        wrap: 'repeat',
        repeat: [1.5384615384615383, 1.5384615384615383],
        flipY: false,
        anisotropy: 4,
      },
    },
    fallbackRoughness: 0.245,
  },
} as const

export type MaterialFinishId = keyof typeof MATERIAL_FINISH_RECIPES

// Only these hosts have authored UVs in the runner. Border glass uses scalar optics.
export const RUNNER_MATERIAL_FINISH_TEXTURE_IDS = (
  ['champagne-crystal', 'etched-frost-glass', 'celadon-porcelain'] as const
).flatMap((id) =>
  Object.values(MATERIAL_FINISH_RECIPES[id].maps).map((map) => map.assetId),
)
