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
- **Status effects:** Poison, Stun

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
/js/main.js         # Game loop, state machine, input handling
```

Script load order matters: data.js → ui.js → map.js → battle.js → main.js

---

## Contributing Guidelines

- Keep game data in `js/data.js`, not hardcoded in logic
- New mechanics should have a design note added to this file before implementation
- Prefer small, focused commits
