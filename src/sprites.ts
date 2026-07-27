import { clamp } from './math';
import type { Enemy, Player } from './model';

export const ACTOR_ATLAS_COLUMNS = 5;
export const ACTOR_ATLAS_ROWS = 7;

export interface DirectionFrame {
  column: number;
  mirrored: boolean;
}

export interface ActorFrame extends DirectionFrame {
  row: number;
}

export function directionFrame(angle: number): DirectionFrame {
  const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  switch (octant) {
    case 0: return { column: 2, mirrored: false }; // east
    case 1: return { column: 1, mirrored: false }; // south-east
    case 2: return { column: 0, mirrored: false }; // south
    case 3: return { column: 1, mirrored: true }; // south-west
    case 4: return { column: 2, mirrored: true }; // west
    case 5: return { column: 3, mirrored: true }; // north-west
    case 6: return { column: 4, mirrored: false }; // north
    default: return { column: 3, mirrored: false }; // north-east
  }
}

export function playerFrame(player: Player, time: number): ActorFrame {
  const direction = directionFrame(player.dashTimer > 0 ? Math.atan2(player.dashDir.y, player.dashDir.x) : player.aim);
  let row = 0;
  if (player.flash > 0) row = 5;
  else if (player.attackAnim > 0) {
    const progress = clamp(1 - player.attackAnim / .34, 0, 1);
    row = progress < .22 ? 3 : 4;
  } else if (Math.hypot(player.vx, player.vy) > 12 || player.dashTimer > 0) row = Math.floor(time * 10) % 2 ? 1 : 2;
  return { ...direction, row };
}

export function enemyFrame(enemy: Enemy, time: number): ActorFrame {
  const direction = directionFrame(enemy.aim);
  let row = 0;
  if (enemy.state === 'dead') row = 6;
  else if (enemy.flash > 0) row = 5;
  else if (enemy.state === 'telegraph') row = 3;
  else if (enemy.state === 'attack') row = 4;
  else if (enemy.state === 'chase') row = Math.floor(time * 9 + enemy.id) % 2 ? 1 : 2;
  return { ...direction, row };
}
