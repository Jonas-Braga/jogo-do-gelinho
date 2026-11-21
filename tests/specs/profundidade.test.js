// Gráficos com profundidade 2.5D (src/depth.js): perspectiva por fileira, inclinação
// das placas, volume com luz nos personagens, sombras de contato, névoa, luz e vinheta.
// A profundidade só muda o DESENHO: a simulação continua nas mesmas coordenadas.
import { suite, test, expect } from '../harness.js';
import { isNode } from '../env.js';
import { makeGame, step } from '../helpers.js';
import { W, SHORE_Y, ROW_Y, DEPTH } from '../../src/config.js';
import {
  depthScale, projectX, visibleRange, floeTilt, withVolume, volume, contactShadow, atDepth,
  camera, followCamera, swayAt, maxSway, sceneLight, foregroundKind,
} from '../../src/depth.js';
import { SPECIALS } from '../../src/specials.js';
import { playerPose, poseList, loadModel, model, SUBJECTS, CRITTERS_3D, floeSprite3D } from '../../src/model3d.js';
import { floeSubject } from '../../src/m3d/floes.js';

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
      for (const lv of Object.keys(SPECIALS).map(Number)) expect(uses3d(lv)).toBe(false);
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
