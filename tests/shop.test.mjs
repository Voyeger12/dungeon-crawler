import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

const makePlayer = (overrides = {}) => ({
  x: 480, y: 400, radius: 16, hp: 90, maxHp: 120,
  speed: 205, damage: 24, attackRate: .42, range: 78,
  critChance: .12, critMultiplier: 1.75, dashCooldown: 1.35, dashDuration: .18, armor: 3,
  level: 1, xp: 0, xpNeeded: 92, gold: 250, potions: 2, keys: 0,
  aim: 0, attackTimer: 0, attackAnim: 0, attackCombo: 0, attackCount: 0,
  dashTimer: 0, dashCdTimer: 0, dashDir: { x: 0, y: -1 }, invuln: 0, flash: 0,
  shield: 0, vx: 0, vy: 0, upgrades: [], relics: [], lifeSteal: 0, roomHeal: 0,
  burnChance: 0, dashShield: false, damageBuff: 0, speedBuff: 0,
  equipment: {}, ownedItems: [], ...overrides
});

try {
  const { ASSET_MANIFEST } = await server.ssrLoadModule('/src/assets.ts');
  const { Game } = await server.ssrLoadModule('/src/game.ts');
  const { generateDungeon } = await server.ssrLoadModule('/src/dungeon.ts');
  const { UI } = await server.ssrLoadModule('/src/ui.ts');
  const {
    ITEMS, activateLydiaOffer, calculatePlayerStats, compareItem, createLydiaShop,
    itemById, offerAvailability
  } = await server.ssrLoadModule('/src/items.ts');

  assert.equal(ITEMS.length, 6, 'the first Lydia catalog must contain four gear pieces and two supplies');
  assert.equal(new Set(ITEMS.map(item => item.id)).size, ITEMS.length, 'catalog item ids must be unique');
  for (const item of ITEMS) {
    assert.ok(ASSET_MANIFEST[item.asset], `${item.id} must use a preloaded authored asset`);
    assert.equal(item.price > 0, true, `${item.id} must have a positive gold price`);
  }

  const shop = createLydiaShop(() => 0);
  assert.equal(shop.stock.length, 5, 'Lydia must expose exactly five offers');
  assert.equal(new Set(shop.stock.map(entry => entry.itemId)).size, 5, 'a shop stock must not repeat an item');
  assert.equal(shop.stock.some(entry => itemById(entry.itemId).category === 'weapon'), true);
  assert.equal(shop.stock.some(entry => itemById(entry.itemId).category === 'armor'), true);
  assert.equal(shop.stock.some(entry => entry.itemId === 'healing-potion'), true);
  assert.equal(shop.stock.some(entry => entry.itemId === 'wound-bandage'), true);

  {
    const player = makePlayer();
    const swordEntry = shop.stock.find(entry => entry.itemId === 'grave-iron-longsword');
    const beforeGold = player.gold;
    const result = activateLydiaOffer(player, shop, swordEntry.instanceId);
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'purchased');
    assert.equal(player.gold, beforeGold - itemById(swordEntry.itemId).price, 'a purchase must deduct its price exactly once');
    assert.equal(player.equipment.mainHand, swordEntry.itemId, 'purchased gear must equip immediately');
    assert.equal(player.ownedItems.includes(swordEntry.itemId), true, 'purchased equipment must enter persistent run ownership');
    assert.equal(swordEntry.purchased, true);
    const goldAfterPurchase = player.gold;
    const duplicate = activateLydiaOffer(player, shop, swordEntry.instanceId);
    assert.equal(duplicate.ok, false, 'repeated activation of the equipped sold card must be rejected');
    assert.equal(player.gold, goldAfterPurchase, 'a repeat activation must never deduct gold twice');
    assert.equal(calculatePlayerStats(player).damage > 24, true, 'equipped shop weapons must affect the central stat calculation');
    assert.equal(compareItem(player, 'ashfang').some(row => row.id === 'attackSpeed' && row.delta > 0), true, 'comparison data must expose meaningful equipment tradeoffs');
  }

  {
    const poorPlayer = makePlayer({ gold: 0 });
    const poorShop = createLydiaShop(() => 0);
    const entry = poorShop.stock[0];
    const availability = offerAvailability(poorPlayer, entry);
    assert.equal(availability.action, 'blocked');
    const result = activateLydiaOffer(poorPlayer, poorShop, entry.instanceId);
    assert.equal(result.ok, false);
    assert.equal(poorPlayer.gold, 0);
    assert.equal(entry.purchased, false, 'insufficient funds must leave stock untouched');
  }

  {
    const healthyPlayer = makePlayer({ hp: 120 });
    const supplyShop = createLydiaShop(() => 0);
    const bandage = supplyShop.stock.find(entry => entry.itemId === 'wound-bandage');
    assert.equal(offerAvailability(healthyPlayer, bandage).action, 'blocked', 'a full-health bandage purchase must be disabled');
    const beforeGold = healthyPlayer.gold;
    assert.equal(activateLydiaOffer(healthyPlayer, supplyShop, bandage.instanceId).ok, false);
    assert.equal(healthyPlayer.gold, beforeGold);
  }

  for (let run = 0; run < 300; run++) {
    const rooms = generateDungeon();
    const shops = [...rooms.values()].filter(room => room.kind === 'shop');
    assert.equal(shops.length, 1, 'every procedural run must contain exactly one Lydia room');
    const lydia = shops[0];
    assert.ok(lydia.shop);
    assert.equal(lydia.shop.displaySlots.length, 5, 'the world stall must expose all five pieces of stock');
    assert.equal(lydia.blockers.length > 0, true, 'the shop house and counter need physical collision');
    assert.equal(lydia.obstacles.length, 0, 'random combat obstacles must never invade the shop');
    const reached = new Set(['start']); const queue = ['start'];
    while (queue.length) {
      const room = rooms.get(queue.shift());
      for (const id of Object.values(room.connections)) if (id && !reached.has(id)) { reached.add(id); queue.push(id); }
    }
    assert.equal(reached.has(lydia.id), true, 'Lydia must always be reachable from the start');
  }

  {
    const game = Object.create(Game.prototype);
    game.room = { depth: 3 }; game.enemies = []; game.nextId = 1;
    const summoned = game.spawnEnemy('slime', 100, 100, false, true);
    assert.equal(summoned.xp, 0);
    assert.deepEqual(summoned.gold, [0, 0], 'summoned split slimes must not become an infinite shop economy exploit');
  }

  {
    const ui = Object.create(UI.prototype);
    const feedback = { textContent: '' };
    const inertButton = { addEventListener() {}, dataset: {} };
    ui.store = { settings: { reducedEffects: false } };
    ui.actions = { closeModal() {}, activateShopOffer() {} };
    ui.hudView = { hideTransient() {} };
    ui.setGameInert = () => {};
    ui.focusDialog = () => {};
    ui.root = {
      innerHTML: '',
      querySelector: selector => selector === '#shop-feedback' ? feedback : inertButton,
      querySelectorAll: () => []
    };
    ui.showShop(createLydiaShop(() => 0), makePlayer(), 'Willkommen an der Esse.');
    assert.match(ui.root.innerHTML, /Lydias Waren/);
    assert.match(ui.root.innerHTML, /Nur Kauf/);
    assert.equal((ui.root.innerHTML.match(/class="shop-offer"/g) ?? []).length, 5);
    assert.match(ui.root.innerHTML, /assets\/gameplay\/generated\/shop\/lydia-last-forge\.png/);
    for (const entry of createLydiaShop(() => 0).stock) {
      assert.equal(ui.root.innerHTML.includes(ASSET_MANIFEST[itemById(entry.itemId).asset].path), true, `${entry.itemId} art must appear in the shop UI`);
    }
    assert.doesNotMatch(ui.root.innerHTML, /<canvas|<svg/, 'the shop UI must use authored image assets, not CSS/canvas placeholder drawings');
    assert.equal(feedback.textContent, 'Willkommen an der Esse.');
  }

  const shopCss = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(shopCss, /dark-oak\.webp/);
  assert.match(shopCss, /blackened-iron\.webp/);

  console.log('Lydia shop economy, procedural room, assets, and UI tests passed.');
} finally {
  await server.close();
}
