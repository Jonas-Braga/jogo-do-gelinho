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

// Joystick (Gamepad API), no celular ou no PC. Alavanca esquerda ou direcional
// digital: andar e pular. Botões da frente (A/B/X/Y): inverter (e começar).
// Start: pausar/continuar (e começar). Select: som.
export const GAMEPAD = {
  walk: 0.4,   // quanto a alavanca precisa inclinar para andar
  jump: 0.6,   // para pular precisa inclinar mais: não pula só de a alavanca entortar
  action: [0, 1, 2, 3],
  menu: 9,
  mute: 8,
  up: 12, down: 13, left: 14, right: 15,
};

const pressed = (pad, i) => !!pad.buttons?.[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);

// Lê um joystick: direções seguradas e botões apertados
export function readGamepad(pad) {
  const G = GAMEPAD;
  const ax = pad.axes || [];
  let x = ax[0] || 0;
  let y = ax[1] || 0;
  // Fora do mapeamento padrão, o direcional digital costuma vir nos eixos 6 e 7
  if (pad.mapping !== 'standard' && ax.length >= 8) {
    if (Math.abs(ax[6]) > 0.5 && Math.abs(ax[6]) <= 1) x = ax[6];
    if (Math.abs(ax[7]) > 0.5 && Math.abs(ax[7]) <= 1) y = ax[7];
  }
  const held = new Set();
  if (x < -G.walk || pressed(pad, G.left)) held.add('left');
  if (x > G.walk || pressed(pad, G.right)) held.add('right');
  if (y < -G.jump || pressed(pad, G.up)) held.add('up');
  if (y > G.jump || pressed(pad, G.down)) held.add('down');
  const buttons = new Set();
  if (G.action.some((i) => pressed(pad, i))) buttons.add('action');
  if (pressed(pad, G.menu)) buttons.add('menu');
  if (pressed(pad, G.mute)) buttons.add('mute');
  return { held, buttons };
}

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
    // Joystick: direções seguradas, botões que já estavam apertados e se ele está
    // em uso (o último controle usado manda: tocar na tela traz os botões de volta)
    this.padHeld = new Set();
    this.padButtons = new Set();
    this.padActive = false;
    this.listeners = {};
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
      this.padHeld.clear();
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

  // Lido a cada quadro (game.js). `pads` = lista do navegador (ou falsa, nos testes).
  // Segurar vale enquanto segura; botões disparam uma vez por aperto.
  pollGamepads(pads) {
    if (pads === undefined) {
      try {
        pads = globalThis.navigator?.getGamepads?.() || [];
      } catch {
        pads = [];
      }
    }
    const held = new Set();
    const buttons = new Set();
    let connected = false;
    for (const pad of pads) {
      if (!pad || pad.connected === false) continue;
      connected = true;
      const r = readGamepad(pad);
      for (const a of r.held) held.add(a);
      for (const b of r.buttons) buttons.add(b);
    }
    if (held.size || buttons.size) this.padActive = true;
    if (!connected) this.padActive = false;
    const fresh = [...buttons].filter((b) => !this.padButtons.has(b));
    this.padHeld = held;
    this.padButtons = buttons;
    for (const b of fresh) this.emit(b);
  }

  // Botões de toque aparecem? Só depois de um toque e sem joystick em uso
  get showTouch() {
    return this.touchMode && !this.padActive;
  }

  // Qual controle as telas devem ensinar: 'pad', 'touch' ou 'keys'
  get style() {
    return this.padActive ? 'pad' : this.touchMode ? 'touch' : 'keys';
  }

  isDown(a) {
    if (this.held.has(a) || this.padHeld.has(a)) return true;
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
    this.padActive = false; // tocou na tela: os botões voltam, até o joystick ser usado de novo
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
