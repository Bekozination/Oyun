# 🟦 BLOCK BLAST — Puzzle Board Game

## Game Overview

A grid-based puzzle game where the player drags and places shaped blocks onto a 8×8 board. When a full row or column is filled, it clears and awards points. The game ends when no remaining block can fit anywhere on the board. No time pressure — pure strategy and spatial thinking.

---

## Visual Style

- **Theme:** Clean, modern casual puzzle with vibrant block colors
- **Background:** Deep navy or soft dark gradient (#1a1a2e → #16213e)
- **Board:** Slightly lighter dark panel with subtle cell grid lines
- **Blocks:** Solid vivid colors with a soft inner glow and rounded corners (border-radius on each cell)
- **Font:** Rounded, friendly sans-serif (e.g. "Fredoka One" or "Nunito")
- **Animations:** Smooth and satisfying — blocks snap into place, cleared rows flash then dissolve, score pops up with a bounce
- **Color Palette per block shape:** Each shape has its own fixed color (see Block Shapes section)

---

## Board

- **Grid Size:** 8 × 8 cells
- **Cell Size:** Equal square cells, visually separated by thin dark gap lines
- **Empty cells:** Slightly visible dark tile with faint border
- **Occupied cells:** Filled with the block's color + soft inner highlight on top-left corner
- **Board position:** Centered on screen

---

## Block Tray

- At the bottom of the screen, a **tray of 3 blocks** is always shown
- The player must place **one of these 3 blocks** onto the board by dragging
- Once placed, that slot is replaced with a new random block
- **All 3 slots refill simultaneously only when all 3 have been placed**
- The player can choose which of the 3 blocks to place in any order
- Blocks in the tray are displayed at **~60% scale** for preview; they **enlarge to full scale** when picked up (dragged)

### Drag & Drop Mechanic
- Player **taps and holds** a block in the tray to pick it up
- Block follows the finger/cursor, shown at full scale above the finger
- Valid placement positions **highlight in green** as the block hovers over them
- Invalid positions show **no highlight** (block cannot be dropped there)
- If released over an invalid position, the block snaps back to the tray
- **Ghost preview:** A transparent ghost of the block shows exactly where it will land

---

## Block Shapes

All shapes are made of unit cells on a grid. Each has a fixed signature color.

| Shape Name | Layout | Color |
|------------|--------|-------|
| **Single** | `■` (1×1) | Bright White |
| **Domino H** | `■■` (1×2) | Sky Blue |
| **Domino V** | `■` stacked (2×1) | Sky Blue |
| **Trio H** | `■■■` (1×3) | Lime Green |
| **Trio V** | 3 tall column | Lime Green |
| **Quad H** | `■■■■` (1×4) | Yellow |
| **Quad V** | 4 tall column | Yellow |
| **L-Shape** | `■■■` + 1 below-left | Orange |
| **J-Shape** | `■■■` + 1 below-right | Orange |
| **S-Shape** | Offset 2+2 | Red |
| **Z-Shape** | Offset 2+2 mirrored | Red |
| **T-Shape** | `■■■` + 1 below-center | Purple |
| **Square 2×2** | `■■ / ■■` | Magenta |
| **Big L 3×2** | 3 tall + 1 right at bottom | Coral |
| **Big Square 3×3** | Full 3×3 block | Deep Teal |
| **Corner** | 2×2 with one corner missing | Indigo |
| **U-Shape** | 3 wide, center top missing | Gold |
| **Plus (+)** | Cross / plus sign | Cyan |

Shapes are **never rotated** — they always appear in their fixed orientation. The randomization is only in which shapes appear, not their rotation.

---

## Scoring System

### Base Points
- Clearing **1 row or column** = **100 points**
- Clearing **2 simultaneously** = **250 points** (bonus for combo)
- Clearing **3 simultaneously** = **450 points**
- Clearing **4 simultaneously** = **700 points**
- Each additional simultaneous clear beyond 4: **+200 per line**

### Chain Bonus
A **chain** occurs when placing a block causes a clear, and the resulting board state causes another clear (rare but possible with 3-block combos). Each chain level multiplies the score:
- Chain ×2 → score × 1.5
- Chain ×3 → score × 2.0

### Placement Points
- Each block placed (regardless of clear) = **+5 pts** per cell occupied
  - e.g. placing a 3×3 block = +45 pts just for placement

### Score Display
- Current score shown at **top center** in large rounded font
- On a clear, a floating score popup (`+250!`) bounces upward from the cleared area
- **Best Score** shown below current score in smaller text

---

## Clear Animation

When a row or column is completed:
1. All cells in the row/column **flash bright white** simultaneously
2. Cells **shrink and disappear** with a pop effect (scale down + fade)
3. Remaining cells **do NOT fall** — the board is static (no gravity)
4. A **particle burst** of the cleared cells' colors explodes outward
5. Score popup animates upward from the center of the cleared line

If **multiple lines clear at once**, they all flash together and explode simultaneously for a dramatic effect.

---

## Combo & Streak System

### Combo (same placement)
If one block placement clears 2+ lines:
- Screen briefly flashes with a large centered label: `DOUBLE!` / `TRIPLE!` / `MEGA!`
- Extra score multiplier applied (see Scoring)

### Streak (consecutive placements with clears)
If the player clears a line on **consecutive placements** (every block placed causes at least one clear):
- Streak counter appears: `🔥 STREAK x2`, `🔥 STREAK x3` etc.
- Streak bonus: +50 pts × streak level added on top of line clear score
- Streak resets if any placement produces no clear

---

## Game Over Condition

The game ends when **none of the 3 current blocks** in the tray can be placed anywhere on the board.

### Game Over Detection
- After each placement, check all 3 tray blocks against all valid board positions
- If **zero valid positions** exist for all 3 blocks → **Game Over**

### Game Over Screen
- Board dims with a dark overlay
- Large animated text: `GAME OVER`
- Shows:
  - **Final Score** (large)
  - **Best Score** (with crown icon if new record)
  - **Lines Cleared** total stat
  - **Blocks Placed** total stat
  - Two buttons: `🔄 PLAY AGAIN` and `🏠 MENU`
- If new high score: gold confetti particle burst + `NEW BEST!` badge

---

## HUD Layout

```
┌─────────────────────────────────┐
│  BEST: 12400     SCORE: 08750   │
│                                 │
│   ┌─────────────────────────┐   │
│   │                         │   │
│   │       8×8  BOARD        │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                 │
│   [ BLOCK 1 ] [ BLOCK 2 ] [ BLOCK 3 ]  │
└─────────────────────────────────┘
```

- **Top:** Best score (left), current score (right) — or both centered
- **Middle:** The game board
- **Bottom:** Block tray with 3 preview blocks

---

## Hints System (Optional / Assist Mode)

- Player can tap a **lightbulb button** (max 3 uses per game) to receive a hint
- Hint highlights the **best placement** for one of the 3 tray blocks with a pulsing yellow outline on the board
- "Best placement" is defined as the placement that clears the most lines or leaves the most open space

---

## Special Tile: BOMB BLOCK (Rare)

- Has a **~3% chance** to appear in the tray as a special block (any shape)
- Displayed with a dark background and a ⚡ lightning icon overlay
- When placed, it clears the **entire row AND column** it occupies, regardless of whether they're full
- Score for bomb: flat **+300 pts** + normal scoring for any coincidentally completed lines

---

## Special Tile: RAINBOW BLOCK (Very Rare)

- Appears as a **1×1 single cell** with a cycling rainbow color animation
- When placed, it **acts as a wildcard**: it can be placed anywhere, even on an occupied cell (it replaces and destroys the existing block)
- If it completes a line, that line clears normally
- Score: **+50 pts** placement bonus

---

## Difficulty & Randomization

There is **no traditional difficulty level** — the challenge comes naturally from block shapes and board state. However, the randomization is weighted:

| Game Phase | Block Pool Bias |
|------------|----------------|
| Cells filled < 20% | More large shapes (3×3, L, T) |
| Cells filled 20–50% | Mixed shapes |
| Cells filled > 50% | More small shapes (1×1, 1×2, 1×3) to help player clear |
| Cells filled > 75% | Strongly biased toward small and medium shapes |

This prevents frustrating situations where the board is nearly full and only large blocks appear. The game is **never artificially fair** — but the randomizer is slightly compassionate.

---

## Accessibility Options

- **Color-blind mode:** Replaces color differentiation with patterns/icons on each block type
- **Large cell mode:** Board scales up, smaller tray for devices with limited screen space
- **Ghost toggle:** Option to disable ghost preview for harder play

---

## Audio

| Event | Sound |
|-------|-------|
| Block placed | Soft satisfying thud / click |
| Row/column cleared | Rising chime or "whoosh" pop |
| Multi-line clear | Louder satisfying chord |
| Game over | Low descending tone |
| New high score | Upbeat fanfare |
| Bomb activation | Short electric crackle |
| Combo / streak | Escalating musical notes (each combo = higher pitch) |
| BGM | Calm lo-fi or soft ambient loop, non-intrusive |

---

## Technical Notes

- **No timer** — fully turn-based / relaxed pace
- **No undo** — placements are permanent
- **Auto-save** — current board state and score saved automatically after every placement
- **Orientation:** Designed for **portrait** on mobile; landscape supported on desktop
- **Minimum resolution:** 360×640 px (mobile-first)
