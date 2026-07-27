import type { AssetId } from './assets';
import { PLAYER_BASE, type RelicId, type UpgradeId } from './config';
import type { Player } from './model';

export type ItemCategory = 'weapon' | 'armor' | 'consumable';
export type EquipmentSlot = 'mainHand' | 'body' | 'back';
export type ItemRarity = 'common' | 'uncommon';

export interface EquipmentState {
  mainHand?: ItemId;
  body?: ItemId;
  back?: ItemId;
}

export interface ItemModifiers {
  damageMultiplier?: number;
  attackRateMultiplier?: number;
  rangeAdd?: number;
  critChanceAdd?: number;
  armorAdd?: number;
  speedMultiplier?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number;
  asset: AssetId;
  slot?: EquipmentSlot;
  modifiers?: ItemModifiers;
  effect?: 'potion' | 'bandage';
}

export const ITEMS = [
  {
    id: 'grave-iron-longsword', name: 'Grabeneisen-Langschwert',
    description: 'Eine schwere, verlässliche Klinge mit sicherer Reichweite.',
    category: 'weapon', rarity: 'common', price: 80, asset: 'shopGraveIron', slot: 'mainHand',
    modifiers: { damageMultiplier: 1.12, attackRateMultiplier: 1.04, rangeAdd: 8 }
  },
  {
    id: 'ashfang', name: 'Aschenfang',
    description: 'Schnell und tödlich, doch nur im gefährlichen Nahbereich.',
    category: 'weapon', rarity: 'uncommon', price: 120, asset: 'shopAshfang', slot: 'mainHand',
    modifiers: { damageMultiplier: .92, attackRateMultiplier: .82, critChanceAdd: .05, rangeAdd: -6 }
  },
  {
    id: 'patched-wolf-leather', name: 'Geflicktes Wolfsleder',
    description: 'Leichter Schutz, der den Schritt nicht bindet.',
    category: 'armor', rarity: 'common', price: 65, asset: 'shopWolfLeather', slot: 'body',
    modifiers: { armorAdd: 2, speedMultiplier: 1.05 }
  },
  {
    id: 'soot-chainmail', name: 'Rußiges Kettenhemd',
    description: 'Schweres Kettenwerk für jene, die einen Treffer erwarten.',
    category: 'armor', rarity: 'uncommon', price: 95, asset: 'shopChainmail', slot: 'body',
    modifiers: { armorAdd: 4, speedMultiplier: .95 }
  },
  {
    id: 'healing-potion', name: 'Heiltrank',
    description: 'Füllt deinen Gürtel um einen Heiltrank auf.',
    category: 'consumable', rarity: 'common', price: 25, asset: 'pickupPotion', effect: 'potion'
  },
  {
    id: 'wound-bandage', name: 'Lydias Wundverband',
    description: 'Heilt sofort 30 Lebenspunkte. Bei vollem Leben wirkungslos.',
    category: 'consumable', rarity: 'common', price: 20, asset: 'shopBandage', effect: 'bandage'
  }
] as const satisfies readonly ItemDefinition[];

export type ItemId = typeof ITEMS[number]['id'];
export type CatalogItemDefinition = ItemDefinition & { id: ItemId };

export interface LydiaStockEntry {
  instanceId: string;
  itemId: ItemId;
  purchased: boolean;
}

export interface LydiaShopState {
  stock: LydiaStockEntry[];
  phase: 'browsing' | 'purchasing';
}

export interface PlayerStats {
  maxHp: number;
  speed: number;
  damage: number;
  attackRate: number;
  range: number;
  critChance: number;
  critMultiplier: number;
  dashCooldown: number;
  dashDuration: number;
  armor: number;
  lifeSteal: number;
  roomHeal: number;
  burnChance: number;
  dashShield: boolean;
}

export interface StatComparison {
  id: 'damage' | 'attackSpeed' | 'range' | 'critChance' | 'armor' | 'speed';
  label: string;
  before: string;
  after: string;
  delta: number;
}

export type OfferAvailability =
  | { action: 'buy'; label: 'Kaufen' | 'Kaufen & ausrüsten'; reason?: undefined }
  | { action: 'equip'; label: 'Ausrüsten'; reason?: undefined }
  | { action: 'blocked'; label: string; reason: string };

export interface PurchaseResult {
  ok: boolean;
  kind: 'purchased' | 'equipped' | 'failed';
  message: string;
  item?: CatalogItemDefinition;
}

const ITEM_BY_ID = new Map<ItemId, CatalogItemDefinition>(
  ITEMS.map(item => [item.id, item as CatalogItemDefinition])
);

export function itemById(id: ItemId): CatalogItemDefinition {
  const item = ITEM_BY_ID.get(id);
  if (!item) throw new Error(`Unbekanntes Item: ${id}`);
  return item;
}

function applyModifiers(stats: PlayerStats, modifiers: ItemModifiers = {}): void {
  if (modifiers.damageMultiplier !== undefined) stats.damage *= modifiers.damageMultiplier;
  if (modifiers.attackRateMultiplier !== undefined) stats.attackRate *= modifiers.attackRateMultiplier;
  if (modifiers.rangeAdd !== undefined) stats.range += modifiers.rangeAdd;
  if (modifiers.critChanceAdd !== undefined) stats.critChance += modifiers.critChanceAdd;
  if (modifiers.armorAdd !== undefined) stats.armor += modifiers.armorAdd;
  if (modifiers.speedMultiplier !== undefined) stats.speed *= modifiers.speedMultiplier;
}

function applyUpgrade(stats: PlayerStats, id: UpgradeId): void {
  switch (id) {
    case 'vitality': stats.maxHp += 25; break;
    case 'might': stats.damage *= 1.18; break;
    case 'fury': stats.attackRate *= .86; break;
    case 'swiftness': stats.speed *= 1.1; break;
    case 'dash': stats.dashCooldown *= .82; break;
    case 'reach': stats.range += 14; break;
    case 'critical': stats.critChance += .08; break;
    case 'armor': stats.armor += 3; break;
    case 'leech': stats.lifeSteal += .05; break;
    case 'burn': stats.burnChance = Math.max(stats.burnChance, .35); break;
    case 'roomHeal': stats.roomHeal += 8; break;
    case 'dashShield': stats.dashShield = true; break;
  }
}

function applyRelic(stats: PlayerStats, id: RelicId): void {
  if (id === 'blood-blade') stats.lifeSteal += .03;
  else if (id === 'guardian-ring') stats.armor += 4;
  else if (id === 'shadow-boots') stats.dashCooldown *= .8;
  else if (id === 'ember-core') stats.burnChance = Math.max(stats.burnChance, .35);
}

export function calculatePlayerStats(build: Pick<Player, 'upgrades' | 'relics' | 'equipment'>): PlayerStats {
  const stats: PlayerStats = {
    maxHp: PLAYER_BASE.maxHp,
    speed: PLAYER_BASE.speed,
    damage: PLAYER_BASE.damage,
    attackRate: PLAYER_BASE.attackRate,
    range: PLAYER_BASE.range,
    critChance: PLAYER_BASE.critChance,
    critMultiplier: PLAYER_BASE.critMultiplier,
    dashCooldown: PLAYER_BASE.dashCooldown,
    dashDuration: PLAYER_BASE.dashDuration,
    armor: PLAYER_BASE.armor,
    lifeSteal: 0,
    roomHeal: 0,
    burnChance: 0,
    dashShield: false
  };
  for (const upgrade of build.upgrades ?? []) applyUpgrade(stats, upgrade);
  for (const itemId of Object.values(build.equipment ?? {})) {
    if (itemId) applyModifiers(stats, itemById(itemId).modifiers);
  }
  for (const relic of build.relics ?? []) applyRelic(stats, relic);
  stats.attackRate = Math.max(.18, stats.attackRate);
  stats.dashCooldown = Math.max(.55, stats.dashCooldown);
  stats.critChance = Math.min(.65, stats.critChance);
  return stats;
}

export function syncPlayerStats(player: Player): PlayerStats {
  const stats = calculatePlayerStats(player);
  Object.assign(player, stats);
  player.hp = Math.min(player.hp, player.maxHp);
  return stats;
}

export function createLydiaShop(random: () => number = Math.random): LydiaShopState {
  const weapons: ItemId[] = ['grave-iron-longsword', 'ashfang'];
  const armors: ItemId[] = ['patched-wolf-leather', 'soot-chainmail'];
  const weapon = weapons[Math.floor(random() * weapons.length)] ?? weapons[0]!;
  const armor = armors[Math.floor(random() * armors.length)] ?? armors[0]!;
  const remaining = [...weapons.filter(id => id !== weapon), ...armors.filter(id => id !== armor)];
  const wildcard = remaining[Math.floor(random() * remaining.length)] ?? remaining[0]!;
  const itemIds: ItemId[] = [weapon, armor, 'healing-potion', 'wound-bandage', wildcard];
  return {
    phase: 'browsing',
    stock: itemIds.map((itemId, index) => ({ instanceId: `lydia-${index}`, itemId, purchased: false }))
  };
}

export function offerAvailability(player: Player, entry: LydiaStockEntry): OfferAvailability {
  const item = itemById(entry.itemId);
  if (entry.purchased) {
    if (item.slot && player.ownedItems.includes(item.id)) {
      if (player.equipment[item.slot] === item.id) return { action: 'blocked', label: 'Ausgerüstet', reason: 'Dieser Gegenstand ist bereits ausgerüstet.' };
      return { action: 'equip', label: 'Ausrüsten' };
    }
    return { action: 'blocked', label: 'Verkauft', reason: 'Lydias Bestand für diesen Run ist erschöpft.' };
  }
  if (item.effect === 'bandage' && player.hp >= player.maxHp) {
    return { action: 'blocked', label: 'Leben voll', reason: 'Der Verband wäre jetzt wirkungslos.' };
  }
  if (player.gold < item.price) {
    return { action: 'blocked', label: 'Zu wenig Gold', reason: `Es fehlen ${item.price - player.gold} Gold.` };
  }
  return { action: 'buy', label: item.slot ? 'Kaufen & ausrüsten' : 'Kaufen' };
}

export function compareItem(player: Player, itemId: ItemId): StatComparison[] {
  const item = itemById(itemId);
  if (!item.slot) return [];
  const before = calculatePlayerStats(player);
  const after = calculatePlayerStats({ ...player, equipment: { ...player.equipment, [item.slot]: item.id } });
  const values = [
    { id: 'damage' as const, label: 'Schaden', a: before.damage, b: after.damage, format: (value: number) => value.toFixed(1) },
    { id: 'attackSpeed' as const, label: 'Angriffe/s', a: 1 / before.attackRate, b: 1 / after.attackRate, format: (value: number) => value.toFixed(2) },
    { id: 'range' as const, label: 'Reichweite', a: before.range, b: after.range, format: (value: number) => Math.round(value).toString() },
    { id: 'critChance' as const, label: 'Kritisch', a: before.critChance, b: after.critChance, format: (value: number) => `${Math.round(value * 100)} %` },
    { id: 'armor' as const, label: 'Rüstung', a: before.armor, b: after.armor, format: (value: number) => Math.round(value).toString() },
    { id: 'speed' as const, label: 'Tempo', a: before.speed, b: after.speed, format: (value: number) => Math.round(value).toString() }
  ];
  return values
    .filter(value => Math.abs(value.a - value.b) > .001)
    .map(value => ({ id: value.id, label: value.label, before: value.format(value.a), after: value.format(value.b), delta: value.b - value.a }));
}

export function activateLydiaOffer(player: Player, shop: LydiaShopState, instanceId: string): PurchaseResult {
  if (shop.phase !== 'browsing') return { ok: false, kind: 'failed', message: 'Lydia schließt erst den vorherigen Handel ab.' };
  const entry = shop.stock.find(candidate => candidate.instanceId === instanceId);
  if (!entry) return { ok: false, kind: 'failed', message: 'Dieses Angebot existiert nicht.' };
  const item = itemById(entry.itemId);
  const availability = offerAvailability(player, entry);
  if (availability.action === 'blocked') return { ok: false, kind: 'failed', message: availability.reason, item };

  shop.phase = 'purchasing';
  try {
    if (availability.action === 'equip' && item.slot) {
      player.equipment[item.slot] = item.id;
      syncPlayerStats(player);
      return { ok: true, kind: 'equipped', message: `${item.name} wurde ausgerüstet.`, item };
    }

    player.gold -= item.price;
    if (item.slot) {
      if (!player.ownedItems.includes(item.id)) player.ownedItems.push(item.id);
      player.equipment[item.slot] = item.id;
      syncPlayerStats(player);
    } else if (item.effect === 'potion') {
      player.potions++;
    } else if (item.effect === 'bandage') {
      player.hp = Math.min(player.maxHp, player.hp + 30);
    }
    entry.purchased = true;
    return { ok: true, kind: 'purchased', message: `${item.name} für ${item.price} Gold erworben.`, item };
  } finally {
    shop.phase = 'browsing';
  }
}
