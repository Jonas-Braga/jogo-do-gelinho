import { ROW_Y, BLOCK_W, BLOCK_GAP, TRACK, MARGIN, LANDING_TOLERANCE } from './config.js';
import { levelParams } from './levels.js';

const mod = (a, n) => ((a % n) + n) % n;

// Placas fragmentadas
const FRAG = { n: 6, w: 36, gapMin: 3, gapAmp: 24 };

// Contorno irregular do topo de cada placa (valores fixos por placa).
function jaggedShape(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 10 }, () => (rnd() - 0.5) * 5);
}

export class Row {
  constructor(index, y, dir, speed, pieces, phase, frag, breathSpeed) {
    this.index = index;
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.pieces = pieces;
    this.offset = phase;
    this.frag = frag;
    this.breathSpeed = breathSpeed;
    this.breathPhase = index * 1.3;
    this.t = 0;
    this.active = false;
    this.gap = this.computeGap();
  }

  get vx() {
    return this.dir * this.speed;
  }

  computeGap() {
    if (!this.frag) return BLOCK_GAP;
    const k = 0.5 + 0.5 * Math.sin(this.t * this.breathSpeed + this.breathPhase);
    return FRAG.gapMin + FRAG.gapAmp * k * k;
  }

  update(dt) {
    this.t += dt;
    this.offset = mod(this.offset + this.vx * dt, TRACK);
    this.gap = this.computeGap();
    for (const p of this.pieces) if (p.dip > 0) p.dip = Math.max(0, p.dip - dt * 1.6);
  }

  reverse() {
    this.dir *= -1;
  }

  // Cada peça fica numa posição relativa ao centro do seu grupo; o espaçamento
  // entre peças varia nas fases fragmentadas.
  pieceX(p) {
    const rel = (p.k - (p.n - 1) / 2) * (p.w + this.gap) - p.w / 2;
    return mod(p.base + this.offset + rel, TRACK) - MARGIN;
  }

  *rects() {
    for (const p of this.pieces) yield { x: this.pieceX(p), w: p.w, piece: p };
  }

  pieceAt(px) {
    for (const r of this.rects()) {
      if (px >= r.x - LANDING_TOLERANCE && px <= r.x + r.w + LANDING_TOLERANCE) return r;
    }
    return null;
  }

  supports(px) {
    return this.pieceAt(px) !== null;
  }
}

// Deslocamento vertical visual de uma peça: balanço contínuo na água + afundada
// amortecida quando alguém pousa (piece.dip vai de 1 a 0).
export function floeOffset(piece, t) {
  const bob = Math.sin(t * 2.2 + piece.bob) * 1.6;
  const d = piece.dip || 0;
  const dip = d > 0 ? Math.sin((1 - d) * Math.PI * 3) * d * 3.5 + d * 2.5 : 0;
  return bob + dip;
}

export function createRows(level = 1) {
  const { speed, fragmented, breathSpeed } = levelParams(level);
  const n = fragmented ? FRAG.n : 3;
  const w = fragmented ? FRAG.w : BLOCK_W;
  let seed = 1 + level * 31;
  return ROW_Y.map((y, i) => {
    const pieces = [];
    for (const g of [0, TRACK / 2]) {
      for (let k = 0; k < n; k++) {
        pieces.push({
          base: g + 130,
          k,
          n,
          w,
          seed,
          shape: jaggedShape(seed++).map((v) => (fragmented ? v * 0.7 : v)),
          bob: Math.random() * Math.PI * 2,
          dip: 0,
          sprites: {}, // cache de sprites (normal/ativado), preenchido em sprites.js
        });
      }
    }
    const dir = i % 2 === 0 ? 1 : -1;
    return new Row(i, y, dir, speed, pieces, 380 + i * 230, fragmented, breathSpeed);
  });
}
