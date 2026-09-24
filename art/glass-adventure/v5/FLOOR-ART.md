# Floor art

Floor art is presentation data on a room placement. It does not add collision,
change a platform ID, or enter saved progress.

```ts
{
  id: 'garden',
  prefabId: 'glassworks-journey-gallery',
  // ...placement...
  floorArt: { recipeId: 'sound-wave', palette: 'garden' },
}
```

The composer expands that room choice to its exact runtime platform IDs. The
renderer derives subtle orientation, density, and accent choices from the
stable `level.id` and platform ID. Do not author or persist a random seed.

| Recipe            | Intended use                                               |
| ----------------- | ---------------------------------------------------------- |
| `quiet-marble`    | Passages, corners, thresholds, and other circulation space |
| `orbital-rings`   | Portrait or celestial focal rooms                          |
| `angular-parquet` | Archive and study rooms                                    |
| `sound-wave`      | Garden and musical rooms                                   |
| `hero-petal`      | One restrained hero tile, rather than every deck           |

Palettes are `neutral`, `garden`, `archive`, and `portrait`. Choose the room's
semantic palette explicitly; seeded variation only adjusts the bounded pattern
inside that choice. Keep connector rooms quiet so listening pads and protected
movement paths remain clear.

Procedural inlays borrow the museum palette and own only their merged geometry.
They must remain below the listening-pad surface and must not create camera or
physics solids. When a platform has authored floor art, the preferred V2 kit
removes only brass and petrol triangles contained in its bounded centre-surface
motif. The outer border, cornice, underside, legacy floors, and platforms
without a floor recipe retain their authored art.
