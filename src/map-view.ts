import type { Direction, Room, RoomKind, RoomState } from './model';

export type MapRoomSource = Pick<Room, 'id' | 'gx' | 'gy' | 'kind' | 'state' | 'depth' | 'visited' | 'connections'>;

export type MapDisplayKind = RoomKind | 'unknown';

export interface MapLegendEntry {
  kind: MapDisplayKind;
  label: string;
  marker: string;
}

export interface MapViewNode {
  id: string;
  xPercent: number;
  yPercent: number;
  kind: MapDisplayKind;
  state: RoomState;
  marker: string;
  label: string;
  visited: boolean;
  adjacent: boolean;
  current: boolean;
}

export interface MapViewLink {
  fromId: string;
  toId: string;
  xPercent: number;
  yPercent: number;
  lengthPercent: number;
  angleDegrees: number;
}

export interface MapViewModel {
  nodes: MapViewNode[];
  links: MapViewLink[];
  legend: readonly MapLegendEntry[];
  summary: string;
  empty: boolean;
}

export interface MapViewOptions {
  /** Empty space around the outermost room nodes, expressed in percent. */
  paddingPercent?: number;
}

export interface MiniMapOptions {
  /** Number of traversable room links shown around the current room. */
  maxHops?: number;
  /** Distance between neighboring grid rooms in the fixed minimap viewport. */
  spacingPercent?: number;
}

const DIRECTIONS: readonly Direction[] = ['north', 'south', 'east', 'west'];
const ROOM_KINDS: readonly RoomKind[] = ['start', 'combat', 'elite', 'treasure', 'rest', 'shop', 'boss'];
const ROOM_STATES: readonly RoomState[] = ['undiscovered', 'ready', 'active', 'cleared'];

export const MAP_VIEW_LEGEND: readonly MapLegendEntry[] = Object.freeze([
  { kind: 'start', label: 'Eingang', marker: 'E' },
  { kind: 'combat', label: 'Kampfkammer', marker: 'K' },
  { kind: 'elite', label: 'Elitenkammer', marker: 'EL' },
  { kind: 'treasure', label: 'Schatzkammer', marker: 'S' },
  { kind: 'rest', label: 'Zuflucht', marker: 'R' },
  { kind: 'shop', label: 'Lydias letzte Esse', marker: 'L' },
  { kind: 'boss', label: 'Bosshalle', marker: 'B' },
  { kind: 'unknown', label: 'Unbekannter Raum', marker: '?' }
]);

const LEGEND_BY_KIND = new Map<MapDisplayKind, MapLegendEntry>(MAP_VIEW_LEGEND.map(entry => [entry.kind, entry]));

interface NormalizedRoom {
  id: string;
  gx: number;
  gy: number;
  kind: RoomKind;
  state: RoomState;
  depth: number;
  visited: boolean;
  connections: Partial<Record<Direction, string>>;
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const isRoomKind = (value: unknown): value is RoomKind => ROOM_KINDS.includes(value as RoomKind);
const isRoomState = (value: unknown): value is RoomState => ROOM_STATES.includes(value as RoomState);

const normalizeRoom = (mapId: string, room: MapRoomSource): NormalizedRoom => {
  const connections: Partial<Record<Direction, string>> = {};
  for (const direction of DIRECTIONS) {
    const target = room.connections[direction];
    if (typeof target === 'string') connections[direction] = target;
  }
  return {
    id: mapId,
    gx: finite(room.gx),
    gy: finite(room.gy),
    kind: isRoomKind(room.kind) ? room.kind : 'combat',
    state: isRoomState(room.state) ? room.state : 'undiscovered',
    depth: finite(room.depth),
    visited: Boolean(room.visited),
    connections
  };
};

const labelFor = (room: NormalizedRoom, displayKind: MapDisplayKind, current: boolean, adjacent: boolean): string => {
  const parts = [LEGEND_BY_KIND.get(displayKind)!.label];
  if (current) parts.push('aktueller Raum');
  else if (adjacent && !room.visited) parts.push('angrenzend, noch nicht betreten');
  else if (room.visited) parts.push('besucht');
  if (room.visited || current) {
    if (room.state === 'cleared') parts.push('gesäubert');
    else if (room.state === 'active') parts.push('Kampf aktiv');
    if (room.depth > 0) parts.push(`Tiefe ${Math.round(room.depth)}`);
  }
  return parts.join(', ');
};

/**
 * Produces a presentation-independent model for the large dungeon map.
 * Room-map keys are authoritative IDs; unvisited rooms are revealed only when
 * they directly border the current room, and their room type remains hidden.
 */
export function buildMapViewModel(
  rooms: ReadonlyMap<string, MapRoomSource>,
  currentRoom: MapRoomSource | string,
  options: MapViewOptions = {}
): MapViewModel {
  const currentId = typeof currentRoom === 'string' ? currentRoom : currentRoom.id;
  const normalized = new Map<string, NormalizedRoom>();
  for (const [mapId, room] of rooms) normalized.set(mapId, normalizeRoom(mapId, room));
  if (typeof currentRoom !== 'string' && !normalized.has(currentId)) normalized.set(currentId, normalizeRoom(currentId, currentRoom));

  const current = normalized.get(currentId);
  const adjacentIds = new Set<string>();
  if (current) for (const id of Object.values(current.connections)) if (id) adjacentIds.add(id);
  for (const room of normalized.values()) {
    if (Object.values(room.connections).includes(currentId)) adjacentIds.add(room.id);
  }

  const visible = [...normalized.values()].filter(room => room.visited || room.id === currentId || adjacentIds.has(room.id));
  if (!visible.length) {
    return { nodes: [], links: [], legend: MAP_VIEW_LEGEND, summary: 'Noch keine Räume auf der Dungeonkarte entdeckt.', empty: true };
  }

  const padding = clamp(finite(options.paddingPercent ?? 10), 4, 30);
  const minX = Math.min(...visible.map(room => room.gx)); const maxX = Math.max(...visible.map(room => room.gx));
  const minY = Math.min(...visible.map(room => room.gy)); const maxY = Math.max(...visible.map(room => room.gy));
  const coordinate = (value: number, min: number, max: number): number => min === max ? 50 : padding + ((value - min) / (max - min)) * (100 - padding * 2);

  const nodeById = new Map<string, MapViewNode>();
  for (const room of visible) {
    const isCurrent = room.id === currentId; const adjacent = adjacentIds.has(room.id) && !isCurrent;
    const displayKind: MapDisplayKind = room.visited || isCurrent ? room.kind : 'unknown';
    const legend = LEGEND_BY_KIND.get(displayKind)!;
    nodeById.set(room.id, {
      id: room.id,
      xPercent: coordinate(room.gx, minX, maxX),
      yPercent: coordinate(room.gy, minY, maxY),
      kind: displayKind,
      state: room.state,
      marker: legend.marker,
      label: labelFor(room, displayKind, isCurrent, adjacent),
      visited: room.visited,
      adjacent,
      current: isCurrent
    });
  }

  const links: MapViewLink[] = []; const seenLinks = new Set<string>();
  for (const room of visible) {
    const from = nodeById.get(room.id)!;
    for (const targetId of Object.values(room.connections)) {
      if (!targetId) continue; const to = nodeById.get(targetId); if (!to) continue;
      const pair = [room.id, targetId].sort((a, b) => a.localeCompare(b)); const key = JSON.stringify(pair);
      if (seenLinks.has(key)) continue; seenLinks.add(key);
      const dx = to.xPercent - from.xPercent; const dy = to.yPercent - from.yPercent;
      links.push({ fromId: room.id, toId: targetId, xPercent: from.xPercent, yPercent: from.yPercent, lengthPercent: Math.hypot(dx, dy), angleDegrees: Math.atan2(dy, dx) * 180 / Math.PI });
    }
  }

  const nodes = [...nodeById.values()].sort((a, b) => a.yPercent - b.yPercent || a.xPercent - b.xPercent || a.id.localeCompare(b.id));
  const visitedCount = nodes.filter(node => node.visited).length; const currentNode = nodeById.get(currentId);
  const summary = `${nodes.length} sichtbare Räume, ${visitedCount} besucht.${currentNode ? ` Aktuell: ${currentNode.label}.` : ''}`;
  return { nodes, links, legend: MAP_VIEW_LEGEND, summary, empty: false };
}

/**
 * Produces a stable, current-room-centred excerpt for the always-visible HUD.
 * It intentionally does not rescale the whole dungeon: the player's room stays
 * at the centre while visited nearby rooms and unknown direct exits move around it.
 */
export function buildMiniMapViewModel(
  rooms: ReadonlyMap<string, MapRoomSource>,
  currentRoom: MapRoomSource | string,
  options: MiniMapOptions = {}
): MapViewModel {
  const currentId = typeof currentRoom === 'string' ? currentRoom : currentRoom.id;
  const normalized = new Map<string, NormalizedRoom>();
  for (const [mapId, room] of rooms) normalized.set(mapId, normalizeRoom(mapId, room));
  if (typeof currentRoom !== 'string' && !normalized.has(currentId)) normalized.set(currentId, normalizeRoom(currentId, currentRoom));

  const current = normalized.get(currentId);
  if (!current) return { nodes: [], links: [], legend: MAP_VIEW_LEGEND, summary: 'Noch keine Räume auf der Runenkarte entdeckt.', empty: true };

  const adjacency = new Map<string, Set<string>>();
  for (const room of normalized.values()) adjacency.set(room.id, new Set());
  for (const room of normalized.values()) {
    for (const targetId of Object.values(room.connections)) {
      if (!targetId || !normalized.has(targetId)) continue;
      adjacency.get(room.id)!.add(targetId);
      adjacency.get(targetId)!.add(room.id);
    }
  }

  const maxHops = Math.round(clamp(finite(options.maxHops ?? 2), 1, 3));
  const distance = new Map<string, number>([[currentId, 0]]);
  const queue = [currentId];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]; const hops = distance.get(id)!;
    if (hops >= maxHops) continue;
    for (const targetId of adjacency.get(id) ?? []) {
      if (distance.has(targetId)) continue;
      distance.set(targetId, hops + 1); queue.push(targetId);
    }
  }

  const visible = [...normalized.values()].filter(room => {
    const hops = distance.get(room.id);
    return hops !== undefined && hops <= maxHops && (room.visited || room.id === currentId || hops === 1);
  });
  const visibleIds = new Set(visible.map(room => room.id));
  const adjacentIds = adjacency.get(currentId) ?? new Set<string>();
  const spacing = clamp(finite(options.spacingPercent ?? 23), 16, 30);
  const nodeById = new Map<string, MapViewNode>();

  for (const room of visible) {
    const isCurrent = room.id === currentId; const adjacent = adjacentIds.has(room.id) && !isCurrent;
    const displayKind: MapDisplayKind = room.visited || isCurrent ? room.kind : 'unknown';
    const legend = LEGEND_BY_KIND.get(displayKind)!;
    nodeById.set(room.id, {
      id: room.id,
      xPercent: clamp(50 + (room.gx - current.gx) * spacing, 7, 93),
      yPercent: clamp(50 + (room.gy - current.gy) * spacing, 7, 93),
      kind: displayKind,
      state: room.state,
      marker: legend.marker,
      label: labelFor(room, displayKind, isCurrent, adjacent),
      visited: room.visited,
      adjacent,
      current: isCurrent
    });
  }

  const links: MapViewLink[] = []; const seenLinks = new Set<string>();
  for (const room of visible) {
    const from = nodeById.get(room.id)!;
    for (const targetId of Object.values(room.connections)) {
      if (!targetId || !visibleIds.has(targetId)) continue;
      const to = nodeById.get(targetId); if (!to) continue;
      const pair = [room.id, targetId].sort((a, b) => a.localeCompare(b)); const key = JSON.stringify(pair);
      if (seenLinks.has(key)) continue; seenLinks.add(key);
      const dx = to.xPercent - from.xPercent; const dy = to.yPercent - from.yPercent;
      links.push({ fromId: room.id, toId: targetId, xPercent: from.xPercent, yPercent: from.yPercent, lengthPercent: Math.hypot(dx, dy), angleDegrees: Math.atan2(dy, dx) * 180 / Math.PI });
    }
  }

  const nodes = [...nodeById.values()].sort((a, b) => a.yPercent - b.yPercent || a.xPercent - b.xPercent || a.id.localeCompare(b.id));
  const summary = `Runenkarte mit ${nodes.length} nahen Räumen. Aktuell: ${nodeById.get(currentId)?.label ?? 'unbekannt'}.`;
  return { nodes, links, legend: MAP_VIEW_LEGEND, summary, empty: false };
}

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]!);

const percent = (value: number): string => `${value.toFixed(3)}%`;
const degrees = (value: number): string => `${value.toFixed(3)}deg`;

/** Renders only controlled classes and escaped text/attributes. */
export function renderMapViewMarkup(model: MapViewModel): string {
  if (model.empty) {
    return `<section class="map-view" aria-label="Dungeonkarte"><p class="map-view-empty">${escapeHtml(model.summary)}</p></section>`;
  }
  const links = model.links.map(link => `<i class="map-view-link" aria-hidden="true" style="left:${percent(link.xPercent)};top:${percent(link.yPercent)};width:${percent(link.lengthPercent)};transform:rotate(${degrees(link.angleDegrees)})"></i>`).join('');
  const nodes = model.nodes.map(node => {
    const classes = ['map-view-room', `kind-${node.kind}`, `state-${node.state}`, node.visited ? 'is-visited' : '', node.adjacent ? 'is-adjacent' : '', node.current ? 'is-current' : ''].filter(Boolean).join(' ');
    return `<span class="${classes}" data-room-id="${escapeHtml(node.id)}" title="${escapeHtml(node.label)}" style="left:${percent(node.xPercent)};top:${percent(node.yPercent)}"><b aria-hidden="true">${escapeHtml(node.marker)}</b></span>`;
  }).join('');
  const roomList = model.nodes.map(node => `<li>${escapeHtml(node.label)}</li>`).join('');
  const legend = model.legend.map(entry => `<li data-kind="${entry.kind}"><i aria-hidden="true">${escapeHtml(entry.marker)}</i><span>${escapeHtml(entry.label)}</span></li>`).join('');
  return `<section class="map-view" aria-label="Dungeonkarte"><div class="map-view-canvas" role="img" aria-label="${escapeHtml(model.summary)}">${links}${nodes}</div><ol class="map-view-room-list sr-only" aria-label="Sichtbare Räume">${roomList}</ol><ul class="map-view-legend" aria-label="Kartenlegende">${legend}</ul></section>`;
}

/** Renders the compact HUD vocabulary without duplicating the large map legend. */
export function renderMiniMapMarkup(model: MapViewModel): string {
  if (model.empty) return `<p class="minimap-empty">${escapeHtml(model.summary)}</p>`;
  const links = model.links.map(link => `<i class="minimap-link" aria-hidden="true" style="left:${percent(link.xPercent)};top:${percent(link.yPercent)};width:${percent(link.lengthPercent)};transform:rotate(${degrees(link.angleDegrees)})"></i>`).join('');
  const nodes = model.nodes.map(node => {
    const classes = ['minimap-room', `kind-${node.kind}`, `state-${node.state}`, node.visited ? 'is-visited' : '', node.adjacent ? 'is-adjacent' : '', node.current ? 'is-current' : ''].filter(Boolean).join(' ');
    return `<span class="${classes}" data-room-id="${escapeHtml(node.id)}" title="${escapeHtml(node.label)}" style="left:${percent(node.xPercent)};top:${percent(node.yPercent)}"><b aria-hidden="true">${escapeHtml(node.marker)}</b></span>`;
  }).join('');
  const roomList = model.nodes.map(node => `<li>${escapeHtml(node.label)}</li>`).join('');
  return `<div class="minimap-canvas" role="img" aria-label="${escapeHtml(model.summary)}">${links}${nodes}</div><ol class="sr-only" aria-label="Nahe Räume">${roomList}</ol>`;
}
