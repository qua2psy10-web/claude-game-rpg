// ============================================================
// battle.js — Dragon Quest-style turn-based battle system
// ============================================================

var BattleSystem = {

  // Start a new battle
  startBattle: function(game, enemyIds) {
    var enemies = [];
    for (var i = 0; i < enemyIds.length; i++) {
      var template = ENEMIES[enemyIds[i]];
      enemies.push({
        id: enemyIds[i],
        name: template.name + (enemyIds.length > 1 && enemyIds.filter(function(e) { return e === enemyIds[i]; }).length > 1 ? String.fromCharCode(65 + i) : ''),
        hp: template.hp,
        maxHp: template.hp,
        atk: template.atk,
        def: template.def,
        spd: template.spd,
        int: template.int,
        exp: template.exp,
        gold: template.gold,
        color: template.color,
        shape: template.shape,
        boss: template.boss || false,
        skills: template.skills || [],
        alive: true,
        buffs: {},
      });
    }

    game.battle = {
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
    };
    game.state = 'battle';
    game.battle.messages = [this.getEncounterMessage(enemies)];
    game.battle.messageTimer = 60;
    SoundSystem.battleStart();
  },

  // Trigger a screen shake: mag in px, dur in ms
  shake: function(game, mag, dur) {
    var b = game.battle;
    if (!b) return;
    b.shakeMag = mag;
    b.shakeDur = dur;
    b.shakeUntil = Date.now() + dur;
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
          if (b.levelUpIndex >= b.levelUps.length) {
            game.state = 'map';
            game.battle = null;
            if (game.pendingBoss) {
              game.flags[game.pendingBoss.flag] = true;
              game.pendingBoss = null;
              game.state = 'ending';
            } else {
              if (typeof saveGame === 'function') saveGame();
            }
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
        b.commands.push({
          actor: b.currentChar,
          actorType: 'party',
          action: 'item',
          itemId: invItem.id,
          target: this.findHealTarget(game),
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

  getEnemyAction: function(enemy, game) {
    var idx = game.battle.enemies.indexOf(enemy);

    // Boss AI
    if (enemy.boss && enemy.hp < enemy.maxHp * 0.3 && enemy.skills.indexOf('enemyHeal') >= 0 && Math.random() < 0.4) {
      return { actor: idx, actorType: 'enemy', action: 'spell', spellId: 'enemyHeal', target: idx, targetType: 'self' };
    }
    if (enemy.skills.length > 0 && Math.random() < 0.35) {
      var skill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
      var spell = SPELLS[skill];
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

    // Handle run
    if (cmd.action === 'run') {
      b.escapeAttempts++;
      var anyBoss = b.enemies.some(function(e) { return e.boss && e.alive; });
      if (anyBoss) {
        b.messages = ['しかし 逃げられない！'];
        b.messageTimer = 40;
      } else if (Math.random() < 0.5 + b.escapeAttempts * 0.1) {
        b.messages = ['うまく逃げ切れた！'];
        b.messageTimer = 40;
        b.phase = 'run';
        SoundSystem.escape();
      } else {
        b.messages = ['しかし 回り込まれてしまった！'];
        b.messageTimer = 40;
      }
      return;
    }

    // Handle defend
    if (cmd.action === 'defend') {
      var defender = cmd.actorType === 'party' ? game.party[cmd.actor] : b.enemies[cmd.actor];
      defender.defending = true;
      b.messages = [defender.name + 'は 身を守っている。'];
      b.messageTimer = 30;
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

    b.messages = [attacker.name + 'の こうげき！', defender.name + 'に ' + damage + 'の ダメージ！'];
    if (cmd.actorType === 'party') {
      b.flashEnemy = cmd.target;
      SoundSystem.attack();
      this.shake(game, 5, 260);
    } else {
      b.flashParty = cmd.target;
      SoundSystem.damage();
      this.shake(game, 9, 340);
    }
    b.messageTimer = 45;

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

    // 呪文の効果音
    if (spell.type === 'heal') {
      SoundSystem.heal();
    } else if (spell.type === 'buff') {
      SoundSystem.buff();
    } else if (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy' || cmd.targetType === 'partyAll') {
      SoundSystem.bigSpell();
    } else {
      SoundSystem.spell();
    }

    if (spell.type === 'magic' || spell.type === 'physical') {
      var bigHit = (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy' || cmd.targetType === 'partyAll');
      this.shake(game, bigHit ? 12 : 7, bigHit ? 450 : 300);
      if (spell.target === 'allEnemy' || cmd.targetType === 'allEnemy') {
        var targets = cmd.actorType === 'party' ? b.enemies : game.party;
        for (var i = 0; i < targets.length; i++) {
          if (targets[i].alive) {
            var dmg = this.calcSpellDamage(caster, targets[i], spell);
            targets[i].hp = Math.max(0, targets[i].hp - dmg);
            b.messages.push(targets[i].name + 'に ' + dmg + 'の ダメージ！');
            if (targets[i].hp <= 0) {
              targets[i].alive = false;
              targets[i].hp = 0;
              b.messages.push(targets[i].name + 'を たおした！');
            }
          }
        }
      } else if (cmd.targetType === 'partyAll') {
        SoundSystem.damage();
        for (var j = 0; j < game.party.length; j++) {
          if (game.party[j].alive) {
            var dmg2 = this.calcSpellDamage(caster, game.party[j], spell);
            game.party[j].hp = Math.max(0, game.party[j].hp - dmg2);
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
            dmg3 = Math.max(1, Math.floor(this.getEffectiveStat(caster, 'atk') * spell.power / 2 - this.getEffectiveStat(target, 'def') / 4));
          }
          target.hp = Math.max(0, target.hp - dmg3);
          b.messages.push(target.name + 'に ' + dmg3 + 'の ダメージ！');
          if (spell.stun && Math.random() < spell.stun) {
            b.messages.push(target.name + 'は しびれて 動けない！');
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
        b.messages.push(healTarget.name + 'の HPが ' + heal + ' かいふくした！');
      }
    } else if (spell.type === 'buff') {
      b.messages.push('味方全体の ' + (spell.stat === 'atk' ? 'こうげき力' : 'しゅび力') + 'が あがった！');
      for (var m = 0; m < game.party.length; m++) {
        if (game.party[m].alive) {
          if (!game.party[m].buffs) game.party[m].buffs = {};
          game.party[m].buffs[spell.stat] = { mult: spell.mult, turns: spell.turns };
        }
      }
    }
    b.messageTimer = 20 + b.messages.length * 15;
  },

  executeItem: function(game, cmd) {
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

    if (item.type === 'heal') {
      var target = game.party[cmd.target] || game.party[0];
      var heal = item.power;
      target.hp = Math.min(target.maxHp, target.hp + heal);
      b.messages.push(target.name + 'の HPが ' + heal + ' かいふくした！');
    } else if (item.type === 'healMp') {
      var tgt = game.party[cmd.target] || game.party[0];
      tgt.mp = Math.min(tgt.maxMp, tgt.mp + item.power);
      b.messages.push(tgt.name + 'の MPが ' + item.power + ' かいふくした！');
    } else if (item.type === 'damage') {
      var enemy = b.enemies[cmd.target];
      if (enemy && enemy.alive) {
        enemy.hp = Math.max(0, enemy.hp - item.power);
        b.messages.push(enemy.name + 'に ' + item.power + 'の ダメージ！');
        if (enemy.hp <= 0) {
          enemy.alive = false;
          enemy.hp = 0;
          b.messages.push(enemy.name + 'を たおした！');
        }
      }
    } else if (item.type === 'revive') {
      // Find first dead party member
      for (var j = 0; j < game.party.length; j++) {
        if (!game.party[j].alive) {
          game.party[j].alive = true;
          game.party[j].hp = Math.floor(game.party[j].maxHp * item.power);
          b.messages.push(game.party[j].name + 'は 生き返った！');
          break;
        }
      }
    }
    b.messageTimer = 20 + b.messages.length * 15;
  },

  calcSpellDamage: function(caster, target, spell) {
    var intStat = caster.int || caster.atk;
    var base = spell.power + Math.floor(intStat * 0.5);
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
      game.gold += totalGold;
      b.phase = 'win';
      b.messageTimer = 60;
      SoundSystem.victory();
      return true;
    }
    return false;
  },

  checkLose: function(game) {
    var allDead = game.party.every(function(p) { return !p.alive; });
    if (allDead) {
      game.battle.messages = ['全滅してしまった…'];
      game.battle.phase = 'lose';
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
    } else {
      game.state = 'map';
      game.battle = null;
      if (game.pendingBoss) {
        game.flags[game.pendingBoss.flag] = true;
        game.pendingBoss = null;
        game.state = 'ending';
      } else {
        if (typeof saveGame === 'function') saveGame();
      }
    }
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
      SoundSystem.levelUp();

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

  // Perspective battle backdrop: sky, mountains, fogged horizon, gridded floor
  renderBackdrop: function(ctx, w, h, groundY) {
    var sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#05051a');
    sky.addColorStop(0.7, '#2a1a4a');
    sky.addColorStop(1, '#5a3a62');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);

    // Stars
    ctx.fillStyle = 'rgba(255,255,220,0.7)';
    for (var st = 0; st < 30; st++) {
      ctx.fillRect((st * 97) % w, (st * 53) % (groundY * 0.6), 1, 1);
    }

    // Far mountains (two layers for parallax depth)
    var layers = [{ c: '#2a2044', amp: 34, f: 0.011, base: groundY - 6 },
                  { c: '#1a1530', amp: 22, f: 0.019, base: groundY }];
    for (var l = 0; l < layers.length; l++) {
      ctx.fillStyle = layers[l].c;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (var x = 0; x <= w; x += 8) {
        var y = layers[l].base - layers[l].amp * (0.5 + 0.5 * Math.sin(x * layers[l].f + l * 2) * Math.cos(x * 0.004 + l));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();
    }

    // Floor
    var floor = ctx.createLinearGradient(0, groundY, 0, h);
    floor.addColorStop(0, '#3a3450');
    floor.addColorStop(1, '#0c0b16');
    ctx.fillStyle = floor;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Perspective grid: lines converge on the vanishing point
    var vx = w / 2;
    ctx.strokeStyle = 'rgba(160,150,200,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = -12; k <= 12; k++) {
      ctx.moveTo(vx + k * 14, groundY);
      ctx.lineTo(vx + k * 120, h);
    }
    // Horizontal lines spaced by t^2 (nearer = wider apart)
    for (var r = 1; r <= 9; r++) {
      var t = r / 9;
      var yy = groundY + (h - groundY) * t * t;
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
    }
    ctx.stroke();

    // Horizon fog
    var fog = ctx.createLinearGradient(0, groundY - 30, 0, groundY + 50);
    fog.addColorStop(0, 'rgba(120,90,150,0)');
    fog.addColorStop(0.5, 'rgba(120,90,150,0.35)');
    fog.addColorStop(1, 'rgba(120,90,150,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, groundY - 30, w, 80);
  },

  // ===== BATTLE RENDERING =====
  render: function(ctx, game, canvasW, canvasH) {
    var b = game.battle;
    if (!b) return;

    var groundY = Math.floor(canvasH * 0.42);
    var now = Date.now();
    // Screen shake (scene only; UI windows stay steady)
    ctx.save();
    var shakeLeft = (b.shakeUntil || 0) - now;
    if (shakeLeft > 0) {
      var amp = (b.shakeMag || 0) * Math.min(1, shakeLeft / (b.shakeDur || 1));
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
    this.renderBackdrop(ctx, canvasW, canvasH, groundY);

    // Draw enemies in 3D-ish depth (alternating rows, back row smaller & higher)
    var aliveEnemies = [];
    for (var i = 0; i < b.enemies.length; i++) {
      if (b.enemies[i].alive) aliveEnemies.push({ enemy: b.enemies[i], index: i });
    }
    var spacing = canvasW / (aliveEnemies.length + 1);
    var order = aliveEnemies.map(function(e, n) { return n; });
    // Draw back row first so front enemies overlap correctly
    order.sort(function(p, q) { return (q % 2) - (p % 2); });
    for (var oi = 0; oi < order.length; oi++) {
      var j = order[oi];
      var en = aliveEnemies[j].enemy;
      var back = (aliveEnemies.length > 1 && j % 2 === 1);
      var depth = back ? 0.85 : 1.1;
      var scale = (en.boss ? 1.8 : 1) * depth;
      var ex = spacing * (j + 1);
      var footY = groundY + (back ? 46 : 84) + (en.boss ? 10 : 0);
      var bob = Math.sin(now / 420 + j * 1.7) * 3;
      var ey = footY - 22 * scale + bob;

      // Boss aura
      if (en.boss) {
        var aura = ctx.createRadialGradient(ex, ey, 10, ex, ey, 120);
        aura.addColorStop(0, 'rgba(200,40,60,0.35)');
        aura.addColorStop(1, 'rgba(200,40,60,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(ex - 130, ey - 130, 260, 260);
      }

      // Ground shadow (shrinks as the enemy bobs up)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(ex, footY + 2, 30 * scale - bob, 7 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flash effect
      if (b.flashEnemy === aliveEnemies[j].index) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(ex - 40 * scale, ey - 60 * scale, 80 * scale, 80 * scale);
      }
      UI.drawEnemy(ctx, en, ex, ey, scale);

      // Atmospheric fog on distant enemies
      if (back) {
        ctx.fillStyle = 'rgba(30,30,60,0.18)';
        ctx.fillRect(ex - 45 * scale, ey - 55 * scale, 90 * scale, 90 * scale);
      }

      // Target cursor
      if (b.phase === 'targeting' && j === b.targetIndex) {
        var cy0 = ey - 50 * scale - 20 + Math.sin(now / 150) * 3;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(ex, cy0);
        ctx.lineTo(ex - 8, cy0 - 12);
        ctx.lineTo(ex + 8, cy0 - 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Vignette for depth/cinematic feel
    var vg = ctx.createRadialGradient(canvasW / 2, canvasH * 0.45, canvasH * 0.3, canvasW / 2, canvasH * 0.45, canvasW * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);
    ctx.restore();

    // Party status panel (right side)
    UI.drawWindow(ctx, canvasW - 220, canvasH - 200, 215, 120);
    for (var k = 0; k < game.party.length; k++) {
      var py = canvasH - 190 + k * 36;
      var px = canvasW - 206;
      var p = game.party[k];
      var nameColor = p.alive ? '#fff' : '#888';
      if (b.flashParty === k) nameColor = '#f44';
      UI.drawText(ctx, p.name, px, py, nameColor, UI.FONT_SMALL);
      UI.drawText(ctx, 'HP ' + p.hp + '/' + p.maxHp, px + 72, py, p.hp <= p.maxHp * 0.25 ? '#f44' : '#fff', UI.FONT_SMALL);
      UI.drawText(ctx, 'MP ' + p.mp + '/' + p.maxMp, px + 72, py + 16, '#aaf', UI.FONT_SMALL);
    }

    // Command menu (during command phase)
    if (b.phase === 'command' && b.currentChar < game.party.length) {
      var charName = game.party[b.currentChar].name;
      UI.drawWindow(ctx, 10, canvasH - 200, 160, 30);
      UI.drawText(ctx, charName + 'の ばん', 22, canvasH - 192);
      UI.drawMenu(ctx, 10, canvasH - 166, 160,
        ['たたかう', 'じゅもん', 'どうぐ', 'ぼうぎょ', 'にげる'],
        b.commandIndex);
    }

    // Spell selection
    if (b.phase === 'spellSelect' && b.currentChar < game.party.length) {
      var spells = this.getAvailableSpells(game.party[b.currentChar]);
      var spellNames = spells.map(function(s) {
        var sp = SPELLS[s.id];
        return sp.name + ' ' + sp.mp + 'MP';
      });
      UI.drawMenu(ctx, 10, canvasH - 200, 220, spellNames, b.spellIndex);
    }

    // Ally target selection
    if (b.phase === 'allyTarget') {
      UI.drawWindow(ctx, 10, canvasH - 200, 180, game.party.length * 26 + 20);
      UI.drawText(ctx, 'だれに？', 22, canvasH - 192, '#ffd700');
      for (var at = 0; at < game.party.length; at++) {
        var aty = canvasH - 166 + at * 26;
        if (at === b.targetIndex) UI.drawText(ctx, UI.CURSOR, 22, aty);
        var atColor = game.party[at].alive ? '#fff' : '#888';
        UI.drawText(ctx, game.party[at].name + ' HP' + game.party[at].hp + '/' + game.party[at].maxHp, 44, aty, atColor, UI.FONT_SMALL);
      }
    }

    // Item selection
    if (b.phase === 'itemSelect') {
      var itemNames = game.inventory.map(function(inv) {
        return ITEMS[inv.id].name + ' x' + inv.count;
      });
      UI.drawMenu(ctx, 10, canvasH - 200, 200, itemNames, b.itemIndex);
    }

    // Message window
    if (b.messages.length > 0) {
      UI.drawMessageWindow(ctx, b.messages, canvasW, canvasH);
    }

    // Level up display
    if (b.phase === 'levelup' && b.levelUpIndex < b.levelUps.length) {
      var lu = b.levelUps[b.levelUpIndex];
      UI.drawWindow(ctx, 100, 80, 440, 200);
      UI.drawText(ctx, lu.name + 'は レベル ' + lu.level + 'に あがった！', 120, 95, '#ffd700');
      var stats = ['hp', 'mp', 'atk', 'def', 'spd', 'int'];
      var statNames = ['HP', 'MP', 'ATK', 'DEF', 'SPD', 'INT'];
      for (var s = 0; s < stats.length; s++) {
        var diff = lu.newStats[stats[s]] - lu.oldStats[stats[s]];
        UI.drawText(ctx, statNames[s] + ': ' + lu.oldStats[stats[s]] + ' → ' + lu.newStats[stats[s]] + ' (+' + diff + ')', 120, 125 + s * 22, '#fff', UI.FONT_SMALL);
      }
      if (lu.newSpell) {
        UI.drawText(ctx, lu.newSpell + 'を おぼえた！', 120, 260, '#8ff');
      }
    }
  },
};
