// Visual "renderizado": os personagens são montados em 3D com o Three.js (src/m3d/)
// e "fotografados" em sprites, como nos jogos de personagens pré-renderizados.
// Depois disso o jogo continua 2D: cada quadro só desenha a foto certa.
// Cada modelo é fotografado só quando aparece pela primeira vez, aos poucos (algumas
// poses por quadro) para não travar o jogo. Enquanto a foto não fica pronta, ou sem
// internet/WebGL, vale o desenho 2D de sempre.
import { DEPTH, W } from './config.js';
import { Studio } from './m3d/kit.js';
import * as player from './m3d/player.js';
import * as bear from './m3d/bear.js';
import { goose, crab, clam, fish } from './m3d/critters.js';
import { floeSubject, variantOf, PAD as FLOE_PAD, TOP as FLOE_TOP, H as FLOE_H } from './m3d/floes.js';
import { drawPlayerMarks } from './sprites.js';
import { POWERS } from './powers.js';

const M = DEPTH.model3d;
const TAU = Math.PI * 2;

export const SUBJECTS = { player, bear, goose, crab, clam, fish };
export const CRITTERS_3D = new Set(['goose', 'crab', 'clam', 'fish']);
export const BOX = player.box;
export const playerPose = player.playerPose;
export const poseList = player.poses;

// state: idle → loading → ready (Three.js carregado) | failed
export const model = { state: 'idle', sprites: null, error: null, bakeMs: 0, studio: null };
const status = {}; // modelo → 'queued' | 'done'
const queue = [];

// Começa a carregar o Three.js (uma vez). Só no navegador com WebGL.
export function loadModel() {
  if (model.state !== 'idle' || !M.enabled) return;
  if (typeof window === 'undefined' || !window.WebGLRenderingContext) return;
  model.state = 'loading';
  import(/* @vite-ignore */ M.url)
    .then((THREE) => {
      model.studio = new Studio(THREE);
      model.sprites = model.sprites || {};
      model.state = 'ready';
      pump();
    })
    .catch((e) => {
      model.state = 'failed';
      model.error = e;
      console.info('[gelinho] modelos 3D indisponíveis, usando o desenho 2D', e?.message || e);
    });
}

// Pede as fotos de um modelo (fotografa na próxima oportunidade)
// Modelo pelo nome (as placas têm um modelo por largura: "floe36", "floe70"...)
function subjectOf(name) {
  if (SUBJECTS[name]) return SUBJECTS[name];
  if (name.startsWith('floe')) return floeSubject(Number(name.slice(4)));
  return null;
}

export function want(name) {
  loadModel();
  if (status[name] || !subjectOf(name)) return;
  status[name] = 'queued';
  queue.push(name);
  pump();
}

let busy = false;
function pump() {
  if (busy || model.state !== 'ready' || !model.studio || !queue.length) return;
  busy = true;
  const name = queue.shift();
  const subject = subjectOf(name);
  const gen = model.studio.shoot(subject);
  const t0 = performance.now();
  const step = () => {
    let r;
    try {
      r = gen.next();
    } catch (e) {
      console.info(`[gelinho] modelo 3D "${name}" falhou, usando o 2D`, e?.message || e);
      busy = false;
      status[name] = 'done';
      pump();
      return;
    }
    if (!r.done) {
      setTimeout(step, 0);
      return;
    }
    const pre = name === 'player' ? '' : `${name}:`;
    for (const [k, c] of Object.entries(r.value)) model.sprites[pre + k] = c;
    status[name] = 'done';
    model.bakeMs += Math.round(performance.now() - t0);
    busy = false;
    pump();
  };
  setTimeout(step, 0);
}

// Foto pronta (ou null)
export function sprite(name, key) {
  if (model.state !== 'ready' || !model.sprites) return null;
  return model.sprites[name === 'player' ? key : `${name}:${key}`] || null;
}

function blit(ctx, img, b) {
  ctx.drawImage(img, b.left, -b.top, b.right - b.left, b.top - b.bottom);
}

// ---------------------------------------------------------------- Jogador
// Desenha o jogador com a foto da pose; devolve false se não houver foto (usar o 2D)
export function drawPlayer3D(ctx, p, t, cold, ride = 0) {
  want('player');
  const ps = playerPose(p, t);
  const img = ps && sprite('player', ps.key);
  if (!img) return false;
  ctx.save();
  if (p.state === 'drown' && p.sinkLine != null) {
    ctx.beginPath();
    ctx.rect(0, 0, W, p.sinkLine);
    ctx.clip();
  }
  if (p.state === 'swim') {
    // Boiando: da cintura para baixo fica dentro d'água
    ctx.beginPath();
    ctx.rect(0, 0, W, p.y + 6);
    ctx.clip();
    ride = POWERS.swimDepth + Math.sin(t * 4) * 2;
  }
  ctx.globalAlpha = p.alpha;
  let x = p.x;
  const freezing = p.state === 'freeze' ? Math.min(p.t / 1.0, 1) : 0;
  const shiver = p.state === 'freeze' ? 1 - freezing : cold;
  if (shiver > 0 && p.state !== 'jump') x += Math.sin(t * 70) * 1.3 * shiver;
  // Sombra no chão (como no desenho 2D)
  if (p.state === 'stand' || p.state === 'freeze' || p.state === 'enter' || p.state === 'flee') {
    ctx.fillStyle = 'rgba(20, 50, 70, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, p.y + 1 + ride, 17, 4, 0, 0, TAU);
    ctx.fill();
  }
  ctx.translate(x, p.y + ride);
  const sq = p.squash || 0;
  let sx = 1 + 0.12 * sq;
  let sy = 1 - 0.14 * sq;
  if (ps.anim === 'idle') sy *= 1 + Math.sin(t * 2.4) * 0.018;
  else if (ps.anim === 'jump') {
    const k = Math.sin(Math.min(p.t, 1) * Math.PI);
    sy *= 1 + 0.1 * k;
    sx *= 1 - 0.06 * k;
  }
  if (p.crouch > 0) {
    // Agachado para caber na porta, inclinado para frente
    sy *= 1 - 0.22 * p.crouch;
    ctx.rotate(0.2 * p.crouch * p.facing);
  }
  const sc = p.scale ?? 1;
  ctx.scale(sx * sc, sy * sc);
  blit(ctx, img, player.box);
  // "!" do susto e a camada de gelo, iguais aos do desenho 2D
  ctx.scale(p.facing, 1);
  drawPlayerMarks(ctx, p, t, p.state === 'flee', freezing);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- Urso
export function drawBear3D(ctx, b, t) {
  want('bear');
  const img = sprite('bear', bear.bearPose(b, t));
  if (!img) return false;
  ctx.save();
  ctx.fillStyle = 'rgba(70, 105, 125, 0.25)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 58, 7, 0, 0, TAU);
  ctx.fill();
  ctx.translate(b.x, b.y);
  ctx.scale(1, 1 + Math.sin(t * 2) * 0.008);
  blit(ctx, img, bear.box);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- Bichos
// Ponto de apoio de cada bicho na fileira (o mesmo do desenho 2D)
const ANCHOR = {
  goose: (c, y, t) => ({ y: y - 30 + Math.sin(t * 3 + c.ph) * 3 }),
  crab: (c, y) => ({ y: y + 4, water: y + 8, cover: 48 }),
  clam: (c, y) => ({ y: y + 6, water: y + 11, cover: 40 }),
  fish: (c, y, t) => {
    const s = Math.sin(t * 4 + c.ph);
    const hop = Math.max(0, s) * 18;
    return { y: y + 8 - hop, tilt: Math.cos(t * 4 + c.ph) * (s > 0 ? -0.45 : 0) * c.dir, water: y + 9, cover: hop < 6 ? 40 : 0, hop };
  },
};

export function drawCritter3D(ctx, c, y, t) {
  const subject = SUBJECTS[c.kind];
  if (!subject || !CRITTERS_3D.has(c.kind)) return false;
  want(c.kind);
  const img = sprite(c.kind, subject.pose(c, t));
  if (!img) return false;
  const a = ANCHOR[c.kind](c, y, t);
  ctx.save();
  if (c.kind === 'goose') {
    ctx.fillStyle = 'rgba(2, 28, 46, 0.25)';
    ctx.beginPath();
    ctx.ellipse(c.x, y + 18, 18, 4, 0, 0, TAU);
    ctx.fill();
  }
  if (a.water != null) {
    // Só a parte acima da água aparece (como no 2D)
    ctx.beginPath();
    ctx.rect(c.x - 70, a.water - 120, 140, 120);
    ctx.clip();
  }
  ctx.translate(c.x, a.y);
  if (a.tilt) ctx.rotate(a.tilt);
  blit(ctx, img, subject.box);
  ctx.restore();
  if (a.hop >= 6) {
    // Respingos ao sair da água
    ctx.fillStyle = 'rgba(207, 239, 250, 0.7)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.dir * (12 + i * 6), y + 9 - (a.hop - 6) * 0.3 * (i + 1) / 3, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  if (a.cover) {
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(c.x, a.water, a.cover / 2 - 4, 3, 0, 0, TAU);
    ctx.stroke();
  }
  return true;
}

// ---------------------------------------------------------------- Placas
// Mesmo formato do sprite 2D ({ canvas, ox, oy, w, h }); null enquanto não fica pronta
export function floeSprite3D(piece, active) {
  const cacheKey = active ? '3d-on' : '3d-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `floe${piece.w}`;
  want(name);
  const img = sprite(name, `${variantOf(piece)}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: FLOE_PAD, oy: FLOE_TOP, w: piece.w + FLOE_PAD * 2, h: FLOE_H };
  piece.sprites[cacheKey] = s;
  return s;
}
