import { RELICS, UPGRADES } from './config';
import { formatTime } from './math';
import type { Enemy, Player, Records, RunStats, Settings } from './model';
import type { StorageManager } from './storage';

export interface UIActions {
  startRun(): void; resume(): void; restart(): void; mainMenu(): void;
  chooseUpgrade(id: string): void;
}

const controls = `
  <div class="controls-grid">
    <span><kbd>WASD</kbd><b>Bewegen</b></span><span><kbd>Maus / Klick</kbd><b>Zielen / Angriff</b></span>
    <span><kbd>Leertaste</kbd><b>Angriff</b></span><span><kbd>Shift</kbd><b>Dash</b></span>
    <span><kbd>E</kbd><b>Interagieren</b></span><span><kbd>Q</kbd><b>Heiltrank</b></span>
    <span><kbd>I</kbd><b>Charakter</b></span><span><kbd>M</kbd><b>Karte</b></span><span><kbd>Esc</kbd><b>Pause</b></span>
  </div>`;

export class UI {
  private root = document.querySelector<HTMLDivElement>('#overlay-root')!;
  private hud = document.querySelector<HTMLDivElement>('#hud')!;
  private currentOverlay = '';

  constructor(private store: StorageManager, private actions: UIActions) {}

  showStart(): void {
    this.hud.classList.add('hidden'); this.currentOverlay = 'start';
    const r = this.store.records;
    this.root.innerHTML = `<section class="screen menu-screen">
      <div class="menu-embers"></div>
      <div class="title-rune">ᚱ</div><p class="eyebrow">DIE TIEFE ERWACHT</p>
      <h1>RUNE <em>DEEP</em></h1>
      <p class="lead">Ein schneller Dungeon-Brawler über Klingen, Schatten und den letzten Wächter.</p>
      <div class="menu-actions"><button id="start-button" class="primary">Dungeon betreten</button><button id="settings-button">Einstellungen</button></div>
      <div class="start-lower"><div><h3>Steuerung</h3>${controls}</div>
      <div class="records"><h3>Chronik</h3><span><b>${r.bestScore.toLocaleString('de-DE')}</b> Bestwert</span><span><b>${r.fastestWin ? formatTime(r.fastestWin) : '—'}</b> Schnellster Sieg</span><span><b>${r.mostKills}</b> Meiste Siege über Feinde</span><span><b>${r.victories}</b> Wächter bezwungen</span></div></div>
      <footer>PROZEDURALER DUNGEON · JEDER TOD SCHREIBT EINE NEUE GESCHICHTE</footer>
    </section>`;
    this.root.querySelector('#start-button')!.addEventListener('click', () => this.actions.startRun());
    this.root.querySelector('#settings-button')!.addEventListener('click', () => this.showSettings('start'));
  }

  beginGame(): void { this.root.innerHTML = ''; this.currentOverlay = ''; this.hud.classList.remove('hidden'); }

  showPause(player: Player): void {
    this.currentOverlay = 'pause';
    this.root.innerHTML = `<section class="screen dim"><div class="panel pause-panel"><p class="eyebrow">DIE ZEIT STEHT STILL</p><h2>Pausiert</h2>
      <div class="pause-layout"><div class="pause-actions"><button id="resume" class="primary">Weiterkämpfen</button><button id="character">Charakter & Relikte</button><button id="settings">Einstellungen</button><button id="restart">Neuer Dungeon</button><button id="menu" class="quiet">Zum Hauptmenü</button></div><div><h3>Steuerung</h3>${controls}</div></div>
      <p class="small">Stufe ${player.level} · ${player.gold} Gold · ${player.relics.length} Relikte</p></div></section>`;
    this.root.querySelector('#resume')!.addEventListener('click', () => this.actions.resume());
    this.root.querySelector('#character')!.addEventListener('click', () => this.showCharacter(player, 'pause'));
    this.root.querySelector('#settings')!.addEventListener('click', () => this.showSettings('pause', player));
    this.root.querySelector('#restart')!.addEventListener('click', () => this.actions.restart());
    this.root.querySelector('#menu')!.addEventListener('click', () => this.actions.mainMenu());
  }

  showCharacter(player: Player, back: 'game' | 'pause' = 'game'): void {
    this.currentOverlay = 'character';
    const stats = [
      ['Leben', `${Math.ceil(player.hp)} / ${player.maxHp}`], ['Schaden', player.damage.toFixed(0)],
      ['Angriffstempo', `${(1 / player.attackRate).toFixed(1)}/s`], ['Kritisch', `${Math.round(player.critChance * 100)} %`],
      ['Rüstung', player.armor.toFixed(0)], ['Tempo', player.speed.toFixed(0)], ['Reichweite', player.range.toFixed(0)], ['Lebensraub', `${Math.round(player.lifeSteal * 100)} %`]
    ];
    const upgrades = player.upgrades.map(id => UPGRADES.find(u => u.id === id)).filter(Boolean);
    const relics = player.relics.map(id => RELICS.find(r => r.id === id)).filter(Boolean);
    this.root.innerHTML = `<section class="screen dim"><div class="panel character-panel"><p class="eyebrow">RUNENTRÄGER · STUFE ${player.level}</p><h2>Charakter</h2>
      <div class="character-columns"><div><h3>Werte</h3><div class="stat-grid">${stats.map(([a,b]) => `<span>${a}<b>${b}</b></span>`).join('')}</div></div>
      <div><h3>Verbesserungen</h3><div class="item-list">${upgrades.length ? upgrades.map(u => `<span><i>${u!.icon}</i><b>${u!.name}</b><small>${u!.description}</small></span>`).join('') : '<p class="empty">Noch keine Runensegen.</p>'}</div></div>
      <div><h3>Relikte</h3><div class="item-list">${relics.length ? relics.map(r => `<span style="--item:${r!.color}"><i>${r!.icon}</i><b>${r!.name}</b><small>${r!.description}</small></span>`).join('') : '<p class="empty">Noch keine Relikte gefunden.</p>'}</div></div></div>
      <button id="back" class="primary">Zurück</button></div></section>`;
    this.root.querySelector('#back')!.addEventListener('click', () => back === 'pause' ? this.showPause(player) : this.actions.resume());
  }

  showLevelUp(options: typeof UPGRADES[number][], level: number): void {
    this.currentOverlay = 'level';
    this.root.innerHTML = `<section class="screen dim level-screen"><div class="level-burst"></div><p class="eyebrow">STUFE ${level} ERREICHT</p><h2>Wähle einen Runensegen</h2><div class="upgrade-cards">${options.map((u, i) => `<button class="upgrade-card" data-id="${u.id}"><small>${i + 1}</small><i>${u.icon}</i><b>${u.name}</b><span>${u.description}</span></button>`).join('')}</div><p class="small">Die Welt wartet, solange du wählst.</p></section>`;
    this.root.querySelectorAll<HTMLButtonElement>('.upgrade-card').forEach(button => button.addEventListener('click', () => this.actions.chooseUpgrade(button.dataset.id!)));
  }

  showMap(mapHtml: string): void {
    this.currentOverlay = 'map';
    this.root.innerHTML = `<section class="screen map-screen"><div class="panel map-panel"><p class="eyebrow">DIE TIEFE</p><h2>Dungeonkarte</h2>${mapHtml}<p>Aktueller Raum pulsiert · Symbole erscheinen nach ihrer Entdeckung</p><button id="map-back" class="primary">Karte schließen <kbd>M</kbd></button></div></section>`;
    this.root.querySelector('#map-back')!.addEventListener('click', () => this.actions.resume());
  }

  showEnd(victory: boolean, stats: RunStats, player: Player): void {
    this.hud.classList.add('hidden'); this.currentOverlay = 'end';
    const score = Math.floor(stats.kills * 110 + stats.goldFound * 9 + player.level * 300 + (victory ? 5000 : 0));
    this.root.innerHTML = `<section class="screen end-screen ${victory ? 'victory' : 'defeat'}"><div class="end-sigil">${victory ? '✦' : '☠'}</div><p class="eyebrow">${victory ? 'DIE TIEFE SCHWEIGT' : 'DIE TIEFE FORDERT IHR OPFER'}</p><h2>${victory ? 'Runenwächter bezwungen' : 'Du wurdest besiegt'}</h2><p class="lead">${victory ? 'Das Portal öffnet sich. Doch unter dem Stein regt sich bereits ein neuer Fluch.' : 'Deine Runen verblassen. Ein neuer Träger kann es erneut wagen.'}</p>
      <div class="result-score"><b>${score.toLocaleString('de-DE')}</b><span>PUNKTE</span></div>
      <div class="result-grid"><span><b>${formatTime(stats.elapsed)}</b>Zeit</span><span><b>${player.level}</b>Stufe</span><span><b>${stats.kills}</b>Feinde</span><span><b>${stats.goldFound}</b>Gold</span><span><b>${stats.roomsVisited}</b>Räume</span><span><b>${player.relics.length}</b>Relikte</span><span><b>${Math.ceil(player.hp)}</b>LP übrig</span><span><b>${stats.potionsUsed}</b>Tränke</span></div>
      <div class="menu-actions"><button id="again" class="primary">${victory ? 'Neuen Dungeon starten' : 'Erneut versuchen'}</button><button id="menu">Zum Hauptmenü</button></div></section>`;
    this.root.querySelector('#again')!.addEventListener('click', () => this.actions.restart());
    this.root.querySelector('#menu')!.addEventListener('click', () => this.actions.mainMenu());
  }

  private showSettings(back: 'start' | 'pause', player?: Player): void {
    this.currentOverlay = 'settings'; const s = this.store.settings;
    this.root.innerHTML = `<section class="screen dim"><div class="panel settings-panel"><p class="eyebrow">BARRIEREFREIHEIT & AUDIO</p><h2>Einstellungen</h2>
      <label>Gesamtlautstärke <output>${Math.round(s.master * 100)} %</output><input data-key="master" type="range" min="0" max="1" step=".05" value="${s.master}"></label>
      <label>Musik <output>${Math.round(s.music * 100)} %</output><input data-key="music" type="range" min="0" max="1" step=".05" value="${s.music}"></label>
      <label>Soundeffekte <output>${Math.round(s.sfx * 100)} %</output><input data-key="sfx" type="range" min="0" max="1" step=".05" value="${s.sfx}"></label>
      <label class="check"><input data-key="muted" type="checkbox" ${s.muted ? 'checked' : ''}><span>Ton stummschalten</span></label>
      <label class="check"><input data-key="shake" type="checkbox" ${s.shake ? 'checked' : ''}><span>Bildschirmerschütterung</span></label>
      <label class="check"><input data-key="reducedEffects" type="checkbox" ${s.reducedEffects ? 'checked' : ''}><span>Reduzierte Effekte</span></label>
      <button id="settings-back" class="primary">Übernehmen & zurück</button></div></section>`;
    this.root.querySelectorAll<HTMLInputElement>('input').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.key as keyof Settings;
      if (input.type === 'range') { (this.store.settings[key] as number) = Number(input.value); input.parentElement!.querySelector('output')!.textContent = `${Math.round(Number(input.value) * 100)} %`; }
      else (this.store.settings[key] as boolean) = input.checked;
      this.store.save(); window.dispatchEvent(new CustomEvent('rune-settings'));
    }));
    this.root.querySelector('#settings-back')!.addEventListener('click', () => back === 'start' ? this.showStart() : this.showPause(player!));
  }

  updateHud(player: Player, roomLabel: string, objective: string, boss?: Enemy): void {
    const setWidth = (id: string, ratio: number) => { const el = document.querySelector<HTMLElement>(id); if (el) el.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`; };
    setWidth('#health-fill', player.hp / player.maxHp); setWidth('#xp-fill', player.xp / player.xpNeeded);
    document.querySelector('#health-text')!.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    document.querySelector('#xp-text')!.textContent = `${player.xp} / ${player.xpNeeded} EP`;
    document.querySelector('#level-text')!.textContent = `STUFE ${player.level}`;
    document.querySelector('#gold-text')!.textContent = `◈ ${player.gold}`;
    document.querySelector('#potion-text')!.textContent = `✚ ${player.potions}`;
    document.querySelector('#room-title')!.textContent = roomLabel; document.querySelector('#objective')!.textContent = objective;
    const dash = document.querySelector<HTMLDivElement>('#dash-indicator')!; dash.classList.toggle('ready', player.dashCdTimer <= 0);
    dash.querySelector<HTMLElement>('i')!.style.setProperty('--cooldown', `${Math.max(0, Math.min(1, 1 - player.dashCdTimer / player.dashCooldown)) * 100}%`);
    const effects = document.querySelector('#effects')!; effects.textContent = [player.damageBuff > 0 ? `⚔ ${Math.ceil(player.damageBuff)}s` : '', player.speedBuff > 0 ? `➶ ${Math.ceil(player.speedBuff)}s` : '', player.shield > 0 ? `⬢ ${Math.ceil(player.shield)}` : ''].filter(Boolean).join('  ');
    const bossHud = document.querySelector<HTMLDivElement>('#boss-hud')!; bossHud.classList.toggle('hidden', !boss || boss.state === 'dead');
    if (boss) setWidth('#boss-fill', boss.hp / boss.maxHp);
  }

  toast(text: string, tone: 'normal' | 'good' | 'danger' = 'normal'): void {
    const stack = document.querySelector<HTMLDivElement>('#toast-stack')!; if (!stack) return;
    const item = document.createElement('div'); item.className = `toast ${tone}`; item.textContent = text; stack.append(item);
    window.setTimeout(() => item.remove(), 2600);
  }

  isOverlay(name?: string): boolean { return name ? this.currentOverlay === name : Boolean(this.currentOverlay); }
  clearOverlay(): void { this.currentOverlay = ''; this.root.innerHTML = ''; }
  get records(): Records { return this.store.records; }
}
