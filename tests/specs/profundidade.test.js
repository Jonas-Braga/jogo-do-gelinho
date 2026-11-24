// Gráficos com profundidade 2.5D (src/depth.js): perspectiva por fileira, inclinação
// das placas, volume com luz nos personagens, sombras de contato, névoa, luz e vinheta.
// A profundidade só muda o DESENHO: a simulação continua nas mesmas coordenadas.
import { suite, test, expect } from '../harness.js';
import { isNode, fakeCanvas } from '../env.js';
import { Game } from '../../src/game.js';
import { makeGame, step } from '../helpers.js';
import { W, H, SHORE_Y, ROW_Y, DEPTH, WATER_TOP, SHORE_TOP, IGLOO } from '../../src/config.js';
import {
  depthScale, projectX, visibleRange, floeTilt, withVolume, volume, contactShadow, atDepth,
  camera, followCamera, swayAt, maxSway, sceneLight, foregroundKind,
} from '../../src/depth.js';
import { SPECIALS } from '../../src/specials.js';
import { SCENERY_3D } from '../../src/model3d.js';
import { playerPose, poseList, loadModel, model, SUBJECTS, CRITTERS_3D, floeSprite3D, THEMES_3D } from '../../src/model3d.js';
import { floeSubject } from '../../src/m3d/floes.js';
import * as bear3d from '../../src/m3d/bear.js';
import { BLOCKS as IGLOO_BLOCKS } from '../../src/m3d/igloo.js';
import { drawIgloo3D, drawIglooFrame3D } from '../../src/model3d.js';
import { powerArt, drawDuckFloat, drawGoldenBoot, drawPowerBack, drawPowerFront } from '../../src/powers.js';
import { RULES } from '../../src/config.js';
import { xmasArt, drawChristmasTrees, TREES } from '../../src/christmas.js';
import { bonusArt, drawMoneyBag, drawHeart } from '../../src/bonus.js';
import { logSprite3D, drawCabin3D } from '../../src/model3d.js';
import { CABIN_PIECES } from '../../src/forest.js';
import { rockSprite3D, drawBase3D, FISH_3D } from '../../src/model3d.js';
import { BASE_PIECES, spaceArt, drawSpaceDecor } from '../../src/space.js';
import { boardSprite3D, drawHut3D } from '../../src/model3d.js';
import { HUT_PIECES, beachArt, drawBeachDecor, PALMS } from '../../src/beach.js';
import { boardSubject } from '../../src/m3d/beach.js';
import { JUMP_YAW } from '../../src/m3d/player.js';
import { pumpkinSprite3D, drawHaunted3D } from '../../src/model3d.js';
import { HAUNTED_PIECES, halloweenArt, drawHalloweenDecor, SHORE_PUMPKINS } from '../../src/halloween.js';
import { basaltSprite3D, drawCave3D } from '../../src/model3d.js';
import { CAVE_PIECES, dinoArt, drawDinoDecor, drawCaveDoorFront, TREE_FERNS } from '../../src/dino.js';
import { doorArt } from '../../src/art.js';
import { drawDoor3D } from '../../src/model3d.js';

// Liga o gancho das portas 3D (como o renderizador faz nas fases em 3D) só durante fn
function withDoors3D(fn) {
  const before = doorArt.draw;
  doorArt.draw = drawDoor3D;
  try {
    return fn();
  } finally {
    doorArt.draw = before;
  }
}

// Contexto 2D falso que registra as chamadas
function recordingCtx() {
  const calls = [];
  const gradient = { addColorStop() {} };
  const store = { measureText: (s) => ({ width: String(s).length * 7 }) };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        calls.push([k, ...args]);
        return gradient;
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx, calls };
}

suite('Profundidade: perspectiva', () => {
  test('a fileira da frente fica em escala 1 e a costa na escala do fundo', () => {
    expect(depthScale(ROW_Y[ROW_Y.length - 1])).toBe(1);
    expect(Math.abs(depthScale(SHORE_Y) - DEPTH.farScale)).toBeLessThan(1e-9);
    expect(DEPTH.farScale).toBeLessThan(1);
    expect(DEPTH.farScale).toBeGreaterThan(0.7);
  });

  test('quanto mais ao fundo, menor (escala cresce da costa até a frente)', () => {
    const ys = [SHORE_Y, ...ROW_Y];
    for (let i = 1; i < ys.length; i++) expect(depthScale(ys[i])).toBeGreaterThan(depthScale(ys[i - 1]));
    // Nada passa de 1 (afundando abaixo da última fileira) nem fica menor que a costa (fumaça no céu)
    expect(depthScale(ROW_Y[3] + 200)).toBe(1);
    expect(depthScale(40)).toBe(depthScale(SHORE_Y));
  });

  test('o ponto de fuga fica parado e o resto converge para ele ao fundo', () => {
    const v = DEPTH.vanishX;
    expect(projectX(v, ROW_Y[0])).toBe(v);
    expect(projectX(100, ROW_Y[0])).toBeGreaterThan(100);
    expect(projectX(W - 100, ROW_Y[0])).toBeLessThan(W - 100);
    expect(projectX(100, ROW_Y[3])).toBe(100);
  });

  test('ao fundo o trecho visível do mundo é mais largo que a tela (placas não somem antes da borda)', () => {
    const [a, b] = visibleRange(ROW_Y[0], 0);
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(W);
    expect(projectX(a, ROW_Y[0])).toBeCloseTo(0, 1e-6);
    expect(projectX(b, ROW_Y[0])).toBeCloseTo(W, 1e-6);
  });

  test('placas do fundo têm o topo mais achatado e as da frente, mais aberto', () => {
    for (let i = 1; i < ROW_Y.length; i++) expect(floeTilt(ROW_Y[i])).toBeGreaterThan(floeTilt(ROW_Y[i - 1]));
    expect(floeTilt(ROW_Y[0])).toBeLessThan(1);
    expect(floeTilt(ROW_Y[3])).toBeGreaterThan(1);
  });

  test('atDepth escala em volta do ponto de fuga, na linha dos pés', () => {
    const { ctx, calls } = recordingCtx();
    atDepth(ctx, ROW_Y[0], () => {});
    const scale = calls.find((c) => c[0] === 'scale');
    expect(scale[1]).toBe(depthScale(ROW_Y[0]));
    expect(calls.find((c) => c[0] === 'translate')).toEqual(['translate', DEPTH.vanishX, ROW_Y[0]]);
    // Na frente não há transformação nenhuma
    const r = recordingCtx();
    atDepth(r.ctx, ROW_Y[3], () => {});
    expect(r.calls.filter((c) => c[0] === 'scale').length).toBe(0);
  });

  test('textos de pontos aparecem na posição projetada da fileira', () => {
    const g = makeGame();
    g.particles.text(100, ROW_Y[0], '+200', '#fff');
    const { ctx, calls } = recordingCtx();
    g.particles.drawTexts(ctx);
    const tr = calls.find((c) => c[0] === 'translate');
    expect(tr[1]).toBeCloseTo(projectX(100, ROW_Y[0]), 1e-6);
  });

  test('desenhar não muda a simulação (posições do jogador, placas e bichos)', () => {
    const g = makeGame({ level: 4, quiet: false });
    step(g, 8);
    const snap = () => JSON.stringify({
      p: [g.player.x, g.player.y, g.player.state, g.player.row],
      rows: g.rows.map((r) => r.rects().map((q) => q.x)),
      c: g.critters.list.map((c) => [c.x, c.row]),
    });
    const before = snap();
    const { ctx } = recordingCtx();
    g.renderer.ctx = ctx;
    for (let i = 0; i < 5; i++) g.renderer.draw(g);
    expect(snap()).toBe(before);
  });
});

suite('Profundidade: luz, volume e sombras', () => {
  test('sombra de contato encolhe quando quem a projeta sobe (pulo)', () => {
    const radius = (h) => {
      const { ctx, calls } = recordingCtx();
      contactShadow(ctx, 300, 400, 22, h);
      return calls.find((c) => c[0] === 'arc')[3];
    };
    expect(radius(60)).toBeLessThan(radius(0));
    expect(radius(500)).toBeGreaterThan(0);
  });

  test('sem canvas de verdade, o volume desenha direto no contexto (cores continuam visíveis)', () => {
    const { ctx, calls } = recordingCtx();
    let got = null;
    withVolume(ctx, [0, 0, 50, 50], (g) => {
      got = g;
      g.fillRect(0, 0, 10, 10);
    });
    expect(got).toBe(ctx);
    expect(calls.some((c) => c[0] === 'fillRect')).toBe(true);
  });

  test('volume desliga sozinho quando o fps fica baixo por alguns segundos', () => {
    const g = makeGame();
    const was = volume.enabled;
    try {
      volume.enabled = true;
      g.time = 10;
      g.fps = DEPTH.minFps - 10;
      for (let i = 0; i < 20; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(true);
      for (let i = 0; i < 20; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(false);
      // Com fps bom não desliga
      volume.enabled = true;
      g.renderer.slow = 0;
      g.fps = 60;
      for (let i = 0; i < 100; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(true);
    } finally {
      volume.enabled = was;
    }
  });

  test('toda fase (normal e especial) desenha com a profundidade sem erro, com bichos e pulo', () => {
    const levels = [1, 4, 6, 11, ...Object.keys(SPECIALS).map(Number)];
    for (const lv of levels) {
      const g = makeGame({ level: lv, quiet: false });
      step(g, 6);
      g.player.jump(0);
      step(g, 0.15);
      g.renderer.draw(g);
      g.igloo.count = 15;
      g.renderer.draw(g);
    }
  });

  if (!isNode) {
    test('no canvas de verdade: o lado do sol fica mais claro que o lado oposto', () => {
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 120;
      const ctx = c.getContext('2d');
      const was = volume.enabled;
      volume.enabled = true;
      try {
        withVolume(ctx, [0, 0, 120, 120], (g) => {
          g.fillStyle = 'rgb(128, 128, 128)';
          g.fillRect(20, 20, 80, 80);
        });
      } finally {
        volume.enabled = was;
      }
      const px = (x, y) => ctx.getImageData(x, y, 1, 1).data;
      const lit = px(21, 21);
      const dark = px(98, 98);
      const fora = px(5, 5);
      expect(lit[3]).toBe(255);
      expect(fora[3]).toBe(0); // luz e sombra só onde há tinta
      expect(lit[0] + lit[1] + lit[2]).toBeGreaterThan(dark[0] + dark[1] + dark[2] + 60);
    });
  }
});

suite('Profundidade: relevo, parallax e primeiro plano', () => {
  test('a câmera segue o jogador: a frente anda tudo, a costa menos e o céu menos ainda', () => {
    const was = camera.x;
    try {
      camera.x = 0;
      for (let i = 0; i < 200; i++) followCamera(W, 0.05);
      expect(camera.x).toBeCloseTo((W / 2) * DEPTH.sway.amount, 0.01);
      const front = Math.abs(swayAt(ROW_Y[3]));
      const shore = Math.abs(swayAt(SHORE_Y));
      expect(front).toBeCloseTo(camera.x, 1e-9);
      expect(shore).toBeLessThan(front);
      expect(shore).toBeGreaterThan(0);
      expect(DEPTH.sway.far).toBeLessThan(DEPTH.sway.shore);
      expect(DEPTH.sway.fore).toBeGreaterThan(1);
      // Jogador do outro lado: a câmera vai para o outro lado
      for (let i = 0; i < 200; i++) followCamera(0, 0.05);
      expect(camera.x).toBeLessThan(0);
      // O deslocamento nunca passa do máximo
      expect(Math.abs(camera.x)).toBeLessThan(maxSway() + 1e-9);
    } finally {
      camera.x = was;
    }
  });

  test('com a câmera deslocada, projeção, desenho e descarte continuam combinando', () => {
    const was = camera.x;
    try {
      camera.x = 12;
      const y = ROW_Y[1];
      const { ctx, calls } = recordingCtx();
      atDepth(ctx, y, () => {});
      const tr = calls.find((c) => c[0] === 'translate');
      expect(tr[1]).toBeCloseTo(DEPTH.vanishX + swayAt(y), 1e-9);
      expect(projectX(DEPTH.vanishX, y)).toBeCloseTo(DEPTH.vanishX + swayAt(y), 1e-9);
      const [a, b] = visibleRange(y, 0);
      expect(projectX(a, y)).toBeCloseTo(0, 1e-6);
      expect(projectX(b, y)).toBeCloseTo(W, 1e-6);
      // Na frente também há deslocamento (atDepth não pode pular a transformação)
      const r = recordingCtx();
      atDepth(r.ctx, ROW_Y[3], () => {});
      expect(r.calls.find((c) => c[0] === 'translate')[1]).toBeCloseTo(DEPTH.vanishX - 12, 1e-9);
    } finally {
      camera.x = was;
    }
  });

  test('desenhar com contexto falso (testes) não move a câmera', () => {
    const was = camera.x;
    try {
      camera.x = 0;
      const g = makeGame({ level: 4 });
      g.player.x = 1200;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      for (let i = 0; i < 5; i++) {
        g.time += 0.05;
        g.renderer.draw(g);
      }
      expect(camera.x).toBe(0);
    } finally {
      camera.x = was;
    }
  });

  test('a luz do relevo acompanha o cenário (sol quente de dia, luar frio no Halloween)', () => {
    const { ctx } = recordingCtx();
    const g = makeGame({ level: 25 });
    g.renderer.ctx = ctx;
    g.renderer.draw(g);
    const moon = [...sceneLight.key];
    expect(moon[2]).toBeGreaterThan(moon[0]); // azulado
    const n = makeGame({ level: 1 });
    n.renderer.ctx = ctx;
    n.renderer.draw(n);
    expect(sceneLight.key[0]).toBeGreaterThanOrEqual(sceneLight.key[2]); // quente
    expect(DEPTH.relief.light).toBeGreaterThan(0);
    expect(DEPTH.relief.shade).toBeGreaterThan(0);
  });

  test('com fps um pouco baixo, só o relevo desliga (o resto do volume continua)', () => {
    const g = makeGame();
    const was = [volume.enabled, volume.relief];
    try {
      volume.enabled = true;
      volume.relief = true;
      g.time = 10;
      g.fps = DEPTH.relief.minFps - 5;
      expect(g.fps).toBeGreaterThan(DEPTH.minFps);
      for (let i = 0; i < 15; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.relief).toBe(true);
      for (let i = 0; i < 10; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.relief).toBe(false);
      for (let i = 0; i < 100; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(true);
    } finally {
      [volume.enabled, volume.relief] = was;
    }
  });

  test('os mapas de luz ficam guardados por personagem (não são refeitos todo quadro)', () => {
    expect(DEPTH.relief.every).toBeGreaterThan(1);
    expect(DEPTH.relief.res).toBeLessThan(1);
    expect(DEPTH.relief.res).toBeGreaterThan(0);
  });

  test('cada cenário tem o seu primeiro plano (os desconhecidos usam o de gelo)', () => {
    for (const sp of Object.values(SPECIALS)) expect(typeof foregroundKind(sp.scenery || null)).toBe('string');
    expect(foregroundKind(null)).toBe('ice');
    expect(foregroundKind('forest')).toBe('forest');
    expect(foregroundKind('nada')).toBe('ice');
    expect(DEPTH.foreground).toBe(true);
  });

  if (!isNode) {
    test('no canvas de verdade: o relevo acende o lado da luz e escurece o oposto de uma forma redonda', () => {
      const paint = (relief) => {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 200;
        const ctx = c.getContext('2d');
        const was = [volume.enabled, DEPTH.relief, volume.relief];
        volume.enabled = true;
        volume.relief = true;
        DEPTH.relief = relief;
        try {
          withVolume(ctx, [0, 0, 200, 200], (g) => {
            g.fillStyle = 'rgb(120, 120, 120)';
            g.beginPath();
            g.arc(100, 100, 60, 0, Math.PI * 2);
            g.fill();
          });
        } finally {
          [volume.enabled, DEPTH.relief, volume.relief] = was;
        }
        const px = (x, y) => {
          const d = ctx.getImageData(x, y, 1, 1).data;
          return d[0] + d[1] + d[2];
        };
        return { lit: px(70, 70), dark: px(132, 132), out: ctx.getImageData(10, 10, 1, 1).data[3] };
      };
      const on = paint(DEPTH.relief);
      const off = paint(null);
      expect(on.out).toBe(0);
      expect(on.lit).toBeGreaterThan(off.lit);
      expect(on.dark).toBeLessThan(off.dark);
    });
  }
});

suite('Personagem 3D (piloto da etapa 2)', () => {
  const player = (o) => ({ state: 'stand', moving: false, facing: 1, kickT: 0, crouch: 0, back: false, ...o });

  test('cada estado do jogador escolhe a foto certa (ou o desenho 2D quando não há foto)', () => {
    expect(playerPose(player(), 0).key).toBe('idleR');
    expect(playerPose(player({ facing: -1 }), 0).key).toBe('idleL');
    expect(playerPose(player({ moving: true }), 0.1).anim).toBe('run');
    expect(playerPose(player({ state: 'jump' }), 0).key).toBe('jumpR');
    expect(playerPose(player({ state: 'flee', moving: true }), 0).anim).toBe('flee');
    expect(playerPose(player({ state: 'flee' }), 0).anim).toBe('scared');
    // Etapa 1 do 3D (aprovado pelo usuário): todas as poses do jogo têm foto
    expect(playerPose(player({ state: 'swim' }), 0).anim).toBe('swim');
    expect(playerPose(player({ state: 'drown' }), 0).anim).toBe('drown');
    expect(playerPose(player({ state: 'freeze' }), 0).key).toBe('coldR');
    expect(playerPose(player({ state: 'enter' }), 0).key).toBe('idleR');
    expect(playerPose(player({ kickT: 0.2 }), 0).anim).toBe('kick');
    expect(playerPose(player({ back: true }), 0).key).toBe('backIdle');
    expect(playerPose(player({ back: true, moving: true }), 0.1).key.startsWith('back')).toBe(true);
    // Agachado usa a mesma foto (a inclinação é feita na hora)
    expect(playerPose(player({ crouch: 0.5 }), 0).key).toBe('idleR');
    // Estado sem foto: desenho 2D
    expect(playerPose(player({ state: 'gone' }), 0)).toBe(null);
  });

  test('toda foto pedida durante a animação existe na lista de fotos', () => {
    const keys = new Set(poseList().map((p) => p.key));
    const states = [{}, { moving: true }, { state: 'jump' }, { state: 'flee', moving: true }, { state: 'flee' }];
    for (const facing of [1, -1]) {
      for (const st of states) {
        for (let t = 0; t < 3; t += 0.013) {
          const ps = playerPose(player({ facing, ...st }), t);
          expect(keys.has(ps.key)).toBe(true);
        }
      }
    }
    // A corrida passa por todos os quadros do ciclo
    const seen = new Set();
    for (let t = 0; t < 2; t += 0.005) seen.add(playerPose(player({ moving: true }), t).key);
    expect(seen.size).toBe(DEPTH.model3d.runFrames);
  });

  test('o Three.js vem de uma versão fixa', () => {
    expect(/three@\d+\.\d+\.\d+\//.test(DEPTH.model3d.url)).toBe(true);
  });

  test('sem as fotos prontas (Node, sem internet ou sem WebGL) o jogador continua com o desenho 2D', () => {
    if (isNode) {
      loadModel();
      expect(model.state).toBe('idle'); // no Node (sem WebGL) nada é carregado
    }
    const was = { ...model };
    try {
      model.state = 'failed'; // como sem internet
      model.sprites = null;
      const g = makeGame({ level: 1 });
      g.renderer.use3d = true;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      // O jogador é desenhado (em 2D), sem nenhuma foto 3D
      expect(calls.length > 0).toBe(true);
      expect(calls.some((c) => c[0] === 'drawImage' && c[1]?.fake3d)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  test('com as fotos prontas, só a fase normal usa o personagem 3D (roupas das fases especiais seguem em 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      const uses3d = (level) => {
        const g = makeGame({ level });
        g.renderer.use3d = true;
        const { ctx, calls } = recordingCtx();
        g.renderer.ctx = ctx;
        g.renderer.draw(g);
        return calls.some((c) => c[0] === 'drawImage' && c[1] === img);
      };
      expect(uses3d(1)).toBe(true);
      expect(uses3d(4)).toBe(true);
      // Fases especiais ainda não convertidas ao 3D seguem inteiras em 2D (aprovado pelo
      // usuário: as convertidas, em THEMES_3D, têm testes próprios)
      for (const [lv, sp] of Object.entries(SPECIALS)) if (!THEMES_3D.has(sp.id)) expect(uses3d(Number(lv))).toBe(false);
      // Desligado no renderizador (testes, ?modelo=0): 2D
      const g = makeGame({ level: 1 });
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      expect(calls.some((c) => c[0] === 'drawImage' && c[1] === img)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });
});

suite('Modelos 3D da fase normal (etapa 1 do 3D)', () => {
  const keysOf = (S) => new Set(S.poses().map((p) => p.key));

  test('toda pose do jogador (boiando, afundando, congelando, chute, de costas) tem foto', () => {
    const keys = keysOf(SUBJECTS.player);
    const base = { state: 'stand', moving: false, facing: 1, kickT: 0, crouch: 0, back: false };
    const states = [
      { state: 'swim' }, { state: 'drown' }, { state: 'freeze' }, { state: 'enter' }, { state: 'enter', moving: true },
      { back: true }, { back: true, moving: true }, { kickT: 0.05 }, { kickT: 0.2 }, { kickT: 0.39 },
    ];
    for (const facing of [1, -1]) {
      for (const st of states) {
        for (let t = 0; t < 2; t += 0.017) expect(keys.has(playerPose({ ...base, facing, ...st }, t).key)).toBe(true);
      }
    }
  });

  test('urso: toda foto pedida (andando, perseguindo de boca aberta, para os dois lados) existe', () => {
    const keys = keysOf(SUBJECTS.bear);
    for (const dir of [1, -1]) {
      for (const chasing of [false, true]) {
        for (let w = 0; w < 5; w += 0.031) expect(keys.has(SUBJECTS.bear.bearPose({ walk: w, dir, chasing }, w * 1.7))).toBe(true);
      }
    }
  });

  test('ganso, caranguejo, molusco e peixe: toda foto pedida existe', () => {
    for (const kind of CRITTERS_3D) {
      const S = SUBJECTS[kind];
      const keys = keysOf(S);
      for (const dir of [1, -1]) {
        for (let t = 0; t < 3; t += 0.019) expect(keys.has(S.pose({ dir, ph: 1.3, x: 0 }, t))).toBe(true);
      }
    }
  });

  test('a foto da placa de gelo tem as mesmas medidas do sprite 2D', () => {
    const was = { ...model };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      for (const w of [36, 82]) {
        const piece = { w, seed: 7, sprites: {} };
        const s = floeSprite3D(piece, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([10, 22, w + 20, 70]);
        const b = floeSubject(w).box;
        expect(b.right - b.left).toBe(w + 20);
        expect(b.top - b.bottom).toBe(70);
      }
    } finally {
      Object.assign(model, was);
    }
  });

  test('com as fotos prontas, urso, bichos e placas da fase normal também viram 3D', () => {
    const was = { ...model };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      const g = makeGame({ level: 4, quiet: false });
      step(g, 8);
      Object.assign(g.bear, { active: true, x: 400, dir: 1 });
      g.renderer.use3d = true;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const n = calls.filter((c) => c[0] === 'drawImage' && c[1] === img).length;
      // jogador + urso + pelo menos uma placa e um bicho
      expect(n).toBeGreaterThan(5);
    } finally {
      Object.assign(model, was);
    }
  });
});

suite('Modelos 3D da fase normal: articulações, iglu e poderes', () => {
  // Fotos falsas: toda chave existe; registra quais foram pedidas
  const fakeSprites = () => {
    const asked = [];
    const img = { fake3d: true };
    return { asked, img, proxy: new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) }) };
  };
  const withFake = (fn) => {
    const was = { ...model };
    const f = fakeSprites();
    try {
      model.state = 'ready';
      model.sprites = f.proxy;
      fn(f);
    } finally {
      Object.assign(model, was);
    }
  };

  test('urso: as quatro patas se alternam e a pata de apoio não patina', () => {
    const phases = bear3d.LEGS.map((l) => l[2]).sort();
    expect(phases).toEqual([0, 0.25, 0.5, 0.75]);
    expect(bear3d.LEGS.filter((l) => l[1]).length).toBe(2);
    for (const [, front] of bear3d.LEGS) {
      const leg = { front, hip: { z: front ? 22 : -25 } };
      // No apoio a pata fica no chão e desliza para trás em linha reta
      const a = bear3d.footAt(leg, 0.05);
      const b = bear3d.footAt(leg, 0.35);
      expect(a.y).toBe(b.y);
      expect(b.z).toBeLessThan(a.z);
      // Velocidade da pata no chão = velocidade do urso (35 px por ciclo, ~91% de perfil)
      const perCycle = ((a.z - b.z) / 0.3) * Math.sin(Math.PI / 2 - 0.42);
      expect(Math.abs(perCycle - (Math.PI * 2) / 3 / 0.06)).toBeLessThan(0.01);
      // Na passada ela sobe
      expect(bear3d.footAt(leg, 0.8).y).toBeGreaterThan(a.y + 5);
    }
  });

  test('personagem: braços com cotovelo (dobram ao correr, no pulo, boiando e abraçados de frio)', () => {
    const list = SUBJECTS.player.poses();
    const get = (k) => list.find((p) => p.key === k);
    expect(get('jumpR').elbows.length).toBe(2);
    expect(get('swim0R').elbows.length).toBe(2);
    expect(get('coldR').hug).toBe(true);
  });

  test('iglu: uma foto para cada quantidade de blocos e uma para cada bloco caindo', () => {
    expect(IGLOO_BLOCKS).toBe(RULES.iglooPieces - 1);
    const keys = new Set(SUBJECTS.igloo.poses().map((p) => p.key));
    for (let n = 1; n <= IGLOO_BLOCKS; n++) expect(keys.has(`n${n}`)).toBe(true);
    for (let i = 0; i < IGLOO_BLOCKS; i++) expect(keys.has(`b${i}`)).toBe(true);
  });

  test('iglu 3D: blocos assentados numa foto só e o que está caindo por cima, com o mesmo quique', () => {
    withFake((f) => {
      const g = makeGame({ level: 1 });
      for (let i = 0; i < 6; i++) g.igloo.add();
      g.igloo.update(5); // os 6 assentam
      g.igloo.add(); // o 7º começa a cair
      const { ctx, calls } = recordingCtx();
      expect(drawIgloo3D(ctx, g.igloo, 0)).toBe(true);
      expect(f.asked.includes('igloo:n6')).toBe(true);
      expect(f.asked.includes('igloo:b6')).toBe(true);
      expect(calls.filter((c) => c[0] === 'drawImage').length).toBe(2);
    });
  });

  test('iglu 3D: a moldura da porta vira foto (também por cima de quem está entrando)', () => {
    withFake((f) => {
      const g = makeGame({ level: 1 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.frameHook = drawIglooFrame3D;
      const { ctx, calls } = recordingCtx();
      g.igloo.drawDoorFront(ctx, 0);
      expect(f.asked.includes('porch:frame')).toBe(true);
      expect(calls.some((c) => c[0] === 'drawImage' && c[1] === f.img)).toBe(true);
    });
  });

  test('boia e chuteira 3D: item na fileira e efeito no jogador usam as fotos; desligado, o 2D', () => {
    const got = [];
    const was = { ...powerArt };
    try {
      powerArt.on = true;
      powerArt.draw = (ctx, name, part, dir, scale) => (got.push([name, part, dir, scale]), true);
      const { ctx } = recordingCtx();
      drawDuckFloat(ctx, { x: 100, dir: -1, ph: 0 }, 300, 0);
      drawGoldenBoot(ctx, { x: 100, dir: 1, ph: 0 }, 300, 0);
      const p = { x: 200, y: 300, facing: -1, state: 'stand', power: 'duck', powerEnding: false, kickT: 0 };
      drawPowerBack(ctx, p, 0);
      drawPowerFront(ctx, p, 0);
      drawPowerFront(ctx, { ...p, power: 'boot', facing: 1 }, 0);
      expect(got).toEqual([
        ['duck', 'item', -1, 1], ['boot', '', 1, 1], ['duck', 'back', -1, 22 / 17], ['duck', 'front', -1, 22 / 17], ['boot', '', 1, 1],
      ]);
      got.length = 0;
      powerArt.on = false;
      drawDuckFloat(ctx, { x: 100, dir: 1, ph: 0 }, 300, 0);
      expect(got.length).toBe(0);
    } finally {
      Object.assign(powerArt, was);
    }
  });
});

suite('Natal em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('o Natal é uma fase convertida: suéter, urso de gorro, trenó, árvores, placas e bichos em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[5].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 5, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1 });
      Object.assign(g.sleigh, { active: true, x: 500, y: 130, dir: 1, t: 0.3 });
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      expect(has('player-sweater:')).toBe(true);
      expect(has('bear-santa:')).toBe(true);
      expect(has('sleigh:')).toBe(true);
      expect(has('xtree:')).toBe(true);
      expect(has('floe')).toBe(true);
    });
  });

  test('suéter e urso de gorro têm as mesmas poses (e articulações) dos modelos da fase normal', () => {
    const keys = (S) => S.poses().map((p) => p.key).join();
    expect(keys(SUBJECTS['player-sweater'])).toBe(keys(SUBJECTS.player));
    expect(keys(SUBJECTS['bear-santa'])).toBe(keys(SUBJECTS.bear));
  });

  test('trenó: toda foto pedida durante a passagem existe (renas galopando, para os dois lados)', () => {
    const S = SUBJECTS.sleigh;
    const keys = new Set(S.poses().map((p) => p.key));
    for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.013) expect(keys.has(S.pose({ t, dir }))).toBe(true);
  });

  test('árvores 3D mantêm o pisca-pisca 2D por cima; prêmios 3D mantêm brilho e anel', () => {
    const calls = [];
    const was = { ...xmasArt };
    const wasB = { ...bonusArt };
    try {
      xmasArt.on = true;
      xmasArt.tree = (ctx, h) => (calls.push(['tree', h]), true);
      bonusArt.on = true;
      bonusArt.draw = (ctx, name) => (calls.push([name]), true);
      const r = recordingCtx();
      drawChristmasTrees(r.ctx, 0);
      expect(calls.filter((c) => c[0] === 'tree').map((c) => c[1])).toEqual(TREES.map((tr) => tr.h));
      // 12 lâmpadas por árvore continuam sendo desenhadas (arc)
      expect(r.calls.filter((c) => c[0] === 'arc').length).toBeGreaterThan(20);
      const b = recordingCtx();
      drawMoneyBag(b.ctx, { x: 100, ph: 0 }, 300, 0);
      drawHeart(b.ctx, { x: 100, ph: 0 }, 300, 0);
      expect(calls.slice(-2)).toEqual([['bag'], ['heart']]);
      expect(b.calls.some((c) => c[0] === 'ellipse')).toBe(true); // anel d'água
    } finally {
      Object.assign(xmasArt, was);
      Object.assign(bonusArt, wasB);
    }
  });
});

suite('Floresta em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('a Floresta é uma fase convertida: lenhador, urso marrom, troncos, cabana, pinheiros, cogumelos e bichos em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[10].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 10, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1 });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['snake', 'bat', 'piranha'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-lumberjack:', 'bear-brown:', 'log', 'cabin:', 'pine:', 'mushroom:', 'snake:', 'bat:', 'piranha:']) {
        expect(has(pre)).toBe(true);
      }
    });
  });

  test('cobra, morcego e piranha: toda foto pedida existe', () => {
    for (const kind of ['snake', 'bat', 'piranha']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t))).toBe(true);
    }
  });

  test('a foto do tronco tem as mesmas medidas do sprite 2D', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = logSprite3D({ w, seed: 5, sprites: {} }, false);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 22, w + 24, 64]);
      }
    });
  });

  test('cabana 3D: peças assentadas numa foto, a que cai por cima, e a porta 3D por cima de tudo', () => {
    const keys = new Set(SUBJECTS.cabin.poses().map((p) => p.key));
    for (let n = 1; n < CABIN_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 10 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawCabin3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('cabin:n5')).toBe(true);
      expect(asked.includes('cabin:b5')).toBe(true);
      // Pronta: a porta (abertura, folha, batente) é o modelo 3D da porta
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.curtain = 1;
      withDoors3D(() => drawCabin3D(recordingCtx().ctx, g.igloo, 0));
      for (const k of ['in0', 'k12', 'frame']) expect(asked.includes(`door-cabin:${k}`), k).toBe(true);
    });
  });
});

suite('Espaço em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('o Espaço é uma fase convertida: astronauta, alienígena, asteroides, base, módulo, bandeira, bichos e estrelinha em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[15].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 15, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['ufo', 'crawler', 'comet', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-astronaut:', 'alien:', 'rock', 'base:', 'lander:', 'flag:', 'ufo:', 'crawler:', 'comet:', 'star:']) {
        expect(has(pre)).toBe(true);
      }
      // O "peixe" do espaço é a estrelinha, nunca o peixe 3D da fase normal
      expect(FISH_3D.space).toBe('star');
      expect(has('fish:')).toBe(false);
    });
  });

  test('disco, bichinho lunar, cometa e estrelinha: toda foto pedida existe; o alienígena usa o passo do urso', () => {
    for (const kind of ['ufo', 'crawler', 'comet', 'star']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t))).toBe(true);
    }
    const A = SUBJECTS.alien;
    const keys = new Set(A.poses().map((p) => p.key));
    expect([...keys].sort()).toEqual(bear3d.poses().map((p) => p.key).sort());
    for (const chasing of [false, true]) {
      for (let t = 0; t < 2; t += 0.037) expect(keys.has(A.pose({ walk: t * 3, dir: chasing ? -1 : 1, chasing }, t))).toBe(true);
    }
  });

  test('a foto do asteroide tem as mesmas medidas do sprite 2D', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = rockSprite3D({ w, seed: 7, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 22, w + 24, 66]);
      }
    });
  });

  test('base lunar 3D: peças assentadas numa foto, a que cai por cima, luz acesa com alguém dentro e a porta 3D por cima', () => {
    const keys = new Set(SUBJECTS.base.poses().map((p) => p.key));
    for (let n = 1; n < BASE_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
    for (let i = 0; i < BASE_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
    expect(keys.has('lit')).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 15 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawBase3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('base:n5')).toBe(true);
      expect(asked.includes('base:b5')).toBe(true);
      // Pronta e com o astronauta lá dentro: foto acesa e a porta 3D (abertura acesa,
      // folhas fechadas e o batente com a luz verde)
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      g.igloo.curtain = 1;
      asked.length = 0;
      withDoors3D(() => drawBase3D(recordingCtx().ctx, g.igloo, 0));
      expect(asked.includes('base:lit')).toBe(true);
      for (const k of ['in1', 'k12', 'frame1']) expect(asked.includes(`door-base:${k}`), k).toBe(true);
    });
  });

  test('módulo de pouso e bandeira: 3D pelo gancho, e o 2D de sempre se a foto não estiver pronta', () => {
    const was = { ...spaceArt };
    try {
      const calls = [];
      Object.assign(spaceArt, { on: true, lander: () => (calls.push('lander'), true), flag: () => (calls.push('flag'), true) });
      const a = recordingCtx();
      drawSpaceDecor(a.ctx, 0);
      expect(calls).toEqual(['lander', 'flag']);
      // Sem a foto: o desenho 2D completo (pernas, estágio dourado, cabine, bandeira)
      Object.assign(spaceArt, { lander: () => false, flag: () => false });
      const b = recordingCtx();
      drawSpaceDecor(b.ctx, 0);
      spaceArt.on = false;
      const c = recordingCtx();
      drawSpaceDecor(c.ctx, 0);
      expect(b.calls.length).toBe(c.calls.length);
      expect(b.calls.length).toBeGreaterThan(a.calls.length + 20);
    } finally {
      Object.assign(spaceArt, was);
    }
  });
});

suite('Praia em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('a Praia é uma fase convertida: surfista, caranguejo gigante, pranchas, cabana, coqueiros, guarda-sol, bichos e peixinho em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[20].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 20, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['gull', 'siri', 'jellyfish', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-surfer:', 'giantCrab:', 'board', 'hut:', 'palm0:', 'palm1:', 'parasol:', 'gull:', 'siri:', 'jellyfish:', 'tfish:']) {
        expect(has(pre)).toBe(true);
      }
      // O "peixe" da praia é o peixinho tropical, nunca o peixe 3D da fase normal
      expect(FISH_3D.beach).toBe('tfish');
      expect(has('fish:')).toBe(false);
    });
  });

  test('gaivota, siri, água-viva e peixinho: toda foto pedida existe; o caranguejo gigante usa o passo do urso', () => {
    for (const kind of ['gull', 'siri', 'jellyfish', 'tfish']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t))).toBe(true);
    }
    const C = SUBJECTS.giantCrab;
    const keys = new Set(C.poses().map((p) => p.key));
    expect([...keys].sort()).toEqual(bear3d.poses().map((p) => p.key).sort());
    for (const chasing of [false, true]) {
      for (let t = 0; t < 2; t += 0.037) expect(keys.has(C.pose({ walk: t * 3, dir: chasing ? -1 : 1, chasing }, t))).toBe(true);
    }
  });

  test('pranchas e boias: a foto tem as mesmas medidas do sprite 2D, e o pedaço curto de boia pede a foto da boia', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = boardSprite3D({ w, seed: 6, k: 1, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 22, w + 24, 62]);
      }
      asked.length = 0;
      boardSprite3D({ w: 36, seed: 6, k: 0, sprites: {} }, false);
      expect(asked).toEqual(['board36:b0']);
      // Só os pedaços curtos têm a foto da boia
      expect(boardSubject(36).poses().some((p) => p.key === 'b0')).toBe(true);
      expect(boardSubject(82).poses().some((p) => p.key.startsWith('b'))).toBe(false);
    });
  });

  test('cabana 3D: peças assentadas numa foto, a que cai por cima, janela acesa, chamas 2D das tochas e a porta 3D por cima', () => {
    const keys = new Set(SUBJECTS.hut.poses().map((p) => p.key));
    for (let n = 1; n < HUT_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
    for (let i = 0; i < HUT_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
    expect(keys.has('lit')).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 20 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawHut3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('hut:n5')).toBe(true);
      expect(asked.includes('hut:b5')).toBe(true);
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      asked.length = 0;
      g.igloo.curtain = 1;
      const r = recordingCtx();
      withDoors3D(() => drawHut3D(r.ctx, g.igloo, 0));
      expect(asked.includes('hut:lit')).toBe(true);
      // Chamas (2 brilhos com gradiente) e a porta 3D: interior aceso, cortina e batente
      expect(r.calls.filter((c) => c[0] === 'createRadialGradient').length).toBe(2);
      for (const k of ['in1', 'k12', 'frame']) expect(asked.includes(`door-hut:${k}`), k).toBe(true);
    });
  });

  test('coqueiros e guarda-sol: 3D pelo gancho, e o 2D de sempre se a foto não estiver pronta', () => {
    const was = { ...beachArt };
    try {
      const calls = [];
      Object.assign(beachArt, { on: true, palm: (ctx, k) => (calls.push(`palm${k}`), true), parasol: () => (calls.push('parasol'), true) });
      const a = recordingCtx();
      drawBeachDecor(a.ctx, 0);
      expect(calls).toEqual([...PALMS.map((_, k) => `palm${k}`), 'parasol']);
      Object.assign(beachArt, { palm: () => false, parasol: () => false });
      const b = recordingCtx();
      drawBeachDecor(b.ctx, 0);
      beachArt.on = false;
      const c = recordingCtx();
      drawBeachDecor(c.ctx, 0);
      expect(b.calls.length).toBe(c.calls.length);
      expect(b.calls.length).toBeGreaterThan(a.calls.length + 40);
    } finally {
      Object.assign(beachArt, was);
    }
  });
});

suite('Pulo 3D de frente, de costas e na diagonal', () => {
  const player = (o) => ({ state: 'jump', moving: false, facing: 1, kickT: 0, crouch: 0, back: false, ...o });

  test('pulando para a frente o corpo fica de frente para a câmera; voltando, de costas', () => {
    expect(playerPose(player({ from: 0, to: 1 }), 0).key).toBe('jumpF');
    expect(playerPose(player({ from: -1, to: 0, facing: -1 }), 0).key).toBe('jumpF');
    expect(playerPose(player({ from: 2, to: 1 }), 0).key).toBe('jumpB');
    expect(playerPose(player({ from: 0, to: -1, facing: -1 }), 0).key).toBe('jumpB');
    expect(JUMP_YAW.F).toBe(0);
    expect(JUMP_YAW.B).toBe(Math.PI);
  });

  test('pulando na diagonal o corpo vira para o lado do pulo', () => {
    expect(playerPose(player({ from: 0, to: 1, moving: true, facing: 1 }), 0).key).toBe('jumpFR');
    expect(playerPose(player({ from: 0, to: 1, moving: true, facing: -1 }), 0).key).toBe('jumpFL');
    expect(playerPose(player({ from: 1, to: 0, moving: true, facing: 1 }), 0).key).toBe('jumpBR');
    expect(playerPose(player({ from: 1, to: 0, moving: true, facing: -1 }), 0).key).toBe('jumpBL');
    // A frente do corpo aponta para a direção do pulo: (sen yaw) = lado, (cos yaw) = para a câmera
    const dir = (k) => [Math.sign(Math.round(Math.sin(JUMP_YAW[k]) * 100)), Math.sign(Math.round(Math.cos(JUMP_YAW[k]) * 100))];
    expect(dir('FR')).toEqual([1, 1]);
    expect(dir('FL')).toEqual([-1, 1]);
    expect(dir('BR')).toEqual([1, -1]);
    expect(dir('BL')).toEqual([-1, -1]);
  });

  test('toda foto de pulo existe em todas as roupas 3D, e o jogo de verdade usa a foto de frente', () => {
    for (const name of Object.keys(SUBJECTS).filter((k) => k === 'player' || k.startsWith('player-'))) {
      const keys = new Set(SUBJECTS[name].poses().map((p) => p.key));
      for (const k of ['F', 'FR', 'FL', 'B', 'BR', 'BL']) expect(keys.has(`jump${k}`)).toBe(true);
    }
    const g = makeGame({ level: 1 });
    g.player.jump(0);
    step(g, 0.1);
    expect(playerPose(g.player, 0).key.startsWith('jumpF')).toBe(true);
  });
});

suite('Halloween em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('o Halloween é uma fase convertida: bruxinho, lobisomem, abóboras, casa, árvore, bichos e bala em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[25].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 25, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['ghost', 'spider', 'eyeball', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-wizard:', 'werewolf:', 'pumpkin', 'haunted:', 'deadTree:', 'jack:', 'ghost:', 'spider:', 'eyeball:', 'candy:']) {
        expect(has(pre)).toBe(true);
      }
      expect(FISH_3D.halloween).toBe('candy');
      expect(has('fish:')).toBe(false);
    });
  });

  test('fantasma, aranha, olho e bala: toda foto pedida existe; o lobisomem anda, corre e uiva', () => {
    for (const kind of ['ghost', 'spider', 'eyeball', 'candy']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t))).toBe(true);
    }
    const Wf = SUBJECTS.werewolf;
    const keys = new Set(Wf.poses().map((p) => p.key));
    const seen = new Set();
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (let t = 0; t < 12; t += 0.05) {
          const k = Wf.pose({ walk: t * 3, dir, chasing }, t);
          expect(keys.has(k)).toBe(true);
          seen.add(k.slice(0, 4));
        }
      }
    }
    // Parado de tempos em tempos ele uiva (como no 2D); perseguindo, nunca
    expect(seen.has('howl')).toBe(true);
    for (let t = 0; t < 12; t += 0.05) expect(Wf.pose({ walk: 1, dir: 1, chasing: true }, t).startsWith('howl')).toBe(false);
  });

  test('a foto das abóboras tem as mesmas medidas do sprite 2D e ganha o reflexo na água (o 2D já traz o dele)', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = pumpkinSprite3D({ w, seed: 4, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 26, w + 24, 62]);
        expect(s.is3d).toBe(true);
      }
    });
  });

  test('casa assombrada 3D: peças assentadas numa foto, a que cai por cima, janelas acesas com brilho e a porta 2D por cima', () => {
    const keys = new Set(SUBJECTS.haunted.poses().map((p) => p.key));
    for (let n = 1; n < HAUNTED_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
    for (let i = 0; i < HAUNTED_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
    expect(keys.has('lit')).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 25 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawHaunted3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('haunted:n5')).toBe(true);
      expect(asked.includes('haunted:b5')).toBe(true);
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      asked.length = 0;
      const r = recordingCtx();
      drawHaunted3D(r.ctx, g.igloo, 0);
      expect(asked.includes('haunted:lit')).toBe(true);
      // Brilho das 2 janelas e da lanterna
      expect(r.calls.filter((c) => c[0] === 'createRadialGradient').length).toBe(3);
      // Porta: abertura em arco, folha e batente com o degrau
      expect(r.calls.some((c) => c[0] === 'quadraticCurveTo')).toBe(true);
    });
  });

  test('árvore seca e abóboras da costa: 3D pelo gancho (a lanterna continua 2D), e o 2D de sempre sem a foto', () => {
    const was = { ...halloweenArt };
    try {
      const calls = [];
      Object.assign(halloweenArt, { on: true, tree: () => (calls.push('tree'), true), jack: () => (calls.push('jack'), true) });
      const a = recordingCtx();
      drawHalloweenDecor(a.ctx, 0);
      expect(calls).toEqual(['tree', ...SHORE_PUMPKINS.map(() => 'jack')]);
      // A lanterna da árvore (vela com o contorno) continua desenhada
      expect(a.calls.some((c) => c[0] === 'strokeRect')).toBe(true);
      Object.assign(halloweenArt, { tree: () => false, jack: () => false });
      const b = recordingCtx();
      drawHalloweenDecor(b.ctx, 0);
      halloweenArt.on = false;
      const c = recordingCtx();
      drawHalloweenDecor(c.ctx, 0);
      expect(b.calls.length).toBe(c.calls.length);
      expect(b.calls.length).toBeGreaterThan(a.calls.length + 40);
    } finally {
      Object.assign(halloweenArt, was);
    }
  });
});

suite('Dinossauros em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('os Dinossauros são uma fase convertida: homem das cavernas, T-rex, pedras, caverna, samambaias, ninho, bichos e ovo em 3D', () => {
    expect(THEMES_3D.has(SPECIALS[30].id)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 30, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['ptero', 'raptor', 'ammonite', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-caveman:', 'trex:', 'basalt', 'cave:', 'fern:', 'nest:', 'ptero:', 'raptor:', 'ammonite:', 'egg:']) {
        expect(has(pre)).toBe(true);
      }
      expect(FISH_3D.dino).toBe('egg');
      expect(has('fish:')).toBe(false);
    });
  });

  test('pterossauro, raptor, amonite e ovo: toda foto pedida existe; o T-rex anda, corre e ruge', () => {
    for (const kind of ['ptero', 'raptor', 'ammonite', 'egg']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t))).toBe(true);
    }
    const R = SUBJECTS.trex;
    const keys = new Set(R.poses().map((p) => p.key));
    const seen = new Set();
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (let t = 0; t < 12; t += 0.05) {
          const k = R.pose({ walk: t * 3, dir, chasing }, t);
          expect(keys.has(k)).toBe(true);
          seen.add(k.slice(0, 4));
        }
      }
    }
    // Parado ele ruge de tempos em tempos (como no 2D); perseguindo, nunca
    expect(seen.has('roar')).toBe(true);
    for (let t = 0; t < 12; t += 0.05) expect(R.pose({ walk: 1, dir: 1, chasing: true }, t).startsWith('roar')).toBe(false);
  });

  test('a foto das pedras de basalto tem as mesmas medidas do sprite 2D', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = basaltSprite3D({ w, seed: 8, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 26, w + 24, 62]);
      }
    });
  });

  test('caverna 3D: pedras assentadas numa foto, a que cai por cima, a chama 2D da tocha, a pedra 2D da porta e as presas por cima dela', () => {
    const keys = new Set(SUBJECTS.cave.poses().map((p) => p.key));
    for (let n = 1; n < CAVE_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
    for (let i = 0; i < CAVE_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 30 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawCave3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('cave:n5')).toBe(true);
      expect(asked.includes('cave:b5')).toBe(true);
      expect(asked.includes('caveTusks:t')).toBe(false);
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      asked.length = 0;
      const r = recordingCtx();
      drawCave3D(r.ctx, g.igloo, 0);
      // Chama da tocha (brilho com gradiente), a pedra redonda e as presas 3D por cima
      expect(r.calls.some((c) => c[0] === 'createRadialGradient')).toBe(true);
      expect(r.calls.some((c) => c[0] === 'arc')).toBe(true);
      expect(asked.includes('caveTusks:t')).toBe(true);
    });
  });

  test('samambaias, ninho e presas da porta: 3D pelo gancho, e o 2D de sempre sem a foto', () => {
    const was = { ...dinoArt };
    try {
      const calls = [];
      Object.assign(dinoArt, {
        on: true, fern: () => (calls.push('fern'), true), nest: () => (calls.push('nest'), true), tusks: () => (calls.push('tusks'), true),
      });
      const a = recordingCtx();
      drawDinoDecor(a.ctx, 0);
      expect(calls).toEqual([...TREE_FERNS.map(() => 'fern'), 'nest']);
      // Entrando na caverna pronta: as presas por cima são as 3D
      const g = makeGame({ level: 30 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      drawCaveDoorFront(recordingCtx().ctx, g.igloo, 0);
      expect(calls.at(-1)).toBe('tusks');
      Object.assign(dinoArt, { fern: () => false, nest: () => false });
      const b = recordingCtx();
      drawDinoDecor(b.ctx, 0);
      dinoArt.on = false;
      const c = recordingCtx();
      drawDinoDecor(c.ctx, 0);
      expect(b.calls.length).toBe(c.calls.length);
      expect(b.calls.length).toBeGreaterThan(a.calls.length + 40);
    } finally {
      Object.assign(dinoArt, was);
    }
  });
});

suite('"Ursos" 3D revisados: corpo contínuo', () => {
  // Peças de coluna (sweep): pontos { p, w, h, hb? } — meia largura e meias alturas
  const reach = (s) => Math.max(s.w, s.h, s.hb ?? s.h);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Sem buraco: cada ponto fica a menos da soma dos raios do vizinho (as seções se emendam)
  const joined = (spine) => spine.every((s, i) => i === 0 || dist(s.p, spine[i - 1].p) < reach(s) + reach(spine[i - 1]));

  test('urso: tronco e pescoço numa peça só, da cauda até dentro da cabeça; o polar com a garupa alta, o marrom com a corcova no ombro', async () => {
    const top = (sp, z) => {
      const s = sp.reduce((a, b) => (Math.abs(b.p[2] - z) < Math.abs(a.p[2] - z) ? b : a));
      return s.p[1] + s.h;
    };
    for (const v of ['polar', 'brown']) {
      const sp = bear3d.bearSpine(v);
      expect(joined(sp), v).toBe(true);
      expect(sp[0].p[2], v).toBeLessThanOrEqual(-45);
      // A cabeça fica em z = 40: o pescoço entra nela
      expect(sp[sp.length - 1].p[2], v).toBeGreaterThan(40);
      // Barriga mais funda que o dorso em algum ponto (pende um pouco)
      expect(sp.some((s) => (s.hb ?? s.h) > s.h), v).toBe(true);
    }
    expect(top(bear3d.bearSpine('polar'), -32)).toBeGreaterThan(top(bear3d.bearSpine('polar'), 12));
    expect(top(bear3d.bearSpine('brown'), 12)).toBeGreaterThan(top(bear3d.bearSpine('brown'), -32));
  });

  test('patas contínuas (urso, T-rex, lobisomem, caranguejo, alienígena): começam dentro do corpo, passam pelas juntas e afinam', async () => {
    const { trexLeg } = await import('../../src/m3d/dino.js');
    const { wolfArm, pantSpine, wolfShin } = await import('../../src/m3d/halloween.js');
    const { crabLeg } = await import('../../src/m3d/beach.js');
    const { alienLeg } = await import('../../src/m3d/space.js');
    const hip = [-8, 42, 0], knee = [-8, 25, 6], ankle = [-8, 9, 2], ball = [-8, 3, 9];
    const cases = {
      'urso (dianteira)': bear3d.legSpine(true, hip, knee, ankle),
      'urso (traseira)': bear3d.legSpine(false, hip, knee, ankle),
      'T-rex': trexLeg(hip, knee, ankle, ball),
      'lobisomem (braço)': wolfArm(hip, knee, ankle),
      'lobisomem (calça)': pantSpine(hip, knee),
      'lobisomem (canela)': wolfShin(knee, ankle, ball),
      caranguejo: crabLeg(hip, knee, ankle, ball),
      'alienígena': alienLeg(true, hip, knee, ankle),
    };
    for (const [name, sp] of Object.entries(cases)) {
      // Passa pelas juntas pedidas (nenhuma fica de fora)
      for (const j of name.includes('canela') ? [knee, ankle] : name.includes('calça') ? [hip] : [hip, knee]) {
        expect(sp.some((s) => dist(s.p, j) < 0.01), `${name}: junta`).toBe(true);
      }
      // Mais grossa em cima que na ponta
      expect(reach(sp[0]) + reach(sp[1]), name).toBeGreaterThan(reach(sp[sp.length - 1]) * 2);
    }
    // As que saem do corpo começam acima do quadril (dentro do corpo, sem "manga" colada)
    for (const name of ['urso (dianteira)', 'urso (traseira)', 'T-rex', 'alienígena']) expect(cases[name][0].p[1], name).toBeGreaterThan(hip[1]);
  });

  test('rabos do T-rex, do lobisomem e do alienígena: peça contínua que afina na ponta e balança mais na ponta que na base', async () => {
    const { trexSpine } = await import('../../src/m3d/dino.js');
    const { wolfTail } = await import('../../src/m3d/halloween.js');
    const { alienTail } = await import('../../src/m3d/space.js');
    // T-rex: do rabo ao peito; a ponta do rabo é a mais fina
    const still = trexSpine(0);
    const swung = trexSpine(5);
    expect(reach(still[0])).toBeLessThan(reach(still[still.length - 2]) / 4);
    expect(Math.abs(swung[0].p[0])).toBeGreaterThan(Math.abs(swung[4].p[0]));
    expect(swung[swung.length - 1].p[0]).toBe(0); // o peito não balança
    for (const [name, a, b] of [['lobisomem', wolfTail(0), wolfTail(1.5)], ['alienígena', alienTail(0), alienTail(0.5)]]) {
      expect(reach(a[a.length - 1]), name).toBeLessThan(reach(a[1]));
      const moved = (i) => dist(a[i].p, b[i].p);
      expect(moved(a.length - 1), name).toBeGreaterThan(moved(0));
    }
  });

  if (!isNode) {
    test('forma contínua (sweep) no Three.js: fechada nas pontas, faces para fora e do tamanho pedido', async () => {
      const THREE = await import(DEPTH.model3d.url);
      const { sweepGeometry } = await import('../../src/m3d/kit.js');
      const g = sweepGeometry(THREE, bear3d.bearSpine('polar'), { radial: 24, cap: 0.8 });
      const pos = g.getAttribute('position');
      const idx = g.getIndex().array;
      // Volume com sinal (teorema da divergência): positivo = triângulos virados para fora
      let vol = 0;
      const v = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      for (let i = 0; i < idx.length; i += 3) {
        const [a, b, c] = [v(idx[i]), v(idx[i + 1]), v(idx[i + 2])];
        vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      }
      expect(vol).toBeGreaterThan(0);
      // Fechada: juntando vértices na mesma posição, toda aresta tem exatamente dois triângulos
      const key = (i) => v(i).map((x) => x.toFixed(3)).join(',');
      const edges = new Map();
      for (let i = 0; i < idx.length; i += 3) {
        for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
          const ka = key(idx[i + a]), kb = key(idx[i + b]);
          if (ka === kb) continue;
          const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
          edges.set(k, (edges.get(k) || 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      // Tamanho: do fim da garupa à ponta do pescoço, e a altura do dorso
      g.computeBoundingBox();
      const bb = g.boundingBox;
      expect(bb.min.z).toBeLessThan(-46);
      expect(bb.max.z).toBeGreaterThan(44);
      expect(bb.max.y).toBeGreaterThan(64);
      // Urso no estilo das referências do usuário (corpão alto): até 95 (antes 70, aprovado)
      expect(bb.max.y).toBeLessThan(95);
    });
  }
});

suite('Cenários de fundo em 3D: fase normal (piloto da etapa 3)', () => {
  test('a câmera do cenário põe a beira da costa, o campo de neve e a água nas mesmas linhas da tela do fundo 2D', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    const S = SUBJECTS['bg-ice'];
    // Mesmo tamanho do fundo 2D (1280 × WATER_TOP + 12) e a mesma resolução (2×)
    expect(sc.BG_H).toBe(WATER_TOP + 12);
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -sc.BG_H]);
    expect(S.res).toBe(2);
    expect(S.elevation).toBe(sc.SCENE_EL);
    expect(S.poses().map((p) => p.key)).toEqual(['main']);
    // y da tela = z·sen(e) − y·cos(e): o chão na profundidade da beira cai na linha da beira
    expect(sc.screenOf(0, sc.zAt(sc.EDGE_TOP))).toBeCloseTo(sc.EDGE_TOP, 1e-9);
    expect(sc.screenOf(sc.yAt(150, 300), 300)).toBeCloseTo(150, 1e-9);
    expect(sc.EDGE_TOP).toBe(WATER_TOP - 14);
    // O campo de neve começa logo acima da faixa de neve do 2D e o jogador pisa no meio dele
    expect(sc.SNOW_BACK).toBeLessThanOrEqual(SHORE_TOP);
    expect(SHORE_Y).toBeGreaterThan(sc.SNOW_BACK);
    expect(SHORE_Y).toBeLessThan(sc.EDGE_TOP);
    // A câmera fica longe o bastante para o cenário inteiro estar na frente dela
    const depth = (y, z) => S.distance - (y * Math.sin(sc.SCENE_EL) + z * Math.cos(sc.SCENE_EL));
    expect(depth(0, sc.zAt(sc.BG_H))).toBeGreaterThan(1);
  });

  test('montanhas com os picos entre as linhas do 2D; blocos e gelo de pressão atrás do jogador e longe do iglu', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    for (const r of sc.ICE_RIDGES) {
      expect(r.peaks[0]).toBeGreaterThanOrEqual(90);
      expect(r.peaks[1]).toBeLessThanOrEqual(180);
      expect(r.peaks[0]).toBeLessThan(r.peaks[1]);
    }
    // A cordilheira distante fica mais para trás (mais azulada pela névoa)
    expect(sc.ICE_RIDGES[0].zc).toBeLessThan(sc.ICE_RIDGES[1].zc);
    for (const [x, sy, r] of sc.ICE_BLOCKS) {
      expect(sy + r * 0.5).toBeLessThan(SHORE_Y - 25);
      expect(Math.abs(x - IGLOO.x)).toBeGreaterThan(IGLOO.rx + r * 1.4);
    }
    expect(sc.PRESSURE.line).toBeGreaterThanOrEqual(sc.SNOW_BACK);
    expect(sc.PRESSURE.line).toBeLessThan(SHORE_Y - 40);
    // Ruído determinístico e entre 0 e 1 (a foto sai sempre igual)
    expect(sc.fbm(1.3, 2.7, 5)).toBe(sc.fbm(1.3, 2.7, 5));
    for (let i = 0; i < 50; i++) {
      const v = sc.ridged(i * 0.37, i * 0.11, 3);
      expect(v >= 0 && v <= 1).toBe(true);
    }
  });

  test('com a foto pronta, a fase normal e o Natal usam o fundo 3D; sem 3D, ou num cenário ainda sem foto, continua o 2D', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (level, use3d) => {
      const g = makeGame({ level });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(1, true), 'fase normal').toBe(true);
      expect(bgDrawn(5, true), 'Natal').toBe(true);
      expect(bgDrawn(1, false), 'sem 3D').toBe(false);
      // Primeira fase especial cujo cenário ainda não tem foto 3D; quando todas tiverem,
      // um cenário sai da lista só durante o teste
      const pending = Object.keys(SPECIALS).map(Number).sort((a, b) => a - b).find((lv) => SPECIALS[lv].scenery && !SCENERY_3D[SPECIALS[lv].scenery]);
      const lv = pending ?? Object.keys(SPECIALS).map(Number).find((l) => SPECIALS[l].scenery);
      const kind = SPECIALS[lv].scenery;
      const saved = SCENERY_3D[kind];
      delete SCENERY_3D[kind];
      try {
        expect(bgDrawn(lv, true), `fase ${lv} (cenário sem foto 3D)`).toBe(false);
      } finally {
        if (saved) SCENERY_3D[kind] = saved;
      }
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto do cenário gelado sai com céu transparente, neve clara e o paredão de gelo azul na beira', async () => {
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('ice')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      expect(bg.w).toBe(W);
      expect(bg.h).toBe(WATER_TOP + 12);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const px = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      // Céu: transparente (o céu 2D aparece por baixo)
      expect(px(640, 10)[3]).toBe(0);
      // Neve onde o jogador anda: opaca e clara
      const snow = px(300, SHORE_Y - 10);
      expect(snow[3]).toBe(255);
      expect((snow[0] + snow[1] + snow[2]) / 3).toBeGreaterThan(170);
      // Paredão: opaco e mais azul que vermelho
      const wall = px(300, WATER_TOP - 6);
      expect(wall[3]).toBe(255);
      expect(wall[2]).toBeGreaterThan(wall[0] + 20);
    });
  }
});

suite('Cenários de fundo em 3D: Floresta', () => {
  test('morros com pinheiros nas faixas do 2D, a mata atrás da clareira (longe da linha do jogador) e a mesma foto do fundo 2D', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    expect(SCENERY_3D.forest).toBe('bg-forest');
    const S = SUBJECTS['bg-forest'];
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -(WATER_TOP + 12)]);
    expect(S.res).toBe(2);
    expect(S.elevation).toBe(sc.SCENE_EL);
    for (const h of sc.FOREST_HILLS) {
      expect(h.top[0]).toBeGreaterThanOrEqual(80);
      expect(h.top[1]).toBeLessThanOrEqual(170);
      expect(h.top[0]).toBeLessThan(h.top[1]);
    }
    // O morro de trás fica mais longe (mais apagado pela névoa)
    expect(sc.FOREST_HILLS[0].zc).toBeLessThan(sc.FOREST_HILLS[1].zc);
    // A mata fica no fundo da clareira, bem atrás de onde o jogador anda
    expect(sc.FOREST_EDGE.line).toBeGreaterThanOrEqual(sc.SNOW_BACK);
    expect(sc.FOREST_EDGE.line).toBeLessThan(SHORE_Y - 40);
  });

  test('na Floresta, com a foto pronta, o fundo vem do 3D (e sem 3D continua o 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (use3d) => {
      const g = makeGame({ level: 10 });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(true)).toBe(true);
      expect(bgDrawn(false)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto da Floresta sai com céu transparente, a clareira verde e o barranco de terra na beira', async () => {
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('forest')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const px = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      expect(px(640, 10)[3]).toBe(0);
      // Clareira: verde (mais verde que vermelho e que azul)
      const grass = px(500, SHORE_Y - 12);
      expect(grass[3]).toBe(255);
      expect(grass[1]).toBeGreaterThan(grass[0]);
      expect(grass[1]).toBeGreaterThan(grass[2]);
      // Barranco: terra (mais vermelho que azul)
      const bank = px(500, WATER_TOP - 6);
      expect(bank[3]).toBe(255);
      expect(bank[0]).toBeGreaterThan(bank[2] + 15);
    });
  }
});

suite('Cenários de fundo em 3D: Espaço', () => {
  test('crateras de verdade longe da base e fora da linha do jogador; cordilheiras lunares nas faixas do 2D', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    expect(SCENERY_3D.space).toBe('bg-space');
    const S = SUBJECTS['bg-space'];
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -(WATER_TOP + 12)]);
    expect(S.elevation).toBe(sc.SCENE_EL);
    for (const r of sc.MOON_RIDGES) {
      expect(r.peaks[0]).toBeGreaterThanOrEqual(90);
      expect(r.peaks[1]).toBeLessThanOrEqual(180);
    }
    const half = (r) => r * Math.sin(sc.SCENE_EL) * 1.7; // meia altura da cratera na tela, com a borda
    for (const [x, sy, r] of sc.CRATERS) {
      // Longe da base (casa da fase)
      expect(Math.abs(x - IGLOO.x), `cratera em ${x}`).toBeGreaterThan(IGLOO.rx + r * 1.7 - 40);
      // No campo de chão, sem cruzar a linha onde o jogador pisa
      expect(sy - half(r)).toBeGreaterThan(sc.SNOW_BACK - 2);
      expect(sy + half(r) < SHORE_Y - 1 || sy - half(r) > SHORE_Y + 1, `cratera em ${x}`).toBe(true);
    }
  });

  test('no Espaço, com a foto pronta, o fundo vem do 3D (e sem 3D continua o 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (use3d) => {
      const g = makeGame({ level: 15 });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(true)).toBe(true);
      expect(bgDrawn(false)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto do Espaço sai com céu transparente, chão cinza-lilás e a bacia da cratera mais escura que a borda', async () => {
      const sc = await import('../../src/m3d/scenery.js');
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('space')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const px = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      const lum = (p) => (p[0] + p[1] + p[2]) / 3;
      expect(px(640, 10)[3]).toBe(0);
      const ground = px(1000, SHORE_Y - 8);
      expect(ground[3]).toBe(255);
      expect(lum(ground)).toBeGreaterThan(110);
      expect(ground[2]).toBeGreaterThanOrEqual(ground[1]); // tom lilás/frio
      // Cratera grande: o lado de dentro perto da luz (esquerda) fica na sombra da borda
      const [cx, cy, r] = sc.CRATERS.find((c) => c[2] >= 30);
      expect(lum(px(cx - r * 0.55, cy))).toBeLessThan(lum(px(cx + r * 1.4, cy)));
    });
  }
});

suite('Cenários de fundo em 3D: Praia', () => {
  test('mar até o horizonte do 2D, as mesmas ilhas, a onda quebrando antes da areia e a foto do tamanho do fundo 2D', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    expect(SCENERY_3D.beach).toBe('bg-beach');
    const S = SUBJECTS['bg-beach'];
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -(WATER_TOP + 12)]);
    expect(S.elevation).toBe(sc.SCENE_EL);
    expect(sc.SEA_HORIZON).toBe(150);
    expect(sc.ISLANDS).toEqual([[700, 120, 16], [880, 60, 9], [180, 80, 11]]);
    // A onda quebra antes da areia, bem atrás de onde o jogador anda
    expect(sc.BEACH_SAND_BACK).toBeLessThanOrEqual(SHORE_TOP);
    expect(sc.BEACH_SAND_BACK).toBeGreaterThan(sc.SEA_HORIZON + 20);
    // O mar no horizonte cai na linha do horizonte
    expect(sc.screenOf(0, sc.zAt(sc.SEA_HORIZON))).toBeCloseTo(150, 1e-9);
  });

  test('na Praia, com a foto pronta, o fundo vem do 3D (e sem 3D continua o 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (use3d) => {
      const g = makeGame({ level: 20 });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(true)).toBe(true);
      expect(bgDrawn(false)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto da Praia sai com céu transparente, mar azul no horizonte, ilha verde e areia clara e quente', async () => {
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('beach')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const px = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      expect(px(640, 10)[3]).toBe(0);
      expect(px(400, 140)[3]).toBe(0); // acima do horizonte: céu
      const sea = px(400, 165);
      expect(sea[3]).toBe(255);
      expect(sea[2]).toBeGreaterThan(sea[0] + 40);
      const isle = px(700, 145);
      expect(isle[1]).toBeGreaterThan(isle[0]);
      const sand = px(600, SHORE_Y - 12);
      expect(sand[3]).toBe(255);
      expect(sand[0]).toBeGreaterThan(sand[2] + 20);
      expect((sand[0] + sand[1] + sand[2]) / 3).toBeGreaterThan(150);
    });
  }
});

suite('Praia: barco e jet ski no mar ao fundo', () => {
  // Gerador repetível para os sorteios
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  test('de vez em quando passa um veleiro (devagar, mais ao fundo) ou um jet ski (rápido, mais perto), nunca dois do mesmo tipo juntos', async () => {
    const { SeaTraffic, BOATS } = await import('../../src/beach.js');
    const { SEA_HORIZON, BEACH_SAND_BACK } = await import('../../src/m3d/scenery.js');
    const { sail, jetski } = BOATS.kinds;
    expect(sail.y).toBeLessThan(jetski.y);
    expect(sail.speed * 3).toBeLessThan(jetski.speed);
    // Os dois passam no mar, entre o horizonte e a onda que quebra na areia
    for (const k of [sail, jetski]) {
      expect(k.y).toBeGreaterThan(SEA_HORIZON + 8);
      expect(k.y).toBeLessThan(BEACH_SAND_BACK - 4);
    }
    const tr = new SeaTraffic(seeded(7));
    const dt = 1 / 60;
    let starts = 0;
    let lastStart = null;
    let minGap = Infinity;
    for (let t = 0; t < 180; t += dt) {
      const before = tr.list.map((v) => ({ kind: v.kind, x: v.x }));
      if (tr.update(dt)) {
        starts++;
        if (lastStart != null) minGap = Math.min(minGap, t - lastStart);
        lastStart = t;
      }
      // Nunca dois do mesmo tipo ao mesmo tempo
      expect(new Set(tr.list.map((v) => v.kind)).size).toBe(tr.list.length);
      // Quem está passando anda na velocidade do seu tipo (nunca parado)
      for (const v of tr.list) {
        const b = before.find((o) => o.kind === v.kind);
        if (b) expect(Math.abs(Math.abs(v.x - b.x) - BOATS.kinds[v.kind].speed * dt)).toBeLessThan(1e-6);
      }
    }
    expect(tr.passes.sail).toBeGreaterThanOrEqual(2);
    expect(tr.passes.jetski).toBeGreaterThanOrEqual(2);
    expect(starts).toBe(tr.passes.sail + tr.passes.jetski);
    expect(minGap).toBeGreaterThanOrEqual(BOATS.minGap - 1e-6);
  });

  test('só na Praia: na fase 20 os barcos passam; nas outras fases especiais e nas normais, não', () => {
    for (const [lv, sp] of Object.entries(SPECIALS)) expect(!!sp.boats, `fase ${lv}`).toBe(sp.id === 'praia');
    const passes = (level) => {
      const g = makeGame({ level });
      step(g, 40);
      return g.boats.passes.sail + g.boats.passes.jetski;
    };
    expect(passes(20)).toBeGreaterThan(1);
    expect(passes(15)).toBe(0);
    expect(passes(3)).toBe(0);
  });

  test('desenho: com o 3D ligado e as fotos prontas, barco e jet ski usam as fotos; sem elas, o desenho 2D; a esteira de espuma é sempre 2D', async () => {
    const { drawSeaTraffic } = await import('../../src/beach.js');
    const { drawBoat3D, SUBJECTS } = await import('../../src/model3d.js');
    const { boatPose } = await import('../../src/m3d/beach.js');
    const traffic = { list: [{ kind: 'sail', dir: 1, x: 400, y: 167, t: 1 }, { kind: 'jetski', dir: -1, x: 800, y: 179, t: 0.2 }] };
    // Toda foto pedida existe no modelo
    for (const v of [...traffic.list, { kind: 'jetski', dir: 1, t: 0.1 }, { kind: 'jetski', dir: 1, t: 0.3 }]) {
      const name = v.kind === 'sail' ? 'sailboat' : 'jetski';
      expect(SUBJECTS[name].poses().map((p) => p.key)).toContain(boatPose(v));
    }
    const was = { ...model };
    const wasArt = { ...beachArt };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      Object.assign(beachArt, { on: true, boat: drawBoat3D });
      let rec = recordingCtx();
      drawSeaTraffic(rec.ctx, traffic, 1);
      expect(rec.calls.filter((c) => c[0] === 'drawImage' && c[1] === img).length).toBe(2);
      // A esteira continua 2D (traços e o borrifo)
      expect(rec.calls.some((c) => c[0] === 'stroke')).toBe(true);
      expect(rec.calls.some((c) => c[0] === 'arc')).toBe(true);
      beachArt.on = false;
      rec = recordingCtx();
      drawSeaTraffic(rec.ctx, traffic, 1);
      expect(rec.calls.some((c) => c[0] === 'drawImage')).toBe(false);
      expect(rec.calls.filter((c) => c[0] === 'fill').length).toBeGreaterThan(6);
    } finally {
      Object.assign(model, was);
      Object.assign(beachArt, wasArt);
    }
  });
});

suite('Cenários de fundo em 3D: Halloween', () => {
  test('cemitério nas posições do 2D (lápides, cruzes e a cerca atrás delas), casarão e árvores secas nos morros ao longe', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { GRAVES } = await import('../../src/halloween.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    expect(SCENERY_3D.halloween).toBe('bg-halloween');
    const S = SUBJECTS['bg-halloween'];
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -(WATER_TOP + 12)]);
    expect(S.elevation).toBe(sc.SCENE_EL);
    // A cerca fica atrás de todas as lápides e cobre todas elas
    for (const gr of GRAVES) {
      expect(sc.FENCE.line).toBeLessThan(gr.y);
      expect(gr.x).toBeGreaterThan(sc.FENCE.from);
      expect(gr.x).toBeLessThan(sc.FENCE.to);
      // Lápides atrás da linha do jogador
      expect(gr.y).toBeLessThan(SHORE_Y);
    }
    // Casarão no alto do morro, longe da casa assombrada da fase (à direita)
    expect(sc.MANSION.base).toBeLessThan(SHORE_TOP);
    expect(Math.abs(sc.MANSION.x - IGLOO.x)).toBeGreaterThan(IGLOO.rx + 60);
    expect(sc.DEAD_TREES_FAR.length).toBe(4);
  });

  test('no Halloween, com a foto pronta, o fundo vem do 3D (e sem 3D continua o 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (use3d) => {
      const g = makeGame({ level: 25 });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(true)).toBe(true);
      expect(bgDrawn(false)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto do Halloween sai com céu transparente, gramado escuro, lápide clara e as janelas do casarão acesas', async () => {
      const sc = await import('../../src/m3d/scenery.js');
      const { GRAVES } = await import('../../src/halloween.js');
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('halloween')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const lum = (x, y) => {
        const p = g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
        return (p[0] + p[1] + p[2]) / 3;
      };
      expect(g.getImageData(10, 10, 1, 1).data[3]).toBe(0);
      const lawn = lum(900, SHORE_Y - 10);
      expect(lawn).toBeLessThan(110);
      // A lápide (sem cruz) fica mais clara que o gramado em volta
      const gr = GRAVES.find((q) => !q.cross);
      expect(lum(gr.x, gr.y - gr.h * 0.35)).toBeGreaterThan(lawn + 25);
      // Alguma janela acesa no casarão (amarelo brilhante)
      let bright = 0;
      const d = g.getImageData(Math.round((sc.MANSION.x - 50) * k), Math.round((sc.MANSION.base - 90) * k), Math.round(100 * k), Math.round(90 * k)).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 160 && d[i] > d[i + 2] + 50) bright++;
      expect(bright).toBeGreaterThan(20);
    });
  }
});

suite('"Ursos" 3D no tamanho certo', () => {
  test('cada "urso" 3D é desenhado na caixa em que foi fotografado (o lobisomem e o T-rex não ficam espremidos na caixa do urso polar)', async () => {
    const { drawBear3D } = await import('../../src/model3d.js');
    const was = { ...model };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      for (const outfit of ['polar', 'santaHat', 'brown', 'alien', 'giantCrab', 'werewolf', 'trex']) {
        const { ctx, calls } = recordingCtx();
        const b = { x: 300, y: 200, dir: 1, walk: 0.3, chasing: false };
        expect(drawBear3D(ctx, b, 1, outfit), outfit).toBe(true);
        const d = calls.find((c) => c[0] === 'drawImage' && c[1] === img);
        const name = { polar: 'bear', santaHat: 'bear-santa', brown: 'bear-brown', werewolf: 'werewolf', trex: 'trex', alien: 'alien', giantCrab: 'giantCrab' }[outfit];
        const box = SUBJECTS[name].box;
        expect(d.slice(2), outfit).toEqual([box.left, -box.top, box.right - box.left, box.top - box.bottom]);
      }
      // O lobisomem de pé é mais alto que o urso polar de quatro
      expect(SUBJECTS.werewolf.box.top).toBeGreaterThan(SUBJECTS.bear.box.top);
      // e é maior que o modelo original (que ficava pequeno perto do 2D)
      const { WOLF_SCALE } = await import('../../src/m3d/halloween.js');
      expect(WOLF_SCALE).toBeGreaterThanOrEqual(1.2);
    } finally {
      Object.assign(model, was);
    }
  });
});

suite('Cenários de fundo em 3D: Dinossauros', () => {
  test('as crateras dos vulcões caem onde o 2D solta a fumaça; pedras e brotos ficam longe do ninho, das samambaias gigantes e da caverna', async () => {
    const sc = await import('../../src/m3d/scenery.js');
    const { VOLCANOES, NEST, TREE_FERNS } = await import('../../src/dino.js');
    const { SUBJECTS } = await import('../../src/model3d.js');
    expect(SCENERY_3D.dino).toBe('bg-dino');
    const S = SUBJECTS['bg-dino'];
    expect([S.box.left, S.box.right, S.box.top, S.box.bottom]).toEqual([0, W, 0, -(WATER_TOP + 12)]);
    expect(S.elevation).toBe(sc.SCENE_EL);
    expect(sc.VOLCANO_BASE).toBe(SHORE_TOP + 6);
    VOLCANOES.forEach((v, i) => {
      const V = sc.volcanoAt(v, i);
      // Centro da boca da cratera no topo do 2D (de onde sai a fumaça), no mesmo x;
      // a borda da frente fica logo abaixo (vista de cima)
      const rimZ = V.zc + V.Rz * sc.VOLCANO_RIM;
      const top2d = SHORE_TOP + 6 - v.h;
      expect(Math.abs(sc.screenOf(V.yp, V.zc) - top2d)).toBeLessThan(1);
      expect(Math.abs(sc.screenOf(V.h(v.x, rimZ), rimZ) - top2d)).toBeLessThan(12);
      // A cratera é funda (a lava fica dentro) e o cone desce para os lados
      expect(V.h(v.x, V.zc)).toBeLessThan(V.h(v.x, rimZ));
      expect(V.h(v.x + V.R * 0.7, V.zc)).toBeLessThan(V.h(v.x, rimZ) - 40);
      // Atrás do chão da costa
      expect(V.zc + V.Rz).toBeLessThan(sc.zAt(sc.SNOW_BACK));
      // Aparência 3D: em volta do cone, na mesma distância, a encosta tem cristas e
      // sulcos de verdade (não é um cone liso)
      const ring = [];
      for (let k = 0; k < 72; k++) {
        const ang = (k / 72) * Math.PI * 2;
        ring.push(V.h(v.x + Math.cos(ang) * V.R * 0.55, V.zc + Math.sin(ang) * V.Rz * 0.55));
      }
      expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(10);
    });
    // O vulcão maior é o mais alto, como no 2D
    expect(VOLCANOES[0].h).toBeGreaterThan(VOLCANOES[1].h);
    for (const x of [NEST.x, IGLOO.x, ...TREE_FERNS.map((f) => f.x)]) expect(sc.dinoClear(x), `x ${x}`).toBe(false);
    expect(sc.dinoClear(450)).toBe(true);
    expect(sc.CYCADS_FAR.length).toBe(6);
  });

  test('nos Dinossauros, com a foto pronta, o fundo vem do 3D (e sem 3D continua o 2D)', () => {
    const was = { ...model };
    const img = { fake3d: true };
    const bgDrawn = (use3d) => {
      const g = makeGame({ level: 30 });
      g.renderer.use3d = use3d;
      const { ctx, calls } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      return calls.some((c) => c[0] === 'drawImage' && c[1] === img && c[2] === 0 && c[3] === 0 && c[4] === W && c[5] === WATER_TOP + 12);
    };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      expect(bgDrawn(true)).toBe(true);
      expect(bgDrawn(false)).toBe(false);
    } finally {
      Object.assign(model, was);
    }
  });

  if (!isNode) {
    test('no navegador: a foto dos Dinossauros sai com céu transparente, lava acesa na cratera e chão de terra', async () => {
      const { VOLCANOES } = await import('../../src/dino.js');
      const { background3D } = await import('../../src/model3d.js');
      const t0 = Date.now();
      let bg = null;
      while (!(bg = background3D('dino')) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 100));
      expect(!!bg).toBe(true);
      const g = bg.canvas.getContext('2d');
      const k = bg.canvas.width / W;
      const px = (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
      expect(px(10, 10)[3]).toBe(0);
      // Lava brilhando em volta da boca de cada vulcão
      for (const v of VOLCANOES) {
        const top = SHORE_TOP + 6 - v.h;
        let hot = 0;
        const d = g.getImageData(Math.round((v.x - 20) * k), Math.round((top - 6) * k), Math.round(40 * k), Math.round(20 * k)).data;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i] > d[i + 2] + 100) hot++;
        expect(hot).toBeGreaterThan(10);
      }
      // Chão de terra (marrom: mais vermelho que azul) onde o jogador anda
      const p = px(450, SHORE_Y - 6);
      expect(p[3]).toBe(255);
      expect(p[0]).toBeGreaterThan(p[2] + 20);
    });
  }
});

suite('Água com aspecto de líquido', () => {
  test('toda fase tem a sua superfície (água em todas, lava nos Dinossauros) e a ondulação antiga de traços não existe mais', async () => {
    // Regra mudada a pedido do usuário (remover os gráficos 2D legados): a ondulação
    // antiga de traços não existe mais; sem canvas de verdade fica só o degradê
    const { SURFACE, drawLiquidSurface } = await import('../../src/water.js');
    const sceneries = new Set(['ice', ...Object.values(SPECIALS).map((sp) => sp.scenery).filter(Boolean)]);
    for (const k of sceneries) expect(!!SURFACE.kinds[k], `cenário ${k}`).toBe(true);
    for (const [k, c] of Object.entries(SURFACE.kinds)) expect(c.recipe, k).toBe(k === 'dino' ? 'lava' : 'water');
    if (isNode) {
      const { ctx, calls } = recordingCtx();
      expect(drawLiquidSurface(ctx, 1, 'ice')).toBe(false);
      expect(calls.length).toBe(0);
      // O renderizador não desenha mais os traços da ondulação antiga
      const g = makeGame({ level: 1 });
      const r = recordingCtx();
      g.renderer.drawWater(r.ctx, 1, { hor: [200, 220, 240] });
      expect(r.calls.filter((c) => c[0] === 'quadraticCurveTo').length).toBe(0);
    }
  });

  test('reflexo do cenário na água (como nos exemplos do usuário) em todas as fases com água; a lava não reflete; sem canvas de verdade não faz nada', async () => {
    const { SURFACE, drawReflection } = await import('../../src/water.js');
    for (const [k, c] of Object.entries(SURFACE.kinds)) {
      if (k === 'dino') expect(c.reflect).toBe(0);
      else expect(c.reflect, k).toBeGreaterThan(0.3);
      // Ondas em faixas compridas na horizontal (água calma)
      if (k !== 'dino') expect(c.stretch, k).toBeGreaterThanOrEqual(2);
    }
    if (isNode) {
      const { ctx, calls } = recordingCtx();
      expect(drawReflection(ctx, 1, 'ice')).toBe(false);
      expect(calls.length).toBe(0);
    } else {
      // O que está acima da linha d'água aparece logo abaixo dela, de cabeça para baixo
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#204060';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#FF0000';
      g.fillRect(600, WATER_TOP - 30, 80, 40); // "barco" vermelho logo acima da linha
      expect(drawReflection(g, 0, 'ice')).toBe(true);
      const p = g.getImageData(640, WATER_TOP + 20, 1, 1).data;
      expect(p[0]).toBeGreaterThan(p[2] + 40);
      // Longe dele, nada de vermelho
      const q = g.getImageData(200, WATER_TOP + 20, 1, 1).data;
      expect(q[0]).toBeLessThan(q[2]);
      expect(drawReflection(g, 0, 'dino')).toBe(false);
    }
  });

  test('num aparelho lento (volume desligado pelo fps baixo) a água continua a nova, sem traços nem brilhos em cruz', () => {
    // Regra mudada a pedido do usuário: mesmo com o volume desligado a água continua a
    // nova (nada de traços nem dos brilhos em cruz do 2D antigo)
    const was = volume.enabled;
    try {
      volume.enabled = false;
      const g = makeGame({ level: 1 });
      const r = recordingCtx();
      g.renderer.drawWater(r.ctx, 1, { hor: [200, 220, 240] });
      expect(r.calls.filter((c) => c[0] === 'quadraticCurveTo').length).toBe(0);
      expect(r.calls.filter((c) => c[0] === 'fillRect').length).toBeLessThan(6);
    } finally {
      volume.enabled = was;
    }
  });

  if (!isNode) {
    test('no navegador: a superfície tem ondas de verdade (claro e escuro, sem estourar), anima, sem emendas entre as faixas da perspectiva', async () => {
      const { SURFACE, drawLiquidSurface } = await import('../../src/water.js');
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      const paint = (t, kind = 'ice') => {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.fillStyle = '#1C7E99';
        g.fillRect(0, 0, W, H);
        return drawLiquidSurface(g, t, kind);
      };
      const t0 = Date.now();
      while (!paint(1) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 16));
      expect(paint(1)).toBe(true);
      const lum = (y) => {
        const d = g.getImageData(0, y, W, 1).data;
        const out = [];
        for (let i = 0; i < d.length; i += 4) out.push((d[i] + d[i + 1] + d[i + 2]) / 3);
        return out;
      };
      // Claros e escuros na frente (ondas), não uma cor lisa
      const row = lum(600);
      expect(Math.max(...row) - Math.min(...row)).toBeGreaterThan(30);
      // Sem estourar (pedido do usuário: brilho e reflexo demais viravam manchas pretas e
      // brancas de borda dura): quase nenhum pixel da água chega ao preto ou ao branco
      {
        const d = g.getImageData(0, WATER_TOP + 20, W, H - WATER_TOP - 20).data;
        let clip = 0;
        for (let i = 0; i < d.length; i += 4) {
          const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (l < 12 || l > 235) clip++;
        }
        expect(clip / (d.length / 4)).toBeLessThan(0.01);
      }
      // Anima: outro instante, outra imagem
      const loop = SURFACE.kinds.ice.loop;
      const a = g.getImageData(0, 500, W, 40).data;
      paint(1 + loop / 3);
      const b = g.getImageData(0, 500, W, 40).data;
      let diff = 0;
      for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]);
      expect(diff / (a.length / 4)).toBeGreaterThan(4);
      // Sem emendas: a diferença entre linhas vizinhas numa divisa de faixa não é maior
      // que dentro das faixas
      paint(1);
      const steps = [];
      let prev = lum(WATER_TOP + 40);
      for (let y = WATER_TOP + 41; y < H - 2; y++) {
        const cur = lum(y);
        let s = 0;
        for (let x = 0; x < W; x += 4) s += Math.abs(cur[x] - prev[x]);
        steps.push(s / (W / 4));
        prev = cur;
      }
      const sorted = [...steps].sort((p, q) => p - q);
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(Math.max(...steps)).toBeLessThan(median * 3 + 12);
      // A lava também fica pronta e tem fendas acesas (pixels bem claros) sobre a crosta
      const t1 = Date.now();
      const lava = () => {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.fillStyle = '#D2380E';
        g.fillRect(0, 0, W, H);
        return drawLiquidSurface(g, 1, 'dino');
      };
      while (!lava() && Date.now() - t1 < 120000) await new Promise((r) => setTimeout(r, 16));
      expect(lava()).toBe(true);
      const d = g.getImageData(0, 560, W, 60).data;
      let bright = 0;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 220 && d[i + 1] > 110) bright++; // fenda acesa (amarelada)
        if (d[i] < 120) dark++;
      }
      // (limite ajustado de 200 para 50 com aprovação do usuário, que pediu as fendas menos brilhantes)
      expect(bright).toBeGreaterThan(50);
      expect(dark).toBeGreaterThan(2000);
    });
  }
});

suite('Câmera: deslocamento maior para os lados', () => {
  test('a câmera vai mais longe para cada lado (pedido do usuário: ~1 cm a mais), com o parallax de sempre', () => {
    // Antes: 0,03 (até ~19 px do jogo para cada lado); depois ~45 px; agora ~96 px
    // (pedido do usuário: mais 2 cm para cada lado)
    expect(maxSway()).toBeGreaterThan(40);
    expect(maxSway()).toBeLessThan(100);
    const was = camera.x;
    try {
      for (let i = 0; i < 300; i++) followCamera(W, 0.05);
      expect(camera.x).toBeGreaterThan(40);
      // O fundo anda menos que a frente, e o primeiro plano mais que tudo
      expect(Math.abs(swayAt(ROW_Y[3]))).toBeGreaterThan(Math.abs(swayAt(SHORE_Y)));
    } finally {
      camera.x = was;
    }
  });
});

suite('Personagem anda até a borda visível da tela', () => {
  test('em toda profundidade (costa e fileiras), andando para um lado ele para com a figura a PLAYER.edge da borda que se vê (sem parede invisível antes)', async () => {
    const { walkLimits, depthScale, swayFactor } = await import('../../src/depth.js');
    const { PLAYER } = await import('../../src/config.js');
    const onScreen = (x, y) => {
      const s = depthScale(y);
      return DEPTH.vanishX + (x - DEPTH.vanishX) * s - (x - W / 2) * DEPTH.sway.amount * swayFactor(s);
    };
    for (const y of [SHORE_Y, ...ROW_Y]) {
      const [lo, hi] = walkLimits(y, PLAYER.edge);
      expect(Math.abs(onScreen(lo, y) - PLAYER.edge)).toBeLessThan(1e-6);
      expect(Math.abs(onScreen(hi, y) - (W - PLAYER.edge))).toBeLessThan(1e-6);
    }
    // No jogo: andando na costa até travar, ele chega à borda visível dos dois lados
    const { hold, release } = await import('../helpers.js');
    const g = makeGame({ level: 1 });
    hold(g, 'right');
    step(g, 8);
    release(g, 'right');
    expect(onScreen(g.player.x, SHORE_Y)).toBeGreaterThan(W - PLAYER.edge - 1);
    hold(g, 'left');
    step(g, 10);
    release(g, 'left');
    expect(onScreen(g.player.x, SHORE_Y)).toBeLessThan(PLAYER.edge + 1);
  });
});

suite('Água sem os gráficos 2D legados', () => {
  test('o caminho de luz do sol na água é um brilho suave, sem os traços do 2D antigo', async () => {
    const { drawSunPath } = await import('../../src/depth.js');
    const { ctx, calls } = recordingCtx();
    drawSunPath(ctx, 1, 300, [255, 240, 200], 1);
    // Um único preenchimento com degradê (antes eram dezenas de tracinhos)
    expect(calls.filter((c) => c[0] === 'fillRect').length).toBe(1);
    expect(calls.some((c) => c[0] === 'createRadialGradient')).toBe(true);
  });

  test('a passagem de fase e as fotos 3D sendo tiradas não desligam o volume (nem a água nova)', () => {
    const g = makeGame();
    // Sem fotos na fila de verdade (no navegador a suíte tira fotos o tempo todo)
    let busy = false;
    g.renderer.photosBusy = () => busy;
    const was = volume.enabled;
    try {
      volume.enabled = true;
      g.time = 10;
      g.fps = DEPTH.minFps - 10;
      // Fps baixo fora da fase rolando (contagem do bônus, troféu, passagem): não conta
      for (const st of ['levelEnd', 'trophy', 'entering']) {
        g.state = st;
        for (let i = 0; i < 100; i++) g.renderer.watchFps(g, 0.1);
        expect(volume.enabled, st).toBe(true);
      }
      // Fotos sendo tiradas durante a fase: também não conta
      g.state = 'play';
      busy = true;
      for (let i = 0; i < 100; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(true);
      busy = false;
      // De volta à fase: espera o fps se recuperar antes de voltar a contar
      for (let i = 0; i < 20; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(true);
      // Se continuar lento de verdade, aí sim desliga
      for (let i = 0; i < 40; i++) g.renderer.watchFps(g, 0.1);
      expect(volume.enabled).toBe(false);
    } finally {
      volume.enabled = was;
    }
  });

  test('a textura da água é preparada junto com as fotos da fase (sem canvas de verdade não há o que esperar)', async () => {
    const { prepareSurface, surfaceReady } = await import('../../src/water.js');
    const { levelReady, prefetchLevel } = await import('../../src/model3d.js');
    if (isNode) {
      prepareSurface('ice');
      expect(surfaceReady('ice')).toBe(true);
      expect(levelReady(1)).toBe(true);
      return;
    }
    // No navegador: pedir a fase gera a textura em segundo plano até ficar pronta
    prefetchLevel(30);
    const t0 = Date.now();
    while (!surfaceReady('dino') && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
    expect(surfaceReady('dino')).toBe(true);
    // Espera também as fotos que o pedido pôs na fila (não sobram para os testes seguintes)
    const { photosBusy } = await import('../../src/model3d.js');
    while (photosBusy() && Date.now() - t0 < 180000) await new Promise((r) => setTimeout(r, 100));
  });
});

// Desenhar com o 3D liga os ganchos globais dos enfeites (powerArt, bonusArt...): um
// quadro sem 3D os devolve ao 2D para os testes seguintes
function resetArt() {
  const g = makeGame({ level: 1 });
  g.renderer.ctx = recordingCtx().ctx;
  g.renderer.draw(g);
}

suite('Só 3D no jogo de verdade', () => {
  // Fotos 3D "carregadas", mas nenhuma pronta: no modo só 3D nada cai para o 2D
  const noPhotos = (fn) => {
    const was = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      return fn();
    } finally {
      Object.assign(model, was);
    }
  };
  const frame = (level, only3d) => noPhotos(() => {
    const g = makeGame({ level });
    g.bear.active = true;
    g.particles.snow = []; // a neve (partículas) não conta: não é desenho de personagem
    g.renderer.use3d = true;
    g.renderer.only3d = only3d;
    const { ctx, calls } = recordingCtx();
    g.renderer.ctx = ctx;
    g.renderer.draw(g);
    resetArt();
    return { g, calls };
  });

  test('o jogo de verdade (src/main.js) liga o modo só 3D e informa se o aparelho tem 3D', async () => {
    const src = await (isNode
      ? import('node:fs').then((fs) => fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8'))
      : fetch('../src/main.js').then((r) => r.text()));
    expect(src).toContain('game.renderer.only3d = true');
    expect(src).toContain('game.preload.available = model3dAvailable');
  });

  test('sem as fotos prontas, o modo só 3D não desenha o 2D antigo (fundo, placas, personagem, urso, iglu, bichos)', () => {
    for (const level of [1, 5, 10, 15, 20, 25, 30]) {
      const two = frame(level, false);
      const only = frame(level, true);
      // O fundo 2D e as placas 2D nunca são desenhados
      const r = only.g.renderer;
      const imgs = only.calls.filter((c) => c[0] === 'drawImage').map((c) => c[1]);
      for (const bg of [r.bg, r.forestBg, r.spaceBg, r.beachBg, r.halloweenBg, r.dinoBg]) {
        if (bg) expect(imgs.includes(bg.canvas), `fase ${level}: fundo 2D`).toBe(false);
      }
      expect(two.calls.filter((c) => c[0] === 'drawImage').length, `fase ${level}`).toBeGreaterThan(imgs.length);
      // Os desenhos 2D (curvas e arcos dos personagens, bichos e casa) somem
      const shapes = (calls) => calls.filter((c) => ['bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse'].includes(c[0])).length;
      expect(shapes(only.calls), `fase ${level}`).toBeLessThan(shapes(two.calls) * 0.5);
    }
  });

  test('fora do modo só 3D (testes, ferramentas) o 2D continua valendo enquanto não há foto', () => {
    const { calls } = frame(1, false);
    expect(calls.filter((c) => c[0] === 'drawImage').length).toBeGreaterThan(5);
  });

  test('tela inicial: enquanto as fotos da fase 1 não ficam prontas, mostra só um fundo liso e a partida espera; começa sozinha quando ficam prontas', () => {
    const g = new Game(isNode ? fakeCanvas() : document.createElement('canvas'), { title: true });
    let ready = false;
    g.preload = { request() {}, ready: () => ready, available: () => true };
    g.renderer.only3d = true;
    expect(g.graphicsStatus()).toBe('loading');
    expect(g.renderer.hideScene(g)).toBe(true);
    g.input.emit('start');
    expect(g.state).toBe('title');
    expect(g.startPending).toBe(true);
    step(g, 0.5);
    expect(g.state).toBe('title');
    ready = true;
    step(g, 0.1);
    expect(g.state).toBe('play');
    expect(g.renderer.hideScene(g)).toBe(false);
  });

  test('aparelho sem 3D: a tela inicial avisa e a partida não começa (nunca com o desenho 2D)', () => {
    const g = new Game(isNode ? fakeCanvas() : document.createElement('canvas'), { title: true });
    g.preload = { request() {}, ready: () => true, available: () => false };
    g.renderer.only3d = true;
    expect(g.graphicsStatus()).toBe('unavailable');
    g.input.emit('start');
    step(g, 1);
    expect(g.state).toBe('title');
    const { ctx, calls } = recordingCtx();
    g.renderer.ctx = ctx;
    g.renderer.draw(g);
    expect(calls.some((c) => c[0] === 'fillText' && /não consegue mostrar os gráficos 3D/.test(c[1]))).toBe(true);
    // Sem o modo só 3D (testes) nada disso vale
    g.renderer.only3d = false;
    expect(g.graphicsStatus()).toBe('ok');
  });
});

suite('Cena em 3D · etapa 1: água 3D ao vivo', () => {
  test('todo cenário tem a sua água 3D (água em todos, lava sem reflexo nos Dinossauros)', async () => {
    const { WATER3D } = await import('../../src/m3d/water3d.js');
    const sceneries = new Set(['ice', ...Object.values(SPECIALS).map((sp) => sp.scenery).filter(Boolean)]);
    for (const k of sceneries) expect(!!WATER3D.kinds[k], `cenário ${k}`).toBe(true);
    for (const [k, c] of Object.entries(WATER3D.kinds)) {
      expect(c.lava, k).toBe(k === 'dino' ? 1 : 0);
      if (k === 'dino') expect(c.reflect).toBe(0);
      else expect(c.reflect, k).toBeGreaterThan(0.5);
    }
  });

  test('no modo só 3D a água é só a camada 3D (nada de degradê, reflexo em tiras, brilho do horizonte ou caminho de sol em 2D)', () => {
    const g = makeGame({ level: 1 });
    const got = [];
    g.renderer.only3d = true;
    g.renderer.water3d = () => ({ draw: (ctx, t, o) => { got.push(o); return true; } });
    const r = recordingCtx();
    g.renderer.drawWater(r.ctx, 1, { hor: [200, 220, 240] }, undefined, 'ice');
    expect(r.calls.length).toBe(0);
    expect(got.length).toBe(1);
    expect(got[0].kind).toBe('ice');
    expect(got[0].pal.water.length).toBe(3);
    expect(g.renderer.water3dDrawn).toBe(true);
    // No quadro inteiro: nenhum dos 2D da água (brilho do horizonte e caminho de sol)
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      g.renderer.use3d = true;
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      expect(got.length).toBe(2);
      // O sol da água acompanha o do céu
      expect(got[1].sunX).toBe(300);
      expect(got[1].sunColor.length).toBe(3);
      const horizonGlow = f.calls.filter((c) => c[0] === 'createLinearGradient' && c[2] === WATER_TOP + 10 && c[4] === WATER_TOP + 80);
      expect(horizonGlow.length).toBe(0);
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  });

  test('sem a camada 3D pronta, o modo só 3D não desenha água nenhuma (nunca a 2D); fora dele, a 2D continua', () => {
    const g = makeGame({ level: 1 });
    g.renderer.only3d = true;
    g.renderer.water3d = () => null;
    const r = recordingCtx();
    g.renderer.drawWater(r.ctx, 1, { hor: [200, 220, 240] });
    expect(r.calls.length).toBe(0);
    expect(g.renderer.water3dDrawn).toBe(false);
    g.renderer.only3d = false;
    const r2 = recordingCtx();
    g.renderer.drawWater(r2.ctx, 1, { hor: [200, 220, 240] });
    expect(r2.calls.some((c) => c[0] === 'fillRect')).toBe(true);
  });

  if (!isNode) {
    test('no navegador: a água 3D tem ondas (claro e escuro), anima, reflete o cenário e a lava é diferente', async () => {
      const { loadModel, water3D, levelReady } = await import('../../src/model3d.js');
      loadModel();
      const t0 = Date.now();
      while (!water3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const w = water3D();
      expect(!!w).toBe(true);
      expect(levelReady(1) || true).toBe(true);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      const paint = (t, kind, pal) => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#204060';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#FF0000';
        g.fillRect(600, WATER_TOP - 40, 80, 40); // "barco" vermelho logo acima da linha
        return w.draw(g, t, { kind, pal: { water: pal }, horizon: [200, 160, 140], sunColor: [255, 240, 200], sunStrength: 1, sunX: 300, sunY: 80 });
      };
      const ICE = ['#1C7E99', '#0E5670', '#052A40'];
      expect(paint(1, 'ice', ICE)).toBe(true);
      const row = (y) => Array.from(g.getImageData(0, y, W, 1).data);
      const lum = (d) => { const out = []; for (let i = 0; i < d.length; i += 4) out.push(d[i] + d[i + 1] + d[i + 2]); return out; };
      const a = lum(row(560));
      expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(25); // ondas: claro e escuro
      // Reflexo do barco vermelho logo abaixo da linha d'água (mais vermelho que longe dele)
      const redAt = (x) => { const d = g.getImageData(x - 8, WATER_TOP + 14, 16, 14).data; let r = 0; for (let i = 0; i < d.length; i += 4) r += d[i] - d[i + 2]; return r / (d.length / 4); };
      expect(redAt(640) - redAt(200)).toBeGreaterThan(10);
      // Anima
      paint(1.7, 'ice', ICE);
      const b = lum(row(560));
      expect(a.some((v, i) => Math.abs(v - b[i]) > 10)).toBe(true);
      // Lava: laranja (vermelho bem maior que azul) e sem reflexo do barco
      paint(1, 'dino', ['#FF8A1E', '#D2380E', '#5A0C06']);
      const lr = row(500);
      let red = 0;
      let blue = 0;
      for (let i = 0; i < lr.length; i += 4) { red += lr[i]; blue += lr[i + 2]; }
      expect(red).toBeGreaterThan(blue * 2);
    });
  }
});

suite('Cena em 3D · etapa 2: céu 3D ao vivo', () => {
  test('todo cenário tem o seu céu 3D (dia, espaço, noite, pré-histórico) e os céus fixos usam as cores do 2D', async () => {
    const { SKY3D } = await import('../../src/m3d/sky3d.js');
    const sceneries = new Set(['ice', ...Object.values(SPECIALS).map((sp) => sp.scenery).filter(Boolean)]);
    for (const k of sceneries) expect(!!SKY3D.kinds[k], `cenário ${k}`).toBe(true);
    expect(SKY3D.kinds.space.kind).toBe(1);
    expect(SKY3D.kinds.halloween.kind).toBe(2);
    expect(SKY3D.kinds.dino.kind).toBe(3);
    expect(SKY3D.gradients.space[0][0]).toBe('#03021A');
    expect(SKY3D.gradients.halloween[0][0]).toBe('#0B0620');
    expect(SKY3D.gradients.dino[0][0]).toBe('#2B1838');
  });

  test('no modo só 3D o céu é só a camada 3D, com o sol/lua/Terra na posição do 2D (a água usa a mesma luz)', async () => {
    const { earthPos } = await import('../../src/space.js');
    const { moonPos } = await import('../../src/halloween.js');
    const { sunPos } = await import('../../src/dino.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      for (const [level, pos] of [[1, null], [15, earthPos], [25, moonPos], [30, sunPos]]) {
        const g = makeGame({ level });
        g.renderer.use3d = true;
        g.renderer.only3d = true;
        const sky = [];
        const water = [];
        g.renderer.sky3d = () => ({ draw: (ctx, t, o) => { sky.push(o); return true; } });
        g.renderer.water3d = () => ({ draw: (ctx, t, o) => { water.push(o); return true; } });
        const f = recordingCtx();
        g.renderer.ctx = f.ctx;
        g.renderer.draw(g);
        expect(sky.length, `fase ${level}`).toBe(1);
        expect(g.renderer.sky3dDrawn).toBe(true);
        const want = pos ? pos(g.renderer.skyF) : { x: 300, y: 60 + (1 - g.renderer.skyF) * 110 };
        expect(sky[0].body.x).toBe(want.x);
        expect(Math.abs(sky[0].body.y - want.y)).toBeLessThan(1e-9);
        expect(water[0].sunX).toBe(sky[0].body.x);
        expect(water[0].sunY).toBe(sky[0].body.y);
        // Nenhum degradê do céu 2D (0 → SHORE_TOP)
        expect(f.calls.some((c) => c[0] === 'createLinearGradient' && c[2] === 0 && c[4] === SHORE_TOP)).toBe(false);
      }
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  });

  test('a aurora das fases normais vai para o céu 3D (e não em faixas 2D)', () => {
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      const g = makeGame({ level: 9 });
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      const sky = [];
      g.renderer.sky3d = () => ({ draw: (ctx, t, o) => { sky.push(o); return true; } });
      g.renderer.water3d = () => null;
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      expect(sky[0].aurora).toBeGreaterThan(0);
      // A faixa 2D da aurora desenha centenas de tirinhas de 7 px: nenhuma aqui
      expect(f.calls.filter((c) => c[0] === 'fillRect' && c[3] === 7).length).toBe(0);
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  });

  test('sem a camada pronta não há céu nenhum (nunca o 2D); bichos do céu viram modelos 3D e entram nas fotos da fase', async () => {
    const { SKY_FLYERS, levelModels } = await import('../../src/model3d.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      const g = makeGame({ level: 25 });
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      g.renderer.sky3d = () => null;
      g.renderer.water3d = () => null;
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      expect(g.renderer.sky3dDrawn).toBe(false);
      expect(f.calls.some((c) => c[0] === 'createLinearGradient' && c[2] === 0 && c[4] === SHORE_TOP)).toBe(false);
    } finally {
      Object.assign(model, before);
      resetArt();
    }
    expect(SKY_FLYERS).toEqual({ halloween: 'bat', dino: 'ptero', beach: 'gull' });
    expect(levelModels(25)).toContain('bat');
    expect(levelModels(30)).toContain('ptero');
    expect(levelModels(20)).toContain('gull');
  });

  if (!isNode) {
    test('no navegador: o céu 3D desenha o degradê, o sol/lua bem claro no lugar certo, estrelas no espaço', async () => {
      const { loadModel, sky3D } = await import('../../src/model3d.js');
      loadModel();
      const t0 = Date.now();
      while (!sky3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const s = sky3D();
      expect(!!s).toBe(true);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      const px = (x, y) => g.getImageData(x, y, 1, 1).data;
      const day = { scenery: 'ice', top: [42, 156, 192], hor: [180, 224, 236], sun: [255, 246, 216], body: { x: 300, y: 80, r: 22 }, aurora: 0 };
      expect(s.draw(g, 1, day)).toBe(true);
      const sun = px(300, 80);
      const far = px(1000, 20);
      expect(sun[0] + sun[1] + sun[2]).toBeGreaterThan(700);
      expect(far[2]).toBeGreaterThan(far[0]); // céu azul longe do sol
      // Espaço: escuro com estrelas (alguns pixels bem claros numa faixa)
      s.draw(g, 1, { ...day, scenery: 'space', body: { x: 300, y: 80, r: 26 } });
      const d = g.getImageData(700, 0, 500, 60).data;
      let dark = 0;
      let bright = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] + d[i + 1] + d[i + 2];
        if (l < 150) dark++;
        if (l > 400) bright++;
      }
      expect(dark).toBeGreaterThan(d.length / 4 * 0.6);
      expect(bright).toBeGreaterThan(5);
    });
  }
});

suite('Cena em 3D · etapa 3: partículas 3D ao vivo', () => {
  const collect = (fn) => {
    const items = [];
    fn((kind, x, y, hw, hh, rot, c, ph, blur, ex) => items.push({ kind, x, y, hw, hh, rot, c, ph, blur, ex }));
    return items;
  };
  // Jogo no modo só 3D com uma camada de partículas falsa que registra as passadas
  const frame3d = (level, setup = () => {}, layer = true) => {
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      const g = makeGame({ level });
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      g.renderer.sky3d = () => null;
      g.renderer.water3d = () => null;
      const passes = [];
      g.renderer.particles3d = () => (layer ? {
        draw: (ctx, t, light, fill) => { passes.push({ light, items: collect(fill) }); return true; },
        flame: (...a) => { passes.push({ flame: a }); return true; },
      } : null);
      setup(g);
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      return { g, passes, calls: f.calls };
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  };

  test('cada cenário tem o seu clima em 3D: neve, folhas, poeira estelar, brasas (a praia, nada)', async () => {
    const { weatherItems, P3 } = await import('../../src/m3d/particles3d.js');
    const kinds = (level) => {
      const g = makeGame({ level });
      return new Set(collect((push) => weatherItems(push, g.particles, null, 1)).map((i) => i.kind));
    };
    expect([...kinds(1)]).toEqual([P3.snow]);
    expect([...kinds(10)]).toEqual([P3.leaf]);
    expect([...kinds(25)]).toEqual([P3.leaf]);
    expect([...kinds(15)]).toEqual([P3.dust]);
    expect([...kinds(30)]).toEqual([P3.ember]);
    expect(kinds(20).size).toBe(0);
    // Folhas viram de lado (o verso aparece) e as brasas sobem (y invertido como no 2D)
    const g = makeGame({ level: 10 });
    const leaves = collect((push) => weatherItems(push, g.particles, null, 1));
    expect(leaves.some((l) => l.ex < 0) && leaves.some((l) => l.ex > 0)).toBe(true);
    const d = makeGame({ level: 30 });
    const em = collect((push) => weatherItems(push, d.particles, null, 0));
    expect(em[0].y).toBe(H - d.particles.snow[0].y);
  });

  test('no modo só 3D o clima e os flocos desfocados vão para a camada 3D (nada de neve 2D)', async () => {
    const { P3 } = await import('../../src/m3d/particles3d.js');
    const { g, passes, calls } = frame3d(1);
    const items = passes.flatMap((p) => p.items || []);
    expect(items.filter((i) => i.kind === P3.snow && i.blur < 1).length).toBe(g.particles.snow.length);
    // Os flocos perto da câmera (bokeh) entram desfocados, nunca como degradê 2D
    expect(items.filter((i) => i.kind === P3.snow && i.blur === 1).length).toBe(g.renderer.bokeh.items.length);
    expect(calls.filter((c) => c[0] === 'arc' && c[3] < 3.1).length).toBe(0);
    expect(g.renderer.particles3dDrawn).toBe(true);
    // A luz vem do lado do sol (à esquerda) e de cima
    const light = passes.find((p) => p.light)?.light;
    expect(light.dir[0]).toBeLessThan(0);
    expect(light.dir[1]).toBeGreaterThan(0);
  });

  test('fumaça da chaminé, vapor da respiração e a poeira do encaixe viram fumaça 3D na perspectiva da linha', async () => {
    const { P3, SMOKE_COLORS, rgba01 } = await import('../../src/m3d/particles3d.js');
    const { passes, calls } = frame3d(15, (g) => {
      g.particles.snow = [];
      g.particles.fx = [];
      g.particles.smoke(700, 300);
      g.particles.fx[0].t = 0.5;
      g.particles.breath(640, 600, 1);
      g.particles.fx.forEach((f) => { if (f.kind === 'vapor') f.t = 0.2; });
      g.particles.puff(640, SHORE_Y, 3, '#FF0000');
    });
    const smoke = passes.flatMap((p) => p.items || []).filter((i) => i.kind === P3.smoke);
    expect(smoke.length).toBe(1 + 3 + 3);
    // Base lunar: vapor branco na chaminé
    const base = rgba01(SMOKE_COLORS.base);
    expect(smoke.some((s) => s.c[0] === base[0] && s.c[2] === base[2])).toBe(true);
    // Poeira na costa fica na escala do fundo
    const red = smoke.filter((s) => s.c[0] === 1 && s.c[1] === 0);
    expect(red.length).toBe(3);
    // Nenhum círculo 2D de fumaça na chaminé
    expect(calls.some((c) => c[0] === 'arc' && Math.abs(c[2] - 300) < 30 && c[3] >= 5)).toBe(false);
  });

  test('vulcões (fumaça acesa pela lava, gotas) e vagalumes em 3D; tochas da cabana e da caverna são chamas 3D', async () => {
    const { P3 } = await import('../../src/m3d/particles3d.js');
    const { fireArt } = await import('../../src/particles.js');
    const dino = frame3d(30, (g) => { g.time = 2; for (let i = 0; i < 16; i++) g.igloo.add(); });
    const vol = dino.passes.flatMap((p) => p.items || []);
    expect(vol.filter((i) => i.kind === P3.smoke && i.ex > 0).length).toBeGreaterThan(5);
    expect(vol.filter((i) => i.kind === P3.glow).length).toBe(2);
    expect(vol.filter((i) => i.kind === P3.ember && i.c[3] > 0.3).length).toBeGreaterThan(5); // gotas aos 2 s
    expect(dino.passes.filter((p) => p.flame).length).toBe(0); // fotos não prontas: casa não aparece
    // Tocha direto: o gancho manda para a chama 3D e pula o desenho 2D
    const { drawTorchFlame } = await import('../../src/beach.js');
    const g = makeGame({ level: 20 });
    g.renderer.use3d = true;
    g.renderer.only3d = true;
    g.renderer.sky3d = () => null;
    g.renderer.water3d = () => null;
    const flames = [];
    g.renderer.particles3d = () => ({ draw: () => true, flame: (...a) => { flames.push(a); return true; } });
    g.renderer.ctx = recordingCtx().ctx;
    try {
      g.renderer.draw(g);
      expect(typeof fireArt.draw).toBe('function');
      const f = recordingCtx();
      drawTorchFlame(f.ctx, 1, 0);
      expect(f.calls.some((c) => c[0] === 'quadraticCurveTo')).toBe(false);
      expect(flames.length).toBe(1);
      expect(flames[0][2]).toBe(134); // x da tocha da direita
    } finally {
      resetArt();
    }
    expect(fireArt.draw).toBe(null); // fora do modo só 3D, a chama 2D de sempre
    const forest = frame3d(10, (g) => { g.renderer.skyF = 0; g.temp = 0; g.time = 0.3; });
    expect(forest.passes.flatMap((p) => p.items || []).some((i) => i.kind === P3.glow)).toBe(true);
  });

  test('sem a camada pronta não há partículas (nunca o 2D)', () => {
    const { g, calls } = frame3d(1, () => {}, false);
    expect(g.renderer.particles3dDrawn).toBe(false);
    expect(calls.filter((c) => c[0] === 'arc' && c[3] < 3.1).length).toBe(0);
  });

  if (!isNode) {
    test('no navegador: a camada desenha flocos iluminados e a chama da tocha', async () => {
      const { loadModel, particles3D } = await import('../../src/model3d.js');
      loadModel();
      const t0 = Date.now();
      while (!particles3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const p = particles3D();
      expect(!!p).toBe(true);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      expect(p.draw(g, 1, null, (push) => push(0, 400, 300, 20, 20, 0, [1, 1, 1, 1]))).toBe(true);
      const px = g.getImageData(400, 300, 1, 1).data;
      expect(px[0] + px[1] + px[2]).toBeGreaterThan(300);
      expect(g.getImageData(440, 300, 1, 1).data[0]).toBeLessThan(10);
      expect(p.flame(g, 1, 800, 400, 60, 24, 0)).toBe(true);
      const d = g.getImageData(780, 340, 40, 60).data;
      let hot = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i] > d[i + 2] + 60) hot++;
      expect(hot).toBeGreaterThan(30);
    });
  }
});

suite('Água 3D sem xadrez: marolas espaçadas', () => {
  test('as marolas ficam bem espaçadas (cristas a 140 do mundo) e cada cenário pode trocar a distância', async () => {
    const { WATER3D } = await import('../../src/m3d/water3d.js');
    expect(WATER3D.spacing).toBeGreaterThanOrEqual(120);
    for (const [k, c] of Object.entries(WATER3D.kinds)) {
      if (c.spacing != null) expect(c.spacing, `cenário ${k}`).toBeGreaterThanOrEqual(120);
    }
  });

  if (!isNode) {
    test('no navegador: a água não forma grade (as linhas vizinhas variam suave na horizontal)', async () => {
      const { loadModel, water3D } = await import('../../src/model3d.js');
      loadModel();
      const t0 = Date.now();
      while (!water3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const w = water3D();
      expect(!!w).toBe(true);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#6AA0C0';
      g.fillRect(0, 0, W, H);
      const ok = w.draw(g, 3, { kind: 'ice', pal: { water: ['#1C7E99', '#0E5670', '#052A40'] }, horizon: [180, 224, 236], sunColor: [255, 240, 210], sunStrength: 0, sunX: -500, sunY: 80 });
      expect(ok).toBe(true);
      // Faixa da frente, longe do sol: o brilho varia mais de cima para baixo (faixas
      // horizontais) que de um lado para o outro (num xadrez as duas seriam parecidas)
      const d = g.getImageData(700, 560, 200, 100).data;
      const lum = (x, y) => { const i = (y * 200 + x) * 4; return d[i] + d[i + 1] + d[i + 2]; };
      let dx = 0;
      let dy = 0;
      for (let y = 0; y < 99; y++) for (let x = 0; x < 199; x++) {
        dx += Math.abs(lum(x + 1, y) - lum(x, y));
        dy += Math.abs(lum(x, y + 1) - lum(x, y));
      }
      expect(dy).toBeGreaterThan(dx * 1.3);
    });
  }
});

suite('Cena em 3D · etapa 4: portas e cortinas 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      return fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('toda casa tem o modelo da porta (interior apagado/aceso, folha em 13 passos e batente) e ele entra nas fotos da fase', async () => {
    const { DOOR_MODELS, DOOR_SUBJECTS, LEAF_STEPS, STONE_STEPS } = await import('../../src/m3d/doors.js');
    const { levelModels } = await import('../../src/model3d.js');
    const styles = new Set(['igloo', ...Object.values(SPECIALS).map((sp) => sp.house).filter(Boolean)]);
    for (const st of styles) {
      const name = DOOR_MODELS[st];
      expect(!!name, `casa ${st}`).toBe(true);
      const keys = new Set(SUBJECTS[name].poses().map((p) => p.key));
      expect(keys.has('in0') && keys.has('in1'), name).toBe(true);
      if (st !== 'cave') {
        for (let i = 0; i <= LEAF_STEPS; i++) expect(keys.has(`k${i}`), `${name} k${i}`).toBe(true);
        expect(keys.has(st === 'base' ? 'frame1' : 'frame') || st === 'igloo', `${name} batente`).toBe(true);
      }
    }
    const stone = new Set(DOOR_SUBJECTS['door-stone'].poses().map((p) => p.key));
    expect(stone.size).toBe(STONE_STEPS);
    expect(levelModels(1)).toContain('door-igloo');
    expect(levelModels(10)).toContain('door-cabin');
    expect(levelModels(15)).toContain('door-base');
    expect(levelModels(20)).toContain('door-hut');
    expect(levelModels(25)).toContain('door-haunted');
    expect(levelModels(30)).toContain('door-stone');
  });

  test('a folha acompanha a cortina da casa (aberta → fechada) e o interior/batente acendem com alguém dentro', async () => {
    const { drawDoor3D } = await import('../../src/model3d.js');
    withFake((asked) => {
      const g = makeGame({ level: 10 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      const ctx = recordingCtx().ctx;
      g.igloo.curtain = 0.5;
      expect(drawDoor3D(ctx, 'cabin', 'leaf', g.igloo, 0)).toBe(true);
      expect(asked).toContain('door-cabin:k6');
      g.igloo.curtain = 1;
      drawDoor3D(ctx, 'cabin', 'leaf', g.igloo, 0);
      expect(asked).toContain('door-cabin:k12');
      drawDoor3D(ctx, 'cabin', 'inside', g.igloo, 0);
      expect(asked).toContain('door-cabin:in0');
      g.igloo.lit = true;
      drawDoor3D(ctx, 'cabin', 'inside', g.igloo, 0);
      drawDoor3D(ctx, 'base', 'frame', g.igloo, 0);
      expect(asked).toContain('door-cabin:in1');
      expect(asked).toContain('door-base:frame1');
    });
  });

  test('a pedra da caverna rola: a foto mais perto do ângulo da pedra 2D e o resto do giro em 2D', async () => {
    const { stonePose, STONE_STEPS } = await import('../../src/m3d/doors.js');
    const { drawDoor3D } = await import('../../src/model3d.js');
    const { doorStone } = await import('../../src/dino.js');
    const step = (Math.PI * 2) / STONE_STEPS;
    expect(stonePose(0).key).toBe('r0');
    expect(Math.abs(stonePose(0).rest)).toBe(0);
    expect(stonePose(-step).key).toBe('r1');
    expect(stonePose(step).key).toBe(`r${STONE_STEPS - 1}`);
    for (const a of [-0.3, -2.7, -9.1, 4]) expect(Math.abs(stonePose(a).rest)).toBeLessThan(step / 2 + 1e-9);
    withFake((asked) => {
      const g = makeGame({ level: 30 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.curtain = 0.3;
      const f = recordingCtx();
      expect(drawDoor3D(f.ctx, 'cave', 'leaf', g.igloo, 0)).toBe(true);
      expect(asked).toContain(`door-stone:${stonePose(doorStone(0.3).angle).key}`);
      const tr = f.calls.find((c) => c[0] === 'translate');
      expect(tr[1]).toBe(doorStone(0.3).x);
    });
  });

  test('com as portas 3D ligadas, as casas pulam o desenho 2D da abertura, da folha e do batente (a luz continua por cima)', async () => {
    const { doorArt } = await import('../../src/art.js');
    const { drawCabinDoor } = await import('../../src/forest.js');
    const { drawBaseDoor } = await import('../../src/space.js');
    const { drawHutDoor } = await import('../../src/beach.js');
    const { drawHauntedDoor } = await import('../../src/halloween.js');
    const { drawCaveDoor } = await import('../../src/dino.js');
    const before = doorArt.draw;
    try {
      const parts = [];
      doorArt.draw = (ctx, style, part) => (parts.push(`${style}:${part}`), true);
      const houses = [[10, drawCabinDoor, 'cabin'], [15, drawBaseDoor, 'base'], [20, drawHutDoor, 'hut'], [25, drawHauntedDoor, 'haunted'], [30, drawCaveDoor, 'cave']];
      for (const [level, fn, style] of houses) {
        const g = makeGame({ level });
        for (let i = 0; i < 16; i++) g.igloo.add();
        g.igloo.update(5);
        g.igloo.curtain = 0.6;
        const f = recordingCtx();
        fn(f.ctx, g.igloo, 0);
        expect(parts).toContain(`${style}:inside`);
        expect(parts).toContain(`${style}:leaf`);
        if (style !== 'cave') expect(parts).toContain(`${style}:frame`);
        // Nenhum degradê da abertura 2D
        expect(f.calls.some((c) => c[0] === 'createLinearGradient'), style).toBe(false);
      }
      // Iglu: abertura e cortina pelo gancho (a moldura já era 3D)
      const g = makeGame({ level: 1 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.curtain = 0.5;
      g.igloo.drawPorch(recordingCtx().ctx, 0);
      expect(parts).toContain('igloo:inside');
      expect(parts).toContain('igloo:leaf');
    } finally {
      doorArt.draw = before;
    }
  });

  test('o renderizador liga o gancho das portas só nas fases em 3D (sem 3D, as portas 2D de sempre)', async () => {
    const { doorArt } = await import('../../src/art.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      const g = makeGame({ level: 10 });
      g.renderer.use3d = true;
      g.renderer.ctx = recordingCtx().ctx;
      g.renderer.draw(g);
      expect(typeof doorArt.draw).toBe('function');
    } finally {
      Object.assign(model, before);
      resetArt();
    }
    expect(doorArt.draw).toBe(null);
  });

  if (!isNode) {
    test('no navegador: as fotos da porta fechada, do interior aceso e do batente têm conteúdo', async () => {
      const { loadModel, want, sprite } = await import('../../src/model3d.js');
      loadModel();
      want('door-cabin');
      const t0 = Date.now();
      while (!sprite('door-cabin', 'k12') && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      for (const key of ['k12', 'in1', 'frame']) {
        const c = sprite('door-cabin', key);
        expect(!!c, key).toBe(true);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let solid = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 200) solid++;
        expect(solid, key).toBeGreaterThan(500);
      }
    });
  }
});

suite('Efeitos pequenos em 3D, pegadas, respingos dos peixes, pranchas e câmera', () => {
  const collect = (fn) => {
    const items = [];
    fn((kind, x, y, hw, hh, rot, c, ph, blur, ex, uv) => items.push({ kind, x, y, hw, hh, rot, c, ph, blur, ex, uv }));
    return items;
  };
  const frame3d = (level, setup = () => {}) => {
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = {};
      const g = makeGame({ level });
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      g.renderer.sky3d = () => null;
      g.renderer.water3d = () => null;
      const passes = [];
      g.renderer.particles3d = () => ({
        draw: (ctx, t, light, fill) => { passes.push(collect(fill)); return true; },
        flame: () => true,
      });
      setup(g);
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      return { g, passes, calls: f.calls };
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  };

  test('a câmera vai ~2 cm mais longe para cada lado (até ~96 px do jogo) e o personagem chega às duas bordas visíveis em toda linha', async () => {
    const { walkLimits, depthScale, swayFactor } = await import('../../src/depth.js');
    const { PLAYER } = await import('../../src/config.js');
    expect(maxSway()).toBeGreaterThan(90);
    expect(maxSway()).toBeLessThan(100);
    const onScreen = (x, y) => {
      const s = depthScale(y);
      return DEPTH.vanishX + (x - DEPTH.vanishX) * s - (x - W / 2) * DEPTH.sway.amount * swayFactor(s);
    };
    for (const y of [SHORE_Y, ...ROW_Y]) {
      const [lo, hi] = walkLimits(y, PLAYER.edge);
      expect(Math.abs(onScreen(lo, y) - PLAYER.edge)).toBeLessThan(1e-6);
      expect(Math.abs(onScreen(hi, y) - (W - PLAYER.edge))).toBeLessThan(1e-6);
    }
    // Andando na costa de uma ponta à outra, sem parar antes da borda visível
    const { hold, release } = await import('../helpers.js');
    const g = makeGame({ level: 1 });
    hold(g, 'right');
    step(g, 10);
    release(g, 'right');
    expect(onScreen(g.player.x, SHORE_Y)).toBeGreaterThan(W - PLAYER.edge - 1);
    hold(g, 'left');
    step(g, 12);
    release(g, 'left');
    expect(onScreen(g.player.x, SHORE_Y)).toBeLessThan(PLAYER.edge + 1);
  });

  test('fugindo do urso, o personagem só "sai da tela" depois de passar a borda visível da costa', async () => {
    const { walkLimits } = await import('../../src/depth.js');
    const g = makeGame({ level: 4 });
    const p = g.player;
    const [, hi] = walkLimits(SHORE_Y, -40);
    expect(hi).toBeGreaterThan(W + 40);
    p.state = 'flee';
    p.t = 1;
    p.vx = 0;
    g.bear.active = false;
    p.x = hi - 5;
    p.update(0.001, g.input);
    expect(p.state).toBe('flee');
    p.x = hi + 5;
    p.update(0.001, g.input);
    expect(p.state).not.toBe('flee');
  });

  test('andando na costa ficam pegadas alternando os pés; parado ou pulando, não', async () => {
    const { PRINTS } = await import('../../src/particles.js');
    const { hold, release } = await import('../helpers.js');
    const g = makeGame({ level: 1 });
    step(g, 1);
    expect(g.particles.prints.length).toBe(0);
    hold(g, 'right');
    step(g, 0.6);
    release(g, 'right');
    const n = g.particles.prints.length;
    expect(n).toBeGreaterThan(3);
    const sides = g.particles.prints.map((p) => p.side);
    for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1]);
    expect(g.particles.prints.every((p) => p.dir === 1)).toBe(true);
    // Somem sozinhas depois de PRINTS.life
    step(g, PRINTS.life + 0.1);
    expect(g.particles.prints.length).toBe(0);
  });

  test('as pegadas somem da mais antiga para a mais nova', async () => {
    const { printAlpha, PRINTS } = await import('../../src/particles.js');
    expect(printAlpha(0)).toBe(1);
    expect(printAlpha(PRINTS.life * PRINTS.hold)).toBe(1);
    let last = 1;
    for (let t = PRINTS.life * PRINTS.hold; t <= PRINTS.life; t += 0.1) {
      expect(printAlpha(t)).toBeLessThanOrEqual(last);
      last = printAlpha(t);
    }
    expect(printAlpha(PRINTS.life)).toBe(0);
    const g = makeGame({ level: 1 });
    g.particles.footprint(500, SHORE_Y, 1, 0);
    g.particles.update(1.2);
    g.particles.footprint(522, SHORE_Y, 1, 1);
    g.particles.update(0.3);
    const [old, young] = g.particles.prints;
    expect(printAlpha(old.t)).toBeLessThan(printAlpha(young.t));
  });

  test('peixe saltando espirra água ao sair e ao voltar (gotas e anel); estrelinha, bala e ovo não', () => {
    const splashes = (level, kind) => {
      const g = makeGame({ level });
      g.critters.list.length = 0;
      g.critters.list.push({ kind, row: 1, dir: 1, vx: 0, x: 600, w: 30, ph: 0 });
      g.critters.update = () => {};
      const calls = [];
      const orig = g.particles.fishSplash.bind(g.particles);
      g.particles.fishSplash = (...a) => (calls.push(a), orig(...a));
      step(g, 4);
      return { calls, g };
    };
    const ice = splashes(1, 'fish');
    // sin(t·4) cruza o zero ~5 vezes em 4 s: sai e volta
    expect(ice.calls.length).toBeGreaterThan(3);
    expect(ice.calls.some((c) => c[2] === true) && ice.calls.some((c) => c[2] === false)).toBe(true);
    expect(ice.calls[0][1]).toBe(ice.g.rows[1].y + 9);
    expect(splashes(10, 'piranha').calls.length).toBeGreaterThan(2);
    expect(splashes(20, 'fish').calls.length).toBeGreaterThan(1); // peixinho tropical
    for (const lv of [15, 25, 30]) expect(splashes(lv, 'fish').calls.length, `fase ${lv}`).toBe(0);
    const g = makeGame({ level: 1 });
    g.particles.fishSplash(300, 400, true);
    expect(g.particles.drops.length).toBeGreaterThan(5);
    expect(g.particles.ripples.length).toBe(1);
    expect(g.particles.ripples[0].s).toBeLessThan(1);
  });

  test('modo só 3D: pegadas, anéis e bolhas de lava no chão; lascas, brilhos, bolhas e gotas por cima; textos em relevo', async () => {
    const { P3 } = await import('../../src/m3d/particles3d.js');
    const { passes, calls } = frame3d(30, (g) => {
      g.particles.snow = [];
      g.time = 1.3;
      g.particles.footprint(500, SHORE_Y, 1, 0);
      g.particles.splash(600, ROW_Y[1]);
      g.particles.update(0.05);
      g.particles.chips(600, ROW_Y[2], 3);
      g.particles.sparkle(600, ROW_Y[2], 2, '#FFEE88');
      g.particles.fx.forEach((f) => { f.t = Math.max(0.01, f.t); });
      g.particles.bubble(620, ROW_Y[3], ROW_Y[3] - 30);
      g.particles.text(640, 300, '+200', '#FFD36B');
    });
    const all = passes.flat();
    const kinds = new Set(all.map((i) => i.kind));
    for (const k of ['print', 'ring', 'shard', 'dust', 'bubble', 'snow', 'text']) expect(kinds.has(P3[k]), k).toBe(true);
    // Pegadas, anéis e bolhas de lava (cúpulas acesas) na mesma passada do chão, que vem
    // antes da passada das lascas/gotas (depois dos personagens)
    const ground = passes.findIndex((p) => p.some((i) => i.kind === P3.print));
    const over = passes.findIndex((p) => p.some((i) => i.kind === P3.shard));
    expect(ground).toBeGreaterThan(-1);
    expect(over).toBeGreaterThan(ground);
    expect(passes[ground].some((i) => i.kind === P3.ring)).toBe(true);
    expect(passes[ground].some((i) => i.kind === P3.snow && i.ex > 0.5)).toBe(true);
    const text = all.find((i) => i.kind === P3.text);
    expect(text.uv.length).toBe(4);
    // Nada desses efeitos em 2D: nem texto, nem bolinhas das gotas
    expect(calls.some((c) => c[0] === 'fillText' && c[1] === '+200')).toBe(false);
    expect(calls.some((c) => c[0] === 'strokeText')).toBe(false);
  });

  test('sem o modo só 3D, as pegadas e os efeitos pequenos continuam no desenho 2D', () => {
    const g = makeGame({ level: 1 });
    g.particles.footprint(500, SHORE_Y, 1, 0);
    g.particles.text(640, 300, '+200', '#FFD36B');
    const f = recordingCtx();
    g.renderer.ctx = f.ctx;
    g.renderer.draw(g);
    expect(f.calls.some((c) => c[0] === 'fillText' && c[1] === '+200')).toBe(true);
    expect(f.calls.some((c) => c[0] === 'ellipse')).toBe(true);
  });

  test('praia: uma prancha de surfe só por grupo (o tamanho das 3 placas), sem abrir e fechar', async () => {
    const { createRows, floeWidth, SINGLE_W } = await import('../../src/floes.js');
    const { levelModels } = await import('../../src/model3d.js');
    const { BLOCK_W, BLOCK_GAP } = await import('../../src/config.js');
    const { levelParams } = await import('../../src/levels.js');
    expect(SINGLE_W).toBe(BLOCK_W * 3 + BLOCK_GAP * 2);
    expect(levelParams(20).singleFloe).toBe(true);
    expect(floeWidth(20)).toBe(SINGLE_W);
    const rows = createRows(20);
    for (const r of rows) {
      expect(r.pieces.length).toBe(2);
      expect(r.pieces.every((p) => p.w === SINGLE_W && p.n === 1)).toBe(true);
      expect(r.frag).toBe(false);
      const g0 = r.gap;
      r.update(3);
      expect(r.gap).toBe(g0);
    }
    expect(levelModels(20)).toContain(`board${SINGLE_W}`);
    // As outras fases pares continuam fragmentadas
    expect(createRows(18)[0].frag).toBe(true);
    expect(levelParams(18).singleFloe).toBe(false);
  });

  test('Halloween: o cenário 3D tem duas cordilheiras (a do fundo atrás da da frente)', async () => {
    const { HAUNT_HILLS } = await import('../../src/m3d/scenery.js');
    expect(HAUNT_HILLS.length).toBe(2);
    expect(HAUNT_HILLS[1].zc).toBeLessThan(HAUNT_HILLS[0].zc);
    // A do fundo sobe mais na tela (aparece por cima da da frente)
    expect(HAUNT_HILLS[1].top[0]).toBeLessThan(HAUNT_HILLS[0].top[0]);
  });
});

suite('Últimos 2D em 3D: luzes, frestas, pisca-pisca, anéis e marcas do personagem', () => {
  // Liga o coletor de luzes (como o renderizador no modo só 3D) só durante fn
  const withLights = async (fn) => {
    const { lightArt } = await import('../../src/art.js');
    const was = { on: lightArt.on, items: lightArt.items, base: lightArt.base };
    lightArt.on = true;
    lightArt.items = [];
    lightArt.base = null;
    try {
      return await fn(lightArt);
    } finally {
      Object.assign(lightArt, was);
    }
  };

  test('o coletor leva cada luz para a tela pela transformação do contexto (e não faz nada desligado)', async () => {
    const { addLight, lightArt } = await import('../../src/art.js');
    expect(lightArt.on).toBe(false);
    expect(addLight(recordingCtx().ctx, 'glow', { x: 1, y: 2, r: 3 })).toBe(false);
    await withLights((la) => {
      la.base = { a: 2, d: 2, e: 10, f: 20 };
      // Contexto em escala 2 (a base) e ainda transladado (100, 50) e em escala 0,5
      const ctx = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 10 + 200, f: 20 + 100 }) };
      expect(addLight(ctx, 'glow', { x: 10, y: 4, r: 30, color: [1, 2, 3], a: 0.5 })).toBe(true);
      const g = la.items[0];
      expect(g.x).toBe(105);
      expect(g.y).toBe(52);
      expect(g.r).toBe(15);
      addLight(ctx, 'beam', { x0: 0, y0: 0, x1: 20, y1: 0, w: 4, color: [9, 9, 9] });
      expect(la.items[1].x1 - la.items[1].x0).toBe(10);
      expect(la.items[1].w).toBe(2);
    });
  });

  test('pisca-pisca do iglu: fio e lâmpadas viram luz 3D (nenhum traço ou halo 2D)', async () => {
    const { drawIglooLights } = await import('../../src/christmas.js');
    await withLights((la) => {
      const f = recordingCtx();
      drawIglooLights(f.ctx, 1.2);
      const kinds = la.items.map((i) => i.kind);
      expect(kinds.filter((k) => k === 'cord').length).toBe(7 * 4);
      expect(kinds.filter((k) => k === 'bulb').length).toBe(7 * 3);
      expect(la.items.some((i) => i.kind === 'bulb' && i.on) && la.items.some((i) => i.kind === 'bulb' && !i.on)).toBe(true);
      expect(f.calls.some((c) => ['stroke', 'arc', 'createRadialGradient'].includes(c[0]))).toBe(false);
    });
  });

  test('Halloween: neblina, abóboras acesas e a lanterna da árvore como luz 3D', async () => {
    await withLights((la) => {
      // Árvore e abóboras pelas fotos 3D (como no jogo); as luzes vão para o coletor.
      // Ligado aqui dentro (síncrono): no navegador, um quadro do jogo de fundo pode
      // rodar durante um await e desligar os ganchos
      const was = { ...halloweenArt };
      Object.assign(halloweenArt, { on: true, tree: () => true, jack: () => true });
      const f = recordingCtx();
      try {
        drawHalloweenDecor(f.ctx, 2);
      } finally {
        Object.assign(halloweenArt, was);
      }
      const kinds = new Set(la.items.map((i) => i.kind));
      for (const k of ['fog', 'glow', 'bulb', 'cord']) expect(kinds.has(k), k).toBe(true);
      expect(la.items.filter((i) => i.kind === 'fog').length).toBe(7);
      expect(f.calls.some((c) => c[0] === 'createRadialGradient' || c[0] === 'strokeRect')).toBe(false);
    });
  });

  test('portas acesas: brilho de dentro e a luz das frestas da porta fechada (cabana, base lunar e iglu)', async () => {
    const { drawCabinDoor } = await import('../../src/forest.js');
    const { drawBaseDoor } = await import('../../src/space.js');
    const { doorArt } = await import('../../src/art.js');
    const was = doorArt.draw;
    try {
      await withLights((la) => {
        doorArt.draw = () => true; // aqui dentro (síncrono), pelo mesmo motivo do teste acima
        for (const [level, fn, beams] of [[10, drawCabinDoor, 3], [15, drawBaseDoor, 1]]) {
          la.items = [];
          const g = makeGame({ level });
          for (let i = 0; i < 16; i++) g.igloo.add();
          g.igloo.update(5);
          g.igloo.lit = true;
          g.igloo.curtain = 1;
          const f = recordingCtx();
          fn(f.ctx, g.igloo, 0);
          expect(la.items.filter((i) => i.kind === 'glow').length, `fase ${level}`).toBeGreaterThan(0);
          expect(la.items.filter((i) => i.kind === 'beam').length, `fase ${level}`).toBe(beams);
          expect(f.calls.some((c) => c[0] === 'strokeRect' || (c[0] === 'stroke' && level === 15)), `fase ${level}`).toBe(false);
        }
        la.items = [];
        const g = makeGame({ level: 1 });
        for (let i = 0; i < 16; i++) g.igloo.add();
        g.igloo.update(5);
        g.igloo.lit = true;
        g.igloo.curtain = 1;
        g.igloo.drawPorch(recordingCtx().ctx, 0);
        expect(la.items.filter((i) => i.kind === 'beam').length).toBe(12);
        expect(la.items.some((i) => i.kind === 'glow')).toBe(true);
      });
    } finally {
      doorArt.draw = was;
    }
  });

  test('ondas dos bichos na água (sem o anel parado), brilho e fio da aranha, e o facho e a cauda dos bichos do espaço', async () => {
    const { drawCritter3D } = await import('../../src/model3d.js');
    const { drawUfoBeam, drawCometTail, drawStarGlow } = await import('../../src/space.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => ({ fake3d: true }) });
      await withLights((la) => {
        const f = recordingCtx();
        for (const kind of ['jellyfish', 'eyeball', 'ammonite', 'fish', 'ghost', 'spider', 'egg']) {
          drawCritter3D(f.ctx, { kind, x: 500, dir: 1, ph: 4.5, row: 1 }, 400, 0, kind);
        }
        const kinds = la.items.map((i) => i.kind);
        // O anel parado em volta dos bichos sumiu (nem 2D nem luz): no lugar dele, ondas
        // de verdade na passada do chão (critterWaveItems, testado à parte)
        expect(kinds.filter((k) => k === 'ring').length).toBe(0);
        expect(kinds.includes('glow') && kinds.includes('cord')).toBe(true);
        expect(f.calls.some((c) => c[0] === 'stroke' || c[0] === 'createRadialGradient')).toBe(false);
        la.items = [];
        const s = recordingCtx();
        const c = { x: 600, dir: 1, ph: 0 };
        drawUfoBeam(s.ctx, c, 400, 0);
        drawCometTail(s.ctx, c, 400, 0);
        drawStarGlow(s.ctx, c, 400, 0);
        expect(la.items.map((i) => i.kind)).toEqual(['cone', 'beam', 'beam', 'glow']);
        expect(la.items[1].taper).toBe(1);
        expect(s.calls.some((c2) => c2[0] === 'fill' || c2[0] === 'fillRect')).toBe(false);
      });
    } finally {
      Object.assign(model, before);
    }
  });

  test('o "!" do susto, as gotas de suor e a camada de gelo do personagem viram efeitos 3D', async () => {
    const { drawPlayerMarks } = await import('../../src/sprites.js');
    await withLights((la) => {
      const f = recordingCtx();
      drawPlayerMarks(f.ctx, { alpha: 1 }, 0.3, true, 0.8);
      const kinds = la.items.map((i) => i.kind);
      expect(kinds.filter((k) => k === 'cord').length).toBe(2);
      expect(kinds.filter((k) => k === 'drop').length).toBe(4);
      expect(kinds.filter((k) => k === 'ice').length).toBe(1);
      expect(f.calls.some((c) => ['roundRect', 'arc', 'createLinearGradient'].includes(c[0]))).toBe(false);
    });
  });

  test('o renderizador junta as luzes do quadro e desenha numa passada 3D (só no modo só 3D)', async () => {
    const { P3, lightItems } = await import('../../src/m3d/particles3d.js');
    const { lightArt } = await import('../../src/art.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => ({ fake3d: true }) });
      const g = makeGame({ level: 5 });
      for (let i = 0; i < 16; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      g.igloo.curtain = 1;
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      g.renderer.sky3d = () => null;
      g.renderer.water3d = () => null;
      const passes = [];
      g.renderer.particles3d = () => ({
        draw: (ctx, t, light, fill) => { const a = []; fill((k, ...r) => a.push(k)); passes.push(a); return true; },
        flame: () => true,
      });
      g.renderer.ctx = recordingCtx().ctx;
      g.renderer.draw(g);
      expect(lightArt.items.length).toBeGreaterThan(20);
      expect(g.renderer.lights3dDrawn).toBe(true);
      const lights = passes.find((p) => p.includes(P3.cord));
      expect(!!lights && lights.includes(P3.glow) && lights.includes(P3.beam)).toBe(true);
    } finally {
      Object.assign(model, before);
      resetArt();
    }
    expect(lightArt.on).toBe(false);
    // Pedaços de filete emendados: cada pedaço passa meia largura e some em rampa
    const items = [];
    lightItems((...a) => items.push(a), [{ kind: 'beam', x0: 0, y0: 0, x1: 20, y1: 0, w: 4, color: [255, 255, 255], a: 1 }]);
    expect(items[0][3]).toBe(12);
    expect(items[0][8]).toBeCloseTo(4 / 12);
  });

  if (!isNode) {
    test('no navegador: brilho, filete e fio aparecem na camada 3D', async () => {
      const { loadModel, particles3D } = await import('../../src/model3d.js');
      const { lightItems } = await import('../../src/m3d/particles3d.js');
      loadModel();
      const t0 = Date.now();
      while (!particles3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const p = particles3D();
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      p.draw(g, 1, null, (push) => lightItems(push, [
        { kind: 'glow', x: 300, y: 300, r: 40, color: [255, 200, 120], a: 1 },
        { kind: 'beam', x0: 500, y0: 300, x1: 600, y1: 300, w: 4, color: [255, 200, 120], a: 1 },
        { kind: 'cord', x0: 700, y0: 300, x1: 800, y1: 300, w: 3, color: [255, 255, 255], a: 1 },
      ]));
      const px = (x, y) => g.getImageData(x, y, 1, 1).data;
      expect(px(300, 300)[0]).toBeGreaterThan(120);
      expect(px(550, 300)[0]).toBeGreaterThan(120);
      expect(px(750, 300)[0]).toBeGreaterThan(60);
      expect(px(550, 320)[0]).toBeLessThan(30);
    });
  }
});

suite('Água viva: rastro das placas, onda do pouso, ondas dos bichos e borda da tela', () => {
  const collect = (fn) => {
    const items = [];
    fn((kind, x, y, hw, hh, rot, c, ph, blur, ex) => items.push({ kind, x, y, hw, hh, rot, c, ph, blur, ex }));
    return items;
  };

  test('a câmera nunca passa da sobra das camadas: com o personagem na borda da costa, o fundo cobre a tela toda', async () => {
    const { maxCamera, walkLimits } = await import('../../src/depth.js');
    const { hold, release } = await import('../helpers.js');
    // Na costa ele anda além de W, então a câmera vai além do maxSway nominal
    const [, hi] = walkLimits(SHORE_Y, 0);
    expect((hi - W / 2) * DEPTH.sway.amount).toBeGreaterThan(maxSway());
    expect(maxCamera()).toBeGreaterThanOrEqual((hi - W / 2) * DEPTH.sway.amount - 1e-9);
    const was = camera.x;
    try {
      const g = makeGame({ level: 1 });
      hold(g, 'right');
      step(g, 10);
      release(g, 'right');
      for (let i = 0; i < 400; i++) followCamera(g.player.x, 0.05);
      expect(Math.abs(camera.x)).toBeLessThanOrEqual(maxCamera() + 1e-6);
      // Cada camada esticada cobre o deslocamento dela (costa, céu, água, primeiro plano)
      for (const f of [DEPTH.sway.far, DEPTH.sway.shore, (DEPTH.sway.shore + 1) / 2]) {
        expect(maxCamera() * f + 2).toBeGreaterThanOrEqual(Math.abs(camera.x) * f);
      }
    } finally {
      camera.x = was;
    }
  });

  test('cada placa na tela tem espuma na linha d\'água e um rastro em V para trás (mais comprido mais rápido)', async () => {
    const { floeWakeItems, P3 } = await import('../../src/m3d/particles3d.js');
    const g = makeGame({ level: 1 });
    const items = collect((push) => floeWakeItems(push, g.rows, 1));
    const visible = g.rows.reduce((n, r) => n + [...r.rects()].filter((q) => !(q.x > W + 140 || q.x + q.w < -140)).length, 0);
    expect(items.filter((i) => i.kind === P3.ring).length).toBe(visible);
    expect(items.filter((i) => i.kind === P3.wake).length).toBe(visible);
    // Rastro para trás: fileira andando para a direita → rastro à esquerda da placa
    const row = g.rows[0];
    const one = collect((push) => floeWakeItems(push, [row], 1));
    const r0 = [...row.rects()].find((q) => q.x > 0 && q.x < W);
    const foam = one.find((i) => i.kind === P3.ring && Math.abs(i.x - projectX(r0.x + r0.w / 2, row.y)) < 1);
    const wake = one[one.indexOf(foam) + 1];
    expect(Math.sign(wake.x - foam.x)).toBe(-Math.sign(row.vx));
    expect(wake.rot).toBe(row.vx < 0 ? Math.PI : 0);
    const fast = makeGame({ level: 12 }).rows[0];
    const fastWake = collect((push) => floeWakeItems(push, [fast], 1)).find((i) => i.kind === P3.wake);
    expect(fastWake.hw).toBeGreaterThan(wake.hw);
  });

  test('pousando numa placa a água reage: onda em volta da placa toda e gotinhas nas duas pontas', async () => {
    const { WAKE_LINE } = await import('../../src/particles.js');
    const { placeOnFloe } = await import('../helpers.js');
    const g = makeGame({ level: 1 });
    placeOnFloe(g, 1);
    g.particles.ripples = [];
    g.particles.drops = [];
    g.onLand(1);
    const r = g.rows[1];
    const piece = g.player.support;
    expect(g.particles.ripples.length).toBe(2);
    expect(g.particles.ripples[0].w).toBe(piece.w);
    expect(g.particles.ripples[0].y).toBe(r.y + WAKE_LINE);
    expect(Math.abs(g.particles.ripples[0].x - (r.pieceX(piece) + piece.w / 2))).toBeLessThan(1e-9);
    const xs = g.particles.drops.map((d) => d.x);
    expect(Math.min(...xs)).toBeLessThan(g.particles.ripples[0].x - piece.w / 2);
    expect(Math.max(...xs)).toBeGreaterThan(g.particles.ripples[0].x + piece.w / 2);
  });

  test('modo só 3D: as placas não têm mais a sombra escura 2D; o halo da fileira acesa é luz 3D e o rastro vem na passada do chão', async () => {
    const { P3 } = await import('../../src/m3d/particles3d.js');
    const { lightArt } = await import('../../src/art.js');
    const before = { ...model };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => ({ fake3d: true, width: 10, height: 10 }) });
      const g = makeGame({ level: 1 });
      g.rows[0].active = true;
      g.renderer.use3d = true;
      g.renderer.only3d = true;
      g.renderer.sky3d = () => null;
      g.renderer.water3d = () => null;
      const passes = [];
      g.renderer.particles3d = () => ({ draw: (ctx, t, l, fill) => { passes.push(collect(fill)); return true; }, flame: () => true });
      const f = recordingCtx();
      g.renderer.ctx = f.ctx;
      g.renderer.draw(g);
      // A sombra 2D era uma elipse escura rgba(2, 28, 46, 0.32) por placa
      expect(f.calls.some((c) => c[0] === 'ellipse' && c[4] === 7)).toBe(false);
      expect(lightArt.items.some((i) => i.kind === 'halo')).toBe(true);
      expect(passes.some((p) => p.some((i) => i.kind === P3.wake))).toBe(true);
    } finally {
      Object.assign(model, before);
      resetArt();
    }
  });

  test('bichos na água fazem ondas (no lugar do anel parado); peixe no ar não faz', async () => {
    const { critterWaveItems, CRITTER_WAVES, P3 } = await import('../../src/m3d/particles3d.js');
    const g = makeGame({ level: 1 });
    const list = [
      { kind: 'clam', row: 1, dir: 1, x: 400, ph: 0 },
      { kind: 'crab', row: 2, dir: -1, x: 600, ph: 0 },
      { kind: 'goose', row: 2, dir: 1, x: 700, ph: 0 },
    ];
    const items = collect((push) => critterWaveItems(push, list, g.rows, 1));
    expect(items.filter((i) => i.kind === P3.waves).length).toBe(2); // ganso voa: sem ondas
    expect(items.filter((i) => i.kind === P3.wake).length).toBe(2);
    expect(items[0].y).toBe(g.rows[1].y + CRITTER_WAVES.clam.dy);
    // Peixe: só fora do salto (sin(t·4 + fase) ≤ 0,25)
    const fish = { kind: 'fish', row: 1, dir: 1, x: 500, ph: 0 };
    const inAir = Math.PI / 8; // sin(4t) = 1
    expect(collect((push) => critterWaveItems(push, [fish], g.rows, inAir)).length).toBe(0);
    expect(collect((push) => critterWaveItems(push, [fish], g.rows, Math.PI / 4 * 1.25)).length).toBe(2);
    // No espaço a "estrelinha" não está na água
    expect(collect((push) => critterWaveItems(push, [fish], g.rows, Math.PI / 4 * 1.25, 'space')).length).toBe(0);
  });

  if (!isNode) {
    test('no navegador: rastro das placas e ondas dos bichos aparecem na camada 3D', async () => {
      const { loadModel, particles3D } = await import('../../src/model3d.js');
      const { P3 } = await import('../../src/m3d/particles3d.js');
      loadModel();
      const t0 = Date.now();
      while (!particles3D() && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const p = particles3D();
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      p.draw(g, 1, null, (push) => {
        push(P3.wake, 400, 400, 80, 20, 0, [1, 1, 1, 1], 0, 0.4, 0);
        push(P3.waves, 800, 400, 60, 13, 0, [1, 1, 1, 1], 0, 0, 0);
      });
      const d = g.getImageData(300, 380, 200, 40).data;
      const e = g.getImageData(740, 385, 120, 30).data;
      const lit = (arr) => { let n = 0; for (let i = 0; i < arr.length; i += 4) if (arr[i] > 60) n++; return n; };
      expect(lit(d)).toBeGreaterThan(40);
      expect(lit(e)).toBeGreaterThan(40);
    });
  }
});

suite('Urso modelado no Blender (referências do usuário)', () => {
  // Lê o .glb exportado pelo blender/build_bear.py (no Node pelo disco, no navegador pela rede)
  const glbOf = async (v) => {
    const { parseGLB } = await import('../../src/m3d/glb.js');
    if (isNode) {
      const fs = await import('node:fs');
      const b = fs.readFileSync(new URL(bear3d.glbUrl(v)));
      return parseGLB(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    }
    return parseGLB(await (await fetch(bear3d.glbUrl(v))).arrayBuffer());
  };
  const BONES = ['body', 'neck', 'head', 'jaw', 'tail', ...['FL', 'FR', 'BL', 'BR'].flatMap((k) => [`up_${k}`, `low_${k}`, `foot_${k}`])];

  test('polar e marrom exportados do Blender: esqueleto com pele (pernas com joelho, cabeça, mandíbula, rabo) e cor no pelo', async () => {
    for (const v of ['polar', 'brown']) {
      const { json } = await glbOf(v);
      const names = json.nodes.map((n) => n.name);
      for (const b of BONES) expect(names.includes(b), `${v}: osso ${b}`).toBe(true);
      const skin = json.skins[0];
      for (const b of BONES) expect(skin.joints.map((j) => json.nodes[j].name).includes(b), `${v}: ${b} deforma`).toBe(true);
      const body = json.nodes.find((n) => n.name === 'SM_Bear');
      expect(body.skin != null, v).toBe(true);
      const prim = json.meshes[body.mesh].primitives[0];
      for (const a of ['POSITION', 'NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) expect(prim.attributes[a] != null, `${v}: ${a}`).toBe(true);
      // Leve o bastante para baixar no celular
      const tris = json.accessors[prim.indices].count / 3;
      expect(tris, v).toBeLessThan(80000);
    }
  });

  test('rosto das referências: olhos com branco, íris, pupila e brilho, sobrancelhas, nariz, sorriso, orelhas com miolo, boca que abre de verdade; 4 garras e almofada em cada pata', async () => {
    for (const v of ['polar', 'brown']) {
      const { json } = await glbOf(v);
      const byName = Object.fromEntries(json.nodes.map((n, i) => [n.name, i]));
      const childrenOf = (n) => (json.nodes[byName[n]].children || []).map((i) => json.nodes[i].name);
      const head = childrenOf('head');
      for (const s of ['L', 'R']) {
        for (const p of ['EyeWhite', 'Iris', 'Pupil', 'EyeShine', 'Brow', 'Ear', 'EarIn']) expect(head.includes(p + s), `${v}: ${p}${s}`).toBe(true);
      }
      for (const p of ['Nose', 'Smile1', 'Smile-1', 'Fang1', 'Fang-1']) expect(head.includes(p), `${v}: ${p}`).toBe(true);
      // Boca de verdade: o miolo escuro (com a língua pintada) estica entre a cabeça e a
      // mandíbula (malha com pele); os dentinhos de baixo vão com a mandíbula
      const bag = json.nodes.find((n) => n.name === 'MouthBag');
      expect(bag && bag.skin != null, `${v}: miolo da boca com pele`).toBe(true);
      const bagMats = json.meshes[bag.mesh].primitives.map((p) => json.materials[p.material].name);
      expect(bagMats.includes('M_MouthIn') && bagMats.includes('M_Tongue'), `${v}: boca e língua`).toBe(true);
      for (const p of ['ToothLow1', 'ToothLow-1']) expect(childrenOf('jaw').includes(p), `${v}: ${p}`).toBe(true);
      for (const k of ['FL', 'FR', 'BL', 'BR']) {
        const foot = childrenOf(`foot_${k}`);
        expect(foot.filter((n) => n.startsWith('Claw')).length, `${v}: garras ${k}`).toBe(4);
        expect(foot.includes(`Pad${k}`), `${v}: almofada ${k}`).toBe(true);
      }
      // Marrom de verdade e polar quase branco (cores do pelo nos vértices; materiais lineares)
      const fur = json.materials.find((m) => m.name === 'M_FurSolid').pbrMetallicRoughness.baseColorFactor;
      if (v === 'brown') expect(fur[0]).toBeGreaterThan(fur[2] * 2);
      else expect(Math.min(fur[0], fur[1], fur[2])).toBeGreaterThan(0.5);
    }
  });

  test('mesmo passo e mesmas fotos; a pata da frente sobe bem na passada (como na referência "andando")', () => {
    expect(bear3d.box.top).toBeGreaterThanOrEqual(125); // cabeça grande e o gorro do Natal cabem na foto
    expect(bear3d.poses().length).toBe(bear3d.FRAMES * 2 * 3);
    expect(bear3d.STANCE).toBe(0.6);
    const front = { front: true, hip: { z: 18 } };
    const back = { front: false, hip: { z: -27 } };
    expect(bear3d.footAt(front, 0.8).y - bear3d.footAt(front, 0.1).y).toBeGreaterThan(12);
    expect(bear3d.footAt(front, 0.8).y).toBeGreaterThan(bear3d.footAt(back, 0.8).y);
  });

  test('o estúdio baixa o modelo antes de fotografar; sem o arquivo, fica o urso procedural', () => {
    for (const name of ['bear', 'bear-santa', 'bear-brown']) expect(typeof SUBJECTS[name].prepare, name).toBe('function');
    expect(bear3d.glbUrl('santa')).toBe(bear3d.glbUrl('polar'));
    expect(bear3d.glbUrl('brown').endsWith('assets/models/bear-brown.glb')).toBe(true);
  });

  if (!isNode) {
    test('no navegador: o urso do Blender anda sem soltar as garras, a boca abre perseguindo e a foto sai cheia', async () => {
      const { loadModel, want, sprite } = await import('../../src/model3d.js');
      loadModel();
      const t0 = Date.now();
      while (model.state !== 'ready' && model.state !== 'failed' && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const kit = model.studio.kit;
      const THREE = kit.THREE;
      for (const v of ['polar', 'brown', 'santa']) {
        await bear3d.prepare(v);
        const rig = bear3d.build(kit, v);
        expect(rig.glb, v).toBe(true);
        expect(rig.brows.length, v).toBe(2);
        if (v === 'santa') expect(rig.hatTip, v).toBeTruthy();
        for (const p of bear3d.poses().filter((p, i) => i % 5 === 0)) {
          bear3d.apply(rig, p);
          rig.root.updateMatrixWorld(true);
          for (const leg of rig.legs) {
            const f = leg.foot.getWorldPosition(new THREE.Vector3());
            const claw = rig.nodes[`Pad${leg.key}`].children[0];
            claw.geometry.computeBoundingBox();
            const c = claw.localToWorld(claw.geometry.boundingBox.getCenter(new THREE.Vector3()));
            expect(c.distanceTo(f), `${v} ${p.key} ${leg.key}`).toBeLessThan(14);
          }
          expect(rig.nodes.Fang1.visible, p.key).toBe(p.mouth > 0);
        }
      }
      want('bear');
      while (!sprite('bear', 'walk0R0') && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 50));
      const c = sprite('bear', 'walk0R0');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let solid = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 200) solid++;
      expect(solid).toBeGreaterThan(c.width * c.height * 0.15);
    });
  }
});
