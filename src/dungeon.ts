import { WORLD } from './config';
import { pick, rand, shuffle } from './math';
import type { Direction, Obstacle, Room, RoomBlocker, RoomKind, ShopRoomLayout } from './model';

const DELTA: Record<Direction, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OPPOSITE: Record<Direction, Direction> = { north: 'south', south: 'north', east: 'west', west: 'east' };
let obstacleId = 1;

function obstaclesFor(kind: RoomKind, depth: number): Obstacle[] {
  if (kind === 'start' || kind === 'shop' || kind === 'boss') return kind === 'boss' ? [
    { id: obstacleId++, x: 155, y: 132, radius: 25, kind: 'pillar', solid: true, breakable: false, hp: 999, phase: rand(0, 9) },
    { id: obstacleId++, x: 805, y: 132, radius: 25, kind: 'pillar', solid: true, breakable: false, hp: 999, phase: rand(0, 9) }
  ] : [];
  const result: Obstacle[] = [];
  const layouts = [
    [[330, 200], [630, 340]], [[300, 270], [660, 270]], [[420, 175], [540, 365]],
    [[270, 165], [690, 165], [480, 365]], [[350, 150], [610, 150], [480, 350]]
  ];
  const layout = pick(layouts);
  layout.forEach(([x, y], index) => result.push({
    id: obstacleId++, x: x! + rand(-12, 12), y: y! + rand(-12, 12), radius: index % 2 ? 23 : 27,
    kind: index % 2 ? 'crate' : 'pillar', solid: true, breakable: index % 2 === 1, hp: 38 + depth * 2, phase: rand(0, 9)
  }));
  if (kind === 'elite' || depth > 3) result.push({ id: obstacleId++, x: 480, y: 270, radius: 30, kind: 'spikes', solid: false, breakable: false, hp: 999, phase: rand(0, 3) });
  return result;
}

function shopRoom(): { layout: ShopRoomLayout; blockers: RoomBlocker[] } {
  const offset = pick([-28, 0, 26]);
  const forgeX = 480 + offset;
  return {
    layout: {
      forge: { x: forgeX, y: 184 },
      lydia: { x: 354 + offset, y: 314 },
      rest: { x: 756 - Math.round(offset * .25), y: 396 },
      displaySlots: [426, 494, 562, 630, 698].map(x => ({ x: x + offset, y: 296 }))
    },
    blockers: [
      { x: 275 + offset, y: 206, radius: 48 },
      { x: 425 + offset, y: 236, radius: 51 },
      { x: 525 + offset, y: 236, radius: 51 },
      { x: 625 + offset, y: 236, radius: 51 },
      { x: 710 + offset, y: 224, radius: 43 }
    ]
  };
}

export function generateDungeon(): Map<string, Room> {
  const rooms = new Map<string, Room>();
  const byCoord = new Map<string, string>();
  const add = (id: string, gx: number, gy: number, kind: RoomKind, depth: number) => {
    const room: Room = { id, gx, gy, kind, depth, state: kind === 'start' ? 'cleared' : 'undiscovered', connections: {}, obstacles: obstaclesFor(kind, depth), visited: false, enemiesDefeated: 0, rewardClaimed: false };
    if (kind === 'treasure') room.chest = { x: WORLD.width / 2, y: WORLD.height / 2, opened: false, locked: true };
    if (kind === 'shop') {
      const shop = shopRoom(); room.shop = shop.layout; room.blockers = shop.blockers;
    }
    rooms.set(id, room); byCoord.set(`${gx},${gy}`, id); return room;
  };
  const connect = (a: Room, b: Room, direction: Direction) => { a.connections[direction] = b.id; b.connections[OPPOSITE[direction]] = a.id; };
  let current = add('start', 0, 0, 'start', 0);
  const candidates: Direction[] = ['east', 'south', 'north'];
  const path: Room[] = [current];
  for (let i = 1; i <= 6; i++) {
    let direction: Direction | undefined; let nx = 0; let ny = 0;
    for (const candidate of shuffle(candidates)) {
      const [dx, dy] = DELTA[candidate]; nx = current.gx + dx; ny = current.gy + dy;
      if (!byCoord.has(`${nx},${ny}`)) { direction = candidate; break; }
    }
    if (!direction) { direction = 'east'; nx = current.gx + 1; ny = current.gy; while (byCoord.has(`${nx},${ny}`)) nx++; }
    const kind: RoomKind = i === 4 ? 'elite' : 'combat';
    const next = add(`room-${i}`, nx, ny, kind, i); connect(current, next, direction); current = next; path.push(next);
  }
  const bossDir: Direction = 'east';
  let bossX = current.gx + 1; while (byCoord.has(`${bossX},${current.gy}`)) bossX++;
  const boss = add('boss', bossX, current.gy, 'boss', 7); connect(current, boss, bossDir);

  const addBranch = (anchor: Room, kind: RoomKind, name: string) => {
    for (const direction of shuffle<Direction>(['north', 'south', 'west', 'east'])) {
      const [dx, dy] = DELTA[direction]; const x = anchor.gx + dx; const y = anchor.gy + dy;
      if (!byCoord.has(`${x},${y}`)) { const branch = add(name, x, y, kind, anchor.depth); connect(anchor, branch, direction); break; }
    }
  };

  const shopAnchors = [...shuffle(path.slice(3, 6)), ...shuffle(path.slice(1, 3))];
  const shopDirections: Direction[] = ['north', ...shuffle<Direction>(['west', 'east', 'south'])];
  const shopPlacement = shopAnchors.flatMap(anchor => shopDirections.map(direction => {
    const [dx, dy] = DELTA[direction];
    return { anchor, direction, x: anchor.gx + dx, y: anchor.gy + dy };
  })).find(candidate => !byCoord.has(`${candidate.x},${candidate.y}`));
  if (!shopPlacement) throw new Error('Der garantierte Lydia-Raum konnte nicht platziert werden.');
  const shop = add('lydia-shop', shopPlacement.x, shopPlacement.y, 'shop', shopPlacement.anchor.depth);
  connect(shopPlacement.anchor, shop, shopPlacement.direction);

  addBranch(path[2]!, 'treasure', 'treasure');
  return rooms;
}

export const directionTo = (from: Room, toId: string): Direction | undefined => (Object.entries(from.connections) as [Direction, string][]).find(([, id]) => id === toId)?.[0];
export const oppositeDirection = (direction: Direction): Direction => OPPOSITE[direction];
