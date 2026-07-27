import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { Game } = await server.ssrLoadModule('/src/game.ts');

  const enemy = (id, x, y) => ({
    id, kind: 'skeleton', x, y, radius: 10, hp: 500, maxHp: 500, speed: 0, damage: 0,
    xp: 0, gold: [0, 0], elite: false, state: 'chase', stateTimer: 0, cooldown: 0,
    aim: 0, vx: 0, vy: 0, flash: 0, slow: 0, burn: 0, burnTick: 0,
    phase: 1, attackType: -1, summoned: false, contactCd: 0, deathTimer: 0
  });

  const harness = () => {
    const game = Object.create(Game.prototype);
    game.player = {
      x: 0, y: 0, radius: 16, damage: 24, damageBuff: 0, range: 78, aim: 0,
      attackTimer: 0, attackRate: .42, attackAnim: 0, attackCombo: 0, attackCount: 2,
      critChance: 0, critMultiplier: 1.75, burnChance: 0, lifeSteal: 0,
      relics: ['storm-rune']
    };
    game.enemies = [enemy(1, 40, 0), enemy(2, 55, 4), enemy(3, 70, -4)];
    game.room = { obstacles: [] };
    game.stats = { damageDealt: 0 };
    game.audio = { play() {} };
    game.renderer = { shake: 0, flash: 0 };
    game.store = { settings: { reducedEffects: true } };
    game.tutorial = { complete() {}, queue() {} };
    game.floatText = () => {};
    game.burst = () => {};
    game.effect = () => {};
    const bolts = [];
    game.lightning = (from, to) => bolts.push([from.id, to.id]);
    return { game, bolts };
  };

  {
    const { game, bolts } = harness();
    const originalChain = game.chainLightning.bind(game);
    let chainCalls = 0;
    game.chainLightning = origin => { chainCalls++; originalChain(origin); };

    game.attack();

    assert.equal(game.player.attackCount, 3, 'the attack counter should reach the third attack');
    assert.equal(chainCalls, 0, 'the lightning chain must wait for the visible weapon contact');
    game.updateTimers(.061);
    assert.equal(chainCalls, 1, 'a multi-hit third attack must start exactly one lightning chain');
    assert.deepEqual(bolts, [[1, 2], [2, 3]], 'the chain must hit at most two distinct secondary targets');
    assert.equal(game.enemies[0].hp, 476, 'the deterministic nearest origin receives only direct damage');
    assert.equal(game.enemies[1].hp, 465, 'the first secondary target receives direct and chain damage');
    assert.equal(game.enemies[2].hp, 465, 'the second secondary target receives direct and chain damage');
  }

  {
    const { game, bolts } = harness();
    game.player.attackCount = 3;
    const originalChain = game.chainLightning.bind(game);
    let chainCalls = 0;
    game.chainLightning = origin => { chainCalls++; originalChain(origin); };

    game.damageEnemy(game.enemies[0], 5, false);

    assert.equal(chainCalls, 0, 'secondary damage must not trigger the Storm Rune');
    assert.equal(bolts.length, 0, 'secondary damage must not emit lightning');
    assert.equal(game.enemies[0].hp, 495, 'secondary damage should still be applied normally');
  }

  {
    const { game, bolts } = harness();
    game.enemies.forEach(target => { target.hp = 1_000_000_000; target.maxHp = 1_000_000_000; });
    game.player.range = 1_000_000_000;
    for (let i = 0; i < 1_000; i++) { game.player.attackTimer = 0; game.attack(); game.updateTimers(.061); }
    assert.equal(game.player.attackCount, 1002, 'a long multi-hit attack soak must finish without recursion or a frozen loop');
    assert.equal(bolts.length, 668, '1,000 attacks should create exactly two bounded chain segments on each third hit');
    assert.equal(game.enemies.every(target => Number.isFinite(target.hp) && target.hp > 0), true, 'stress targets must remain in a valid numeric state');
  }

  console.log('Storm Rune regression tests passed.');
} finally {
  await server.close();
}
