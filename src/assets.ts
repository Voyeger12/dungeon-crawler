export interface AssetDefinition {
  path: string;
  critical?: boolean;
  smooth?: boolean;
}

export const ASSET_MANIFEST = {
  brandCrest: { path: '/assets/branding/runedeep-crest.png', critical: true, smooth: true },
  brandMark256: { path: '/assets/branding/runedeep-mark-256.png', critical: true, smooth: true },
  brandMark64: { path: '/assets/branding/runedeep-mark-64.png', critical: true, smooth: true },
  floor: { path: '/assets/dungeon/floor-stone.webp', critical: true, smooth: true },
  wallFallback: { path: '/assets/dungeon/wall-stone.webp', critical: true, smooth: true },
  wallNorth: { path: '/assets/dungeon/generated/walls/wall-north.png', critical: true, smooth: true },
  wallSouth: { path: '/assets/dungeon/generated/walls/wall-south.png', critical: true, smooth: true },
  wallWest: { path: '/assets/dungeon/generated/walls/wall-west.png', critical: true, smooth: true },
  wallEast: { path: '/assets/dungeon/generated/walls/wall-east.png', critical: true, smooth: true },
  gateNorthClosed: { path: '/assets/dungeon/generated/gates/gate-north-closed.png', critical: true, smooth: true },
  gateNorthOpen: { path: '/assets/dungeon/generated/gates/gate-north-open.png', critical: true, smooth: true },
  gateSouthClosed: { path: '/assets/dungeon/generated/gates/gate-south-closed.png', critical: true, smooth: true },
  gateSouthOpen: { path: '/assets/dungeon/generated/gates/gate-south-open.png', critical: true, smooth: true },
  gateWestClosed: { path: '/assets/dungeon/generated/gates/gate-west-closed.png', critical: true, smooth: true },
  gateWestOpen: { path: '/assets/dungeon/generated/gates/gate-west-open.png', critical: true, smooth: true },
  gateEastClosed: { path: '/assets/dungeon/generated/gates/gate-east-closed.png', critical: true, smooth: true },
  gateEastOpen: { path: '/assets/dungeon/generated/gates/gate-east-open.png', critical: true, smooth: true },
  torchFixtureNorth: { path: '/assets/gameplay/generated/torches/torch-fixture-north.png', critical: true, smooth: true },
  torchFixtureSouth: { path: '/assets/gameplay/generated/torches/torch-fixture-south.png', critical: true, smooth: true },
  torchFixtureSide: { path: '/assets/gameplay/generated/torches/torch-fixture-side.png', critical: true, smooth: true },
  torchFlame0: { path: '/assets/gameplay/generated/torches/torch-flame-0.png', critical: true, smooth: true },
  torchFlame1: { path: '/assets/gameplay/generated/torches/torch-flame-1.png', critical: true, smooth: true },
  torchFlame2: { path: '/assets/gameplay/generated/torches/torch-flame-2.png', critical: true, smooth: true },
  torchFlame3: { path: '/assets/gameplay/generated/torches/torch-flame-3.png', critical: true, smooth: true },
  torchFlame4: { path: '/assets/gameplay/generated/torches/torch-flame-4.png', critical: true, smooth: true },
  torchFlame5: { path: '/assets/gameplay/generated/torches/torch-flame-5.png', critical: true, smooth: true },
  pillar: { path: '/assets/dungeon/pillar.webp', critical: true, smooth: true },
  crate: { path: '/assets/dungeon/crate.webp', critical: true, smooth: true },
  barrel: { path: '/assets/dungeon/barrel.webp', critical: true, smooth: true },
  rubble: { path: '/assets/dungeon/rubble.webp', critical: true, smooth: true },
  spikes: { path: '/assets/dungeon/spikes.webp', critical: true, smooth: true },
  chestClosed: { path: '/assets/dungeon/chest-closed.webp', critical: true, smooth: true },
  chestOpen: { path: '/assets/dungeon/chest-open.webp', critical: true, smooth: true },
  shrine: { path: '/assets/dungeon/rune-shrine.webp', critical: true, smooth: true },
  runebearer: { path: '/assets/characters/generated/clean/runebearer-atlas.png', critical: true, smooth: true },
  skeleton: { path: '/assets/characters/generated/clean/skeleton-atlas.png', critical: true, smooth: true },
  archer: { path: '/assets/characters/generated/clean/archer-atlas.png', critical: true, smooth: true },
  slime: { path: '/assets/characters/generated/clean/slime-atlas.png', critical: true, smooth: true },
  shadow: { path: '/assets/characters/generated/clean/shadow-atlas.png', critical: true, smooth: true },
  boss: { path: '/assets/characters/generated/clean/boss-atlas.png', critical: true, smooth: true },
  pickupGold: { path: '/assets/gameplay/generated/collectables/pickup-gold.png', critical: true, smooth: true },
  pickupPotion: { path: '/assets/gameplay/generated/collectables/pickup-potion.png', critical: true, smooth: true },
  pickupHeal: { path: '/assets/gameplay/generated/collectables/pickup-heal.png', critical: true, smooth: true },
  pickupKey: { path: '/assets/gameplay/generated/collectables/pickup-key.png', critical: true, smooth: true },
  pickupDamage: { path: '/assets/gameplay/generated/collectables/pickup-damage.png', critical: true, smooth: true },
  pickupSpeed: { path: '/assets/gameplay/generated/collectables/pickup-speed.png', critical: true, smooth: true },
  pickupRelic: { path: '/assets/gameplay/generated/collectables/pickup-relic.png', critical: true, smooth: true },
  shopLydia: { path: '/assets/gameplay/generated/shop/lydia-last-forge.png', critical: true, smooth: true },
  shopGraveIron: { path: '/assets/gameplay/generated/shop/grave-iron-longsword.png', critical: true, smooth: true },
  shopAshfang: { path: '/assets/gameplay/generated/shop/ashfang.png', critical: true, smooth: true },
  shopWolfLeather: { path: '/assets/gameplay/generated/shop/patched-wolf-leather.png', critical: true, smooth: true },
  shopChainmail: { path: '/assets/gameplay/generated/shop/soot-chainmail.png', critical: true, smooth: true },
  shopBandage: { path: '/assets/gameplay/generated/shop/wound-bandage.png', critical: true, smooth: true },
  vfxBurnIgnite: { path: '/assets/gameplay/generated/vfx/vfx-burn-ignite.png', critical: true, smooth: true },
  vfxBurnLoop: { path: '/assets/gameplay/generated/vfx/vfx-burn-loop.png', critical: true, smooth: true },
  vfxBurnTick: { path: '/assets/gameplay/generated/vfx/vfx-burn-tick.png', critical: true, smooth: true },
  vfxBurnExpire: { path: '/assets/gameplay/generated/vfx/vfx-burn-expire.png', critical: true, smooth: true },
  vfxFrost: { path: '/assets/gameplay/generated/vfx/vfx-frost.png', critical: true, smooth: true },
  vfxWind: { path: '/assets/gameplay/generated/vfx/vfx-wind.png', critical: true, smooth: true },
  vfxShield: { path: '/assets/gameplay/generated/vfx/vfx-shield.png', critical: true, smooth: true },
  vfxCrit: { path: '/assets/gameplay/generated/vfx/vfx-crit.png', critical: true, smooth: true },
  vfxHit: { path: '/assets/gameplay/generated/vfx/vfx-hit.png', critical: true, smooth: true },
  vfxSlash: { path: '/assets/gameplay/generated/vfx/vfx-slash.png', critical: true, smooth: true },
  vfxOrb: { path: '/assets/gameplay/generated/vfx/vfx-orb.png', critical: true, smooth: true },
  vfxArrow: { path: '/assets/gameplay/generated/vfx/vfx-arrow.png', critical: true, smooth: true },
  vfxShockwave: { path: '/assets/gameplay/generated/vfx/vfx-shockwave.png', critical: true, smooth: true },
  vfxBossRune: { path: '/assets/gameplay/generated/vfx/vfx-boss-rune.png', critical: true, smooth: true },
  vfxLightning: { path: '/assets/gameplay/generated/vfx/vfx-lightning.png', critical: true, smooth: true },
  vfxHeal: { path: '/assets/gameplay/generated/vfx/vfx-heal.png', critical: true, smooth: true },
  upgradeVitality: { path: '/assets/gameplay/generated/sigils/upgrade-vitality.png', critical: true, smooth: true },
  upgradeMight: { path: '/assets/gameplay/generated/sigils/upgrade-might.png', critical: true, smooth: true },
  upgradeFury: { path: '/assets/gameplay/generated/sigils/upgrade-fury.png', critical: true, smooth: true },
  upgradeSwiftness: { path: '/assets/gameplay/generated/sigils/upgrade-swiftness.png', critical: true, smooth: true },
  upgradeDash: { path: '/assets/gameplay/generated/sigils/upgrade-dash.png', critical: true, smooth: true },
  upgradeReach: { path: '/assets/gameplay/generated/sigils/upgrade-reach.png', critical: true, smooth: true },
  upgradeCritical: { path: '/assets/gameplay/generated/sigils/upgrade-critical.png', critical: true, smooth: true },
  upgradeArmor: { path: '/assets/gameplay/generated/sigils/upgrade-armor.png', critical: true, smooth: true },
  upgradeLeech: { path: '/assets/gameplay/generated/sigils/upgrade-leech.png', critical: true, smooth: true },
  upgradeBurn: { path: '/assets/gameplay/generated/sigils/upgrade-burn.png', critical: true, smooth: true },
  upgradeRoomHeal: { path: '/assets/gameplay/generated/sigils/upgrade-roomHeal.png', critical: true, smooth: true },
  upgradeDashShield: { path: '/assets/gameplay/generated/sigils/upgrade-dashShield.png', critical: true, smooth: true }
} as const satisfies Record<string, AssetDefinition>;

export const UPGRADE_SIGIL_PATHS = {
  vitality: ASSET_MANIFEST.upgradeVitality.path,
  might: ASSET_MANIFEST.upgradeMight.path,
  fury: ASSET_MANIFEST.upgradeFury.path,
  swiftness: ASSET_MANIFEST.upgradeSwiftness.path,
  dash: ASSET_MANIFEST.upgradeDash.path,
  reach: ASSET_MANIFEST.upgradeReach.path,
  critical: ASSET_MANIFEST.upgradeCritical.path,
  armor: ASSET_MANIFEST.upgradeArmor.path,
  leech: ASSET_MANIFEST.upgradeLeech.path,
  burn: ASSET_MANIFEST.upgradeBurn.path,
  roomHeal: ASSET_MANIFEST.upgradeRoomHeal.path,
  dashShield: ASSET_MANIFEST.upgradeDashShield.path
} as const;

export type AssetId = keyof typeof ASSET_MANIFEST;
export type AssetLoadState = 'idle' | 'loading' | 'ready' | 'failed';
export type ImageFactory = () => HTMLImageElement;

const browserImageFactory = (): HTMLImageElement => new Image();

export class AssetStore {
  private readonly images = new Map<AssetId, HTMLImageElement>();
  private readonly states = new Map<AssetId, AssetLoadState>();
  private readonly pending = new Map<AssetId, Promise<boolean>>();
  private readonly createImage?: ImageFactory;

  constructor(factory?: ImageFactory) {
    this.createImage = factory ?? (typeof Image === 'undefined' ? undefined : browserImageFactory);
  }

  get(id: AssetId): HTMLImageElement | undefined {
    return this.images.get(id);
  }

  state(id: AssetId): AssetLoadState {
    return this.states.get(id) ?? 'idle';
  }

  isReady(id: AssetId): boolean {
    const image = this.images.get(id);
    return this.state(id) === 'ready' && Boolean(image?.complete && image.naturalWidth > 0);
  }

  async preloadCritical(): Promise<void> {
    const ids = (Object.keys(ASSET_MANIFEST) as AssetId[]).filter(id => ASSET_MANIFEST[id].critical);
    await Promise.all(ids.map(id => this.load(id)));
  }

  load(id: AssetId): Promise<boolean> {
    const existing = this.pending.get(id);
    if (existing) return existing;
    if (!this.createImage) {
      this.states.set(id, 'failed');
      return Promise.resolve(false);
    }

    const image = this.createImage();
    this.images.set(id, image);
    this.states.set(id, 'loading');
    image.decoding = 'async';

    const promise = new Promise<boolean>(resolve => {
      const complete = async (loaded: boolean): Promise<void> => {
        if (loaded && typeof image.decode === 'function') {
          try { await image.decode(); } catch { loaded = image.naturalWidth > 0; }
        }
        this.states.set(id, loaded && image.naturalWidth > 0 ? 'ready' : 'failed');
        resolve(this.states.get(id) === 'ready');
      };
      image.addEventListener('load', () => { void complete(true); }, { once: true });
      image.addEventListener('error', () => { void complete(false); }, { once: true });
      image.src = ASSET_MANIFEST[id].path;
      if (image.complete) void complete(image.naturalWidth > 0);
    });
    this.pending.set(id, promise);
    return promise;
  }
}
