// ============================================================
// battle.js — Dragon Quest-style turn-based battle system
// ============================================================

var BattleSystem = {

  // Start a new battle
  startBattle: function(game, enemyIds) {
    var enemies = [];
    for (var pi = 0; pi < game.party.length; pi++) {
      game.party[pi].poisoned = false;   // poison only lasts within a battle
      game.party[pi].hpShown = 0; game.party[pi].hpGhost = 0; game.party[pi].mpShown = 0;   // gauges fill up as the panel slides in
      game.party[pi].hpLast = game.party[pi].hp;
    }
    var cs = cycleScale(game.cycle);
    for (var i = 0; i < enemyIds.length; i++) {
      var template = ENEMIES[enemyIds[i]];
      enemies.push({
        id: enemyIds[i],
        name: template.name + (enemyIds.length > 1 && enemyIds.filter(function(e) { return e === enemyIds[i]; }).length > 1 ? String.fromCharCode(65 + i) : ''),
        hp: Math.round(template.hp * cs.stat),
        maxHp: Math.round(template.hp * cs.stat),
        atk: Math.round(template.atk * cs.stat),
        def: Math.round(template.def * cs.def),
        spd: template.spd,
        int: Math.round(template.int * cs.stat),
        exp: Math.round(template.exp * cs.reward),
        gold: Math.round(template.gold * cs.reward),
        color: template.color,
        shape: template.shape,
        boss: template.boss || false,
        finale: template.finale || false,
        bigSkill: template.bigSkill || 'enemyDark',
        poison: template.poison || 0,
        skills: template.skills || [],
        alive: true,
        buffs: {},
        bossPhase: 0,       // 0 / 1 (HP <= 66%) / 2 (HP <= 33%): boss form changes
        charging: false,    // boss is storing a big attack for next round
      });
    }

    HintSystem.show(game, 'battle');
    var newEntries = BestiarySystem.recordSeen(game, enemyIds);   // first meetings are announced after the win
    game.battle = {
      newEntries: newEntries,
      enemies: enemies,
      phase: 'start',        // start, command, targeting, spellSelect, itemSelect, execute, result, win, lose, levelup
      currentChar: 0,        // Which party member is selecting command
      commandIndex: 0,       // Cursor in command menu
      targetIndex: 0,        // Cursor in target selection
      spellIndex: 0,         // Cursor in spell list
      itemIndex: 0,          // Cursor in item list
      commands: [],           // Queued commands [{actor, action, target}]
      turnQueue: [],          // Ordered list of actions for execution
      currentAction: 0,      // Which action is being executed
      messages: [],           // Messages to display
      messageTimer: 0,
      animTimer: 0,
      flashEnemy: -1,
      flashParty: -1,
      totalExp: 0,
      totalGold: 0,
      levelUps: [],
      levelUpIndex: 0,
      escapeAttempts: 0,
      introStart: Date.now(),   // drives the enemy entrance animation
    };
    game.state = 'battle';
    game.battle.messages = [this.getEncounterMessage(enemies)];
    game.battle.messageTimer = 60;
    // Boss fights get a longer cinematic entrance before the first command
    game.battle.bossIntro = enemies.some(function(e) { return e.boss; });
    if (game.battle.bossIntro) game.battle.messageTimer = 170;
    SoundSystem.battleStart();
  },

  // Trigger a screen shake: mag in px, dur in ms
  shake: function(game, mag, dur) {
    var b = game.battle;
    if (!b || !SettingsSystem.get('shake')) return;
    b.shakeMag = mag;
    b.shakeDur = dur;
    b.shakeUntil = Date.now() + dur;
  },

  // Spell id -> visual effect kind
  EFFECT_KINDS: {
    powerSlash: 'slash', sweep: 'sweep', light: 'light', shieldBash: 'bash', warCry: 'buffAtk', protect: 'buffDef',
    fire: 'fire', enemyFire: 'fire', iceStorm: 'ice', thunder: 'thunder',
    heal: 'heal', enemyHeal: 'heal', holyLight: 'holy', enemyDark: 'dark', enemyDoom: 'dark', enemyCrystal: 'ice',
    weaken: 'debuffAtk', armorBreak: 'debuffDef', cure: 'cure', sleep: 'sleep', magicBoost: 'buffInt',
  },

  // Party spells: ms of casting (rune circle + travelling orb) before the effect lands, and element colour
  PARTY_CAST_DELAY: { sleep: 420, buffInt: 340, light: 380, fire: 480, ice: 480, thunder: 520, heal: 380, holy: 560, buffAtk: 340, buffDef: 340, debuffAtk: 440, debuffDef: 440, cure: 360 },
  PARTY_CAST_TINT: { sleep: '150,130,255', buffInt: '120,230,255', light: '255,250,200', fire: '255,150,50', ice: '140,210,255', thunder: '200,215,255', heal: '120,255,170',
                     holy: '255,240,170', buffAtk: '255,120,60', buffDef: '90,170,255',
                     debuffAtk: '200,60,120', debuffDef: '120,90,220', cure: '170,255,210' },

  // Party basic attacks: windup before the strike lands (numbers, shake and sound wait for it)
  PARTY_ATTACK_DELAY: 190,

  // Cure: poison bubbles burst off the member and a cleansing wave sweeps up (lands after d ms)
  cureFx: function(game, idx, d) {
    var b = game.battle;
    b.cureFx = { idx: idx, t0: Date.now() + (d || 0), dur: 1200 };
    if (d) { setTimeout(function() { if (game.battle === b) SoundSystem.cureHit(); }, d); }
    else SoundSystem.cureHit();
  },

  // Failed escape: the party skids to a stop and bounces back off the blockade
  escapeFailFx: function(game, blocked) {
    var b = game.battle;
    b.escapeFail = { t0: Date.now(), dur: 900, blocked: blocked };
    SoundSystem.escapeFail();
  },

  // Failed escape: red "!" over every enemy and a small jolt as they cut off the way
  alertEnemies: function(game) {
    var b = game.battle;
    if (!b.pops) b.pops = [];
    var now = Date.now();
    for (var i = 0; i < b.enemies.length; i++) {
      var en = b.enemies[i];
      if (!en.alive || en.sx === undefined) continue;
      b.pops.push({
        target: en, isParty: false, kind: 'alert', text: '!',
        fixed: { x: en.sx, y: en.sfoot - 22 * en.sscale - 62 * en.sscale },
        t0: now
      });
    }
    this.shake(game, 6, 300);
  },

  STAT_WORDS: { atk: 'こうげき力', def: 'しゅび力', int: 'まりょく' },
  ENEMY_CAST_DELAY: 650,  // ms an enemy charges a spell before it lands
  ENEMY_CAST_TINT: { enemyFire: '255,120,30', enemyDark: '150,60,220', enemyDoom: '60,200,230', enemyCrystal: '120,210,255', enemyHeal: '80,230,130' },
  // How each species attacks (drives the motion and the impact effect)
  ATTACK_STYLES: { slime: 'hop', wolf: 'pounce', bat: 'dive', knight: 'heavy', golem: 'heavy', demonKing: 'heavy', abyssLord: 'heavy',
                   skeleton: 'slash', goblin: 'slash', mage: 'slash' },
  ATTACK_TINTS: { hop: '90,190,255', pounce: '255,60,60', dive: '200,30,60', heavy: '255,140,40', slash: '255,60,60' },
  // Eye positions per species (unscaled offsets from the sprite origin) for the stance glint
  EYE_TABLE: {
    slime: [[-5, 6], [6, 6]], goblin: [[-3.5, -13.5], [4.5, -13.5]], wolf: [[-26, -10]],
    bat: [[-3.5, -2.5], [4.5, -2.5]], skeleton: [[-3, -17.5], [3, -17.5]],
    knight: [[-2.5, -20.5], [3.5, -20.5]], golem: [[-4.5, -16], [5.5, -16]], mage: [[-2.5, -20.5], [3.5, -20.5]],
    demonKing: [[-8, -25], [8, -25]], abyssLord: [[-9, -27], [9, -27]]
  },
  ENEMY_HIT_DELAY: 260,   // ms between an enemy starting its lunge and the hit landing (peak of the charge)

  // Lunge curve: -0.25 (wind-up) -> 1 (full charge, hit lands) -> 0 (back in place); at in 0..1
  atkCurve: function(at) {
    if (at < 0) return 0;
    if (at < 0.3) return -0.25 * (at / 0.3);                  // wind-up: pull back
    if (at < 0.5) return -0.25 + 1.25 * ((at - 0.3) / 0.2);   // charge
    if (at < 1) return 1 - (at - 0.5) / 0.5;                  // retreat
    return 0;
  },

  // Queue a floating number over a combatant. kind: 'dmg' | 'heal' | 'mp'
  pop: function(game, target, value, kind, delay) {
    var b = game.battle;
    if (!b || !target) return;
    if (!b.pops) b.pops = [];
    var isParty = game.party.indexOf(target) >= 0;
    if (!isParty && kind === 'dmg') {
      // Remember when and how hard this enemy was hit (drives recoil, flash, sparks, HP bar)
      target.hitAt = Date.now() + (delay || 0);
      target.hitMag = Math.min(1, 0.35 + (value / (target.maxHp || 1)) * 2.5);
      target.hitKind = this._curKind || null;
    }
    // A hit worth 40%+ of the enemy's max HP is a critical: label, screen flash and an extra jolt
    var crit = !isParty && kind === 'dmg' && value >= (target.maxHp || 1) * 0.4;
    if (crit) {
      b.critFlashAt = Date.now() + (delay || 0);
      this.shake(game, 10, 320);
    }
    b.pops.push({ target: target, isParty: isParty, text: String(value), kind: kind, t0: Date.now() + (delay || 0), crit: crit });
  },

  // Start a spell effect. side: 'enemy'|'party', idx: target index or -1 for all
  startEffect: function(game, spellId, side, idx, delay) {
    var b = game.battle;
    var kind = this.EFFECT_KINDS[spellId];
    if (!b || !kind) return;
    b.effect = { kind: kind, side: side, idx: idx, t0: Date.now() + (delay || 0), dur: 850 };
  },

  getEncounterMessage: function(enemies) {
    var names = [];
    for (var i = 0; i < enemies.length; i++) {
      if (names.indexOf(enemies[i].name) === -1) names.push(enemies[i].name);
    }
    return names.join('と ') + 'が あらわれた！';
  },

  // Main battle update
  update: function(game) {
    var b = game.battle;
    if (!b) return;

    if (b.messageTimer > 0) {
      b.messageTimer--;
      return;
    }

    switch (b.phase) {
      case 'start':
        b.phase = 'command';
        b.currentChar = 0;
        b.commandIndex = 0;
        this.skipDeadChars(game);
        b.commands = [];
        break;
      case 'execute':
        this.executeNextAction(game);
        break;
      case 'win':
        this.handleWin(game);
        break;
      case 'run':
        game.state = 'map';
        game.battle = null;
        break;
      case 'lose':
        // Game over handled by main.js
        break;
      case 'levelup':
        // Wait for input
        break;
    }
  },

  // Handle input during battle
  handleInput: function(game, key) {
    var b = game.battle;
    if (!b) return;

    // Skip message display
    if (b.messageTimer > 0) {
      if (key === 'confirm') b.messageTimer = 0;
      return;
    }

    switch (b.phase) {
      case 'command':
        this.handleCommandInput(game, key);
        break;
      case 'targeting':
        this.handleTargetInput(game, key);
        break;
      case 'spellSelect':
        this.handleSpellInput(game, key);
        break;
      case 'itemSelect':
        this.handleItemInput(game, key);
        break;
      case 'allyTarget':
        this.handleAllyTargetInput(game, key);
        break;
      case 'execute':
        if (key === 'confirm') b.messageTimer = 0;
        break;
      case 'win':
        if (key === 'confirm') b.messageTimer = 0;
        break;
      case 'levelup':
        if (key === 'confirm') {
          b.levelUpIndex++;
          if (b.levelUpIndex < b.levelUps.length) SoundSystem.levelUp();
          if (b.levelUpIndex >= b.levelUps.length) {
            this.afterWin(game);
          }
        }
        break;
      case 'lose':
        if (key === 'confirm') {
          game.state = 'gameover';
        }
        break;
    }
  },

  handleCommandInput: function(game, key) {
    var b = game.battle;
    var commands = ['たたかう', 'じゅもん', 'どうぐ', 'ぼうぎょ', 'にげる'];

    if (key === 'up') {
      b.commandIndex = (b.commandIndex - 1 + commands.length) % commands.length;
      SoundSystem.cursor();
    } else if (key === 'down') {
      b.commandIndex = (b.commandIndex + 1) % commands.length;
      SoundSystem.cursor();
    } else if (key === 'confirm') {
      switch (b.commandIndex) {
        case 0: // Attack
          b.phase = 'targeting';
          b.targetIndex = 0;
          b.pendingAction = 'attack';
          break;
        case 1: // Magic
          var spells = this.getAvailableSpells(game.party[b.currentChar]);
          if (spells.length === 0) {
            b.messages = ['じゅもんを おぼえていない！'];
            b.messageTimer = 30;
          } else {
            var canCast = false;
            for (var si = 0; si < spells.length; si++) {
              if (game.party[b.currentChar].mp >= SPELLS[spells[si].id].mp) { canCast = true; break; }
            }
            if (!canCast) {
              b.messages = ['MPが 足りない！'];
              b.messageTimer = 30;
            } else {
              b.phase = 'spellSelect';
              b.spellIndex = 0;
            }
          }
          break;
        case 2: // Item
          if (game.inventory.length > 0) {
            b.phase = 'itemSelect';
            b.itemIndex = 0;
          } else {
            b.messages = ['どうぐを もっていない！'];
            b.messageTimer = 30;
          }
          break;
        case 3: // Defend
          b.commands.push({
            actor: b.currentChar,
            actorType: 'party',
            action: 'defend',
          });
          this.nextCharCommand(game);
          break;
        case 4: // Run
          b.commands.push({
            actor: b.currentChar,
            actorType: 'party',
            action: 'run',
          });
          this.startExecution(game);
          break;
      }
    }
  },

  handleTargetInput: function(game, key) {
    var b = game.battle;
    var aliveEnemies = b.enemies.filter(function(e) { return e.alive; });

    if (key === 'left' || key === 'up') {
      b.targetIndex = (b.targetIndex - 1 + aliveEnemies.length) % aliveEnemies.length;
      SoundSystem.cursor();
    } else if (key === 'right' || key === 'down') {
      b.targetIndex = (b.targetIndex + 1) % aliveEnemies.length;
      SoundSystem.cursor();
    } else if (key === 'confirm') {
      var targetIdx = 0;
      var count = 0;
      for (var i = 0; i < b.enemies.length; i++) {
        if (b.enemies[i].alive) {
          if (count === b.targetIndex) { targetIdx = i; break; }
          count++;
        }
      }
      if (b.pendingAction === 'attack') {
        b.commands.push({
          actor: b.currentChar,
          actorType: 'party',
          action: 'attack',
          target: targetIdx,
          targetType: 'enemy',
        });
      } else if (b.pendingAction === 'spell') {
        b.commands.push({
          actor: b.currentChar,
          actorType: 'party',
          action: 'spell',
          spellId: b.pendingSpell,
          target: targetIdx,
          targetType: 'enemy',
        });
      } else if (b.pendingAction === 'item') {
        b.commands.push({
          actor: b.currentChar,
          actorType: 'party',
          action: 'item',
          itemId: b.pendingItem,
          target: targetIdx,
          targetType: 'enemy',
        });
      }
      this.nextCharCommand(game);
    } else if (key === 'cancel') {
      b.phase = 'command';
    }
  },

  handleSpellInput: function(game, key) {
    var b = game.battle;
    var spells = this.getAvailableSpells(game.party[b.currentChar]);
    if (key === 'up') {
      b.spellIndex = (b.spellIndex - 1 + spells.length) % spells.length;
      SoundSystem.cursor();
    } else if (key === 'down') {
      b.spellIndex = (b.spellIndex + 1) % spells.length;
      SoundSystem.cursor();
    } else if (key === 'confirm') {
      var spell = SPELLS[spells[b.spellIndex].id];
      if (game.party[b.currentChar].mp >= spell.mp) {
        b.pendingSpell = spells[b.spellIndex].id;
        if (spell.target === 'enemy') {
          b.phase = 'targeting';
          b.targetIndex = 0;
          b.pendingAction = 'spell';
        } else if (spell.target === 'ally') {
          // Target party member — select ally
          b.pendingAction = 'spellAlly';
          b.phase = 'allyTarget';
          b.targetIndex = 0;
        } else {
          // All enemies, party buff, etc.
          b.commands.push({
            actor: b.currentChar,
            actorType: 'party',
            action: 'spell',
            spellId: spells[b.spellIndex].id,
            target: -1,
            targetType: spell.target === 'allEnemy' ? 'allEnemy' : 'party',
          });
          this.nextCharCommand(game);
        }
      } else {
        b.messages = ['MPが 足りない！'];
        b.messageTimer = 30;
      }
    } else if (key === 'cancel') {
      b.phase = 'command';
    }
  },

  handleAllyTargetInput: function(game, key) {
    var b = game.battle;
    if (key === 'up') {
      b.targetIndex = (b.targetIndex - 1 + game.party.length) % game.party.length;
      SoundSystem.cursor();
    } else if (key === 'down') {
      b.targetIndex = (b.targetIndex + 1) % game.party.length;
      SoundSystem.cursor();
    } else if (key === 'confirm') {
      b.commands.push({
        actor: b.currentChar,
        actorType: 'party',
        action: 'spell',
        spellId: b.pendingSpell,
        target: b.targetIndex,
        targetType: 'ally',
      });
      this.nextCharCommand(game);
    } else if (key === 'cancel') {
      b.phase = 'spellSelect';
    }
  },

  handleItemInput: function(game, key) {
    var b = game.battle;
    if (key === 'up') {
      b.itemIndex = (b.itemIndex - 1 + game.inventory.length) % game.inventory.length;
      SoundSystem.cursor();
    } else if (key === 'down') {
      b.itemIndex = (b.itemIndex + 1) % game.inventory.length;
      SoundSystem.cursor();
    } else if (key === 'confirm') {
      var invItem = game.inventory[b.itemIndex];
      var item = ITEMS[invItem.id];
      b.pendingItem = invItem.id;
      if (item.target === 'enemy') {
        b.phase = 'targeting';
        b.targetIndex = 0;
        b.pendingAction = 'item';
      } else {
        // Use on party — auto-target first needing member or self
        var itemTarget = this.findHealTarget(game);
        if (item.type === 'cure') {
          for (var pz = 0; pz < game.party.length; pz++) { if (game.party[pz].alive && game.party[pz].poisoned) { itemTarget = pz; break; } }
        }
        b.commands.push({
          actor: b.currentChar,
          actorType: 'party',
          action: 'item',
          itemId: invItem.id,
          target: itemTarget,
          targetType: 'ally',
        });
        this.nextCharCommand(game);
      }
    } else if (key === 'cancel') {
      b.phase = 'command';
    }
  },

  findHealTarget: function(game) {
    var lowest = 0;
    var lowestRatio = 1;
    for (var i = 0; i < game.party.length; i++) {
      if (game.party[i].alive && game.party[i].hp / game.party[i].maxHp < lowestRatio) {
        lowestRatio = game.party[i].hp / game.party[i].maxHp;
        lowest = i;
      }
    }
    return lowest;
  },

  getAvailableSpells: function(char) {
    var charDef = CHARACTERS[char.classId];
    var available = [];
    for (var i = 0; i < charDef.spells.length; i++) {
      if (char.level >= charDef.spells[i].learnLevel) {
        available.push(charDef.spells[i]);
      }
    }
    return available;
  },

  skipDeadChars: function(game) {
    var b = game.battle;
    while (b.currentChar < game.party.length && !game.party[b.currentChar].alive) {
      b.currentChar++;
    }
  },

  nextCharCommand: function(game) {
    var b = game.battle;
    b.currentChar++;
    b.commandIndex = 0;
    this.skipDeadChars(game);
    if (b.currentChar >= game.party.length) {
      this.startExecution(game);
    } else {
      b.phase = 'command';
    }
  },

  // Build turn order and start executing
  startExecution: function(game) {
    var b = game.battle;

    // Add enemy actions
    for (var i = 0; i < b.enemies.length; i++) {
      if (b.enemies[i].alive) {
        var action = this.getEnemyAction(b.enemies[i], game);
        b.commands.push(action);
      }
    }

    // Sort by speed
    b.turnQueue = b.commands.slice().sort(function(a, b2) {
      var spdA = a.actorType === 'party' ? game.party[a.actor].spd : game.battle.enemies[a.actor].spd;
      var spdB = b2.actorType === 'party' ? game.party[b2.actor].spd : game.battle.enemies[b2.actor].spd;
      return (spdB + Math.random() * 4) - (spdA + Math.random() * 4);
    });

    b.currentAction = 0;
    b.phase = 'execute';
    b.messages = [];
    b.messageTimer = 0;
  },

  // Boss form change: when its HP first drops to 66% / 33% the boss powers up
  // (more big attacks, see getEnemyAction) with a short cinematic. Returns true while that plays.
  checkBossPhase: function(game) {
    var b = game.battle;
    for (var i = 0; i < b.enemies.length; i++) {
      var e = b.enemies[i];
      if (!e.boss || !e.alive) continue;
      var r = e.hp / e.maxHp;
      var np = r <= 0.33 ? 2 : (r <= 0.66 ? 1 : 0);
      if (np > (e.bossPhase || 0)) {
        e.bossPhase = np;
        b.bossPhaseFx = { idx: i, t0: Date.now(), phase: np };
        b.messages = [e.name + 'の 全身から ' + (np === 1 ? 'どす黒い 瘴気が あふれ出した！' : '真紅の 闇が 爆発した！'),
                      np === 1 ? e.name + 'の 力が 増していく…！' : e.name + 'は 怒り狂っている！'];
        b.messageTimer = 100;
        SoundSystem.bossPhase(np);
        this.shake(game, 12, 700);
        return true;
      }
    }
    return false;
  },

  getEnemyAction: function(enemy, game) {
    var idx = game.battle.enemies.indexOf(enemy);

    // Boss: a stored attack is released this round, at full force
    if (enemy.boss && enemy.charging) {
      return { actor: idx, actorType: 'enemy', action: 'spell', spellId: enemy.bigSkill || 'enemyDark', target: -1, targetType: 'partyAll', charged: true };
    }

    // Boss AI
    if (enemy.boss && enemy.hp < enemy.maxHp * 0.3 && enemy.skills.indexOf('enemyHeal') >= 0 && Math.random() < 0.4) {
      return { actor: idx, actorType: 'enemy', action: 'spell', spellId: 'enemyHeal', target: idx, targetType: 'self' };
    }
    if (enemy.skills.length > 0 && Math.random() < 0.35 + (enemy.boss ? 0.12 * (enemy.bossPhase || 0) : 0)) {
      var skill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
      var spell = SPELLS[skill];
      // The boss's party-wide attack is telegraphed: it spends a turn charging first
      if (enemy.boss && skill === (enemy.bigSkill || 'enemyDark')) return { actor: idx, actorType: 'enemy', action: 'charge', target: -1 };
      if (spell.target === 'partyAll') {
        return { actor: idx, actorType: 'enemy', action: 'spell', spellId: skill, target: -1, targetType: 'partyAll' };
      } else if (spell.target === 'self') {
        return { actor: idx, actorType: 'enemy', action: 'spell', spellId: skill, target: idx, targetType: 'self' };
      } else {
        var t = this.randomAlivePartyMember(game);
        return { actor: idx, actorType: 'enemy', action: 'spell', spellId: skill, target: t, targetType: 'ally' };
      }
    }
    // Default: attack random alive party member
    var target = this.randomAlivePartyMember(game);
    return { actor: idx, actorType: 'enemy', action: 'attack', target: target, targetType: 'ally' };
  },

  randomAlivePartyMember: function(game) {
    var alive = [];
    for (var i = 0; i < game.party.length; i++) {
      if (game.party[i].alive) alive.push(i);
    }
    return alive[Math.floor(Math.random() * alive.length)];
  },

  // Execute the next action in the turn queue
  executeNextAction: function(game) {
    var b = game.battle;
    if (this.checkBossPhase(game)) return;
    if (b.currentAction >= b.turnQueue.length) {
      // All actions done — check win/lose, then new round
      if (this.checkWin(game)) return;
      if (this.checkLose(game)) return;
      // Decrease buff durations
      this.tickBuffs(game);
      b.phase = 'command';
      b.currentChar = 0;
      b.commandIndex = 0;
      this.skipDeadChars(game);
      b.commands = [];
      return;
    }

    var cmd = b.turnQueue[b.currentAction];
    b.currentAction++;

    // Check if actor is still alive
    if (cmd.actorType === 'party' && !game.party[cmd.actor].alive) return this.executeNextAction(game);
    if (cmd.actorType === 'enemy' && !b.enemies[cmd.actor].alive) return this.executeNextAction(game);

    // A sleeping enemy loses its next actions
    if (cmd.actorType === 'enemy' && b.enemies[cmd.actor].sleepTurns > 0) {
      var slEn = b.enemies[cmd.actor];
      slEn.sleepTurns--;
      b.messages = [slEn.name + 'は ぐうぐう ねむっている…'];
      if (slEn.sleepTurns <= 0) b.messages.push(slEn.name + 'は 目を さました！');
      b.messageTimer = 40;
      return;
    }

    // A stunned enemy loses its next action
    if (cmd.actorType === 'enemy' && b.enemies[cmd.actor].stunTurns > 0) {
      var stEn = b.enemies[cmd.actor];
      stEn.stunTurns--;
      b.messages = [stEn.name + 'は しびれて 動けない！'];
      if (stEn.charging) { stEn.charging = false; b.messages.push('ためていた 力が 霧散した！'); }
      b.messageTimer = 45;
      stEn.stunAt = Date.now();
      SoundSystem.stunHit();
      return;
    }

    // Handle run
    if (cmd.action === 'run') {
      b.escapeAttempts++;
      var anyBoss = b.enemies.some(function(e) { return e.boss && e.alive; });
      if (anyBoss) {
        b.messages = ['しかし 逃げられない！'];
        b.messageTimer = 40;
        this.alertEnemies(game);
        this.escapeFailFx(game, true);
      } else if (Math.random() < 0.5 + b.escapeAttempts * 0.1) {
        b.messages = ['うまく逃げ切れた！'];
        b.messageTimer = 75;           // leave time for the getaway scene
        b.escapeStart = Date.now();
        b.phase = 'run';
        SoundSystem.escape();
        SoundSystem.escapeRun();
      } else {
        b.messages = ['しかし 回り込まれてしまった！'];
        b.messageTimer = 40;
        this.alertEnemies(game);
        this.escapeFailFx(game, false);
      }
      return;
    }

    // Boss telegraph: it stores a big attack and releases it next round
    if (cmd.action === 'charge') {
      var chEn = b.enemies[cmd.actor];
      chEn.charging = true;
      b.chargeFx = { idx: cmd.actor, t0: Date.now() };
      b.messages = [chEn.name + 'は 暗黒の力を ためている…！', 'ぼうぎょで 備えよ！'];
      b.messageTimer = 100;
      SoundSystem.bossCharge();
      this.shake(game, 4, 600);
      return;
    }

    // Handle defend
    if (cmd.action === 'defend') {
      var defender = cmd.actorType === 'party' ? game.party[cmd.actor] : b.enemies[cmd.actor];
      defender.defending = true;
      b.messages = [defender.name + 'は 身を守っている。'];
      b.messageTimer = 30;
      if (cmd.actorType === 'party') {
        b.guardFx = { idx: cmd.actor, t0: Date.now(), dur: 750 };
        SoundSystem.guard();
        this.shake(game, 2, 160);
      }
      return;
    }

    // Handle attack
    if (cmd.action === 'attack') {
      this.executeAttack(game, cmd);
      return;
    }

    // Handle spell
    if (cmd.action === 'spell') {
      this.executeSpell(game, cmd);
      return;
    }

    // Handle item
    if (cmd.action === 'item') {
      this.executeItem(game, cmd);
      return;
    }

    this.executeNextAction(game);
  },

  executeAttack: function(game, cmd) {
    this._curKind = null;
    var b = game.battle;
    var attacker, defender, attackerName, defenderName;

    if (cmd.actorType === 'party') {
      attacker = game.party[cmd.actor];
      defender = b.enemies[cmd.target];
      if (!defender || !defender.alive) {
        // Retarget to first alive enemy
        for (var i = 0; i < b.enemies.length; i++) {
          if (b.enemies[i].alive) { defender = b.enemies[i]; break; }
        }
        if (!defender || !defender.alive) return this.executeNextAction(game);
      }
    } else {
      attacker = b.enemies[cmd.actor];
      defender = game.party[cmd.target];
      if (!defender || !defender.alive) {
        cmd.target = this.randomAlivePartyMember(game);
        defender = game.party[cmd.target];
        if (!defender) return this.executeNextAction(game);
      }
    }

    var atk = this.getEffectiveStat(attacker, 'atk');
    var def = this.getEffectiveStat(defender, 'def');
    if (defender.defending) def = Math.floor(def * 1.5);
    var damage = Math.max(1, Math.floor(atk / 2 - def / 4 + (Math.random() * 5 - 2)));
    defender.hp = Math.max(0, defender.hp - damage);
    this.pop(game, defender, damage, 'dmg', cmd.actorType === 'enemy' ? this.ENEMY_HIT_DELAY : this.PARTY_ATTACK_DELAY);

    var atkWord = 'こうげき';
    if (cmd.actorType === 'enemy') {
      atkWord = { hop: 'たいあたり', pounce: 'とびかかり', dive: 'きゅうこうか', heavy: 'ふりおろし' }[this.ATTACK_STYLES[attacker.shape]] || 'こうげき';
    }
    b.messages = [attacker.name + 'の ' + atkWord + '！', defender.name + 'に ' + damage + 'の ダメージ！'];
    if (cmd.actorType === 'party') {
      // Windup streak, then the weapon strike lands after PARTY_ATTACK_DELAY ms
      var ad = this.PARTY_ATTACK_DELAY;
      var tIdx = b.enemies.indexOf(defender);
      var big = damage >= defender.maxHp * 0.25;
      var who = { 'ダリオ': 'Dario', 'スンダー': 'Sundar' }[attacker.name] || 'Sam';
      b.pAtk = { idx: tIdx, who: who, big: big, t0: Date.now(), dur: ad + 520, ad: ad, seed: damage };
      defender.hitAt = Date.now() + ad;   // recoil syncs to the strike
      SoundSystem.whoosh();
      setTimeout(function() {
        if (game.battle !== b) return;
        b.flashEnemy = tIdx;
        SoundSystem.attack();
        SoundSystem.weaponHit(who, big);
        BattleSystem.shake(game, big ? 11 : 7, big ? 380 : 280);
      }, ad);
    } else {
      // Enemy lunges, then the hit lands after ENEMY_HIT_DELAY ms
      var hitIdx = game.party.indexOf(defender);
      var atkStyle = this.ATTACK_STYLES[attacker.shape] || 'slash';
      var heavy = damage >= defender.maxHp * 0.25 || atkStyle === 'heavy';   // big hits get a bigger reaction
      b.enemyAtk = { idx: cmd.actor, t0: Date.now(), dur: 560, style: atkStyle };
      b.partyHit = { idx: hitIdx, t0: Date.now() + this.ENEMY_HIT_DELAY, melee: true, heavy: heavy,
                     style: atkStyle, tint: this.ATTACK_TINTS[atkStyle] };
      var guarded = !!defender.defending;
      // Poisonous attackers may taint a living, un-guarded target
      if (!guarded && defender.hp > 0 && attacker.poison && !defender.poisoned && Math.random() < attacker.poison) {
        defender.poisoned = true;
        HintSystem.show(game, 'poison');
        defender.poisonAt = Date.now() + this.ENEMY_HIT_DELAY;
        b.messages.push(defender.name + 'は 毒に おかされた！');
        setTimeout(function() { if (game.battle === b) SoundSystem.poisonHit(); }, this.ENEMY_HIT_DELAY + 120);
      }
      if (guarded) {
        // Braced target: no red flash; a barrier flares and the shock is much smaller
        b.partyHit = null;
        b.guardBlock = { idx: hitIdx, t0: Date.now() + this.ENEMY_HIT_DELAY, dur: 520, heavy: heavy };
        b.messages.push(defender.name + 'は ガードで ダメージを おさえた！');
      }
      SoundSystem.whoosh();
      setTimeout(function() {
        if (game.battle !== b) return;
        if (guarded) {
          SoundSystem.guardHit(heavy);
          BattleSystem.shake(game, heavy ? 6 : 4, 240);
          return;
        }
        b.flashParty = hitIdx;
        SoundSystem.damage();
        SoundSystem.enemyHit(atkStyle);
        BattleSystem.shake(game, heavy ? 15 : 10, heavy ? 480 : 360);
      }, this.ENEMY_HIT_DELAY);
    }
    b.messageTimer = 45 + (cmd.actorType === 'party' ? 12 : 0);

    if (defender.hp <= 0) {
      defender.alive = false;
      defender.hp = 0;
      b.messages.push(defender.name + 'を たおした！');
      b.messageTimer = 55;
      if (cmd.actorType === 'party') SoundSystem.enemyDie();
    }

    setTimeout(function() { b.flashEnemy = -1; b.flashParty = -1; }, 300);
  },

  executeSpell: function(game, cmd) {
    this._curKind = cmd.actorType === 'party' ? (this.EFFECT_KINDS[cmd.spellId] || null) : null;   // lets pop() tag the element of the hit
    var b = game.battle;
    var spell = SPELLS[cmd.spellId];
    var caster = cmd.actorType === 'party' ? game.party[cmd.actor] : b.enemies[cmd.actor];

    // Deduct MP for party members
    if (cmd.actorType === 'party') {
      if (caster.mp < spell.mp) {
        b.messages = [caster.name + 'は MPが 足りない！'];
        b.messageTimer = 30;
        return;
      }
      caster.mp -= spell.mp;
    }

    b.messages = [caster.name + 'は ' + spell.name + 'を となえた！'];
    if (cmd.charged) {
      caster.charging = false;
      b.messages = ['ためていた 力が 解き放たれた！', caster.name + 'の 全力の ' + spell.name + '！'];
      b.chargedBlast = { t0: Date.now() + this.ENEMY_CAST_DELAY + 250 };
    }

    // Enemy casters charge up first; effect, shake and numbers land after ed ms
    var ed = cmd.actorType === 'enemy' ? (caster.boss ? this.ENEMY_CAST_DELAY + 250 : this.ENEMY_CAST_DELAY) : 0;
    var tint = this.ENEMY_CAST_TINT[cmd.spellId] || '200,200,255';
    var pKind = cmd.actorType === 'party' ? this.EFFECT_KINDS[cmd.spellId] : null;
    var pd = pKind ? (this.PARTY_CAST_DELAY[pKind] || 0) : 0;   // party casting time (effect, numbers, shake wait for it)
    var fd = ed || pd;
    if (ed) b.enemyCast = { idx: cmd.actor, t0: Date.now(), dur: ed + 350, tint: tint, spellId: cmd.spellId, ed: ed, boss: !!caster.boss };

    // 呪文のビジュアルエフェクト
    var fxSide = 'enemy', fxIdx = -1;
    if (cmd.actorType === 'party') {
      if (spell.type === 'buff') { fxSide = 'party'; fxIdx = -1; }
      else if (spell.type === 'heal') { fxSide = 'party'; fxIdx = (cmd.target >= 0 ? cmd.target : this.findHealTarget(game)); }
      else if (spell.target === 'allEnemy') { fxSide = 'enemy'; fxIdx = -1; }
      else { fxSide = 'enemy'; fxIdx = cmd.target; }
    } else {
      if (spell.type === 'heal') { fxSide = 'enemy'; fxIdx = cmd.actor; }
      else if (cmd.targetType === 'partyAll') { fxSide = 'party'; fxIdx = -1; }
      else { fxSide = 'party'; fxIdx = cmd.target; }
    }
    this.startEffect(game, cmd.spellId, fxSide, fxIdx, fd);
    if (pd) {
      b.partyCast = { idx: cmd.actor, t0: Date.now(), dur: pd, kind: pKind, side: fxSide, targetIdx: fxIdx };
      SoundSystem.chargeUp(pKind);
      setTimeout(function() { if (game.battle === b) SoundSystem.spellHit(pKind); }, pd);
    }
    if (ed && b.enemyCast) { b.enemyCast.side = fxSide; b.enemyCast.targetIdx = fxIdx; }
    if (ed && fxSide === 'party' && spell.type !== 'heal') {
      b.partyHit = { idx: fxIdx, t0: Date.now() + ed, tint: tint };
    }

    // 呪文の効果音 (party casts play theirs via chargeUp / spellHit)
    if (pd) {
      // handled above
    } else if (spell.type === 'heal') {
      SoundSystem.heal();
    } else if (spell.type === 'buff') {
      SoundSystem.buff();
    } else if (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy' || cmd.targetType === 'partyAll') {
      SoundSystem.bigSpell();
    } else if (pKind === 'sweep') {
      SoundSystem.sweep();
    } else {
      SoundSystem.spell();
    }

    if (spell.type === 'magic' || spell.type === 'physical') {
      var bigHit = (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy' || cmd.targetType === 'partyAll');
      var shakeMag = bigHit ? 12 : 7, shakeDur = bigHit ? 450 : 300;
      if (cmd.charged) { shakeMag = 18; shakeDur = 800; }
      if (ed) { shakeMag = Math.round(shakeMag * 1.4); shakeDur += 100; }
      if (pd) { shakeMag = Math.round(shakeMag * 1.25); shakeDur += 80; }
      if (fd) {
        setTimeout(function() { if (game.battle === b) BattleSystem.shake(game, shakeMag, shakeDur); }, fd);
      } else {
        this.shake(game, shakeMag, shakeDur);
      }
      if (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy') {
        var targets = cmd.actorType === 'party' ? b.enemies : game.party;
        for (var i = 0; i < targets.length; i++) {
          if (targets[i].alive) {
            var dmg = this.calcSpellDamage(caster, targets[i], spell);
            if (spell.type === 'physical') dmg = Math.max(1, Math.floor(this.getEffectiveStat(caster, 'atk') * spell.power / 2 - this.getEffectiveStat(targets[i], 'def') * (1 - (spell.pierce || 0)) / 4));
            targets[i].hp = Math.max(0, targets[i].hp - dmg);
            this.pop(game, targets[i], dmg, 'dmg', fd);
            b.messages.push(targets[i].name + 'に ' + dmg + 'の ダメージ！');
            if (targets[i].hp <= 0) {
              targets[i].alive = false;
              targets[i].hp = 0;
              b.messages.push(targets[i].name + 'を たおした！');
            }
          }
        }
      } else if (cmd.targetType === 'partyAll') {
        setTimeout(function() { SoundSystem.damage(); }, ed);
        for (var j = 0; j < game.party.length; j++) {
          if (game.party[j].alive) {
            var dmg2 = this.calcSpellDamage(caster, game.party[j], spell);
            if (cmd.charged) {                       // a stored attack hits 1.5x; guarding halves it
              dmg2 = Math.floor(dmg2 * 1.5);
              if (game.party[j].defending) { dmg2 = Math.floor(dmg2 * 0.5); b.messages.push(game.party[j].name + 'は ガードで 衝撃を やわらげた！'); }
            }
            game.party[j].hp = Math.max(0, game.party[j].hp - dmg2);
            this.pop(game, game.party[j], dmg2, 'dmg', ed);
            b.messages.push(game.party[j].name + 'に ' + dmg2 + 'の ダメージ！');
            if (game.party[j].hp <= 0) {
              game.party[j].alive = false;
              game.party[j].hp = 0;
              b.messages.push(game.party[j].name + 'は たおれた…');
            }
          }
        }
      } else {
        var target = cmd.actorType === 'party' ? b.enemies[cmd.target] : game.party[cmd.target];
        if (!target || !target.alive) {
          if (cmd.actorType === 'party') {
            for (var k = 0; k < b.enemies.length; k++) { if (b.enemies[k].alive) { target = b.enemies[k]; break; } }
          } else {
            target = game.party[this.randomAlivePartyMember(game)];
          }
        }
        if (target && target.alive) {
          var dmg3 = this.calcSpellDamage(caster, target, spell);
          if (spell.type === 'physical') {
            dmg3 = Math.max(1, Math.floor(this.getEffectiveStat(caster, 'atk') * spell.power / 2 - this.getEffectiveStat(target, 'def') * (1 - (spell.pierce || 0)) / 4));
          }
          target.hp = Math.max(0, target.hp - dmg3);
          this.pop(game, target, dmg3, 'dmg', fd);
          b.messages.push(target.name + 'に ' + dmg3 + 'の ダメージ！');
          // Bosses resist: half the chance. Already-stunned targets can't be re-stunned.
          var stunChance = spell.stun * (target.boss ? 0.5 : 1);
          if (spell.stun && target.hp > 0 && !target.stunTurns && Math.random() < stunChance) {
            target.stunTurns = 1;
            b.messages.push(target.name + 'は しびれて 動けない！');
            // Visual only: shock arcs, dizzy stars and a "スタン！" label once the hit lands
            target.stunAt = Date.now() + (fd || this.PARTY_ATTACK_DELAY);
            var stunB = b;
            setTimeout(function() { if (game.battle === stunB) SoundSystem.stunHit(); }, fd || this.PARTY_ATTACK_DELAY);
          }
          if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;
            var defeatMsg = cmd.actorType === 'party' ? (target.name + 'を たおした！') : (target.name + 'は たおれた…');
            b.messages.push(defeatMsg);
          }
        }
      }
    } else if (spell.type === 'heal') {
      var healTarget;
      if (cmd.targetType === 'self') {
        healTarget = caster;
      } else {
        healTarget = game.party[cmd.target] || game.party[this.findHealTarget(game)];
      }
      if (healTarget && healTarget.alive) {
        var heal = spell.power + Math.floor(Math.random() * 10 - 5);
        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
        this.pop(game, healTarget, heal, 'heal', fd);
        if (fd) healTarget.hpBarUntil = Date.now() + fd + 2000;
        b.messages.push(healTarget.name + 'の HPが ' + heal + ' かいふくした！');
      }
    } else if (spell.type === 'cure') {
      var cTarget = game.party[cmd.target] || game.party[0];
      if (cTarget && cTarget.alive && cTarget.poisoned) {
        cTarget.poisoned = false;
        this.cureFx(game, game.party.indexOf(cTarget), fd);
        b.messages.push(cTarget.name + 'の 毒が きえた！');
      } else {
        b.messages.push('しかし なにも おこらなかった！');
      }
    } else if (spell.type === 'debuff') {
      var dTargets = [];
      if (spell.target === 'allEnemy') {
        for (var dq = 0; dq < b.enemies.length; dq++) { if (b.enemies[dq].alive) dTargets.push(b.enemies[dq]); }
      } else {
        var dt0 = b.enemies[cmd.target];
        if (!dt0 || !dt0.alive) { for (var dk = 0; dk < b.enemies.length; dk++) { if (b.enemies[dk].alive) { dt0 = b.enemies[dk]; break; } } }
        if (dt0 && dt0.alive) dTargets.push(dt0);
      }
      var statWord = this.STAT_WORDS[spell.stat] || 'ちから';
      for (var dm = 0; dm < dTargets.length; dm++) {
        if (!dTargets[dm].buffs) dTargets[dm].buffs = {};
        dTargets[dm].buffs[spell.stat] = { mult: spell.mult, turns: spell.turns };
        dTargets[dm].debuffAt = Date.now() + fd + dm * 90;
        dTargets[dm].debuffStat = spell.stat;
        b.messages.push(dTargets[dm].name + 'の ' + statWord + 'が さがった！');
      }
    } else if (spell.type === 'sleep') {
      // Each living enemy may fall asleep and loses its next `turns` actions; bosses and enemies already out of action resist
      var slept = 0;
      for (var sq = 0; sq < b.enemies.length; sq++) {
        var se = b.enemies[sq];
        if (!se.alive) continue;
        if (se.boss || se.sleepTurns > 0 || se.stunTurns > 0 || Math.random() >= spell.chance) {
          b.messages.push(se.name + 'には きかなかった！');
          continue;
        }
        se.sleepTurns = spell.turns;
        se.sleepAt = Date.now() + (fd || 0) + sq * 90;
        slept++;
        b.messages.push(se.name + 'は ねむってしまった！');
        if (se.charging) se.charging = false;
      }
    } else if (spell.type === 'buff') {
      b.messages.push('味方全体の ' + (this.STAT_WORDS[spell.stat] || 'ちから') + 'が あがった！');
      for (var m = 0; m < game.party.length; m++) {
        if (game.party[m].alive) {
          if (!game.party[m].buffs) game.party[m].buffs = {};
          game.party[m].buffs[spell.stat] = { mult: spell.mult, turns: spell.turns };
        }
      }
    }
    b.messageTimer = 20 + b.messages.length * 15 + Math.round(pd / 16);
  },

  executeItem: function(game, cmd) {
    this._curKind = null;
    var b = game.battle;
    var item = ITEMS[cmd.itemId];
    var user = game.party[cmd.actor];

    // Remove item from inventory
    for (var i = 0; i < game.inventory.length; i++) {
      if (game.inventory[i].id === cmd.itemId) {
        game.inventory[i].count--;
        if (game.inventory[i].count <= 0) game.inventory.splice(i, 1);
        break;
      }
    }

    b.messages = [user.name + 'は ' + item.name + 'を つかった！'];

    // Item effect: the item is tossed to its target, then the effect lands after d ms
    var fxId = item.fx || cmd.itemId;   // items may borrow another item's visuals and sound
    var d = fxId === 'bomb' ? 420 : 220;
    var fxTarget = -1, fxSide = 'party';
    if (item.type === 'heal' || item.type === 'healMp' || item.type === 'cure') fxTarget = cmd.target >= 0 && game.party[cmd.target] ? cmd.target : 0;
    else if (item.type === 'revive') {
      for (var rv = 0; rv < game.party.length; rv++) { if (!game.party[rv].alive) { fxTarget = rv; break; } }
    } else if (item.type === 'damage') {
      fxSide = 'enemy';
      fxTarget = b.enemies[cmd.target] && b.enemies[cmd.target].alive ? cmd.target : -1;
    }
    if (fxTarget >= 0) {
      b.itemFx = { id: fxId, side: fxSide, idx: fxTarget, from: cmd.actor, t0: Date.now(), d: d,
                   dur: d + (cmd.itemId === 'phoenix' ? 1100 : 800) };
      SoundSystem.itemToss();
      setTimeout(function() {
        if (game.battle !== b) return;
        if (cmd.itemId !== 'antidote') SoundSystem.itemHit(fxId);
        if (fxId === 'bomb') BattleSystem.shake(game, 12, 420);
        else if (cmd.itemId === 'phoenix') BattleSystem.shake(game, 5, 300);
      }, d);
    }

    if (item.type === 'heal') {
      var target = game.party[cmd.target] || game.party[0];
      var heal = item.power;
      target.hp = Math.min(target.maxHp, target.hp + heal);
      this.pop(game, target, heal, 'heal', d);
      b.messages.push(target.name + 'の HPが ' + heal + ' かいふくした！');
    } else if (item.type === 'healMp') {
      var tgt = game.party[cmd.target] || game.party[0];
      tgt.mp = Math.min(tgt.maxMp, tgt.mp + item.power);
      this.pop(game, tgt, item.power, 'mp', d);
      b.messages.push(tgt.name + 'の MPが ' + item.power + ' かいふくした！');
    } else if (item.type === 'damage') {
      var enemy = b.enemies[cmd.target];
      if (enemy && enemy.alive) {
        enemy.hp = Math.max(0, enemy.hp - item.power);
        this._curKind = 'fire';   // blast tints the enemy's hit reaction
        this.pop(game, enemy, item.power, 'dmg', d);
        b.messages.push(enemy.name + 'に ' + item.power + 'の ダメージ！');
        if (enemy.hp <= 0) {
          enemy.alive = false;
          enemy.hp = 0;
          b.messages.push(enemy.name + 'を たおした！');
        }
      }
    } else if (item.type === 'cure') {
      var ct = game.party[cmd.target] && game.party[cmd.target].poisoned ? game.party[cmd.target] : null;
      if (!ct) { for (var cc = 0; cc < game.party.length; cc++) { if (game.party[cc].alive && game.party[cc].poisoned) { ct = game.party[cc]; break; } } }
      if (ct) {
        ct.poisoned = false;
        this.cureFx(game, game.party.indexOf(ct), d);
        b.messages.push(ct.name + 'の 毒が きえた！');
      } else {
        b.messages.push('しかし なにも おこらなかった！');
      }
    } else if (item.type === 'revive') {
      // Find first dead party member
      for (var j = 0; j < game.party.length; j++) {
        if (!game.party[j].alive) {
          game.party[j].alive = true;
          game.party[j].hp = Math.floor(game.party[j].maxHp * item.power);
          this.pop(game, game.party[j], game.party[j].hp, 'heal', d);
          b.messages.push(game.party[j].name + 'は 生き返った！');
          break;
        }
      }
    }
    b.messageTimer = 20 + b.messages.length * 15 + (b.itemFx ? Math.round(d / 16) : 0);
  },

  calcSpellDamage: function(caster, target, spell) {
    var intStat = caster.int || caster.atk;
    var base = (spell.power + Math.floor(intStat * 0.5)) * (caster.buffs && caster.buffs.int ? caster.buffs.int.mult : 1);   // Magic Boost: x1.3 magic damage
    var def = this.getEffectiveStat(target, 'def');
    return Math.max(1, Math.floor(base - def / 6 + (Math.random() * 8 - 4)));
  },

  getEffectiveStat: function(char, stat) {
    var base = char[stat] || 0;
    // Equipment bonuses are already included in char stats
    if (char.buffs && char.buffs[stat]) {
      base = Math.floor(base * char.buffs[stat].mult);
    }
    return base;
  },

  tickBuffs: function(game) {
    var all = game.party.concat(game.battle.enemies);
    for (var i = 0; i < all.length; i++) {
      if (all[i].buffs) {
        for (var stat in all[i].buffs) {
          all[i].buffs[stat].turns--;
          if (all[i].buffs[stat].turns <= 0) delete all[i].buffs[stat];
        }
      }
      all[i].defending = false;
    }
    // Poison gnaws at the party each round (never lethal: it stops at 1 HP)
    var poisonedAny = false;
    for (var pj = 0; pj < game.party.length; pj++) {
      var pm = game.party[pj];
      if (!pm.alive || !pm.poisoned) continue;
      var pdmg = Math.min(Math.max(1, Math.floor(pm.maxHp / 16)), Math.max(0, pm.hp - 1));
      pm.hp -= pdmg;
      if (pdmg > 0) this.pop(game, pm, pdmg, 'poison');
      pm.hpBarUntil = Date.now() + 2000;
      poisonedAny = true;
    }
    if (poisonedAny) {
      game.battle.messages = ['毒の ダメージを うけた！'];
      game.battle.messageTimer = 40;
      SoundSystem.poisonTick();
    }
  },

  checkWin: function(game) {
    var b = game.battle;
    var allDead = b.enemies.every(function(e) { return !e.alive; });
    if (allDead) {
      var totalExp = 0, totalGold = 0;
      for (var i = 0; i < b.enemies.length; i++) {
        totalExp += b.enemies[i].exp;
        totalGold += b.enemies[i].gold;
      }
      b.totalExp = totalExp;
      b.totalGold = totalGold;
      b.messages = ['戦闘に 勝利した！', totalExp + 'の 経験値を 獲得！', totalGold + 'ゴールド 手に入れた！'];
      if (b.newEntries && b.newEntries.length) HintSystem.show(game, 'bestiary');
      if (b.newEntries && b.newEntries.length) b.messages.push(b.newEntries.join('、') + 'を ずかんに とうろくした！');
      var bossWin = b.enemies.some(function(e) { return e.finale; });   // only the Demon King ends the game
      if (bossWin) b.messages = ['魔王ヴァルザードを たおした！', '世界に 光が もどっていく…'];
      else if (game.pendingBoss) b.messages.unshift(b.enemies[0].name + 'を たおした！');
      game.gold += totalGold;
      b.phase = 'win';
      b.winStart = Date.now();
      b.bossWin = bossWin;
      b.messageTimer = bossWin ? 330 : 360;   // long enough for the victory fanfare to play out (confirm skips it)
      // The victory fanfare is now the BGM track (see getBattleBgm in main.js)
      return true;
    }
    return false;
  },

  checkLose: function(game) {
    var allDead = game.party.every(function(p) { return !p.alive; });
    if (allDead) {
      game.battle.messages = ['全滅してしまった…'];
      game.battle.phase = 'lose';
      game.battle.loseStart = Date.now();
      game.battle.messageTimer = 60;
      SoundSystem.gameOver();
      return true;
    }
    return false;
  },

  handleWin: function(game) {
    var b = game.battle;
    if (typeof updateScoreAfterBattle === 'function') updateScoreAfterBattle(b);
    // Award EXP and check level ups
    b.levelUps = [];
    for (var i = 0; i < game.party.length; i++) {
      if (game.party[i].alive) {
        game.party[i].exp += b.totalExp;
        var leveledUp = this.checkLevelUp(game.party[i]);
        if (leveledUp) b.levelUps.push(leveledUp);
      }
    }
    if (b.levelUps.length > 0) {
      b.phase = 'levelup';
      b.levelUpIndex = 0;
      SoundSystem.levelUp();
    } else {
      this.afterWin(game);
    }
  },

  // Back to the map after a won fight. A won boss fight flags its event; the Demon King's starts the
  // ending (after parking the party outside the castle and saving, so つづきから resumes the post-game),
  // other bosses (ending: false) show their closing lines and play goes on.
  afterWin: function(game) {
    RecordsSystem.check(game);
    var pb = game.pendingBoss;
    game.state = 'map';
    game.battle = null;
    game.pendingBoss = null;
    if (pb) {
      game.flags[pb.flag] = true;
      if (pb.ending === false) {
        if (pb.postBattle) { game.dialogue = pb.postBattle; game.dialogueIndex = 0; game.state = 'dialogue'; }
      } else {
        game.currentMap = 'world'; game.playerX = 12; game.playerY = 5; game.facing = 'down';
        game.state = 'ending';
      }
    }
    if (typeof saveGame === 'function') saveGame();
  },

  checkLevelUp: function(char) {
    var needed = expForLevel(char.level + 1);
    if (char.exp >= needed) {
      char.level++;
      var charDef = CHARACTERS[char.classId];
      var oldStats = { hp: char.maxHp, mp: char.maxMp, atk: char.atk, def: char.def, spd: char.spd, int: char.int };
      char.maxHp += charDef.growth.hp + Math.floor(Math.random() * 3);
      char.maxMp += charDef.growth.mp + Math.floor(Math.random() * 2);
      char.atk += charDef.growth.atk + Math.floor(Math.random() * 2);
      char.def += charDef.growth.def + Math.floor(Math.random() * 2);
      char.spd += charDef.growth.spd + Math.floor(Math.random() * 1);
      char.int += charDef.growth.int + Math.floor(Math.random() * 2);
      char.hp = char.maxHp;
      char.mp = char.maxMp;
      // Check for new spells
      var newSpell = null;
      for (var i = 0; i < charDef.spells.length; i++) {
        if (charDef.spells[i].learnLevel === char.level) {
          newSpell = SPELLS[charDef.spells[i].id].name;
        }
      }

      return {
        name: char.name,
        level: char.level,
        oldStats: oldStats,
        newStats: { hp: char.maxHp, mp: char.maxMp, atk: char.atk, def: char.def, spd: char.spd, int: char.int },
        newSpell: newSpell,
      };
    }
    return null;
  },
};
