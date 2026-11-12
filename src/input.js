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

// Controles de toque (coordenadas lógicas 1280x720), um polegar de cada lado.
// Esquerda: ◀ ▶ só para andar. Direita: ▲ ▼ para pular (e ▲ para entrar no
// iglu) e ⇄ para inverter; pausa acima do mudo. O pulo só sai quando o botão é
// apertado, nunca por o dedo escorregar enquanto anda. Pular já andando = um
// polegar em cada lado.
export const WALK_PAD = {
  x: 20, y: H - 180, w: 300, h: 140,
  dead: 14,   // meia largura do vão entre ◀ e ▶: ali o personagem fica parado
  grab: 36,   // folga em volta dos botões onde o toque ainda "pega"
};

// Lado do dedo em relação ao meio dos botões de andar: -1 esquerda, +1 direita, 0 no vão
export function walkDirection(x) {
  const d = x - (WALK_PAD.x + WALK_PAD.w / 2);
  return Math.abs(d) < WALK_PAD.dead ? 0 : Math.sign(d);
}

export const TOUCH_BUTTONS = [
  { id: 'up', label: '▲', hold: true, x: W - 204, y: H - 310, w: 120, h: 120, round: true },
  { id: 'down', label: '▼', hold: true, x: W - 204, y: H - 170, w: 120, h: 120, round: true },
  { id: 'action', label: '⇄', hold: false, x: W - 340, y: H - 150, w: 100, h: 100, round: true },
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
    // Botões de andar: dedo que os controla e o lado apertado (-1, 0, +1)
    this.walk = { pointerId: null, dir: 0 };
    this.listeners = {};
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
      this.releaseWalk();
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
    if (a === 'left' && this.walk.dir < 0) return true;
    if (a === 'right' && this.walk.dir > 0) return true;
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

  // O toque cai nos botões de andar (com a folga em volta)?
  inWalkPad(x, y) {
    const { x: px, y: py, w, h, grab } = WALK_PAD;
    return x >= px - grab && x <= px + w + grab && y >= py - grab && y <= py + h + grab;
  }

  pointerDown(pointerId, x, y) {
    this.touchMode = true;
    if (this.walk.pointerId === null && this.inWalkPad(x, y)) {
      this.walk.pointerId = pointerId;
      this.walk.dir = walkDirection(x);
      return 'walk';
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

  // O dedo que pegou os botões de andar continua mandando mesmo saindo deles:
  // vale o lado em que ele está. Nos de pular, deslizar de ▲ para ▼ troca;
  // sair do botão solta.
  pointerMove(pointerId, x, y) {
    if (pointerId === this.walk.pointerId) {
      this.walk.dir = walkDirection(x);
      return;
    }
    if (!this.touchHeld.has(pointerId)) return;
    const b = this.buttonAt(x, y);
    if (b && b.hold) this.touchHeld.set(pointerId, b.id);
    else this.touchHeld.delete(pointerId);
  }

  pointerUp(pointerId) {
    if (pointerId === this.walk.pointerId) this.releaseWalk();
    this.touchHeld.delete(pointerId);
  }

  releaseWalk() {
    this.walk = { pointerId: null, dir: 0 };
  }
}
