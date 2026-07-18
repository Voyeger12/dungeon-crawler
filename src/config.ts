export const WORLD = { width: 960, height: 540, wall: 42, doorHalf: 54 } as const;

export const COLORS = {
  void: '#070810', floor: '#171827', floorAlt: '#1c1c2d', grout: '#25273b', wall: '#29293d',
  wallTop: '#3b3b53', gold: '#f4c75b', blood: '#e84b5f', health: '#db3c55', mana: '#65d3d1',
  rune: '#8b72e8', cold: '#69a6d8', warm: '#ef934a', text: '#f3ead7', muted: '#aaa5b7'
} as const;

export const PLAYER_BASE = {
  maxHp: 120, speed: 205, damage: 24, attackRate: 0.42, range: 78,
  critChance: 0.12, critMultiplier: 1.75, dashCooldown: 1.35, dashDuration: 0.18,
  armor: 3, potions: 2
} as const;

export const ENEMY_STATS = {
  skeleton: { hp: 64, speed: 82, damage: 15, xp: 25, gold: [4, 8] },
  slime: { hp: 92, speed: 52, damage: 13, xp: 30, gold: [4, 9] },
  archer: { hp: 48, speed: 70, damage: 12, xp: 30, gold: [5, 10] },
  shadow: { hp: 42, speed: 112, damage: 19, xp: 38, gold: [6, 12] },
  boss: { hp: 1050, speed: 66, damage: 22, xp: 250, gold: [80, 110] }
} as const;

export const XP_FOR_LEVEL = (level: number) => Math.floor(70 + level * level * 22);

export const UPGRADES = [
  { id: 'vitality', icon: '♥', name: 'Runenherz', description: '+25 maximales Leben und heile 25', apply: 'maxHp' },
  { id: 'might', icon: '⚔', name: 'Klingenschwur', description: '+18 % Angriffsschaden', apply: 'damage' },
  { id: 'fury', icon: '✦', name: 'Blutiger Takt', description: '+14 % Angriffstempo', apply: 'attackRate' },
  { id: 'swiftness', icon: '➶', name: 'Windschritt', description: '+10 % Bewegungstempo', apply: 'speed' },
  { id: 'dash', icon: '◈', name: 'Schattenriss', description: '-18 % Dash-Abklingzeit', apply: 'dash' },
  { id: 'reach', icon: '↝', name: 'Lange Schneide', description: '+14 Angriffsreichweite', apply: 'range' },
  { id: 'critical', icon: '✹', name: 'Todesblick', description: '+8 % kritische Chance', apply: 'crit' },
  { id: 'armor', icon: '⬟', name: 'Steinhaut', description: '+3 Rüstung', apply: 'armor' },
  { id: 'leech', icon: '◆', name: 'Blutpakt', description: 'Heile 5 % des verursachten Schadens', apply: 'leech' },
  { id: 'burn', icon: '♨', name: 'Glutstahl', description: 'Treffer können Gegner entzünden', apply: 'burn' },
  { id: 'roomHeal', icon: '✚', name: 'Atem der Tiefe', description: 'Heile 8 nach jedem Kampfraum', apply: 'roomHeal' },
  { id: 'dashShield', icon: '⬢', name: 'Runenschild', description: 'Erhalte nach dem Dash einen Schutzschild', apply: 'dashShield' }
] as const;

export const RELICS = [
  { id: 'blood-blade', name: 'Blutklinge', icon: '🗡', description: '3 % Lebensraub', color: '#d84b62' },
  { id: 'frost-amulet', name: 'Frostamulett', icon: '❄', description: 'Treffer verlangsamen Gegner', color: '#75c9e8' },
  { id: 'storm-rune', name: 'Sturmrune', icon: 'ϟ', description: 'Jeder dritte Angriff entfesselt Kettenblitze', color: '#d8bcff' },
  { id: 'guardian-ring', name: 'Wächterring', icon: '◉', description: '+4 Rüstung', color: '#e9c47e' },
  { id: 'shadow-boots', name: 'Schattenstiefel', icon: '◒', description: 'Dash lädt 20 % schneller', color: '#a889e8' },
  { id: 'golden-skull', name: 'Goldener Schädel', icon: '☠', description: '+45 % Gold', color: '#f2c14f' },
  { id: 'ember-core', name: 'Glutkern', icon: '♦', description: 'Angriffe entzünden Ziele', color: '#f06d43' },
  { id: 'thorn-crown', name: 'Dornenkrone', icon: '♛', description: 'Wirft 25 % Nahkampfschaden zurück', color: '#8dc46b' }
] as const;

export type UpgradeId = typeof UPGRADES[number]['id'];
export type RelicId = typeof RELICS[number]['id'];
