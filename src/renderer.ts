import { COLORS, WORLD } from './config';
import { AssetStore, type AssetId } from './assets';
import { itemById, type LydiaStockEntry } from './items';
import { clamp, lerp } from './math';
import type { Enemy, FloatText, Hazard, Particle, Pickup, Player, Projectile, Room } from './model';
import { ACTOR_ATLAS_COLUMNS, ACTOR_ATLAS_ROWS, enemyFrame, playerFrame, type ActorFrame } from './sprites';

const imageReady = (image?: HTMLImageElement): image is HTMLImageElement => Boolean(image?.complete && image.naturalWidth > 0);

type TorchFace = 'north' | 'south' | 'west' | 'east';
export const TORCH_MOUNTS: ReadonlyArray<{ x: number; y: number; face: TorchFace }> = [
  { x: 176, y: 51, face: 'north' }, { x: 784, y: 51, face: 'north' },
  { x: 176, y: 477, face: 'south' }, { x: 784, y: 477, face: 'south' },
  { x: 48, y: 151, face: 'west' }, { x: 912, y: 389, face: 'east' }
];

export const PICKUP_PRESENTATION: Record<Pickup['kind'], { asset: AssetId; size: number; magical: boolean; color: string }> = {
  gold: { asset: 'pickupGold', size: 38, magical: false, color: '#f3c75b' },
  potion: { asset: 'pickupPotion', size: 42, magical: false, color: '#db5d71' },
  heal: { asset: 'pickupHeal', size: 43, magical: false, color: '#6dd59c' },
  key: { asset: 'pickupKey', size: 46, magical: false, color: '#e5b96c' },
  damage: { asset: 'pickupDamage', size: 48, magical: true, color: '#e36e4d' },
  speed: { asset: 'pickupSpeed', size: 48, magical: true, color: '#74c6dd' },
  relic: { asset: 'pickupRelic', size: 54, magical: true, color: '#b998f0' }
};

const PARTICLE_ASSETS: Record<NonNullable<Particle['visual']>, AssetId> = {
  hit: 'vfxHit', crit: 'vfxCrit', burnIgnite: 'vfxBurnIgnite', burnTick: 'vfxBurnTick',
  burnExpire: 'vfxBurnExpire', heal: 'vfxHeal', lightning: 'vfxLightning', wind: 'vfxWind'
};

export interface RenderState {
  room: Room; rooms: Map<string, Room>; player: Player; enemies: Enemy[]; projectiles: Projectile[];
  pickups: Pickup[]; hazards: Hazard[]; particles: Particle[]; texts: FloatText[]; time: number;
  doorsOpen: boolean; roomIntro: number; settings: { shake: boolean; reducedEffects: boolean }; shopStock?: LydiaStockEntry[];
}

export function configureLogicalCanvasContext(
  context: Pick<CanvasRenderingContext2D, 'setTransform' | 'imageSmoothingEnabled'>,
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>
): void {
  const scaleX = Math.max(1, canvas.width) / WORLD.width;
  const scaleY = Math.max(1, canvas.height) / WORLD.height;
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  context.imageSmoothingEnabled = false;
}

export function attackTrailOpacity(progress: number): number {
  const phase = clamp(progress, 0, 1);
  if (phase <= .06 || phase >= .36) return 0;
  if (phase < .18) return (phase - .06) / .12;
  return (0.36 - phase) / .18;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  shake = 0;
  flash = 0;

  constructor(private canvas: HTMLCanvasElement, private assets = new AssetStore()) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    configureLogicalCanvasContext(this.ctx, this.canvas);
  }

  preload(): Promise<void> { return this.assets.preloadCritical(); }

  private image(id: AssetId): HTMLImageElement | undefined { return this.assets.get(id); }

  private effectSprite(id: AssetId, x: number, y: number, width: number, height = width, alpha = 1, rotation = 0, flipX = false): boolean {
    const image = this.image(id); if (!imageReady(image)) return false;
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(rotation); if (flipX) c.scale(-1, 1);
    c.globalAlpha *= alpha; c.imageSmoothingEnabled = true; c.drawImage(image, -width / 2, -height / 2, width, height);
    c.restore(); c.imageSmoothingEnabled = false; return true;
  }

  private wallStrip(image: HTMLImageElement, x: number, y: number, width: number, height: number, tileWidth: number, tileHeight: number): void {
    const c = this.ctx; c.save(); c.beginPath(); c.rect(x, y, width, height); c.clip(); c.imageSmoothingEnabled = true;
    for (let drawY = y; drawY < y + height; drawY += tileHeight) {
      for (let drawX = x; drawX < x + width; drawX += tileWidth) c.drawImage(image, drawX, drawY, tileWidth, tileHeight);
    }
    c.restore(); c.imageSmoothingEnabled = false;
  }

  render(state: RenderState): void {
    const c = this.ctx; configureLogicalCanvasContext(c, this.canvas); const shake = state.settings.shake ? this.shake : 0;
    const sx = shake ? (Math.random() - .5) * shake : 0; const sy = shake ? (Math.random() - .5) * shake : 0;
    this.shake = Math.max(0, this.shake - .8); this.flash = Math.max(0, this.flash - .04);
    c.save(); c.translate(sx, sy); this.floor(state); this.hazards(state); this.decor(state);
    this.pickups(state); this.projectiles(state); this.actors(state); this.particles(state);
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(255,230,210,${this.flash})`; c.fillRect(0, 0, WORLD.width, WORLD.height); }
    if (state.roomIntro > 0) this.intro(state);
  }

  private floor(state: RenderState): void {
    const c = this.ctx; c.fillStyle = COLORS.void; c.fillRect(0, 0, WORLD.width, WORLD.height);
    c.fillStyle = COLORS.floor; c.fillRect(WORLD.wall, WORLD.wall, WORLD.width - WORLD.wall * 2, WORLD.height - WORLD.wall * 2);
    const floor = this.image('floor');
    if (imageReady(floor)) {
      const left = WORLD.wall; const top = WORLD.wall; const right = WORLD.width - WORLD.wall; const bottom = WORLD.height - WORLD.wall;
      c.save(); c.beginPath(); c.rect(left, top, right - left, bottom - top); c.clip(); c.globalAlpha = .9; c.imageSmoothingEnabled = true;
      const tile = 288; const seedX = Math.abs(state.room.gx * 67 + state.room.gy * 29) % tile; const seedY = Math.abs(state.room.gy * 83 + state.room.gx * 31) % tile;
      for (let y = top - seedY; y < bottom; y += tile) for (let x = left - seedX; x < right; x += tile) c.drawImage(floor, x, y, tile, tile);
      c.restore(); c.imageSmoothingEnabled = false;
    } else {
      c.strokeStyle = COLORS.grout; c.lineWidth = 1;
      for (let y = WORLD.wall; y < WORLD.height - WORLD.wall; y += 32) {
        c.beginPath(); c.moveTo(WORLD.wall, y + .5); c.lineTo(WORLD.width - WORLD.wall, y + .5); c.stroke();
        for (let x = WORLD.wall + ((y / 32) % 2) * 16; x < WORLD.width - WORLD.wall; x += 64) { c.beginPath(); c.moveTo(x + .5, y); c.lineTo(x + .5, Math.min(y + 32, WORLD.height - WORLD.wall)); c.stroke(); }
      }
    }
    this.walls(state);
  }

  private walls(state: RenderState): void {
    const c = this.ctx; const w = WORLD.wall; const dh = WORLD.doorHalf;
    const north = Boolean(state.room.connections.north); const south = Boolean(state.room.connections.south);
    const west = Boolean(state.room.connections.west); const east = Boolean(state.room.connections.east);
    const wallAssetsReady = (['wallNorth', 'wallSouth', 'wallWest', 'wallEast'] as const).every(id => imageReady(this.image(id)));
    if (wallAssetsReady) {
      const horizontal = (id: 'wallNorth' | 'wallSouth', y: number, hasDoor: boolean): void => {
        const image = this.image(id)!; const gapLeft = WORLD.width / 2 - dh; const gapRight = WORLD.width / 2 + dh;
        this.wallStrip(image, 0, y, hasDoor ? gapLeft : WORLD.width, 52, 92, 52);
        if (hasDoor) this.wallStrip(image, gapRight, y, WORLD.width - gapRight, 52, 92, 52);
      };
      const vertical = (id: 'wallWest' | 'wallEast', x: number, hasDoor: boolean): void => {
        const image = this.image(id)!; const gapTop = WORLD.height / 2 - dh; const gapBottom = WORLD.height / 2 + dh;
        this.wallStrip(image, x, 0, 48, hasDoor ? gapTop : WORLD.height, 48, 88);
        if (hasDoor) this.wallStrip(image, x, gapBottom, 48, WORLD.height - gapBottom, 48, 88);
      };
      horizontal('wallNorth', -5, north); horizontal('wallSouth', WORLD.height - 47, south);
      vertical('wallWest', -4, west); vertical('wallEast', WORLD.width - 44, east);
    } else {
      const wall = this.image('wallFallback'); const pattern = imageReady(wall) ? c.createPattern(wall, 'repeat') : undefined;
      c.fillStyle = pattern ?? COLORS.wall;
      const horizontal = (y: number, hasDoor: boolean): void => {
        if (hasDoor) { c.fillRect(0, y, WORLD.width / 2 - dh, w); c.fillRect(WORLD.width / 2 + dh, y, WORLD.width / 2 - dh, w); }
        else c.fillRect(0, y, WORLD.width, w);
      };
      const vertical = (x: number, hasDoor: boolean): void => {
        if (hasDoor) { c.fillRect(x, 0, w, WORLD.height / 2 - dh); c.fillRect(x, WORLD.height / 2 + dh, w, WORLD.height / 2 - dh); }
        else c.fillRect(x, 0, w, WORLD.height);
      };
      horizontal(0, north); horizontal(WORLD.height - w, south); vertical(0, west); vertical(WORLD.width - w, east);
    }
    if (north) this.door(WORLD.width / 2, w / 2, 'north', state.doorsOpen);
    if (south) this.door(WORLD.width / 2, WORLD.height - w / 2, 'south', state.doorsOpen);
    if (west) this.door(w / 2, WORLD.height / 2, 'west', state.doorsOpen);
    if (east) this.door(WORLD.width - w / 2, WORLD.height / 2, 'east', state.doorsOpen);
  }

  private door(x: number, y: number, direction: 'north' | 'south' | 'west' | 'east', open: boolean): void {
    const assetId = `${direction === 'north' ? 'gateNorth' : direction === 'south' ? 'gateSouth' : direction === 'west' ? 'gateWest' : 'gateEast'}${open ? 'Open' : 'Closed'}` as AssetId;
    const image = this.image(assetId);
    if (imageReady(image)) {
      const vertical = direction === 'west' || direction === 'east'; const c = this.ctx; c.save(); c.translate(x, y);
      if (vertical) c.rotate(direction === 'west' ? -Math.PI / 2 : Math.PI / 2);
      c.imageSmoothingEnabled = true; c.drawImage(image, -77, -43, 154, 86); c.restore(); c.imageSmoothingEnabled = false; return;
    }
    const c = this.ctx; c.save(); c.translate(x, y); if (direction === 'west' || direction === 'east') c.rotate(Math.PI / 2);
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
    TORCH_MOUNTS.forEach((mount, index) => this.torch(mount, state.time + index * .37, state.settings.reducedEffects));
    if (state.room.kind === 'shop' && state.room.shop) this.shopDecor(state);
    for (const o of state.room.obstacles) {
      if (o.hp <= 0) continue;
      c.save(); c.translate(o.x, o.y);
      const sprite = this.image(o.kind as AssetId);
      if (imageReady(sprite)) {
        const active = o.kind === 'spikes' && Math.sin(state.time * 2.2 + o.phase) > .35;
        const width = o.radius * (o.kind === 'rubble' ? 2.75 : o.kind === 'pillar' ? 2.15 : 2.45);
        const ratio = sprite.naturalHeight / sprite.naturalWidth;
        const height = width * ratio * (o.kind === 'spikes' ? (active ? 1 : .82) : 1);
        c.globalAlpha = o.kind === 'spikes' && !active ? .72 : 1;
        c.drawImage(sprite, -width / 2, o.radius * .82 - height, width, height);
      } else if (o.kind === 'spikes') {
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
    if (state.room.kind === 'rest' || (state.room.kind === 'shop' && state.room.shop)) {
      const rest = state.room.kind === 'shop' ? state.room.shop!.rest : { x: WORLD.width / 2, y: WORLD.height / 2 };
      c.save(); c.translate(rest.x, rest.y); c.strokeStyle = '#844638'; c.shadowColor = '#a24635'; c.shadowBlur = 13; c.lineWidth = 2; c.beginPath(); c.arc(0, 5, 48 + Math.sin(state.time * 2) * 2, 0, Math.PI * 2); c.stroke();
      const shrine = this.image('shrine');
      if (imageReady(shrine)) { const width = 96; const height = width * shrine.naturalHeight / shrine.naturalWidth; c.drawImage(shrine, -width / 2, 30 - height, width, height); }
      else { c.font = '32px serif'; c.fillStyle = '#b56a52'; c.textAlign = 'center'; c.fillText('ᛉ', 0, 11); }
      c.restore(); c.shadowBlur = 0;
    }
    if (state.room.kind === 'start') { c.fillStyle = '#675284'; c.globalAlpha = .5 + Math.sin(state.time * 2) * .12; c.font = '68px serif'; c.textAlign = 'center'; c.fillText('ᚱ', WORLD.width / 2, WORLD.height / 2 + 22); c.globalAlpha = 1; }
  }

  private shopDecor(state: RenderState): void {
    const layout = state.room.shop!; const c = this.ctx;
    const glow = c.createRadialGradient(layout.forge.x - 70, layout.forge.y + 18, 0, layout.forge.x - 70, layout.forge.y + 18, 240);
    glow.addColorStop(0, '#c96b2e38'); glow.addColorStop(.48, '#8f3c1a16'); glow.addColorStop(1, '#00000000');
    c.fillStyle = glow; c.fillRect(layout.forge.x - 300, 34, 600, 370);
    this.effectSprite('shopLydia', layout.forge.x, layout.forge.y, 540, 360, 1);
    const stock = state.shopStock ?? [];
    for (let index = 0; index < Math.min(layout.displaySlots.length, stock.length); index++) {
      const entry = stock[index]!; const item = itemById(entry.itemId); const slot = layout.displaySlots[index]!;
      const size = item.category === 'weapon' ? 54 : item.category === 'armor' ? 48 : 42;
      c.save(); c.globalAlpha = entry.purchased ? .14 : .92;
      c.fillStyle = '#090705b5'; c.beginPath(); c.ellipse(slot.x, slot.y + 11, 24, 7, 0, 0, Math.PI * 2); c.fill();
      this.effectSprite(item.asset, slot.x, slot.y - 8, size, size, 1, item.category === 'weapon' ? -.18 : 0);
      if (entry.purchased) {
        c.strokeStyle = '#8b3b36'; c.lineWidth = 4; c.beginPath(); c.moveTo(slot.x - 18, slot.y - 25); c.lineTo(slot.x + 18, slot.y + 10); c.stroke();
      }
      c.restore();
    }
  }

  private torch(mount: { x: number; y: number; face: TorchFace }, time: number, reducedEffects: boolean): void {
    const c = this.ctx; const side = mount.face === 'west' || mount.face === 'east'; const flip = mount.face === 'west';
    const fixtureId: AssetId = side ? 'torchFixtureSide' : mount.face === 'south' ? 'torchFixtureSouth' : 'torchFixtureNorth';
    const fixtureWidth = side ? 74 : 64; const fixtureHeight = side ? 104 : 90;
    const fixtureX = side ? mount.x + (flip ? 25 : -25) : mount.x;
    const fixtureY = mount.y + (mount.face === 'north' ? 18 : mount.face === 'south' ? 10 : 5);
    const flameX = side ? mount.x + (flip ? 40 : -40) : mount.x;
    const flameRootY = mount.y + (mount.face === 'north' ? 6 : mount.face === 'south' ? -5 : -4);
    const flicker = reducedEffects ? 0 : Math.sin(time * 11) * 2 + Math.sin(time * 17) * 1.2;
    const lightY = flameRootY - 15; const lightRadius = 70 + flicker;
    const gradient = c.createRadialGradient(flameX, lightY, 0, flameX, lightY, lightRadius);
    gradient.addColorStop(0, reducedEffects ? '#ffb45b25' : '#ffb45b38'); gradient.addColorStop(1, '#ff6b3000');
    c.fillStyle = gradient; c.beginPath(); c.arc(flameX, lightY, lightRadius, 0, Math.PI * 2); c.fill();

    const fixture = this.image(fixtureId);
    if (imageReady(fixture)) {
      c.save(); c.translate(fixtureX, fixtureY); if (flip) c.scale(-1, 1); c.imageSmoothingEnabled = true;
      c.drawImage(fixture, -fixtureWidth / 2, -fixtureHeight / 2, fixtureWidth, fixtureHeight); c.restore(); c.imageSmoothingEnabled = false;
    } else {
      c.fillStyle = '#3b2a20'; c.fillRect(mount.x - 4, mount.y - 10, 8, 30);
      c.strokeStyle = '#71604f'; c.lineWidth = 4; c.beginPath(); c.moveTo(mount.x, mount.y); c.lineTo(flameX, flameRootY); c.stroke();
    }

    const frame = reducedEffects ? 0 : Math.floor(time * 8) % 6; const flame = this.image(`torchFlame${frame}` as AssetId);
    if (imageReady(flame)) {
      c.save(); c.imageSmoothingEnabled = true; c.shadowColor = '#ff7538'; c.shadowBlur = reducedEffects ? 5 : 10;
      c.drawImage(flame, flameX - 17, flameRootY - 45, 34, 46); c.restore(); c.imageSmoothingEnabled = false; c.shadowBlur = 0;
    } else {
      c.fillStyle = '#ffbf55'; c.shadowColor = '#ff7538'; c.shadowBlur = 12; c.beginPath(); c.moveTo(flameX, flameRootY - 32); c.quadraticCurveTo(flameX + 10, flameRootY - 10, flameX, flameRootY); c.quadraticCurveTo(flameX - 9, flameRootY - 10, flameX, flameRootY - 32); c.fill(); c.shadowBlur = 0;
    }
  }

  private chest(x: number, y: number, opened: boolean, time: number): void {
    const c = this.ctx; c.save(); c.translate(x, y); const sprite = this.image(opened ? 'chestOpen' : 'chestClosed');
    if (imageReady(sprite)) {
      const width = opened ? 78 : 70; const height = width * sprite.naturalHeight / sprite.naturalWidth;
      c.shadowColor = opened ? '#6d5b42' : '#a56738'; c.shadowBlur = opened ? 0 : 8 + Math.sin(time * 3) * 2; c.drawImage(sprite, -width / 2, 29 - height, width, height);
    } else {
      c.fillStyle = '#07081188'; c.beginPath(); c.ellipse(4, 18, 32, 13, 0, 0, Math.PI * 2); c.fill(); c.shadowColor = opened ? '#6d5b42' : '#d9a758'; c.shadowBlur = opened ? 0 : 10 + Math.sin(time * 3) * 3; c.fillStyle = opened ? '#392a29' : '#704836'; c.fillRect(-28, -4, 56, 27); c.fillStyle = '#b5844e'; c.fillRect(-30, -7, 60, 8); c.fillRect(-4, -8, 8, 31); if (opened) { c.fillStyle = '#4a3030'; c.fillRect(-28, -24, 56, 17); }
    }
    c.restore(); c.shadowBlur = 0;
  }

  private hazards(state: RenderState): void {
    const c = this.ctx;
    for (const h of state.hazards) {
      const warning = h.warning > 0; const alpha = warning ? .25 + Math.sin(state.time * 16) * .15 : clamp(h.active * 2, 0, .75);
      c.save(); c.translate(h.x, h.y);
      if (h.type === 'rune') this.effectSprite('vfxBossRune', 0, 0, h.radius * 2.25, h.radius * 2.25, warning ? .42 : .72, state.settings.reducedEffects ? 0 : state.time * .12);
      else if (h.type === 'shockwave') this.effectSprite('vfxShockwave', 0, 0, Math.max(52, h.ringRadius * 2.2), Math.max(52, h.ringRadius * 2.2), warning ? .34 : .68);
      c.strokeStyle = warning ? `rgba(234,92,79,${alpha + .25})` : `rgba(236,112,75,${alpha})`; c.fillStyle = `rgba(168,48,67,${alpha * .22})`; c.lineWidth = warning ? 3 : 7; c.setLineDash(warning ? [8, 7] : []); c.beginPath();
      if (h.type === 'shockwave') c.arc(0, 0, h.ringRadius, 0, Math.PI * 2); else c.arc(0, 0, h.radius, 0, Math.PI * 2);
      c.fill(); c.stroke(); c.setLineDash([]); if (warning && h.type !== 'rune') { c.fillStyle = '#ed9d79'; c.font = 'bold 17px serif'; c.textAlign = 'center'; c.fillText('!', 0, 6); } c.restore();
    }
  }

  private pickups(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.pickups) {
      if (p.collected) continue;
      const presentation = PICKUP_PRESENTATION[p.kind]; const bob = Math.sin(state.time * 1.65 + p.phase) * (presentation.magical && !state.settings.reducedEffects ? 2.2 : .45);
      c.save(); c.translate(p.x, p.y);
      c.fillStyle = '#0504038a'; c.beginPath(); c.ellipse(2, 12, presentation.size * .34, presentation.size * .12, 0, 0, Math.PI * 2); c.fill();
      c.translate(0, bob); c.shadowColor = presentation.color; c.shadowBlur = presentation.magical ? 11 : 4;
      const sprite = this.image(presentation.asset);
      if (imageReady(sprite)) {
        c.imageSmoothingEnabled = true; c.drawImage(sprite, -presentation.size / 2, -presentation.size * .72, presentation.size, presentation.size); c.imageSmoothingEnabled = false;
      } else {
        c.fillStyle = presentation.color; c.rotate(Math.PI / 4); c.fillRect(-8, -8, 16, 16);
      }
      c.restore(); c.shadowBlur = 0;
    }
  }

  private projectiles(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.projectiles) {
      const angle = Math.atan2(p.vy, p.vx);
      if (p.visual === 'arrow' && this.effectSprite('vfxArrow', p.x, p.y, 64, 30, 1, angle)) continue;
      if (p.visual === 'orb' && this.effectSprite('vfxOrb', p.x, p.y, 42, 42, 1, angle + Math.PI)) continue;
      c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 12; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2); c.fill(); c.globalAlpha = .35; c.beginPath(); c.arc(p.x - p.vx * .02, p.y - p.vy * .02, p.radius * .7, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }
    c.shadowBlur = 0;
  }

  private actors(state: RenderState): void {
    const entries: Array<{ y: number; id: number; enemy?: Enemy }> = state.enemies
      .filter(enemy => enemy.state !== 'dead' || enemy.deathTimer > 0)
      .map(enemy => ({ y: enemy.y, id: enemy.id, enemy }));
    entries.push({ y: state.player.y, id: Number.MAX_SAFE_INTEGER });
    entries.sort((a, b) => a.y - b.y || a.id - b.id);
    for (const entry of entries) {
      if (entry.enemy) this.enemy(entry.enemy, state.time, state.settings.reducedEffects);
      else this.player(state);
    }
  }

  private actorSprite(image: HTMLImageElement, frame: ActorFrame, width: number, height: number, pivotY: number): void {
    const c = this.ctx; const sourceWidth = image.naturalWidth / ACTOR_ATLAS_COLUMNS; const sourceHeight = image.naturalHeight / ACTOR_ATLAS_ROWS;
    c.save(); c.imageSmoothingEnabled = true;
    if (frame.mirrored) c.scale(-1, 1);
    c.drawImage(
      image,
      frame.column * sourceWidth,
      frame.row * sourceHeight,
      sourceWidth,
      sourceHeight,
      -width / 2,
      -height * pivotY,
      width,
      height
    );
    c.restore(); c.imageSmoothingEnabled = false;
  }

  private enemy(e: Enemy, time: number, reducedEffects: boolean): void {
    const c = this.ctx; const walking = e.state === 'chase'; const walk = walking ? Math.sin(time * (e.kind === 'shadow' ? 15 : 9) + e.id) : 0; const bob = e.state === 'dead' ? 0 : walking ? Math.abs(walk) * 2 : Math.sin(time * 2.4 + e.id) * .6;
    c.save(); c.translate(Math.round(e.x), Math.round(e.y));
    c.fillStyle = '#05060b99'; c.beginPath(); c.ellipse(3, e.radius * .72, e.radius * 1.05, e.radius * .45, 0, 0, Math.PI * 2); c.fill();
    if (e.slow > 0 && e.state !== 'dead') this.effectSprite('vfxFrost', 0, e.radius * .42, Math.max(58, e.radius * 3.15), Math.max(44, e.radius * 2.25), .72);
    if (e.elite || e.kind === 'boss') { c.strokeStyle = e.kind === 'boss' ? '#b24d69' : '#e4a755'; c.shadowColor = c.strokeStyle; c.shadowBlur = 14; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, e.radius + 7 + Math.sin(time * 4) * 2, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    if (e.state === 'telegraph') { c.strokeStyle = '#f17b69'; c.lineWidth = 3; c.setLineDash([4, 4]); c.beginPath(); c.arc(0, 0, e.radius + 11 + Math.sin(time * 20) * 3, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff0d0'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('!', 0, -e.radius - 15); }
    c.translate(0, -bob);
    const sprite = this.image(e.kind as AssetId);
    if (imageReady(sprite)) {
      const fadeWindow = e.kind === 'boss' ? .45 : .22;
      if (e.state === 'dead' && e.deathTimer < fadeWindow) c.globalAlpha = clamp(e.deathTimer / fadeWindow, 0, 1);
      if (e.flash > 0) c.filter = 'brightness(2.2) saturate(.25)';
      else if (e.kind === 'boss' && e.phase === 2) c.filter = 'brightness(1.14) saturate(1.24) sepia(.12)';
      else if (e.elite) c.filter = 'brightness(1.12) sepia(.14) saturate(1.12)';
      let width = 133; let height = 106; let pivotY = .82;
      if (e.kind === 'slime') { width = e.summoned ? 68 : 115; height = e.summoned ? 54 : 92; pivotY = .78; }
      else if (e.kind === 'shadow') { width = 140; height = 112; pivotY = .84; }
      else if (e.kind === 'boss') { width = 243; height = 194; pivotY = .84; }
      else if (e.summoned) { width = 73; height = 58; }
      this.actorSprite(sprite, enemyFrame(e, time), width, height, pivotY);
      c.filter = 'none'; c.globalAlpha = 1;
    } else if (e.kind === 'skeleton' || e.kind === 'archer') {
      const bone = e.flash > 0 ? '#fff' : e.elite ? '#e0b66e' : '#d9d2bd'; const lookX = Math.cos(e.aim) * 2.5; const lookY = Math.sin(e.aim) * 1.5;
      c.strokeStyle = bone; c.lineWidth = 5; c.beginPath(); c.moveTo(-6, 7); c.lineTo(-7 + walk * 4, 18); c.moveTo(6, 7); c.lineTo(7 - walk * 4, 18); c.stroke();
      c.fillStyle = e.kind === 'archer' ? '#613e62' : '#6d3442'; c.fillRect(-13, 3, 26, 11); c.fillStyle = bone; c.fillRect(-10, -11, 20, 19); c.fillRect(-13, -22, 26, 16);
      c.fillStyle = '#171823'; c.fillRect(-7 + lookX, -18 + lookY, 4, 4); c.fillRect(4 + lookX, -18 + lookY, 4, 4);
      const telegraphLift = e.state === 'telegraph' ? -1.05 : e.state === 'attack' ? .65 : .18; c.save(); c.translate(Math.cos(e.aim) * 7, Math.sin(e.aim) * 3 - 2); c.rotate(e.aim + telegraphLift);
      c.strokeStyle = bone; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(17, 0); c.stroke();
      if (e.kind === 'skeleton') { c.fillStyle = '#bfc4cd'; c.beginPath(); c.moveTo(15, -3); c.lineTo(43, -2); c.lineTo(50, 0); c.lineTo(43, 3); c.lineTo(15, 3); c.fill(); c.strokeStyle = '#8b6748'; c.lineWidth = 4; c.beginPath(); c.moveTo(14, -7); c.lineTo(14, 7); c.stroke(); }
      else { const pull = e.state === 'telegraph' ? clamp(1 - e.stateTimer / .65, 0, 1) : 0; c.strokeStyle = '#bd8b59'; c.lineWidth = 3; c.beginPath(); c.arc(27, 0, 14, -1.45, 1.45); c.stroke(); c.strokeStyle = '#d9c8a6'; c.lineWidth = 1; c.beginPath(); c.moveTo(29, -14); c.lineTo(18 - pull * 5, 0); c.lineTo(29, 14); c.stroke(); }
      c.restore();
    } else if (e.kind === 'slime') {
      const squashX = e.state === 'telegraph' ? 1.22 : e.state === 'attack' ? .82 : 1 + Math.sin(time * 5 + e.id) * .04; const squashY = e.state === 'telegraph' ? .72 : e.state === 'attack' ? 1.3 : 1 - Math.sin(time * 5 + e.id) * .04; c.scale(squashX, squashY);
      c.fillStyle = e.flash > 0 ? '#fff' : e.elite ? '#c195e0' : '#6db47f'; c.beginPath(); c.moveTo(-e.radius, e.radius * .6); c.quadraticCurveTo(-e.radius * .8, -e.radius, 0, -e.radius); c.quadraticCurveTo(e.radius * .8, -e.radius, e.radius, e.radius * .6); c.closePath(); c.fill(); const eyeX = Math.cos(e.aim) * 5; const eyeY = Math.sin(e.aim) * 3; c.fillStyle = '#17201e'; c.fillRect(-8 + eyeX, -9 + eyeY, 5, 6); c.fillRect(5 + eyeX, -9 + eyeY, 5, 6);
    } else if (e.kind === 'shadow') {
      c.rotate(e.aim); const stretch = e.state === 'attack' ? 1.45 : e.state === 'telegraph' ? .72 : 1; c.scale(stretch, 1 / Math.sqrt(stretch)); c.fillStyle = e.flash > 0 ? '#fff' : e.elite ? '#c76cbb' : '#6d4c8f'; c.shadowColor = '#8f58ba'; c.shadowBlur = 14; c.beginPath(); c.moveTo(e.radius, 0); c.lineTo(5, -e.radius); c.lineTo(-e.radius, -e.radius * .5); c.lineTo(-e.radius * .7, e.radius * .7); c.lineTo(5, e.radius); c.closePath(); c.fill(); c.fillStyle = '#ff6f86'; c.fillRect(5, -8, 8, 4); c.shadowBlur = 0;
    } else {
      const pulse = e.state === 'telegraph' ? Math.sin(time * 18) * 3 : 0; c.fillStyle = e.flash > 0 ? '#fff' : e.phase === 2 ? '#983855' : '#605377'; c.beginPath(); c.moveTo(0, -e.radius - pulse); for (let i = 1; i < 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI * 2; const r = i % 2 ? e.radius * .8 : e.radius + pulse; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); c.fillStyle = '#292234'; c.beginPath(); c.arc(0, 0, e.radius * .6, 0, Math.PI * 2); c.fill(); const eyeX = Math.cos(e.aim) * 8; const eyeY = Math.sin(e.aim) * 5; c.fillStyle = '#ef6c75'; c.shadowColor = '#ef5368'; c.shadowBlur = 16; c.fillRect(eyeX - 9, eyeY - 4, 18, 7); c.shadowBlur = 0;
      const weaponAngle = e.aim + (e.state === 'telegraph' ? -1.15 : e.state === 'attack' ? .7 : .3); c.save(); c.rotate(weaponAngle); c.strokeStyle = '#c4a26d'; c.lineWidth = 7; c.beginPath(); c.moveTo(8, 0); c.lineTo(e.radius + 28, 0); c.stroke(); c.fillStyle = '#77768a'; c.beginPath(); c.moveTo(e.radius + 22, -7); c.lineTo(e.radius + 48, 0); c.lineTo(e.radius + 22, 7); c.fill(); c.restore();
    }
    if (e.burn > 0 && e.state !== 'dead') {
      const pulse = reducedEffects ? 1 : .94 + Math.sin(time * 10 + e.id) * .06; const size = Math.max(66, e.radius * 3.4) * pulse;
      this.effectSprite('vfxBurnLoop', 0, e.radius * .08, size, size, reducedEffects ? .68 : .78);
    }
    c.restore();
    if (e.state !== 'dead' && e.kind !== 'boss' && e.hp < e.maxHp) { c.fillStyle = '#090a10'; c.fillRect(e.x - e.radius, e.y - e.radius - 13, e.radius * 2, 4); c.fillStyle = e.elite ? '#d9954d' : '#b83f53'; c.fillRect(e.x - e.radius, e.y - e.radius - 13, e.radius * 2 * clamp(e.hp / e.maxHp, 0, 1), 4); }
  }

  private player(state: RenderState): void {
    const sprite = this.image('runebearer');
    if (imageReady(sprite)) { this.playerSprite(state, sprite); return; }
    const p = state.player; const c = this.ctx; const moving = Math.hypot(p.vx, p.vy) > 12; const walk = moving ? Math.sin(state.time * 12) : 0; const bob = moving ? Math.abs(walk) * 2 : Math.sin(state.time * 2.5) * .5; if (p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) c.globalAlpha = .42;
    this.canvas.dataset.attackState = p.attackAnim > 0 ? 'swinging' : 'idle';
    c.save(); c.translate(Math.round(p.x), Math.round(p.y));
    c.fillStyle = '#05060b99'; c.beginPath(); c.ellipse(3, 18, 20 - Math.abs(walk) * 2, 8, 0, 0, Math.PI * 2); c.fill();
    if (p.speedBuff > 0) this.effectSprite('vfxWind', -Math.cos(p.aim) * 13, -Math.sin(p.aim) * 6, 74, 52, .48, p.aim + Math.PI);
    if (p.shield > 0 && !this.effectSprite('vfxShield', 0, -2, 68, 68, .72, state.settings.reducedEffects ? 0 : state.time * .15)) { c.strokeStyle = '#75d5d1aa'; c.lineWidth = 3; c.shadowColor = '#65d3d1'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, p.radius + 8, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    c.translate(0, -bob); const lookX = Math.cos(p.aim) * 3; const lookY = Math.sin(p.aim) * 1.5; const facingAway = Math.sin(p.aim) < -.3;
    c.fillStyle = '#202538'; c.fillRect(-10, 8 + walk * 3, 7, 11); c.fillRect(3, 8 - walk * 3, 7, 11); c.fillStyle = '#111522'; c.fillRect(-11, 15 + walk * 3, 8, 5); c.fillRect(3, 15 - walk * 3, 8, 5);
    c.fillStyle = p.flash > 0 ? '#fff' : '#436f84'; c.beginPath(); c.moveTo(-16, 14); c.lineTo(-12, -10); c.lineTo(-6, -17); c.lineTo(6, -17); c.lineTo(13, -9); c.lineTo(16, 14); c.lineTo(7, 10); c.lineTo(0, 17); c.lineTo(-7, 10); c.closePath(); c.fill();
    c.fillStyle = '#1c2737'; c.fillRect(-14, 4, 28, 9); c.fillStyle = '#98704f'; c.fillRect(-15, 7, 30, 3);
    c.fillStyle = '#29384b'; c.beginPath(); c.arc(0, -15, 11, Math.PI, 0); c.fill(); c.fillRect(-11, -16, 22, 10); c.fillStyle = '#d3b092'; c.fillRect(-7, -17, 14, 10);
    if (!facingAway) { c.fillStyle = '#f4d98f'; if (Math.cos(p.aim) > .35) c.fillRect(3 + lookX, -14 + lookY, 4, 3); else if (Math.cos(p.aim) < -.35) c.fillRect(-7 + lookX, -14 + lookY, 4, 3); else { c.fillRect(-6 + lookX, -14 + lookY, 3, 3); c.fillRect(3 + lookX, -14 + lookY, 3, 3); } }

    const attacking = p.attackAnim > 0; const progress = attacking ? clamp(1 - p.attackAnim / .34, 0, 1) : 1; const eased = progress * progress * (3 - 2 * progress); const swingDirection = p.attackCombo === 1 ? 1 : -1; const swordAngle = attacking ? p.aim + swingDirection * lerp(-1.35, 1.12, eased) : p.aim + .18;
    if (attacking) {
      const trailAlpha = attackTrailOpacity(progress); const trailColor = p.attackCombo === 2 ? '#f2be5e' : '#bde7ef'; c.lineCap = 'round';
      if (trailAlpha > 0) {
        c.globalAlpha = (p.attackCombo === 2 ? .42 : .32) * trailAlpha; c.strokeStyle = trailColor; c.shadowColor = trailColor; c.shadowBlur = 10; c.lineWidth = p.attackCombo === 2 ? 9 : 6; c.beginPath(); c.arc(0, 0, p.range * .64, p.aim + swingDirection * -1.35, swordAngle, swingDirection < 0); c.stroke(); c.shadowBlur = 0;
        for (let i = 3; i >= 1; i--) { const ghostProgress = clamp(eased - i * .055, 0, 1); const ghostAngle = p.aim + swingDirection * lerp(-1.35, 1.12, ghostProgress); c.save(); c.rotate(ghostAngle); c.globalAlpha = (.08 + (4 - i) * .04) * trailAlpha; c.strokeStyle = trailColor; c.lineWidth = p.attackCombo === 2 ? 8 : 5; c.beginPath(); c.moveTo(28, 0); c.lineTo(p.range * .72, 0); c.stroke(); c.restore(); }
        c.globalAlpha = 1;
      }
    }
    if (p.equipment?.mainHand) this.equippedWeapon(p, swordAngle);
    else {
      c.save(); c.translate(Math.cos(p.aim) * 5, Math.sin(p.aim) * 3 - 1); c.rotate(swordAngle); c.strokeStyle = '#d3b092'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(17, 0); c.stroke(); c.strokeStyle = '#8c5f3f'; c.lineWidth = 5; c.beginPath(); c.moveTo(15, -7); c.lineTo(15, 7); c.stroke(); c.fillStyle = p.attackCombo === 2 && attacking ? '#f4d07a' : '#d6d9e1'; c.shadowColor = attacking ? c.fillStyle : 'transparent'; c.shadowBlur = attacking ? 9 : 0; c.beginPath(); c.moveTo(17, -3); c.lineTo(52, -2); c.lineTo(61, 0); c.lineTo(52, 3); c.lineTo(17, 3); c.fill(); c.fillStyle = '#8a6544'; c.fillRect(12, -3, 9, 6); c.restore(); c.shadowBlur = 0;
    }
    c.restore(); c.globalAlpha = 1;
  }

  private playerSprite(state: RenderState, sprite: HTMLImageElement): void {
    const p = state.player; const c = this.ctx; const attacking = p.attackAnim > 0; const moving = Math.hypot(p.vx, p.vy) > 12;
    const walk = moving ? Math.sin(state.time * 12) : 0; const bob = moving ? Math.abs(walk) * 1.2 : Math.sin(state.time * 2.5) * .35;
    this.canvas.dataset.attackState = attacking ? 'swinging' : 'idle';
    c.save(); c.translate(Math.round(p.x), Math.round(p.y));
    c.fillStyle = '#05060b99'; c.beginPath(); c.ellipse(3, 13, 22 - Math.abs(walk) * 2, 8, 0, 0, Math.PI * 2); c.fill();
    if (p.speedBuff > 0) this.effectSprite('vfxWind', -Math.cos(p.aim) * 13, -Math.sin(p.aim) * 6, 74, 52, .48, p.aim + Math.PI);
    if (p.shield > 0 && !this.effectSprite('vfxShield', 0, -2, 70, 70, .72, state.settings.reducedEffects ? 0 : state.time * .15)) { c.strokeStyle = '#75d5d1aa'; c.lineWidth = 3; c.shadowColor = '#65d3d1'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, p.radius + 10, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    const progress = attacking ? clamp(1 - p.attackAnim / .34, 0, 1) : 1;
    const swingDirection = p.attackCombo === 1 ? 1 : -1;
    const swordAngle = attacking ? p.aim + swingDirection * lerp(-1.35, 1.12, progress * progress * (3 - 2 * progress)) : p.aim + .18;
    if (attacking) {
      const trailAlpha = attackTrailOpacity(progress); const trailColor = p.attackCombo === 2 ? '#f2be5e' : '#bde7ef';
      if (trailAlpha > 0) {
        c.globalAlpha = (p.attackCombo === 2 ? .42 : .32) * trailAlpha; c.strokeStyle = trailColor; c.shadowColor = trailColor; c.shadowBlur = 10; c.lineWidth = p.attackCombo === 2 ? 9 : 6; c.beginPath(); c.arc(0, 0, p.range * .64, p.aim + swingDirection * -1.35, swordAngle, swingDirection < 0); c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1;
      }
    }
    c.translate(0, -bob);
    if (p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0) c.globalAlpha = .42;
    if (p.flash > 0) c.filter = 'brightness(2.15) saturate(.3)';
    else if (p.equipment?.body === 'soot-chainmail') c.filter = 'brightness(.95) saturate(.82) contrast(1.12)';
    else if (p.equipment?.body === 'patched-wolf-leather') c.filter = 'sepia(.12) brightness(.96) saturate(1.08)';
    this.actorSprite(sprite, playerFrame(p, state.time), 145, 116, .82);
    c.filter = 'none';
    if (p.equipment?.mainHand) this.equippedWeapon(p, swordAngle);
    c.restore(); c.globalAlpha = 1;
  }

  private equippedWeapon(player: Player, angle: number): void {
    const id = player.equipment?.mainHand; if (!id) return;
    const item = itemById(id); const size = id === 'ashfang' ? 58 : 66; const reach = id === 'ashfang' ? 25 : 29;
    this.effectSprite(item.asset, Math.cos(angle) * reach, Math.sin(angle) * reach * .68 - 2, size, size, .96, angle + Math.PI / 4);
  }

  private particles(state: RenderState): void {
    const c = this.ctx;
    for (const p of state.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1); c.globalAlpha = 1;
      if (p.visual) {
        const rendered = this.effectSprite(PARTICLE_ASSETS[p.visual], p.x, p.y, p.size * (p.scaleX ?? 1), p.size * (p.scaleY ?? 1), alpha, p.rotation ?? 0);
        if (rendered) continue;
      }
      c.globalAlpha = alpha; c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    c.globalAlpha = 1; c.textAlign = 'center';
    for (const t of state.texts) { c.globalAlpha = clamp(t.life / t.maxLife, 0, 1); c.fillStyle = t.color; c.font = `800 ${t.size}px Inter, sans-serif`; c.strokeStyle = '#070810'; c.lineWidth = 3; c.strokeText(t.text, t.x, t.y); c.fillText(t.text, t.x, t.y); }
    c.globalAlpha = 1;
  }

  private intro(state: RenderState): void {
    const c = this.ctx; const alpha = clamp(Math.min(state.roomIntro * 1.8, (2.2 - state.roomIntro) * 1.6), 0, 1); c.save(); c.globalAlpha = alpha; c.fillStyle = '#080910c4'; c.fillRect(300, 217, 360, 106); c.strokeStyle = '#846145'; c.strokeRect(307, 224, 346, 92); c.textAlign = 'center'; c.fillStyle = '#d29a62'; c.font = '700 11px Inter'; c.fillText(state.room.kind === 'boss' ? 'EIN URALTER FLUCH ERWACHT' : state.room.kind === 'shop' ? 'EIN SICHERES FEUER BRENNT' : `TIEFE ${state.room.depth}`, 480, 252); c.fillStyle = '#f0e5d3'; c.font = '700 24px Cinzel, serif'; c.fillText(this.roomName(state.room), 480, 286); c.restore();
  }

  roomName(room: Room): string {
    if (room.kind === 'start') return 'Das versiegelte Tor'; if (room.kind === 'boss') return 'Halle des Runenwächters';
    if (room.kind === 'elite') return 'Kammer des Blutzeichens'; if (room.kind === 'treasure') return 'Vergessene Schatzkammer'; if (room.kind === 'rest') return 'Stille Zuflucht'; if (room.kind === 'shop') return 'Lydias letzte Esse';
    return ['Knochengewölbe', 'Schattenkreuzung', 'Geborstene Krypta', 'Aschenhalle'][room.depth % 4]!;
  }
}
