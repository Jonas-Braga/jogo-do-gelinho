import {
  drawPlayer3D, drawBear3D, drawCritter3D, floeSprite3D, drawIgloo3D, drawIglooFrame3D, drawPower3D, drawSleigh3D, drawTree3D, drawBonus3D, logSprite3D, drawPine3D, drawMushroom3D, drawCabin3D,
  rockSprite3D, drawBase3D, drawLander3D, drawFlag3D, boardSprite3D, drawHut3D, drawPalm3D, drawParasol3D, drawBoat3D, pumpkinSprite3D, drawHaunted3D, drawDeadTree3D, drawJack3D,
  basaltSprite3D, drawCave3D, drawFern3D, drawNest3D, drawCaveTusks3D, background3D, photosBusy,
  CRITTERS_3D, THEMES_3D, FISH_3D,
} from './model3d.js';
import { W, H, SHORE_Y, SHORE_TOP, WATER_TOP, RULES, IGLOO, DEPTH } from './config.js';
import { drawLiquidSurface, drawReflection, reflects } from './water.js';
import {
  atDepth, floeTilt, visibleRange, withVolume, volume, sceneLight, camera, followCamera, swayLayer, Foreground, foregroundKind, contactShadow, drawHaze, drawWaterDepth, drawSunPath,
  drawLighting, drawVignette, Bokeh,
} from './depth.js';
import {
  makeBackground, floeSprite, drawPlayer, drawGoose, drawCrab, drawClam, drawFish, drawBear,
} from './sprites.js';
import { floeOffset } from './floes.js';
import { drawSleigh, drawChristmasTrees, drawIglooLights, xmasArt } from './christmas.js';
import {
  makeForestBackground, logSprite, drawSnake, drawBat, drawPiranha, drawForestDecor,
  drawCabin, drawCabinDoorFront, drawLeaves, drawFireflies, RIVER,
  forestArt,
} from './forest.js';
import {
  makeSpaceBackground, drawSpaceSky, asteroidSprite, drawUfo, drawCrawler, drawComet, drawStarBonus,
  drawSpaceDecor, drawBase, drawBaseDoorFront, drawStardust, DUST, spaceArt,
} from './space.js';
import {
  makeBeachBackground, drawBeachDecor, drawSkyGulls, boardSprite, drawGull, drawSiri, drawJellyfish,
  drawTropicalFish, drawHut, drawHutDoorFront, SEA, beachArt, drawSeaTraffic,
} from './beach.js';
import {
  makeHalloweenBackground, drawHalloweenSky, drawHalloweenDecor, pumpkinSprite, drawGhost, drawSpider,
  drawEyeball, drawCandy, drawHaunted, drawHauntedDoorFront, HAUNT, halloweenArt,
} from './halloween.js';
import {
  makeDinoBackground, drawDinoSky, drawDinoDecor, drawLavaBubbles, drawEmbers, rockSprite, drawPtero,
  drawRaptor, drawAmmonite, drawDinoEgg, drawCave, drawCaveDoorFront, LAVA, dinoArt,
} from './dino.js';
import { drawHud } from './hud.js';
import { drawMoneyBag, drawHeart, bonusArt } from './bonus.js';
import { drawCocoa } from './heat.js';
import { drawDuckFloat, drawGoldenBoot, drawPowerBack, drawPowerFront, drawDizzy, powerArt } from './powers.js';

const CRITTER_DRAW = {
  goose: drawGoose, crab: drawCrab, clam: drawClam, fish: drawFish,
  snake: drawSnake, bat: drawBat, piranha: drawPiranha,
  ufo: drawUfo, crawler: drawCrawler, comet: drawComet,
  gull: drawGull, siri: drawSiri, jellyfish: drawJellyfish,
  ghost: drawGhost, spider: drawSpider, eyeball: drawEyeball,
  ptero: drawPtero, raptor: drawRaptor, ammonite: drawAmmonite,
  bag: drawMoneyBag, heart: drawHeart,
  duck: drawDuckFloat, boot: drawGoldenBoot,
  cocoa: drawCocoa,
};

// Construções das fases especiais (o iglu se desenha sozinho)
// Casas 3D por estilo (as que ainda não têm ficam no 2D)
const HOUSE_3D = { cabin: drawCabin3D, base: drawBase3D, hut: drawHut3D, haunted: drawHaunted3D, cave: drawCave3D };
const HOUSE_DRAW = {
  cabin: { body: drawCabin, front: drawCabinDoorFront },
  base: { body: drawBase, front: drawBaseDoorFront },
  hut: { body: drawHut, front: drawHutDoorFront },
  haunted: { body: drawHaunted, front: drawHauntedDoorFront },
  cave: { body: drawCave, front: drawCaveDoorFront },
};

// Cores do "rio" de cada cenário (padrão = água gelada)
const WATERS = { forest: RIVER, space: DUST, beach: SEA, halloween: HAUNT, dino: LAVA };
const ICE_WATER = { water: ['#1C7E99', '#0E5670', '#052A40'], ripple: [190, 235, 250], bank: 'rgba(3, 30, 48, 0.35)' };
// Placas de cada cenário: gelo, troncos, asteroides ou pranchas
// Placas 3D por cenário (os que ainda não têm ficam no 2D)
const FLOE_3D = { ice: floeSprite3D, forest: logSprite3D, space: rockSprite3D, beach: boardSprite3D, halloween: pumpkinSprite3D, dino: basaltSprite3D };
const FLOE_SPRITE = {
  forest: logSprite, space: asteroidSprite, beach: boardSprite, halloween: pumpkinSprite, dino: rockSprite,
};
// Cenários cujas placas já trazem o próprio reflexo na água (sem o espelho genérico)
const OWN_REFLECTION = new Set(['halloween']);
const FLOE_HALO = { forest: RIVER.halo, space: DUST.halo, beach: SEA.halo, halloween: HAUNT.halo, dino: LAVA.halo };
// Peixes de cada cenário (mesmos pontos): estrelinha no espaço, peixinho tropical na praia
const FISH_DRAW = { space: drawStarBonus, beach: drawTropicalFish, halloween: drawCandy, dino: drawDinoEgg };

// Bichos que voam ou flutuam: a sombra fica mais fraca e menor (estão longe do chão)
const FLYING = new Set(['goose', 'bat', 'ufo', 'comet', 'gull', 'ghost', 'ptero', 'jellyfish', 'eyeball']);
// Luz de cada cenário (sol, lua cheia, Terra): cor do banho de luz e do caminho na água
// key/shade/relief: cor da luz e da sombra no relevo dos personagens e força do relevo
const LIGHT = {
  space: { warm: [150, 190, 255], path: [150, 200, 255], strength: 0.6, haze: 0.5, key: [215, 230, 255], shade: [40, 40, 110], relief: 1 },
  // Noite: luar frio e fraco, sem névoa (a fase já tem a neblina rasteira própria)
  halloween: { warm: [190, 180, 255], path: [255, 240, 200], strength: 0.3, haze: 0, glow: 0, key: [205, 200, 255], shade: [40, 20, 80], relief: 0.85 },
  dino: { warm: [255, 170, 80], path: [255, 190, 110], strength: 1, haze: 1.1, key: [255, 200, 140], shade: [90, 40, 40], relief: 1 },
};

// Intensidade da aurora boreal (0 = nenhuma). Aparece nas fases avançadas,
// cresce com a fase e fica mais forte quando o céu escurece.
export function auroraStrength(level, skyF) {
  if (level < RULES.auroraFrom) return 0;
  const byLevel = Math.min(1, 0.45 + (level - RULES.auroraFrom) * 0.18);
  return byLevel * (0.35 + 0.65 * (1 - clamp01(skyF)));
}

const AURORA = [
  { base: 42, h: 80, freq: 0.0055, speed: 0.25, top: [160, 110, 255], bottom: [80, 255, 170], ph: 0 },
  { base: 70, h: 64, freq: 0.0075, speed: -0.18, top: [90, 200, 255], bottom: [120, 255, 160], ph: 2.1 },
  { base: 26, h: 54, freq: 0.004, speed: 0.12, top: [255, 120, 210], bottom: [110, 240, 200], ph: 4.2 },
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function hexToRgb(h) {
  return h.match(/\w\w/g).map((v) => parseInt(v, 16));
}
function mix(a, b, k) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Céu em três momentos: dia (temperatura cheia), entardecer, quase noite (0°).
const SKY = [
  { top: '1B2350', hor: 'C0607A', sun: 'FF8A5C' },
  { top: '3D6FA6', hor: 'F3B983', sun: 'FFC27A' },
  { top: '2A9CC0', hor: 'B4E0EC', sun: 'FFF6D8' },
];
function skyAt(f) {
  const k = clamp01(f) * 2;
  const i = Math.min(1, Math.floor(k));
  const a = SKY[i];
  const b = SKY[i + 1];
  const u = k - i;
  return { top: mix(a.top, b.top, u), hor: mix(a.hor, b.hor, u), sun: mix(a.sun, b.sun, u) };
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.bg = makeBackground();
    this.skyF = 1;
    this.bokeh = new Bokeh();
    this.foreground = new Foreground();
    this.lastT = 0;
    this.slow = 0;
    // Só 3D (jogo de verdade): nada cai para o desenho 2D antigo. O que ainda não tem a
    // foto pronta simplesmente não aparece, e a tela inicial espera as fotos da fase 1
    // (os testes deixam desligado e continuam com o desenho 2D)
    this.only3d = false;
    this.hooked = new Map();
  }

  // Gancho 3D dos enfeites: no modo só 3D sempre "desenhou" (sem cair no 2D)
  hook(fn) {
    if (!this.only3d) return fn;
    let w = this.hooked.get(fn);
    if (!w) this.hooked.set(fn, (w = (...a) => { fn(...a); return true; }));
    return w;
  }

  // Tela inicial no modo só 3D enquanto as fotos da fase 1 não ficam prontas (ou num
  // aparelho sem 3D): fundo liso em vez do cenário
  hideScene(game) {
    return !!(this.only3d && game.state === 'title' && game.graphicsStatus() !== 'ok');
  }

  // Volume desligado sozinho se o aparelho não aguentar (fps baixo por alguns segundos)
  // Não conta enquanto a fase não está rolando (passagem de fase, comemoração) nem
  // enquanto as fotos 3D estão sendo tiradas: essas quedas são passageiras e antes
  // desligavam o volume (e a água nova) pelo resto da partida. Depois de uma dessas
  // pausas espera o fps médio se recuperar (2 s) antes de voltar a contar.
  watchFps(game, dt) {
    if (!volume.enabled || !(game.fps > 0) || game.time < 4) return;
    if (game.state !== 'play' || photosBusy()) {
      this.slow = 0;
      this.slowRelief = 0;
      this.settle = 2;
      return;
    }
    if (this.settle > 0) {
      this.settle -= dt;
      return;
    }
    // Primeiro degrau: sem o relevo (o mais caro)
    if (volume.relief && DEPTH.relief) {
      this.slowRelief = game.fps < DEPTH.relief.minFps ? (this.slowRelief || 0) + dt : 0;
      if (this.slowRelief > 2) {
        volume.relief = false;
        console.info('[gelinho] fps baixo: relevo dos personagens desligado');
      }
    }
    this.slow = game.fps < DEPTH.minFps ? this.slow + dt : 0;
    if (this.slow > 3) {
      volume.enabled = false;
      console.info('[gelinho] fps baixo: volume dos personagens desligado');
    }
  }

  draw(game) {
    const ctx = this.ctx;
    const t = game.time;
    if (game.state !== 'levelEnd' && game.state !== 'trophy') {
      this.skyF += (game.temp / RULES.tempStart - this.skyF) * 0.05;
    }
    const sky = skyAt(this.skyF);
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    this.watchFps(game, dt);
    // Câmera acompanhando o jogador (só no canvas de verdade: os testes no Node não mudam)
    const tr = ctx.getTransform ? ctx.getTransform() : null;
    // A câmera só vale durante este desenho (fora dele camera.x = 0: projeções puras)
    camera.x = this.camX || 0;
    // Modelos 3D nas fases normais e nas especiais já convertidas (THEMES_3D); as
    // outras seguem inteiras em 2D até ganharem os seus modelos
    this.normal3d = !!(this.use3d && DEPTH.model3d?.enabled && (!game.special || THEMES_3D.has(game.special.id)));
    powerArt.on = this.normal3d;
    powerArt.draw = this.hook(drawPower3D);
    xmasArt.on = this.normal3d;
    xmasArt.sleigh = this.hook(drawSleigh3D);
    xmasArt.tree = this.hook(drawTree3D);
    bonusArt.on = this.normal3d;
    bonusArt.draw = this.hook(drawBonus3D);
    forestArt.on = this.normal3d;
    forestArt.pine = this.hook(drawPine3D);
    forestArt.mushroom = this.hook(drawMushroom3D);
    spaceArt.on = this.normal3d;
    spaceArt.lander = this.hook(drawLander3D);
    spaceArt.flag = this.hook(drawFlag3D);
    beachArt.on = this.normal3d;
    beachArt.palm = this.hook(drawPalm3D);
    beachArt.parasol = this.hook(drawParasol3D);
    beachArt.boat = this.hook(drawBoat3D);
    halloweenArt.on = this.normal3d;
    halloweenArt.tree = this.hook(drawDeadTree3D);
    halloweenArt.jack = this.hook(drawJack3D);
    dinoArt.on = this.normal3d;
    dinoArt.fern = this.hook(drawFern3D);
    dinoArt.nest = this.hook(drawNest3D);
    dinoArt.tusks = this.hook(drawCaveTusks3D);
    if (DEPTH.sway && tr && typeof tr.a === 'number') followCamera(game.player.x, dt);

    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * 12;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    ctx.fillStyle = '#04192a';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    if (this.hideScene(game)) {
      // Fundo liso de noite polar enquanto o 3D não fica pronto
      const bgG = ctx.createLinearGradient(0, 0, 0, H);
      bgG.addColorStop(0, '#0B2440');
      bgG.addColorStop(1, '#04121F');
      ctx.fillStyle = bgG;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.restore();
      camera.x = 0;
      drawHud(ctx, game);
      return;
    }
    const sp = game.special;
    const scenery = sp?.scenery || null;
    const forest = scenery === 'forest';
    const space = scenery === 'space';
    const halloween = scenery === 'halloween';
    const dino = scenery === 'dino';
    const far = DEPTH.sway.far;
    const shore = DEPTH.sway.shore;
    this.aurora = sp?.aurora === false ? 0 : auroraStrength(game.level, this.skyF);
    swayLayer(ctx, far, () => {
      if (space) drawSpaceSky(ctx, t, this.skyF);
      else if (halloween) drawHalloweenSky(ctx, t, this.skyF);
      else if (dino) drawDinoSky(ctx, t, this.skyF);
      else this.drawSky(ctx, sky);
      if (this.aurora > 0) this.drawAurora(ctx, t, this.aurora);
    });
    // Os fundos das fases especiais só são criados quando a fase aparece pela primeira vez
    let bg = this.bg;
    if (forest) bg = this.forestBg ||= makeForestBackground();
    else if (space) bg = this.spaceBg ||= makeSpaceBackground();
    else if (scenery === 'beach') bg = this.beachBg ||= makeBeachBackground();
    else if (halloween) bg = this.halloweenBg ||= makeHalloweenBackground();
    else if (dino) bg = this.dinoBg ||= makeDinoBackground();
    // Cenário 3D (foto do mesmo tamanho), quando já existe para este cenário e está pronto
    if (this.normal3d) bg = background3D(scenery || 'ice') || (this.only3d ? null : bg);
    if (bg) swayLayer(ctx, shore, () => ctx.drawImage(bg.canvas, 0, 0, bg.w, bg.h));
    const lt = LIGHT[scenery] || { warm: sky.sun, path: sky.sun, strength: 1, haze: 1 };
    // Luz do relevo dos personagens: a cor do sol misturada ao branco
    sceneLight.key = lt.key || sky.sun.map((v) => Math.round(255 - (255 - v) * 0.35));
    sceneLight.shade = lt.shade || [60, 80, 130];
    sceneLight.strength = lt.relief ?? 1;
    const horizon = space ? [120, 80, 220] : halloween ? HAUNT.sky : dino ? LAVA.sky : sky.hor;
    // Perspectiva atmosférica: o cenário distante se perde na cor do horizonte
    drawHaze(ctx, horizon, lt.haze);
    ctx.save();
    ctx.translate(-camera.x * far, 0);
    if (scenery === 'beach') drawSkyGulls(ctx, t);
    if (sp?.sleigh) drawSleigh(ctx, game.sleigh, t);
    ctx.translate(-camera.x * (shore - far), 0);
    // Barco e jet ski no mar ao fundo (atrás dos enfeites da costa)
    if (sp?.boats) drawSeaTraffic(ctx, game.boats, t);
    if (sp?.decor === 'natal') drawChristmasTrees(ctx, t);
    if (sp?.decor === 'floresta') drawForestDecor(ctx, t);
    if (sp?.decor === 'espaco') drawSpaceDecor(ctx, t);
    if (sp?.decor === 'praia') drawBeachDecor(ctx, t);
    if (sp?.decor === 'halloween') drawHalloweenDecor(ctx, t);
    if (sp?.decor === 'dino') drawDinoDecor(ctx, t);
    if (forest) drawFireflies(ctx, t, 1 - this.skyF);
    ctx.restore();
    // No espaço o "reflexo do céu" na poeira é o roxo do horizonte
    // No espaço e no Halloween o "reflexo do céu" na água é a cor do horizonte noturno
    const reflect = space ? { hor: [120, 80, 220] } : halloween ? { hor: HAUNT.sky } : dino ? { hor: LAVA.sky } : sky;
    swayLayer(ctx, (shore + 1) / 2, () => {
      this.drawWater(ctx, t, reflect, WATERS[scenery] || ICE_WATER, scenery || 'ice');
      if (dino) drawLavaBubbles(ctx, t);
    });
    drawWaterDepth(ctx, horizon, (lt.glow ?? 1) * (reflects(scenery || 'ice') ? 0.35 : 1));
    // O caminho de luz acompanha o sol (camada do céu)
    swayLayer(ctx, far, () => drawSunPath(ctx, t, 300, lt.path, lt.strength * (0.45 + 0.55 * clamp01(this.skyF + (sp ? 0.4 : 0)))));
    game.particles.drawRipples(ctx);
    this.drawEntities(ctx, game, t);
    game.particles.drawPuffs(ctx);
    game.particles.drawFx(ctx);
    game.particles.drawDrops(ctx);
    // Luz do sol (ou da lua) banhando a cena: quente do lado dela, fria do outro
    drawLighting(ctx, 300, lt.warm, lt.strength);

    // Escurecimento do entardecer
    const dusk = 1 - this.skyF;
    if (dusk > 0.01) {
      ctx.fillStyle = `rgba(25, 30, 85, ${dusk * 0.3})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    game.particles.drawTexts(ctx);
    if (game.particles.leaves) drawLeaves(ctx, game.particles.snow, t);
    else if (game.particles.stardust) drawStardust(ctx, game.particles.snow, t);
    else if (game.particles.embers) drawEmbers(ctx, game.particles.snow, t);
    else if (!game.particles.calm) game.particles.drawSnow(ctx);
    // Flocos (ou brasas) desfocados bem na frente da câmera
    const parts = game.particles;
    if (DEPTH.bokeh && !parts.calm && !parts.leaves && !parts.stardust) {
      this.bokeh.update(dt, parts.embers);
      this.bokeh.draw(ctx, parts.embers ? [255, 150, 60] : [255, 255, 255], parts.embers ? 0.3 : 0.2);
    }
    // Primeiro plano desfocado (passa na frente de tudo, anda mais que a fileira da frente)
    if (DEPTH.foreground) this.foreground.draw(ctx, foregroundKind(scenery), 0.95);
    drawVignette(ctx);
    ctx.restore();
    this.camX = camera.x;
    camera.x = 0;

    drawHud(ctx, game);
  }

  drawSky(ctx, sky) {
    const g = ctx.createLinearGradient(0, 0, 0, SHORE_TOP);
    g.addColorStop(0, rgb(sky.top));
    g.addColorStop(1, rgb(sky.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, SHORE_TOP + 30);

    // Sol baixo, descendo conforme a temperatura cai
    const sy = 60 + (1 - this.skyF) * 110;
    const sx = 300;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    halo.addColorStop(0, rgb(sky.sun, 0.55));
    halo.addColorStop(1, rgb(sky.sun, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = rgb(sky.sun, 0.95);
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dica "↑ entrar" flutuando sobre a porta quando o jogador está em frente a ela
  drawDoorHint(ctx, game, t) {
    const x = game.igloo.doorX;
    const y = IGLOO.baseY - IGLOO.ry - 28 + Math.sin(t * 5) * 3;
    ctx.save();
    ctx.font = '700 15px system-ui, sans-serif';
    const label = '↑ entrar';
    const w = ctx.measureText(label).width + 22;
    ctx.fillStyle = 'rgba(6, 30, 45, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 16, w, 26, 13);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 10);
    ctx.lineTo(x + 6, y + 10);
    ctx.lineTo(x, y + 17);
    ctx.fill();
    ctx.fillStyle = '#FFD36B';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 2);
    ctx.restore();
  }

  // Cortinas de luz ondulando: faixas verticais com gradiente, somadas com 'lighter'.
  drawAurora(ctx, t, strength) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const stripW = 6;
    for (const a of AURORA) {
      const g = ctx.createLinearGradient(0, 0, 0, a.h);
      g.addColorStop(0, `rgba(${a.top.join(',')}, 0)`);
      g.addColorStop(0.35, `rgba(${a.top.join(',')}, 0.16)`);
      g.addColorStop(0.8, `rgba(${a.bottom.join(',')}, 0.3)`);
      g.addColorStop(1, `rgba(${a.bottom.join(',')}, 0)`);
      ctx.fillStyle = g;
      for (let x = -10; x < W + 10; x += stripW) {
        const y = a.base + Math.sin(x * a.freq + t * a.speed + a.ph) * 22 + Math.sin(x * a.freq * 3.1 - t * a.speed * 2) * 7;
        // Brilho que corre ao longo da cortina
        const shimmer = 0.55 + 0.45 * Math.sin(x * 0.03 - t * 1.4 + a.ph);
        ctx.globalAlpha = strength * shimmer;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillRect(0, 0, stripW + 1, a.h);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Água gelada, o rio esverdeado da floresta ou a poeira estelar do espaço
  drawWater(ctx, t, sky, pal = ICE_WATER, kind = 'ice') {
    const top = WATER_TOP + 10;
    const g = ctx.createLinearGradient(0, top, 0, H);
    const c = pal.water;
    g.addColorStop(0, c[0]);
    g.addColorStop(0.4, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // Reflexo do céu perto da superfície (bem mais fraco quando há o reflexo de verdade
    // do cenário, senão ele some numa névoa clara)
    const mirror = reflects(kind);
    const r = ctx.createLinearGradient(0, top, 0, top + 140);
    r.addColorStop(0, rgb(sky.hor, mirror ? 0.12 : kind === 'dino' ? 0.14 : 0.35));
    r.addColorStop(1, rgb(sky.hor, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, top, W, 140);
    // Reflexo do cenário na água (montanhas, costa e barranco espelhados), antes das ondas
    drawReflection(ctx, t, kind);
    // Sombra do paredão de gelo (ou do barranco) na água
    ctx.fillStyle = pal.bank;
    ctx.fillRect(0, top, W, 6);

    // Superfície de líquido (src/water.js), sempre: a ondulação antiga de traços e os
    // brilhos em cruz do desenho 2D foram removidos (sem canvas de verdade, só o degradê)
    drawLiquidSurface(ctx, t, kind);
  }

  drawEntities(ctx, game, t) {
    const p = game.player;
    const cold = p.alive ? clamp01((12 - game.temp) / 12) : 0;
    // De pé numa placa, o personagem sobe e desce junto com ela
    const ride = (p.state === 'stand' || p.state === 'freeze') && p.row >= 0 && p.support
      ? floeOffset(p.support, t) : 0;
    const outfits = game.special?.outfits || {};
    // Profundidade do jogador: a linha do chão sob ele (no pulo, entre as duas fileiras)
    const rowY = (r) => (r >= 0 ? game.rows[r]?.y ?? SHORE_Y : SHORE_Y);
    let pGround = rowY(p.row);
    if (p.state === 'jump' && p.y0 != null) pGround = p.y0 + (p.y1 - p.y0) * clamp01(p.t);
    // Com um poder: boia de patinho na cintura ou brilho e chuteira dourada
    const drawP = () => atDepth(ctx, pGround, () => {
      if (p.state === 'jump') contactShadow(ctx, p.x, pGround + 3, 22, pGround - p.y);
      drawPowerBack(ctx, p, t);
      // Piloto 3D: na fase normal (parka) usa as fotos do modelo 3D quando prontas
      if (!(this.normal3d && (drawPlayer3D(ctx, p, t, cold, ride, outfits.player) || this.only3d))) {
        withVolume(ctx, [p.x - 64, p.y - 150, p.x + 64, p.y + 26], (g) => drawPlayer(g, p, t, cold, ride, outfits.player), undefined, { key: p });
      }
      drawPowerFront(ctx, p, t);
    });
    // O jogador é desenhado depois da última fileira que está "atrás" dele.
    let bucket = -1;
    game.rows.forEach((r, i) => { if (r.y <= p.y + 16) bucket = i; });
    if ((p.state === 'drown' || p.state === 'freeze' || p.state === 'swim') && p.row >= 0) bucket = Math.max(bucket, p.row);

    const house = HOUSE_DRAW[game.igloo.style];
    // Costa: a casa, o urso e o jogador na costa ficam na escala do fundo
    atDepth(ctx, SHORE_Y, () => {
      // Fase normal: iglu 3D (a moldura da porta também, inclusive por cima de quem entra)
      game.igloo.frameHook = this.normal3d && !house ? this.hook(drawIglooFrame3D) : null;
      // Casa 3D da fase (iglu ou a casa do tema já convertido); senão, o desenho 2D
      const house3d = this.normal3d && (house ? HOUSE_3D[game.igloo.style] : drawIgloo3D);
      if (!(house3d && (house3d(ctx, game.igloo, t) || this.only3d))) withVolume(ctx, [IGLOO.x - 200, IGLOO.baseY - 300, IGLOO.x + 200, IGLOO.baseY + 30], (g) => {
        if (house) house.body(g, game.igloo, t);
        else game.igloo.draw(g, t);
      }, undefined, { key: game.igloo });
      if (game.special?.decor === 'natal' && game.igloo.complete) drawIglooLights(ctx, t);
    });
    if (game.bear.active) {
      const b = game.bear;
      atDepth(ctx, b.y, () => {
        // Fase normal: urso 3D quando a foto estiver pronta
        const bear3d = this.normal3d && drawBear3D(ctx, b, t, outfits.bear);
        if (!bear3d && !(this.normal3d && this.only3d)) withVolume(ctx, [b.x - 150, b.y - 190, b.x + 150, b.y + 24], (g) => drawBear(g, b, t, outfits.bear), undefined, { key: b });
        if (b.stun > 0) drawDizzy(ctx, b.x, b.y - 92, t);
      });
    }
    if (p.state !== 'gone' && bucket === -1) {
      drawP();
      // Passando pela porta: moldura do arco, sombra do interior e cortina por cima dele
      if (p.inDoorway) {
        atDepth(ctx, SHORE_Y, () => {
          if (house) house.front(ctx, game.igloo, t);
          else game.igloo.drawDoorFront(ctx, t);
        });
      }
    }
    if (game.atDoor) atDepth(ctx, SHORE_Y, () => this.drawDoorHint(ctx, game, t));
    const scenery = game.special?.scenery;
    const fishDraw = FISH_DRAW[scenery] || drawFish;
    game.rows.forEach((row, i) => {
      const [minX, maxX] = visibleRange(row.y, 60);
      atDepth(ctx, row.y, () => {
        const tilt = floeTilt(row.y);
        ctx.save();
        ctx.translate(0, row.y);
        ctx.scale(1, tilt);
        ctx.translate(0, -row.y);
        this.drawRow(ctx, row, t, scenery);
        ctx.restore();
        for (const c of game.critters.inRow(i)) {
          if (c.x <= minX || c.x >= maxX) continue;
          const draw2d = c.kind === 'fish' ? fishDraw : CRITTER_DRAW[c.kind];
          // Bichos 3D (o desenho 2D vale até a foto ficar pronta); o peixe vira o modelo
          // do tema (estrelinha no espaço) ou fica 2D nos temas ainda não convertidos
          const kind3d = c.kind === 'fish' ? FISH_3D[scenery] || (FISH_DRAW[scenery] ? null : 'fish') : c.kind;
          const try3d = this.normal3d && kind3d && CRITTERS_3D.has(kind3d);
          const only = try3d && this.only3d;
          const draw = try3d ? (g, cc, y, tt) => drawCritter3D(g, cc, y, tt, kind3d) || only || draw2d(g, cc, y, tt) : draw2d;
          if (c.kicked) {
            // Chutado: voa girando por cima da fileira
            ctx.save();
            ctx.translate(c.x, row.y - 18 + c.fly);
            ctx.rotate(c.spin);
            ctx.translate(-c.x, -(row.y - 18));
            draw(ctx, c, row.y, t);
            ctx.restore();
          } else {
            const fly = FLYING.has(c.kind);
            contactShadow(ctx, c.x, row.y + 4, fly ? 18 : 24, fly ? 40 : 0, fly ? 0.18 : 0.26);
            if (!(try3d && (drawCritter3D(ctx, c, row.y, t, kind3d) || only))) {
              withVolume(ctx, [c.x - 80, row.y - 120, c.x + 80, row.y + 50], (g) => draw2d(g, c, row.y, t), undefined, { key: c });
            }
          }
        }
      });
      if (p.state !== 'gone' && bucket === i) drawP();
    });
  }

  // Placas de gelo, troncos (floresta) ou asteroides (espaço), conforme o cenário
  drawRow(ctx, row, t, scenery = null) {
    // Fase normal: blocos de gelo 3D quando as fotos estiverem prontas
    // Placas/troncos 3D quando a fase está convertida e as fotos estão prontas
    const sprite2d = FLOE_SPRITE[scenery] || floeSprite;
    const sprite3d = this.normal3d && FLOE_3D[scenery || 'ice'];
    const sprite = sprite3d ? (pc, on) => sprite3d(pc, on) || (this.only3d ? null : sprite2d(pc, on)) : sprite2d;
    const items = [];
    const [minX, maxX] = visibleRange(row.y);
    for (const r of row.rects()) {
      if (r.x > maxX || r.x + r.w < minX) continue;
      const y = row.y + floeOffset(r.piece, t);
      const s = sprite(r.piece, row.active);
      if (s) items.push({ x: r.x, y, w: r.w, s });
    }
    const halo = (FLOE_HALO[scenery] || [79, 195, 247]).join(', ');
    // Sombras, reflexos e brilho primeiro, para não cobrirem as placas vizinhas
    for (const it of items) {
      ctx.fillStyle = 'rgba(2, 28, 46, 0.32)';
      ctx.beginPath();
      ctx.ellipse(it.x + it.w / 2 + 4, it.y + 28, it.w / 2 + 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // As abóboras 2D já trazem o reflexo pintado; as fotos 3D, não
      if (!OWN_REFLECTION.has(scenery) || it.s.is3d) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.translate(it.x - it.s.ox, it.y + 19);
        ctx.scale(1, -0.5);
        ctx.drawImage(it.s.canvas, 0, -(it.s.oy + 19), it.s.w, it.s.h);
        ctx.restore();
      }
      if (row.active) {
        // Halo elíptico (gradiente radial achatado, sem bordas cortadas)
        const R = it.w * 0.8;
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + 6);
        ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
        g.addColorStop(0, `rgba(${halo}, ${0.32 + Math.sin(t * 4) * 0.06})`);
        g.addColorStop(1, `rgba(${halo}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const it of items) ctx.drawImage(it.s.canvas, it.x - it.s.ox, it.y - it.s.oy, it.s.w, it.s.h);
  }
}
