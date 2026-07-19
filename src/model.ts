import type { RelicId, UpgradeId } from './config';
import type { Vec } from './math';

export type Direction = 'north' | 'south' | 'east' | 'west';
export type RoomKind = 'start' | 'combat' | 'elite' | 'treasure' | 'rest' | 'boss';
export type RoomState = 'undiscovered' | 'ready' | 'active' | 'cleared';
export type EnemyKind = 'skeleton' | 'slime' | 'archer' | 'shadow' | 'boss';
export type PickupKind = 'gold' | 'heal' | 'potion' | 'key' | 'damage' | 'speed' | 'relic';

export interface Obstacle extends Vec {
  id: number; radius: number; kind: 'pillar' | 'crate' | 'barrel' | 'rubble' | 'spikes';
  solid: boolean; breakable: boolean; hp: number; phase: number;
}

export interface Chest extends Vec { opened: boolean; locked: boolean; }

export interface Room {
  id: string; gx: number; gy: number; kind: RoomKind; state: RoomState; depth: number;
  connections: Partial<Record<Direction, string>>; obstacles: Obstacle[]; chest?: Chest;
  visited: boolean; enemiesDefeated: number; rewardClaimed: boolean;
}

export interface Player extends Vec {
  radius: number; hp: number; maxHp: number; speed: number; damage: number; attackRate: number;
  range: number; critChance: number; critMultiplier: number; dashCooldown: number; dashDuration: number;
  armor: number; level: number; xp: number; xpNeeded: number; gold: number; potions: number; keys: number;
  aim: number; attackTimer: number; attackAnim: number; attackCombo: number; attackCount: number;
  dashTimer: number; dashCdTimer: number; dashDir: Vec; invuln: number; flash: number; shield: number;
  vx: number; vy: number; upgrades: UpgradeId[]; relics: RelicId[]; lifeSteal: number;
  roomHeal: number; burnChance: number; dashShield: boolean; damageBuff: number; speedBuff: number;
}

export interface Enemy extends Vec {
  id: number; kind: EnemyKind; radius: number; hp: number; maxHp: number; speed: number; damage: number;
  xp: number; gold: [number, number]; elite: boolean; state: 'chase' | 'telegraph' | 'attack' | 'recover' | 'dead';
  stateTimer: number; cooldown: number; aim: number; vx: number; vy: number; flash: number; slow: number;
  burn: number; burnTick: number; phase: number; attackType: number; summoned: boolean; contactCd: number;
}

export interface Projectile extends Vec {
  id: number; vx: number; vy: number; radius: number; damage: number; life: number;
  hostile: boolean; color: string; owner: number; piercing: boolean;
}

export interface Pickup extends Vec {
  id: number; kind: PickupKind; amount: number; relic?: RelicId; life: number; phase: number; collected: boolean;
}

export interface Hazard extends Vec {
  id: number; radius: number; warning: number; active: number; damage: number; type: 'rune' | 'shockwave' | 'spikes';
  phase: number; hitPlayer: boolean; ringRadius: number;
}

export interface Particle extends Vec {
  vx: number; vy: number; life: number; maxLife: number; size: number; color: string; gravity: number;
}

export interface FloatText extends Vec {
  text: string; color: string; life: number; maxLife: number; size: number;
}

export interface RunStats {
  startTime: number; elapsed: number; kills: number; goldFound: number; roomsVisited: number;
  potionsUsed: number; damageDealt: number; damageTaken: number;
}

export type DisplayMode = 'fit' | 'fullscreen';
export type RenderPreset = 'auto' | '720p' | '900p' | '1080p' | '1440p';
export type UiScale = 90 | 100 | 110 | 125;

export interface Settings {
  master: number; music: number; sfx: number; muted: boolean; shake: boolean; reducedEffects: boolean; tutorialHints: boolean;
  displayMode: DisplayMode; renderPreset: RenderPreset; uiScale: UiScale;
}

export type TutorialId = 'move' | 'attack' | 'dash' | 'potion' | 'interact' | 'character' | 'map' | 'gold' | 'key';

export interface TutorialProgress {
  completed: Partial<Record<TutorialId, true>>;
}

export interface Records {
  bestScore: number; fastestWin: number | null; highestLevel: number; mostKills: number; runs: number; victories: number;
}
