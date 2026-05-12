# MercuryPitch Characters & Moods

A set of unique characters designed to connect with different singing styles and motivate users through streaks, goals, and real-time feedback.

## Meet the Characters

### 🔥 Blaze (Belting Specialist)
- **Voice Style:** Powerful, energetic, and high-intensity belting.
- **Visual Style:** Sharp, fiery, and bold. Uses the app's orange/red palette (`#db6d28` to `#f85149`).
- **Best For:** High-energy goals, power-based exercises, and long-term intensity streaks.

### ✨ Aria (Falsetto Specialist)
- **Voice Style:** Light, airy, ethereal head voice and falsetto.
- **Visual Style:** Soft, cloud-like, and serene. Uses the app's purple/teal palette (`#bc8cff` to `#2dd4bf`).
- **Best For:** Agility in high registers, delicate melodies, and "serene" practice sessions.

### 🌊 Flux (Mixed Voice & Runs Specialist)
- **Voice Style:** Fluid, sleek, and versatile mixed voice and vocal runs.
- **Visual Style:** Wave-like, dynamic, and focused. Uses the app's core blue/green palette (`#58a6ff` to `#3fb950`).
- **Best For:** Vocal agility, technical runs, and overall accuracy goals.

## Moods & Usage

Each character comes with 4 moods to reflect the user's progress:

| Mood | Purpose |
|------|---------|
| `idle` | Neutral state, waiting for the user to start. |
| `focused` | Real-time feedback during singing (active tracking). |
| `encouraging` | Motivation when close to a goal or after a minor setback. |
| `happy` | Celebrating a reached goal, a new high score, or a daily streak. |

## Implementation Guide

The assets are located in `/public/characters/` as SVGs. You can use them in your components like this:

```tsx
const CharacterDisplay = (props) => {
  const imageUrl = `characters/${props.name}_${props.mood}.svg`;
  
  return (
    <div class="character-container">
      <img src={imageUrl} alt={`${props.name} in ${props.mood} mood`} />
    </div>
  );
};
```

### Suggested Mappings
- **Daily Streak:** Show `happy` mood of the user's favorite character.
- **Pitch Accuracy > 90%:** Show `focused` mood.
- **Failed a difficult run:** Show `encouraging` mood.
- **Vocal Style Detection:** Automatically switch characters based on the detected register (e.g., switch to Blaze when belting is detected).
