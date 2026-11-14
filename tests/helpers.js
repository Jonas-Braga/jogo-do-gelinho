import { fakeCanvas, isNode } from './env.js';
import { Game } from '../src/game.js';
import { STEP, W, PLAYER, MARGIN, TRACK } from '../src/config.js';

const mod = (a, n) => ((a % n) + n) % n;

// Cria um jogo novo, opcionalmente já numa fase. No navegador usa canvas real,
// para que os testes de renderização peguem erros de desenho de verdade.
export function makeGame({ level = 1, quiet = true } = {}) {
  const canvas = isNode ? fakeCanvas() : document.createElement('canvas');
  const g = new Game(canvas);
  if (level !== 1) {
    g.level = level;
    g.startLevel();
  }
  if (quiet) silence(g);
  return g;
}

// Desliga o surgimento de bichos, os prêmios das fases especiais, os itens de
// poder e o urso (para
// testar mecânicas isoladas).
export function silence(g) {
  g.critters.list = [];
  g.critters.timers = g.critters.timers.map(() => Infinity);
  g.critters.bonusQueue = [];
  g.critters.powerQueue = [];
  g.bear.active = false;
}

export function step(g, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) g.update(STEP);
}

// Avança até a condição ser verdadeira (ou estourar o tempo). Retorna o tempo gasto.
export function stepUntil(g, cond, maxSeconds = 20) {
  let t = 0;
  while (!cond() && t < maxSeconds) {
    g.update(STEP);
    t += STEP;
  }
  return t;
}

export function hold(g, action) {
  g.input.held.add(action);
}

export function release(g, action) {
  g.input.held.delete(action);
}

// Posiciona um grupo de placas da fileira centralizado na tela.
export function centerRow(g, row) {
  const r = g.rows[row];
  const p0 = r.pieces[0];
  r.offset = mod(W / 2 + MARGIN - p0.base, TRACK);
  r.gap = r.computeGap();
}

// Peça mais próxima do centro da tela (depois de centerRow).
export function centralRect(g, row, target = W / 2) {
  let best = null;
  for (const q of g.rows[row].rects()) {
    const d = Math.abs(q.x + q.w / 2 - target);
    if (!best || d < best.d) best = { ...q, d };
  }
  return best;
}

// Coloca o jogador de pé no centro de uma peça da fileira.
export function placeOnFloe(g, row, rect = null) {
  centerRow(g, row);
  const r = rect || centralRect(g, row);
  const p = g.player;
  p.state = 'stand';
  p.row = row;
  p.y = g.rows[row].y;
  p.x = r.x + r.w / 2;
  p.setSupport(r);
  p.cooldown = 0;
  return r;
}

// Executa um pulo real pelo teclado ('up' ou 'down') e espera ele terminar.
// Segura a tecla até o pulo começar (respeita a pequena espera após pousar).
export function jump(g, dir) {
  hold(g, dir);
  stepUntil(g, () => g.player.state !== 'stand', 0.3);
  release(g, dir);
  stepUntil(g, () => g.player.state !== 'jump', PLAYER.jumpTime + 0.1);
}

// Posiciona o jogador na costa de modo a cair no centro de uma placa da fileira 0.
export function aimAtRow0(g) {
  centerRow(g, 0);
  const r = centralRect(g, 0);
  g.player.x = r.x + r.w / 2 + g.rows[0].vx * PLAYER.jumpTime;
}

export function press(g, action) {
  g.input.emit(action);
}

// Aperta ↑ em frente à porta do iglu até o personagem começar a entrar.
export function enterIgloo(g) {
  hold(g, 'up');
  stepUntil(g, () => g.state !== 'play', 0.3);
  release(g, 'up');
}
