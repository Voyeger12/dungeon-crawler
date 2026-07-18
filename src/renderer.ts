import { COLORS, RELICS, WORLD } from './config';
import { clamp } from './math';
import type { Enemy, FloatText, Hazard, Particle, Pickup, Player, Projectile, Room } from './model';

export interface RenderState {
  room: Room; rooms: Map<string, Room>; player: Player; enemies: Enemy[]; projectiles: Projectile[];
  pickups: Pickup[]; hazards: Hazard[]; particles: Particle[]; texts: FloatText[]; time: number;
  doorsOpen: boolean; roomIntro: number; settings: { shake: boolean; reducedEffects: boolean };
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  shake = 0;
  flash = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(state: RenderState): void {
    const c = this.ctx; const shake = state.settings.shake ? this.shake : 0;
    const sx = shake ? (Math.random() - .5) * shake : 0; const sy = shake ? (Math.random() - .5) * shake : 0;
    this.shake = Math.max(0, this.shake - .8); this.flash = Math.max(0, this.flash - .04);
    c.save(); c.translate(sx, sy); this.floor(state); this.hazards(state); this.decor(state);
    this.pickups(state); this.projectiles(state); this.enemies(state); this.player(state); this.particles(state); this.minimap(state);
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(255,230,210,${this.flash})`; c.fillRect(0, 0, WORLD.width, WORLD.height); }
    if (state.roomIntro > 0) this.intro(state);
  }

  private floor(state: RenderState): void {
    const c = this.ctx; c.fillStyle = COLORS.void; c.fillRect(0, 0, WORLD.width, WORLD.height);
    c.fillStyle = COLORS.floor; c.fillRect(WORLD.wall, WORLD.wall, WORLD.width - WORLD.wall * 2, WORLD.height - WORLD.wall * 2);
    c.strokeStyle = COLORS.grout; c.lineWidth = 1;
    for (let y = WORLD.wall; y < WORLD.height - WORLD.wall; y += 32) {
      c.beginPath(); c.moveTo(WORLD.wall, y + .5); c.lineTo(WORLD.width - WORLD.wall, y + .5); c.stroke();
      for (let x = WORLD.wall + ((y / 32) % 2) * 16; x < WORLD.width - WORLD.wall; x += 64) { c.beginPath(); c.moveTo(x + .5, y); c.lineTo(x + .5, Math.min(y + 32, WORLD.height - WORLD.wall)); c.stroke(); }
    }
    const seed = state.room.gx * 37 + state.room.gy * 71;
    for (let i = 0; i < 24; i++) {
      const x = WORLD.wall + 30 + ((i * 139 + seed * 17) % (WORLD.width - WORLD.wall * 2 - 60));
      const y = WORLD.wall + 25 + ((i * 73 + seed * 31) % (WORLD.height - WORLD.wall * 2 - 50));
      c.fillStyle = i % 4 ? '#121321' : '#242238'; c.fillRect(Math.floor(x / 3) * 3, Math.floor(y / 3) * 3, i % 3 + 2, 2);
    }
    this.walls(state);
  }

  private walls(state: RenderState): void {
    const c = this.ctx; const w = WORLD.wall; const dh = WORLD.doorHalf;
    const north = Boolean(state.room.connections.north); const south = Boolean(state.room.connections.south);
    const west = Boolean(state.room.connections.west); const east = Boolean(state.room.connections.east);
    c.fillStyle = COLORS.wall;
    const horizontal = (y: number, hasDoor: boolean) => {
      if (hasDoor) { c.fillRect(0, y, WORLD.width / 2 - dh, w); c.fillRect(WORLD.width / 2 + dh, y, WORLD.width / 2 - dh, w); }
      else c.fillRect(0, y, WORLD.width, w);
    };
    const vertical = (x: number, hasDoor: boolean) => {
      if (hasDoor) { c.fillRect(x, 0, w, WORLD.height / 2 - dh); c.fillRect(x, WORLD.height / 2 + dh, w, WORLD.height / 2 - dh); }
      else c.fillRect(x, 0, w, WORLD.height);
    };
    horizontal(0, north); horizontal(WORLD.height - w, south); vertical(0, west); vertical(WORLD.width - w, east);
    c.fillStyle = COLORS.wallTop; c.fillRect(0, w - 9, WORLD.width, 9); c.fillRect(0, WORLD.height - w, WORLD.width, 9); c.fillRect(w - 9, 0, 9, WORLD.height); c.fillRect(WORLD.width - w, 0, 9, WORLD.height);
    c.fillStyle = '#171725';
    for (let x = 7; x < WORLD.width; x += 48) { c.fillRect(x, 8, 30, 13); c.fillRect(x + 17, WORLD.height - 23, 30, 13); }
    for (let y = 10; y < WORLD.height; y += 46) { c.fillRect(8, y, 13, 28); c.fillRect(WORLD.width - 21, y + 15, 13, 28); }
    if (north) this.door(WORLD.width / 2, w / 2, 'h', state.doorsOpen);
    if (south) this.door(WORLD.width / 2, WORLD.height - w / 2, 'h', state.doorsOpen);
    if (west) this.door(w / 2, WORLD.height / 2, 'v', state.doorsOpen);
    if (east) this.door(WORLD.width - w / 2, WORLD.height / 2, 'v', state.doorsOpen);
  }

  private door(x: number, y: number, orientation: 'h' | 'v', open: boolean): void {
    const c = this.ctx; c.save(); c.translate(x, y); if (orientation === 'v') c.rotate(Math.PI / 2);
    c.fillStyle = '#101019'; c.fillRect(-WORLD.doorHalf, -21, WORLD.doorHalf * 2, 42);
    if (!open) {
      c.fillStyle = '#4b3540'; c.fillRect(-WORLD.doorHalf, -14, WORLD.doorHalf * 2, 28);
      c.fillStyle = '#a94c54'; for (let i = -45; i <= 45; i += 18) c.fillRect(i, -14, 5, 28);
      c.shadowColor = '#c64e5b'; c.shadowBlur = 12; c.fillStyle = '#ef7475'; c.fillRect(-3, -8, 6, 16);
    } else { c.fillStyle = '#6c513e'; c.fillRect(-WORLD.doorHalf, -19, 8, 38); c.fillRect(WORLD.doorHalf - 8, -19, 8, 38); }
    c.restore(); c.shadowBlur = 0;
  }

  private decor(state: RenderState): void {
    const c = this.ctx;
    [[88, 83], [872, 83], [88, 457], [872, 457]].forEach(([x, y], i) => {
      if ((i + state.room.depth) % 2 === 0) this.torch(x!, y!, state.time + i);
    });
    for (const o of state.room.obstacles) {
      if (o.hp <= 0) continue;
      c.save(); c.translate(o.x, o.y);
      if (o.kind === 'spikes') {
        const active = Math.sin(state.time * 2.2 + o.phase) > .35; c.fillStyle = active ? '#b8a3ac' : '#514957';
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(a) * (active ? 28 : 16), Math.sin(a) * (active ? 28 : 16)); c.lineTo(Math.cos(a + .28) * 11, Math.sin(a + .28) * 11); c.fill(); }
      } else {
        c.fillStyle = '#08091080'; c.beginPath(); c.ellipse(4, o.radius * .65, o.radius, o.radius * .45, 0, 0, Math.PI * 2); c.fill();
        if (o.kind === 'pillar') {
          c.fillStyle = '#343447'; c.fillRect(-o.radius + 5, -o.radius, o.radius * 2 - 10, o.radius * 1.8); c.fillStyle = '#4b4a5e'; c.fillRect(-o.radius, -o.radius, o.radius * 2, 10); c.fillRect(-o.radius, o.radius * .65, o.radius * 2, 9); c.fillStyle = '#242535'; c.fillRect(5, -o.radius + 11, 8, o.radius * 1.4);
        } else {
          c.fillStyle = o.kind === 'crate' ? '#6e4938' : '#584034'; c.fillRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2); c.strokeStyle = '#a16d4b'; c.lineWidth = 4; c.strokeRect(-o.radius + 3, -o.radius + 3, o.radius * 2 - 6, o.radius * 2 - 6); c.beginPath(); c.moveTo(-o.radius + 4, -o.radius + 4); c.lineTo(o.radius - 4, o.radius - 4); c.stroke();
        }
      }
      c.restore();
    }
    if (state.room.chest) this.chest(state.room.chest.x, state.room.chest.y, state.room.chest.opened, state.time);
    if (state.room.kind === 'rest') {
      c.save(); c.translate(WORLD.width / 2, WORLD.height / 2); c.strokeStyle = '#68c5bd'; c.shadowColor = '#68c5bd'; c.shadowBlur = 18; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 45 + Math.sin(state.time * 2) * 3, 0, Math.PI * 2); c.stroke(); c.font = '32px serif'; c.fillStyle = '#9ce4d8'; c.textAlign = 'center'; c.fillText('ᛉ', 0, 11); c.restore(); c.shadowBlur = 0;
    }
    if (state.room.kind === 'start') { c.fillStyle = '#675284'; c.globalAlpha = .5 + Math.sin(state.time * 2) * .12; c.font = '68px serif'; c.textAlign = 'center'; c.fillText('ᚱ', WORLD.width / 2, WORLD.height / 2 + 22); c.globalAlpha = 1; }
  }

  private torch(x: number, y: number, time: number): void {
    const c = this.ctx; const flicker = Math.sin(time * 11) * 3 + Math.sin(time * 17) * 2;
    const grad = c.createRadialGradient(x, y, 0, x, y, 75 + flicker); grad.addColorStop(0, '#ffb45b35'); grad.addColorStop(1, '#ff6b3000'); c.fillStyle = grad; c.beginPath(); c.arc(x, y, 80 + flicker, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5f4536'; c.fillRect(x - 3, y, 6, 25); c.fillStyle = '#ffbf55'; c.shadowColor = '#ff7538'; c.shadowBlur = 14; c.beginPath(); c.moveTo(x, y - 18 - flicker * .2); c.quadraticCurveTo(x + 10, y - 3, x, y + 4); c.quadraticCurveTo(x - 9, y - 4, x, y - 18 - flicker * .2); c.fill(); c.shadowBlur = 0;
  }

  private chest(x: number, y: number, opened: boolean, time: number): void {
    const c = this.ctx; c.save(); c.translate(x, y); c.fillStyle = '#07081188'; c.beginPath(); c.ellipse(4, 18, 32, 13, 0, 0, Math.PI * 2); c.fill(); c.shadowColor = opened ? '#6d5b42' : '#d9a758'; c.shadowBlur = opened ? 0 : 10 + Math.sin(time * 3) * 3; c.fillStyle = opened ? '#392a29' : '#704836'; c.fillRect(-28, -4, 56, 27); c.fillStyle = '#b5844e'; c.fillRect(-30, -7, 60, 8); c.fillRect(-4, -8, 8, 31); if (opened) { c.fillStyle = '#4a3030'; c.fillRect(-28, -24, 56, 17); } c.restore(); c.shadowBlur = 0;
  }

  private hazards(state: RenderState): void {
    const c = this.ctx;
    for (const h of state.hazards) {
      const warning = h.warning > 0; const alpha = warning ? .25 + Math.sin(state.time * 16) * .15 : clamp(h.active * 2, 0, .75);
      c.save(); c.translate(h.x, h.y); c.strokeStyle = warning ? `rgba(234,92,79,${alpha + .25})` : `rgba(236,112,75,${alpha})`; c.fillStyle = `rgba(168,48,67,${alpha * .45})`; c.lineWidth = warning ? 3 : 7; c.setLineDash(warning ? [8, 7] : []); c.beginPath();
      if (h.type === 'shockwave') c.arc(0, 0, h.ringRadius, 0, Math.PI * 2); else c.arc(0, 0, h.radius, 0, Math.PI * 2);
      c.fill(); c.stroke(); c.setLineDash([]); if (warning) { c.fillStyle = '#ed9d79'; c.font = 'bold 17px serif'; c.textAlign = 'center'; c.fillText(h.type === 'rune' ? 'ᛝ' : '!', 0, 6); } c.restore();
    }
  }

  private pickups(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.pickups) {
      if (p.collected) continue; const bob = Math.sin(state.time * 4 + p.phase) * 4; c.save(); c.translate(p.x, p.y + bob); c.shadowBlur = 12;
      const colors: Record<string, string> = { gold: '#f3c75b', heal: '#6dd59c', potion: '#db5d71', key: '#e5b96c', damage: '#e36e4d', speed: '#74c6dd', relic: '#b998f0' };
      c.shadowColor = colors[p.kind]!; c.fillStyle = colors[p.kind]!;
      if (p.kind === 'gold') { c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff0a3'; c.fillRect(-2, -4, 3, 6); }
      else if (p.kind === 'potion') { c.fillRect(-7, -8, 14, 17); c.fillStyle = '#d6c2a4'; c.fillRect(-4, -13, 8, 5); }
      else if (p.kind === 'relic') { c.rotate(Math.PI / 4); c.fillRect(-10, -10, 20, 20); c.rotate(-Math.PI / 4); c.fillStyle = '#fff'; c.font = '14px serif'; c.textAlign = 'center'; c.fillText(RELICS.find(r => r.id === p.relic)?.icon ?? '◆', 0, 5); }
      else { c.font = 'bold 17px serif'; c.textAlign = 'center'; c.fillText(p.kind === 'heal' ? '+' : p.kind === 'key' ? '⚿' : '◆', 0, 6); }
      c.restore(); c.shadowBlur = 0;
    }
  }

  private projectiles(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.projectiles) { c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 12; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2); c.fill(); c.globalAlpha = .35; c.beginPath(); c.arc(p.x - p.vx * .02, p.y - p.vy * .02, p.radius * .7, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
    c.shadowBlur = 0;
  }

  private enemies(state: RenderState): void {
    for (const e of state.enemies) { if (e.state !== 'dead') this.enemy(e, state.time); }
  }

  private enemy(e: Enemy, time: number): void {
    const c = this.ctx; c.save(); c.translate(Math.round(e.x), Math.round(e.y));
    c.fillStyle = '#05060b99'; c.beginPath(); c.ellipse(3, e.radius * .72, e.radius * 1.05, e.radius * .45, 0, 0, Math.PI * 2); c.fill();
    if (e.elite || e.kind === 'boss') { c.strokeStyle = e.kind === 'boss' ? '#b24d69' : '#e4a755'; c.shadowColor = c.strokeStyle; c.shadowBlur = 14; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, e.radius + 7 + Math.sin(time * 4) * 2, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    if (e.state === 'telegraph') { c.strokeStyle = '#f17b69'; c.lineWidth = 3; c.setLineDash([4, 4]); c.beginPath(); c.arc(0, 0, e.radius + 11 + Math.sin(time * 20) * 3, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff0d0'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('!', 0, -e.radius - 15); }
    c.rotate(e.aim);
    if (e.kind === 'skeleton' || e.kind === 'archer') {
      c.fillStyle = e.flash > 0 ? '#fff' : e.elite ? '#e0b66e' : '#d9d2bd'; c.fillRect(-10, -13, 20, 25); c.fillRect(-13, -21, 26, 17); c.fillStyle = '#171823'; c.fillRect(-7, -16, 4, 4); c.fillRect(4, -16, 4, 4); c.fillStyle = e.kind === 'archer' ? '#613e62' : '#6d3442'; c.fillRect(-13, 7, 26, 9);
      if (e.kind === 'skeleton') { c.strokeStyle = '#b8a786'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, -2); c.lineTo(27, 13); c.stroke(); c.strokeStyle = '#a5aab4'; c.lineWidth = 4; c.beginPath(); c.moveTo(24, 9); c.lineTo(35, -4); c.stroke(); }
      else { c.strokeStyle = '#bd8b59'; c.lineWidth = 3; c.beginPath(); c.arc(18, 0, 12, -1.4, 1.4); c.stroke(); }
    } else if (e.kind === 'slime') {
      c.fillStyle = e.flash > 0 ? '#fff' : e.elite ? '#c195e0' : '#6db47f'; c.beginPath(); c.moveTo(-e.radius, e.radius * .6); c.quadraticCurveTo(-e.radius * .8, -e.radius, 0, -e.radius); c.quadraticCurveTo(e.radius * .8, -e.radius, e.radius, e.radius * .6); c.closePath(); c.fill(); c.fillStyle = '#17201e'; c.fillRect(3, -9, 5, 6); c.fillRect(12, -8, 4, 5);
    } else if (e.kind === 'shadow') {
      c.fillStyle = e.flash > 0 ? '#fff' : e.elite ? '#c76cbb' : '#6d4c8f'; c.shadowColor = '#8f58ba'; c.shadowBlur = 14; c.beginPath(); c.moveTo(e.radius, 0); c.lineTo(5, -e.radius); c.lineTo(-e.radius, -e.radius * .5); c.lineTo(-e.radius * .7, e.radius * .7); c.lineTo(5, e.radius); c.closePath(); c.fill(); c.fillStyle = '#ff6f86'; c.fillRect(5, -8, 8, 4); c.shadowBlur = 0;
    } else {
      c.fillStyle = e.flash > 0 ? '#fff' : e.phase === 2 ? '#983855' : '#605377'; c.beginPath(); c.moveTo(e.radius, 0); for (let i = 1; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r = i % 2 ? e.radius * .8 : e.radius; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); c.fillStyle = '#292234'; c.beginPath(); c.arc(0, 0, e.radius * .6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ef6c75'; c.shadowColor = '#ef5368'; c.shadowBlur = 16; c.fillRect(5, -12, 19, 7); c.shadowBlur = 0; c.strokeStyle = '#c4a26d'; c.lineWidth = 6; c.beginPath(); c.moveTo(-6, 10); c.lineTo(e.radius + 22, 32); c.stroke();
    }
    c.restore();
    if (e.kind !== 'boss' && e.hp < e.maxHp) { c.fillStyle = '#090a10'; c.fillRect(e.x - e.radius, e.y - e.radius - 13, e.radius * 2, 4); c.fillStyle = e.elite ? '#d9954d' : '#b83f53'; c.fillRect(e.x - e.radius, e.y - e.radius - 13, e.radius * 2 * clamp(e.hp / e.maxHp, 0, 1), 4); }
  }

  private player(state: RenderState): void {
    const p = state.player; const c = this.ctx; if (p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) c.globalAlpha = .42;
    c.save(); c.translate(Math.round(p.x), Math.round(p.y));
    if (p.shield > 0) { c.strokeStyle = '#75d5d1aa'; c.lineWidth = 3; c.shadowColor = '#65d3d1'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, p.radius + 8, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    c.fillStyle = '#05060b99'; c.beginPath(); c.ellipse(3, 17, 20, 8, 0, 0, Math.PI * 2); c.fill(); c.rotate(p.aim);
    c.fillStyle = p.flash > 0 ? '#fff' : '#436f84'; c.beginPath(); c.moveTo(-15, 16); c.lineTo(-12, -12); c.lineTo(0, -21); c.lineTo(14, -10); c.lineTo(15, 16); c.closePath(); c.fill(); c.fillStyle = '#1c2737'; c.fillRect(-14, 5, 28, 9); c.fillStyle = '#d3b092'; c.fillRect(2, -14, 10, 9); c.fillStyle = '#e6c78e'; c.fillRect(10, -10, 5, 4);
    c.strokeStyle = '#d6d9e1'; c.lineWidth = 5; c.beginPath(); c.moveTo(6, 4); c.lineTo(29, 0); c.stroke(); c.strokeStyle = '#8c5f3f'; c.lineWidth = 4; c.beginPath(); c.moveTo(4, 4); c.lineTo(12, 7); c.stroke();
    if (p.attackAnim > 0) { const progress = 1 - p.attackAnim / .16; c.strokeStyle = p.attackCombo === 2 ? '#efc36c' : '#d9ebef'; c.shadowColor = c.strokeStyle; c.shadowBlur = 12; c.lineWidth = p.attackCombo === 2 ? 9 : 6; c.globalAlpha = 1 - progress * .45; c.beginPath(); c.arc(0, 0, p.range * .78, -.95 + progress * .3, .95 + progress * .3); c.stroke(); }
    c.restore(); c.globalAlpha = 1;
  }

  private particles(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.particles) { c.globalAlpha = clamp(p.life / p.maxLife, 0, 1); c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    c.globalAlpha = 1; c.textAlign = 'center';
    for (const t of state.texts) { c.globalAlpha = clamp(t.life / t.maxLife, 0, 1); c.fillStyle = t.color; c.font = `800 ${t.size}px Inter, sans-serif`; c.strokeStyle = '#070810'; c.lineWidth = 3; c.strokeText(t.text, t.x, t.y); c.fillText(t.text, t.x, t.y); }
    c.globalAlpha = 1;
  }

  private minimap(state: RenderState): void {
    const c = this.ctx; const visible = [...state.rooms.values()].filter(r => r.visited || r.id === state.room.id || Object.values(state.room.connections).includes(r.id));
    const xs = visible.map(r => r.gx); if (!xs.length) return;
    const centerX = 875; const centerY = 100; const scale = 18; c.save(); c.globalAlpha = .85; c.fillStyle = '#080910bb'; c.fillRect(815, 52, 120, 96); c.strokeStyle = '#3e3948'; c.strokeRect(815.5, 52.5, 119, 95);
    for (const r of visible) { const x = centerX + (r.gx - state.room.gx) * scale; const y = centerY + (r.gy - state.room.gy) * scale; c.fillStyle = r.id === state.room.id ? '#e7a760' : r.state === 'cleared' ? '#668078' : '#3c3947'; c.fillRect(x - 6, y - 5, 12, 10); if (r.kind === 'boss' && r.visited) { c.fillStyle = '#d75865'; c.fillRect(x - 2, y - 2, 4, 4); } }
    c.restore();
  }

  private intro(state: RenderState): void {
    const c = this.ctx; const alpha = clamp(Math.min(state.roomIntro * 1.8, (2.2 - state.roomIntro) * 1.6), 0, 1); c.save(); c.globalAlpha = alpha; c.fillStyle = '#080910c4'; c.fillRect(300, 217, 360, 106); c.strokeStyle = '#846145'; c.strokeRect(307, 224, 346, 92); c.textAlign = 'center'; c.fillStyle = '#d29a62'; c.font = '700 11px Inter'; c.fillText(state.room.kind === 'boss' ? 'EIN URALTER FLUCH ERWACHT' : `TIEFE ${state.room.depth}`, 480, 252); c.fillStyle = '#f0e5d3'; c.font = '700 24px Cinzel, serif'; c.fillText(this.roomName(state.room), 480, 286); c.restore();
  }

  roomName(room: Room): string {
    if (room.kind === 'start') return 'Das versiegelte Tor'; if (room.kind === 'boss') return 'Halle des Runenwächters';
    if (room.kind === 'elite') return 'Kammer des Blutzeichens'; if (room.kind === 'treasure') return 'Vergessene Schatzkammer'; if (room.kind === 'rest') return 'Stille Zuflucht';
    return ['Knochengewölbe', 'Schattenkreuzung', 'Geborstene Krypta', 'Aschenhalle'][room.depth % 4]!;
  }
}
