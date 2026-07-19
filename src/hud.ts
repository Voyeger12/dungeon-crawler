import { clamp } from './math';
import type { TutorialPrompt } from './tutorial';

export interface HudEffect {
  id: string;
  label: string;
  value: string;
  tone: 'damage' | 'speed' | 'shield';
}

export interface HudContext {
  key: string;
  text: string;
  tone?: 'normal' | 'danger';
}

export interface HudState {
  hp: number;
  maxHp: number;
  xp: number;
  xpNeeded: number;
  level: number;
  gold: number;
  keys: number;
  showKeys: boolean;
  potions: number;
  potionHeal: number;
  dashRemaining: number;
  dashCooldown: number;
  roomName: string;
  objective: string;
  combat: boolean;
  context?: HudContext;
  effects: HudEffect[];
  tutorial?: TutorialPrompt;
  boss?: { name: string; hp: number; maxHp: number };
}

type CachedElements = {
  hud: HTMLElement;
  level: HTMLElement;
  healthBar: HTMLElement;
  healthFill: HTMLElement;
  healthText: HTMLElement;
  xpBar: HTMLElement;
  xpFill: HTMLElement;
  xpText: HTMLElement;
  roomTitle: HTMLElement;
  objective: HTMLElement;
  gold: HTMLElement;
  keyResource: HTMLElement;
  keys: HTMLElement;
  potionAction: HTMLElement;
  potionCount: HTMLElement;
  potionState: HTMLElement;
  dash: HTMLElement;
  dashFill: HTMLElement;
  dashState: HTMLElement;
  effects: HTMLElement;
  tutorial: HTMLElement;
  tutorialKey: HTMLElement;
  tutorialTitle: HTMLElement;
  tutorialText: HTMLElement;
  context: HTMLElement;
  contextKey: HTMLElement;
  contextText: HTMLElement;
  boss: HTMLElement;
  bossBar: HTMLElement;
  bossFill: HTMLElement;
  bossName: HTMLElement;
  bossText: HTMLElement;
  status: HTMLElement;
  alert: HTMLElement;
};

const required = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`HUD-Element fehlt: ${selector}`);
  return element;
};

export class HudView {
  private readonly elements: CachedElements = {
    hud: required('#hud'), level: required('#level-value'), healthBar: required('#health-bar'), healthFill: required('#health-fill'), healthText: required('#health-text'),
    xpBar: required('#xp-bar'), xpFill: required('#xp-fill'), xpText: required('#xp-text'), roomTitle: required('#room-title'), objective: required('#objective'),
    gold: required('#gold-value'), keyResource: required('#key-resource'), keys: required('#key-value'), potionAction: required('#potion-action'), potionCount: required('#potion-count'),
    potionState: required('#potion-state'), dash: required('#dash-indicator'), dashFill: required('#dash-fill'), dashState: required('#dash-state'), effects: required('#effects'),
    tutorial: required('#tutorial-hint'), tutorialKey: required('#tutorial-key'), tutorialTitle: required('#tutorial-title'), tutorialText: required('#tutorial-text'),
    context: required('#context-prompt'), contextKey: required('#context-key'), contextText: required('#context-text'), boss: required('#boss-hud'), bossBar: required('#boss-bar'),
    bossFill: required('#boss-fill'), bossName: required('#boss-name'), bossText: required('#boss-text'), status: required('#game-status-region'), alert: required('#game-alert-region')
  };
  private effectSignature = '';

  show(): void { this.elements.hud.classList.remove('hidden'); }
  hide(): void { this.elements.hud.classList.add('hidden'); }
  hideTransient(): void {
    for (const element of [this.elements.tutorial, this.elements.context]) { element.classList.add('hidden'); element.setAttribute('aria-hidden', 'true'); }
  }

  update(state: HudState): void {
    const e = this.elements;
    this.text(e.level, state.level.toString());
    this.meter(e.healthBar, e.healthFill, e.healthText, state.hp, state.maxHp, `${Math.ceil(state.hp)} / ${state.maxHp} LP`);
    this.meter(e.xpBar, e.xpFill, e.xpText, state.xp, state.xpNeeded, `${state.xp} / ${state.xpNeeded} EP`);
    this.data(e.hud, 'combat', String(state.combat));
    e.hud.classList.toggle('health-critical', state.hp / Math.max(1, state.maxHp) <= .3);
    this.text(e.roomTitle, state.roomName); this.text(e.objective, state.objective); this.text(e.gold, state.gold.toString()); this.text(e.keys, state.keys.toString());
    e.keyResource.classList.toggle('hidden', !state.showKeys);

    this.text(e.potionCount, `×${state.potions}`);
    const potionState = state.potions <= 0 ? 'Leer' : state.hp >= state.maxHp ? 'Leben voll' : `Heilt bis zu ${Math.min(state.potionHeal, Math.ceil(state.maxHp - state.hp))} LP`;
    this.text(e.potionState, potionState); this.data(e.potionAction, 'state', state.potions <= 0 ? 'empty' : state.hp >= state.maxHp ? 'blocked' : 'ready');

    const dashReady = state.dashRemaining <= 0; const dashProgress = dashReady ? 1 : clamp(1 - state.dashRemaining / Math.max(.001, state.dashCooldown), 0, 1);
    this.style(e.dashFill, '--progress', `${Math.round(dashProgress * 1000) / 10}%`); this.text(e.dashState, dashReady ? 'Bereit' : `${state.dashRemaining.toFixed(1)} s`); this.data(e.dash, 'state', dashReady ? 'ready' : 'cooldown');

    const effectSignature = state.effects.map(effect => `${effect.id}:${effect.value}`).join('|');
    if (effectSignature !== this.effectSignature) {
      this.effectSignature = effectSignature; e.effects.replaceChildren(...state.effects.map(effect => {
        const item = document.createElement('span'); item.className = `effect-chip ${effect.tone}`; item.dataset.effect = effect.id;
        const label = document.createElement('strong'); label.textContent = effect.label; const value = document.createElement('small'); value.textContent = effect.value; item.append(label, value); return item;
      }));
    }

    e.tutorial.classList.toggle('hidden', !state.tutorial); this.attribute(e.tutorial, 'aria-hidden', String(!state.tutorial));
    if (state.tutorial) { this.text(e.tutorialKey, state.tutorial.key); this.text(e.tutorialTitle, state.tutorial.title); this.text(e.tutorialText, state.tutorial.text); this.data(e.tutorial, 'tutorial', state.tutorial.id); }

    e.context.classList.toggle('hidden', !state.context); e.context.setAttribute('aria-hidden', String(!state.context));
    if (state.context) { this.text(e.contextKey, state.context.key); this.text(e.contextText, state.context.text); this.data(e.context, 'tone', state.context.tone ?? 'normal'); }

    const boss = state.boss; e.boss.classList.toggle('hidden', !boss);
    if (boss) { this.text(e.bossName, boss.name); this.meter(e.bossBar, e.bossFill, e.bossText, boss.hp, boss.maxHp, `${Math.ceil(boss.hp)} / ${boss.maxHp}`); }
  }

  announceStatus(message: string): void { this.announce(this.elements.status, message); }
  announceAlert(message: string): void { this.announce(this.elements.alert, message); }

  private meter(bar: HTMLElement, fill: HTMLElement, text: HTMLElement, value: number, max: number, label: string): void {
    const safeMax = Math.max(1, max); const safeValue = clamp(value, 0, safeMax); const ratio = safeValue / safeMax;
    this.style(fill, 'transform', `scaleX(${ratio})`); this.text(text, label); this.attribute(bar, 'aria-valuenow', Math.round(safeValue).toString()); this.attribute(bar, 'aria-valuemax', Math.round(safeMax).toString()); this.attribute(bar, 'aria-valuetext', label);
  }

  private text(element: HTMLElement, value: string): void { if (element.textContent !== value) element.textContent = value; }
  private attribute(element: HTMLElement, name: string, value: string): void { if (element.getAttribute(name) !== value) element.setAttribute(name, value); }
  private data(element: HTMLElement, name: string, value: string): void { if (element.dataset[name] !== value) element.dataset[name] = value; }
  private style(element: HTMLElement, property: string, value: string): void { if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value); }
  private announce(element: HTMLElement, message: string): void { element.textContent = ''; window.setTimeout(() => { element.textContent = message; }, 20); }
}
