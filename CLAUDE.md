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
- **Regions:** Millhaven Village (starting town), Haruka Waystation (a small town on the east road), Dark Forest, Crystal Caverns (optional mid-game dungeon), Demon King's Castle, the Abyss (post-game)
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

### Limit skills (ひっさつわざ)

- **What:** each party member has a *limit gauge* (0-100) that fills during a battle and, once full, unlocks one signature skill for that member. It is meant for the long fights (bosses and the arena's last rounds): an ordinary 3-5 round fight never fills it.
- **Gauge:** `member.limit`, battle-only (reset to 0 and `hpMark` set at `startBattle`, never saved). At the end of each round (`chargeLimit`) every living member gains `2 + 0.4 x (HP lost since the round began, as a % of max HP)`, capped at 100; poison counts as lost HP. Using the skill empties the gauge. A "ひっさつ ゲージが たまった！" message, a chime and the first-time hint `limit` announce a full gauge. A thin gold bar under each member's name shows it (clear of the buff badges) and pulses with 「ひっさつ」 when full; the poison tag 毒 then sits beside that label instead of being hidden.
- **Using it:** when the gauge is full the member's じゅもん list gets one extra top entry, marked ★ and costing 0 MP (the command menu's じゅもん also gets a ★). It then runs through the ordinary spell pipeline (`SPELLS`, `executeSpell`, `EFFECT_KINDS`) with an extra cut-in: a dark band with the skill's name sweeps across the top while the usual cast circle charges (+650 ms) before the effect lands.
- **The three skills** (`limit: true` spells in `data.js`, the id is `CHARACTERS[id].limit`): サム **ブレイブエッジ** (physical, one enemy, power 4.0, ignores 80% of DEF, effect `slash`), ダリオ **メテオフォール** (magic, all enemies, power 100, effect `fire`), スンダー **いのりのひかり** (`limitHeal`: heals the whole party for 30% of max HP, revives the fallen with 25% HP and cures poison, effect `holy`).
- **Menus:** the じゅもん list now scrolls (6 rows) like the どうぐ list, because Dario's seven entries (six spells + the limit skill) would have run off the bottom of the screen.
- **Numbers:** the gain above is the second draft (the first, 4 + 0.8 with stronger skills, took the Demon King to 100% wins); サム ブレイブエッジ is about 2x パワースラッシュ, メテオフォール's power 100 hits every enemy (サンダー is 48 on one).
- **Balance** (`tools/balance-sim.js`: the policy uses a full gauge, Sam on the strongest target, Dario when two or more enemies or a boss are up, Sundar when HP is low or someone has fallen; `NOLIMIT=1` switches the skills off, `LIMITONLY=sam|dario|sundar` allows only one, `LIMITLOG=1` counts the casts): in the Demon King fight each member gets about 0.4-0.8 limit skills. With the skills on and the old boss HP the win rate at Lv12 with the full kit went from 75% to 97% (each skill alone is worth about +12 to +18 points), so the bosses got more HP to keep their odds: **魔王ヴァルザード 1300 -> 1550** (kit Lv12 79%; 1600 once the combos came in, see Combo skills, no kit Lv12 / Lv13 19% / 57%, i.e. the old 78% / 21% / 53%), **クリスタルガーディアン 560 -> 700** (Lv7 / Lv8 / Lv9 wipe 66% / 34% / 8%) and **ゼルギオス 2400 -> 3000** (Lv20 / Lv21 wipe 78% / 40%). Ordinary fights and the arena are unchanged: 3-5 rounds rarely fill the gauge.
- **Tests:** the smoke test's `[limit skills]` section checks the gauge, the list, the three skills, that nothing is saved and that the list scrolls.
- **Combos** build on this gauge: see Combo skills below. The sim policy casts combos too, so the numbers above already include them (and the Demon King's odds are the same with `NOCOMBO=1`).
- **Code:** data in `js/data.js`; `battle.js` (`startBattle`, `chargeLimit`, `getAvailableSpells`, `executeSpell`), `battle-render.js` (gauge, ★ labels, scrolling list), `battle-fx.js` (cut-in), `sound.js` (`limitReady`, `limitCut`), `hints.js` (`limit`).

### Combo skills (れんけいわざ)

- **What:** when two members' limit gauges are both at `COMBO_GAUGE` (90, `data.js`) or more, the one who comes first in the party order can use a *combo skill* that spends both gauges. A single limit skill still needs a full gauge (100), so the combo is available a little earlier: the panel draws a white tick at 90% on the bar and shows 「れんけい」 in light blue when the member and a partner are both past it. It tops that member's じゅもん list marked ★★ (0 MP), above the single limit skill. The partner's turn is used up (they simply defend that round), so a combo is a choice between two limit skills and one bigger spike.
- **The three combos** (`COMBOS` and the `combo: true` spells in `data.js`): サム + ダリオ **ほのおのつるぎ** (one enemy, `fire`; damage = 200 + 3.0 x (Sam's ATK + Dario's INT), about 700 at Lv12, over twice the two single skills together), ダリオ + スンダー **せいなるりゅうせい** (every enemy, `holy`; 150 + 1.5 x (both INT), about 390 at Lv12, and the party regains 20% HP), サム + スンダー **まもりのちかい** (`holy`: the party heals 40%, the fallen rise at 35%, poison is cured, DEF x1.4 and ATK x1.25 for 3 turns).
- **Rules:** the caster is the lower party index of the pair, so the combo is offered only on that member's turn and the partner is skipped in the command order (`b.comboSkip`, reset each round). If either is dead or has lost the gauge by the time it executes, it fizzles ("れんけいは しっぱいした…") and nothing is spent. The cut-in shows both names. A first-time hint `combo` and a message announce when a pair becomes ready.
- **Balance** (`FULL=1 BOSSLV=12 node tools/balance-sim.js 40 1`; the sim policy casts a combo whenever a pair is ready and the situation fits: Sam + Dario always, Dario + Sundar against two or more enemies or a boss, Sam + Sundar when someone is hurt or down; `NOCOMBO=1` turns it off, `NOHOLD=1` stops it from waiting for a partner, `COMBOLOG=1` counts the casts): with both gauges required to be *full*, a combo happened only about 0.19 times per Demon King fight (the sim even waits up to 4 rounds for a partner who is at least half full, which only reached about 0.28), so the threshold was lowered: at 100 the sim got ~0.19 combos per fight, at 90 ~0.5, at 80 ~0.77 and at 70 ~0.93 (the Demon King's win rate rising 81% -> 83% / 88% / 90%). **90** was kept, and the Demon King's HP went **1550 -> 1600** to bring the kit Lv12 win rate back to 80% (no kit Lv12 / Lv13 24% / 51%; 番人 Lv7 / 8 / 9 wipe 63% / 33% / 8%; ゼルギオス Lv20 / 21 wipe 75% / 34%). A "resonance" (a full gauge pulling the partner's along) was tried and removed: it added almost nothing.
- **Code:** data in `js/data.js`; `battle.js` (`getAvailableSpells(char, game)`, `nextCharCommand`, `skipDeadChars`, `executeSpell`, `chargeLimit`), `battle-render.js` (list labels), `hints.js` (`combo`), `tools/balance-sim.js` (`NOCOMBO=1`, `COMBOLOG=1`).

### Battle screen & error guard

- **Message window vs. command menu:** the bottom message window (80 px) used to stay on screen with the previous turn's lines while the command menu was open, covering its lower rows (ぼうぎょ / にげる) in every battle, including the first turn of a boss fight right after the dialogue. In the menu phases (`command`, `spellSelect`, `itemSelect`, `allyTarget`) it now only shows while `messageTimer > 0` (short feedback such as 「MPが 足りない！」 and the encounter banner); in every other phase it shows as before.
- **Item list:** the battle's どうぐ list shows at most 6 kinds at a time and scrolls with the cursor (▲ / ▼ mark more above / below). Before, 8 or more kinds (easy to reach with chests, requests and rewards) ran off the bottom of the screen, so the cursor vanished in long boss fights.
- **Message window:** `UI.drawMessageWindow` wraps long lines at the window edge and grows (up to `MSG_MAX_LINES` = 6 lines) instead of dropping lines. It used to draw only the first 3, so a boss win (defeat line + EXP + gold + new ずかん entries) lost its gold / ずかん lines and a long ずかん line ran off the screen.
- **Hint toasts in battle:** only the fighting hints (`battle`, `poison`, `bestiary`) show during a battle, and none during the win / level-up / lose phases (they used to sit over the VICTORY banner, and walking hints such as `move` / `dash` lingered over a fight). Hidden toasts wait, their timer paused, and appear on the map.
- **Screen edges:** a full audit (every text and window against the 640x480 canvas, over every battle group and phase, the map HUD, the menus, shops and dialogues) found two real problems, both fixed. (1) The map HUD's party window put the MP value 202 px into a 234 px window, so from 2-digit MP on (Dario's MP is 20 at Lv1) it ran off the right edge on every map; it now has 260 px at x = 376 and a tighter layout (`UI.drawCharStatus` compact), which still fits 999 / 999 and 199 / 199. The hint toast is as wide as its longest line (it used to be a fixed 400 px that would overlap the wider HUD). (2) The equipment picker (メニュー > そうび > a slot) was a 100 px box with three visible rows, so the fourth item in the bag ran off the screen; it is now a tall window with a scrolling list (8 rows, ▲ / ▼).
- **Test:** the smoke test's `[screen edges]` section renders about 1,200 frames (the map HUD at its largest values, every encounter group, the three bosses and every arena round in every phase, all shops, the equipment picker with 12 items, every dialogue, chest message, boss line and request line) and fails if any text or window leaves the canvas. The slide-in battle banners, which start off screen on purpose, are skipped.
- **Error guard:** `gameLoop` wraps `update` / `render` in a try / catch. An exception used to end the loop for good (a frozen, half-drawn screen that never advanced). `reportGameError` now logs it, resets the canvas state and shows the state, message and location in a strip at the bottom, while the loop keeps running, so the next frame can recover and the message can be reported. `lastGameError` holds the latest one.
- **Clock:** the battle-start iris wipe clamps its radius at 0 (a negative `arc` radius throws if the clock ever steps back).
- **Test:** the smoke test's `[battle screen and error guard]` section checks the message window in each case and that a throwing frame still schedules the next one.

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

- **Where:** the in-game menu's ずかん: a list of all enemies (18 entries; the post-game ones come after the Demon King) and a detail panel with a portrait. Unmet enemies show as ？？？？.
- **Records:** `game.bestiary = { enemyId: { seen, defeated } }`. `seen` goes up once per battle that includes the enemy; `defeated` per enemy killed (counted on a win, not when fleeing or losing). Stored in the save file as `bestiary` without a version bump; saves that lack it load as an empty bestiary (`BestiarySystem.sanitize`).
- **Unlocks:** seen -> portrait, description, habitat (`desc`/`area` in `data.js`); 1 defeat -> HP / EXP / gold; 3 defeats -> ATK / DEF / SPD, poison chance and skills.
- **Announcement:** enemies met for the first time are listed in the win messages ("…を ずかんに とうろくした！").
- **Code:** `js/bestiary.js` (`BestiarySystem`); `battle.js` records on `startBattle`, `save.js` records defeats in `updateScoreAfterBattle` and `main.js` / `menu.js` own the menu state. New enemies need `desc` and `area`.

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
- **Bestiary:** the new enemies are appended after the Demon King, so the ずかん ends at 18 entries (the post-game ones come last; the 18th is the Tower of the Abyss' ヴァルザードの幻影).
- **Balance:** the 深淵 enemies are meant for Lv 14+ (sim policy with shop gear only: wipe ~18% at Lv14, ~5% at Lv18; HP lost per battle 24% -> 12%); the secret boss is ~75% wipe at Lv20 and ~40% at Lv21 *without* the abyss chests (their gear makes it noticeably easier). `UNTIL=24 node tools/balance-sim.js 12 1 matrix` shows the 深淵 / ゼル columns up to Lv24.
- **Code:** data in `js/data.js` (`MAPS.abyss`, enemies, `SPELLS.enemyDoom`, gear); `map.js` `handleEvent` honours `requires`; `battle.js` `afterBossWin` is shared by both win paths; `main.js` stores the cleared state.

### Villager talk

- **Progress-aware lines:** an NPC in `data.js` may carry `talk: [{ flag, lines }, ...]`, listed most advanced first; `MapSystem.npcLines` returns the first entry whose flag is set, else the default `dialogue`. Flags used: `visited_<map>` (set whenever the party goes through a map transfer, so it is saved with the flags; saves from before this simply get them on the next trip), `demonKingDefeated`, `abyssBossDefeated`, chest flags.
- **Who says what:** the village chief and the traveller react to the forest / castle trips, the Demon King's fall (the chief and traveller hint at the new south-west gate) and the secret boss; the shopkeepers greet a clear-game party; the old woman hints at chests; the child (wanders) reacts to the forest and the clears. The chief, the traveller, the old woman, the child and Haruka's soldier also give requests (see Requests): while a request is on offer or active they speak its lines instead of their `talk` lines. The innkeeper has a single line.
- **Code:** data in the `millhaven` NPC list; `map.js` (`npcLines`, called from `interact`).

### Map music

- **Tracks** (`js/music.js`, all generated from oscillators): `title`, `town` (Millhaven and its shops), `waystation` (Haruka), `field` (world, forest, castle), `crystal` (Crystal Caverns), `abyss`, `boss`, `battle`, and the one-shot `victory` / `defeat`. `getMapBgm` in `main.js` maps a map id to its track.
- **ハルカ宿場** (`waystation`): 84 BPM, G major, an easy travelling tune on the square lead with a plain bass, no drums, so it sits between the village's tune and the field's.
- **水晶の洞窟** (`crystal`): 76 BPM, C major / A minor, a clear arpeggiated tune on a triangle lead (`lead: 'triangle'`) with a soft octave-below doubling and a plain bass, no drums. Like the other tunes it has not been heard by anyone.
- **深淵の迷宮** (`abyss`): 70 BPM, D minor with a flat fifth (A♭), a slow low lead on a sawtooth (`lead: 'sawtooth'`, `leadVol`) doubled a fourth below, a bass pedal on D, and a kick on every beat as a heartbeat (`drums: 'kick'`).
- **Track fields:** `bpm`, `melody`, `bass` (lists of `[freq, beats]`, equal total beats so the loop is seamless), optional `harmony` (ratio of a second voice), `drums` (`kick` / `rock` / `boss`), `arp` (danger layer), `lead` / `leadVol` (melody waveform and volume, default square / 0.14), `once`.
- **Not verified by ear:** the tunes were written and checked as data (loop lengths, the scheduler running, the right track chosen per map) but nobody has listened to them; tempo, volume balance and taste are open to feedback.
- **Test:** the smoke test's `[music]` section checks that every looping track has equal melody / bass beats (`MusicSystem.trackInfo`), the map-to-track choice, and that the new tracks start.

### Crystal Caverns (水晶の洞窟)

- **What:** an optional mid-game dungeon between the forest and the castle (intended party Lv 7-10) with its own enemies, a mini-boss and gear that helps before the Demon King. Nothing gates it; the party can skip it entirely.
- **Where:** `MAPS.crystalCave` (18x16), entered from the marker at world (21,13) (east of the road to Haruka); the exit returns to (21,14). New tiles: `Y` crystal floor (walkable, random encounters, table `crystal`), `Z` crystal wall and `K` crystal cluster (both solid). Glints on `Y` / `K` come from `AmbienceSystem.tileAnim`.
- **Enemies** (all in the ずかん, listed between スケルトン and ダークナイト): クリスタルスライム (high DEF, magic is the answer), クリスタルバット, クリスタルゴーレム (slow, hard-hitting, very high DEF; a new `golem` sprite) and the mini-boss **クリスタルガーディアン** (`boss` with the Demon King's mechanics: forms at 66% / 33%, a telegraphed big attack `enemyCrystal` that Defend halves, self-heal; no ending, `ending: false`; flag `crystalGuardianDefeated`).
- **Treasure:** four chests on the way (魔法の聖水x2, 上薬草x3, 水晶の指輪, 水晶のローブ) and two in the room behind the guardian (水晶の剣, 水晶の鎧). The gear (水晶の剣 ATK+25, 水晶の鎧 DEF+21, 水晶のローブ DEF+8 INT+8, 水晶の指輪 DEF+3 INT+5 HP+10) sits between the shop's mid-tier pieces (鋼の剣 22 / 銀の剣 28, 鎖帷子 18 / ウロコの鎧 23) and is not sold, so it never changes the gold economy; it is a help, not a replacement for buying (see Balance).
- **Presentation:** its own BGM `crystal` (a bright, slow arpeggiated tune with a chiming lead), a blue vignette with drifting sparkles, no ambient bed, only now and then a water drip (`SoundSystem.drip`, scheduled in `AmbienceSystem.update`). A first-visit hint `enter_crystalCave`; the traveller and Haruka's soldier mention the cave, the soldier gives the ゴーレムたいじ request once the cave has been visited, and the help screen's hint page lists it.
- **Balance** (`UNTIL=12 node tools/balance-sim.js 12 1 matrix`, the 水晶 / 番人 columns; shop gear only, the policy uses no chests): the regular enemies cost ~29% HP at Lv5, ~18% at Lv7 and ~7% at Lv10 (wipe 11% at Lv5, ~0% from Lv7), so Lv7 is comfortable and it sits between the forest and the castle. The guardian wipes the party ~95% at Lv6, ~61% at Lv7, ~24% at Lv8, ~2% at Lv9 and ~0% from Lv10 (15-17 rounds at Lv7-8). Items and the cave's earlier chests make it easier than the sim's policy.
- **Effect on the finale:** `FULL=1 BOSSLV=12 CAVE=1 node tools/balance-sim.js 40 1` also opens the six chests: the Demon King's win rate at Lv12 goes from 75% to 87% (`CAVE=gear` alone 89%, `CAVE=items` alone 71%, i.e. no change from the 75% within the noise of 40 runs, so the pieces of gear are what matters; an earlier, stronger set gave 92-98% and was toned down). `CAVE=1`, `CAVE=gear` and `CAVE=items` select what the sim opens. So the cave is a moderate boost for players who do it, and the finale stays winnable without it. New Game+ scaling applies to the cave enemies like any other.
- **Records:** the きろく chest count grows from 14 to 20 (an existing save that already earned the 「every chest opened」 achievement keeps it); the ずかん grows from 13 to 17 entries.

### Haruka Waystation (ハルカ宿場)

- **Where:** `MAPS.haruka` (14x10), entered from the marker at world (18,12), just east of the road to the forest; the exit returns to (18,13). It shares the village's ambient bed and sunlit atmosphere (aliases in `AmbienceSystem`) but has its own BGM (see Map music).
- **Contents:** an inn (30G), the travelling merchant's shop `roadShop` (上薬草, 毒消し草 and three mid-game pieces that fill the gap before the castle gear: 銀の剣 ATK+28 1000G, 銀の杖 ATK+4 INT+20 1100G, ウロコの鎧 DEF+23 800G), two chests (上薬草x2, 素早さの指輪), and three villagers (a travelling entertainer who wanders, a soldier, the merchant) with `talk` lines that follow the party's progress. The traveller in Millhaven hints at the waystation.
- **Balance:** the new gear is only a shop option; the balance sim does not buy it (it is cheaper per stat than the castle gear, so it is a gentle help, not a power spike).
- **Code:** data only (`MAPS.haruka`, `SHOPS.roadShop`, `WEAPONS` / `ARMORS`), plus the three alias lines above.

### New Game+ (つよくてニューゲーム)

- **Unlock:** the title menu shows 「つよくてニューゲーム」 (between つづきから and せってい) when any save slot has `demonKingDefeated`. Choosing it opens the slot pickers (source, then destination), fades out like the other entries and calls `newGamePlus(src, dst)` (`main.js`); the source slot is left as it was unless the destination is the same slot (the picker warns).
- **Carried over:** levels / stats / EXP, equipped gear and the equipment bag, items, ずかん, achievements (so rewards are not paid twice) and seen hints. **Reset:** gold (100), story flags (bosses, chests, `visited_*` ... all reopen), position (Millhaven), the party is fully healed. No opening cinematic; a short dialogue announces the cycle.
- **Cycle:** `game.cycle` (1 = normal) is saved (`cycle`, no version bump; old saves load as 1) and shown as 「2周目」 in the map HUD, the records screen and the title's save summary.
- **Difficulty:** `cycleScale(cycle)` in `data.js`: per cycle after the first, enemy HP / ATK / INT x(1 + 0.6c), DEF x(1 + 0.3c), EXP and gold x(1 + 0.5c) (c = cycles beyond the first). Applied in `BattleSystem.startBattle` to every enemy including bosses; the ずかん keeps showing base stats.
- **Balance** (`NG=2 NGLV=20 node tools/balance-sim.js 12 1 ng`: the party arrives at that level with the best gear 6000G buys, 10 fights per area): at Lv20 cycle 2 is trivial in the grassland and forest (the carried levels), ~15% HP lost in the castle, the Demon King ~83% wipe and the abyss ~40% wipe; at Lv24 the Demon King is ~8% wipe, so the party levels up (EXP x1.5) before the climax. Cycle 3 at Lv20: castle 28% wipe, Demon King and abyss out of reach until higher levels.
- **Code:** `title.js` (`titleItems`, `newGamePlus`, `updateTitle`), `data.js` (`cycleScale`), `battle.js` (`startBattle`), `tools/balance-sim.js` (`ng` mode), smoke test section `[New Game+]`.

### Blacksmith (鍛冶屋)

- **Where:** the 鍛冶屋 NPC in Millhaven (east side of the street). Talking to them opens the forge screen (`state = 'smith'`) after a line of dialogue, like a shop.
- **What:** each party member's equipped weapon and armor (6 rows) can be enhanced from +0 to **+5** for gold only; accessories cannot. Every +1 adds 10% of the item's own stats (each non-zero stat of the item gains `round(stat x 0.1 x plus)`, at least +1), so +5 is +50%. The forge shows the member's stat before -> after, the cost, and refuses (denied buzz) when gold is short.
- **Cost:** going from +p to +p+1 costs `price x (0.25 + 0.15p)` rounded to 10G (+1 25% of the item's price, +2 40%, +3 55%, +4 70%, +5 85%; +5 in total is 2.75x the price). The abyss gear is priced 9999 for this purpose, so it is a late gold sink.
- **State:** the level is stored per item. An equipped item keeps it in `char.weaponPlus` / `char.armorPlus`; unequipping puts `{ id, type, plus }` back into the equipment bag and equipping restores it, so swapping never loses it. Both fields are saved with the party / bag (no version bump; missing = +0), and New Game+ carries them with the gear. Stats are applied to the character directly (like gear stats), so battle code is untouched.
- **Display:** the equipment and stats screens show 「鉄の剣 +2」.
- **Balance:** `FULL=1 BOSSLV=12 ENH=n node tools/balance-sim.js 60 1` gives every weapon and armor a free +n at the Demon King (an upper bound; the real cost is gold the party also needs for the next piece of gear): win rate 76% at +0, 82% at +2, 83% at +3, 86% at +5. So the forge is a gentle help before the finale, and mostly a gold sink for the post-game (the abyss gear at +5 costs ~27,000G in total).
- **Code:** `js/smith.js` (`SmithSystem`: `bonus`, `cost`, `set`, `strip`, `label`, `update`, `render`), loaded after `quests.js`; `menu.js` (`equipItem`), `main.js` (dialogue end, state switch), NPC in `data.js`.

### Dice stall (サイコロ屋)

- **Where:** the 賭け屋 NPC in Haruka Waystation (`dice: true` in `data.js`). Talking to them shows a line of dialogue and then opens the dice screen (`state = 'dice'`), like a shop.
- **Rules:** two dice are rolled. The player picks a bet (50 / 100 / 200 / 500G, limited by gold; no bigger bets so a bad run never costs much) and then 大 (total 8+), 小 (total 6 or less) or 7. 大 and 小 each win 15/36 and pay back 2.2x the bet (net +1.2x); 7 wins 6/36 and pays back 5.5x. The expected return is 91.7% either way, so the stall is a gold sink with the occasional lucky streak, and gold is never created on average. Payouts are rounded down. The result screen shows the dice, the total and the gold won or lost; with less than 50G left the stall says so and closes.
- **Not saved:** there is no state to keep (the bet resolves at once); the dice use `Math.random`.
- **Code:** `js/dice.js` (`DiceSystem`: `open`, `update`, `render`, `payout`, `resolve`), loaded after `smith.js`; `main.js` (dialogue end, state switch); the NPC in `data.js`.

### Arena (闘技場)

- **Where:** the 闘技場の受付 NPC in Haruka Waystation (`arena: true`, at (2,6)). Talking to them shows a line of dialogue and then opens the course list (`state = 'arena'`), like the dice stall.
- **Rules:** pick a course, pay the entry fee, then fight three ordinary battles in a row. Winning all three pays the prize. There is no EXP or gold from the battles themselves (`checkWin` zeroes them while `game.arena` is set), the party cannot flee ("とうぎじょうでは 逃げられない"), and between rounds every living member regains 30% of max HP and MP (`ArenaSystem.RECOVER`; the fallen stay down, nothing else is restored, no inn in between). A wipe is not a game over: the arena patches everyone up to full, the fee is lost and the receptionist says so. The first win of each course also gives a one-off item (flag `arena_clear_<id>`).
- **Courses** (`ARENA` in `data.js`): ひよっこの ぶ (100G -> 200G, always open; wolves / bats / goblins / skeletons; 1st win 上薬草x3), つわものの ぶ (300G -> 600G, after the castle trip; Demon King's soldiers, mages and knights plus a crystal golem; 爆裂石x2) and でんせつの ぶ (800G -> 1,600G, after the Demon King; the abyss enemies in pairs; フェニックスの羽x3).
- **Balance** (`UNTIL=24 node tools/balance-sim.js 12 1 arena`: chance to win all three in a row with shop gear only, HP / MP carried over, the 30% recovery between rounds, no items bought): ひよっこ ~46% at Lv6 and ~99% from Lv7; つわもの ~16% at Lv9, ~81% at Lv10, ~97% at Lv11; でんせつ ~23% at Lv16, ~44% at Lv18, ~84% at Lv20 and ~100% from Lv22 (the party also has the abyss gear by then, so it is easier in play). Every run pays about 1.5-2x what the same three fights would earn normally, so the arena is a gentle gold source, never a way around the shop economy (the ひよっこ prize is only +100G net). The sim's EXP leaks into its chain (it does not set `game.arena`), so its "HP left" column is slightly high.
- **Side effects:** arena kills still count for the ずかん, kill requests and the battle counters. Nothing is saved in the middle of a run (the per-round save is skipped and leaving the page only saves in safe states, which a battle is not), so quitting mid-run brings back the save from before the run.
- **Code:** `js/arena.js` (`ArenaSystem`: `open`, `update`, `begin`, `afterRound`, `afterLose`, `recover`, `render`), loaded after `dice.js`; hooks in `battle.js` (`checkWin`, `afterWin`, the `lose` phase, run), `battle-render.js` (the "闘技場 ... 1/3" tag), `main.js` (dialogue end, state switch); the NPC and `ARENA` in `data.js`.

### Tower of the Abyss (深淵の塔)

- **What:** a post-game endurance challenge: thirty floors, one battle each, the enemies getting stronger with every floor. It is meant to make long fights (limit skills, combos) the normal thing, and to give a New Game+ party somewhere to level and earn gold.
- **Where:** the 塔の番人 NPC just inside the Abyss (`tower: true`, at (6,13)); only reachable after the Demon King (the abyss gate). Talking to them shows a line of dialogue and then opens the tower screen (`state = 'tower'`).
- **Floors** (`TOWER` in `data.js`): 1-9 pairs of abyss enemies, **10** a guard of three elite abyss enemies, 11-19 pairs and triples, **20** the Demon King's shade (`valzardShade`, the Demon King without `finale`, so no ending), 21-29 triples, **30** Zelgios. Every floor scales the enemies by `TowerSystem.scale(f)`: HP / ATK / INT x(1 + 0.025 (f-1)), DEF x(1 + 0.012 (f-1)), EXP and gold x(1 + 0.03 (f-1)); `startBattle` applies it when `game.towerFloorScale` is set (on top of the New Game+ scale). Unlike the arena, the battles pay their EXP and gold.
- **Rules:** no fleeing; after a floor the living members regain 20% HP / MP (`TowerSystem.RECOVER`), the limit gauges carry over to the next floor. Every fifth floor is a **checkpoint**: the party is fully healed and the fallen revived, any reward for that floor is paid (once per save), and the player chooses to go on or to leave. A wipe is not a game over: the party is patched up to full at the entrance, the best floor stays.
- **Progress:** `game.tower = { best, claimed }` in the save (`tower`, no version bump; old saves load as `best 0`). A run may start at floor 1 or at any checkpoint already cleared (6, 11, 16, ...). New Game+ resets it, so the rewards can be earned again each cycle.
- **Rewards** (`TOWER.rewards`, each once): 5F 魔法の聖水x3, 10F フェニックスの羽x3 + 2,000G, 15F 爆裂石x5, 20F **塔の指輪**, 25F 魔法の聖水x10 + 5,000G, 30F **覇者の指輪** + 20,000G. 
- **Balance** (`UNTIL=34 node tools/balance-sim.js 8 1 tower`: floors in a row, 20% recovery, a full heal at every checkpoint, shop gear only, no items; the real party also has the abyss chests' gear, which is worth two or three levels): the share of runs that reach floor 5 / 10 / 20 / 30: Lv16 23% / 0 / 0 / 0, Lv18 46% / 4% / 0 / 0, Lv20 73% / 25% / 0 / 0, Lv22 88% / 48% / 4% / 0, Lv24 96% / 56% / 17% / 2%, Lv26 100% / 90% / 52% / 10%, Lv28 100% / 96% / 56% / 23%, Lv30 100% / 100% / 85% / 35%, Lv34 100% / 98% / 96% / 67%. So the first checkpoint arrives around Lv16-18, floor 10 around Lv20-22, floor 20 around Lv26 and the top is for Lv30+ with the best gear and the limit skills and combos. A party that has just cleared the game (Lv ~13) cannot get through the first floors, which is intended: the tower follows the abyss.
- **Code:** `js/tower.js` (`TowerSystem`: `open`, `update`, `render`, `begin`, `afterFloor`, `afterLose`, `scale`, `groupFor`, `recover`), loaded after `arena.js`; hooks in `battle.js` (`startBattle`, `afterWin`, the `lose` phase, run), `battle-render.js` (the "塔 12F" tag), `main.js` (dialogue end, state switch), `save.js` / `title.js` (the save field and the New Game+ reset), `records.js` (a row), the NPC and `TOWER` in `data.js`.

### Requests (いらい)

- **What:** small errands that villagers give. Talking to the giver accepts the request automatically (a toast announces it), and the request is finished by talking to the right NPC once its goal is met. Rewards (gold / items) go straight into the bag with a ★ toast.
- **Nine requests:** ウルフたいじ / ガイコツたいじ / のどぐすり(届け物) / どくけしそう(集め物) at the start, then コウモリたいじ (child, after the forest), ゴーレムたいじ (soldier, after a visit to the Crystal Caverns: 2 クリスタルゴーレム, 150G + 上薬草x5), まじんへいたいじ (chief) and じょうやくそう (soldier), both after the castle trip, and こんとんのきしたいじ (traveller, after the Demon King). Finishing all nine grants the みんなの指輪 (achievement `helper`).
- **Several per NPC / gating:** `quest` may be a list; the NPC gives the first request that is unfinished and whose `needs` flag (a story flag such as `visited_castle`) is set, so later requests appear as the story advances. Requests that are not yet available are shown as ？？？ in the menu.
- **Three kinds** (`QUESTS` in `data.js`): `kill` (defeat `n` of `enemy` *after* accepting; only battles won while the request is active count), `fetch` (bring `n` of an item to the giver, who takes them), `deliver` (the giver hands over a package; the `target` NPC in another town completes it).
- **Giving:** an NPC may carry `quest: '<id>'` (giver and, for kill/fetch, turn-in) and `questTarget: '<id>'` (deliver destination). `QuestSystem.talk(game, npc)` returns the lines to speak (offer / still-active with progress / finished / after) and applies the state change, or null so the NPC's normal `talk` / `dialogue` is used. Delivery targets use their normal lines until the package is carried.
- **State:** `game.quests = { id: { state: 'active' | 'done', n } }` in the save (`quests`, no version bump; old saves load as none). New Game+ starts with none, so every request can be done again each cycle (the rewards are small gold / consumables).
- **Menu:** 「いらい」 (after きろく) lists active and finished requests with progress and the reward, 4 per page (Left/Right turns the page).
- **Balance:** `tools/balance-sim.js` does not do requests. The five requests available before the castle pay about 1,070G in total (the cave's 150G is mostly 上薬草x5) (the sim's whole Lv12 run earns only ~1100G), so they roughly double the gold for gear before the Demon King: about one extra mid-game piece (e.g. 銀の剣 / ウロコの鎧 from the waystation), a gentle help rather than a power spike. The castle-gated ones (600G + 400G) and the post-game one (1000G) arrive when gold is already plentiful. The Demon King's odds in the sim (`FULL=1 BOSSLV=12`, 40 runs: 75% win) are unchanged since it does not buy that extra gear.
- **Code:** `js/quests.js` (`QuestSystem`), loaded after `records.js`; `MapSystem.interact` calls `talk`, `updateScoreAfterBattle` calls `onDefeated`.

### Records & achievements (きろく)

- **きろく screen:** the in-game menu's きろく (after ずかん) shows per-save stats on the left (play time, steps, enemies defeated, ずかん species, chests opened of all 20, highest gold, whether the Demon King and Zelgios are down) and the achievement checklist on the right (7 entries; ★ done, ☆ with progress such as 6/9, and each reward).
- **Achievements** (`ACHIEVEMENTS` in `data.js`, granted automatically the first time the condition holds): 5 / 9 species met (上薬草x3 / フェニックスの羽x2), all species met (魔法の聖水x5), 100 enemies defeated (爆裂石x3), every chest opened (フェニックスの羽x3), every non-boss enemy defeated 3 times (達人の指輪: ATK+8 DEF+8 INT+12 SPD+4 HP+30, not sold), every request done (みんなの指輪: ATK+4 DEF+6 INT+6 SPD+4 HP+40, not sold). Rewards go straight into the bag and a ★ toast announces them (`HintSystem.notice`). All conditions use per-save data (bestiary, chest flags), not the global `gameScore`.
- **Storage:** `game.achieved = { id: true }` in the save (no version bump). A save without it earns whatever it already qualifies for when it is loaded (`RecordsSystem.check` in `loadGame`).
- **When it runs:** after a battle (`BattleSystem.afterWin`), after opening a chest, and on load.
- **Code:** `js/records.js` (`RecordsSystem`), loaded after `hints.js`; adding an achievement is a `data.js` entry (a new `kind` also needs a case in `met` / `progress`).

### Hints & help

- **Help screen:** the in-game menu's ヘルプ (between ずかん and セーブ) shows three pages (そうさ / たたかい / ヒント), switched with Left/Right, closed with cancel. Key names follow the player's bindings (`SettingsSystem.keyName`) and switch to ボタン wording in touch mode.
- **First-time hints:** small toasts (top-left under the area name, ~6.5 s, non-blocking) shown once per situation: `move` (first map frame of a new game), `dash` (40 steps), `rest` (a member at <= 50% HP), `battle`, `poison`, `bestiary` (first new entry), `enter_forest` / `enter_castle` / `enter_abyss`. The toast's clock only runs while the map, a dialogue or a battle is on screen (menus and shops pause it), and a queue shows them one at a time.
- **Storage:** `game.hints = { id: true }` in the save file (no version bump). A save without it (from before this feature) is treated as a veteran: every hint counts as seen (`HintSystem.sanitize`). A new game starts empty.
- **Menu:** `MENU_ITEMS` in `menu.js` is the single list; selection works by label, so items can be inserted without renumbering.
- **Code:** `js/hints.js` (`HintSystem`), loaded after `bestiary.js`; triggers call `HintSystem.show(game, id)` from `updateMap`, `BattleSystem.startBattle` / win / poison, and `MapSystem.handleEvent`. New hints need an entry in `TEXT` and `IDS`.

### Shops & Inn presentation

- **Shop:** entering plays a door bell and fades in from black. A shopkeeper message window (greeting, price confirmation, "まいどあり！", "おかねが たりないようだ…") and a comparison window sit at the bottom: for equipment, each party member's stat before -> after (green up / red down arrow, "そうび できない" if the class cannot wear it) plus how many the party owns; for consumables, the description and owned count. Buying plays a coin SFX, flies coins from the gold counter to the row, floats "-NG", and counts the gold down. Unaffordable items cannot be selected (denied buzz + shake of the gold counter) and are drawn dim.
- **Inn:** the confirm window shows the current gold and says so when gold is short (denied buzz). Accepting starts a ~8 s night scene (`TownSystem.renderNight`): the heroes sleep while the moon sets and dawn rises (lullaby, dawn chime, birdsong), then the status panel's HP/MP gauges refill (revived members show 復活！) before the morning dialogue. Z skips to the waking moment. The heal is applied and saved when the stay is paid, the animation only replays it.
- **Code:** `js/town.js` (`TownSystem`) draws the info windows, buy effects and the night scene; `shop.js` holds the state (`updateShop`, `updateInn`).

### Title & Opening

- **Title:** a night landscape (moon, shooting star, village lights, the Demon King's castle smouldering on a far peak, occasional lightning) with the logo dropping in letter by letter; subtitles and the menu fade in at 2.6 s. Z during that intro skips to the finished title. Choosing はじめから / つづきから plays a start SFX and fades out before `newGame()` / `loadGame()` runs.
- **Opening (new game only):** `state = 'opening'`, ~22 s, Z/X skips (fades out). Four narrated scenes (peaceful village -> the Demon King awakens with storm and thunder -> darkness spreads -> the three heroes rise at dawn), then the village chief's dialogue starts as before. BGM: title theme in scenes 1 and 4, silence plus SFX (rumble/thunder) in between. Loading a save never plays it.
- **Code:** `js/opening.js` (`OpeningSystem`) holds the shared scenery, logo, narration text, sound cues and scene timeline; `title.js` owns the title / opening screens (`updateTitle`, `updateOpening`, `renderOpening`) and `main.js` the state machine.

### Save / Load

- **Storage:** `localStorage` keys `eldrasia_save` (slot 1, the original key, so existing saves are simply slot 1), `eldrasia_save_2`, `eldrasia_save_3`; JSON with `version` (currently 2). Party, inventory, equipment, gold, map/position, flags, play time, timestamp.
- **Slots:** `SlotSystem` (`js/slots.js`) owns the keys and the picker; `game.slot` is the slot the running game auto-saves / manually saves into (`saveGame`), set by `newGame(slot)` / `loadGame(slot)`. On the title, はじめから / つづきから / つよくてニューゲーム open a picker listing the three slots (place, party levels, cycle, gold, play time, ★クリア, save time; empty or unreadable slots say so). Loading only allows readable slots; starting a game in an occupied slot asks for a second confirm ("うわがきされます"). つよくてニューゲーム asks for the source slot (cleared saves only) and then the destination, so the cleared save can stay untouched. The きろく screen shows the current slot.
- **Auto-save:** closing the menu, resting at the inn, after battle wins, leaving the page. **Manual:** the menu's セーブ command (shows a "saved" overlay + SFX).
- **Transient battle fields** (buffs, poison, gauge animation values, ...) are stripped on save; buffs/defending are reset on load.
- **Safe load:** a save that fails structural validation (3 valid party members, known classes, known map) is treated as corrupt: its slot shows よみこめません and cannot be loaded (「つづきから」 is disabled when no slot is readable). The data is not deleted; starting a new game in that slot overwrites it after the confirm.

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

**Full-kit mode:** `FULL=1` makes the sim also open the chests of each area (forest: 魔法の聖水x3, 守りの指輪, 薬草x3, 鉄の剣; castle: 上薬草x3, フェニックスの羽x2, 勇者の指輪, 爆裂石x2), buy and equip rings, prefer 上薬草, revive with a feather and throw 爆裂石 at bosses; `BOSSLV=12` (or 13) stops grinding at that level before the boss, which matches the ~1 hour pacing (without it the sim over-levels to 16). Results at the boss, 60 runs: **without** the kit Lv12 / Lv13 win 21% / 53%; **with** it 78% / 90%. The Demon King's HP is 1600 (1300 before the limit skills and combos, 1200 before that) so that a player who skips chests and items still needs about Lv13, and one who uses them wins comfortably at Lv12-13. Gold at Lv12 is only ~1100G in total, so the late castle gear (1800G+) is realistically a post-game purchase. Post-game with the kit: the 深淵 enemies wipe ~16% at Lv14 / ~6% at Lv16 and the secret boss ~42% at Lv20 (before the abyss chests).

**Roles:** Sweep is a physical all-enemy skill (ATK x1.2, ignores 25% DEF, 5 MP; the `allEnemy` branch now uses the physical formula for physical spells) so Sam can clear groups; Light is a cheap single-target magic attack (power 22, 4 MP) so Sundar helps with damage between heals. With these the sim's attack-damage share moved from Sam 42 / Dario 47 / Sundar 12% to about 34 / 40 / 26%. Fights got easier, so the Demon King's HP was raised 950 -> 1200 to keep the boss odds (~73% wipe at Lv12, ~35% at Lv13 for the sim policy, similar to before).

**Pacing:** the EXP needed for level L is `8 * L^2` (was 12). Target is a full playthrough within about 1 hour: the simulator reaches Lv12 (boss-ready) in roughly 58 battles (was ~85), i.e. ~30 min of fights plus walking and story. Per-level difficulty is unchanged, so the boss odds at a given level are the same; fewer battles also means less gold per level, so buy gear a little more selectively.

**Dario's kit in the sim:** with `FULL=1` the policy also casts Sleep on groups (when none is asleep, MP >= 14) and Magic Boost in boss fights. Castle fights then take about as long as before (wipe ~1%, ~3.5 rounds) and the Demon King odds at Lv12 / Lv13 are ~80% / ~90% (unchanged). Sleep was tuned from 65% / 2 turns / 6 MP (which made the castle trivial) to 50% / 2 turns / 8 MP.

Known gaps: the party's damage is still Dario-heavy early on (Sam ~43%, Dario ~46%, Sundar ~10% of attack damage overall).

### Automated smoke test

- **Run:** `node tools/smoke-test.js` (about 20 s; exit code 0 = all passed). It serves the repo itself and drives the real game in headless Chromium through Playwright (found in `node_modules`, or in `npm root -g`; set `PW_CHROMIUM` to point at a browser if `/opt/pw-browsers/chromium` is absent). Run it before every PR.
- **Data checks:** every map is rectangular with events and NPCs on walkable tiles and known targets; enemies have `desc` / `area` (and bosses an `EYE_TABLE` entry); every character spell exists *and has an `EFFECT_KINDS` entry*; shops, chests and achievement rewards reference real items.
- **Flows with real keys:** title -> new game -> opening -> dialogue -> walking, every menu screen, shop purchase, both inns (the full night scene), winning a battle, the ずかん record.
- **Direct checks:** Sweep / Sleep / Magic Boost / Light / Mega Bomb in battle, the abyss gate before and after the clear, Haruka entry, chests giving items once, save / load round trips, a pre-hints save and a corrupt save, the achievement grant, the requests (accept, count, deliver, fetch, save), the blacksmith (enhance, +5 cap, the level travelling with the item, save), the Tower of the Abyss (floor scaling, recovery and carried gauges, checkpoints and rewards paid once, no fleeing, a wipe, saved progress, the top), the arena (locked / unaffordable courses, three chained rounds with no EXP / gold and the recovery, the prize and the one-off reward, no fleeing, a wipe without a game over), the music (loop lengths, track per map, the new tracks start), the Crystal Caverns (entry, reachability, the guardian, its sprites), the limit skills and combos (gauge, list, effects, fizzling, nothing saved), the battle message window and the error guard, the Demon King's defeat (saved outside the castle, ending, back to the title), the secret boss (no ending), touch mode, and `balance-sim` running.
- **Adding to it:** a new screen, map or mechanic should get a line in the matching section; keep it fast and deterministic (it forces random rolls where it must).
- **History:** its first run found four world-map rows that were one tile short (fixed with it).

### Progression & Economy

- **Currency:** Gold (G)
- **Shops:** Weapons, Armor, Items in Millhaven; the roadShop in Haruka Waystation
- **Gold sinks / sources:** the dice stall (a sink, RTP 91.7%), the blacksmith (a sink), the arena (a gentle source, see Arena), the tower (battle gold grows 3% a floor, plus 27,000G of one-off rewards, see Tower of the Abyss)
- **Requests:** nine villager errands pay gold and consumables (see Requests); ~1,070G of it comes before the castle
- **Inn:** Full HP/MP restore for gold
- **Items:** 薬草 (HP35) / 上薬草 (HP100, 45G) / 魔法の水 (MP20) / 魔法の聖水 (MP60, 90G) / 毒消し草 / フェニックスの羽 / 爆弾石 (35 dmg) / 爆裂石 (90 dmg, 150G). An item may set `fx` to borrow another item's battle visuals and sound (上薬草 -> herb, 魔法の聖水 -> magicWater, 爆裂石 -> bomb), so new items of the existing types (`heal`, `healMp`, `cure`, `revive`, `damage`) are data-only.
- **Accessories:** the 防具屋 sells 力 / 魔力 / 素早さ / 命 plus 守り (DEF+8, 600G) / 賢者 (INT+12, 1400G) / 勇者 (ATK+9 DEF+5, 1500G) rings. Chests may give accessories (`itemType: 'accessory'`).
- **Chests:** besides the forest's two: the north dark area of the continent (魔法の聖水x3, 守りの指輪) the castle (上薬草x3, フェニックスの羽x2, 勇者の指輪, 爆裂石x2), Haruka Waystation (上薬草x2, 素早さの指輪), the Crystal Caverns (6 chests: 魔法の聖水x2, 上薬草x3, 水晶の指輪, 水晶のローブ, and behind the guardian 水晶の剣 and 水晶の鎧) and the abyss (4 chests of post-game gear and feathers); 20 in all. Opened by stepping on them; the flag is saved.

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
/js/battle.js       # Turn-based battle system: state, commands, turn execution, damage, win / lose (BattleSystem)
/js/battle-fx.js    # Battle effect drawing: casts, hits, pops, boss intro, escape, victory, level-up, every spell / item / attack effect
/js/battle-render.js # The battle scene: backdrop, enemies, status panel, menus, message window, effect layering
/js/opening.js      # Title scenery/logo and the new-game opening cinematic
/js/town.js         # Shop info/buy effects and the inn's night scene
/js/ambience.js     # Animated tiles, area atmosphere, wandering NPCs, area banner
/js/settings.js     # Player options (volumes, shake) and their panel
/js/bestiary.js     # Monster encyclopedia records and screen
/js/hints.js        # First-time hint toasts and the menu's help screen
/js/records.js      # Achievements (rewards) and the records screen
/js/quests.js       # Villager requests (いらい): accept, progress, rewards, menu screen
/js/smith.js        # Blacksmith: weapon / armor enhancement (+0 to +5) and its forge screen
/js/dice.js         # The dice stall (サイコロ屋) in Haruka Waystation
/js/arena.js        # The arena (闘技場) in Haruka Waystation: three battles in a row for a prize
/js/tower.js        # The Tower of the Abyss (深淵の塔): thirty floors, checkpoints, saved progress
/js/slots.js        # The three save slots and the title's slot picker
/js/touch.js        # On-screen D-pad and A/B buttons for touch devices
/js/save.js         # Save / load (three slots), score record, the "saved" overlay
/js/title.js        # Title screen, New Game+, opening glue
/js/menu.js         # In-game party menu and equipping
/js/shop.js         # Shop and inn screens
/js/endings.js      # Game-over and ending screens
/js/main.js         # Globals, input, BGM choice, the game loop, the state machine's update / render, map and dialogue
```

Script load order matters: data.js → ui.js → settings.js → sound.js → music.js → map.js → battle.js → battle-fx.js → battle-render.js → opening.js → town.js → ambience.js → bestiary.js → hints.js → records.js → quests.js → smith.js → dice.js → arena.js → tower.js → slots.js → touch.js → save.js → title.js → menu.js → shop.js → endings.js → main.js

The battle files extend one object: `battle.js` defines `var BattleSystem = {...}` and the two `battle-*.js` files add their methods with `Object.assign(BattleSystem, {...})`, so they must load right after it. The files split out of `main.js` hold plain global functions that are only called at run time (`window.onload` in `main.js` starts everything), so they only need to load before it. `tools/balance-sim.js` keeps its own module list and must include the `battle-*` files.

---

## Contributing Guidelines

- Keep game data in `js/data.js`, not hardcoded in logic
- New mechanics should have a design note added to this file before implementation
- Prefer small, focused commits
