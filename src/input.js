import { H, W } from './config.js';

// Teclado: setas/WASD para mover, Espaço para inverter, P para pausar, M para o som.
export const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'action',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'start',
  NumpadEnter: 'start',
};

// Botões de toque (coordenadas lógicas 1280x720). Direcional à esquerda;
// inverter e pausa à direita, acima do botão de mudo.
const PAD = { cx: 130, cy: H - 132, size: 74, gap: 4 };
const off = PAD.size + PAD.gap;
const padBtn = (id, dx, dy, label) => ({
  id, label, hold: true,
  x: PAD.cx - PAD.size / 2 + dx * off, y: PAD.cy - PAD.size / 2 + dy * off, w: PAD.size, h: PAD.size,
});
export const TOUCH_BUTTONS = [
  padBtn('up', 0, -1, '▲'),
  padBtn('down', 0, 1, '▼'),
  padBtn('left', -1, 0, '◀'),
  padBtn('right', 1, 0, '▶'),
  { id: 'action', label: '⇄', hold: false, x: W - 180, y: H - 214, w: 100, h: 100, round: true },
  { id: 'pause', label: 'II', hold: false, x: W - 62, y: H - 100, w: 46, h: 40 },
];

const hit = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export class Input {
  constructor() {
    this.held = new Set();       // teclado
    this.touchHeld = new Map();  // pointerId → id do botão segurado
    this.touchMode = false;      // vira true no primeiro toque: mostra os botões
    this.listeners = {};
    window.addEventListener('keydown', (e) => {
      const a = MAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat && !this.held.has(a)) this.emit(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = MAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
      this.emit('blur');
    });
  }

  on(action, fn) {
    (this.listeners[action] ||= []).push(fn);
  }

  emit(action) {
    for (const fn of this.listeners[action] || []) fn();
  }

  isDown(a) {
    if (this.held.has(a)) return true;
    for (const id of this.touchHeld.values()) if (id === a) return true;
    return false;
  }

  axisX() {
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  // -1 = para cima (rumo à costa), +1 = para baixo
  axisY() {
    return (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
  }

  // ---- Toque (x, y em coordenadas lógicas). Retorna o id do botão tocado ou null.
  buttonAt(x, y) {
    return TOUCH_BUTTONS.find((b) => hit(b, x, y)) || null;
  }

  pointerDown(pointerId, x, y) {
    this.touchMode = true;
    const b = this.buttonAt(x, y);
    if (!b) return null;
    if (b.hold) {
      this.touchHeld.set(pointerId, b.id);
    } else {
      this.emit(b.id);
    }
    return b.id;
  }

  // Arrastar o dedo pelo direcional troca de direção sem levantar
  pointerMove(pointerId, x, y) {
    if (!this.touchHeld.has(pointerId)) return;
    const b = this.buttonAt(x, y);
    if (b && b.hold) this.touchHeld.set(pointerId, b.id);
    else this.touchHeld.delete(pointerId);
  }

  pointerUp(pointerId) {
    this.touchHeld.delete(pointerId);
  }
}
