import { RELICS, UPGRADES } from './config';
import { DISPLAY_STATE_EVENT, type DisplayState } from './display';
import { HudView, type HudState } from './hud';
import { formatTime } from './math';
import type { Player, Records, RunStats, Settings } from './model';
import type { StorageManager } from './storage';

export interface UIActions {
  startRun(): void; resume(): void; restart(): void; mainMenu(): void;
  chooseUpgrade(id: string): void; openCharacter(origin: 'running' | 'paused'): void;
  openSettings(origin: 'menu' | 'paused'): void; closeModal(): void; resetTutorials(): void;
}

export type LevelUpViewState = 'intro' | 'choosing' | 'committed' | 'exit';

const controls = `
  <div class="controls-grid">
    <span><kbd>WASD</kbd><b>Bewegen</b></span><span><kbd>Maus / Klick</kbd><b>Zielen / Angriff</b></span>
    <span><kbd>Leertaste</kbd><b>Angriff</b></span><span><kbd>Shift</kbd><b>Dash</b></span>
    <span><kbd>E</kbd><b>Interagieren</b></span><span><kbd>Q</kbd><b>Heiltrank</b></span>
    <span><kbd>C</kbd><b>Charakter</b></span><span><kbd>M</kbd><b>Karte</b></span><span><kbd>Esc</kbd><b>Pause</b></span>
  </div>`;

export class UI {
  private root = document.querySelector<HTMLDivElement>('#overlay-root')!;
  private hudView = new HudView();
  private currentOverlay = '';

  constructor(private store: StorageManager, private actions: UIActions) {
    document.querySelector<HTMLElement>('#app')?.addEventListener(DISPLAY_STATE_EVENT, this.handleDisplayState);
  }

  showStart(): void {
    this.setGameInert(true); this.hudView.hide(); this.currentOverlay = 'start';
    const r = this.store.records;
    this.root.innerHTML = `<section class="screen menu-screen">
      <div class="menu-embers"></div>
      <header class="menu-title-plaque"><div class="title-rune" aria-hidden="true"><span>RD</span></div><p class="eyebrow">DIE TIEFE ERWACHT</p>
      <h1>RUNE <em>DEEP</em></h1>
      <p class="lead">Ein schneller Dungeon-Brawler über Klingen, Schatten und den letzten Wächter.</p>
      <div class="menu-actions"><button id="start-button" class="primary">Dungeon betreten</button><button id="settings-button">Einstellungen</button></div></header>
      <div class="start-lower"><div><h3>Steuerung</h3>${controls}</div>
      <div class="records"><h3>Chronik</h3><span><b>${r.bestScore.toLocaleString('de-DE')}</b> Bestwert</span><span><b>${r.fastestWin ? formatTime(r.fastestWin) : '—'}</b> Schnellster Sieg</span><span><b>${r.mostKills}</b> Meiste Siege über Feinde</span><span><b>${r.victories}</b> Wächter bezwungen</span></div></div>
      <footer>PROZEDURALER DUNGEON · JEDER TOD SCHREIBT EINE NEUE GESCHICHTE</footer>
    </section>`;
    this.root.querySelector('#start-button')!.addEventListener('click', () => this.actions.startRun());
    this.root.querySelector('#settings-button')!.addEventListener('click', () => this.actions.openSettings('menu'));
    this.root.querySelector<HTMLButtonElement>('#start-button')!.focus();
  }

  beginGame(): void { this.setGameInert(false); this.root.innerHTML = ''; this.currentOverlay = ''; this.hudView.show(); }

  showPause(player: Player, focusCharacter = false): void {
    this.setGameInert(true); this.hudView.hideTransient();
    this.currentOverlay = 'pause';
    this.root.innerHTML = `<section class="screen dim"><div id="pause-dialog" class="panel pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabindex="-1"><div class="dialog-sigil" aria-hidden="true">II</div><p class="eyebrow">DIE ZEIT STEHT STILL</p><h2 id="pause-title">Pausiert</h2>
      <div class="pause-layout"><div class="pause-actions"><button id="resume" class="primary">Weiterkämpfen</button><button id="character">Charakter & Relikte</button><button id="settings">Einstellungen</button><button id="restart">Neuer Dungeon</button><button id="menu" class="quiet">Zum Hauptmenü</button></div><div><h3>Steuerung</h3>${controls}</div></div>
      <p class="small">Stufe ${player.level} · ${player.gold} Gold · ${player.relics.length} Relikte</p></div></section>`;
    this.root.querySelector('#resume')!.addEventListener('click', () => this.actions.resume());
    this.root.querySelector('#character')!.addEventListener('click', () => this.actions.openCharacter('paused'));
    this.root.querySelector('#settings')!.addEventListener('click', () => this.actions.openSettings('paused'));
    this.root.querySelector('#restart')!.addEventListener('click', () => this.actions.restart());
    this.root.querySelector('#menu')!.addEventListener('click', () => this.actions.mainMenu());
    this.focusDialog('#pause-dialog', focusCharacter ? '#character' : '#resume');
  }

  showCharacter(player: Player): void {
    this.setGameInert(true); this.hudView.hideTransient();
    this.currentOverlay = 'character';
    const stats = [
      ['Leben', `${Math.ceil(player.hp)} / ${player.maxHp}`], ['Schaden', player.damage.toFixed(0)],
      ['Angriffstempo', `${(1 / player.attackRate).toFixed(1)}/s`], ['Kritisch', `${Math.round(player.critChance * 100)} %`],
      ['Rüstung', player.armor.toFixed(0)], ['Tempo', player.speed.toFixed(0)], ['Reichweite', player.range.toFixed(0)], ['Lebensraub', `${Math.round(player.lifeSteal * 100)} %`]
    ];
    const upgrades = player.upgrades.map(id => UPGRADES.find(u => u.id === id)).filter(Boolean);
    const relics = player.relics.map(id => RELICS.find(r => r.id === id)).filter(Boolean);
    this.root.innerHTML = `<section class="screen dim character-screen"><div id="character-dialog" class="panel character-panel codex-panel" role="dialog" aria-modal="true" aria-labelledby="character-title" aria-describedby="character-hint" tabindex="-1">
      <header class="character-header"><div><p class="eyebrow">RUNENTRÄGER</p><h2 id="character-title">Charakter</h2></div><dl class="character-summary"><div><dt>Stufe</dt><dd>${player.level}</dd></div><div><dt>Leben</dt><dd>${Math.ceil(player.hp)} / ${player.maxHp} LP</dd></div><div><dt>Gold</dt><dd>${player.gold}</dd></div><div><dt>Heiltränke</dt><dd>${player.potions}</dd></div><div><dt>Runenschlüssel</dt><dd>${player.keys}</dd></div></dl><p class="resource-note">Gold erhöht deine Endwertung.</p></header>
      <div class="character-columns"><section class="codex-section"><h3>Werte</h3><dl class="stat-grid">${stats.map(([a,b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl></section>
      <section class="codex-section"><h3>Runensegen</h3><ul class="item-list">${upgrades.length ? upgrades.map(u => `<li><i aria-hidden="true">${u!.icon}</i><b>${u!.name}</b><small>${u!.description}</small></li>`).join('') : '<li class="empty">Noch keine Runensegen.</li>'}</ul></section>
      <section class="codex-section"><h3>Relikte</h3><ul class="item-list">${relics.length ? relics.map(r => `<li style="--item:${r!.color}"><i aria-hidden="true">${r!.icon}</i><b>${r!.name}</b><small>${r!.description}</small></li>`).join('') : '<li class="empty">Noch keine Relikte gefunden.</li>'}</ul></section></div>
      <footer class="dialog-footer"><p id="character-hint"><kbd>C</kbd>, <kbd>I</kbd> oder <kbd>Esc</kbd> schließen</p><button id="character-back" class="primary">Zurück</button></footer></div></section>`;
    this.root.querySelector('#character-back')!.addEventListener('click', () => this.actions.closeModal());
    this.focusDialog('#character-dialog');
  }

  showLevelUp(options: typeof UPGRADES[number][], level: number, state: LevelUpViewState = 'intro'): void {
    this.setGameInert(true); this.hudView.hideTransient();
    this.currentOverlay = 'level';
    const locked = state !== 'choosing';
    this.root.innerHTML = `<section id="level-dialog" class="screen dim level-screen" data-state="${state}" data-level="${level}" role="dialog" aria-modal="true" aria-labelledby="level-title" aria-describedby="level-hint" tabindex="-1"><div class="level-burst"></div><header class="level-heading"><p class="eyebrow">STUFE ${level} ERREICHT</p><h2 id="level-title">Wähle einen Runensegen</h2></header><div class="upgrade-cards">${options.map((u, i) => `<button type="button" class="upgrade-card" data-id="${u.id}" data-index="${i}" data-state="${locked ? 'locked' : 'available'}" aria-disabled="${locked}" ${locked ? 'disabled' : ''}><small>${i + 1}</small><i aria-hidden="true">${u.icon}</i><b>${u.name}</b><span>${u.description}</span></button>`).join('')}</div><p id="level-hint" class="small">Löse Angriff und Zahlentasten – dann wähle bewusst einen von drei Segen.</p></section>`;
    this.root.querySelectorAll<HTMLButtonElement>('.upgrade-card').forEach(button => button.addEventListener('click', () => this.actions.chooseUpgrade(button.dataset.id!)));
    this.focusDialog('#level-dialog');
  }

  setLevelUpState(state: LevelUpViewState, selectedId?: string): void {
    const dialog = this.root.querySelector<HTMLElement>('#level-dialog'); if (!dialog || this.currentOverlay !== 'level') return;
    dialog.dataset.state = state;
    dialog.querySelectorAll<HTMLButtonElement>('.upgrade-card').forEach(button => {
      const selected = Boolean(selectedId && button.dataset.id === selectedId); const enabled = state === 'choosing';
      button.disabled = !enabled; button.setAttribute('aria-disabled', String(!enabled));
      button.dataset.state = selected ? 'selected' : enabled ? 'available' : 'locked';
      button.classList.toggle('selected', selected); button.toggleAttribute('aria-pressed', selected);
    });
  }

  showMap(mapHtml: string): void {
    this.setGameInert(true); this.hudView.hideTransient();
    this.currentOverlay = 'map';
    this.root.innerHTML = `<section class="screen map-screen"><div id="map-dialog" class="panel map-panel" role="dialog" aria-modal="true" aria-labelledby="map-title" tabindex="-1"><p class="eyebrow">DIE TIEFE</p><h2 id="map-title">Dungeonkarte</h2>${mapHtml}<p class="map-hint">Der aktuelle Raum glimmt. Unbetretene Nachbarräume bleiben unbekannt.</p><button id="map-back" class="primary">Karte schließen <kbd>M</kbd></button></div></section>`;
    this.root.querySelector('#map-back')!.addEventListener('click', () => this.actions.closeModal());
    this.focusDialog('#map-dialog', '#map-back');
  }

  showEnd(victory: boolean, stats: RunStats, player: Player): void {
    this.setGameInert(true); this.hudView.hideTransient(); this.hudView.hide(); this.currentOverlay = 'end';
    const score = Math.floor(stats.kills * 110 + stats.goldFound * 9 + player.level * 300 + (victory ? 5000 : 0));
    this.root.innerHTML = `<section class="screen end-screen ${victory ? 'victory' : 'defeat'}"><div class="end-sigil">${victory ? '✦' : '☠'}</div><p class="eyebrow">${victory ? 'DIE TIEFE SCHWEIGT' : 'DIE TIEFE FORDERT IHR OPFER'}</p><h2>${victory ? 'Runenwächter bezwungen' : 'Du wurdest besiegt'}</h2><p class="lead">${victory ? 'Das Portal öffnet sich. Doch unter dem Stein regt sich bereits ein neuer Fluch.' : 'Deine Runen verblassen. Ein neuer Träger kann es erneut wagen.'}</p>
      <div class="result-score"><b>${score.toLocaleString('de-DE')}</b><span>PUNKTE</span></div>
      <div class="result-grid"><span><b>${formatTime(stats.elapsed)}</b>Zeit</span><span><b>${player.level}</b>Stufe</span><span><b>${stats.kills}</b>Feinde</span><span><b>${stats.goldFound}</b>Gold</span><span><b>${stats.roomsVisited}</b>Räume</span><span><b>${player.relics.length}</b>Relikte</span><span><b>${Math.ceil(player.hp)}</b>LP übrig</span><span><b>${stats.potionsUsed}</b>Tränke</span></div>
      <div class="menu-actions"><button id="again" class="primary">${victory ? 'Neuen Dungeon starten' : 'Erneut versuchen'}</button><button id="menu">Zum Hauptmenü</button></div></section>`;
    this.root.querySelector('#again')!.addEventListener('click', () => this.actions.restart());
    this.root.querySelector('#menu')!.addEventListener('click', () => this.actions.mainMenu());
    this.root.querySelector<HTMLButtonElement>('#again')!.focus();
  }

  showSettings(): void {
    this.setGameInert(true); this.hudView.hideTransient(); this.currentOverlay = 'settings'; const s = this.store.settings;
    const renderPresets: Array<[Settings['renderPreset'], string]> = [['auto', 'Automatisch (empfohlen)'], ['720p', '1280 × 720'], ['900p', '1600 × 900'], ['1080p', '1920 × 1080'], ['1440p', '2560 × 1440']];
    const uiScales: Array<[Settings['uiScale'], string]> = [[90, 'Kompakt · 90 %'], [100, 'Standard · 100 %'], [110, 'Groß · 110 %'], [125, 'Sehr groß · 125 %']];
    this.root.innerHTML = `<section class="screen dim"><div id="settings-dialog" class="panel settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1"><p class="eyebrow">ANZEIGE · BARRIEREFREIHEIT · AUDIO</p><h2 id="settings-title">Einstellungen</h2>
      <section class="settings-group"><h3>Anzeige</h3>
        <label>Renderauflösung <select data-key="renderPreset">${renderPresets.map(([value, label]) => `<option value="${value}" ${s.renderPreset === value ? 'selected' : ''}>${label}</option>`).join('')}</select><small>Die Spielwelt bleibt immer im stabilen 16:9-Format.</small></label>
        <label>UI-Größe <select data-key="uiScale">${uiScales.map(([value, label]) => `<option value="${value}" ${s.uiScale === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <div class="display-mode-actions" role="group" aria-label="Anzeigemodus"><button id="display-fit" type="button" aria-pressed="${s.displayMode === 'fit'}">Fenster ausfüllen</button><button id="display-fullscreen" type="button" aria-pressed="${s.displayMode === 'fullscreen'}">Vollbild</button></div>
      </section>
      <section class="settings-group"><h3>Audio</h3>
      <label>Gesamtlautstärke <output>${Math.round(s.master * 100)} %</output><input data-key="master" type="range" min="0" max="1" step=".05" value="${s.master}"></label>
      <label>Musik <output>${Math.round(s.music * 100)} %</output><input data-key="music" type="range" min="0" max="1" step=".05" value="${s.music}"></label>
      <label>Soundeffekte <output>${Math.round(s.sfx * 100)} %</output><input data-key="sfx" type="range" min="0" max="1" step=".05" value="${s.sfx}"></label>
      <label class="check"><input data-key="muted" type="checkbox" ${s.muted ? 'checked' : ''}><span>Ton stummschalten</span></label>
      </section><section class="settings-group"><h3>Lesbarkeit & Effekte</h3>
      <label class="check"><input data-key="shake" type="checkbox" ${s.shake ? 'checked' : ''}><span>Bildschirmerschütterung</span></label>
      <label class="check"><input data-key="reducedEffects" type="checkbox" ${s.reducedEffects ? 'checked' : ''}><span>Reduzierte Effekte</span></label>
      <label class="check"><input data-key="tutorialHints" type="checkbox" ${s.tutorialHints ? 'checked' : ''}><span>Kontextabhängige Spielhinweise</span></label>
      <button id="tutorial-reset" class="quiet" type="button">Spielhinweise zurücksetzen</button></section>
      <button id="settings-back" class="primary">Übernehmen & zurück</button></div></section>`;
    this.syncDisplayControls(document.fullscreenElement === document.querySelector('#app'));
    this.root.querySelectorAll<HTMLInputElement>('input').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.key as keyof Settings;
      if (input.type === 'range') { (this.store.settings[key] as number) = Number(input.value); input.parentElement!.querySelector('output')!.textContent = `${Math.round(Number(input.value) * 100)} %`; }
      else (this.store.settings[key] as boolean) = input.checked;
      this.store.save(); window.dispatchEvent(new CustomEvent('rune-settings'));
    }));
    this.root.querySelectorAll<HTMLSelectElement>('select[data-key]').forEach(select => select.addEventListener('change', () => {
      if (select.dataset.key === 'renderPreset') this.store.settings.renderPreset = select.value as Settings['renderPreset'];
      else if (select.dataset.key === 'uiScale') this.store.settings.uiScale = Number(select.value) as Settings['uiScale'];
      this.store.save(); window.dispatchEvent(new CustomEvent('rune-settings'));
    }));
    this.root.querySelector('#display-fit')!.addEventListener('click', () => window.dispatchEvent(new CustomEvent('rune-display-mode-request', { detail: { mode: 'fit' } })));
    this.root.querySelector('#display-fullscreen')!.addEventListener('click', () => window.dispatchEvent(new CustomEvent('rune-display-mode-request', { detail: { mode: 'fullscreen' } })));
    this.root.querySelector('#tutorial-reset')!.addEventListener('click', () => {
      this.actions.resetTutorials();
      const button = this.root.querySelector<HTMLButtonElement>('#tutorial-reset')!;
      button.textContent = 'Spielhinweise zurückgesetzt'; button.disabled = true;
      this.hudView.announceStatus('Spielhinweise wurden zurückgesetzt und erscheinen beim nächsten Dungeon erneut.');
    });
    this.root.querySelector('#settings-back')!.addEventListener('click', () => this.actions.closeModal());
    this.focusDialog('#settings-dialog', 'select, input');
  }

  updateHud(state: HudState): void { this.hudView.update(state); }

  toast(text: string, tone: 'normal' | 'good' | 'danger' = 'normal'): void {
    const stack = document.querySelector<HTMLDivElement>('#toast-stack')!; if (!stack) return;
    const item = document.createElement('div'); item.className = `toast ${tone}`; item.textContent = text; stack.append(item);
    if (tone === 'danger') this.hudView.announceAlert(text); else this.hudView.announceStatus(text);
    window.setTimeout(() => item.remove(), 2600);
  }

  isOverlay(name?: string): boolean { return name ? this.currentOverlay === name : Boolean(this.currentOverlay); }
  clearOverlay(): void { this.setGameInert(false); this.currentOverlay = ''; this.root.innerHTML = ''; }
  get records(): Records { return this.store.records; }

  private focusDialog(dialogSelector: string, preferredSelector?: string): void {
    const dialog = this.root.querySelector<HTMLElement>(dialogSelector); if (!dialog) return;
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden);
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return; const items = focusables(); if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0]!; const last = items.at(-1)!;
      if (document.activeElement === dialog) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    (preferredSelector ? dialog.querySelector<HTMLElement>(preferredSelector) ?? dialog : dialog).focus();
  }

  private handleDisplayState = (event: Event): void => {
    const state = (event as CustomEvent<DisplayState>).detail;
    if (this.currentOverlay === 'settings' && state) this.syncDisplayControls(state.fullscreen);
  };

  private syncDisplayControls(fullscreen: boolean): void {
    this.root.querySelector('#display-fit')?.setAttribute('aria-pressed', String(!fullscreen));
    this.root.querySelector('#display-fullscreen')?.setAttribute('aria-pressed', String(fullscreen));
  }

  private setGameInert(value: boolean): void { document.querySelector<HTMLElement>('#hud')?.toggleAttribute('inert', value); }
}
