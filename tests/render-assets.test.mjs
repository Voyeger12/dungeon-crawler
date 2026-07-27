import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { ASSET_MANIFEST, AssetStore } = await server.ssrLoadModule('/src/assets.ts');
  const { Game } = await server.ssrLoadModule('/src/game.ts');
  const { directionFrame, playerFrame, enemyFrame } = await server.ssrLoadModule('/src/sprites.ts');
  const { PICKUP_PRESENTATION, TORCH_MOUNTS, attackTrailOpacity } = await server.ssrLoadModule('/src/renderer.ts');

  const paths = Object.values(ASSET_MANIFEST).map(asset => asset.path);
  assert.equal(new Set(paths).size, paths.length, 'every rendered asset path must be unique');
  assert.equal(Object.values(ASSET_MANIFEST).every(asset => asset.critical === true), true, 'all current world assets must preload before a run');
  await Promise.all(paths.map(path => access(new URL(`../public${path}`, import.meta.url))));
  assert.deepEqual(Object.keys(PICKUP_PRESENTATION).sort(), ['damage', 'gold', 'heal', 'key', 'potion', 'relic', 'speed'], 'every collectable needs a dedicated presentation');
  assert.equal(new Set(Object.values(PICKUP_PRESENTATION).map(item => item.asset)).size, 7, 'collectable silhouettes must not share placeholder art');
  assert.equal(TORCH_MOUNTS.length, 6, 'rooms need a stable set of wall-bound torch anchors');
  assert.equal(TORCH_MOUNTS.every(mount => mount.x <= 48 || mount.x >= 912 || mount.y <= 51 || mount.y >= 477), true, 'torch fixtures must stay attached to wall planes');
  assert.equal(Object.keys(ASSET_MANIFEST).some(id => /^torch\d+$/.test(id)), false, 'animated full-torch sprites must not reintroduce fixture bouncing');
  for (const id of ['vfxBurnIgnite', 'vfxBurnLoop', 'vfxBurnTick', 'vfxBurnExpire', 'vfxFrost', 'vfxShield', 'vfxHit', 'vfxCrit', 'vfxArrow', 'vfxOrb', 'vfxShockwave', 'vfxBossRune', 'vfxLightning', 'vfxHeal']) {
    assert.ok(ASSET_MANIFEST[id], `${id} must be part of the preloaded feedback vocabulary`);
  }
  for (const id of ['runebearer', 'skeleton', 'archer', 'slime', 'shadow', 'boss']) {
    const asset = ASSET_MANIFEST[id];
    assert.match(asset.path, /\/clean\/.+-atlas\.png$/, `${id} must render from an isolated atlas`);
    const png = await readFile(new URL(`../public${asset.path}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1600, `${id} atlas must contain five isolated 320px columns`);
    assert.equal(png.readUInt32BE(20), 1792, `${id} atlas must contain seven isolated 256px rows`);
  }

  let imageCount = 0;
  class FakeImage {
    complete = false;
    naturalWidth = 64;
    decoding = 'auto';
    handlers = new Map();
    addEventListener(type, callback) { this.handlers.set(type, callback); }
    async decode() {}
    set src(value) {
      this.value = value; this.complete = true;
      queueMicrotask(() => this.handlers.get('load')?.());
    }
  }
  const store = new AssetStore(() => { imageCount++; return new FakeImage(); });
  const firstLoad = store.load('floor'); const duplicateLoad = store.load('floor');
  assert.equal(firstLoad, duplicateLoad, 'duplicate requests must share one asset promise');
  assert.equal(await firstLoad, true);
  assert.equal(imageCount, 1, 'one asset path must create exactly one image instance');
  assert.equal(store.state('floor'), 'ready');

  assert.deepEqual(directionFrame(0), { column: 2, mirrored: false }, 'east must use the authored east frame');
  assert.deepEqual(directionFrame(Math.PI), { column: 2, mirrored: true }, 'west must mirror the authored east frame');
  assert.deepEqual(directionFrame(-Math.PI / 2), { column: 4, mirrored: false }, 'north must use the authored north frame');

  const player = {
    aim: Math.PI / 2, dashTimer: 0, dashDir: { x: 0, y: -1 }, flash: 0, attackAnim: 0,
    vx: 0, vy: 0
  };
  assert.equal(playerFrame(player, 0).row, 0);
  assert.equal(playerFrame({ ...player, vx: 100 }, .11).row >= 1, true);
  assert.equal(playerFrame({ ...player, attackAnim: .33 }, 0).row, 3);
  assert.equal(playerFrame({ ...player, attackAnim: .2 }, 0).row, 4);
  assert.equal(attackTrailOpacity(0), 0, 'the attack trail must not be permanently visible at wind-up');
  assert.equal(attackTrailOpacity(.18), 1, 'the attack trail must peak at the damage contact marker');
  assert.equal(attackTrailOpacity(.36), 0, 'the attack trail must disappear again during recovery');
  assert.equal(attackTrailOpacity(1), 0, 'the attack trail must remain hidden after the swing');

  const skeleton = { aim: 0, state: 'telegraph', flash: 0, id: 1 };
  assert.equal(enemyFrame(skeleton, 0).row, 3);
  assert.equal(enemyFrame({ ...skeleton, state: 'attack' }, 0).row, 4);
  assert.equal(enemyFrame({ ...skeleton, state: 'dead' }, 0).row, 6);

  {
    const game = Object.create(Game.prototype);
    game.player = {
      x: 100, y: 100, radius: 16, hp: 100, maxHp: 100, speed: 200, damage: 20, attackRate: .42, range: 78,
      critChance: 0, critMultiplier: 1.75, dashCooldown: 1.35, dashDuration: .18, armor: 3, level: 1, xp: 0, xpNeeded: 92,
      gold: 0, potions: 2, keys: 0, aim: 0, attackTimer: 0, attackAnim: 0, attackCombo: 0, attackCount: 0,
      dashTimer: 0, dashCdTimer: 0, dashDir: { x: 1, y: 0 }, invuln: 0, flash: 0, shield: 0, vx: 0, vy: 0,
      upgrades: [], relics: [], lifeSteal: 0, roomHeal: 0, burnChance: 0, dashShield: false, damageBuff: 0, speedBuff: 0
    };
    game.enemies = [{
      id: 1, kind: 'skeleton', x: 150, y: 100, radius: 17, hp: 100, maxHp: 100, speed: 82, damage: 15, xp: 25,
      gold: [4, 8], elite: false, state: 'chase', stateTimer: 0, cooldown: 0, aim: 0, vx: 0, vy: 0, flash: 0,
      slow: 0, burn: 0, burnTick: 0, phase: 1, attackType: -1, summoned: false, contactCd: 0, deathTimer: 0
    }];
    game.room = { obstacles: [] }; game.stats = { damageDealt: 0 };
    game.tutorial = { complete() {} }; game.audio = { play() {} }; game.renderer = { shake: 0, flash: 0 };
    game.floatText = () => {}; game.burst = () => {}; game.effect = () => {};

    game.attack();
    assert.equal(game.enemies[0].hp, 100, 'attack input must not deal invisible immediate damage');
    game.updateTimers(.03);
    assert.equal(game.enemies[0].hp, 100, 'damage must wait for the contact marker');
    game.updateTimers(.031);
    assert.equal(game.enemies[0].hp, 80, 'the contact marker must apply damage once');
    game.updateTimers(.1);
    assert.equal(game.enemies[0].hp, 80, 'later animation frames must not repeat the hit');
  }

  console.log('Asset manifest, sprite direction, and animation-contact tests passed.');
} finally {
  await server.close();
}
