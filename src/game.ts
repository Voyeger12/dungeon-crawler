import { AudioManager } from './audio';
import { ENEMY_STATS, PLAYER_BASE, RELICS, UPGRADES, WORLD, XP_FOR_LEVEL, type RelicId, type UpgradeId } from './config';
import { generateDungeon, oppositeDirection } from './dungeon';
import { InputManager } from './input';
import { angleDiff, circleHit, clamp, dist, normalize, pick, rand, randi, shuffle, type Vec } from './math';
import type { Direction, Enemy, EnemyKind, FloatText, Hazard, Particle, Pickup, Player, Projectile, Room, RunStats } from './model';
import { Renderer } from './renderer';
import { StorageManager } from './storage';
import { UI, type UIActions } from './ui';

type Mode = 'menu' | 'running' | 'paused' | 'level' | 'character' | 'map' | 'ending';

export class Game implements UIActions {
  private renderer: Renderer;
  private input: InputManager;
  private audio: AudioManager;
  private ui: UI;
  private mode: Mode = 'menu';
  private player!: Player;
  private rooms = new Map<string, Room>();
  private room!: Room;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private hazards: Hazard[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private stats!: RunStats;
  private time = 0;
  private lastTime = 0;
  private roomIntro = 0;
  private roomTransitionCd = 0;
  private pendingLevels = 0;
  private endTimer = 0;
  private nextId = 1;
  private levelOptions: typeof UPGRADES[number][] = [];

  constructor(private canvas: HTMLCanvasElement, private store: StorageManager) {
    this.renderer = new Renderer(canvas);
    this.audio = new AudioManager(store.settings);
    this.input = new InputManager(canvas, () => { if (this.mode === 'running') this.pause(); });
    this.ui = new UI(store, this);
    window.addEventListener('rune-settings', () => this.audio.applySettings(this.store.settings));
    this.ui.showStart(); requestAnimationFrame(this.loop);
  }

  startRun(): void {
    this.audio.start(); this.resetRun(); this.mode = 'running'; this.ui.beginGame(); this.canvas.focus();
  }

  restart(): void { this.audio.start(); this.resetRun(); this.mode = 'running'; this.ui.beginGame(); }
  resume(): void { if (!this.player) return; this.ui.clearOverlay(); this.mode = 'running'; this.input.reset(); }
  mainMenu(): void { this.mode = 'menu'; this.enemies = []; this.projectiles = []; this.hazards = []; this.input.reset(); this.ui.showStart(); }

  chooseUpgrade(id: string): void {
    const upgrade = UPGRADES.find(item => item.id === id); if (!upgrade) return;
    this.applyUpgrade(upgrade.id); this.player.upgrades.push(upgrade.id); this.ui.toast(`${upgrade.icon} ${upgrade.name}`, 'good');
    this.pendingLevels--;
    if (this.pendingLevels > 0) window.setTimeout(() => this.openLevelUp(), 120); else this.resume();
  }

  private resetRun(): void {
    this.rooms = generateDungeon(); this.room = this.rooms.get('start')!; this.room.visited = true;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.hazards = []; this.particles = []; this.texts = [];
    this.player = {
      x: WORLD.width / 2, y: WORLD.height / 2 + 80, radius: 16, hp: PLAYER_BASE.maxHp, maxHp: PLAYER_BASE.maxHp,
      speed: PLAYER_BASE.speed, damage: PLAYER_BASE.damage, attackRate: PLAYER_BASE.attackRate, range: PLAYER_BASE.range,
      critChance: PLAYER_BASE.critChance, critMultiplier: PLAYER_BASE.critMultiplier, dashCooldown: PLAYER_BASE.dashCooldown,
      dashDuration: PLAYER_BASE.dashDuration, armor: PLAYER_BASE.armor, level: 1, xp: 0, xpNeeded: XP_FOR_LEVEL(1),
      gold: 0, potions: PLAYER_BASE.potions, keys: 0, aim: -Math.PI / 2, attackTimer: 0, attackAnim: 0,
      attackCombo: 0, attackCount: 0, dashTimer: 0, dashCdTimer: 0, dashDir: { x: 0, y: -1 }, invuln: 0,
      flash: 0, shield: 0, vx: 0, vy: 0, upgrades: [], relics: [], lifeSteal: 0, roomHeal: 0,
      burnChance: 0, dashShield: false, damageBuff: 0, speedBuff: 0
    };
    this.stats = { startTime: performance.now(), elapsed: 0, kills: 0, goldFound: 0, roomsVisited: 1, potionsUsed: 0, damageDealt: 0, damageTaken: 0 };
    this.time = 0; this.roomIntro = 2.2; this.roomTransitionCd = .5; this.pendingLevels = 0; this.endTimer = 0; this.nextId = 1;
    this.store.records.runs++; this.store.save();
  }

  private loop = (now: number) => {
    const dt = Math.min(.033, Math.max(0, (now - this.lastTime) / 1000 || 0)); this.lastTime = now;
    if (this.mode === 'running') this.update(dt); else this.handleOverlayKeys();
    if (this.player && this.room && this.mode !== 'menu') this.renderer.render({
      room: this.room, rooms: this.rooms, player: this.player, enemies: this.enemies, projectiles: this.projectiles,
      pickups: this.pickups, hazards: this.hazards, particles: this.particles, texts: this.texts, time: this.time,
      doorsOpen: this.doorsOpen(), roomIntro: this.roomIntro, settings: this.store.settings
    });
    this.input.endFrame(); requestAnimationFrame(this.loop);
  };

  private handleOverlayKeys(): void {
    if (this.mode === 'paused' && this.input.consume('Escape')) this.resume();
    else if (this.mode === 'character' && (this.input.consume('KeyI') || this.input.consume('Escape'))) this.resume();
    else if (this.mode === 'map' && (this.input.consume('KeyM') || this.input.consume('Escape'))) this.resume();
    else if (this.mode === 'ending' && this.input.consume('KeyR')) this.restart();
    else if (this.mode === 'level') {
      const index = this.input.consume('Digit1') ? 0 : this.input.consume('Digit2') ? 1 : this.input.consume('Digit3') ? 2 : -1;
      if (index >= 0 && this.levelOptions[index]) this.chooseUpgrade(this.levelOptions[index].id);
    }
  }

  private update(dt: number): void {
    this.time += dt; this.stats.elapsed += dt; this.roomIntro = Math.max(0, this.roomIntro - dt); this.roomTransitionCd = Math.max(0, this.roomTransitionCd - dt);
    if (this.input.consume('Escape')) { this.pause(); return; }
    if (this.input.consume('KeyI')) { this.mode = 'character'; this.ui.showCharacter(this.player); return; }
    if (this.input.consume('KeyM')) { this.mode = 'map'; this.ui.showMap(this.buildMapHtml()); return; }
    this.updateTimers(dt); this.updatePlayer(dt); this.updateEnemies(dt); this.updateProjectiles(dt); this.updateHazards(dt); this.updatePickups(dt); this.updateEffects(dt);
    this.checkRoomComplete(); this.checkTransition(); this.updateHud();
    if (this.endTimer > 0) { this.endTimer -= dt; if (this.endTimer <= 0) this.finish(true); }
  }

  private updateTimers(dt: number): void {
    const p = this.player; p.attackTimer = Math.max(0, p.attackTimer - dt); p.attackAnim = Math.max(0, p.attackAnim - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt); p.dashCdTimer = Math.max(0, p.dashCdTimer - dt); p.invuln = Math.max(0, p.invuln - dt); p.flash = Math.max(0, p.flash - dt);
    p.damageBuff = Math.max(0, p.damageBuff - dt); p.speedBuff = Math.max(0, p.speedBuff - dt);
  }

  private updatePlayer(dt: number): void {
    const p = this.player; const move = this.input.movement(); p.aim = Math.atan2(this.input.mouse.y - p.y, this.input.mouse.x - p.x);
    if (this.input.consume('ShiftLeft') || this.input.consume('ShiftRight')) this.tryDash(move);
    if (p.dashTimer > 0) {
      this.moveCircle(p, p.dashDir.x * 590 * dt, p.dashDir.y * 590 * dt, p.radius);
      if (!this.store.settings.reducedEffects && Math.random() < .65) this.particle(p.x + rand(-8, 8), p.y + rand(-8, 8), '#70aac2', rand(-30, 30), rand(-30, 30), .24, rand(3, 7));
    } else {
      const speed = p.speed * (p.speedBuff > 0 ? 1.3 : 1); this.moveCircle(p, move.x * speed * dt, move.y * speed * dt, p.radius);
      if ((this.input.mouse.down || this.input.isDown('Space')) && p.attackTimer <= 0 && this.roomIntro < 1.75) this.attack();
    }
    if (this.input.consume('KeyQ')) this.usePotion();
    if (this.input.consume('KeyE')) this.interact();
    for (const o of this.room.obstacles) {
      if (o.kind === 'spikes' && o.hp > 0 && Math.sin(this.time * 2.2 + o.phase) > .35 && circleHit(p, p.radius, o, o.radius)) this.damagePlayer(11, o);
    }
  }

  private tryDash(move: Vec): void {
    const p = this.player; if (p.dashCdTimer > 0 || p.dashTimer > 0) return;
    const direction = move.x || move.y ? move : { x: Math.cos(p.aim), y: Math.sin(p.aim) };
    p.dashDir = direction; p.dashTimer = p.dashDuration; p.dashCdTimer = p.dashCooldown; p.invuln = Math.max(p.invuln, p.dashDuration + .06);
    if (p.dashShield) p.shield = Math.max(p.shield, 12); this.audio.play('dash'); this.burst(p.x, p.y, '#6db1c7', 9, 125); this.renderer.shake = 2;
  }

  private attack(): void {
    const p = this.player; p.attackTimer = p.attackRate; p.attackAnim = .16; p.attackCombo = (p.attackCombo + 1) % 3; p.attackCount++; this.audio.play('slash');
    const combo = p.attackCombo === 2; const range = p.range * (combo ? 1.15 : 1); const arc = combo ? 1.15 : .88; let hit = false;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead' || dist(p, enemy) > range + enemy.radius) continue;
      const a = Math.atan2(enemy.y - p.y, enemy.x - p.x); if (Math.abs(angleDiff(a, p.aim)) > arc) continue;
      const crit = Math.random() < p.critChance; let damage = p.damage * (p.damageBuff > 0 ? 1.35 : 1) * (combo ? 1.28 : 1) * (crit ? p.critMultiplier : 1);
      damage = Math.round(damage); this.damageEnemy(enemy, damage, crit, p.aim); hit = true;
    }
    for (const obstacle of this.room.obstacles) {
      if (!obstacle.breakable || obstacle.hp <= 0 || dist(p, obstacle) > range + obstacle.radius) continue;
      const a = Math.atan2(obstacle.y - p.y, obstacle.x - p.x); if (Math.abs(angleDiff(a, p.aim)) > arc) continue;
      obstacle.hp -= p.damage; this.burst(obstacle.x, obstacle.y, '#a87b56', 6, 90); if (obstacle.hp <= 0) this.breakObstacle(obstacle.x, obstacle.y);
    }
    if (hit) { this.renderer.shake = combo ? 6 : 3; if (combo) this.renderer.flash = .05; }
  }

  private damageEnemy(enemy: Enemy, amount: number, crit: boolean, attackAngle?: number): void {
    if (enemy.state === 'dead') return; enemy.hp -= amount; enemy.flash = .11; this.stats.damageDealt += amount;
    const color = crit ? '#ffd166' : '#f4e5d1'; this.floatText(enemy.x, enemy.y - enemy.radius, `${crit ? '✦ ' : ''}${amount}`, color, crit ? 20 : 15);
    this.burst(enemy.x, enemy.y, crit ? '#ffd166' : '#e15a63', crit ? 13 : 7, crit ? 180 : 110); this.audio.play(crit ? 'crit' : 'hit');
    if (attackAngle !== undefined && enemy.kind !== 'boss') { enemy.x += Math.cos(attackAngle) * (crit ? 22 : 13); enemy.y += Math.sin(attackAngle) * (crit ? 22 : 13); }
    const frost = this.hasRelic('frost-amulet'); if (frost) enemy.slow = Math.max(enemy.slow, 1.7);
    if (this.player.burnChance > 0 && Math.random() < this.player.burnChance) enemy.burn = Math.max(enemy.burn, 2.8);
    if (this.player.lifeSteal > 0) this.heal(amount * this.player.lifeSteal, false);
    if (this.hasRelic('storm-rune') && this.player.attackCount % 3 === 0) this.chainLightning(enemy);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private chainLightning(origin: Enemy): void {
    const targets = this.enemies.filter(e => e !== origin && e.state !== 'dead').sort((a,b) => dist(origin, a) - dist(origin, b)).slice(0, 2);
    let from: Vec = origin; for (const target of targets) { if (dist(from, target) > 190) break; this.lightning(from, target); this.damageEnemy(target, Math.round(this.player.damage * .45), false); from = target; }
  }

  private killEnemy(enemy: Enemy): void {
    if (enemy.state === 'dead') return; enemy.state = 'dead'; enemy.hp = 0; this.stats.kills++; this.audio.play('death'); this.burst(enemy.x, enemy.y, enemy.kind === 'boss' ? '#c55973' : '#8b637e', enemy.kind === 'boss' ? 45 : 18, enemy.kind === 'boss' ? 270 : 150);
    this.gainXp(enemy.xp); const goldMultiplier = this.hasRelic('golden-skull') ? 1.45 : 1; const gold = Math.round(randi(enemy.gold[0], enemy.gold[1]) * (enemy.elite ? 2.2 : 1) * goldMultiplier);
    const coins = Math.min(5, Math.max(1, Math.ceil(gold / 4))); for (let i = 0; i < coins; i++) this.spawnPickup('gold', enemy.x + rand(-18,18), enemy.y + rand(-18,18), Math.ceil(gold / coins));
    if (enemy.kind === 'boss') { this.projectiles = []; this.hazards = []; this.endTimer = 2.6; this.audio.play('victory'); this.renderer.flash = .25; }
    else {
      if (Math.random() < .1) this.spawnPickup('heal', enemy.x + 12, enemy.y, 12);
      if (Math.random() < .045) this.spawnPickup('potion', enemy.x - 12, enemy.y, 1);
      if (enemy.elite) { this.spawnRelic(enemy.x, enemy.y - 15); this.spawnPickup('key', enemy.x + 22, enemy.y + 8, 1); }
      if (enemy.kind === 'slime' && !enemy.summoned && Math.random() < .38) { this.spawnEnemy('slime', enemy.x - 18, enemy.y, false, true); this.spawnEnemy('slime', enemy.x + 18, enemy.y, false, true); }
    }
  }

  private gainXp(amount: number): void {
    const p = this.player; p.xp += amount;
    while (p.xp >= p.xpNeeded) { p.xp -= p.xpNeeded; p.level++; p.xpNeeded = XP_FOR_LEVEL(p.level); this.pendingLevels++; }
    if (this.pendingLevels > 0 && this.mode === 'running') this.openLevelUp();
  }

  private openLevelUp(): void { this.mode = 'level'; this.input.reset(); this.audio.play('level'); this.levelOptions = shuffle(UPGRADES).slice(0, 3); this.ui.showLevelUp(this.levelOptions, this.player.level); }

  private applyUpgrade(id: UpgradeId): void {
    const p = this.player;
    switch (id) {
      case 'vitality': p.maxHp += 25; this.heal(25, false); break;
      case 'might': p.damage *= 1.18; break; case 'fury': p.attackRate = Math.max(.18, p.attackRate * .86); break;
      case 'swiftness': p.speed *= 1.1; break; case 'dash': p.dashCooldown = Math.max(.55, p.dashCooldown * .82); break;
      case 'reach': p.range += 14; break; case 'critical': p.critChance = Math.min(.65, p.critChance + .08); break;
      case 'armor': p.armor += 3; break; case 'leech': p.lifeSteal += .05; break; case 'burn': p.burnChance = Math.max(p.burnChance, .35); break;
      case 'roomHeal': p.roomHeal += 8; break; case 'dashShield': p.dashShield = true; break;
    }
  }

  private updateEnemies(dt: number): void {
    if (this.roomIntro > .8) return;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      enemy.flash = Math.max(0, enemy.flash - dt); enemy.cooldown -= dt; enemy.contactCd -= dt; enemy.slow = Math.max(0, enemy.slow - dt);
      if (enemy.burn > 0) { enemy.burn -= dt; enemy.burnTick -= dt; if (enemy.burnTick <= 0) { enemy.burnTick = .55; this.damageEnemy(enemy, Math.max(2, Math.round(this.player.damage * .1)), false); if (enemy.hp <= 0) continue; } }
      enemy.aim = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      if (enemy.kind === 'boss') this.updateBoss(enemy, dt); else this.updateRegularEnemy(enemy, dt);
      enemy.x = clamp(enemy.x, WORLD.wall + enemy.radius, WORLD.width - WORLD.wall - enemy.radius); enemy.y = clamp(enemy.y, WORLD.wall + enemy.radius, WORLD.height - WORLD.wall - enemy.radius);
    }
  }

  private updateRegularEnemy(enemy: Enemy, dt: number): void {
    const d = dist(enemy, this.player); const slow = enemy.slow > 0 ? .55 : 1; const speed = enemy.speed * slow * (enemy.elite && enemy.hp < enemy.maxHp * .4 ? 1.3 : 1);
    if (enemy.state === 'telegraph') {
      enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) this.executeEnemyAttack(enemy); return;
    }
    if (enemy.state === 'attack') {
      enemy.stateTimer -= dt; this.moveEnemy(enemy, enemy.vx * dt, enemy.vy * dt);
      if ((enemy.kind === 'slime' || enemy.kind === 'shadow') && circleHit(enemy, enemy.radius, this.player, this.player.radius) && enemy.contactCd <= 0) { this.damagePlayer(enemy.damage, enemy); enemy.contactCd = .5; }
      if (enemy.stateTimer <= 0) { enemy.state = 'recover'; enemy.stateTimer = enemy.kind === 'shadow' ? .65 : .5; } return;
    }
    if (enemy.state === 'recover') { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { enemy.state = 'chase'; enemy.cooldown = rand(.45, .8); } return; }
    if (enemy.kind === 'archer') {
      const dir = normalize({ x: this.player.x - enemy.x, y: this.player.y - enemy.y });
      if (d < 150) this.moveEnemy(enemy, -dir.x * speed * dt, -dir.y * speed * dt); else if (d > 265) this.moveEnemy(enemy, dir.x * speed * dt, dir.y * speed * dt); else this.moveEnemy(enemy, -dir.y * speed * .42 * dt, dir.x * speed * .42 * dt);
      if (enemy.cooldown <= 0 && d < 360 && this.lineOfSight(enemy, this.player)) this.beginTelegraph(enemy, .62);
    } else {
      const dir = normalize({ x: this.player.x - enemy.x, y: this.player.y - enemy.y }); this.moveEnemy(enemy, dir.x * speed * dt, dir.y * speed * dt);
      const trigger = enemy.kind === 'skeleton' ? 68 : enemy.kind === 'slime' ? 145 : 235;
      if (enemy.cooldown <= 0 && d < trigger) this.beginTelegraph(enemy, enemy.kind === 'shadow' ? .48 : enemy.kind === 'slime' ? .58 : .42);
    }
  }

  private beginTelegraph(enemy: Enemy, duration: number): void { enemy.state = 'telegraph'; enemy.stateTimer = duration; enemy.vx = 0; enemy.vy = 0; this.audio.play('warning'); }

  private executeEnemyAttack(enemy: Enemy): void {
    const direction = normalize({ x: this.player.x - enemy.x, y: this.player.y - enemy.y });
    if (enemy.kind === 'archer') { this.spawnProjectile(enemy.x + direction.x * 22, enemy.y + direction.y * 22, direction.x * 265, direction.y * 265, enemy.damage, true, '#d585b5', enemy.id); this.audio.play('shoot'); enemy.state = 'recover'; enemy.stateTimer = .42; }
    else if (enemy.kind === 'skeleton') { if (dist(enemy, this.player) < 86) this.damagePlayer(enemy.damage, enemy); enemy.state = 'recover'; enemy.stateTimer = .55; this.burst(enemy.x + direction.x * 30, enemy.y + direction.y * 30, '#e3d0ad', 4, 80); }
    else { enemy.vx = direction.x * (enemy.kind === 'shadow' ? 440 : 285); enemy.vy = direction.y * (enemy.kind === 'shadow' ? 440 : 285); enemy.state = 'attack'; enemy.stateTimer = enemy.kind === 'shadow' ? .34 : .42; enemy.contactCd = 0; }
  }

  private updateBoss(boss: Enemy, dt: number): void {
    if (boss.hp < boss.maxHp * .5 && boss.phase === 1) { boss.phase = 2; boss.cooldown = .8; this.ui.toast('Der Wächter zerbricht sein Siegel!', 'danger'); this.audio.play('boss'); this.renderer.shake = 12; this.burst(boss.x, boss.y, '#dd4f70', 35, 240); }
    if (boss.state === 'telegraph') { boss.stateTimer -= dt; if (boss.stateTimer <= 0) this.executeBossAttack(boss); return; }
    if (boss.state === 'attack') {
      boss.stateTimer -= dt; this.moveEnemy(boss, boss.vx * dt, boss.vy * dt);
      if (circleHit(boss, boss.radius, this.player, this.player.radius) && boss.contactCd <= 0) { this.damagePlayer(boss.damage + 6, boss); boss.contactCd = .55; }
      if (boss.stateTimer <= 0) { boss.state = 'recover'; boss.stateTimer = boss.phase === 2 ? .48 : .75; } return;
    }
    if (boss.state === 'recover') { boss.stateTimer -= dt; if (boss.stateTimer <= 0) { boss.state = 'chase'; boss.cooldown = boss.phase === 2 ? .55 : .85; } return; }
    const direction = normalize({ x: this.player.x - boss.x, y: this.player.y - boss.y }); const d = dist(boss, this.player);
    if (d > 105) this.moveEnemy(boss, direction.x * boss.speed * dt, direction.y * boss.speed * dt);
    if (boss.cooldown <= 0) {
      const max = boss.phase === 2 ? 5 : 3; boss.attackType = (boss.attackType + 1) % max;
      if (boss.attackType === 0 && d > 180) boss.attackType = 3;
      boss.state = 'telegraph'; boss.stateTimer = boss.attackType === 2 ? .85 : .65; this.audio.play('warning');
      if (boss.attackType === 2) for (let i = 0; i < (boss.phase === 2 ? 5 : 3); i++) this.spawnHazard('rune', i === 0 ? this.player.x : rand(120, 840), i === 0 ? this.player.y : rand(100, 440), 52, .95 + i * .08, .65, boss.damage);
    }
  }

  private executeBossAttack(boss: Enemy): void {
    const dir = normalize({ x: this.player.x - boss.x, y: this.player.y - boss.y });
    if (boss.attackType === 0) { if (dist(boss, this.player) < 130) this.damagePlayer(boss.damage, boss); this.spawnHazard('shockwave', boss.x, boss.y, 150, .12, .75, boss.damage - 5); this.renderer.shake = 9; boss.state = 'recover'; boss.stateTimer = .65; }
    else if (boss.attackType === 1) { const count = boss.phase === 2 ? 16 : 10; for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + this.time * .2; this.spawnProjectile(boss.x, boss.y, Math.cos(a) * 195, Math.sin(a) * 195, boss.damage - 7, true, '#d95b82', boss.id); } this.audio.play('shoot'); boss.state = 'recover'; boss.stateTimer = .65; }
    else if (boss.attackType === 2) { boss.state = 'recover'; boss.stateTimer = .55; }
    else if (boss.attackType === 3) { boss.vx = dir.x * 460; boss.vy = dir.y * 460; boss.state = 'attack'; boss.stateTimer = .52; boss.contactCd = 0; }
    else { this.spawnEnemy('shadow', boss.x - 50, boss.y + 20, true, true); this.spawnEnemy('skeleton', boss.x + 50, boss.y + 20, false, true); boss.state = 'recover'; boss.stateTimer = .8; this.ui.toast('Schatten erheben sich!', 'danger'); }
  }

  private damagePlayer(raw: number, source: Vec): void {
    const p = this.player; if (p.invuln > 0 || this.mode !== 'running') return; let damage = Math.max(1, Math.round(raw * (100 / (100 + p.armor * 7))));
    if (p.shield > 0) { const absorbed = Math.min(p.shield, damage); p.shield -= absorbed; damage -= absorbed; this.floatText(p.x, p.y - 25, `⬢ ${absorbed}`, '#74d1d2', 14); }
    if (damage <= 0) { p.invuln = .3; return; }
    p.hp -= damage; p.invuln = .72; p.flash = .15; this.stats.damageTaken += damage; this.floatText(p.x, p.y - 25, `-${damage}`, '#ff7581', 18); this.burst(p.x, p.y, '#e75567', 10, 155); this.audio.play('hurt'); this.renderer.shake = 8; this.renderer.flash = .08;
    const away = normalize({ x: p.x - source.x, y: p.y - source.y }); this.moveCircle(p, away.x * 18, away.y * 18, p.radius);
    if (this.hasRelic('thorn-crown') && 'hp' in source && source !== p) { const enemy = source as Enemy; if (enemy.state !== 'dead' && enemy.kind !== 'boss') this.damageEnemy(enemy, Math.round(damage * .25), false); }
    if (p.hp <= 0) { p.hp = 0; this.finish(false); }
  }

  private usePotion(): void {
    const p = this.player; if (p.potions <= 0) { this.ui.toast('Keine Heiltränke', 'danger'); return; } if (p.hp >= p.maxHp) { this.ui.toast('Leben bereits voll'); return; }
    p.potions--; this.stats.potionsUsed++; this.heal(42, true); this.audio.play('potion'); this.ui.toast('Heiltrank verwendet', 'good');
  }

  private heal(amount: number, visible = true): void {
    const p = this.player; const actual = Math.min(amount, p.maxHp - p.hp); if (actual <= 0) return; p.hp += actual;
    if (visible) { this.floatText(p.x, p.y - 25, `+${Math.ceil(actual)}`, '#79e0a4', 17); this.burst(p.x, p.y, '#70d49a', 9, 90); }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.x < WORLD.wall || p.x > WORLD.width - WORLD.wall || p.y < WORLD.wall || p.y > WORLD.height - WORLD.wall) p.life = 0;
      if (this.room.obstacles.some(o => o.solid && o.hp > 0 && circleHit(p, p.radius, o, o.radius))) p.life = 0;
      if (p.hostile && p.life > 0 && circleHit(p, p.radius, this.player, this.player.radius)) { this.damagePlayer(p.damage, p); p.life = 0; }
      if (!p.hostile && p.life > 0) for (const enemy of this.enemies) if (enemy.state !== 'dead' && circleHit(p, p.radius, enemy, enemy.radius)) { this.damageEnemy(enemy, p.damage, false); if (!p.piercing) p.life = 0; break; }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  }

  private updateHazards(dt: number): void {
    for (const h of this.hazards) {
      h.phase += dt; if (h.warning > 0) { h.warning -= dt; continue; } h.active -= dt;
      if (h.type === 'shockwave') h.ringRadius += dt * 260;
      const playerDistance = dist(h, this.player); const hit = h.type === 'shockwave' ? Math.abs(playerDistance - h.ringRadius) < 18 + this.player.radius : playerDistance < h.radius + this.player.radius;
      if (hit && !h.hitPlayer) { this.damagePlayer(h.damage, h); h.hitPlayer = true; }
    }
    this.hazards = this.hazards.filter(h => h.warning > 0 || h.active > 0);
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) {
      pickup.life -= dt; pickup.phase += dt; if (!pickup.collected && dist(pickup, this.player) < 34) this.collect(pickup);
    }
    this.pickups = this.pickups.filter(p => !p.collected && p.life > 0);
  }

  private collect(pickup: Pickup): void {
    if (pickup.collected) return; pickup.collected = true; const p = this.player;
    if (pickup.kind === 'gold') { p.gold += pickup.amount; this.stats.goldFound += pickup.amount; this.audio.play('gold'); this.floatText(p.x, p.y - 22, `+${pickup.amount} ◈`, '#f5cf67', 13); }
    else if (pickup.kind === 'heal') { this.heal(pickup.amount); this.audio.play('pickup'); }
    else if (pickup.kind === 'potion') { p.potions += pickup.amount; this.audio.play('pickup'); this.ui.toast('+1 Heiltrank', 'good'); }
    else if (pickup.kind === 'key') { p.keys++; this.audio.play('pickup'); this.ui.toast('Runenschlüssel gefunden', 'good'); }
    else if (pickup.kind === 'damage') { p.damageBuff = Math.max(p.damageBuff, 20); this.audio.play('pickup'); this.ui.toast('Klingenrausch · 20s', 'good'); }
    else if (pickup.kind === 'speed') { p.speedBuff = Math.max(p.speedBuff, 20); this.audio.play('pickup'); this.ui.toast('Windsegen · 20s', 'good'); }
    else if (pickup.relic) this.addRelic(pickup.relic);
  }

  private addRelic(id: RelicId): void {
    if (this.player.relics.includes(id)) { this.player.gold += 30; this.ui.toast('Reliktduplikat · +30 Gold', 'good'); return; }
    this.player.relics.push(id); const relic = RELICS.find(r => r.id === id)!;
    if (id === 'blood-blade') this.player.lifeSteal += .03; if (id === 'guardian-ring') this.player.armor += 4;
    if (id === 'shadow-boots') this.player.dashCooldown *= .8; if (id === 'ember-core') this.player.burnChance = Math.max(this.player.burnChance, .35);
    this.audio.play('pickup'); this.ui.toast(`${relic.icon} ${relic.name}: ${relic.description}`, 'good'); this.renderer.flash = .08;
  }

  private interact(): void {
    if (this.room.chest && !this.room.chest.opened && dist(this.player, this.room.chest) < 70) {
      if (this.room.chest.locked && this.player.keys <= 0) { this.ui.toast('Ein Runenschlüssel wird benötigt', 'danger'); return; }
      if (this.room.chest.locked) this.player.keys--; this.room.chest.opened = true; this.room.rewardClaimed = true; this.audio.play('chest'); this.spawnRelic(this.room.chest.x, this.room.chest.y - 25); this.spawnPickup('gold', this.room.chest.x - 24, this.room.chest.y + 18, 25); this.spawnPickup(Math.random() < .5 ? 'damage' : 'speed', this.room.chest.x + 24, this.room.chest.y + 18, 1); return;
    }
    if (this.room.kind === 'rest' && !this.room.rewardClaimed && dist(this.player, { x: WORLD.width / 2, y: WORLD.height / 2 }) < 70) {
      this.room.rewardClaimed = true; this.heal(this.player.maxHp * .45); this.player.potions++; this.audio.play('potion'); this.ui.toast('Die Zuflucht heilt deine Wunden', 'good'); return;
    }
    this.ui.toast('Nichts zum Interagieren');
  }

  private checkRoomComplete(): void {
    if (this.room.state !== 'active' || this.endTimer > 0) return;
    if (this.enemies.some(e => e.state !== 'dead')) return;
    this.room.state = 'cleared'; this.audio.play('door'); this.ui.toast('Raum gesäubert · Türen geöffnet', 'good'); this.renderer.shake = 4;
    if (this.player.roomHeal > 0) this.heal(this.player.roomHeal);
    if (this.room.depth === 1 && this.player.keys === 0) this.spawnPickup('key', WORLD.width / 2, WORLD.height / 2, 1);
    else if (this.room.kind !== 'boss') {
      const roll = Math.random(); if (roll < .28) this.spawnPickup('heal', WORLD.width / 2, WORLD.height / 2, 15); else if (roll < .43) this.spawnPickup('potion', WORLD.width / 2, WORLD.height / 2, 1); else if (roll < .58) this.spawnPickup(Math.random() < .5 ? 'damage' : 'speed', WORLD.width / 2, WORLD.height / 2, 1);
    }
  }

  private checkTransition(): void {
    if (!this.doorsOpen() || this.roomTransitionCd > 0 || this.roomIntro > .5) return; const p = this.player; const m = this.input.movement(); const center = WORLD.height / 2; const centerX = WORLD.width / 2;
    if (m.x < 0 && p.x <= WORLD.wall + p.radius + 1 && Math.abs(p.y - center) < WORLD.doorHalf) this.transition('west');
    else if (m.x > 0 && p.x >= WORLD.width - WORLD.wall - p.radius - 1 && Math.abs(p.y - center) < WORLD.doorHalf) this.transition('east');
    else if (m.y < 0 && p.y <= WORLD.wall + p.radius + 1 && Math.abs(p.x - centerX) < WORLD.doorHalf) this.transition('north');
    else if (m.y > 0 && p.y >= WORLD.height - WORLD.wall - p.radius - 1 && Math.abs(p.x - centerX) < WORLD.doorHalf) this.transition('south');
  }

  private transition(direction: Direction): void {
    const nextId = this.room.connections[direction]; if (!nextId) return;
    for (const pickup of this.pickups) if (pickup.kind === 'gold' && !pickup.collected) this.collect(pickup);
    this.pickups = []; this.projectiles = []; this.hazards = []; this.enemies = [];
    this.room = this.rooms.get(nextId)!; const firstVisit = !this.room.visited; this.room.visited = true; if (firstVisit) { this.stats.roomsVisited++; this.enterRoom(); }
    const entry = oppositeDirection(direction); const p = this.player;
    if (entry === 'west') { p.x = WORLD.wall + p.radius + 8; p.y = WORLD.height / 2; } if (entry === 'east') { p.x = WORLD.width - WORLD.wall - p.radius - 8; p.y = WORLD.height / 2; }
    if (entry === 'north') { p.x = WORLD.width / 2; p.y = WORLD.wall + p.radius + 8; } if (entry === 'south') { p.x = WORLD.width / 2; p.y = WORLD.height - WORLD.wall - p.radius - 8; }
    this.roomTransitionCd = .65; this.roomIntro = firstVisit ? 2.2 : .5; this.audio.play('door');
  }

  private enterRoom(): void {
    if (this.room.kind === 'combat' || this.room.kind === 'elite' || this.room.kind === 'boss') {
      this.room.state = 'active';
      if (this.room.kind === 'boss') { this.audio.play('boss'); this.spawnEnemy('boss', WORLD.width / 2, 195, false); }
      else {
        const count = Math.min(7, 2 + Math.ceil(this.room.depth * .65)); const kinds: EnemyKind[] = ['skeleton', 'slime']; if (this.room.depth >= 2) kinds.push('archer'); if (this.room.depth >= 3) kinds.push('shadow');
        for (let i = 0; i < count; i++) { const pos = this.safeSpawn(i, count); this.spawnEnemy(pick(kinds), pos.x, pos.y, this.room.kind === 'elite' && i === 0); }
      }
    } else { this.room.state = 'cleared'; }
  }

  private safeSpawn(index: number, count: number): Vec {
    const angle = index / count * Math.PI * 2 + .4; let radius = 125 + (index % 2) * 80; let pos = { x: WORLD.width / 2 + Math.cos(angle) * radius, y: WORLD.height / 2 + Math.sin(angle) * radius };
    for (let tries = 0; tries < 8 && this.room.obstacles.some(o => o.solid && circleHit(pos, 22, o, o.radius + 12)); tries++) { radius += 25; pos = { x: WORLD.width / 2 + Math.cos(angle + tries * .5) * radius, y: WORLD.height / 2 + Math.sin(angle + tries * .5) * radius }; }
    pos.x = clamp(pos.x, 100, 860); pos.y = clamp(pos.y, 90, 450); return pos;
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, elite = false, summoned = false): Enemy {
    const base = ENEMY_STATS[kind]; const depthScale = kind === 'boss' ? 1 : 1 + this.room.depth * .09; const eliteScale = elite ? 2.1 : 1; const smallScale = summoned && kind === 'slime' ? .52 : 1;
    const enemy: Enemy = { id: this.nextId++, kind, x, y, radius: (kind === 'boss' ? 44 : kind === 'slime' ? 21 : kind === 'shadow' ? 18 : 17) * smallScale,
      hp: Math.round(base.hp * depthScale * eliteScale * smallScale), maxHp: Math.round(base.hp * depthScale * eliteScale * smallScale), speed: base.speed * (elite ? 1.1 : 1), damage: Math.round(base.damage * (1 + this.room.depth * .045) * (elite ? 1.3 : 1)),
      xp: Math.round(base.xp * (elite ? 2.2 : 1) * smallScale), gold: [...base.gold], elite, state: 'chase', stateTimer: 0, cooldown: rand(.6, 1.2), aim: 0, vx: 0, vy: 0, flash: 0, slow: 0, burn: 0, burnTick: .1, phase: 1, attackType: -1, summoned, contactCd: 0 };
    this.enemies.push(enemy); return enemy;
  }

  private spawnProjectile(x: number, y: number, vx: number, vy: number, damage: number, hostile: boolean, color: string, owner: number): void { this.projectiles.push({ id: this.nextId++, x, y, vx, vy, radius: hostile ? 6 : 5, damage, life: 4, hostile, color, owner, piercing: false }); }
  private spawnHazard(type: Hazard['type'], x: number, y: number, radius: number, warning: number, active: number, damage: number): void { this.hazards.push({ id: this.nextId++, type, x, y, radius, warning, active, damage, phase: 0, hitPlayer: false, ringRadius: 22 }); }
  private spawnPickup(kind: Pickup['kind'], x: number, y: number, amount: number): void { this.pickups.push({ id: this.nextId++, kind, x: clamp(x, 70, 890), y: clamp(y, 70, 470), amount, life: 60, phase: rand(0, 9), collected: false }); }
  private spawnRelic(x: number, y: number): void { const available = RELICS.filter(r => !this.player.relics.includes(r.id)); const relic = pick(available.length ? available : RELICS); this.pickups.push({ id: this.nextId++, kind: 'relic', relic: relic.id, x, y, amount: 1, life: 90, phase: rand(0, 9), collected: false }); }

  private breakObstacle(x: number, y: number): void {
    const roll = Math.random(); if (roll < .4) this.spawnPickup('gold', x, y, randi(2, 6)); else if (roll < .52) this.spawnPickup('heal', x, y, 8); else if (roll < .58) this.spawnPickup('potion', x, y, 1);
  }

  private updateEffects(dt: number): void {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.life -= dt; p.vx *= .97; }
    for (const t of this.texts) { t.y -= 34 * dt; t.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0).slice(-180); this.texts = this.texts.filter(t => t.life > 0).slice(-35);
  }

  private particle(x: number, y: number, color: string, vx: number, vy: number, life: number, size: number): void { this.particles.push({ x, y, vx, vy, life, maxLife: life, color, size, gravity: 35 }); }
  private burst(x: number, y: number, color: string, count: number, speed: number): void { if (this.store.settings.reducedEffects) count = Math.ceil(count * .35); for (let i = 0; i < count; i++) { const a = rand(0, Math.PI * 2); const s = rand(speed * .25, speed); this.particle(x, y, color, Math.cos(a) * s, Math.sin(a) * s, rand(.22, .62), rand(2, 6)); } }
  private floatText(x: number, y: number, text: string, color: string, size: number): void { this.texts.push({ x, y, text, color, size, life: .8, maxLife: .8 }); }
  private lightning(from: Vec, to: Vec): void { const steps = 10; for (let i = 0; i <= steps; i++) { const t = i / steps; this.particle(from.x + (to.x - from.x) * t + rand(-5,5), from.y + (to.y - from.y) * t + rand(-5,5), '#d4b5ff', 0, 0, .18, 3); } }

  private moveCircle(entity: Vec, dx: number, dy: number, radius: number): void {
    entity.x += dx; for (const o of this.room.obstacles) if (o.solid && o.hp > 0 && circleHit(entity, radius, o, o.radius)) entity.x -= dx;
    entity.y += dy; for (const o of this.room.obstacles) if (o.solid && o.hp > 0 && circleHit(entity, radius, o, o.radius)) entity.y -= dy;
    entity.x = clamp(entity.x, WORLD.wall + radius, WORLD.width - WORLD.wall - radius); entity.y = clamp(entity.y, WORLD.wall + radius, WORLD.height - WORLD.wall - radius);
  }
  private moveEnemy(enemy: Enemy, dx: number, dy: number): void { this.moveCircle(enemy, dx, dy, enemy.radius); }
  private lineOfSight(from: Vec, to: Vec): boolean {
    for (const o of this.room.obstacles) { if (!o.solid || o.hp <= 0) continue; const ab = { x: to.x - from.x, y: to.y - from.y }; const lenSq = ab.x * ab.x + ab.y * ab.y; const t = clamp(((o.x - from.x) * ab.x + (o.y - from.y) * ab.y) / lenSq, 0, 1); if (dist(o, { x: from.x + ab.x * t, y: from.y + ab.y * t }) < o.radius + 4) return false; } return true;
  }

  private doorsOpen(): boolean { return this.room.state === 'cleared'; }
  private hasRelic(id: RelicId): boolean { return this.player.relics.includes(id); }
  private pause(): void { if (this.mode !== 'running') return; this.mode = 'paused'; this.input.reset(); this.ui.showPause(this.player); }

  private updateHud(): void {
    const alive = this.enemies.filter(e => e.state !== 'dead'); const boss = alive.find(e => e.kind === 'boss');
    let objective = this.room.state === 'active' ? `${alive.length} ${alive.length === 1 ? 'Feind' : 'Feinde'} verbleiben` : this.room.kind === 'treasure' && !this.room.chest?.opened ? 'E · Truhe öffnen' : this.room.kind === 'rest' && !this.room.rewardClaimed ? 'E · Am Runenkreis rasten' : 'Türen geöffnet · Dungeon erkunden';
    if (boss) objective = boss.phase === 2 ? 'Phase II · Gebrochene Siegel' : 'Phase I · Der Wächter erwacht';
    this.ui.updateHud(this.player, this.renderer.roomName(this.room), objective, boss);
  }

  private buildMapHtml(): string {
    const visible = [...this.rooms.values()].filter(r => r.visited || Object.values(this.room.connections).includes(r.id)); const minX = Math.min(...visible.map(r => r.gx)); const maxX = Math.max(...visible.map(r => r.gx)); const minY = Math.min(...visible.map(r => r.gy)); const maxY = Math.max(...visible.map(r => r.gy));
    const point = (r: Room) => ({ x: 60 + (r.gx - minX) / Math.max(1, maxX - minX) * 620, y: 50 + (r.gy - minY) / Math.max(1, maxY - minY) * 240 }); let lines = '';
    for (const r of visible) for (const id of Object.values(r.connections)) { const other = this.rooms.get(id); if (!other || !visible.includes(other) || r.id > other.id) continue; const a = point(r); const b = point(other); const length = Math.hypot(b.x-a.x,b.y-a.y); const angle = Math.atan2(b.y-a.y,b.x-a.x); lines += `<i class="map-line" style="left:${a.x}px;top:${a.y}px;width:${length}px;transform:rotate(${angle}rad)"></i>`; }
    const icons: Record<Room['kind'], string> = { start: 'ᚱ', combat: '·', elite: '♜', treasure: '◆', rest: '✚', boss: '☠' };
    const nodes = visible.map(r => { const p = point(r); return `<b class="map-room ${r.id === this.room.id ? 'current' : ''} ${r.state}" style="left:${p.x}px;top:${p.y}px" title="${r.kind}">${r.visited ? icons[r.kind] : '?'}</b>`; }).join(''); return `<div class="map-grid">${lines}${nodes}</div>`;
  }

  private finish(victory: boolean): void {
    if (this.mode === 'ending') return; this.mode = 'ending'; this.input.reset(); this.stats.elapsed = Math.max(this.stats.elapsed, .1); this.audio.play(victory ? 'victory' : 'defeat');
    const score = Math.floor(this.stats.kills * 110 + this.stats.goldFound * 9 + this.player.level * 300 + (victory ? 5000 : 0)); const r = this.store.records;
    r.bestScore = Math.max(r.bestScore, score); r.highestLevel = Math.max(r.highestLevel, this.player.level); r.mostKills = Math.max(r.mostKills, this.stats.kills);
    if (victory) { r.victories++; r.fastestWin = r.fastestWin === null ? this.stats.elapsed : Math.min(r.fastestWin, this.stats.elapsed); }
    this.store.save(); window.setTimeout(() => this.ui.showEnd(victory, this.stats, this.player), victory ? 1000 : 350);
  }
}
