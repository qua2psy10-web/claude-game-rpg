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
  'Y': { name: '水晶の床', color: '#3f5f8f', passable: true, encounter: true },
  'Z': { name: '水晶の壁', color: '#1f2c52', passable: false },
  'K': { name: '水晶', color: '#2b4a80', passable: false },
};

// ===== CHARACTER DEFINITIONS =====
var CHARACTERS = {
  sam: {
    name: 'サム', nameEn: 'Sam', class: '戦士',
    baseStats: { hp: 45, mp: 5, atk: 12, def: 10, spd: 8, int: 3 },
    growth: { hp: 8, mp: 2, atk: 3, def: 3, spd: 1, int: 1 },
    spells: [
      { id: 'powerSlash', learnLevel: 1 },
      { id: 'sweep', learnLevel: 3 },
      { id: 'shieldBash', learnLevel: 5 },
      { id: 'warCry', learnLevel: 10 },
    ],
    color: '#4488cc',
    limit: 'limitSam',
  },
  dario: {
    name: 'ダリオ', nameEn: 'Dario', class: '魔法使い',
    baseStats: { hp: 28, mp: 20, atk: 5, def: 5, spd: 10, int: 14 },
    growth: { hp: 4, mp: 5, atk: 1, def: 1, spd: 2, int: 4 },
    spells: [
      { id: 'fire', learnLevel: 1 },
      { id: 'weaken', learnLevel: 4 },
      { id: 'sleep', learnLevel: 5 },
      { id: 'iceStorm', learnLevel: 7 },
      { id: 'magicBoost', learnLevel: 10 },
      { id: 'thunder', learnLevel: 12 },
    ],
    color: '#cc4488',
    limit: 'limitDario',
  },
  sundar: {
    name: 'スンダー', nameEn: 'Sundar', class: '僧侶',
    baseStats: { hp: 35, mp: 18, atk: 7, def: 8, spd: 9, int: 10 },
    growth: { hp: 6, mp: 4, atk: 2, def: 2, spd: 1, int: 3 },
    spells: [
      { id: 'heal', learnLevel: 1 },
      { id: 'light', learnLevel: 2 },
      { id: 'cure', learnLevel: 3 },
      { id: 'protect', learnLevel: 6 },
      { id: 'armorBreak', learnLevel: 8 },
      { id: 'holyLight', learnLevel: 10 },
    ],
    color: '#44cc88',
    limit: 'limitSundar',
  },
};

// ===== SPELL DEFINITIONS =====
var SPELLS = {
  powerSlash:  { name: 'パワースラッシュ', mp: 3, type: 'physical', target: 'enemy', power: 2.0, pierce: 0.5, desc: '敵の守りを半分無視する強力な一撃' },
  sweep:       { name: 'なぎはらい', mp: 5, type: 'physical', target: 'allEnemy', power: 1.2, pierce: 0.25, desc: '剣で敵全体をなぎはらう' },
  shieldBash:  { name: 'シールドバッシュ', mp: 5, type: 'physical', target: 'enemy', power: 1.2, pierce: 0.25, stun: 0.3, desc: '盾で殴りスタンさせる' },
  warCry:      { name: 'ウォークライ', mp: 8, type: 'buff', target: 'party', stat: 'atk', mult: 1.25, turns: 3, desc: '味方全体の攻撃力UP' },
  fire:        { name: 'ファイア', mp: 4, type: 'magic', target: 'enemy', power: 24, desc: '炎で敵一体を攻撃' },
  sleep:       { name: 'スリープ', mp: 8, type: 'sleep', target: 'allEnemy', chance: 0.5, turns: 2, desc: '敵全体を眠らせる(ボスには効かない)' },
  magicBoost:  { name: 'マジックブースト', mp: 8, type: 'buff', target: 'party', stat: 'int', mult: 1.5, turns: 3, desc: '味方全体の魔法の威力UP' },
  iceStorm:    { name: 'アイスストーム', mp: 8, type: 'magic', target: 'allEnemy', power: 18, desc: '吹雪で敵全体を攻撃' },
  thunder:     { name: 'サンダー', mp: 12, type: 'magic', target: 'enemy', power: 48, desc: '雷で敵一体を大ダメージ' },
  light:       { name: 'ライト', mp: 4, type: 'magic', target: 'enemy', power: 22, desc: '聖なる光で敵一体を攻撃' },
  heal:        { name: 'ヒール', mp: 4, type: 'heal', target: 'ally', power: 50, desc: '味方一人のHPを回復' },
  weaken:      { name: 'ウィークン', mp: 6, type: 'debuff', target: 'enemy', stat: 'atk', mult: 0.7, turns: 3, desc: '敵一体の攻撃力DOWN' },
  armorBreak:  { name: 'ブレイク', mp: 8, type: 'debuff', target: 'allEnemy', stat: 'def', mult: 0.7, turns: 3, desc: '敵全体の防御力DOWN' },
  cure:        { name: 'キュア', mp: 3, type: 'cure', target: 'ally', desc: '味方一人の毒を治す' },
  protect:     { name: 'プロテクト', mp: 6, type: 'buff', target: 'party', stat: 'def', mult: 1.25, turns: 3, desc: '味方全体の防御力UP' },
  holyLight:   { name: 'ホーリーライト', mp: 10, type: 'magic', target: 'allEnemy', power: 42, desc: '聖なる光で敵全体を攻撃' },
  // limit skills (one per member, usable when the limit gauge is full; see CHARACTERS[id].limit)
  limitSam:    { name: 'ブレイブエッジ', mp: 0, limit: true, type: 'physical', target: 'enemy', power: 4.0, pierce: 0.8, desc: '渾身の一撃(必殺技)' },
  limitDario:  { name: 'メテオフォール', mp: 0, limit: true, type: 'magic', target: 'allEnemy', power: 100, desc: '流星を降らせる(必殺技)' },
  limitSundar: { name: 'いのりのひかり', mp: 0, limit: true, type: 'limitHeal', target: 'party', heal: 0.3, revive: 0.25, desc: '味方全員を癒し、倒れた仲間を起こす(必殺技)' },
  // combo skills: need both members' limit gauges (see COMBOS); the caster is the first of the pair in party order
  comboFlame:  { name: 'ほのおのつるぎ', mp: 0, combo: true, type: 'comboAttack', target: 'enemy', power: 200, k: 3.0, desc: '剣と魔法を合わせた一撃(れんけい)' },
  comboHoly:   { name: 'せいなるりゅうせい', mp: 0, combo: true, type: 'comboAttack', target: 'allEnemy', power: 150, k: 1.5, heal: 0.2, desc: '聖なる流星が敵全体に降る(れんけい)' },
  comboGuard:  { name: 'まもりのちかい', mp: 0, combo: true, type: 'comboGuard', target: 'party', heal: 0.4, revive: 0.35, desc: '全員を癒し、守りと攻めを高める(れんけい)' },
  enemyFire:   { name: '火炎', mp: 0, type: 'magic', target: 'ally', power: 20, desc: '' },
  enemyDark:   { name: '暗黒の波動', mp: 0, type: 'magic', target: 'partyAll', power: 40, desc: '' },
  enemyDoom:   { name: '終焉の波動', mp: 0, type: 'magic', target: 'partyAll', power: 62, desc: '' },
  enemyCrystal:{ name: '水晶の閃光', mp: 0, type: 'magic', target: 'partyAll', power: 30, desc: '' },
  enemyHeal:   { name: '回復', mp: 0, type: 'heal', target: 'self', power: 60, desc: '' },
};

// A combo needs both members' limit gauges at this level or above (a single limit skill still needs 100)
var COMBO_GAUGE = 90;

// Which two members make which combo (needs both limit gauges full); `stats` = the stat each class contributes to the damage
var COMBOS = [
  { pair: ['sam', 'dario'],    spell: 'comboFlame', stats: { sam: 'atk', dario: 'int' } },
  { pair: ['dario', 'sundar'], spell: 'comboHoly',  stats: { dario: 'int', sundar: 'int' } },
  { pair: ['sam', 'sundar'],   spell: 'comboGuard', stats: {} },
];

// ===== ENEMY DEFINITIONS =====
var ENEMIES = {
  slime:        { name: 'スライム', hp: 20, atk: 13, def: 2, spd: 3, int: 1, exp: 4, gold: 6, color: '#44aaff', shape: 'slime', skills: [], poison: 0.2, desc: ['草原に すむ ぷよぷよした 魔物。', 'ときどき 毒を もっている。'], area: '草原' },
  goblin:       { name: 'ゴブリン', hp: 52, atk: 28, def: 5, spd: 7, int: 2, exp: 10, gold: 14, color: '#55aa44', shape: 'goblin', skills: [], desc: ['こんぼうを ふりまわす 小鬼。', 'ずる賢く 群れで おそってくる。'], area: '草原・暗黒の森' },
  wolf:         { name: 'ウルフ', hp: 110, atk: 58, def: 4, spd: 12, int: 2, exp: 14, gold: 20, color: '#888899', shape: 'wolf', skills: [], desc: ['森を かける 灰色の 狼。', 'すばやく 鋭い きばで かみつく。'], area: '暗黒の森' },
  giantBat:     { name: 'ジャイアントバット', hp: 90, atk: 50, def: 6, spd: 14, int: 3, exp: 18, gold: 22, color: '#774455', shape: 'bat', skills: [], poison: 0.3, desc: ['ねぐらを 荒らされると 怒る。', 'きばに 毒が ひそむことも。'], area: '暗黒の森' },
  skeleton:     { name: 'スケルトン', hp: 170, atk: 70, def: 12, spd: 6, int: 3, exp: 34, gold: 28, color: '#ccccbb', shape: 'skeleton', skills: [], desc: ['さまよう 戦士の なれのはて。', 'かたい ほねは なかなか くだけない。'], area: '暗黒の森の おく' },
  // ----- 水晶の洞窟 (Lv 7-10) -----
  crystalSlime: { name: 'クリスタルスライム', hp: 150, atk: 62, def: 22, spd: 5, int: 6, exp: 30, gold: 26, color: '#8fe3ff', shape: 'slime', skills: [], desc: ['水晶を のみこんで かたくなった スライム。', '剣は はじかれるが 魔法には よわい。'], area: '水晶の洞窟' },
  crystalBat:   { name: 'クリスタルバット', hp: 120, atk: 68, def: 8, spd: 16, int: 4, exp: 32, gold: 28, color: '#b9a8ff', shape: 'bat', skills: [], desc: ['水晶の かがやきに あつまる コウモリ。', '羽ばたきが きらきらと 光る。'], area: '水晶の洞窟' },
  crystalGolem: { name: 'クリスタルゴーレム', hp: 320, atk: 88, def: 34, spd: 4, int: 2, exp: 62, gold: 44, color: '#7ab8e8', shape: 'golem', skills: [], desc: ['水晶の かたまりに 命が やどった もの。', '動きは のろいが 一撃が おもい。'], area: '水晶の洞窟' },
  crystalGuardian: { name: 'クリスタルガーディアン', hp: 700, atk: 92, def: 30, spd: 10, int: 20, exp: 320, gold: 420, color: '#58a0ff', shape: 'golem', boss: true, skills: ['enemyCrystal', 'enemyHeal'], bigSkill: 'enemyCrystal', desc: ['洞窟の おくで 宝を まもる 水晶の 番人。', 'まばゆい 閃光を はなって せまる。'], area: '水晶の洞窟の おく' },
  darkKnight:   { name: 'ダークナイト', hp: 240, atk: 86, def: 20, spd: 9, int: 5, exp: 60, gold: 40, color: '#334', shape: 'knight', skills: [], desc: ['魔王に 忠誠を ちかった 騎士。', '重い よろいで 身を かためている。'], area: '魔王の城' },
  demonSoldier: { name: 'デーモンソルジャー', hp: 310, atk: 104, def: 22, spd: 11, int: 8, exp: 80, gold: 50, color: '#aa3333', shape: 'knight', skills: ['enemyFire'], desc: ['魔界から よびだされた 兵士。', '炎の 魔法も つかいこなす。'], area: '魔王の城' },
  darkMage:     { name: 'ダークメイジ', hp: 210, atk: 56, def: 12, spd: 13, int: 48, exp: 70, gold: 45, color: '#663388', shape: 'mage', skills: ['enemyFire'], desc: ['闇の 魔術を きわめた 魔道士。', '魔力は 高いが 体は もろい。'], area: '魔王の城' },
  demonKing:    { name: '魔王ヴァルザード', hp: 1600, atk: 158, def: 28, spd: 16, int: 25, exp: 0, gold: 0, color: '#880022', shape: 'demonKing', boss: true, finale: true, skills: ['enemyDark', 'enemyHeal'], desc: ['ふたたび めざめた 闇の 王。', 'すべてを 闇に とざそうとする。'], area: '魔王の城の おく' },
  // ----- post-game (深淵の迷宮) -----
  abyssWraith:  { name: '深淵の亡霊', hp: 480, atk: 130, def: 24, spd: 15, int: 20, exp: 140, gold: 110, color: '#66e0d0', shape: 'skeleton', skills: [], desc: ['深淵に とらわれた 戦士の 魂。', '冷たい 刃が 音もなく せまる。'], area: '深淵の迷宮' },
  chaosKnight:  { name: '混沌の騎士', hp: 620, atk: 155, def: 36, spd: 10, int: 6, exp: 180, gold: 140, color: '#a04020', shape: 'knight', skills: [], desc: ['魔王すら 従えなかった 狂える 騎士。', '鎧は 魔王軍より はるかに 厚い。'], area: '深淵の迷宮' },
  voidMage:     { name: '虚空の魔導師', hp: 420, atk: 80, def: 20, spd: 16, int: 85, exp: 160, gold: 130, color: '#2a7ab0', shape: 'mage', skills: ['enemyFire'], desc: ['虚空から 力を 引き出す 魔導師。', '炎の 魔法が 恐ろしく 強い。'], area: '深淵の迷宮' },
  zelgios:      { name: '終焉の魔神ゼルギオス', hp: 3000, atk: 170, def: 34, spd: 18, int: 30, exp: 2500, gold: 3000, color: '#2a8aa8', shape: 'abyssLord', boss: true, skills: ['enemyDoom', 'enemyHeal'], bigSkill: 'enemyDoom', desc: ['魔王が 生まれる はるか前から', '深淵に ねむる 終焉の 魔神。'], area: '深淵の迷宮の おく' },
};

// ===== ITEM DEFINITIONS =====
var ITEMS = {
  herb:       { name: '薬草', type: 'heal', target: 'ally', power: 35, price: 10, desc: 'HP35回復' },
  magicWater: { name: '魔法の水', type: 'healMp', target: 'ally', power: 20, price: 25, desc: 'MP20回復' },
  antidote:   { name: '毒消し草', type: 'cure', target: 'ally', status: 'poison', price: 8, desc: '毒を治す' },
  phoenix:    { name: 'フェニックスの羽', type: 'revive', power: 0.5, price: 120, desc: '戦闘不能から復活' },
  highHerb:   { name: '上薬草', type: 'heal', target: 'ally', power: 100, price: 45, fx: 'herb', desc: 'HP100回復' },
  elixir:     { name: '魔法の聖水', type: 'healMp', target: 'ally', power: 60, price: 90, fx: 'magicWater', desc: 'MP60回復' },
  bomb:       { name: '爆弾石', type: 'damage', target: 'enemy', power: 35, price: 60, desc: '敵一体に35ダメージ' },
  bigBomb:    { name: '爆裂石', type: 'damage', target: 'enemy', power: 90, price: 150, fx: 'bomb', desc: '敵一体に90ダメージ' },
};

// ===== EQUIPMENT DEFINITIONS =====
var WEAPONS = {
  woodenSword:  { name: '木の剣', atk: 5, price: 50, equip: ['sam'] },
  ironSword:    { name: '鉄の剣', atk: 12, price: 200, equip: ['sam'] },
  silverSword:  { name: '銀の剣', atk: 28, price: 1000, equip: ['sam'] },
  silverStaff:  { name: '銀の杖', atk: 4, int: 20, price: 1100, equip: ['dario', 'sundar'] },
  steelSword:   { name: '鋼の剣', atk: 22, price: 600, equip: ['sam'] },
  flameSword:   { name: '炎の剣', atk: 32, price: 1800, equip: ['sam'] },
  holySword:    { name: '聖なる剣', atk: 48, price: 6000, equip: ['sam'] },
  oakStaff:     { name: '樫の杖', atk: 3, int: 5, price: 80, equip: ['dario', 'sundar'] },
  mysticStaff:  { name: '魔法の杖', atk: 5, int: 15, price: 900, equip: ['dario'] },
  crystalStaff: { name: 'クリスタルロッド', atk: 8, int: 28, price: 2500, equip: ['dario'] },
  healingRod:   { name: '癒しの杖', atk: 5, int: 10, price: 500, equip: ['sundar'] },
  abyssBlade:   { name: 'ドラゴンスレイヤー', atk: 62, price: 9999, equip: ['sam'] },
  abyssStaff:   { name: '終焉の杖', atk: 12, int: 40, price: 9999, equip: ['dario', 'sundar'] },
  crystalBlade: { name: '水晶の剣', atk: 25, price: 1800, equip: ['sam'] },
  sacredRod:    { name: '聖なる杖', atk: 10, int: 22, price: 2200, equip: ['sundar'] },
};

var ARMORS = {
  clothArmor:   { name: '布の服', def: 4, price: 40, equip: ['sam', 'dario', 'sundar'] },
  leatherArmor: { name: '皮の鎧', def: 10, price: 180, equip: ['sam', 'sundar'] },
  chainMail:    { name: '鎖帷子', def: 18, price: 500, equip: ['sam'] },
  scaleMail:    { name: 'ウロコの鎧', def: 23, price: 800, equip: ['sam'] },
  plateArmor:   { name: 'プレートアーマー', def: 28, price: 1500, equip: ['sam'] },
  dragonArmor:  { name: 'ドラゴンアーマー', def: 42, price: 5000, equip: ['sam'] },
  silkRobe:     { name: '絹のローブ', def: 4, int: 4, price: 80, equip: ['dario', 'sundar'] },
  mysticRobe:   { name: '魔法のローブ', def: 10, int: 12, price: 800, equip: ['dario', 'sundar'] },
  abyssRobe:    { name: '深淵のローブ', def: 26, int: 26, price: 9999, equip: ['dario', 'sundar'] },
  abyssMail:    { name: '深淵の鎧', def: 52, price: 9999, equip: ['sam'] },
  crystalMail:  { name: '水晶の鎧', def: 21, price: 1400, equip: ['sam'] },
  crystalRobe:  { name: '水晶のローブ', def: 8, int: 8, price: 1000, equip: ['dario', 'sundar'] },
  holyRobe:     { name: '聖なるローブ', def: 18, int: 20, price: 3000, equip: ['dario', 'sundar'] },
};

var ACCESSORIES = {
  powerRing: { name: '力の指輪', atk: 5, price: 400 },
  magicRing: { name: '魔力の指輪', int: 6, price: 400 },
  speedRing: { name: '素早さの指輪', spd: 5, price: 400 },
  kindRing:   { name: 'みんなの指輪', atk: 4, def: 6, int: 6, spd: 4, hp: 40, price: 9999 },
  masterRing: { name: '達人の指輪', atk: 8, def: 8, int: 12, spd: 4, hp: 30, price: 9999 },
  lifeRing:  { name: '命の指輪', hp: 25, price: 600 },
  guardRing: { name: '守りの指輪', def: 8, price: 600 },
  sageRing:  { name: '賢者の指輪', int: 12, price: 1400 },
  crystalRing: { name: '水晶の指輪', def: 3, int: 5, hp: 10, price: 800 },
  heroRing:  { name: '勇者の指輪', atk: 9, def: 5, price: 1500 },
};

// ===== ACHIEVEMENTS =====
// Granted automatically (RecordsSystem.check) the first time the condition holds; kinds: seen / seenAll / master / chests / kills / quests
var ACHIEVEMENTS = [
  { id: 'seen5',   name: 'ずかん 5しゅるい',   desc: '5しゅるいの てきに であう',        kind: 'seen', n: 5,  reward: { item: 'highHerb', count: 3 } },
  { id: 'seen9',   name: 'ずかん 9しゅるい',   desc: '9しゅるいの てきに であう',        kind: 'seen', n: 9,  reward: { item: 'phoenix', count: 2 } },
  { id: 'seenAll', name: 'ずかん コンプリート', desc: 'すべての てきに であう',           kind: 'seenAll',     reward: { item: 'elixir', count: 5 } },
  { id: 'kills100', name: 'ひゃくたい たおし',  desc: 'てきを 100たい たおす',            kind: 'kills', n: 100, reward: { item: 'bigBomb', count: 3 } },
  { id: 'chests',  name: 'トレジャーハンター', desc: 'すべての たからばこを あける',     kind: 'chests',      reward: { item: 'phoenix', count: 3 } },
  { id: 'helper',  name: 'みんなの ヒーロー',   desc: 'すべての いらいを かんりょうする', kind: 'quests',      reward: { accessory: 'kindRing' } },
  { id: 'master',  name: 'モンスターマスター', desc: 'ボスいがいを 3たいずつ たおす', kind: 'master',   reward: { accessory: 'masterRing' } },
];

// ===== REQUESTS (いらい) =====
// Villager errands (QuestSystem). kind: kill (enemy, n) / fetch (item, n) / deliver (target = the NPC's quest id in another town).
// An NPC carries `quest: id` (giver; also the turn-in for kill/fetch) or `questTarget: id` (deliver destination).
// lines: offer / active / done (spoken on completion); reward: { gold, item, count }.
var QUESTS = {
  wolfHunt: {
    name: 'ウルフたいじ', kind: 'kill', enemy: 'wolf', n: 3,
    desc: 'もりの ウルフを 3たい たおす',
    reward: { gold: 150, item: 'highHerb', count: 2 },
    lines: {
      offer:  ['旅人「実は 森で ウルフに 荷物を 奪われてな…', '頼む、森の ウルフを 3匹 退治してくれ！', '礼は するぞ。」'],
      active: ['旅人「ウルフ退治は どうだ？', '森に 3匹 いるはずだ。頼んだぞ。」'],
      done:   ['旅人「やってくれたか！ ありがたい！', 'これは 礼だ。受け取ってくれ。」'],
    },
  },
  skeletonHunt: {
    name: 'ガイコツたいじ', kind: 'kill', enemy: 'skeleton', n: 4,
    desc: 'きたの やみの ガイコツを 4たい たおす',
    reward: { gold: 300, item: 'phoenix', count: 1 },
    lines: {
      offer:  ['村長「北の 暗い大地に 骸骨の 魔物が 出ると いう。', '街道の 旅人が 怖がっておる。', '4体ほど 退治しては くれぬか。」'],
      active: ['村長「骸骨の 退治は 進んでおるか。', '北の 暗い大地じゃ。気をつけてな。」'],
      done:   ['村長「おお、これで 旅人も 安心じゃ！', '村からの 礼じゃ。」'],
    },
  },
  herbDelivery: {
    name: 'のどぐすりを とどけて', kind: 'deliver', target: 'herbDelivery',
    desc: 'ハルカ宿場の 旅芸人に くすりを とどける',
    reward: { gold: 100, item: 'elixir', count: 1 },
    lines: {
      offer:  ['老婆「東の ハルカ宿場に 旅芸人が おってな。', '歌いすぎで のどを 痛めて おるそうじゃ。', 'この 薬草を 届けて やってくれんか。」', '（のどぐすりを あずかった）'],
      active: ['老婆「あの 薬草は もう 届けて くれたかの？', '東の 街道の ハルカ宿場じゃよ。」'],
      done:   ['旅芸人「あら、村の おばあさんからの 薬草！', 'ありがたい。これで また 歌えるわ。', '礼に これを あげる。持っていきな！」'],
    },
  },
  antidoteFetch: {
    name: 'どくけしそうを あつめて', kind: 'fetch', item: 'antidote', n: 3,
    desc: 'どくけしそうを 3つ 兵士に わたす',
    reward: { gold: 250 },
    lines: {
      offer:  ['兵士「森の 見張りで 毒を 受ける 者が 多くてな。', '毒消し草が 3つ ほしいのだが…', '持っていたら 分けて くれ。礼は する。」'],
      active: ['兵士「毒消し草は 3つ 集まったか？', '道具屋で 買えるぞ。」'],
      done:   ['兵士「助かった！ これで 見張りも 安心だ。', 'わずかだが 礼を 受け取ってくれ。」'],
    },
  },
  batHunt: {
    name: 'コウモリたいじ', kind: 'kill', enemy: 'giantBat', n: 4, needs: 'visited_forest',
    desc: 'もりの ジャイアントバットを 4たい たおす',
    reward: { gold: 120, item: 'magicWater', count: 3 },
    lines: {
      offer:  ['子ども「ねえ ゆうしゃさま！', 'もりの おおきな コウモリが こわくて', 'パパが かりに いけないんだ。', '4ひき やっつけて くれない？」'],
      active: ['子ども「コウモリ やっつけて くれた？', 'もりに いるって パパが いってたよ！」'],
      done:   ['子ども「わあ、ありがとう！', 'これ パパが くれた おれいだよ。', 'ゆうしゃさま だいすき！」'],
    },
  },
  castleHunt: {
    name: 'まじんへいたいじ', kind: 'kill', enemy: 'demonSoldier', n: 4, needs: 'visited_castle',
    desc: 'まおうのしろの デーモンソルジャーを 4たい たおす',
    reward: { gold: 600, item: 'phoenix', count: 1 },
    lines: {
      offer:  ['村長「城から 戻った お主らに 頼みが ある。', '城の デーモンソルジャーを', '4体 減らして もらえぬか。', '魔王の力を 削ぐ 助けに なるはずじゃ。」'],
      active: ['村長「デーモンソルジャーは 手強い。', '無理は せぬように 頼むぞ。」'],
      done:   ['村長「見事じゃ！ 魔王の軍勢も', 'これで ずいぶん 弱った はずじゃ。', '村からの 礼じゃ。受け取ってくれ。」'],
    },
  },
  herbFetch: {
    name: 'じょうやくそうを あつめて', kind: 'fetch', item: 'highHerb', n: 3, needs: 'visited_castle',
    desc: 'じょうやくそうを 3つ 兵士に わたす',
    reward: { gold: 400, item: 'bigBomb', count: 1 },
    lines: {
      offer:  ['兵士「城へ 向かう 仲間に 持たせたい。', '上薬草を 3つ 譲って もらえないか。', 'もちろん 礼は 弾むぞ。」'],
      active: ['兵士「上薬草は 3つ 集まったか？', '道具屋か 宝箱で 手に入るぞ。」'],
      done:   ['兵士「ありがたい！ これで 仲間も 心強い。', '礼に 爆裂石を 受け取ってくれ。」'],
    },
  },
  crystalHunt: {
    name: 'ゴーレムたいじ', kind: 'kill', enemy: 'crystalGolem', n: 2, needs: 'visited_crystalCave',
    desc: 'すいしょうの どうくつの ゴーレムを 2たい たおす',
    reward: { gold: 150, item: 'highHerb', count: 5 },
    lines: {
      offer:  ['兵士「洞窟へ 入ったのか。奥に 水晶の ゴーレムが', 'いるだろう。街道の 見張りに 邪魔でな。', '2体 倒して くれないか。」'],
      active: ['兵士「ゴーレムは 動きは 遅いが 硬いぞ。', '剣より 魔法が 効くはずだ。」'],
      done:   ['兵士「助かった！ これで 街道も 静かに なる。', '礼に 上薬草を 受け取ってくれ。」'],
    },
  },
  abyssHunt: {
    name: 'こんとんの きしたいじ', kind: 'kill', enemy: 'chaosKnight', n: 3, needs: 'demonKingDefeated',
    desc: 'しんえんの こんとんの きしを 3たい たおす',
    reward: { gold: 1000, item: 'elixir', count: 3 },
    lines: {
      offer:  ['旅人「深淵の迷宮に 混沌の騎士が いるらしい。', '腕に 自信が あるなら 3体 倒して みないか。', '礼は はずむぞ。」'],
      active: ['旅人「混沌の騎士は 深淵の迷宮だ。', 'しっかり 備えて 行けよ。」'],
      done:   ['旅人「本当に 倒したのか！ 大したもんだ！', 'これは 約束の 礼だ。」'],
    },
  },
};

// ===== MAP DATA =====
// Each map: { width, height, tiles (string array), playerStart, events, npcs, encounters }

var MAPS = {
  world: {
    name: 'エルドラシア大陸',
    nameEn: "THE CONTINENT OF ELDRASIA",
    width: 30, height: 22,
    tiles: [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      'WWWWMMMMMMMMMMMMMMMMMMMMWWWWWW',
      'WWWMMDDDDDDDDDDDDDDDDMMMWWWWWW',
      'WWMMDDDDDDDDDDDDDDDDDDDMMWWWWW',
      'WWMDDDDDDDDDDRRDDDDDDDDDMWWWWW',
      'WWMDDDDDDDDDDRRDDDDDDDDMMWWWWW',
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
      '3,5':   { type: 'chest', item: 'elixir', itemType: 'item', count: 3, flag: 'world_chest1', msg: '宝箱から 魔法の聖水x3 を手に入れた！' },
      '22,5':  { type: 'chest', item: 'guardRing', itemType: 'accessory', flag: 'world_chest2', msg: '宝箱から 守りの指輪 を手に入れた！' },
      '14,16': { type: 'mapTransfer', map: 'millhaven', desc: 'ミルヘイブン村' },
      '13,7':  { type: 'mapTransfer', map: 'forest', desc: '暗黒の森' },
      '12,4':  { type: 'mapTransfer', map: 'castle', desc: '魔王の城' },
      '18,12': { type: 'mapTransfer', map: 'haruka', desc: 'ハルカ宿場' },
      '21,13': { type: 'mapTransfer', map: 'crystalCave', desc: '水晶の洞窟' },
      '4,13':  { type: 'mapTransfer', map: 'abyss', requires: 'demonKingDefeated', desc: '深淵の迷宮' },
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
    nameEn: "MILLHAVEN VILLAGE",
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
      { x: 4, y: 3, name: '村長', color: '#aa8844', dir: 'down', wander: 2, quest: ['skeletonHunt', 'castleHunt'],
        dialogue: [
          '村長「よく来たな、勇者たちよ。',
          '北の果てに魔王ヴァルザードが復活した。',
          'このままでは世界は闇に包まれてしまう。',
          'どうかこの世界を救ってくれ！」',
        ],
        talk: [
          { flag: 'abyssBossDefeated', lines: ['村長「深淵の魔神まで倒したというのか…！', 'もはや お主らに かなう者など おるまい。', 'この村は 永遠に 勇者たちの 味方じゃ。」'] },
          { flag: 'demonKingDefeated', lines: ['村長「よくぞ 魔王を 倒してくれた！', '村の者も みな 喜んでおる。', 'ところで 南西の草原に 見慣れぬ 門が', '現れたと 聞いたぞ。気をつけて 行くのじゃ。」'] },
          { flag: 'visited_castle', lines: ['村長「魔王の城を 見てきたか…', '恐ろしい 場所だったじゃろう。', '準備を 整えて 挑むのじゃぞ。」'] },
          { flag: 'visited_forest', lines: ['村長「暗黒の森へ 入ったか。', '傷ついたら 無理をせず 村に 戻るのじゃ。', '宿屋は いつでも 開いておる。」'] },
        ]},
      { x: 10, y: 3, name: '道具屋', color: '#44aa44', dir: 'down', shop: 'itemShop',
        dialogue: ['道具屋「いらっしゃい！何をお求めで？」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['道具屋「魔王を 倒した 勇者さまの ご来店だ！', '上薬草や 爆裂石も 入荷してますぜ！」'] }] },
      { x: 4, y: 9, name: '武器屋', color: '#aa4444', dir: 'down', shop: 'weaponShop',
        dialogue: ['武器屋「いい武器が揃ってるぜ！」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['武器屋「魔王を 倒した 腕なら', 'うちの 最高級品が 似合うぜ！」'] }] },
      { x: 10, y: 9, name: '防具屋', color: '#4444aa', dir: 'down', shop: 'armorShop',
        dialogue: ['防具屋「防具はいかがですか？」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['防具屋「指輪も 新しい 品が 入りましたよ。', '勇者さまに ぴったりです！」'] }] },
      { x: 14, y: 3, name: '宿屋', color: '#aaaa44', dir: 'down', inn: 30,
        dialogue: ['宿屋「一泊30ゴールドです。お泊りになりますか？」'] },
      { x: 14, y: 7, name: '鍛冶屋', color: '#cc6633', dir: 'left', smith: true,
        dialogue: ['鍛冶屋「おう、勇者さま！', '武器や防具を 鍛え直して やろう。', '金さえ あれば +5 まで 強くなるぞ！」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['鍛冶屋「魔王を 倒した 腕だ。', 'どこまで 鍛えられるか 試して みるか！」'] }] },
      { x: 7, y: 7, name: '旅人', color: '#88aa88', dir: 'right', wander: 2, quest: ['wolfHunt', 'abyssHunt'],
        dialogue: [
          '旅人「北の森を抜けると魔王の城があるらしい。',
          'でも森にはモンスターがうようよいるから',
          '気をつけた方がいいぞ。',
          '東の街道の ハルカ宿場なら',
          '旅の装備も 買えるらしい。」',
        ],
        talk: [
          { flag: 'abyssBossDefeated', lines: ['旅人「あの深淵の魔神を 倒したのか！', '俺は 長く 旅をしてきたが', 'こんな 話は 初めて 聞いたぞ。」'] },
          { flag: 'demonKingDefeated', lines: ['旅人「魔王を 倒すとは 大したもんだ！', '噂じゃ 大陸の南西に 新しい 門が', 'できたらしい。力試しに ちょうどいいぞ。」'] },
          { flag: 'visited_castle', lines: ['旅人「城まで 行ったのか！', '中の 魔物は 森とは 桁違いだろう。', 'レベルを 上げてから 行った方が いいぞ。」'] },
          { flag: 'crystalGuardianDefeated', lines: ['旅人「水晶の洞窟の 番人を 倒したのか！', '奥の 宝は 見事だったろう。', '城へ 挑む 準備は 万端だな。」'] },
          { flag: 'visited_forest', lines: ['旅人「ハルカ宿場の すぐ東に', '水晶の洞窟が あるそうだ。', 'レベル7〜10くらいで 挑むのが いいらしいぞ。」'] },
        ]},
      { x: 2, y: 12, name: '老婆', color: '#aa88aa', dir: 'up', quest: 'herbDelivery',
        dialogue: ['老婆「森の 奥には 昔の 旅人が', '残した 宝箱が あるそうじゃ。', '鉄の剣が 眠って おるとか…」'],
        talk: [
          { flag: 'demonKingDefeated', lines: ['老婆「大陸の 北の 暗い土地にも', '宝箱が あるそうじゃ。', 'わしも 若ければ 探しに 行くのにのう。」'] },
          { flag: 'visited_castle', lines: ['老婆「魔王の城にも 宝箱が あると', '聞いたことが あるぞい。', '指輪や 薬が 入って おるそうじゃ。」'] },
          { flag: 'forest_chest1', lines: ['老婆「おお 鉄の剣を 見つけたか。', 'ほかにも 宝箱は あるはずじゃ。', '城の中も よく 探してみなされ。」'] },
        ]},
      { x: 12, y: 6, name: '子ども', color: '#ddbb66', dir: 'down', wander: 2, quest: 'batHunt',
        dialogue: ['子ども「勇者さまだ！', 'ぼくも おおきくなったら', 'ゆうしゃに なるんだ！」'],
        talk: [
          { flag: 'abyssBossDefeated', lines: ['子ども「ほんとうに まじんを たおしたの！？', 'すごい すごい！', 'ぼく ずっと ゆうしゃさまの ファンだよ！」'] },
          { flag: 'demonKingDefeated', lines: ['子ども「まおうを やっつけたんだよね！', 'もう こわい ゆめを みなくて すむよ。', 'ありがとう！」'] },
          { flag: 'visited_forest', lines: ['子ども「もりに いったの？', 'ウルフは すごく すばしっこいって', 'パパが いってたよ。きをつけてね！」'] },
        ]},
    ],
    encounters: {},
    encounterRate: 0,
  },

  forest: {
    name: '暗黒の森',
    nameEn: "THE DARK FOREST",
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
    nameEn: "THE DEMON KING'S CASTLE",
    width: 16, height: 18,
    tiles: [
      'XXXXXXXXXXXXXXXX',
      'XXDDDDDrrDDDDDXX',
      'XXDDDDDrrDDDDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXDDXXDDDDXXDDXX',
      'XXDDXXDDDDXXDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXXXDDDDDDDDXXXX',
      'XXXXDDDDDDDDXXXX',
      'XXDDDDDDDDDDDDXX',
      'XXDDXXXXXXXXDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXXDDDDDDDDDDXXX',
      'XXXXDDDDDDDDXXXX',
      'XXXXXDDDDDDXXXXX',
      'XXXXXXXDDXXXXXXX',
      'XXXXXXXDDXXXXXXX',
      'XXXXXXXEEXXXXXXX',
    ],
    playerStart: { x: 8, y: 16 },
    events: {
      '2,9':   { type: 'chest', item: 'highHerb', itemType: 'item', count: 3, flag: 'castle_chest1', msg: '宝箱から 上薬草x3 を手に入れた！' },
      '13,9':  { type: 'chest', item: 'phoenix', itemType: 'item', count: 2, flag: 'castle_chest2', msg: '宝箱から フェニックスの羽x2 を手に入れた！' },
      '2,3':   { type: 'chest', item: 'heroRing', itemType: 'accessory', flag: 'castle_chest3', msg: '宝箱から 勇者の指輪 を手に入れた！' },
      '13,3':  { type: 'chest', item: 'bigBomb', itemType: 'item', count: 2, flag: 'castle_chest4', msg: '宝箱から 爆裂石x2 を手に入れた！' },
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

  abyss: {
    name: '深淵の迷宮',
    nameEn: "THE ABYSS",
    width: 16, height: 16,
    tiles: [
      'XXXXXXXXXXXXXXXX',
      'XXXXXrrrrrrXXXXX',
      'XXXXXDDDDDDXXXXX',
      'XXLLXDDDDDDXLLXX',
      'XXDDXXXDDXXXDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXDDXXXXXXXXDDXX',
      'XXDDXXDDDDXXDDXX',
      'XXDDXXDDDDXXDDXX',
      'XXDDDDDDDDDDDDXX',
      'XXXXXDDXXDDXXXXX',
      'XXDDDDDXXDDDDDXX',
      'XXDDDDDXXDDDDDXX',
      'XXXXXDDDDDDXXXXX',
      'XXXXXXXDDXXXXXXX',
      'XXXXXXXEEXXXXXXX',
    ],
    playerStart: { x: 8, y: 14 },
    events: {
      '7,15':  { type: 'mapTransfer', map: 'world', targetX: 4, targetY: 14, desc: 'フィールドへ' },
      '8,15':  { type: 'mapTransfer', map: 'world', targetX: 4, targetY: 14, desc: 'フィールドへ' },
      '2,12':  { type: 'chest', item: 'abyssBlade', itemType: 'weapon', flag: 'abyss_chest1', msg: '宝箱から ドラゴンスレイヤー を手に入れた！' },
      '13,12': { type: 'chest', item: 'abyssRobe', itemType: 'armor', flag: 'abyss_chest2', msg: '宝箱から 深淵のローブ を手に入れた！' },
      '6,7':   { type: 'chest', item: 'abyssStaff', itemType: 'weapon', flag: 'abyss_chest3', msg: '宝箱から 終焉の杖 を手に入れた！' },
      '9,7':   { type: 'chest', item: 'abyssMail', itemType: 'armor', flag: 'abyss_chest4', msg: '宝箱から 深淵の鎧 を手に入れた！' },
      '7,1':   { type: 'boss', enemy: 'zelgios', flag: 'abyssBossDefeated', ending: false,
                 preBattle: ['終焉の魔神ゼルギオス「…魔王を 倒した 者たちか。', '深淵の底で 待っていたぞ。', '我が 終焉の波動を 受けてみよ！」'],
                 postBattle: ['ゼルギオスは 深淵の闇に とけていった…', '勇者たちは 本当の 平和を 手に入れた！'] },
      '8,1':   { type: 'boss', enemy: 'zelgios', flag: 'abyssBossDefeated', ending: false,
                 preBattle: ['終焉の魔神ゼルギオス「…魔王を 倒した 者たちか。', '深淵の底で 待っていたぞ。', '我が 終焉の波動を 受けてみよ！」'],
                 postBattle: ['ゼルギオスは 深淵の闇に とけていった…', '勇者たちは 本当の 平和を 手に入れた！'] },
    },
    npcs: [],
    encounters: {
      dark: [
        { enemies: ['abyssWraith'], weight: 25 },
        { enemies: ['chaosKnight'], weight: 20 },
        { enemies: ['voidMage'], weight: 20 },
        { enemies: ['abyssWraith', 'voidMage'], weight: 20 },
        { enemies: ['chaosKnight', 'abyssWraith'], weight: 15 },
      ],
    },
    encounterRate: 0.14,
  },

  crystalCave: {
    name: '水晶の洞窟',
    nameEn: "THE CRYSTAL CAVERNS",
    width: 18, height: 16,
    tiles: [
      'ZZZZZZZZZZZZZZZZZZ',
      'ZZZZZYYYYYYYYZZZZZ',
      'ZZZZZKYYYYYYKZZZZZ',
      'ZZZZZZZZYYZZZZZZZZ',
      'ZZYYYYYYYYYYYYYYZZ',
      'ZZYKYYYYYYYYYYKYZZ',
      'ZZYYZZYYYYYYZZYYZZ',
      'ZZYYZZYYKKYYZZYYZZ',
      'ZZYYYYYYYYYYYYYYZZ',
      'ZZYKYYZZYYZZYYKYZZ',
      'ZZYYYYZZYYZZYYYYZZ',
      'ZZZZYYYYYYYYYYZZZZ',
      'ZZZZYYKYYYYKYYZZZZ',
      'ZZZZZZZYYYYZZZZZZZ',
      'ZZZZZZZZYYZZZZZZZZ',
      'ZZZZZZZZEEZZZZZZZZ',
    ],
    playerStart: { x: 8, y: 14 },
    events: {
      '8,15':  { type: 'mapTransfer', map: 'world', targetX: 21, targetY: 14, desc: 'フィールドへ' },
      '9,15':  { type: 'mapTransfer', map: 'world', targetX: 21, targetY: 14, desc: 'フィールドへ' },
      '3,10':  { type: 'chest', item: 'elixir', itemType: 'item', count: 2, flag: 'crystal_chest1', msg: '宝箱から 魔法の聖水x2 を手に入れた！' },
      '14,10': { type: 'chest', item: 'highHerb', itemType: 'item', count: 3, flag: 'crystal_chest2', msg: '宝箱から 上薬草x3 を手に入れた！' },
      '2,6':   { type: 'chest', item: 'crystalRing', itemType: 'accessory', flag: 'crystal_chest3', msg: '宝箱から 水晶の指輪 を手に入れた！' },
      '15,6':  { type: 'chest', item: 'crystalRobe', itemType: 'armor', flag: 'crystal_chest4', msg: '宝箱から 水晶のローブ を手に入れた！' },
      '6,1':   { type: 'chest', item: 'crystalBlade', itemType: 'weapon', flag: 'crystal_chest5', msg: '宝箱から 水晶の剣 を手に入れた！' },
      '11,1':  { type: 'chest', item: 'crystalMail', itemType: 'armor', flag: 'crystal_chest6', msg: '宝箱から 水晶の鎧 を手に入れた！' },
      '8,3':   { type: 'boss', enemy: 'crystalGuardian', flag: 'crystalGuardianDefeated', ending: false,
                 preBattle: ['水晶の番人「…ここから先は 通さぬ。', '洞窟の 宝は 我が まもる。', '力を 示してみせよ！」'],
                 postBattle: ['クリスタルガーディアンは 光の粒と なって くだけ散った…', '奥の 宝箱が かがやいている！'] },
      '9,3':   { type: 'boss', enemy: 'crystalGuardian', flag: 'crystalGuardianDefeated', ending: false,
                 preBattle: ['水晶の番人「…ここから先は 通さぬ。', '洞窟の 宝は 我が まもる。', '力を 示してみせよ！」'],
                 postBattle: ['クリスタルガーディアンは 光の粒と なって くだけ散った…', '奥の 宝箱が かがやいている！'] },
    },
    npcs: [],
    encounters: {
      crystal: [
        { enemies: ['crystalSlime'], weight: 25 },
        { enemies: ['crystalBat'], weight: 25 },
        { enemies: ['crystalSlime', 'crystalBat'], weight: 20 },
        { enemies: ['crystalGolem'], weight: 20 },
        { enemies: ['crystalBat', 'crystalBat'], weight: 10 },
      ],
    },
    encounterRate: 0.13,
  },

  haruka: {
    name: 'ハルカ宿場',
    nameEn: "HARUKA WAYSIDE",
    width: 14, height: 10,
    tiles: [
      'wwwwwwwwwwwwww',
      'wffffffffffffw',
      'wfwwwwffwwwwfw',
      'wfwffwffwffwfw',
      'wfwcfwffwcfwfw',
      'wfwwdwffwwdwfw',
      'wffffffffffffw',
      'wf.ffffffff.fw',
      'wffffffffffffw',
      'wwwwwwEEwwwwww',
    ],
    playerStart: { x: 6, y: 8 },
    events: {
      '6,9':  { type: 'mapTransfer', map: 'world', targetX: 18, targetY: 13, desc: 'フィールドへ' },
      '7,9':  { type: 'mapTransfer', map: 'world', targetX: 18, targetY: 13, desc: 'フィールドへ' },
      '12,1': { type: 'chest', item: 'highHerb', itemType: 'item', count: 2, flag: 'haruka_chest1', msg: '宝箱から 上薬草x2 を手に入れた！' },
      '1,8':  { type: 'chest', item: 'speedRing', itemType: 'accessory', flag: 'haruka_chest2', msg: '宝箱から 素早さの指輪 を手に入れた！' },
    },
    npcs: [
      { x: 4, y: 3, name: '宿屋', color: '#aaaa44', dir: 'down', inn: 30,
        dialogue: ['宿屋「ハルカ宿場へ ようこそ。', '一泊30ゴールドです。お泊りになりますか？」'] },
      { x: 10, y: 3, name: '行商人', color: '#44aaaa', dir: 'down', shop: 'roadShop',
        dialogue: ['行商人「旅人向けの 良い品を 揃えてますよ！」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['行商人「魔王を 倒した 勇者さまですか！', 'うちの 品は 世界中から 集めた 自慢の 一品です！」'] }] },
      { x: 6, y: 6, name: '旅芸人', color: '#cc88aa', dir: 'down', wander: 2, questTarget: 'herbDelivery',
        dialogue: ['旅芸人「この 宿場は 村と 森の 中間にあってね。', '森へ 向かう 旅人が 最後に 休む 場所さ。', 'しっかり 準備してから 行きなよ！」'],
        talk: [
          { flag: 'abyssBossDefeated', lines: ['旅芸人「深淵の魔神を 倒した 勇者たちの 歌を', '作ったんだ！ 世界中で 歌うよ！」'] },
          { flag: 'demonKingDefeated', lines: ['旅芸人「魔王を 倒した 勇者たちの 歌を', '作っているところさ。', 'もう少しで 完成だよ！」'] },
          { flag: 'visited_castle', lines: ['旅芸人「魔王の城まで 行ったのかい！', '無事で 何よりだ。ゆっくり 休んで いきなよ。」'] },
          { flag: 'visited_forest', lines: ['旅芸人「森から 戻って きたのかい。', '傷は 宿で 癒していきな。」'] },
        ]},
      { x: 2, y: 6, name: '闘技場の受付', color: '#cc5533', dir: 'right', arena: true,
        dialogue: ['受付「ハルカ闘技場へ ようこそ！', '3れんせんを 勝ち抜けば しょうきんが 出るぞ。', '力に 自信は あるか？」'],
        talk: [
          { flag: 'abyssBossDefeated', lines: ['受付「深淵の魔神を 倒した 勇者さまか！', '「でんせつの ぶ」は あなたの ための 舞台だ！」'] },
          { flag: 'demonKingDefeated', lines: ['受付「魔王を 倒した 勇者さまの 参戦とは！', '「でんせつの ぶ」が 解禁だ。どうだ？」'] },
        ]},
      { x: 9, y: 7, name: '賭け屋', color: '#bb8833', dir: 'left', dice: true,
        dialogue: ['賭け屋「旅の人、運だめしは どうだい？', 'サイコロ二つの 出目を 当てるだけさ！」'],
        talk: [{ flag: 'demonKingDefeated', lines: ['賭け屋「魔王を 倒した 勇者さまの 運だめしか！', 'こいつは 面白い 勝負に なりそうだ！」'] }] },
      { x: 12, y: 7, name: '兵士', color: '#8899aa', dir: 'left', quest: ['antidoteFetch', 'crystalHunt', 'herbFetch'],
        dialogue: ['兵士「ここから 北の 森には', '強い 魔物が 住んでいる。', 'この 東には 水晶の 洞窟も ある。', '装備は ちゃんと 整えたか？」'],
        talk: [
          { flag: 'demonKingDefeated', lines: ['兵士「魔王が 倒されて 街道も', '平和に なったな。', '私も 仕事が 楽に なったよ。」'] },
          { flag: 'visited_castle', lines: ['兵士「城へ 入ったのか。', '無事に 戻ってきて 何よりだ。」'] },
        ]},
    ],
    encounters: {},
    encounterRate: 0,
  },
};

// ===== ARENA (ハルカ闘技場) =====
// Three battles in a row per course; fee up front, prize for winning all three, a one-off reward for the first win.
var ARENA = {
  courses: [
    { id: 'novice', name: 'ひよっこの ぶ', fee: 100, prize: 200,
      rounds: [['wolf', 'wolf'], ['giantBat', 'goblin', 'goblin'], ['skeleton', 'skeleton']],
      first: { item: 'highHerb', count: 3 } },
    { id: 'veteran', name: 'つわものの ぶ', fee: 300, prize: 600, needs: 'visited_castle', lockHint: '魔王の城へ 行った 者だけが 出られる',
      rounds: [['darkKnight', 'demonSoldier'], ['darkMage', 'demonSoldier', 'darkMage'], ['crystalGolem', 'darkKnight']],
      first: { item: 'bigBomb', count: 2 } },
    { id: 'legend', name: 'でんせつの ぶ', fee: 800, prize: 1600, needs: 'demonKingDefeated', lockHint: '魔王を たおした 者だけが 出られる',
      rounds: [['abyssWraith', 'voidMage'], ['chaosKnight', 'abyssWraith'], ['chaosKnight', 'voidMage']],
      first: { item: 'phoenix', count: 3 } },
  ],
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
      { id: 'highHerb', type: 'item' },
      { id: 'elixir', type: 'item' },
      { id: 'bigBomb', type: 'item' },
    ],
  },
  roadShop: {
    name: '行商人',
    items: [
      { id: 'highHerb', type: 'item' },
      { id: 'antidote', type: 'item' },
      { id: 'silverSword', type: 'weapon' },
      { id: 'silverStaff', type: 'weapon' },
      { id: 'scaleMail', type: 'armor' },
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
      { id: 'sacredRod', type: 'weapon' },
      { id: 'crystalStaff', type: 'weapon' },
      { id: 'flameSword', type: 'weapon' },
      { id: 'holySword', type: 'weapon' },
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
      { id: 'plateArmor', type: 'armor' },
      { id: 'holyRobe', type: 'armor' },
      { id: 'dragonArmor', type: 'armor' },
      { id: 'powerRing', type: 'accessory' },
      { id: 'magicRing', type: 'accessory' },
      { id: 'speedRing', type: 'accessory' },
      { id: 'lifeRing', type: 'accessory' },
      { id: 'guardRing', type: 'accessory' },
      { id: 'sageRing', type: 'accessory' },
      { id: 'heroRing', type: 'accessory' },
    ],
  },
};

// ===== NEW GAME+ SCALING =====
// Cycle 1 is the normal game. Each later cycle ("つよくてニューゲーム") makes every enemy tougher and its rewards richer.
function cycleScale(cycle) {
  var c = Math.max(0, Math.floor(cycle || 1) - 1);
  return { stat: 1 + 0.6 * c, def: 1 + 0.3 * c, reward: 1 + 0.5 * c };
}

// ===== LEVEL UP TABLE =====
function expForLevel(level) {
  return Math.floor(level * level * 8);
}
