# 🔫 NEON SIEGE — Top-Down Retro Shooter

## Game Overview

A top-down retro-style arcade shooter. The player controls a lone soldier in the center of a neon-lit arena. Enemies approach from all directions in escalating waves. Survive as long as possible, rack up a high score, and unleash powerful abilities to turn the tide.

---

## Visual Style

- **Theme:** Retro pixel-art / neon synthwave aesthetic
- **Background:** Dark tiled floor with subtle scanline overlay and a soft grid glow effect
- **Color Palette:** Deep black background, electric cyan and magenta neon accents, bright yellow bullet trails
- **Font:** Pixel/monospace font for all UI text (e.g. "Press Start 2P" style)
- **Camera:** Fixed overhead view, player always centered
- **Screen shake:** Brief screen shake when the player takes damage

---

## Controls

| Input | Action |
|-------|--------|
| `W` | Move Up |
| `A` | Move Left |
| `S` | Move Down |
| `D` | Move Right |
| **Mouse cursor** | Aim direction (player always rotates to face the cursor) |
| **Left Mouse Button** | Shoot |
| `SHIFT` | Dash (short-range quick dash in movement direction, 2s cooldown) |
| `E` | Activate Special Ability (once per wave, see below) |

Movement is 8-directional. The player can move and aim independently (twin-stick style with keyboard + mouse).

---

## Player Character

- **Sprite:** Small top-down soldier/mech with a rotating gun barrel that always points toward the mouse cursor
- **Move Speed:** 180 px/s (base)
- **Max Health:** 100 HP
- **Fire Rate:** 8 bullets per second (base)
- **Bullet Speed:** 600 px/s
- **Bullet Damage:** 10 per hit
- **Dash:** Instantly travels 120px in the movement direction; invincible during dash frames; 2-second cooldown

### Special Ability — "OVERCHARGE"
Once per wave, press `E` to activate **Overcharge**:
- Player fires in all 12 directions simultaneously
- Fire rate triples for 3 seconds
- Player glows bright white during effect
- Recharges at the end of each wave (shows as a glowing ring around the player when ready)

---

## HUD (Heads-Up Display)

### Top-Left
- **Health Bar:** Red filled bar with "HP" label, shows current / max HP numerically (e.g. `HP: 75 / 100`)
- **Bar decreases smoothly** when taking damage

### Top-Center
- **Wave Number:** Large pixel text — `WAVE 3`
- **Wave countdown timer:** Counts down seconds until next wave starts (e.g. `Next wave in: 5s`)

### Top-Right
- **Score:** Pixel text — `SCORE: 04200`
- **High Score** shown below in smaller text — `BEST: 12500`

### Bottom-Center (when available)
- **Overcharge indicator:** Glowing icon that pulses when ready, greyed out with cooldown ring when used

---

## Enemy Types

### 1. 🔴 GRUNT
- Basic enemy. Walks straight toward the player.
- HP: 20 | Speed: 70 px/s | Damage on contact: 10
- Score value: 10 pts
- Spawns: From all 4 screen edges

### 2. 🟠 RUSHER
- Fast and fragile. Zigzags unpredictably toward the player.
- HP: 10 | Speed: 160 px/s | Damage on contact: 15
- Score value: 20 pts
- Spawns: Starting from Wave 3

### 3. 🟡 TANK
- Slow but very durable. Walks directly at the player.
- HP: 80 | Speed: 40 px/s | Damage on contact: 25
- Score value: 50 pts
- Spawns: Starting from Wave 4

### 4. 🟣 SHOOTER
- Stops at medium range and fires slow projectiles at the player (1 shot/2s).
- HP: 30 | Speed: 55 px/s | Projectile damage: 12 | Projectile speed: 220 px/s
- Score value: 40 pts
- Spawns: Starting from Wave 5

### 5. 💀 BOSS — BEHEMOTH *(every 5 waves)*
- Massive enemy that takes up 3x the tile space.
- HP: 500 (Wave 5) → increases by 200 per subsequent boss encounter
- Alternates between two attacks:
  - **Charge:** Rushes at the player at 250 px/s for 1.5s, then slows
  - **Spread Shot:** Fires 8 projectiles in a radial burst every 4 seconds
- Damage on contact: 40 | Projectile damage: 20
- Score value: 500 pts
- Has a dedicated HP bar displayed at the **bottom of the screen** during boss fight

---

## Wave System

Waves start after a **5-second countdown** displayed on screen center (`GET READY!`).

Between waves:
- **3-second break** with wave-clear animation (`WAVE CLEARED! +BONUS`)
- **Overcharge ability recharges**
- A **bonus score** is awarded based on remaining HP: `+HP × 2`

### Wave Difficulty Scaling

| Wave | Enemy Count | Enemy Types | Notes |
|------|------------|-------------|-------|
| 1 | 6 | Grunt | Tutorial feel, slow pace |
| 2 | 10 | Grunt | More enemies, slight speed boost |
| 3 | 12 | Grunt + Rusher | Rushers introduced |
| 4 | 14 | Grunt + Rusher + Tank | Tanks introduced |
| 5 | 16 | All types | **BOSS** appears after clearing |
| 6+ | +3 per wave | All types | Enemies get +5% speed & +10% HP per wave |
| 10 | 25 | All types | **BOSS** (stronger version) |
| Every 5 waves | — | — | Boss fight with scaling HP |

**Enemy spawn rate:** Enemies spawn in small groups of 2-3 every 1.5 seconds from random edge positions, not all at once.

**Speed cap:** Enemy speed never exceeds 220 px/s for grunts (rushers cap at 280 px/s).

---

## Power-Ups (Random Drops)

When an enemy is killed, there is a **15% chance** to drop a power-up. Power-ups glow and pulse on the ground. Player collects by walking over them.

| Icon | Power-Up | Effect | Duration |
|------|----------|--------|----------|
| ❤️ | **MED KIT** | Restores 30 HP | Instant |
| ⚡ | **RAPID FIRE** | Doubles fire rate | 8 seconds |
| 🛡️ | **SHIELD** | Absorbs next 40 damage | Until depleted |
| 💥 | **NUKE** | Destroys all on-screen enemies instantly | Instant |
| 🔵 | **FREEZE** | Slows all enemies to 20% speed | 5 seconds |

Power-ups despawn after 8 seconds if not collected. A gentle pulsing ring indicates their remaining lifetime.

---

## Juice & Game Feel Details

- **Hit flash:** Enemies briefly flash white when shot
- **Death animation:** Enemies explode in a small pixel particle burst matching their color
- **Bullet trails:** Thin glowing lines follow each bullet
- **Muzzle flash:** Small flash at gun barrel tip on each shot
- **Screen edge vignette:** Darkened edges for atmospheric depth
- **Low HP warning:** When player HP drops below 25, health bar pulses red and a heartbeat sound plays
- **Wave transition:** Brief full-screen flash + wave number announcement in center screen
- **Combo counter:** Killing 5+ enemies without taking damage triggers a "COMBO x5!" notice with score multiplier (×1.5)

---

## Game Over Screen

- Displayed on a dark overlay when HP reaches 0
- Shows:
  - `GAME OVER` in large glowing pixel text
  - Final Score
  - Wave Reached
  - High Score (updates if beaten)
  - `[PRESS ENTER TO RETRY]`

---

## Audio (Optional Enhancement)

- **BGM:** Synthwave / retro chiptune looping track that increases in intensity every 5 waves
- **SFX:**
  - Gunshot: short sharp crack
  - Enemy death: small pixel crunch
  - Player hit: low thud + brief static
  - Power-up collect: ascending chime
  - Wave start: dramatic stinger
  - Boss arrival: heavy bass drop intro

---

## Arena

- Fixed size arena: **1280 × 720** pixels
- Enemies **spawn from outside screen edges** and walk inward
- **No walls or obstacles** (open arena) — pure movement skill test
- Subtle **neon grid floor pattern** as background
- **Screen boundary:** Player cannot leave the arena (soft clamp at edges)
