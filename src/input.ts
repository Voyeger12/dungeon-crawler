import { WORLD } from './config';
import { DISPLAY_STATE_EVENT } from './display';
import { clamp, normalize, type Vec } from './math';

export class InputManager {
  private keys = new Set<string>();
  private physicalKeys = new Set<string>();
  private pressed = new Set<string>();
  private pointerHeld = false;
  private lastPointerClient?: { x: number; y: number };
  private displayTarget: EventTarget;
  mouse = { x: WORLD.width / 2, y: WORLD.height / 2, down: false, pressed: false };

  constructor(private canvas: HTMLCanvasElement, private onBlur: () => void, private gameplayActive: () => boolean = () => true) {
    this.displayTarget = canvas.closest?.('#app') ?? window;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onGlobalPointerDown, { capture: true });
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.handleBlur);
    this.displayTarget.addEventListener(DISPLAY_STATE_EVENT, this.reprojectPointer);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const editing = Boolean(target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable));
    if (event.ctrlKey || event.altKey || event.metaKey || (editing && event.code !== 'Escape')) return;
    if (this.gameplayActive() && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!this.physicalKeys.has(event.code)) {
      this.physicalKeys.add(event.code); this.keys.add(event.code); this.pressed.add(event.code);
    }
  };
  private onKeyUp = (event: KeyboardEvent) => { this.physicalKeys.delete(event.code); this.keys.delete(event.code); };
  private onPointerMove = (event: PointerEvent) => {
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
    this.projectPointer(event.clientX, event.clientY);
  };
  private projectPointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mouse.x = clamp((clientX - rect.left) * WORLD.width / rect.width, 0, WORLD.width);
    this.mouse.y = clamp((clientY - rect.top) * WORLD.height / rect.height, 0, WORLD.height);
  }
  private reprojectPointer = (): void => {
    if (this.lastPointerClient) this.projectPointer(this.lastPointerClient.x, this.lastPointerClient.y);
  };
  private onGlobalPointerDown = (event: PointerEvent) => { if (event.button === 0) this.pointerHeld = true; };
  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.onPointerMove(event); this.pointerHeld = true; this.mouse.down = true; this.mouse.pressed = true;
  };
  private onPointerUp = (event: PointerEvent) => { if (event.button === 0) { this.pointerHeld = false; this.mouse.down = false; } };
  private handleBlur = () => { this.releaseAll(); this.onBlur(); };

  isDown(...codes: string[]): boolean { return codes.some(code => this.keys.has(code)); }
  isNeutral(...codes: string[]): boolean { return !this.pointerHeld && codes.every(code => !this.physicalKeys.has(code)); }
  consume(code: string): boolean { const found = this.pressed.has(code); this.pressed.delete(code); return found; }
  consumeAny(...codes: string[]): boolean { const found = codes.some(code => this.pressed.has(code)); codes.forEach(code => this.pressed.delete(code)); return found; }
  movement(): Vec {
    const x = Number(this.isDown('KeyD', 'ArrowRight')) - Number(this.isDown('KeyA', 'ArrowLeft'));
    const y = Number(this.isDown('KeyS', 'ArrowDown')) - Number(this.isDown('KeyW', 'ArrowUp'));
    return normalize({ x, y });
  }
  endFrame(): void { this.pressed.clear(); this.mouse.pressed = false; }
  reset(): void { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; this.mouse.pressed = false; }
  private releaseAll(): void { this.reset(); this.physicalKeys.clear(); this.pointerHeld = false; }
}
