// ============================================================
// data.js — All game data for claude-game-rpg
// ============================================================

// ===== TILE DEFINITIONS =====
var TILES = {
  'G': { name: '草原', color: '#5b8c3e', passable: true, encounter: true },
  'F': { name: '森', color: '#2d5a1e', passable: true, encounter: true },
  'M': { name: '山', color: '#8b7355', passable: false },
  'W': { name: '海', color: '#3b7dd8', passable: false },
  'R': { name: '道', color: '#c4a265', passable: true, encounter: false },
  'S': { name: '砂', color: '#d4b877', passable: true, encounter: true },
  'w': { name: '壁', color: '#666666', passable: false },
  'f': { name: '床', color: '#a08060', passable: true, encounter: false },
  'd': { name: 'ドア', color: '#8b6b3a', passable: true, encounter: false },
  'c': { name: 'カウンター', color: '#6b4a2a', passable: false },
  'D': { name: '闇の床', color: '#3a3a5c', passable: true, encounter: true },
  'X': { name: '闇の壁', color: '#252535', passable: false },
  'L': { name: '溶岩', color: '#e05030', passable: false },
  'T': { name: '玉座', color: '#8b5aab', passable: true, encounter: false },
  'B': { name: '橋', color: '#9a7b4f', passable: true, encounter: false },
  'E': { name: '入口', color: '#c4a265', passable: true, encounter: false },
  'I': { name: '看板', color: '#9a7b4f', passable: false },
  '.': { name: '草花', color: '#6b9b4e', passable: true, encounter: false },
  'r': { name: '赤絨毯', color: '#8b3030', passable: true, encounter: false },
};

// ===== CHARACTER DEFINITIONS =====
var CHARACTERS = {
  sam: {
    name: 'サム', nameEn: 'Sam', class: '戦士',
    baseStats: { hp: 45, mp: 5, atk: 12, def: 10, spd: 8, int: 3 },
    growth: { hp: 8, mp: 1, atk: 3, def: 3, spd: 1, int: 1 },
    spells: [
      { id: 'powerSlash', learnLevel: 1 },
      { id: 'shieldBash', learnLevel: 5 },
      { id: 'warCry', learnLevel: 10 },
    ],
    color: '#4488cc',
  },
  dario: {
    name: 'ダリオ', nameEn: 'Dario', class: '魔法使い',
    baseStats: { hp: 28, mp: 20, atk: 5, def: 5, spd: 10, int: 14 },
    growth: { hp: 4, mp: 5, atk: 1, def: 1, spd: 2, int: 4 },
    spells: [
      { id: 'fire', learnLevel: 1 },
      { id: 'iceStorm', learnLevel: 7 },
      { id: 'thunder', learnLevel: 12 },
    ],
    color: '#cc4488',
  },
  sundar: {
    name: 'スンダー', nameEn: 'Sundar', class: '僧侶',
    baseStats: { hp: 35, mp: 18, atk: 7, def: 8, spd: 9, int: 10 },
    growth: { hp: 6, mp: 4, atk: 2, def: 2, spd: 1, int: 3 },
    spells: [
      { id: 'heal', learnLevel: 1 },
      { id: 'protect', learnLevel: 6 },
      { id: 'holyLight', learnLevel: 10 },
    ],
    color: '#44cc88',
  },
};

// ===== SPELL DEFINITIONS =====
var SPELLS = {
  powerSlash:  { name: 'パワースラッシュ', mp: 3, type: 'physical', target: 'enemy', power: 1.5, desc: '強力な一撃' },
  shieldBash:  { name: 'シールドバッシュ', mp: 5, type: 'physical', target: 'enemy', power: 1.2, stun: 0.3, desc: '盾で殴りスタンさせる' },
  warCry:      { name: 'ウォークライ', mp: 8, type: 'buff', target: 'party', stat: 'atk', mult: 1.25, turns: 3, desc: '味方全体の攻撃力UP' },
  fire:        { name: 'ファイア', mp: 4, type: 'magic', target: 'enemy', power: 24, desc: '炎で敵一体を攻撃' },
  iceStorm:    { name: 'アイスストーム', mp: 8, type: 'magic', target: 'allEnemy', power: 18, desc: '吹雪で敵全体を攻撃' },
  thunder:     { name: 'サンダー', mp: 12, type: 'magic', target: 'enemy', power: 48, desc: '雷で敵一体を大ダメージ' },
  heal:        { name: 'ヒール', mp: 4, type: 'heal', target: 'ally', power: 50, desc: '味方一人のHPを回復' },
  protect:     { name: 'プロテクト', mp: 6, type: 'buff', target: 'party', stat: 'def', mult: 1.25, turns: 3, desc: '味方全体の防御力UP' },
  holyLight:   { name: 'ホーリーライト', mp: 10, type: 'magic', target: 'allEnemy', power: 42, desc: '聖なる光で敵全体を攻撃' },
  enemyFire:   { name: '火炎', mp: 0, type: 'magic', target: 'ally', power: 20, desc: '' },
  enemyDark:   { name: '暗黒の波動', mp: 0, type: 'magic', target: 'partyAll', power: 30, desc: '' },
  enemyHeal:   { name: '回復', mp: 0, type: 'heal', target: 'self', power: 60, desc: '' },
};

// ===== ENEMY DEFINITIONS =====
var ENEMIES = {
  slime:        { name: 'スライム', hp: 10, atk: 5, def: 2, spd: 3, int: 1, exp: 4, gold: 3, color: '#44aaff', shape: 'slime', skills: [] },
  goblin:       { name: 'ゴブリン', hp: 18, atk: 9, def: 5, spd: 7, int: 2, exp: 10, gold: 8, color: '#55aa44', shape: 'goblin', skills: [] },
  wolf:         { name: 'ウルフ', hp: 22, atk: 13, def: 4, spd: 12, int: 2, exp: 14, gold: 6, color: '#888899', shape: 'wolf', skills: [] },
  giantBat:     { name: 'ジャイアントバット', hp: 20, atk: 11, def: 6, spd: 14, int: 3, exp: 18, gold: 10, color: '#774455', shape: 'bat', skills: [] },
  skeleton:     { name: 'スケルトン', hp: 35, atk: 16, def: 12, spd: 6, int: 3, exp: 30, gold: 18, color: '#ccccbb', shape: 'skeleton', skills: [] },
  darkKnight:   { name: 'ダークナイト', hp: 55, atk: 24, def: 20, spd: 9, int: 5, exp: 50, gold: 35, color: '#334', shape: 'knight', skills: [] },
  demonSoldier: { name: 'デーモンソルジャー', hp: 65, atk: 28, def: 22, spd: 11, int: 8, exp: 65, gold: 45, color: '#aa3333', shape: 'knight', skills: ['enemyFire'] },
  darkMage:     { name: 'ダークメイジ', hp: 45, atk: 14, def: 12, spd: 13, int: 20, exp: 55, gold: 40, color: '#663388', shape: 'mage', skills: ['enemyFire'] },
  demonKing:    { name: '魔王ヴァルザード', hp: 350, atk: 38, def: 28, spd: 16, int: 25, exp: 0, gold: 0, color: '#880022', shape: 'demonKing', boss: true, skills: ['enemyDark', 'enemyHeal'] },
};

// ===== ITEM DEFINITIONS =====
var ITEMS = {
  herb:       { name: '薬草', type: 'heal', target: 'ally', power: 35, price: 10, desc: 'HP35回復' },
  magicWater: { name: '魔法の水', type: 'healMp', target: 'ally', power: 20, price: 25, desc: 'MP20回復' },
  antidote:   { name: '毒消し草', type: 'cure', status: 'poison', price: 8, desc: '毒を治す' },
  phoenix:    { name: 'フェニックスの羽', type: 'revive', power: 0.5, price: 120, desc: '戦闘不能から復活' },
  bomb:       { name: '爆弾石', type: 'damage', target: 'enemy', power: 35, price: 60, desc: '敵一体に35ダメージ' },
};

// ===== EQUIPMENT DEFINITIONS =====
var WEAPONS = {
  woodenSword:  { name: '木の剣', atk: 5, price: 50, equip: ['sam'] },
  ironSword:    { name: '鉄の剣', atk: 12, price: 200, equip: ['sam'] },
  steelSword:   { name: '鋼の剣', atk: 22, price: 600, equip: ['sam'] },
  flameSword:   { name: '炎の剣', atk: 32, price: 1800, equip: ['sam'] },
  holySword:    { name: '聖なる剣', atk: 48, price: 6000, equip: ['sam'] },
  oakStaff:     { name: '樫の杖', atk: 3, int: 5, price: 80, equip: ['dario', 'sundar'] },
  mysticStaff:  { name: '魔法の杖', atk: 5, int: 15, price: 900, equip: ['dario'] },
  crystalStaff: { name: 'クリスタルロッド', atk: 8, int: 28, price: 2500, equip: ['dario'] },
  healingRod:   { name: '癒しの杖', atk: 5, int: 10, price: 500, equip: ['sundar'] },
  sacredRod:    { name: '聖なる杖', atk: 10, int: 22, price: 2200, equip: ['sundar'] },
};

var ARMORS = {
  clothArmor:   { name: '布の服', def: 4, price: 40, equip: ['sam', 'dario', 'sundar'] },
  leatherArmor: { name: '皮の鎧', def: 10, price: 180, equip: ['sam', 'sundar'] },
  chainMail:    { name: '鎖帷子', def: 18, price: 500, equip: ['sam'] },
  plateArmor:   { name: 'プレートアーマー', def: 28, price: 1500, equip: ['sam'] },
  dragonArmor:  { name: 'ドラゴンアーマー', def: 42, price: 5000, equip: ['sam'] },
  silkRobe:     { name: '絹のローブ', def: 4, int: 4, price: 80, equip: ['dario', 'sundar'] },
  mysticRobe:   { name: '魔法のローブ', def: 10, int: 12, price: 800, equip: ['dario', 'sundar'] },
  holyRobe:     { name: '聖なるローブ', def: 18, int: 20, price: 3000, equip: ['dario', 'sundar'] },
};

var ACCESSORIES = {
  powerRing: { name: '力の指輪', atk: 5, price: 400 },
  magicRing: { name: '魔力の指輪', int: 6, price: 400 },
  speedRing: { name: '素早さの指輪', spd: 5, price: 400 },
  lifeRing:  { name: '命の指輪', hp: 25, price: 600 },
};

// ===== MAP DATA =====
// Each map: { width, height, tiles (string array), playerStart, events, npcs, encounters }

var MAPS = {
  world: {
    name: 'エルドラシア大陸',
    width: 30, height: 22,
    tiles: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWMMMMMMMMMMMMMMMMMMMMWWWWWW',
      'WWWMMDDDDDDDDDDDDDDDDMMMWWWWW',
      'WWMMDDDDDDDDDDDDDDDDDDDMMWWWW',
      'WWMDDDDDDDDDDRRDDDDDDDDDMWWWW',
      'WWMDDDDDDDDDDRRDDDDDDDDMMWWWW',
      'WWMMDDDFFFFFRRRRRFFFFFFDMMWWWW',
      'WWMDDFFFFFFFRRRRRFFFFFFDDMWWWW',
      'WWMDDFFFFFFFRRRRRFFFFFFDDMWWWW',
      'WWMDDFFFFFFFRRRRRRFFFFFDDMWWWW',
      'WWMDDFFFFFFRRRRRRRGFFFDDMMWWWW',
      'WWMMDFFFFFRRRRRRRRGGGFDDMWWWWW',
      'WWMMGGGGGRRRRRRRRRGGGGDDMWWWWW',
      'WWMGGGGGGRRRRRRRRRGGGGDMMWWWWW',
      'WWMGGGGGRRRRRRRRRRGGGGMMWWWWWW',
      'WWMGGGGGRRRRRRRRRRGGGMMMWWWWWW',
      'WWMMGGGGRRRRRRRRRRGGGMMWWWWWWW',
      'WWMMMGGGRRRRRRRRRGGMMMWWWWWWWW',
      'WWWMMMGGGRRRRRRRGGGMMWWWWWWWWW',
      'WWWWMMMMMGGGGGGGMMMMWWWWWWWWWW',
      'WWWWWWMMMMMMMMMMMMMWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    playerStart: { x: 14, y: 16 },
    events: {
      '14,16': { type: 'mapTransfer', map: 'millhaven', desc: 'ミルヘイブン村' },
      '13,7':  { type: 'mapTransfer', map: 'forest', desc: '暗黒の森' },
      '12,4':  { type: 'mapTransfer', map: 'castle', desc: '魔王の城' },
    },
    encounters: {
      grass: [
        { enemies: ['slime'], weight: 40 },
        { enemies: ['slime', 'slime'], weight: 30 },
        { enemies: ['goblin'], weight: 20 },
        { enemies: ['goblin', 'slime'], weight: 10 },
      ],
      forest: [
        { enemies: ['wolf'], weight: 30 },
        { enemies: ['goblin', 'goblin'], weight: 25 },
        { enemies: ['giantBat'], weight: 25 },
        { enemies: ['wolf', 'goblin'], weight: 20 },
      ],
      dark: [
        { enemies: ['skeleton'], weight: 30 },
        { enemies: ['darkKnight'], weight: 25 },
        { enemies: ['skeleton', 'skeleton'], weight: 25 },
        { enemies: ['darkKnight', 'skeleton'], weight: 20 },
      ],
    },
    encounterRate: 0.08,
  },

  millhaven: {
    name: 'ミルヘイブン村',
    width: 16, height: 14,
    tiles: [
      'wwwwwwwwwwwwwwww',
      'wfffff.ffffffwfw',
      'wfwwwwffwwwwfwfw',
      'wfwffwffwffwfwfw',
      'wfwffwffwcfwfwfw',
      'wfwwdwffwwdwfwdw',
      'wffffffffffffff.',
      'wff.fffffffffff.',
      'wfwwwwffwwwwwffw',
      'wfwffwffwfffwffw',
      'wfwcfwffwcffwffw',
      'wfwwdwffwwwdwffw',
      'wfffffffffffwffw',
      'wwwwwwwEdwwwwwww',
    ],
    playerStart: { x: 8, y: 12 },
    events: {
      '7,13': { type: 'mapTransfer', map: 'world', targetX: 14, targetY: 17, desc: 'フィールドへ' },
      '8,13': { type: 'mapTransfer', map: 'world', targetX: 14, targetY: 17, desc: 'フィールドへ' },
    },
    npcs: [
      { x: 4, y: 3, name: '村長', color: '#aa8844', dir: 'down',
        dialogue: [
          '村長「よく来たな、勇者たちよ。',
          '北の果てに魔王ヴァルザードが復活した。',
          'このままでは世界は闇に包まれてしまう。',
          'どうかこの世界を救ってくれ！」',
        ]},
      { x: 10, y: 3, name: '道具屋', color: '#44aa44', dir: 'down', shop: 'itemShop',
        dialogue: ['道具屋「いらっしゃい！何をお求めで？」'] },
      { x: 4, y: 9, name: '武器屋', color: '#aa4444', dir: 'down', shop: 'weaponShop',
        dialogue: ['武器屋「いい武器が揃ってるぜ！」'] },
      { x: 10, y: 9, name: '防具屋', color: '#4444aa', dir: 'down', shop: 'armorShop',
        dialogue: ['防具屋「防具はいかがですか？」'] },
      { x: 14, y: 3, name: '宿屋', color: '#aaaa44', dir: 'down', inn: 30,
        dialogue: ['宿屋「一泊30ゴールドです。お泊りになりますか？」'] },
      { x: 7, y: 7, name: '旅人', color: '#88aa88', dir: 'right',
        dialogue: [
          '旅人「北の森を抜けると魔王の城があるらしい。',
          'でも森にはモンスターがうようよいるから',
          '気をつけた方がいいぞ。」',
        ]},
    ],
    encounters: {},
    encounterRate: 0,
  },

  forest: {
    name: '暗黒の森',
    width: 18, height: 18,
    tiles: [
      'FFFFFFFFFFFFFFFFFF',
      'FFFFFFfFFFFFFFFfFF',
      'FFfFFffFFFFfFFffFF',
      'FFffFfffffffFffFFF',
      'FFFfFfFFFFfFfFFfFF',
      'FFffFfFFFFfFfFFfFF',
      'FFfFFfffFFfFfffFFF',
      'FFFFFFFfFFfFFfFFFF',
      'FFFfFFffFFfFFfFfFF',
      'FFffFFfFFFfFFfFfFF',
      'FFfFFFfffffffFffFF',
      'FFfFFFFFFFFFFFfFFF',
      'FFffFFFFfFFFFFfFFF',
      'FFFfFFFFffFFFFfFFF',
      'FFFfFFFFFfFFFffFFF',
      'FFFffFFFffFFFfFFFF',
      'FFFFfffffFFFffFFFF',
      'FFFFFFFFFFFFFFFFFF',
    ],
    playerStart: { x: 4, y: 16 },
    events: {
      '4,17':  { type: 'mapTransfer', map: 'world', targetX: 13, targetY: 8, desc: 'フィールドへ' },
      '13,0':  { type: 'mapTransfer', map: 'world', targetX: 12, targetY: 5, desc: 'フィールドへ' },
      '10,5':  { type: 'chest', item: 'ironSword', itemType: 'weapon', flag: 'forest_chest1', msg: '宝箱から 鉄の剣 を手に入れた！' },
      '3,9':   { type: 'chest', item: 'herb', itemType: 'item', count: 3, flag: 'forest_chest2', msg: '宝箱から 薬草x3 を手に入れた！' },
    },
    npcs: [],
    encounters: {
      forest: [
        { enemies: ['wolf'], weight: 25 },
        { enemies: ['giantBat'], weight: 25 },
        { enemies: ['goblin', 'goblin'], weight: 20 },
        { enemies: ['wolf', 'giantBat'], weight: 15 },
        { enemies: ['skeleton'], weight: 15 },
      ],
    },
    encounterRate: 0.12,
  },

  castle: {
    name: '魔王の城',
    width: 16, height: 18,
    tiles: [
      'XXXXXXXXXXXXXXXX',
      'XXXDDDDrrDDDDXXX',
      'XXDDDDDrrDDDDDXX',
      'XXDDXXDrrDXXDDXX',
      'XXDDXXDDDDXXDDXX',
      'XXDDDDDDDDDDDDXx',
      'XXXXDDDDDDDDXXxX',
      'XXXXXDDDDDDXXXxX',
      'XXXDDDDDDDDDDxXXX',
      'XXDDDDXXXXDDDDxXX',
      'XXDDDDXXXXDDDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXXDDDDDDDDDDDxXX',
      'XXXXDDDDDDDDXxXXX',
      'XXXXXXDDDDXxXXXXX',
      'XXXXXXXDDXXXXXXXX',
      'XXXXXXXDDXXXXXXXX',
      'XXXXXXXEeXXXXXXX',
    ],
    playerStart: { x: 8, y: 16 },
    events: {
      '7,17':  { type: 'mapTransfer', map: 'world', targetX: 12, targetY: 5, desc: 'フィールドへ' },
      '8,17':  { type: 'mapTransfer', map: 'world', targetX: 12, targetY: 5, desc: 'フィールドへ' },
      '7,1':   { type: 'boss', enemy: 'demonKing', flag: 'demonKingDefeated',
                 preBattle: ['魔王ヴァルザード「愚かな人間どもめ…', 'この世界は我が闇に沈む運命なのだ！', '覚悟するがいい！！」'] },
      '8,1':   { type: 'boss', enemy: 'demonKing', flag: 'demonKingDefeated',
                 preBattle: ['魔王ヴァルザード「愚かな人間どもめ…', 'この世界は我が闇に沈む運命なのだ！', '覚悟するがいい！！」'] },
    },
    npcs: [],
    encounters: {
      dark: [
        { enemies: ['demonSoldier'], weight: 25 },
        { enemies: ['darkMage'], weight: 25 },
        { enemies: ['darkKnight', 'darkKnight'], weight: 20 },
        { enemies: ['demonSoldier', 'darkMage'], weight: 20 },
        { enemies: ['demonSoldier', 'demonSoldier'], weight: 10 },
      ],
    },
    encounterRate: 0.14,
  },
};

// ===== SHOP DATA =====
var SHOPS = {
  itemShop: {
    name: '道具屋',
    items: [
      { id: 'herb', type: 'item' },
      { id: 'magicWater', type: 'item' },
      { id: 'antidote', type: 'item' },
      { id: 'phoenix', type: 'item' },
      { id: 'bomb', type: 'item' },
    ],
  },
  weaponShop: {
    name: '武器屋',
    items: [
      { id: 'woodenSword', type: 'weapon' },
      { id: 'ironSword', type: 'weapon' },
      { id: 'steelSword', type: 'weapon' },
      { id: 'oakStaff', type: 'weapon' },
      { id: 'healingRod', type: 'weapon' },
      { id: 'mysticStaff', type: 'weapon' },
    ],
  },
  armorShop: {
    name: '防具屋',
    items: [
      { id: 'clothArmor', type: 'armor' },
      { id: 'leatherArmor', type: 'armor' },
      { id: 'chainMail', type: 'armor' },
      { id: 'silkRobe', type: 'armor' },
      { id: 'mysticRobe', type: 'armor' },
      { id: 'powerRing', type: 'accessory' },
      { id: 'magicRing', type: 'accessory' },
      { id: 'speedRing', type: 'accessory' },
    ],
  },
};

// ===== LEVEL UP TABLE =====
function expForLevel(level) {
  return Math.floor(level * level * 12);
}
