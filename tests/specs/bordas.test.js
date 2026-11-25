// Bordas da tela com a câmera deslocada (pedido do usuário): com a perspectiva e a
// câmera acompanhando o jogador, a tela mostra além de 0..W (na fileira do fundo, até
// ~−185..W+185). As placas davam a volta no trilho a 160 px das bordas, então surgiam e
// sumiam à vista, uma a uma, e o personagem caía quando a placa embaixo dele "dava a
// volta". Agora o trilho é contínuo (cópias periódicas perto das pontas) e os bichos
// entram e saem além do que a tela pode mostrar (worldEdges em src/depth.js).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, placeOnFloe } from '../helpers.js';
import { STEP, ROW_Y, PLAYER, LANDING_TOLERANCE } from '../../src/config.js';
import { worldEdges, walkLimits, visibleRange, camera, maxCamera } from '../../src/depth.js';
import { createRows } from '../../src/floes.js';
import { entryX } from '../../src/enemies.js';

// Fases: normal (placas inteiras), fragmentada (pedaços que abrem e fecham), Praia
// (prancha única de 258 px, a peça mais larga) e Piratas
const LEVELS = [1, 2, 20, 35];

suite('Bordas da tela: placas e bichos surgem e somem fora da vista', () => {
  test('worldEdges cobre tudo o que a tela mostra com a câmera em qualquer posição', () => {
    const m = maxCamera();
    const was = camera.x;
    try {
      for (const y of ROW_Y) {
        const [lo, hi] = worldEdges(y);
        for (const c of [-m, -m / 2, 0, m / 2, m]) {
          camera.x = c;
          const [a, b] = visibleRange(y, 0);
          expect(a, `y ${y} câmera ${c}`).toBeGreaterThanOrEqual(lo - 0.01);
          expect(b, `y ${y} câmera ${c}`).toBeLessThanOrEqual(hi + 0.01);
        }
      }
    } finally {
      camera.x = was;
    }
  });

  test('as placas nunca surgem nem somem à vista (andam contínuas até a borda que a câmera pode mostrar)', () => {
    for (const level of LEVELS) {
      const rows = createRows(level);
      for (const row of rows) {
        const [lo, hi] = worldEdges(row.y);
        const snap = () => [...row.rects()].map((r) => ({ p: r.piece, x: r.x, w: r.w }));
        let prev = snap();
        // 30 s: mais que uma volta inteira do trilho na fase 1
        for (let i = 0; i < Math.round(30 / STEP); i++) {
          row.update(STEP);
          const now = snap();
          const near = (a, list) => list.some((b) => b.p === a.p && Math.abs(b.x - a.x) <= Math.abs(row.vx) * STEP + 2);
          for (const a of now) {
            if (a.x + a.w > lo && a.x < hi) expect(near(a, prev), `fase ${level} fileira ${row.index}: surgiu em x=${a.x.toFixed(0)}`).toBe(true);
          }
          for (const a of prev) {
            if (a.x + a.w > lo && a.x < hi) expect(near(a, now), `fase ${level} fileira ${row.index}: sumiu em x=${a.x.toFixed(0)}`).toBe(true);
          }
          prev = now;
        }
      }
    }
  });

  test('levado pela placa até a borda visível, o jogador fica na borda e só cai quando a placa sai de baixo dele', () => {
    for (const level of [1, 20]) {
      for (let r = 0; r < ROW_Y.length; r++) {
        for (const dir of [1, -1]) {
          const g = makeGame({ level });
          const rect = placeOnFloe(g, r);
          const row = g.rows[r];
          row.dir = dir;
          const edge = walkLimits(row.y, PLAYER.edge)[dir > 0 ? 1 : 0];
          // Leva a placa para perto da borda, com o jogador em cima dela
          const target = edge - dir * 20;
          row.offset += target - (rect.x + rect.w / 2);
          const p = g.player;
          p.x = target;
          p.setSupport(row.pieceAt(p.x));
          const label = `fase ${level} fileira ${r} indo para ${dir > 0 ? 'a direita' : 'a esquerda'}`;
          expect(p.support, label).toBeTruthy();
          stepUntil(g, () => p.state !== 'stand', 20);
          expect(p.state, label).toBe('drown');
          // Caiu encostado na borda...
          expect(Math.abs(p.x - edge), label).toBeLessThan(1);
          // ...e só porque nenhuma placa (em nenhuma volta do trilho) estava mais embaixo dele
          const covered = row.pieces.some((q) => {
            const x = row.pieceX(q, p.x);
            return p.x >= x - LANDING_TOLERANCE && p.x <= x + q.w + LANDING_TOLERANCE;
          });
          expect(covered, label).toBe(false);
        }
      }
    }
  });

  test('bichos, prêmios e itens entram além do que a tela pode mostrar e só somem fora dela', () => {
    for (const level of [3, 20]) {
      const g = makeGame({ level, quiet: false });
      g.bear.active = false;
      const cr = g.critters;
      for (let r = 0; r < ROW_Y.length; r++) {
        const [lo, hi] = worldEdges(ROW_Y[r]);
        expect(entryX(r, 1)).toBeLessThan(lo - 20);
        expect(entryX(r, -1)).toBeGreaterThan(hi + 20);
        cr.list = [];
        cr.spawn(r);
        for (const c of cr.list) expect(c.x + c.w / 2 < lo || c.x - c.w / 2 > hi, `fase ${level} fileira ${r}`).toBe(true);
      }
      // Rodando de verdade: quem some da lista estava fora da vista
      cr.list = [];
      g.player.row = -1;
      let last = new Map();
      for (let i = 0; i < Math.round(40 / STEP); i++) {
        g.update(STEP);
        const now = new Map(cr.list.map((c) => [c, c.x]));
        for (const [c, x] of last) {
          if (now.has(c) || c.dead) continue;
          const [lo, hi] = worldEdges(ROW_Y[c.row]);
          expect(x < lo || x > hi, `fase ${level}: ${c.kind} sumiu em x=${x.toFixed(0)}`).toBe(true);
        }
        for (const [c, x] of now) {
          if (last.has(c)) continue;
          const [lo, hi] = worldEdges(ROW_Y[c.row]);
          expect(x + c.w / 2 < lo || x - c.w / 2 > hi, `fase ${level}: ${c.kind} surgiu em x=${x.toFixed(0)}`).toBe(true);
        }
        last = now;
        if (g.state !== 'play') break;
      }
    }
  });
});
