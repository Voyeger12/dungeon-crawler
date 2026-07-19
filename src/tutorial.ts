import type { TutorialId } from './model';
import type { StorageManager } from './storage';

export interface TutorialPrompt {
  id: TutorialId;
  key: string;
  title: string;
  text: string;
}

export interface TutorialContext {
  enabled: boolean;
  overlay: boolean;
  boss: boolean;
  combat: boolean;
  safe: boolean;
  interactable: boolean;
  potionNeeded: boolean;
}

const PROMPTS: Record<TutorialId, Omit<TutorialPrompt, 'id'>> = {
  move: { key: 'WASD', title: 'Bewegen', text: 'Erkunde den Raum und halte Abstand zu Gefahren.' },
  attack: { key: 'Klick / Leertaste', title: 'Angreifen', text: 'Richte die Klinge mit der Maus aus und schlage zu.' },
  dash: { key: 'Shift', title: 'Ausweichen', text: 'Der Dash macht dich kurz unverwundbar.' },
  potion: { key: 'Q', title: 'Heiltrank', text: 'Heiltränke retten Leben, sind aber begrenzt.' },
  interact: { key: 'E', title: 'Interagieren', text: 'Öffne Truhen oder raste am Runenkreis.' },
  character: { key: 'C', title: 'Charakterkodex', text: 'Prüfe Werte, Runensegen und gefundene Relikte.' },
  map: { key: 'M', title: 'Dungeonkarte', text: 'Öffne die Karte, wenn sich dein Weg verzweigt.' },
  gold: { key: 'Gold', title: 'Beute', text: 'Gesammeltes Gold erhöht deine Endwertung.' },
  key: { key: 'Schlüssel', title: 'Runenschlüssel', text: 'Runenschlüssel öffnen versiegelte Schatztruhen.' }
};

const ORDER: TutorialId[] = ['potion', 'interact', 'move', 'attack', 'dash', 'key', 'character', 'map', 'gold'];
const INFO_HINTS = new Set<TutorialId>(['gold', 'key']);

export class TutorialController {
  private pending = new Set<TutorialId>();
  private active?: TutorialId;
  private activeTime = 0;
  private movementTime = 0;
  private suspended = false;
  private retryAfter: Partial<Record<TutorialId, number>> = {};

  constructor(private readonly store: StorageManager) {}

  beginRun(): void {
    this.pending.clear(); this.active = undefined; this.activeTime = 0; this.movementTime = 0; this.suspended = false; this.retryAfter = {};
    const firstBasic = (['move', 'attack', 'dash'] as TutorialId[]).find(id => !this.store.isTutorialComplete(id));
    if (firstBasic) this.queue(firstBasic);
  }

  queue(id: TutorialId): void {
    if (!this.suspended && !this.store.isTutorialComplete(id) && id !== this.active) this.pending.add(id);
  }

  complete(id: TutorialId): void {
    if (this.suspended) return;
    this.pending.delete(id);
    if (this.active === id) { this.active = undefined; this.activeTime = 0; }
    this.store.completeTutorial(id);
    if (id === 'move') this.queue('attack');
    if (id === 'attack') this.queue('dash');
  }

  trackMovement(dt: number, moving: boolean): void {
    if (this.suspended || this.store.isTutorialComplete('move') || !moving) return;
    this.movementTime += dt;
    if (this.movementTime >= .35) this.complete('move');
  }

  update(dt: number, context: TutorialContext): TutorialPrompt | undefined {
    if (this.suspended || !context.enabled || context.overlay || context.boss) return undefined;
    for (const id of ORDER) if ((this.retryAfter[id] ?? 0) > 0) this.retryAfter[id] = Math.max(0, this.retryAfter[id]! - dt);
    if (this.active && !this.allowed(this.active, context)) { this.active = undefined; this.activeTime = 0; }
    if (this.active !== 'potion' && this.pending.has('potion') && this.allowed('potion', context)) { this.active = 'potion'; this.activeTime = 0; }
    if (!this.active) this.active = ORDER.find(id => this.pending.has(id) && (this.retryAfter[id] ?? 0) <= 0 && this.allowed(id, context));
    if (!this.active || !this.allowed(this.active, context)) return undefined;
    this.activeTime += dt;
    const id = this.active;
    if (INFO_HINTS.has(id) && this.activeTime >= 3.2) { this.complete(id); return undefined; }
    if (id !== 'potion' && this.activeTime >= 8) { this.active = undefined; this.activeTime = 0; this.retryAfter[id] = 15; return undefined; }
    return { id, ...PROMPTS[id] };
  }

  currentId(): TutorialId | undefined { return this.active; }
  suspendUntilNextRun(): void { this.suspended = true; this.pending.clear(); this.active = undefined; this.activeTime = 0; }

  private allowed(id: TutorialId, context: TutorialContext): boolean {
    if (id === 'interact') return context.interactable && !context.combat;
    if (id === 'potion') return context.potionNeeded;
    if (id === 'dash') return true;
    if (context.combat) return id === 'attack';
    if (INFO_HINTS.has(id)) return context.safe;
    return true;
  }
}
