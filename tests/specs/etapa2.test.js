// Etapa 2: iglu, temperatura, vidas, pontuação e conclusão da fase.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, hold, release, placeOnFloe, jump, aimAtRow0, press, enterIgloo } from '../helpers.js';
import { RULES, W } from '../../src/config.js';

const fillIgloo = (g) => {
  while (!g.igloo.complete) g.igloo.add();
};

suite('Etapa 2 · iglu, temperatura, vidas e pontos', () => {
  test('pousar numa fileira branca: fica azul, +10×fase pontos e +1 bloco', () => {
    const g = makeGame();
    aimAtRow0(g);
    jump(g, 'down');
    expect(g.rows[0].active).toBe(true);
    expect(g.score).toBe(10);
    expect(g.igloo.count).toBe(1);
  });

  test('pousar numa fileira já azul não pontua nem constrói', () => {
    const g = makeGame();
    for (const r of g.rows) r.speed = 0;
    placeOnFloe(g, 0);
    g.onLand(0);
    jump(g, 'up');
    jump(g, 'down');
    expect(g.player.row).toBe(0);
    expect(g.score).toBe(10);
    expect(g.igloo.count).toBe(1);
  });

  test('pontos por placa escalam com a fase', () => {
    const g = makeGame({ level: 3 });
    g.onLand(1);
    expect(g.score).toBe(30);
  });

  test('quando as 4 fileiras ficam azuis, voltam a ser brancas', () => {
    const g = makeGame();
    for (let i = 0; i < 4; i++) g.onLand(i);
    step(g, 0.5);
    expect(g.rows.every((r) => !r.active)).toBe(true);
    expect(g.igloo.count).toBe(4);
  });

  test('iglu: 15 blocos + porta, nunca passa de 16', () => {
    const g = makeGame();
    expect(g.igloo.layout.length).toBe(15);
    for (let i = 0; i < 25; i++) {
      g.onLand(i % 4);
      if (i % 4 === 3) step(g, 0.5);
    }
    expect(g.igloo.count).toBe(16);
    expect(g.igloo.complete).toBe(true);
  });

  test('Espaço inverte a direção da fileira atual e custa 1 bloco', () => {
    const g = makeGame();
    g.igloo.add();
    g.igloo.add();
    placeOnFloe(g, 1);
    const dir = g.rows[1].dir;
    press(g, 'action');
    expect(g.rows[1].dir).toBe(-dir);
    expect(g.igloo.count).toBe(1);
    expect(g.rows[0].dir, 'outras fileiras não mudam').toBe(1);
  });

  test('inverter sem blocos não faz nada', () => {
    const g = makeGame();
    placeOnFloe(g, 1);
    const dir = g.rows[1].dir;
    press(g, 'action');
    expect(g.rows[1].dir).toBe(dir);
    expect(g.igloo.count).toBe(0);
  });

  test('inverter na costa não faz nada', () => {
    const g = makeGame();
    g.igloo.add();
    const dirs = g.rows.map((r) => r.dir);
    press(g, 'action');
    expect(g.rows.map((r) => r.dir)).toEqual(dirs);
    expect(g.igloo.count).toBe(1);
  });

  test('temperatura começa em 45° e cai 1° por segundo', () => {
    const g = makeGame();
    expect(g.temp).toBe(45);
    step(g, 10.02);
    expect(g.temp).toBe(35);
  });

  test('em 0° o personagem congela, perde uma vida e a temperatura volta a 45°', () => {
    const g = makeGame();
    g.temp = 1;
    g.tempAcc = 0;
    step(g, 1.05);
    expect(g.player.state).toBe('freeze');
    step(g, 2.5);
    expect(g.lives).toBe(2);
    expect(g.temp).toBe(45);
    expect(g.player.state).toBe('stand');
  });

  test('progresso do iglu é mantido ao perder uma vida', () => {
    const g = makeGame();
    g.igloo.add();
    g.igloo.add();
    g.player.fall();
    step(g, 2);
    expect(g.lives).toBe(2);
    expect(g.igloo.count).toBe(2);
  });

  test('começa com 3 vidas e ganha 1 a cada 5.000 pontos', () => {
    const g = makeGame();
    expect(g.lives).toBe(3);
    g.addScore(4990);
    expect(g.lives).toBe(3);
    g.addScore(20);
    expect(g.lives).toBe(4);
    g.addScore(5000);
    expect(g.lives).toBe(5);
  });

  test('fim de jogo ao perder a última vida; Enter reinicia', () => {
    const g = makeGame();
    g.lives = 1;
    g.score = 777;
    g.player.fall();
    step(g, 2);
    expect(g.state).toBe('gameOver');
    press(g, 'start');
    expect(g.state).toBe('play');
    expect(g.score).toBe(0);
    expect(g.lives).toBe(3);
    expect(g.level).toBe(1);
  });

  test('Espaço também reinicia após o fim de jogo', () => {
    const g = makeGame();
    g.lives = 1;
    g.player.fall();
    step(g, 2);
    expect(g.state).toBe('gameOver');
    press(g, 'action');
    expect(g.state).toBe('play');
  });

  test('com o iglu incompleto, passar pela porta não entra', () => {
    const g = makeGame();
    g.player.x = g.igloo.doorX - 150;
    hold(g, 'right');
    step(g, 2);
    release(g, 'right');
    expect(g.state).toBe('play');
    expect(g.player.x).toBeGreaterThan(g.igloo.doorX);
  });

  test('iglu completo: entrar pela porta conclui a fase com bônus de temperatura', () => {
    const g = makeGame();
    fillIgloo(g);
    g.temp = 20;
    g.tempAcc = 0;
    g.player.x = g.igloo.doorX - 100;
    hold(g, 'right');
    stepUntil(g, () => g.atDoor, 3);
    release(g, 'right');
    enterIgloo(g); // ↑ em frente à porta (regra nova, pedida pelo usuário)
    expect(g.state).toBe('entering');
    stepUntil(g, () => g.state === 'levelEnd', 3);
    expect(g.state).toBe('levelEnd');
    const temp = g.temp;
    const before = g.score;
    stepUntil(g, () => g.level === 2, 10);
    expect(g.score - before).toBe(temp * 10);
  });

  test('nova fase: iglu vazio, 45°, fileiras brancas e placas mais rápidas', () => {
    const g = makeGame();
    const speed1 = g.rows[0].speed;
    g.onLand(0);
    fillIgloo(g);
    g.player.x = g.igloo.doorX;
    step(g, 0.1);
    enterIgloo(g);
    stepUntil(g, () => g.level === 2, 15);
    expect(g.level).toBe(2);
    expect(g.state).toBe('play');
    expect(g.igloo.count).toBe(0);
    expect(g.temp).toBe(45);
    expect(g.rows.every((r) => !r.active)).toBe(true);
    expect(g.rows[0].speed).toBeGreaterThan(speed1);
  });

  test('temperatura não cai durante a contagem do bônus nem após entrar', () => {
    const g = makeGame();
    fillIgloo(g);
    g.player.x = g.igloo.doorX;
    enterIgloo(g);
    expect(g.state).toBe('entering');
    const t = g.temp;
    step(g, 0.8);
    expect(g.temp).toBe(t);
  });

  test('screen shake ao perder vida', () => {
    const g = makeGame();
    expect(g.shake).toBe(0);
    g.player.fall();
    expect(g.shake).toBeGreaterThan(0);
    step(g, 1);
    expect(g.shake).toBe(0);
  });

  test('números flutuantes aparecem ao pontuar', () => {
    const g = makeGame();
    aimAtRow0(g);
    jump(g, 'down');
    expect(g.particles.texts.length).toBeGreaterThan(0);
  });

  test('HUD e telas renderizam: jogo, pausa, fim de fase e fim de jogo', () => {
    const g = makeGame();
    g.renderer.draw(g);
    g.paused = true;
    g.renderer.draw(g);
    g.paused = false;
    fillIgloo(g);
    g.player.x = g.igloo.doorX;
    enterIgloo(g);
    stepUntil(g, () => g.state === 'levelEnd', 4);
    expect(g.state).toBe('levelEnd');
    g.renderer.draw(g);
    g.temp = 3;
    g.renderer.draw(g);
    g.lives = 1;
    g.state = 'play';
    g.player.respawn();
    g.player.fall();
    step(g, 2);
    expect(g.state).toBe('gameOver');
    g.renderer.draw(g);
    expect(W).toBe(1280);
  });
});
