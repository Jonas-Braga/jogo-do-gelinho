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

// Controles de toque (coordenadas lógicas 1280x720).
// Esquerda: direcional analógico de 8 direções (permite diagonais, ex.: pular
// para cima já andando para a direita). Direita: inverter e pausa, acima do mudo.
export const JOYSTICK = {
  cx: 150, cy: H - 150,
  r: 72,        // raio da base (curso máximo do pino)
  knob: 32,     // raio do pino
  grab: 120,    // raio da área onde um toque "pega" o direcional
  dead: 0.3,    // zona morta (fração do raio): toque leve não move
};

// Setor de 45° → direções seguradas (0 = direita, sentido horário, y para baixo)
const SECTORS = [
  ['right'], ['down', 'right'], ['down'], ['down', 'left'],
  ['left'], ['up', 'left'], ['up'], ['up', 'right'],
];

export function stickDirections(dx, dy) {
  const { r, dead } = JOYSTICK;
  if (Math.hypot(dx, dy) < r * dead) return [];
  const sector = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[sector];
}

export const TOUCH_BUTTONS = [
  { id: 'action', label: '⇄', hold: false, x: W - 180, y: H - 214, w: 100, h: 100, round: true },
  { id: 'pause', label: 'II', hold: false, x: W - 62, y: H - 100, w: 46, h: 40 },
];

// Campos de texto e botões de formulário recebem as próprias teclas
export function typingIn(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || !!target?.isContentEditable;
}

const hit = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export class Input {
  constructor() {
    this.held = new Set();       // teclado
    this.touchHeld = new Map();  // pointerId → id do botão segurado
    this.touchMode = false;      // vira true no primeiro toque: mostra os botões
    // Direcional analógico: dedo que o controla, deslocamento do pino e direções ativas
    this.stick = { pointerId: null, dx: 0, dy: 0, dirs: [] };
    this.listeners = {};
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
      this.releaseStick();
      this.emit('blur');
    });
  }

  keyDown(e) {
    // Digitando no formulário de conta: as teclas são do formulário, não do jogo
    if (typingIn(e.target)) return;
    const a = MAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat && !this.held.has(a)) this.emit(a);
    this.held.add(a);
  }

  keyUp(e) {
    const a = MAP[e.code];
    if (a) this.held.delete(a);
  }

  on(action, fn) {
    (this.listeners[action] ||= []).push(fn);
  }

  emit(action) {
    for (const fn of this.listeners[action] || []) fn();
  }

  isDown(a) {
    if (this.held.has(a)) return true;
    if (this.stick.dirs.includes(a)) return true;
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

  // O toque cai na área do direcional?
  inStick(x, y) {
    return Math.hypot(x - JOYSTICK.cx, y - JOYSTICK.cy) <= JOYSTICK.grab;
  }

  pointerDown(pointerId, x, y) {
    this.touchMode = true;
    if (this.stick.pointerId === null && this.inStick(x, y)) {
      this.stick.pointerId = pointerId;
      this.moveStick(x, y);
      return 'stick';
    }
    const b = this.buttonAt(x, y);
    if (!b) return null;
    if (b.hold) {
      this.touchHeld.set(pointerId, b.id);
    } else {
      this.emit(b.id);
    }
    return b.id;
  }

  // O dedo que pegou o direcional continua controlando mesmo saindo da base
  pointerMove(pointerId, x, y) {
    if (pointerId === this.stick.pointerId) {
      this.moveStick(x, y);
      return;
    }
    if (!this.touchHeld.has(pointerId)) return;
    const b = this.buttonAt(x, y);
    if (b && b.hold) this.touchHeld.set(pointerId, b.id);
    else this.touchHeld.delete(pointerId);
  }

  pointerUp(pointerId) {
    if (pointerId === this.stick.pointerId) this.releaseStick();
    this.touchHeld.delete(pointerId);
  }

  moveStick(x, y) {
    let dx = x - JOYSTICK.cx;
    let dy = y - JOYSTICK.cy;
    this.stick.dirs = stickDirections(dx, dy);
    // O pino fica limitado à base
    const d = Math.hypot(dx, dy);
    if (d > JOYSTICK.r) {
      dx = (dx / d) * JOYSTICK.r;
      dy = (dy / d) * JOYSTICK.r;
    }
    this.stick.dx = dx;
    this.stick.dy = dy;
  }

  releaseStick() {
    this.stick = { pointerId: null, dx: 0, dy: 0, dirs: [] };
  }
}
