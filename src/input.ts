import { WORLD } from './config';
import { normalize, type Vec } from './math';

export class InputManager {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  mouse = { x: WORLD.width / 2, y: WORLD.height / 2, down: false, pressed: false };

  constructor(private canvas: HTMLCanvasElement, private onBlur: () => void) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.handleBlur);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!this.keys.has(event.code)) this.pressed.add(event.code);
    this.keys.add(event.code);
  };
  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (event.clientX - rect.left) * WORLD.width / rect.width;
    this.mouse.y = (event.clientY - rect.top) * WORLD.height / rect.height;
  };
  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.onPointerMove(event); this.mouse.down = true; this.mouse.pressed = true;
  };
  private onPointerUp = (event: PointerEvent) => { if (event.button === 0) this.mouse.down = false; };
  private handleBlur = () => { this.reset(); this.onBlur(); };

  isDown(...codes: string[]): boolean { return codes.some(code => this.keys.has(code)); }
  consume(code: string): boolean { const found = this.pressed.has(code); this.pressed.delete(code); return found; }
  movement(): Vec {
    const x = Number(this.isDown('KeyD', 'ArrowRight')) - Number(this.isDown('KeyA', 'ArrowLeft'));
    const y = Number(this.isDown('KeyS', 'ArrowDown')) - Number(this.isDown('KeyW', 'ArrowUp'));
    return normalize({ x, y });
  }
  endFrame(): void { this.pressed.clear(); this.mouse.pressed = false; }
  reset(): void { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; this.mouse.pressed = false; }
}
