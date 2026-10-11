# CLAUDE.md — claude-game-rpg

This file provides guidance for Claude and human developers working on this project.

---

## Project Overview

**claude-game-rpg** is a Dragon Quest-inspired turn-based RPG built with vanilla HTML5 Canvas and JavaScript. No build tools or frameworks required — open `index.html` in a browser to play.

- **Genre:** Classic JRPG / Dark fantasy with moments of levity
- **Style:** Dragon Quest-style turn-based combat, tile-based world exploration
- **Party Members:** Sam (Warrior), Dario (Mage), Sundar (Healer)

---

## Game Design Notes

### World & Setting

- **World name:** Eldrasia (エルドラシア)
- **Regions:** Millhaven Village (starting town), Dark Forest, Crystal Caverns, Demon King's Castle
- **Lore:** The Demon King has awoken and threatens the land. Three heroes must journey north to defeat him.

### Character System

- **Sam (サム)** — Warrior. High HP/ATK/DEF. Skills: Power Slash, Shield Bash, War Cry
- **Dario (ダリオ)** — Mage. High MP/INT. Skills: Fire, Ice Storm, Thunder
- **Sundar (スンダー)** — Healer. Balanced stats. Skills: Heal, Protect, Holy Light
- **Core stats:** HP, MP, ATK, DEF, SPD, INT
- **Leveling:** Experience-based, level cap 50
- **Equipment slots:** Weapon, Armor, Accessory

### Combat Mechanics

- **Style:** Turn-based (Dragon Quest style)
- **Commands:** Attack, Magic, Item, Defend, Run
- **Turn order:** Based on SPD stat
- **Damage formula:** ATK/2 - DEF/4 + random variance
- **Physical skills:** Power Slash (x2.0 ATK, ignores 50% of the target's DEF) and Shield Bash (x1.2, ignores 25%) use the spell field `pierce`. Sam's MP growth is +2/level so he can keep using them.
- **Boss (Demon King) mechanics:**
  - **Forms:** when its HP first drops to 66% and 33% the boss changes form (cinematic + message + SFX); each form raises the chance it uses a skill by 12 points (35% -> 47% -> 59%) and the battle music's intensity.
  - **Telegraphed big attack:** when the boss picks Dark Wave it first spends a turn *charging* (warning banner, violet aura, message "ぼうぎょで 備えよ！"); next round it releases the Dark Wave at 1.5x damage. Party members who chose Defend that round take half of it. Stunning the boss (Shield Bash) while it charges cancels the attack.
  - **Defeat:** after the explosion the screen fades to white with a closing line, then the ending starts.
- **Status effects:** Poison, Stun
  - **Poison (party only, battle-long):** some enemies (Slime 20%, Giant Bat 30%) may poison an unguarded target they hit. A poisoned member loses 1/16 max HP at the end of each round (never below 1 HP). Cleared at the start of the next battle. Cured by the Antidote item (毒消し草) or Sundar's Cure spell (キュア, Lv3).
  - **Stun:** Shield Bash (30% chance) stuns the target enemy; a stunned enemy skips its next action (1 turn). Bosses resist (half the chance), and an already-stunned enemy cannot be re-stunned.
  - **Debuffs:** Weaken (ウィークン, Dario Lv4: one enemy ATK x0.7, 3 turns) and Armor Break (ブレイク, Sundar Lv8: all enemies DEF x0.7, 3 turns) reuse the buff system via `getEffectiveStat`/`tickBuffs`.

### Map ambience

- **Animated tiles:** water ripples and glints, lava glow and bubbles, grass/flowers leaning with a travelling wind, dappled light on trees, breathing violet floor in the castle, a glinting throne gem.
- **Area atmosphere** (overlay under the HUD): *world* — drifting cloud shadows, birds, motes; *Millhaven* — warm sunlight, butterflies, birds; *Dark Forest* — dark green vignette, swaying light shafts, falling leaves, fireflies; *Demon King's Castle* — heavy violet vignette, red pulse, creeping fog, rising embers, occasional lightning with delayed distant thunder.
- **NPC life:** NPCs flagged `wander: radius` in `data.js` (the elder and the traveller) turn and take a step every few seconds within that radius of their home tile, on floor/ground tiles only (never doors, counters or event tiles, never onto the party or another NPC). Shopkeepers and the innkeeper stay put. Talking to an NPC makes it face the party.
- **Area banner:** entering a map shows its name (`name` + `nameEn` in `data.js`) once the screen fade ends.
- **Ambient audio:** quiet looping beds under the BGM per area (breeze; forest wind + crickets; castle drone + howl), crossfaded on map change and off outside exploration, plus occasional distant birds / owl / thunder. `AmbienceSystem.update` schedules the one-shots; `SoundSystem.setAmbience` owns the loops.
- **Code:** `js/ambience.js` (`AmbienceSystem`); `map.js` calls into it from `render`.

### Shops & Inn presentation

- **Shop:** entering plays a door bell and fades in from black. A shopkeeper message window (greeting, price confirmation, "まいどあり！", "おかねが たりないようだ…") and a comparison window sit at the bottom: for equipment, each party member's stat before -> after (green up / red down arrow, "そうび できない" if the class cannot wear it) plus how many the party owns; for consumables, the description and owned count. Buying plays a coin SFX, flies coins from the gold counter to the row, floats "-NG", and counts the gold down. Unaffordable items cannot be selected (denied buzz + shake of the gold counter) and are drawn dim.
- **Inn:** the confirm window shows the current gold and says so when gold is short (denied buzz). Accepting starts a ~8 s night scene (`TownSystem.renderNight`): the heroes sleep while the moon sets and dawn rises (lullaby, dawn chime, birdsong), then the status panel's HP/MP gauges refill (revived members show 復活！) before the morning dialogue. Z skips to the waking moment. The heal is applied and saved when the stay is paid, the animation only replays it.
- **Code:** `js/town.js` (`TownSystem`) draws the info windows, buy effects and the night scene; `main.js` holds the state (`updateShop`, `updateInn`).

### Title & Opening

- **Title:** a night landscape (moon, shooting star, village lights, the Demon King's castle smouldering on a far peak, occasional lightning) with the logo dropping in letter by letter; subtitles and the menu fade in at 2.6 s. Z during that intro skips to the finished title. Choosing はじめから / つづきから plays a start SFX and fades out before `newGame()` / `loadGame()` runs.
- **Opening (new game only):** `state = 'opening'`, ~22 s, Z/X skips (fades out). Four narrated scenes (peaceful village -> the Demon King awakens with storm and thunder -> darkness spreads -> the three heroes rise at dawn), then the village chief's dialogue starts as before. BGM: title theme in scenes 1 and 4, silence plus SFX (rumble/thunder) in between. Loading a save never plays it.
- **Code:** `js/opening.js` (`OpeningSystem`) holds the shared scenery, logo, narration text, sound cues and scene timeline; `main.js` owns the state machine (`updateTitle`, `updateOpening`, `renderOpening`).

### Save / Load

- **Storage:** `localStorage` key `eldrasia_save`, JSON with `version` (currently 2). Party, inventory, equipment, gold, map/position, flags, play time, timestamp.
- **Auto-save:** closing the menu, resting at the inn, after battle wins, leaving the page. **Manual:** the menu's セーブ command (shows a "saved" overlay + SFX).
- **Transient battle fields** (buffs, poison, gauge animation values, ...) are stripped on save; buffs/defending are reset on load.
- **Safe load:** a save that fails structural validation (3 valid party members, known classes, known map) is treated as corrupt: 「つづきから」 stays disabled and the title says so. The data is not deleted.

### Balance

Enemy damage uses `ATK/2 - DEF/4`, so an enemy needs roughly 2x the party's DEF in ATK to hurt; magic ignores most DEF. Enemy stats are therefore much higher than the raw party stats suggest. Targets for the simple "sensible player" policy in `tools/balance-sim.js` (full HP/MP at the start of each fight, no rest between fights inside a run):

| Area | Intended party Lv | HP lost / battle | Wipe | Rounds |
|---|---|---|---|---|
| Grassland | 1-4 | 0-10% | ~0% | 1-2 |
| Dark Forest | 5-8 | 10-20% | <5% | 2-3 |
| Demon's Castle | 9-13 | 25-45% at Lv9, <15% by Lv12 | <30% at Lv9 | 4-6 |
| Demon King | 12-13 | ~65% | ~35-55% (policy defends vs. charges) | 15-22 |

Shops (Millhaven) sell the full equipment set; long lists scroll. Late gear (Flame Sword 1800G, Holy Sword 6000G, Dragon Armor 5000G ...) is the gold sink for the castle (~55G/battle).

Gold per battle is roughly 7 (grass) / 22 (forest) / 55 (castle), enough for one shop upgrade per ~10-25 battles early on.

**Tool:** `node tools/balance-sim.js [runs] [seed]` runs full playthroughs through the real `BattleSystem` (stats per area and per level, boss win rate); add `matrix` as the 3rd argument for an area x level table. Re-run it after touching enemy stats, spells, growth, EXP or shop prices.

Known gaps: level pacing (about 100 battles to Lv16) is not tuned for play time; the party's damage is still Dario-heavy early on (Sam ~43%, Dario ~46%, Sundar ~10% of attack damage overall).

### Progression & Economy

- **Currency:** Gold (G)
- **Shops:** Weapons, Armor, Items in Millhaven
- **Inn:** Full HP/MP restore for gold

---

## Tech Stack

- **Language:** Vanilla JavaScript (ES6+, no modules — loaded via script tags)
- **Rendering:** HTML5 Canvas (640x480, 32px tiles)
- **UI:** Canvas-drawn DQ-style blue windows
- **No build tools required**

---

## How to Play

```bash
# Just open in a browser:
open index.html            # macOS
xdg-open index.html        # Linux
start index.html           # Windows

# Or serve locally:
python3 -m http.server 8000
```

**Controls:**
- Arrow keys: Move / Navigate menus
- Z or Enter: Confirm
- X or Escape: Cancel / Open menu

---

## Architecture

```
/index.html         # Entry point
/css/style.css      # Game styles
/js/data.js         # All game data (characters, enemies, items, maps)
/js/ui.js           # UI rendering (DQ-style windows, menus, text)
/js/map.js          # World map rendering & movement
/js/battle.js       # Turn-based battle system
/js/opening.js      # Title scenery/logo and the new-game opening cinematic
/js/town.js         # Shop info/buy effects and the inn's night scene
/js/ambience.js     # Animated tiles, area atmosphere, wandering NPCs, area banner
/js/main.js         # Game loop, state machine, input handling
```

Script load order matters: data.js → ui.js → sound.js → music.js → map.js → battle.js → opening.js → town.js → ambience.js → main.js

---

## Contributing Guidelines

- Keep game data in `js/data.js`, not hardcoded in logic
- New mechanics should have a design note added to this file before implementation
- Prefer small, focused commits
