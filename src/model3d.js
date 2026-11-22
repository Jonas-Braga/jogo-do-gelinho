// Visual "renderizado": os personagens são montados em 3D com o Three.js (src/m3d/)
// e "fotografados" em sprites, como nos jogos de personagens pré-renderizados.
// Depois disso o jogo continua 2D: cada quadro só desenha a foto certa.
// Cada modelo é fotografado só quando aparece pela primeira vez, aos poucos (algumas
// poses por quadro) para não travar o jogo. Enquanto a foto não fica pronta, ou sem
// internet/WebGL, vale o desenho 2D de sempre.
import { DEPTH, W, IGLOO } from './config.js';
import { Studio } from './m3d/kit.js';
import * as player from './m3d/player.js';
import * as bear from './m3d/bear.js';
import { goose, crab, clam, fish } from './m3d/critters.js';
import { floeSubject, variantOf, PAD as FLOE_PAD, TOP as FLOE_TOP, H as FLOE_H } from './m3d/floes.js';
import { dome as iglooDome, porch as iglooPorch, BLOCKS as IGLOO_BLOCKS } from './m3d/igloo.js';
import { duck as duckItem, boot as bootItem } from './m3d/powers.js';
import { sleigh as sleighModel, tree as treeModel, TREE_H } from './m3d/christmas.js';
import { bag as bagModel, heart as heartModel } from './m3d/bonus.js';
import { snake, bat, piranha, logSubject, LOG, pine as pineModel, PINE_H, mushroom as mushroomModel, cabin as cabinModel } from './m3d/forest.js';
import { CABIN, CABIN_PIECES, drawCabinDoor } from './forest.js';
import {
  alien, ufo, crawler, comet, star, rockSubject, ROCK, base as baseModel, lander as landerModel, flag as flagModel, LANDER_LIGHT,
} from './m3d/space.js';
import { BASE, BASE_PIECES, drawBaseDoor, drawUfoBeam, drawCometTail, drawCometDust, drawStarGlow } from './space.js';
import {
  giantCrab, gull, siri, jellyfish, tfish, boardSubject, BOARD, BOARD_SCHEMES, hut as hutModel, palms as palmModels, parasol as parasolModel,
} from './m3d/beach.js';
import { HUT, HUT_PIECES, drawHutDoor, drawTorchFlame, isBuoy } from './beach.js';
import { DOOR, easeOutBack } from './igloo.js';
import { drawPlayerMarks } from './sprites.js';
import { POWERS } from './powers.js';

const M = DEPTH.model3d;
const TAU = Math.PI * 2;

export const SUBJECTS = {
  player, bear, goose, crab, clam, fish, igloo: iglooDome, porch: iglooPorch, duck: duckItem, boot: bootItem,
  // Natal
  'player-sweater': player.withOutfit('sweater'), 'bear-santa': bear.withVariant('santa'), sleigh: sleighModel, xtree: treeModel,
  // Floresta
  'player-lumberjack': player.withOutfit('lumberjack'), 'bear-brown': bear.withVariant('brown'),
  snake, bat, piranha, pine: pineModel, mushroom: mushroomModel, cabin: cabinModel,
  // Espaço
  'player-astronaut': player.withOutfit('astronaut'), alien, ufo, crawler, comet, star, base: baseModel, lander: landerModel, flag: flagModel,
  // Praia
  'player-surfer': player.withOutfit('surfer'), giantCrab, gull, siri, jellyfish, tfish, hut: hutModel, parasol: parasolModel,
  ...Object.fromEntries(palmModels.map((m, k) => [`palm${k}`, m])),
  // Prêmios das fases especiais (iguais em todas)
  bag: bagModel, heart: heartModel,
};
// Fases especiais já convertidas ao 3D (as outras seguem inteiras em 2D)
export const THEMES_3D = new Set(['natal', 'floresta', 'espaco', 'praia']);
// Modelo do jogador por roupa e do urso por variante (null = sem modelo 3D: desenho 2D)
const PLAYER_BY_OUTFIT = { parka: 'player', sweater: 'player-sweater', lumberjack: 'player-lumberjack', astronaut: 'player-astronaut', surfer: 'player-surfer' };
const BEAR_BY_OUTFIT = { polar: 'bear', santaHat: 'bear-santa', brown: 'bear-brown', alien: 'alien', giantCrab: 'giantCrab' };
export const CRITTERS_3D = new Set(['goose', 'crab', 'clam', 'fish', 'snake', 'bat', 'piranha', 'ufo', 'crawler', 'comet', 'star', 'gull', 'siri', 'jellyfish', 'tfish']);
// O que substitui o peixe em cada cenário convertido (sem entrada = o peixe 3D normal)
export const FISH_3D = { space: 'star', beach: 'tfish' };
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
  if (name.startsWith('log')) return logSubject(Number(name.slice(3)));
  if (name.startsWith('rock')) return rockSubject(Number(name.slice(4)));
  if (name.startsWith('board')) return boardSubject(Number(name.slice(5)));
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
export function drawPlayer3D(ctx, p, t, cold, ride = 0, outfit = 'parka') {
  const name = PLAYER_BY_OUTFIT[outfit || 'parka'];
  if (!name) return false;
  want(name);
  const ps = playerPose(p, t);
  const img = ps && sprite(name, ps.key);
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
export function drawBear3D(ctx, b, t, outfit = 'polar') {
  const name = BEAR_BY_OUTFIT[outfit || 'polar'];
  if (!name) return false;
  want(name);
  const img = sprite(name, (SUBJECTS[name].pose || bear.bearPose)(b, t));
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
  // Floresta
  snake: (c, y) => ({ y: y - 3, shadow: [c.x, y + 1, 22, 3, 'rgba(15, 35, 25, 0.25)'] }),
  bat: (c, y, t) => ({ y: y - 32 + Math.sin(t * 4 + c.ph) * 5, shadow: [c.x, y + 16, 16, 3.5, 'rgba(15, 35, 25, 0.25)'] }),
  piranha: (c, y, t) => {
    const s = Math.sin(t * 3.2 + c.ph);
    const hop = Math.max(0, s) * 14;
    return {
      y: y + 6 - hop, tilt: Math.cos(t * 3.2 + c.ph) * (s > 0 ? -0.4 : 0) * c.dir, water: y + 9,
      cover: hop < 5 ? 40 : 0, hop, splash: { min: 5, off: 10, color: 'rgba(210, 240, 220, 0.7)' },
    };
  },
  // Espaço: o facho do disco, a cauda e a poeira do cometa e o brilho da estrela são 2D
  ufo: (c, y, t) => ({
    y: y - 30 + Math.sin(t * 3 + c.ph) * 4, tilt: Math.sin(t * 2 + c.ph) * 0.06 * c.dir,
    before: (ctx) => drawUfoBeam(ctx, c, y, t),
  }),
  crawler: (c, y) => ({ y: y - 2, shadow: [c.x, y + 2, 18, 3, 'rgba(10, 5, 30, 0.3)'] }),
  comet: (c, y, t) => ({
    y: y + 2 - Math.max(0, Math.sin(t * 3 + c.ph)) * 10,
    before: (ctx) => drawCometTail(ctx, c, y, t), after: (ctx) => drawCometDust(ctx, c, y, t),
  }),
  star: (c, y, t) => ({ y: y - 8 + Math.sin(t * 4 + c.ph) * 3, before: (ctx) => drawStarGlow(ctx, c, y, t) }),
  // Praia
  gull: (c, y, t) => ({ y: y - 32 + Math.sin(t * 3 + c.ph) * 4, shadow: [c.x, y + 16, 16, 3.5, 'rgba(4, 70, 90, 0.22)'] }),
  siri: (c, y) => ({ y: y - 2, shadow: [c.x, y + 2, 18, 3, 'rgba(4, 70, 90, 0.25)'] }),
  jellyfish: (c, y, t) => ({
    y: y + 2 - Math.max(0, Math.sin(t * 4 + c.ph)) * 5,
    after: (ctx) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(c.x, y + 9, 18, 3, 0, 0, TAU);
      ctx.stroke();
    },
  }),
  tfish: (c, y, t) => {
    const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 12;
    return { y: y + 4 - hop, tilt: hop > 2 ? -0.25 * c.dir : 0, water: y + 9, cover: hop < 3 ? 36 : 0 };
  },
};

// kind: o modelo a usar (a estrelinha do espaço é um "peixe" com outro modelo)
export function drawCritter3D(ctx, c, y, t, kind = c.kind) {
  const subject = SUBJECTS[kind];
  if (!subject || !CRITTERS_3D.has(kind)) return false;
  want(kind);
  const img = sprite(kind, subject.pose(c, t));
  if (!img) return false;
  const a = ANCHOR[kind](c, y, t);
  a.before?.(ctx);
  ctx.save();
  if (c.kind === 'goose') a.shadow = [c.x, y + 18, 18, 4, 'rgba(2, 28, 46, 0.25)'];
  if (a.shadow) {
    const [sx, sy, rx, ry, col] = a.shadow;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU);
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
  const sp = a.splash || { min: 6, off: 12, color: 'rgba(207, 239, 250, 0.7)' };
  if (a.hop >= sp.min) {
    // Respingos ao sair da água
    ctx.fillStyle = sp.color;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.dir * (sp.off + i * 6), y + 9 - (a.hop - sp.min) * 0.3 * (i + 1) / 3, 1.6, 0, TAU);
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
  a.after?.(ctx);
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

// ---------------------------------------------------------------- Iglu
// Mesmo comportamento do Igloo.draw 2D: sombra, contornos-guia do que falta, blocos
// caindo com o quique (easeOutBack) e o pórtico (o interior, a luz e a cortina vêm
// do 2D; só a moldura é a foto 3D, via igloo.frameHook)
export function drawIgloo3D(ctx, igloo, t) {
  want('igloo');
  want('porch');
  const blocks = Math.min(igloo.count, IGLOO_BLOCKS);
  // Blocos já assentados (os primeiros com a animação no fim)
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  if (blocks > 0 && !sprite('igloo', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('igloo', `n${settled}`)) return false;
  const { rx } = IGLOO;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(70, 105, 125, 0.22)';
  ctx.beginPath();
  ctx.ellipse(6, 3, rx + 12, 9, 0, 0, TAU);
  ctx.fill();
  if (!igloo.complete) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(120, 160, 180, 0.45)';
    ctx.lineWidth = 1.5;
    igloo.dome(ctx);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('igloo', `n${settled}`), iglooDome.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('igloo', `b${i}`), iglooDome.box);
    ctx.restore();
  }
  ctx.restore();
  if (!igloo.complete) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(120, 160, 180, 0.45)';
    ctx.lineWidth = 1.5;
    igloo.archPath(ctx, DOOR.porchRx, DOOR.porchRy);
    ctx.stroke();
    ctx.restore();
  }
  igloo.drawPorch(ctx, t);
  return true;
}

// Moldura do pórtico em 3D (chamada pelo Igloo.drawFrame); false = desenho 2D
export function drawIglooFrame3D(ctx) {
  want('porch');
  const img = sprite('porch', 'frame');
  if (!img) return false;
  ctx.save();
  ctx.translate(DOOR.x, DOOR.bottom);
  blit(ctx, img, iglooPorch.box);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- Itens de poder
// Gancho de src/powers.js (powerArt.draw): desenha a boia ou a chuteira 3D no ponto de
// apoio atual. dir < 0: o desenho 2D está espelhado; a foto já vem virada, então desfaz.
export function drawPower3D(ctx, name, part, dir, scale = 1) {
  want(name);
  const img = sprite(name, `${part}${dir < 0 ? 'L' : 'R'}`);
  if (!img) return false;
  ctx.save();
  if (dir < 0) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  blit(ctx, img, SUBJECTS[name].box);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- Natal
// Ganchos de src/christmas.js (xmasArt). O trenó chega espelhado e na escala do
// desenho 2D; a foto já vem virada, então só desfaz o espelho.
export function drawSleigh3D(ctx, s) {
  want('sleigh');
  const img = sprite('sleigh', sleighModel.pose(s));
  if (!img) return false;
  ctx.save();
  if (s.dir < 0) ctx.scale(-1, 1);
  blit(ctx, img, sleighModel.box);
  ctx.restore();
  return true;
}

// Árvore de Natal com a base em (0, 0) e altura h (a foto é de uma árvore de 104)
export function drawTree3D(ctx, h) {
  want('xtree');
  const img = sprite('xtree', 'tree');
  if (!img) return false;
  ctx.save();
  ctx.scale(h / TREE_H, h / TREE_H);
  blit(ctx, img, treeModel.box);
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------- Prêmios
// Gancho de src/bonus.js (bonusArt): saco de dinheiro ou coração no ponto de apoio atual
export function drawBonus3D(ctx, name) {
  want(name);
  const img = sprite(name, name);
  if (!img) return false;
  blit(ctx, img, SUBJECTS[name].box);
  return true;
}

// ---------------------------------------------------------------- Floresta
// Troncos: mesmo formato do sprite 2D (logSprite)
export function logSprite3D(piece, active) {
  const cacheKey = active ? '3d-log-on' : '3d-log-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `log${piece.w}`;
  want(name);
  const img = sprite(name, `${piece.seed % LOG.VARIANTS}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: LOG.PAD, oy: LOG.TOP, w: piece.w + LOG.PAD * 2, h: LOG.H };
  piece.sprites[cacheKey] = s;
  return s;
}

// Gancho de src/forest.js (forestArt): pinheiro com base em (0, 0) e altura h, com o
// balanço do vento; cogumelo na escala s
export function drawPine3D(ctx, h, sway) {
  want('pine');
  const img = sprite('pine', 'pine');
  if (!img) return false;
  ctx.save();
  ctx.rotate(sway * 2.5);
  ctx.scale(h / PINE_H, h / PINE_H);
  blit(ctx, img, pineModel.box);
  ctx.restore();
  return true;
}

export function drawMushroom3D(ctx) {
  want('mushroom');
  const img = sprite('mushroom', 'm');
  if (!img) return false;
  blit(ctx, img, mushroomModel.box);
  return true;
}

// Cabana 3D: mesmo comportamento da drawCabin 2D (sombra, contorno-guia, peças caindo
// com o quique, janela acesa e a porta 2D por cima)
export function drawCabin3D(ctx, igloo, t) {
  want('cabin');
  const N = CABIN_PIECES.length - 1; // a última peça é a porta
  const blocks = Math.min(igloo.count, N);
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  if (blocks > 0 && !sprite('cabin', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('cabin', `n${settled}`)) return false;
  const { CW, WALL_H, PEAK, EAVE, ROOF_T } = CABIN;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(30, 50, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(6, 5, CW + 26, 10, 0, 0, TAU);
  ctx.fill();
  if (igloo.count < CABIN_PIECES.length) {
    const roofY = (x) => -WALL_H - PEAK + Math.abs(x) * (PEAK / (CW + EAVE * 0.2));
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-CW, 0);
    ctx.lineTo(-CW, -WALL_H);
    ctx.lineTo(-CW - EAVE, roofY(-CW - EAVE) + ROOF_T);
    ctx.lineTo(0, -WALL_H - PEAK);
    ctx.lineTo(CW + EAVE, roofY(CW + EAVE) + ROOF_T);
    ctx.lineTo(CW, -WALL_H);
    ctx.lineTo(CW, 0);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('cabin', `n${settled}`), cabinModel.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('cabin', `b${i}`), cabinModel.box);
    ctx.restore();
  }
  // Janela acesa depois que o lenhador entra (luz quente por cima do vidro)
  const win = CABIN_PIECES.findIndex((p) => p.kind === 'window');
  if (igloo.lit && blocks > win) {
    ctx.fillStyle = `rgba(255, 196, 110, ${0.85 + Math.sin(t * 5) * 0.08})`;
    ctx.fillRect(-70, -47, 28, 25.5);
    ctx.fillStyle = '#4A2C16';
    ctx.fillRect(-57.5, -47, 3, 25.5);
    ctx.fillRect(-70, -35.7, 28, 3);
  }
  ctx.restore();
  drawCabinDoor(ctx, igloo, t);
  return true;
}

// ---------------------------------------------------------------- Espaço
// Asteroides: mesmo formato do sprite 2D (asteroidSprite)
export function rockSprite3D(piece, active) {
  const cacheKey = active ? '3d-rock-on' : '3d-rock-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `rock${piece.w}`;
  want(name);
  const img = sprite(name, `${piece.seed % ROCK.VARIANTS}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: ROCK.PAD, oy: ROCK.TOP, w: piece.w + ROCK.PAD * 2, h: ROCK.H };
  piece.sprites[cacheKey] = s;
  return s;
}

// Ganchos de src/space.js (spaceArt): módulo de pouso (com a luzinha da antena
// piscando em 2D) e bandeira, já transladados para a base de cada um
export function drawLander3D(ctx, t) {
  want('lander');
  const img = sprite('lander', 'l');
  if (!img) return false;
  blit(ctx, img, landerModel.box);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#FF5A4A' : '#7A2A24';
  ctx.beginPath();
  ctx.arc(LANDER_LIGHT.x, LANDER_LIGHT.y * Math.cos(landerModel.elevation), 2.4, 0, TAU);
  ctx.fill();
  return true;
}

export function drawFlag3D(ctx) {
  want('flag');
  const img = sprite('flag', 'f');
  if (!img) return false;
  blit(ctx, img, flagModel.box);
  return true;
}

// Luz vermelha na ponta da antena da base (pisca com a base pronta). Posição da ponta
// na foto: prato em (−30, 136, −32) girado (0,25; 0; 0,5), a ponta 12 acima dele,
// projetada com a câmera de elevação 0,2
const BASE_LIGHT = { x: -36, y: -149 };

// Base lunar 3D: mesmo comportamento da drawBase 2D (sombra, contornos-guia, peças
// caindo com o quique, luz de dentro acesa e a porta 2D por cima)
export function drawBase3D(ctx, igloo, t) {
  want('base');
  const N = BASE_PIECES.length - 1; // a última peça é a porta
  const blocks = Math.min(igloo.count, N);
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  const settledKey = settled === N && igloo.lit ? 'lit' : `n${settled}`;
  if (blocks > 0 && !sprite('base', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('base', settledKey)) return false;
  const { MW, MH, DOME } = BASE;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(20, 15, 40, 0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 3, MW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (igloo.count < BASE_PIECES.length) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(230, 230, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-MW, -MH, MW * 2, MH, [24, 24, 4, 4]);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -MH, DOME.rx, DOME.ry, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('base', settledKey), baseModel.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('base', `b${i}`), baseModel.box);
    ctx.restore();
  }
  if (igloo.complete && Math.sin(t * 5) > 0) {
    ctx.fillStyle = '#FF4A4A';
    ctx.beginPath();
    ctx.arc(BASE_LIGHT.x, BASE_LIGHT.y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawBaseDoor(ctx, igloo, t);
  return true;
}

// ---------------------------------------------------------------- Praia
// Pranchas e boias: mesmo formato do sprite 2D (boardSprite)
export function boardSprite3D(piece, active) {
  const cacheKey = active ? '3d-board-on' : '3d-board-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `board${piece.w}`;
  want(name);
  const v = isBuoy(piece) ? 'b' : piece.seed % BOARD_SCHEMES.length;
  const img = sprite(name, `${v}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: BOARD.PAD, oy: BOARD.TOP, w: piece.w + BOARD.PAD * 2, h: BOARD.H };
  piece.sprites[cacheKey] = s;
  return s;
}

// Ganchos de src/beach.js (beachArt): coqueiro k (já na base dele, girando com o
// vento) e o guarda-sol com cadeira e castelo de areia
export function drawPalm3D(ctx, k, angle) {
  const name = `palm${k}`;
  if (!SUBJECTS[name]) return false;
  want(name);
  const img = sprite(name, 'p');
  if (!img) return false;
  ctx.save();
  ctx.rotate(angle);
  blit(ctx, img, SUBJECTS[name].box);
  ctx.restore();
  return true;
}

export function drawParasol3D(ctx) {
  want('parasol');
  const img = sprite('parasol', 'u');
  if (!img) return false;
  blit(ctx, img, parasolModel.box);
  return true;
}

// Cabana de palha 3D: mesmo comportamento da drawHut 2D (sombra, contornos-guia,
// peças caindo com o quique, janela acesa, chamas das tochas e a porta 2D por cima)
export function drawHut3D(ctx, igloo, t) {
  want('hut');
  const N = HUT_PIECES.length - 1; // a última peça é a porta
  const blocks = Math.min(igloo.count, N);
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  const settledKey = settled === N && igloo.lit ? 'lit' : `n${settled}`;
  if (blocks > 0 && !sprite('hut', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('hut', settledKey)) return false;
  const { HW, WALL_H, ROOF } = HUT;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(150, 110, 50, 0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (igloo.count < HUT_PIECES.length) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(120, 85, 30, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.beginPath();
    ctx.moveTo(-ROOF.eave, ROOF.base);
    ctx.lineTo(0, ROOF.peak);
    ctx.lineTo(ROOF.eave, ROOF.base);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('hut', settledKey), hutModel.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('hut', `b${i}`), hutModel.box);
    ctx.restore();
  }
  // Chamas das tochas já assentadas (tremulando, em 2D)
  HUT_PIECES.forEach((p, i) => {
    if (p.kind === 'torch' && i < settled) drawTorchFlame(ctx, p.side, t);
  });
  ctx.restore();
  drawHutDoor(ctx, igloo, t);
  return true;
}
