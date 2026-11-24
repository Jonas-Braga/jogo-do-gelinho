// Visual "renderizado": os personagens são montados em 3D com o Three.js (src/m3d/)
// e "fotografados" em sprites, como nos jogos de personagens pré-renderizados.
// Depois disso o jogo continua 2D: cada quadro só desenha a foto certa.
// Cada modelo é fotografado só quando aparece pela primeira vez, aos poucos (algumas
// poses por quadro) para não travar o jogo. Enquanto a foto não fica pronta, ou sem
// internet/WebGL, vale o desenho 2D de sempre.
import { Sky3D } from './m3d/sky3d.js';
import { Water3D } from './m3d/water3d.js';
import { prepareSurface } from './water.js';
import { DEPTH, W, IGLOO, BLOCK_W } from './config.js';
import { levelParams } from './levels.js';
import { Studio } from './m3d/kit.js';
import * as player from './m3d/player.js';
import * as bear from './m3d/bear.js';
import { goose, crab, clam, fish } from './m3d/critters.js';
import { floeSubject, variantOf, PAD as FLOE_PAD, TOP as FLOE_TOP, H as FLOE_H } from './m3d/floes.js';
import { dome as iglooDome, porch as iglooPorch, BLOCKS as IGLOO_BLOCKS } from './m3d/igloo.js';
import { duck as duckItem, boot as bootItem } from './m3d/powers.js';
import { sleigh as sleighModel, tree as treeModel, TREE_H } from './m3d/christmas.js';
import { bag as bagModel, heart as heartModel, cocoa as cocoaModel } from './m3d/bonus.js';
import { snake, bat, piranha, logSubject, LOG, pine as pineModel, PINE_H, mushroom as mushroomModel, cabin as cabinModel } from './m3d/forest.js';
import { CABIN, CABIN_PIECES, drawCabinDoor } from './forest.js';
import {
  alien, ufo, crawler, comet, star, rockSubject, ROCK, base as baseModel, lander as landerModel, flag as flagModel, LANDER_LIGHT,
} from './m3d/space.js';
import { BASE, BASE_PIECES, drawBaseDoor, drawUfoBeam, drawCometTail, drawCometDust, drawStarGlow } from './space.js';
import {
  giantCrab, gull, siri, jellyfish, tfish, boardSubject, BOARD, BOARD_SCHEMES, hut as hutModel, palms as palmModels, parasol as parasolModel, sailboat, jetski, boatPose,
} from './m3d/beach.js';
import { HUT, HUT_PIECES, drawHutDoor, drawTorchFlame, isBuoy } from './beach.js';
import {
  werewolf, ghost, spider, eyeball, candy, pumpkinSubject, PUMP, jack as jackModel, JACK_R, deadTree as deadTreeModel, haunted as hauntedModel,
} from './m3d/halloween.js';
import { HAUNTED, HAUNTED_PIECES, drawHauntedDoor, drawWindowSilhouette, drawWindowGlow, drawLanternGlow } from './halloween.js';
import {
  trex, ptero, raptor, ammonite, egg as eggModel, basaltSubject, BASALT, cave as caveModel, caveTusks, fern as fernModel, nest as nestModel,
} from './m3d/dino.js';
import { CAVE, CAVE_PIECES, drawCaveDoor, drawCaveTorchFlame } from './dino.js';
import { DOOR, easeOutBack } from './igloo.js';
import { drawPlayerMarks } from './sprites.js';
import { POWERS } from './powers.js';
import { iceScenery, forestScenery, spaceScenery, beachScenery, halloweenScenery, dinoScenery, BG_H } from './m3d/scenery.js';
import { SHORE_TOP } from './config.js';

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
  'player-surfer': player.withOutfit('surfer'), giantCrab, gull, siri, jellyfish, tfish, hut: hutModel, parasol: parasolModel, sailboat, jetski,
  ...Object.fromEntries(palmModels.map((m, k) => [`palm${k}`, m])),
  // Halloween
  'player-wizard': player.withOutfit('wizard'), werewolf, ghost, spider, eyeball, candy, jack: jackModel, deadTree: deadTreeModel, haunted: hauntedModel,
  // Dinossauros
  'player-caveman': player.withOutfit('caveman'), trex, ptero, raptor, ammonite, egg: eggModel, cave: caveModel, caveTusks, fern: fernModel, nest: nestModel,
  // Prêmios das fases especiais (iguais em todas)
  bag: bagModel, heart: heartModel, cocoa: cocoaModel,
  // Cenários de fundo (uma foto do tamanho do fundo 2D)
  'bg-ice': iceScenery, 'bg-forest': forestScenery, 'bg-space': spaceScenery, 'bg-beach': beachScenery, 'bg-halloween': halloweenScenery, 'bg-dino': dinoScenery,
};
// Fases especiais já convertidas ao 3D (as outras seguem inteiras em 2D)
export const THEMES_3D = new Set(['natal', 'floresta', 'espaco', 'praia', 'halloween', 'dinossauros']);
// Modelo do jogador por roupa e do urso por variante (null = sem modelo 3D: desenho 2D)
const PLAYER_BY_OUTFIT = { parka: 'player', sweater: 'player-sweater', lumberjack: 'player-lumberjack', astronaut: 'player-astronaut', surfer: 'player-surfer', wizard: 'player-wizard', caveman: 'player-caveman' };
const BEAR_BY_OUTFIT = { polar: 'bear', santaHat: 'bear-santa', brown: 'bear-brown', alien: 'alien', giantCrab: 'giantCrab', werewolf: 'werewolf', trex: 'trex' };
export const CRITTERS_3D = new Set(['goose', 'crab', 'clam', 'fish', 'snake', 'bat', 'piranha', 'ufo', 'crawler', 'comet', 'star', 'gull', 'siri', 'jellyfish', 'tfish', 'ghost', 'spider', 'eyeball', 'candy', 'ptero', 'raptor', 'ammonite', 'egg']);
// O que substitui o peixe em cada cenário convertido (sem entrada = o peixe 3D normal)
export const FISH_3D = { space: 'star', beach: 'tfish', halloween: 'candy', dino: 'egg' };
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
  if (name.startsWith('pumpkin')) return pumpkinSubject(Number(name.slice(7)));
  if (name.startsWith('basalt')) return basaltSubject(Number(name.slice(6)));
  return null;
}

export function want(name) {
  loadModel();
  if (status[name] || !subjectOf(name)) return;
  status[name] = 'queued';
  // Cenários de fundo passam na frente (é a maior imagem da tela)
  if (name.startsWith('bg-')) queue.unshift(name);
  else queue.push(name);
  pump();
}

let busy = false;
// Alguma foto sendo tirada (ou na fila)? O jogo fica mais lento nesses momentos
export const photosBusy = () => busy || (model.state === 'ready' && queue.length > 0);

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
  // Cada "urso" na caixa em que foi fotografado (lobisomem e T-rex são maiores)
  blit(ctx, img, SUBJECTS[name].box || bear.box);
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
  // Halloween: o brilho do fantasma, o fio da aranha e os anéis na água são 2D
  ghost: (c, y, t) => {
    const by = y - 34 + Math.sin(t * 3 + c.ph) * 5;
    return {
      y: by, shadow: [c.x, y + 14, 14, 3, 'rgba(20, 10, 40, 0.25)'],
      before: (ctx) => {
        const glow = ctx.createRadialGradient(c.x, by, 4, c.x, by, 30);
        glow.addColorStop(0, 'rgba(220, 210, 255, 0.35)');
        glow.addColorStop(1, 'rgba(220, 210, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(c.x - 30, by - 30, 60, 60);
      },
    };
  },
  spider: (c, y) => ({
    y: y - 8, shadow: [c.x, y + 2, 18, 3, 'rgba(20, 10, 40, 0.3)'],
    before: (ctx) => {
      ctx.strokeStyle = 'rgba(230, 230, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(c.x - c.dir * 6, y - 18);
      ctx.lineTo(c.x - c.dir * 22, y - 68);
      ctx.stroke();
    },
  }),
  eyeball: (c, y, t) => ({
    y: y + 3 + Math.sin(t * 3 + c.ph) * 2, water: y + 8,
    after: (ctx) => {
      ctx.strokeStyle = 'rgba(205, 180, 255, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(c.x, y + 8, 16, 3, 0, 0, TAU);
      ctx.stroke();
    },
  }),
  // Dinossauros: o brilho do ovo e os anéis na lava são 2D
  ptero: (c, y, t) => ({
    y: y - 36 + Math.sin(t * 3 + c.ph) * 4 - Math.sin(t * 9 + c.ph * 3) * 2, shadow: [c.x, y + 13, 18, 3, 'rgba(30, 10, 5, 0.3)'],
  }),
  raptor: (c, y) => ({ y, shadow: [c.x, y + 2, 20, 3, 'rgba(30, 10, 5, 0.3)'] }),
  ammonite: (c, y, t) => ({
    y: y + 2 + Math.sin(t * 3 + c.ph) * 2,
    after: (ctx) => {
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(c.x, y + 8, 16, 3, 0, 0, TAU);
      ctx.stroke();
    },
  }),
  egg: (c, y, t) => {
    const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 14;
    const ey = y - 4 - hop;
    return {
      y: ey, tilt: Math.sin(t * 6 + c.ph) * 0.3 * c.dir,
      before: (ctx) => {
        const gl = ctx.createRadialGradient(c.x, ey, 2, c.x, ey, 18);
        gl.addColorStop(0, 'rgba(255, 250, 200, 0.35)');
        gl.addColorStop(1, 'rgba(255, 250, 200, 0)');
        ctx.fillStyle = gl;
        ctx.fillRect(c.x - 18, ey - 18, 36, 36);
      },
      after: (ctx) => {
        if (hop >= 3) return;
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
        ctx.stroke();
      },
    };
  },
  candy: (c, y, t) => {
    const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 14;
    return {
      y: y + 2 - hop, tilt: t * 3 * c.dir + c.ph,
      after: (ctx) => {
        if (hop >= 3) return;
        ctx.strokeStyle = 'rgba(205, 180, 255, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
        ctx.stroke();
      },
    };
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

// Barco ou jet ski no mar ao fundo da Praia (linha d'água em 0, 0; a esteira é 2D)
export function drawBoat3D(ctx, v) {
  const name = v.kind === 'sail' ? 'sailboat' : 'jetski';
  want(name);
  const img = sprite(name, boatPose(v));
  if (!img) return false;
  blit(ctx, img, SUBJECTS[name].box);
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

// ---------------------------------------------------------------- Halloween
// Abóboras no rio: mesmo formato do sprite 2D (pumpkinSprite). A foto 3D não traz o
// reflexo pintado (is3d): o renderizador desenha o reflexo na água
export function pumpkinSprite3D(piece, active) {
  const cacheKey = active ? '3d-pump-on' : '3d-pump-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `pumpkin${piece.w}`;
  want(name);
  const img = sprite(name, `${piece.seed % PUMP.VARIANTS}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: PUMP.PAD, oy: PUMP.TOP, w: piece.w + PUMP.PAD * 2, h: PUMP.H, is3d: true };
  piece.sprites[cacheKey] = s;
  return s;
}

// Ganchos de src/halloween.js (halloweenArt): árvore seca e abóbora de rosto aceso
// (na base de cada uma; a abóbora de raio r é a foto de raio 15 em escala)
export function drawDeadTree3D(ctx) {
  want('deadTree');
  const img = sprite('deadTree', 't');
  if (!img) return false;
  blit(ctx, img, deadTreeModel.box);
  return true;
}

export function drawJack3D(ctx, r) {
  want('jack');
  const img = sprite('jack', 'j');
  if (!img) return false;
  ctx.save();
  ctx.scale(r / JACK_R, r / JACK_R);
  blit(ctx, img, jackModel.box);
  ctx.restore();
  return true;
}

// Casa assombrada 3D: mesmo comportamento da drawHaunted 2D (sombra, contornos-guia,
// peças caindo com o quique, janelas acesas com a silhueta e o brilho, brilho da
// lanterna e a porta 2D por cima)
export function drawHaunted3D(ctx, igloo, t) {
  want('haunted');
  const N = HAUNTED_PIECES.length - 1; // a última peça é a porta
  const blocks = Math.min(igloo.count, N);
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  const settledKey = settled === N && igloo.lit ? 'lit' : `n${settled}`;
  if (blocks > 0 && !sprite('haunted', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('haunted', settledKey)) return false;
  const { HW, WALL_H, ROOF } = HAUNTED;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(10, 6, 16, 0.4)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 32, 9, 0, 0, TAU);
  ctx.fill();
  if (igloo.count < HAUNTED_PIECES.length) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(201, 190, 224, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.beginPath();
    ctx.moveTo(-ROOF.eave, ROOF.base);
    ctx.lineTo(0, ROOF.peak);
    ctx.lineTo(ROOF.eave, ROOF.base);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('haunted', settledKey), hauntedModel.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('haunted', `b${i}`), hauntedModel.box);
    ctx.restore();
  }
  HAUNTED_PIECES.forEach((p, i) => {
    if (i >= settled) return;
    if (p.kind === 'window') {
      drawWindowSilhouette(ctx, p.side, t);
      drawWindowGlow(ctx, p.side);
    } else if (p.kind === 'lantern') drawLanternGlow(ctx, t);
  });
  ctx.restore();
  drawHauntedDoor(ctx, igloo, t);
  return true;
}

// ---------------------------------------------------------------- Dinossauros
// Pedras de basalto: mesmo formato do sprite 2D (rockSprite de src/dino.js)
export function basaltSprite3D(piece, active) {
  const cacheKey = active ? '3d-basalt-on' : '3d-basalt-off';
  if (piece.sprites[cacheKey]) return piece.sprites[cacheKey];
  const name = `basalt${piece.w}`;
  want(name);
  const D = BASALT.dims;
  const img = sprite(name, `${piece.seed % D.VARIANTS}${active ? 1 : 0}`);
  if (!img) return null;
  const s = { canvas: img, ox: D.PAD, oy: D.TOP, w: piece.w + D.PAD * 2, h: D.H };
  piece.sprites[cacheKey] = s;
  return s;
}

// Ganchos de src/dino.js (dinoArt): samambaia (já na base e na escala dela, girando
// com o vento), ninho (o ovo do meio balança por cima, quase chocando) e as presas
// de osso da caverna (por cima da pedra da porta)
export function drawFern3D(ctx, sway) {
  want('fern');
  const img = sprite('fern', 'f');
  if (!img) return false;
  ctx.save();
  ctx.rotate(sway * 0.4);
  blit(ctx, img, fernModel.box);
  ctx.restore();
  return true;
}

export function drawNest3D(ctx, wobble) {
  want('nest');
  want('egg');
  const img = sprite('nest', 'n');
  const eg = sprite('egg', 'e');
  if (!img || !eg) return false;
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(wobble);
  ctx.scale(8.5 / 8, 8.5 / 8);
  blit(ctx, eg, eggModel.box);
  ctx.restore();
  blit(ctx, img, nestModel.box);
  return true;
}

export function drawCaveTusks3D(ctx) {
  want('caveTusks');
  const img = sprite('caveTusks', 't');
  if (!img) return false;
  blit(ctx, img, caveTusks.box);
  return true;
}

// Caverna 3D: mesmo comportamento da drawCave 2D (sombra, contorno-guia, pedras
// caindo com o quique, chama da tocha, a entrada escura e a pedra 2D e as presas por
// cima da pedra quando pronta)
export function drawCave3D(ctx, igloo, t) {
  want('cave');
  want('caveTusks');
  const N = CAVE_PIECES.length - 1; // a última peça é a porta
  const blocks = Math.min(igloo.count, N);
  let settled = 0;
  while (settled < blocks && igloo.anim[settled] >= 1) settled++;
  if (blocks > 0 && !sprite('cave', `b${blocks - 1}`)) return false;
  if (settled > 0 && !sprite('cave', `n${settled}`)) return false;
  if (igloo.count >= CAVE_PIECES.length && !sprite('caveTusks', 't')) return false;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.4)';
  ctx.beginPath();
  ctx.ellipse(6, 3, CAVE.HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (igloo.count < CAVE_PIECES.length) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, CAVE.HW + 4, 136, 0, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }
  if (settled > 0) blit(ctx, sprite('cave', `n${settled}`), caveModel.box);
  for (let i = settled; i < blocks; i++) {
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    blit(ctx, sprite('cave', `b${i}`), caveModel.box);
    ctx.restore();
  }
  CAVE_PIECES.forEach((p, i) => {
    if (p.kind === 'torch' && i < settled) drawCaveTorchFlame(ctx, t);
  });
  ctx.restore();
  if (drawCaveDoor(ctx, igloo, t)) {
    ctx.save();
    ctx.translate(IGLOO.x, IGLOO.baseY);
    drawCaveTusks3D(ctx);
    ctx.restore();
  }
  return true;
}

// ---------------------------------------------------------------- Cenários de fundo
// Fundo 3D de um cenário, no mesmo formato do fundo 2D ({ canvas, w, h }), ou null
// enquanto a foto não fica pronta (vale o 2D). A névoa na base das montanhas e os
// brilhos da neve continuam em 2D, por cima da foto, como no desenho antigo.
export const SCENERY_3D = { ice: 'bg-ice', forest: 'bg-forest', space: 'bg-space', beach: 'bg-beach', halloween: 'bg-halloween', dino: 'bg-dino' };
const backgrounds = {};
export function background3D(kind) {
  const name = SCENERY_3D[kind];
  if (!name) return null;
  want(name);
  const img = sprite(name, 'main');
  const cached = backgrounds[name];
  // Depois de montado, a foto crua é liberada (fica só o fundo pronto, img = null);
  // a foto usada direto (sem canvas) só vale enquanto for a mesma
  if (cached && (cached.img ? cached.img === img : true)) return cached.bg;
  if (!img) return null;
  // Sem canvas de verdade (testes no Node): a foto direto
  if (typeof document === 'undefined' || !img.width) {
    backgrounds[name] = { img, bg: { canvas: img, w: W, h: BG_H } };
    return backgrounds[name].bg;
  }
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.scale(img.width / W, img.height / BG_H);
  if (kind === 'ice') iceFinish(g);
  else if (kind === 'forest') forestFinish(g);
  else if (kind === 'beach') beachFinish(g);
  backgrounds[name] = { img: null, bg: { canvas: c, w: W, h: BG_H } };
  delete model.sprites[`${name}:main`];
  return backgrounds[name].bg;
}

function iceFinish(g) {
  // Névoa na base das montanhas (esconde onde elas encontram o campo de neve)
  const grd = g.createLinearGradient(0, SHORE_TOP - 34, 0, SHORE_TOP + 4);
  grd.addColorStop(0, 'rgba(240, 248, 250, 0)');
  grd.addColorStop(1, 'rgba(240, 248, 250, 0.7)');
  g.fillStyle = grd;
  g.fillRect(0, SHORE_TOP - 34, W, 38);
  // Brilhos da neve
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(200, 230, 245, 0.6)';
    g.fillRect(rnd() * W, SHORE_TOP + 4 + rnd() * 62, 1.1, 1.1);
  }
}

function forestFinish(g) {
  // Névoa leve entre a mata e a clareira (como no 2D, mais fraca: a névoa 3D já existe)
  const grd = g.createLinearGradient(0, SHORE_TOP - 26, 0, SHORE_TOP + 4);
  grd.addColorStop(0, 'rgba(210, 230, 210, 0)');
  grd.addColorStop(1, 'rgba(210, 230, 210, 0.3)');
  g.fillStyle = grd;
  g.fillRect(0, SHORE_TOP - 26, W, 30);
}

function beachFinish(g) {
  let s = 41;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Brilhos do sol no mar (entre o horizonte e a onda)
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255, 255, 240, ${0.3 + rnd() * 0.5})`;
    g.fillRect(rnd() * W, 154 + rnd() * (SHORE_TOP - 160), 4 + rnd() * 10, 1);
  }
  // Espuma de bolinhas na beira do mar (como no 2D)
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let x = 0; x < W; x += 8 + rnd() * 10) {
    g.beginPath();
    g.arc(x, BG_H - 6 + rnd() * 4, 1.5 + rnd() * 2.5, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------------------------------------------------------------- Fotos da fase seguinte
// As fotos de um modelo só eram pedidas quando ele aparecia na tela, então no começo
// de uma fase com modelos novos (fase especial, bicho novo) o desenho 2D aparecia por
// um instante antes do 3D. `levelModels` lista tudo o que uma fase usa em 3D, para
// o jogo pedir antes (durante a contagem do bônus) e só começar a fase com tudo pronto.
const FLOE_PREFIX = { ice: 'floe', forest: 'log', space: 'rock', beach: 'board', halloween: 'pumpkin', dino: 'basalt' };
const FRAG_W = 36; // largura dos pedaços das placas fragmentadas (src/floes.js)
const HOUSE_MODELS = { igloo: ['igloo', 'porch'], cabin: ['cabin'], base: ['base'], hut: ['hut'], haunted: ['haunted'], cave: ['cave', 'caveTusks'] };
const DECOR_MODELS = {
  natal: ['xtree', 'sleigh'],
  floresta: ['pine', 'mushroom'],
  espaco: ['lander', 'flag'],
  praia: ['parasol', ...palmModels.map((_, k) => `palm${k}`), 'sailboat', 'jetski'],
  halloween: ['deadTree', 'jack'],
  dino: ['fern', 'nest', 'egg'],
};

export function levelModels(level) {
  const p = levelParams(level);
  const sp = p.special;
  if (sp && !THEMES_3D.has(sp.id)) return []; // fase especial ainda toda em 2D
  const scenery = sp?.scenery || 'ice';
  const out = [];
  // O que aparece logo no primeiro quadro: fundo, placas, casa, personagem e enfeites
  if (SCENERY_3D[scenery]) out.push(SCENERY_3D[scenery]);
  out.push(`${FLOE_PREFIX[scenery]}${p.fragmented ? FRAG_W : BLOCK_W}`);
  out.push(...(HOUSE_MODELS[sp?.house || 'igloo'] || []));
  out.push(PLAYER_BY_OUTFIT[sp?.outfits?.player || 'parka']);
  out.push(...(DECOR_MODELS[sp?.decor] || []));
  if (SKY_FLYERS[scenery]) out.push(SKY_FLYERS[scenery]); // bichos voando no céu
  // O que entra depois: urso, bichos, peixe e itens
  if (p.bear) out.push(BEAR_BY_OUTFIT[sp?.outfits?.bear || 'polar']);
  out.push(...(p.enemies || [p.enemy]));
  out.push(scenery === 'ice' ? 'fish' : FISH_3D[scenery]);
  out.push(...p.powers);
  if (p.heat) out.push('cocoa');
  if (sp) out.push('bag', 'heart');
  return [...new Set(out.filter((n) => n && subjectOf(n)))];
}

// Pede as fotos de uma fase (as que já existem não são refeitas)
// e a textura 2D da água do cenário (só para as ferramentas sem o modo só 3D: a fase
// não espera por ela; no jogo a água é a 3D ao vivo)
const sceneryOf = (level) => levelParams(level).special?.scenery || 'ice';
export function prefetchLevel(level) {
  prepareSurface(sceneryOf(level));
  for (const n of levelModels(level)) want(n);
}

// Todas as fotos da fase prontas? Sem 3D (Node, sem WebGL, Three.js indisponível)
// não há o que esperar.
// Água 3D ao vivo (src/m3d/water3d.js): criada quando o Three.js fica pronto
const live = { water: null, waterFailed: false };
export function water3D() {
  if (live.water || live.waterFailed || model.state !== 'ready') return live.water;
  try {
    live.water = new Water3D(model.studio.THREE);
  } catch (e) {
    live.waterFailed = true;
    console.info('[gelinho] água 3D indisponível', e?.message || e);
  }
  return live.water;
}
// Céu 3D ao vivo (src/m3d/sky3d.js)
export function sky3D() {
  if (live.sky || live.skyFailed || model.state !== 'ready') return live.sky;
  try {
    live.sky = new Sky3D(model.studio.THREE);
  } catch (e) {
    live.skyFailed = true;
    console.info('[gelinho] céu 3D indisponível', e?.message || e);
  }
  return live.sky;
}

// Bichos voando no céu ao fundo (no lugar das silhuetas 2D): modelos 3D pequenos, com
// a névoa da distância. Mesmos caminhos do 2D.
export const SKY_FLYERS = { halloween: 'bat', dino: 'ptero', beach: 'gull' };
const flyerBuf = { c: null };
function drawFlyer(ctx, kind, x, y, dir, ph, t, scale, haze, hazeA) {
  const subject = SUBJECTS[kind];
  if (!subject) return false;
  want(kind);
  const img = sprite(kind, subject.pose({ kind, dir, ph, x }, t));
  if (!img) return false;
  const b = subject.box;
  const w = Math.ceil((b.right - b.left) * scale) + 2;
  const h = Math.ceil((b.top - b.bottom) * scale) + 2;
  const c = (flyerBuf.c ||= document.createElement('canvas'));
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(img, 1, 1, w - 2, h - 2);
  // Névoa da distância por cima (só onde há bicho)
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = haze;
  g.globalAlpha = hazeA;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  ctx.drawImage(c, 0, 0, w, h, x - w / 2, y - h / 2, w, h);
  return true;
}

export function drawSkyFlyers3D(ctx, scenery, t, body) {
  const kind = SKY_FLYERS[scenery];
  if (!kind || typeof document === 'undefined') return;
  if (scenery === 'halloween') {
    // Revoada de morcegos (7 s atravessando, 9 s sem)
    const k = (t % 16) / 7;
    if (k > 1) return;
    for (let i = 0; i < 6; i++) {
      const x = -60 + k * (1280 + 120) - i * 34;
      const y = body.y - 20 + Math.sin(k * 9 + i * 1.7) * 18 + (i % 3) * 14;
      drawFlyer(ctx, kind, x, y, 1, i, t, 0.22 + (i % 2) * 0.05, 'rgb(40, 22, 60)', 0.35);
    }
  } else if (scenery === 'dino') {
    const k = (t % 19) / 9;
    if (k > 1) return;
    for (let i = 0; i < 4; i++) {
      const x = 1280 + 60 - k * (1280 + 160) + i * 46;
      const y = body.y - 30 + (i % 2) * 18 + Math.sin(k * 6 + i) * 8;
      drawFlyer(ctx, kind, x, y, -1, i, t, 0.3 - i * 0.03, 'rgb(150, 70, 70)', 0.4);
    }
  } else if (scenery === 'beach') {
    for (let i = 0; i < 4; i++) {
      const x = ((t * (14 + i * 4) + i * 330) % (1280 + 80)) - 40;
      const y = 50 + i * 18 + Math.sin(t * 0.8 + i) * 6;
      drawFlyer(ctx, kind, x, y, 1, i, t, 0.16 + (i % 2) * 0.04, 'rgb(170, 210, 235)', 0.3);
    }
  }
}

// A água 3D já pode ser desenhada? (sem 3D não há o que esperar)
export function water3DReady() {
  if (!M.enabled || typeof window === 'undefined' || !window.WebGLRenderingContext) return true;
  if (model.state === 'failed') return true;
  return (!!water3D() || live.waterFailed) && (!!sky3D() || live.skyFailed);
}

// O aparelho consegue mostrar o 3D? (falso sem WebGL ou se o Three.js não carregou)
export function model3dAvailable() {
  if (!M.enabled || typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
  return model.state !== 'failed';
}

export function levelReady(level) {
  if (!water3DReady()) return false;
  if (!M.enabled || typeof window === 'undefined' || !window.WebGLRenderingContext) return true;
  if (model.state === 'failed') return true;
  return levelModels(level).every((n) => status[n] === 'done');
}
