// Etapa 1: game loop, água, placas se movendo e o personagem pulando.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, hold, release, centerRow, placeOnFloe, jump, aimAtRow0, press } from '../helpers.js';
import { STEP, W, SHORE_Y, PLAYER, MARGIN, TRACK } from '../../src/config.js';

suite('Etapa 1 · loop, placas e movimento', () => {
  test('loop acumula delta time e roda em passo fixo', () => {
    const g = makeGame();
    g.last = 1000;
    g.acc = 0;
    const t0 = g.time;
    g.frame(1050);
    expect(g.time - t0).toBeCloseTo(0.05, STEP);
  });

  test('delta time muito grande é limitado (sem saltos após aba inativa)', () => {
    const g = makeGame();
    g.last = 0;
    g.acc = 0;
    const t0 = g.time;
    g.frame(10000);
    expect(g.time - t0).toBeLessThanOrEqual(0.25 + STEP);
  });

  test('simulação independe do FPS (30 fps ≈ 144 fps)', () => {
    const run = (fps) => {
      const g = makeGame();
      g.last = 0;
      g.acc = 0;
      for (let i = 1; i <= fps * 2; i++) g.frame((i * 1000) / fps);
      return g;
    };
    const a = run(30);
    const b = run(144);
    expect(a.time).toBeCloseTo(b.time, STEP * 2);
    expect(a.rows[0].offset).toBeCloseTo(b.rows[0].offset, 2);
  });

  test('pausado, a simulação não avança', () => {
    const g = makeGame();
    g.paused = true;
    g.last = 0;
    const t0 = g.time;
    g.frame(100);
    expect(g.time).toBe(t0);
  });

  test('P alterna a pausa', () => {
    const g = makeGame();
    press(g, 'pause');
    expect(g.paused).toBe(true);
    press(g, 'pause');
    expect(g.paused).toBe(false);
  });

  test('4 fileiras com direções alternadas', () => {
    const g = makeGame();
    expect(g.rows.length).toBe(4);
    expect(g.rows.map((r) => r.dir)).toEqual([1, -1, 1, -1]);
    for (const r of g.rows) expect(r.speed).toBeGreaterThan(0);
  });

  test('placas saem por um lado e reaparecem do lado oposto', () => {
    const g = makeGame();
    const piece = g.rows[0].pieces[0]; // fileira 0 anda para a direita
    let prev = g.rows[0].pieceX(piece);
    let wrapped = false;
    for (let i = 0; i < (30 / STEP); i++) {
      g.update(STEP);
      const x = g.rows[0].pieceX(piece);
      expect(x).toBeGreaterThanOrEqual(-MARGIN);
      expect(x).toBeLessThan(TRACK - MARGIN);
      if (x < prev - 500) {
        wrapped = true;
        expect(prev, 'saiu pela direita').toBeGreaterThan(W);
        expect(x, 'voltou pela esquerda').toBeLessThan(0);
      }
      prev = x;
    }
    expect(wrapped, 'houve reaparecimento').toBe(true);
  });

  test('jogador começa de pé na costa', () => {
    const g = makeGame();
    expect(g.player.state).toBe('stand');
    expect(g.player.row).toBe(-1);
    expect(g.player.y).toBe(SHORE_Y);
  });

  test('pula da costa para uma placa e é carregado por ela', () => {
    const g = makeGame();
    aimAtRow0(g);
    jump(g, 'down');
    expect(g.player.state).toBe('stand');
    expect(g.player.row).toBe(0);
    const x0 = g.player.x;
    step(g, 0.5);
    expect(g.player.x - x0).toBeCloseTo(g.rows[0].vx * 0.5, 1);
  });

  test('volta da placa para a costa', () => {
    const g = makeGame();
    placeOnFloe(g, 0);
    jump(g, 'up');
    expect(g.player.state).toBe('stand');
    expect(g.player.row).toBe(-1);
  });

  test('pula entre todas as fileiras para baixo e para cima', () => {
    const g = makeGame();
    for (const r of g.rows) r.speed = 0;
    for (let row = 0; row < 4; row++) centerRow(g, row);
    g.player.x = W / 2;
    for (let row = 0; row < 4; row++) {
      jump(g, 'down');
      expect(g.player.row, `desceu para ${row}`).toBe(row);
    }
    for (let row = 2; row >= -1; row--) {
      jump(g, 'up');
      expect(g.player.row, `subiu para ${row}`).toBe(row);
    }
  });

  test('pular na água afoga, perde a vida e renasce na costa', () => {
    const g = makeGame();
    centerRow(g, 0);
    g.player.x = W / 2 + 400; // sem placa embaixo
    jump(g, 'down');
    expect(g.player.state).toBe('drown');
    step(g, PLAYER.drownTime + 0.1);
    expect(g.lives).toBe(2);
    expect(g.player.state).toBe('stand');
    expect(g.player.row).toBe(-1);
  });

  test('andar para fora da placa cai na água', () => {
    const g = makeGame();
    for (const r of g.rows) r.speed = 0;
    placeOnFloe(g, 0);
    hold(g, 'right');
    step(g, 0.8);
    release(g, 'right');
    expect(g.player.state).toBe('drown');
  });

  test('não pula para cima estando na costa nem para baixo na última fileira', () => {
    const g = makeGame();
    hold(g, 'up');
    step(g, 1);
    release(g, 'up');
    expect(g.player.row).toBe(-1);
    expect(g.player.y).toBe(SHORE_Y);

    g.rows[3].speed = 0;
    placeOnFloe(g, 3);
    hold(g, 'down');
    step(g, 0.5);
    release(g, 'down');
    expect(g.player.row).toBe(3);
    expect(g.player.state).toBe('stand');
  });

  test('jogador não sai da tela', () => {
    const g = makeGame();
    hold(g, 'left');
    step(g, 5);
    release(g, 'left');
    expect(g.player.x).toBeGreaterThanOrEqual(PLAYER.edge);
    hold(g, 'right');
    step(g, 8);
    release(g, 'right');
    expect(g.player.x).toBeLessThanOrEqual(W - PLAYER.edge);
  });

  test('placa leva o jogador contra a borda e ele cai na água', () => {
    const g = makeGame();
    placeOnFloe(g, 0); // fileira 0 anda para a direita
    g.player.x = W - PLAYER.edge - 30;
    const r = g.rows[0].pieceAt(g.player.x);
    if (!r) {
      // garante que haja placa sob o jogador perto da borda
      g.rows[0].offset += g.player.x - (g.rows[0].pieceAt(W / 2).x + 41);
    }
    g.player.setSupport(g.rows[0].pieceAt(g.player.x));
    step(g, 6);
    expect(g.lives).toBe(2);
  });

  test('renderiza sem erros na costa, pulando e afogando', () => {
    const g = makeGame();
    g.renderer.draw(g);
    aimAtRow0(g);
    hold(g, 'down');
    step(g, 0.2);
    release(g, 'down');
    g.renderer.draw(g);
    g.player.fall();
    step(g, 0.3);
    g.renderer.draw(g);
  });
});
