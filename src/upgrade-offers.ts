import { UPGRADES, type UpgradeId } from './config';
import type { Player } from './model';

export type UpgradeDefinition = typeof UPGRADES[number];
export type UpgradeOfferPlayer = Pick<Player, 'upgrades' | 'attackRate' | 'dashCooldown' | 'critChance' | 'burnChance' | 'dashShield'>;

export const REROLL_BASE_COST = 25;
export const REROLL_FAILURE_MESSAGE = 'Die Münzen reichen nicht, um das Schicksal zu beugen.';

const MAX_STACKS: Partial<Record<UpgradeId, number>> = {
  fury: 6,
  dash: 5,
  critical: 7,
  burn: 1,
  dashShield: 1
};

const UPGRADE_WEIGHTS: Record<UpgradeId, number> = Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, 1])) as Record<UpgradeId, number>;
const EVERGREEN_UPGRADES: readonly UpgradeId[] = ['vitality', 'might', 'armor'];

export function getRerollCost(completedRerolls: number): number {
  const safeCount = Number.isFinite(completedRerolls) ? Math.max(0, Math.floor(completedRerolls)) : 0;
  return REROLL_BASE_COST * (safeCount + 1);
}

export function isUpgradeEligible(player: UpgradeOfferPlayer, id: UpgradeId): boolean {
  const stackCount = player.upgrades.filter(upgradeId => upgradeId === id).length;
  const maxStacks = MAX_STACKS[id];
  if (maxStacks !== undefined && stackCount >= maxStacks) return false;

  switch (id) {
    case 'fury': return player.attackRate > .18001;
    case 'dash': return player.dashCooldown > .55001;
    case 'critical': return player.critChance < .64999;
    case 'burn': return player.burnChance < .34999;
    case 'dashShield': return !player.dashShield;
    default: return true;
  }
}

function weightedDraw(pool: readonly UpgradeDefinition[], count: number, random: () => number): UpgradeDefinition[] {
  const remaining = [...pool];
  const result: UpgradeDefinition[] = [];
  while (remaining.length > 0 && result.length < count) {
    const totalWeight = remaining.reduce((sum, upgrade) => sum + UPGRADE_WEIGHTS[upgrade.id], 0);
    const rawRoll = random();
    let roll = Math.max(0, Math.min(.999999999, Number.isFinite(rawRoll) ? rawRoll : 0)) * totalWeight;
    let selectedIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index++) {
      roll -= UPGRADE_WEIGHTS[remaining[index]!.id];
      if (roll < 0) { selectedIndex = index; break; }
    }
    result.push(remaining.splice(selectedIndex, 1)[0]!);
  }
  return result;
}

export function createUpgradeOffers(
  player: UpgradeOfferPlayer,
  previousIds: readonly UpgradeId[] = [],
  random: () => number = Math.random
): UpgradeDefinition[] {
  const eligible = UPGRADES.filter(upgrade => isUpgradeEligible(player, upgrade.id));
  const eligibleIds = new Set(eligible.map(upgrade => upgrade.id));

  // These three stat upgrades are intentionally evergreen. They keep future restricted
  // pools from ever producing an empty or duplicated level-up selection.
  for (const id of EVERGREEN_UPGRADES) {
    if (eligibleIds.has(id)) continue;
    const fallback = UPGRADES.find(upgrade => upgrade.id === id);
    if (fallback) { eligible.push(fallback); eligibleIds.add(id); }
  }

  const previous = new Set(previousIds);
  const fresh = eligible.filter(upgrade => !previous.has(upgrade.id));
  const offers = weightedDraw(fresh, 3, random);
  if (offers.length < 3) {
    const selected = new Set(offers.map(upgrade => upgrade.id));
    const reusable = eligible.filter(upgrade => !selected.has(upgrade.id));
    offers.push(...weightedDraw(reusable, 3 - offers.length, random));
  }
  return offers.slice(0, 3);
}
