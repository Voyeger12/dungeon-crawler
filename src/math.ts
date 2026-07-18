export type Vec = { x: number; y: number };
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const len = (v: Vec) => Math.hypot(v.x, v.y);
export const normalize = (v: Vec): Vec => { const l = len(v); return l ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 }; };
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randi = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
export const shuffle = <T>(arr: readonly T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
};
export const circleHit = (a: Vec, ar: number, b: Vec, br: number) => dist(a, b) < ar + br;
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
