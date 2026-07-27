import { RELICS, UPGRADES } from './config';
import { ASSET_MANIFEST, UPGRADE_SIGIL_PATHS } from './assets';
import { DISPLAY_STATE_EVENT, type DisplayState } from './display';
import { HudView, type HudState } from './hud';
import { compareItem, itemById, offerAvailability, type LydiaShopState } from './items';
import { formatTime } from './math';
import type { Player, Records, RunStats, Settings } from './model';
import type { StorageManager } from './storage';

export interface UIActions {
  startRun(): void; resume(): void; restart(): void; mainMenu(): void;
  chooseUpgrade(id: string): void; rerollUpgrades(): void; openCharacter(origin: 'running' | 'paused'): void;
  openSettings(origin: 'menu' | 'paused'): void; closeModal(): void; resetTutorials(): void; activateShopOffer(instanceId: string): void;
}

export type LevelUpViewState = 'intro' | 'choosing' | 'rerolling' | 'revealing' | 'committed' | 'exit';
export interface LevelRerollView { gold: number; cost: number; affordable: boolean }

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
      <header class="menu-title-plaque">
      <div class="brand-lockup" aria-label="Runedeep: Beneath the Broken Crown">
        <img class="brand-crest" src="${ASSET_MANIFEST.brandCrest.path}" alt="" aria-hidden="true">
        <div class="brand-wordmark"><p class="eyebrow">DIE TIEFE ERWACHT</p><h1><span>RUNE</span><em>DEEP</em></h1><p class="brand-subtitle">BENEATH THE BROKEN CROWN</p></div>
      </div>
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

  showAssetLoading(): void {
    this.setGameInert(true); this.hudView.hide(); this.currentOverlay = 'loading';
    this.root.innerHTML = `<section class="screen dim asset-loading-screen" role="status" aria-live="polite"><div class="asset-loading-rune" aria-hidden="true"><img src="${ASSET_MANIFEST.brandMark256.path}" alt=""></div><p class="eyebrow">DIE TIEFE FORMT SICH</p><h2>Runen und Schatten werden gebunden</h2><div class="asset-loading-bar" aria-hidden="true"><i></i></div><p class="small">Die Kerkerbilder werden vollständig geladen, bevor dein Lauf beginnt.</p></section>`;
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
    const equipment = Object.values(player.equipment ?? {}).map(id => id ? itemById(id) : undefined).filter(Boolean);
    this.root.innerHTML = `<section class="screen dim character-screen"><div id="character-dialog" class="panel character-panel codex-panel" role="dialog" aria-modal="true" aria-labelledby="character-title" aria-describedby="character-hint" tabindex="-1">
      <header class="character-header"><div><p class="eyebrow">RUNENTRÄGER</p><h2 id="character-title">Charakter</h2></div><dl class="character-summary"><div><dt>Stufe</dt><dd>${player.level}</dd></div><div><dt>Leben</dt><dd>${Math.ceil(player.hp)} / ${player.maxHp} LP</dd></div><div><dt>Gold</dt><dd>${player.gold}</dd></div><div><dt>Heiltränke</dt><dd>${player.potions}</dd></div><div><dt>Runenschlüssel</dt><dd>${player.keys}</dd></div></dl><p class="resource-note">Gold schmiedet beim Stufenaufstieg neue Runensegen und erhöht deine Endwertung.</p></header>
      <div class="character-columns"><section class="codex-section"><h3>Werte</h3><dl class="stat-grid">${stats.map(([a,b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl></section>
      <section class="codex-section"><h3>Ausrüstung</h3><ul class="item-list">${equipment.length ? equipment.map(item => `<li><img class="character-item-icon" src="${ASSET_MANIFEST[item!.asset].path}" alt=""><b>${item!.name}</b><small>${item!.description}</small></li>`).join('') : '<li class="empty">Runenschwert und Runenträgergewand.</li>'}</ul></section>
      <section class="codex-section"><h3>Runensegen</h3><ul class="item-list">${upgrades.length ? upgrades.map(u => `<li>${this.upgradeSigilMarkup(u!.id, u!.icon, true)}<b>${u!.name}</b><small>${u!.description}</small></li>`).join('') : '<li class="empty">Noch keine Runensegen.</li>'}</ul></section>
      <section class="codex-section"><h3>Relikte</h3><ul class="item-list">${relics.length ? relics.map(r => `<li style="--item:${r!.color}"><i aria-hidden="true">${r!.icon}</i><b>${r!.name}</b><small>${r!.description}</small></li>`).join('') : '<li class="empty">Noch keine Relikte gefunden.</li>'}</ul></section></div>
      <footer class="dialog-footer"><p id="character-hint"><kbd>C</kbd>, <kbd>I</kbd> oder <kbd>Esc</kbd> schließen</p><button id="character-back" class="primary">Zurück</button></footer></div></section>`;
    this.root.querySelector('#character-back')!.addEventListener('click', () => this.actions.closeModal());
    this.focusDialog('#character-dialog');
  }

  showShop(shop: LydiaShopState, player: Player, message = ''): void {
    this.setGameInert(true); this.hudView.hideTransient(); this.currentOverlay = 'shop';
    const category = { weapon: 'Waffe', armor: 'Rüstung', consumable: 'Vorrat' } as const;
    const rarity = { common: 'Gewöhnlich', uncommon: 'Ungewöhnlich' } as const;
    const offers = shop.stock.map(entry => {
      const item = itemById(entry.itemId); const availability = offerAvailability(player, entry); const comparisons = compareItem(player, item.id);
      const equipped = Boolean(item.slot && player.equipment[item.slot] === item.id);
      const state = entry.purchased ? equipped ? 'equipped' : item.slot ? 'owned' : 'sold' : availability.action === 'blocked' ? 'blocked' : 'available';
      const comparisonMarkup = comparisons.length
        ? `<dl class="shop-comparison">${comparisons.map(stat => `<div data-direction="${stat.delta > 0 ? 'up' : 'down'}"><dt>${stat.label}</dt><dd><span>${stat.before}</span><i aria-hidden="true">→</i><strong>${stat.after}</strong></dd></div>`).join('')}</dl>`
        : `<p class="shop-effect">${item.effect === 'bandage' ? 'Heilt unmittelbar 30 LP.' : item.effect === 'potion' ? '+1 Heiltrank für deinen Gürtel.' : item.description}</p>`;
      const disabled = availability.action === 'blocked';
      return `<article class="shop-offer" data-state="${state}">
        <div class="shop-item-art"><img src="${ASSET_MANIFEST[item.asset].path}" alt=""></div>
        <div class="shop-item-heading"><span>${category[item.category]} · ${rarity[item.rarity]}</span><h3>${item.name}</h3></div>
        <p>${item.description}</p>${comparisonMarkup}
        <div class="shop-price"><img src="${ASSET_MANIFEST.pickupGold.path}" alt="" aria-hidden="true"><strong>${item.price}</strong><span>Gold</span></div>
        <button type="button" data-shop-offer="${entry.instanceId}" ${disabled ? 'disabled' : ''} aria-disabled="${disabled}" title="${availability.reason ?? availability.label}">${availability.label}</button>
        ${entry.purchased ? `<b class="shop-stamp">${equipped ? 'Ausgerüstet' : item.slot ? 'Im Besitz' : 'Verkauft'}</b>` : ''}
        ${availability.reason ? `<small class="shop-block-reason">${availability.reason}</small>` : ''}
      </article>`;
    }).join('');
    this.root.innerHTML = `<section class="screen dim shop-screen" data-reduced-effects="${this.store.settings.reducedEffects}">
      <div id="shop-dialog" class="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shop-title" aria-describedby="shop-greeting shop-feedback" tabindex="-1">
        <header class="shop-header">
          <div class="shop-portrait" aria-hidden="true"><img src="${ASSET_MANIFEST.shopLydia.path}" alt=""></div>
          <div><p class="eyebrow">HÜTERIN DER LETZTEN ESSE</p><h2 id="shop-title">Lydias Waren</h2><p id="shop-greeting">„Nimm, was dich lebend wieder nach oben bringt.“</p></div>
          <div class="shop-wallet" aria-label="${player.gold} Gold"><img src="${ASSET_MANIFEST.pickupGold.path}" alt="" aria-hidden="true"><strong>${player.gold}</strong><span>Gold</span></div>
        </header>
        <div class="shop-offers" aria-label="Lydias Angebote">${offers}</div>
        <footer class="shop-footer"><p id="shop-feedback" role="status" aria-live="polite"></p><span>Nur Kauf · kein Verkauf</span><button id="shop-back" type="button">Lydias Esse verlassen <kbd>Esc</kbd></button></footer>
      </div>
    </section>`;
    const feedback = this.root.querySelector<HTMLElement>('#shop-feedback'); if (feedback) feedback.textContent = message;
    this.root.querySelectorAll<HTMLButtonElement>('[data-shop-offer]').forEach(button => button.addEventListener('click', () => this.actions.activateShopOffer(button.dataset.shopOffer!)));
    this.root.querySelector('#shop-back')!.addEventListener('click', () => this.actions.closeModal());
    this.focusDialog('#shop-dialog', '[data-shop-offer]:not(:disabled)');
  }

  showLevelUp(options: typeof UPGRADES[number][], level: number, state: LevelUpViewState, reroll: LevelRerollView): void {
    this.setGameInert(true); this.hudView.hideTransient();
    this.currentOverlay = 'level';
    const locked = state !== 'choosing';
    this.root.innerHTML = `<section id="level-dialog" class="screen dim level-screen" data-state="${state}" data-level="${level}" data-reduced-effects="${this.store.settings.reducedEffects}" role="dialog" aria-modal="true" aria-labelledby="level-title" aria-describedby="level-hint level-reroll-feedback" tabindex="-1"><div class="level-burst"></div><header class="level-heading"><p class="eyebrow">STUFE ${level} ERREICHT</p><h2 id="level-title">Wähle einen Runensegen</h2></header><div class="upgrade-cards">${this.levelCardsMarkup(options, locked)}</div>${this.levelRerollMarkup(reroll, locked)}<p id="level-hint" class="small">Löse Angriff und Zahlentasten – dann wähle mit <kbd>1</kbd>–<kbd>3</kbd> oder schmiede mit <kbd>R</kbd> das Schicksal neu.</p></section>`;
    this.bindLevelCardActions(); this.bindLevelRerollAction();
    this.focusDialog('#level-dialog');
  }

  replaceLevelUpOptions(options: typeof UPGRADES[number][]): void {
    const cards = this.root.querySelector<HTMLElement>('.upgrade-cards');
    if (!cards || this.currentOverlay !== 'level') return;
    cards.innerHTML = this.levelCardsMarkup(options, true);
    cards.dataset.rerolled = 'true';
    this.bindLevelCardActions();
  }

  updateLevelReroll(view: LevelRerollView, locked = false): void {
    const button = this.root.querySelector<HTMLButtonElement>('#level-reroll');
    if (!button || this.currentOverlay !== 'level') return;
    const gold = this.root.querySelector<HTMLElement>('#level-gold'); const price = this.root.querySelector<HTMLElement>('#level-reroll-price');
    if (gold) gold.textContent = view.gold.toString(); if (price) price.textContent = view.cost.toString();
    button.dataset.affordable = String(view.affordable); button.dataset.state = locked ? 'locked' : view.affordable ? 'available' : 'poor';
    button.disabled = locked; button.setAttribute('aria-disabled', String(locked || !view.affordable));
    button.title = view.affordable ? `Drei neue Runensegen für ${view.cost} Gold` : 'Die Münzen reichen nicht, um das Schicksal zu beugen.';
    if (!locked) this.setLevelRerollFeedback(view.affordable ? 'Jeder weitere Ruf an die Runen wird kostspieliger.' : 'Berühre die Rune, um ihren Preis zu erfahren.', false);
  }

  showLevelRerollMessage(message: string): void {
    this.setLevelRerollFeedback(message, true); this.hudView.announceAlert(message);
  }

  setLevelUpState(state: LevelUpViewState, selectedId?: string): void {
    const dialog = this.root.querySelector<HTMLElement>('#level-dialog'); if (!dialog || this.currentOverlay !== 'level') return;
    dialog.dataset.state = state;
    const enabled = state === 'choosing';
    dialog.querySelectorAll<HTMLButtonElement>('.upgrade-card').forEach(button => {
      const selected = Boolean(selectedId && button.dataset.id === selectedId);
      button.disabled = !enabled; button.setAttribute('aria-disabled', String(!enabled));
      button.dataset.state = selected ? 'selected' : enabled ? 'available' : 'locked';
      button.classList.toggle('selected', selected); button.toggleAttribute('aria-pressed', selected);
    });
    const reroll = dialog.querySelector<HTMLButtonElement>('#level-reroll');
    if (reroll) {
      const affordable = reroll.dataset.affordable === 'true'; reroll.disabled = !enabled;
      reroll.setAttribute('aria-disabled', String(!enabled || !affordable)); reroll.dataset.state = enabled ? affordable ? 'available' : 'poor' : 'locked';
    }
  }

  private levelCardsMarkup(options: typeof UPGRADES[number][], locked: boolean): string {
    return options.map((u, i) => `<button type="button" class="upgrade-card" data-id="${u.id}" data-index="${i}" data-state="${locked ? 'locked' : 'available'}" aria-disabled="${locked}" ${locked ? 'disabled' : ''}><small>${i + 1}</small>${this.upgradeSigilMarkup(u.id, u.icon)}<b>${u.name}</b><span>${u.description}</span></button>`).join('');
  }

  private upgradeSigilMarkup(id: typeof UPGRADES[number]['id'], fallback: string, small = false): string {
    return `<i class="upgrade-sigil${small ? ' upgrade-sigil-small' : ''}" style="--upgrade-sigil:url(${UPGRADE_SIGIL_PATHS[id]})" aria-hidden="true"><span>${fallback}</span></i>`;
  }

  private levelRerollMarkup(view: LevelRerollView, locked: boolean): string {
    const unavailable = locked || !view.affordable;
    return `<div class="level-reroll"><div class="level-wallet" aria-label="${view.gold} Gold"><img src="/assets/gameplay/generated/collectables/pickup-gold.png" alt="" aria-hidden="true"><b id="level-gold">${view.gold}</b><small>Gold</small></div><button id="level-reroll" type="button" data-affordable="${view.affordable}" data-state="${locked ? 'locked' : view.affordable ? 'available' : 'poor'}" aria-disabled="${unavailable}" ${locked ? 'disabled' : ''} title="${view.affordable ? `Drei neue Runensegen für ${view.cost} Gold` : 'Die Münzen reichen nicht, um das Schicksal zu beugen.'}"><i class="fate-rune" aria-hidden="true">ᚱ</i><span>Schicksal neu schmieden</span><strong><img src="/assets/gameplay/generated/collectables/pickup-gold.png" alt="" aria-hidden="true"> <span id="level-reroll-price">${view.cost}</span></strong><kbd>R</kbd></button><p id="level-reroll-feedback" aria-live="polite">Jeder weitere Ruf an die Runen wird kostspieliger.</p></div>`;
  }

  private bindLevelCardActions(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.upgrade-card').forEach(button => button.addEventListener('click', () => this.actions.chooseUpgrade(button.dataset.id!)));
  }

  private bindLevelRerollAction(): void {
    const button = this.root.querySelector<HTMLButtonElement>('#level-reroll'); if (!button) return;
    button.addEventListener('click', () => this.actions.rerollUpgrades());
    const showPoorHint = () => {
      if (!button.disabled && button.dataset.affordable !== 'true') this.setLevelRerollFeedback('Die Münzen reichen nicht, um das Schicksal zu beugen.', true);
    };
    button.addEventListener('pointerenter', showPoorHint); button.addEventListener('focus', showPoorHint);
  }

  private setLevelRerollFeedback(message: string, danger: boolean): void {
    const feedback = this.root.querySelector<HTMLElement>('#level-reroll-feedback'); if (!feedback) return;
    feedback.textContent = message; feedback.classList.toggle('danger', danger);
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
    const summary = [
      { label: 'Zeit', value: formatTime(stats.elapsed), asset: 'upgradeDash' },
      { label: 'Stufe', value: player.level, asset: 'upgradeVitality' },
      { label: 'Feinde', value: stats.kills, asset: 'vfxSlash' },
      { label: 'Gold', value: stats.goldFound, asset: 'pickupGold' },
      { label: 'Räume', value: stats.roomsVisited, asset: 'pickupKey' },
      { label: 'Relikte', value: player.relics.length, asset: 'pickupRelic' },
      { label: 'LP übrig', value: Math.max(0, Math.ceil(player.hp)), asset: 'pickupHeal' },
      { label: 'Tränke', value: stats.potionsUsed, asset: 'pickupPotion' }
    ] as const;
    this.root.innerHTML = `<section class="screen dim end-screen ${victory ? 'victory' : 'defeat'}" data-outcome="${victory ? 'victory' : 'defeat'}">
      <div id="end-dialog" class="end-panel" role="dialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-lead" tabindex="-1">
        <div class="end-chronicle">
          <aside class="end-tableau" aria-hidden="true"><div class="end-figure"></div><img class="end-seal" src="${ASSET_MANIFEST[victory ? 'vfxBossRune' : 'vfxCrit'].path}" alt=""><span>${victory ? 'ERSTE TIEFE · BEZWUNGEN' : 'EXPEDITION · BEENDET'}</span></aside>
          <div class="end-copy">
            <p class="eyebrow">${victory ? 'DIE ERSTE TIEFE SCHWEIGT' : 'DIE TIEFE FORDERT IHREN ZOLL'}</p>
            <h2 id="end-title">${victory ? 'Runenwächter bezwungen' : 'Die Runen erlöschen'}</h2>
            <p id="end-lead" class="lead">${victory ? 'Der Wächter ist gefallen und das erste Siegel zerbrochen. Unter der Krone wartet jedoch eine noch ältere Finsternis.' : 'Dein Weg endet im kalten Stein. Doch die Tiefe erinnert sich an jedes gefundene Relikt und jede vergossene Münze.'}</p>
            <div class="result-score"><img src="${ASSET_MANIFEST.pickupRelic.path}" alt="" aria-hidden="true"><span><small>RUNENWERT</small><b>${score.toLocaleString('de-DE')}</b><em>Punkte</em></span></div>
          </div>
        </div>
        <dl class="result-grid">${summary.map(result => `<div><dt><img src="${ASSET_MANIFEST[result.asset].path}" alt="" aria-hidden="true"><span>${result.label}</span></dt><dd>${result.value}</dd></div>`).join('')}</dl>
        <footer class="end-actions"><p>${victory ? 'Die Chronik dieser Expedition ist vollendet.' : 'Ein neuer Runenträger kann den Abstieg erneut wagen.'}</p><div><button id="again" class="primary">${victory ? 'Neue Expedition' : 'Erneut hinabsteigen'} <kbd>R</kbd></button><button id="menu">Zum Hauptmenü</button></div></footer>
      </div>
    </section>`;
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
