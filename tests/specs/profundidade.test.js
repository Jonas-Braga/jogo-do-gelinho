// Gráficos com profundidade 2.5D (src/depth.js): perspectiva por fileira, inclinação
// das placas, volume com luz nos personagens, sombras de contato, névoa, luz e vinheta.
// A profundidade só muda o DESENHO: a simulação continua nas mesmas coordenadas.
import { suite, test, expect } from '../harness.js';
import { isNode } from '../env.js';
import { makeGame, step } from '../helpers.js';
import { W, SHORE_Y, ROW_Y, DEPTH } from '../../src/config.js';
import {
  depthScale, projectX, visibleRange, floeTilt, withVolume, volume, contactShadow, atDepth,
} from '../../src/depth.js';
import { SPECIALS } from '../../src/specials.js';

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
