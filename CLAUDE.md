# CLAUDE.md — claude-game-rpg

This file provides guidance for Claude and human developers working on this project.

---

## Project Overview

**claude-game-rpg** is a role-playing game (RPG) project. The game aims for a classic RPG experience with a handcrafted world, deep character customization, and meaningful player choices. Tone: dark-fantasy with moments of levity.

---

## Game Design Notes

### World & Setting

- **Genre:** Dark fantasy
- **World name:** TBD
- **Regions:** TBD (e.g. starting town, dungeon zones, wilderness, capital city)
- **Factions:** TBD (e.g. guilds, kingdoms, cults)
- **Lore principles:**
  - History should feel lived-in, not info-dumped
  - NPCs have motivations independent of the player
  - Environmental storytelling preferred over cutscenes

### Character System

- **Classes:** TBD (e.g. Warrior, Mage, Rogue, Cleric)
- **Core stats:** Strength, Dexterity, Intelligence, Vitality, Luck (names TBD)
- **Leveling:** Experience-based, level cap TBD
- **Equipment slots:** Head, Body, Hands, Legs, Feet, Main-hand, Off-hand, Accessory x2
- **Design principles:**
  - Every class should have a viable solo playstyle
  - Avoid mandatory "meta" builds — balance through variety
  - Skill trees over stat bloat

### Combat Mechanics

- **Style:** TBD (turn-based / real-time / hybrid)
- **Core loop:** Player action → enemy reaction → status resolution
- **Status effects:** TBD (e.g. Burn, Freeze, Stun, Bleed, Poison)
- **Skills:** Active (MP/stamina cost) and passive
- **Design principles:**
  - Combat should be learnable but not trivial
  - Enemy AI should feel intentional, not random
  - Death is a setback, not a game-over (checkpoint system TBD)

### Progression & Economy

- **XP sources:** Combat, quests, exploration, crafting
- **Currency:** TBD (e.g. gold coins, shards)
- **Loot tiers:** Common → Uncommon → Rare → Legendary
- **Crafting:** TBD (material gathering + recipe system)
- **Design principles:**
  - Reward exploration as generously as combat
  - Avoid pay-to-win or artificial grind walls
  - Let players specialize — jack-of-all-trades should be a valid but harder path

### Narrative & Quests

- **Main quest:** TBD
- **Side quests:** Should feel like self-contained stories, not fetch tasks
- **Dialogue system:** TBD (branching choices with consequence tracking)
- **Narrative principles:**
  - Player choices should have visible consequences
  - Avoid purely good/evil binary morality
  - Companions (if any) have their own arcs and can disagree with the player

---

## Tech Stack

> **To be decided.** Update this section once a language and framework are chosen.

Candidates to evaluate:
- **JavaScript/TypeScript** — Phaser 3, PixiJS, or custom canvas engine (browser-based)
- **Python** — Pygame or terminal-based (curses)
- **Other** — Godot (GDScript/C#), Unity (C#)

---

## Development Commands

> **To be filled in** once the tech stack is selected.

```
# Example placeholders — replace with real commands
npm install       # Install dependencies
npm run dev       # Start development server
npm test          # Run tests
npm run build     # Production build
```

---

## Architecture Notes

> **To be defined** as the codebase grows. Suggested top-level layout:

```
/src
  /core        # Game loop, engine abstractions
  /scenes      # Game screens (main menu, world map, battle, etc.)
  /entities    # Player, enemies, NPCs
  /systems     # Combat, inventory, dialogue, save/load
  /data        # Static game data (items, skills, enemies)
  /ui          # HUD, menus, dialogue boxes
/assets
  /sprites
  /audio
  /maps
/tests
```

---

## Contributing Guidelines

- Keep game data (stats, items, dialogue) in data files, not hardcoded in logic
- New mechanics should have a design note added to this file before implementation
- Prefer small, focused commits over large sweeping changes
- Name branches: `feature/<short-description>`, `fix/<short-description>`
