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
- **Regions:** Millhaven Village (starting town), Haruka Waystation (a small town on the east road), Dark Forest, Crystal Caverns, Demon King's Castle, the Abyss (post-game)
- **Lore:** The Demon King has awoken and threatens the land. Three heroes must journey north to defeat him.

### Character System

- **Sam (サム)** — Warrior. High HP/ATK/DEF. Skills: Power Slash (Lv1), Sweep (なぎはらい, Lv3), Shield Bash (Lv5), War Cry (Lv10)
- **Dario (ダリオ)** — Mage. High MP/INT. Skills: Fire (Lv1), Weaken (Lv4), Sleep (スリープ, Lv5), Ice Storm (Lv7), Magic Boost (マジックブースト, Lv10), Thunder (Lv12)
- **Sundar (スンダー)** — Healer. Balanced stats. Skills: Heal (Lv1), Light (ライト, Lv2), Cure (Lv3), Protect (Lv6), Armor Break (Lv8), Holy Light (Lv10, was 12)
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
  - **Skill effects:** every party skill has its own effect kind in `BattleSystem.EFFECT_KINDS` (`slash`, `bash`, `sweep`, `light`, ...). Sweep draws a crescent through *each* enemy with a trail and sparks and plays a whoosh (`SoundSystem.sweep`); Light drops a column of light with a ring at the target's feet after a short cast (`PARTY_CAST_DELAY`) and a chime. Skills without a kind show no effect, so new skills need an entry (plus a sound branch if they should not fall back to the generic one).
  - **Zelgios** (post-game boss) has its own sprite (`abyssLord` in `UI.drawEnemy`: wings, spiked crown, pulsing void core, orbiting rune ring); new enemy shapes also need `ATTACK_STYLES` / `EYE_TABLE` entries in `battle.js`.
  - **Defeat:** after the explosion the screen fades to white with a closing line, then the ending starts.
- **Status effects:** Poison, Stun
  - **Poison (party only, battle-long):** some enemies (Slime 20%, Giant Bat 30%) may poison an unguarded target they hit. A poisoned member loses 1/16 max HP at the end of each round (never below 1 HP). Cleared at the start of the next battle. Cured by the Antidote item (毒消し草) or Sundar's Cure spell (キュア, Lv3).
  - **Stun:** Shield Bash (30% chance) stuns the target enemy; a stunned enemy skips its next action (1 turn). Bosses resist (half the chance), and an already-stunned enemy cannot be re-stunned.
  - **Sleep (enemies):** Sleep (スリープ, 8 MP) tries to put every enemy to sleep (50% each, 2 turns); a sleeping enemy skips its actions ("ぐうぐう ねむっている…", then "目を さました！") and a charging boss attack is cancelled. Bosses and enemies that are already asleep or stunned resist ("きかなかった！"). Damage does not wake them. Floating Z's stay over sleepers (`renderSleep`); `enemy.sleepTurns` is battle-only state.
  - **Magic Boost:** raises the whole party's magic damage x1.5 for 3 turns (the `int` buff: `calcSpellDamage` multiplies by `buffs.int.mult`), shown as a 魔 badge next to 攻 / 防 and in the battle music's "boost" state. Tuned to be an option that roughly breaks even in the sim at Lv12 (it costs a turn and 8 MP) and clearly pays off in longer fights.
  - **Debuffs:** Weaken (ウィークン, Dario Lv4: one enemy ATK x0.7, 3 turns) and Armor Break (ブレイク, Sundar Lv8: all enemies DEF x0.7, 3 turns) reuse the buff system via `getEffectiveStat`/`tickBuffs`.

### Map ambience

- **Animated tiles:** water ripples and glints, lava glow and bubbles, grass/flowers leaning with a travelling wind, dappled light on trees, breathing violet floor in the castle, a glinting throne gem.
- **Area atmosphere** (overlay under the HUD): *world* — drifting cloud shadows, birds, motes; *Millhaven* — warm sunlight, butterflies, birds; *Dark Forest* — dark green vignette, swaying light shafts, falling leaves, fireflies; *Demon King's Castle* — heavy violet vignette, red pulse, creeping fog, rising embers, occasional lightning with delayed distant thunder.
- **NPC life:** NPCs flagged `wander: radius` in `data.js` (the elder and the traveller) turn and take a step every few seconds within that radius of their home tile, on floor/ground tiles only (never doors, counters or event tiles, never onto the party or another NPC). Shopkeepers and the innkeeper stay put. Talking to an NPC makes it face the party.
- **Area banner:** entering a map shows its name (`name` + `nameEn` in `data.js`) once the screen fade ends.
- **Ambient audio:** quiet looping beds under the BGM per area (breeze; forest wind + crickets; castle drone + howl), crossfaded on map change and off outside exploration, plus occasional distant birds / owl / thunder. `AmbienceSystem.update` schedules the one-shots; `SoundSystem.setAmbience` owns the loops.
- **Code:** `js/ambience.js` (`AmbienceSystem`); `map.js` calls into it from `render`.

### Settings

- **Options:** BGM / 効果音 / 環境音 volume (0-10 steps; 7 = the original loudness, 10 = ~1.4x, 0 = silent) and 画面のゆれ ON/OFF (battle shake and the encounter zoom-shake). Left/Right adjusts; changing 効果音 / 環境音 plays a sample (BGM is already audible).
- **Where:** title menu (せってい) and the in-game menu (せってい). Opened as an overlay (`game.settings`) over whatever state is running; `update` routes input to it and `render` draws it on top, so the music and ambience keep playing underneath.
- **Storage:** `localStorage` key `eldrasia_settings`, separate from the save so a new game or a corrupt save never resets it.
- **Wiring:** `SettingsSystem.apply()` pushes values into `MusicSystem.setVolume`, `SoundSystem.setSeVolume` and `SoundSystem.setAmbVolume` (the ambient loop retargets live; the one-shot birds/thunder use the ambience factor).
- **Code:** `js/settings.js` (`SettingsSystem`), loaded before `sound.js`.

### Bestiary (ずかん)

- **Where:** the in-game menu's ずかん: a list of all enemies (13 entries; the post-game ones come after the Demon King) and a detail panel with a portrait. Unmet enemies show as ？？？？.
- **Records:** `game.bestiary = { enemyId: { seen, defeated } }`. `seen` goes up once per battle that includes the enemy; `defeated` per enemy killed (counted on a win, not when fleeing or losing). Stored in the save file as `bestiary` without a version bump; saves that lack it load as an empty bestiary (`BestiarySystem.sanitize`).
- **Unlocks:** seen -> portrait, description, habitat (`desc`/`area` in `data.js`); 1 defeat -> HP / EXP / gold; 3 defeats -> ATK / DEF / SPD, poison chance and skills.
- **Announcement:** enemies met for the first time are listed in the win messages ("…を ずかんに とうろくした！").
- **Code:** `js/bestiary.js` (`BestiarySystem`); `battle.js` records on `startBattle`, `main.js` records defeats in `updateScoreAfterBattle` and owns the menu state. New enemies need `desc` and `area`.

### Dash & key config

- **Dash:** hold the dash key (default Shift) while walking: a step every 5 frames instead of 8 (~1.6x) and a shorter glide (70 ms instead of 110). Encounter chance is per step, unchanged, so you meet monsters faster per second but not per tile. Only on the map (dialogue, menus and battles never dash). Settings: ダッシュ ON/OFF and 常時ダッシュ (always dashing; the dash key then walks normally).
- **Touch:** sliding the D-pad thumb out to the dashed outer ring presses the dash key; sliding back releases it.
- **Key config:** the settings screen rebinds *confirm* (default Z), *cancel* (X) and *dash* (Shift): pick the row, press Z/confirm, press the new key (Esc cancels). Movement (arrows, WASD), Enter (confirm) and Esc (cancel) are fixed, so a bad binding can never lock you out; Space also confirms unless bound elsewhere. Reserved keys and keys already used by another action are refused with a message. Letters are stored lower-case.
- **Storage:** in `eldrasia_settings` (`dash`, `autoDash`, `keys`). Old or damaged data falls back per field to the defaults; duplicate bindings are reset.
- **Code:** `SettingsSystem.key(action)` is the single lookup used by `getInput`, `isDashing` (main.js) and the touch buttons (touch.js), so a rebinding applies immediately everywhere.

### Touch controls

- **Detection:** `TouchControls.init` (js/touch.js) turns them on when the device reports touch (`ontouchstart`, `maxTouchPoints`, coarse pointer); `?touch=1` / `?touch=0` in the URL forces them on / off. Desktop play is unchanged.
- **Controls:** a round D-pad (arrows; the dominant axis wins, a dead zone in the middle, slide the thumb to change direction), **A** = Z (confirm) and **B** = X (cancel / open the menu). Tapping the game screen itself also confirms, which is handy for dialogue and battle messages. Buttons buzz briefly where `navigator.vibrate` exists.
- **Wiring:** touches call `inputPress` / `inputRelease` in `main.js`, the same path as keydown/keyup, so every screen (map, menus, shops, battle, settings, ずかん) works with no changes.
- **Layout:** the canvas scales to fit (CSS only; its 640x480 internal size is unchanged). Portrait: controls sit under the screen. Landscape: the screen fills the height and translucent controls float at the lower left/right. Page scroll, pinch zoom and the long-press menu are disabled in touch mode.
- **Code:** `js/touch.js` (`TouchControls`), markup in `index.html` (`#touchControls`), styles at the end of `css/style.css`.

### Post-game (クリア後)

- **Flow:** beating the Demon King sets `demonKingDefeated`, moves the party to the field just outside the castle and **saves** before the ending screen, so 「つづきから」 resumes the post-game world. The ending's Enter still returns to the title.
- **Unlocked:** a new gate on the continent's south-west grass (a gold marker, hidden and inert until the flag is set) leads to the **深淵の迷宮** (`abyss`, 16x16, dark floor and lava). Its encounters are three stronger enemies (亡霊 / 混沌の騎士 / 虚空の魔導師); four chests hold new gear (ドラゴンスレイヤー, 終焉の杖, 深淵のローブ, 深淵の鎧) and revival feathers; at the far end waits the secret boss **終焉の魔神ゼルギオス** (`abyssBossDefeated`).
- **Secret boss:** a `boss` with the Demon King's mechanics (forms at 66% / 33%, telegraphed big attack that Defend halves, self-heal) but its own big skill `終焉の波動` (`bigSkill` on the enemy; default is `enemyDark`) and no ending: the victory gives big EXP / gold, a closing line, and play continues. Boss events may set `ending: false` and `postBattle` lines; `finale: true` (Demon King only) triggers the white fade and the ending.
- **Bestiary:** the new enemies are appended after the Demon King, so the ずかん grows to 13 entries.
- **Balance:** the 深淵 enemies are meant for Lv 14+ (sim policy with shop gear only: wipe ~18% at Lv14, ~5% at Lv18; HP lost per battle 24% -> 12%); the secret boss is ~75% wipe at Lv20 and ~40% at Lv21 *without* the abyss chests (their gear makes it noticeably easier). `UNTIL=24 node tools/balance-sim.js 12 1 matrix` shows the 深淵 / ゼル columns up to Lv24.
- **Code:** data in `js/data.js` (`MAPS.abyss`, enemies, `SPELLS.enemyDoom`, gear); `map.js` `handleEvent` honours `requires`; `battle.js` `afterBossWin` is shared by both win paths; `main.js` stores the cleared state.

### Villager talk

- **Progress-aware lines:** an NPC in `data.js` may carry `talk: [{ flag, lines }, ...]`, listed most advanced first; `MapSystem.npcLines` returns the first entry whose flag is set, else the default `dialogue`. Flags used: `visited_<map>` (set whenever the party goes through a map transfer, so it is saved with the flags; saves from before this simply get them on the next trip), `demonKingDefeated`, `abyssBossDefeated`, chest flags.
- **Who says what:** the village chief and the traveller react to the forest / castle trips, the Demon King's fall (the chief and traveller hint at the new south-west gate) and the secret boss; the shopkeepers greet a clear-game party; the old woman hints at chests; the child (wanders) reacts to the forest and the clears. The innkeeper has a single line.
- **Code:** data in the `millhaven` NPC list; `map.js` (`npcLines`, called from `interact`).

### Haruka Waystation (ハルカ宿場)

- **Where:** `MAPS.haruka` (14x10), entered from the marker at world (18,12), just east of the road to the forest; the exit returns to (18,13). It shares the village's town BGM, ambient bed and sunlit atmosphere (aliases in `getMapBgm`, `updateBgm` and `AmbienceSystem`).
- **Contents:** an inn (30G), the travelling merchant's shop `roadShop` (上薬草, 毒消し草 and three mid-game pieces that fill the gap before the castle gear: 銀の剣 ATK+28 1000G, 銀の杖 ATK+4 INT+20 1100G, ウロコの鎧 DEF+23 800G), two chests (上薬草x2, 素早さの指輪), and three villagers (a travelling entertainer who wanders, a soldier, the merchant) with `talk` lines that follow the party's progress. The traveller in Millhaven hints at the waystation.
- **Balance:** the new gear is only a shop option; the balance sim does not buy it (it is cheaper per stat than the castle gear, so it is a gentle help, not a power spike).
- **Code:** data only (`MAPS.haruka`, `SHOPS.roadShop`, `WEAPONS` / `ARMORS`), plus the three alias lines above.

### Records & achievements (きろく)

- **きろく screen:** the in-game menu's きろく (after ずかん) shows per-save stats on the left (play time, steps, enemies defeated, ずかん species, chests opened of all 14, highest gold, whether the Demon King and Zelgios are down) and the achievement checklist on the right (★ done, ☆ with progress such as 6/9, and each reward).
- **Achievements** (`ACHIEVEMENTS` in `data.js`, granted automatically the first time the condition holds): 5 / 9 species met (上薬草x3 / フェニックスの羽x2), all species met (魔法の聖水x5), 100 enemies defeated (爆裂石x3), every chest opened (フェニックスの羽x3), every non-boss enemy defeated 3 times (達人の指輪: ATK+8 DEF+8 INT+12 SPD+4 HP+30, not sold). Rewards go straight into the bag and a ★ toast announces them (`HintSystem.notice`). All conditions use per-save data (bestiary, chest flags), not the global `gameScore`.
- **Storage:** `game.achieved = { id: true }` in the save (no version bump). A save without it earns whatever it already qualifies for when it is loaded (`RecordsSystem.check` in `loadGame`).
- **When it runs:** after a battle (`BattleSystem.afterWin`), after opening a chest, and on load.
- **Code:** `js/records.js` (`RecordsSystem`), loaded after `hints.js`; adding an achievement is a `data.js` entry (a new `kind` also needs a case in `met` / `progress`).

### Hints & help

- **Help screen:** the in-game menu's ヘルプ (between ずかん and セーブ) shows three pages (そうさ / たたかい / ヒント), switched with Left/Right, closed with cancel. Key names follow the player's bindings (`SettingsSystem.keyName`) and switch to ボタン wording in touch mode.
- **First-time hints:** small toasts (top-left under the area name, ~6.5 s, non-blocking) shown once per situation: `move` (first map frame of a new game), `dash` (40 steps), `rest` (a member at <= 50% HP), `battle`, `poison`, `bestiary` (first new entry), `enter_forest` / `enter_castle` / `enter_abyss`. The toast's clock only runs while the map, a dialogue or a battle is on screen (menus and shops pause it), and a queue shows them one at a time.
- **Storage:** `game.hints = { id: true }` in the save file (no version bump). A save without it (from before this feature) is treated as a veteran: every hint counts as seen (`HintSystem.sanitize`). A new game starts empty.
- **Menu:** `MENU_ITEMS` in `main.js` is the single list; selection works by label, so items can be inserted without renumbering.
- **Code:** `js/hints.js` (`HintSystem`), loaded after `bestiary.js`; triggers call `HintSystem.show(game, id)` from `updateMap`, `BattleSystem.startBattle` / win / poison, and `MapSystem.handleEvent`. New hints need an entry in `TEXT` and `IDS`.

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
| Demon King | 12-13 | ~65% | ~35-55% without chests/items (policy defends vs. charges); ~10-25% with the full kit | 15-22 |

Shops (Millhaven) sell the full equipment set; long lists scroll. Late gear (Flame Sword 1800G, Holy Sword 6000G, Dragon Armor 5000G ...) is the gold sink for the castle (~55G/battle).

Gold per battle is roughly 7 (grass) / 22 (forest) / 55 (castle), enough for one shop upgrade per ~10-25 battles early on.

**Tool:** `node tools/balance-sim.js [runs] [seed]` runs full playthroughs through the real `BattleSystem` (stats per area and per level, boss win rate); add `matrix` as the 3rd argument for an area x level table. Env switches: `FULL=1`, `BOSSLV=n`, `UNTIL=n` (see below). Re-run it after touching enemy stats, spells, growth, EXP or shop prices.

**Full-kit mode:** `FULL=1` makes the sim also open the chests of each area (forest: 魔法の聖水x3, 守りの指輪, 薬草x3, 鉄の剣; castle: 上薬草x3, フェニックスの羽x2, 勇者の指輪, 爆裂石x2), buy and equip rings, prefer 上薬草, revive with a feather and throw 爆裂石 at bosses; `BOSSLV=12` (or 13) stops grinding at that level before the boss, which matches the ~1 hour pacing (without it the sim over-levels to 16). Results at the boss, 60 runs: **without** the kit Lv12 / Lv13 win 21% / 53%; **with** it 78% / 90%. The Demon King's HP is 1300 (was 1200) so that a player who skips chests and items still needs about Lv13, and one who uses them wins comfortably at Lv12-13. Gold at Lv12 is only ~1100G in total, so the late castle gear (1800G+) is realistically a post-game purchase. Post-game with the kit: the 深淵 enemies wipe ~16% at Lv14 / ~6% at Lv16 and the secret boss ~42% at Lv20 (before the abyss chests).

**Roles:** Sweep is a physical all-enemy skill (ATK x1.2, ignores 25% DEF, 5 MP; the `allEnemy` branch now uses the physical formula for physical spells) so Sam can clear groups; Light is a cheap single-target magic attack (power 22, 4 MP) so Sundar helps with damage between heals. With these the sim's attack-damage share moved from Sam 42 / Dario 47 / Sundar 12% to about 34 / 40 / 26%. Fights got easier, so the Demon King's HP was raised 950 -> 1200 to keep the boss odds (~73% wipe at Lv12, ~35% at Lv13 for the sim policy, similar to before).

**Pacing:** the EXP needed for level L is `8 * L^2` (was 12). Target is a full playthrough within about 1 hour: the simulator reaches Lv12 (boss-ready) in roughly 58 battles (was ~85), i.e. ~30 min of fights plus walking and story. Per-level difficulty is unchanged, so the boss odds at a given level are the same; fewer battles also means less gold per level, so buy gear a little more selectively.

**Dario's kit in the sim:** with `FULL=1` the policy also casts Sleep on groups (when none is asleep, MP >= 14) and Magic Boost in boss fights. Castle fights then take about as long as before (wipe ~1%, ~3.5 rounds) and the Demon King odds at Lv12 / Lv13 are ~80% / ~90% (unchanged). Sleep was tuned from 65% / 2 turns / 6 MP (which made the castle trivial) to 50% / 2 turns / 8 MP.

Known gaps: the party's damage is still Dario-heavy early on (Sam ~43%, Dario ~46%, Sundar ~10% of attack damage overall).

### Progression & Economy

- **Currency:** Gold (G)
- **Shops:** Weapons, Armor, Items in Millhaven
- **Inn:** Full HP/MP restore for gold
- **Items:** 薬草 (HP35) / 上薬草 (HP100, 45G) / 魔法の水 (MP20) / 魔法の聖水 (MP60, 90G) / 毒消し草 / フェニックスの羽 / 爆弾石 (35 dmg) / 爆裂石 (90 dmg, 150G). An item may set `fx` to borrow another item's battle visuals and sound (上薬草 -> herb, 魔法の聖水 -> magicWater, 爆裂石 -> bomb), so new items of the existing types (`heal`, `healMp`, `cure`, `revive`, `damage`) are data-only.
- **Accessories:** the 防具屋 sells 力 / 魔力 / 素早さ / 命 plus 守り (DEF+8, 600G) / 賢者 (INT+12, 1400G) / 勇者 (ATK+9 DEF+5, 1500G) rings. Chests may give accessories (`itemType: 'accessory'`).
- **Chests:** besides the forest's two: the north dark area of the continent (魔法の聖水x3, 守りの指輪) and the castle (上薬草x3, フェニックスの羽x2, 勇者の指輪, 爆裂石x2). Opened by stepping on them; the flag is saved.

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
- Shift (hold): Dash on the map
- All three of Z / X / Shift can be rebound in せってい
- Touch devices: on-screen D-pad plus A (confirm) / B (cancel, menu) buttons appear automatically

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
/js/settings.js     # Player options (volumes, shake) and their panel
/js/bestiary.js     # Monster encyclopedia records and screen
/js/hints.js        # First-time hint toasts and the menu's help screen
/js/records.js      # Achievements (rewards) and the records screen
/js/touch.js        # On-screen D-pad and A/B buttons for touch devices
/js/main.js         # Game loop, state machine, input handling
```

Script load order matters: data.js → ui.js → settings.js → sound.js → music.js → map.js → battle.js → opening.js → town.js → ambience.js → bestiary.js → hints.js → records.js → touch.js → main.js

---

## Contributing Guidelines

- Keep game data in `js/data.js`, not hardcoded in logic
- New mechanics should have a design note added to this file before implementation
- Prefer small, focused commits
