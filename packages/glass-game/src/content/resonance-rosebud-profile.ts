// Resonance Rosebud profile — stable exhibit identity, fracture roots and display scale shared by content and rendering.

export const RESONANCE_ROSEBUD_VARIANT_ID = 'resonance-rosebud-v1'
export const RESONANCE_ROSEBUD_BUNDLE_ID = 'resonance-rosebud-v1'

export const RESONANCE_ROSEBUD_NODES = {
  root: 'G13_EXHIBIT',
  intact: 'G13_INTACT',
  fragments: 'G13_FRAGMENTS',
  intactMesh: 'intact_shell',
  shardPrefix: 'shard_',
} as const

export const RESONANCE_ROSEBUD_SHARD_COUNT = 20
export const RESONANCE_ROSEBUD_SOURCE_HEIGHT = 0.45
export const RESONANCE_ROSEBUD_DISPLAY_HEIGHT = 0.8

export const RESONANCE_ROSEBUD_MATERIALS = {
  glass: 'RoseGlass',
  trim: 'GoldTrim',
  fractureInterior: 'FractureInterior',
} as const

export const RESONANCE_ROSEBUD_MATERIAL_OPTICS = {
  [RESONANCE_ROSEBUD_MATERIALS.glass]: {
    sourceThickness: 0.012,
    sourceAttenuationDistance: 0.153_846_153_846,
    displayThickness: 0.021_333_333_333,
    displayAttenuationDistance: 0.273_504_273_504,
  },
  [RESONANCE_ROSEBUD_MATERIALS.fractureInterior]: {
    sourceThickness: 0.009,
    sourceAttenuationDistance: 0.166_666_666_667,
    displayThickness: 0.016,
    displayAttenuationDistance: 0.296_296_296_296,
  },
} as const

export const RESONANCE_ROSEBUD_RUNTIME = {
  bytes: 4_257_288,
  sha256: '1cc56be7bf247a4217898a2ea8a3071c76d518eb005efdb264bc6802ba559741',
  intactTriangles: 96_736,
  fractureTriangles: 115_850,
} as const
