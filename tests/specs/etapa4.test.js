// Etapa 4: arte final, animações, partículas e áudio.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, hold, release, placeOnFloe, aimAtRow0, jump, enterIgloo } from '../helpers.js';
import { auroraStrength } from '../../src/renderer.js';
import { floeOffset } from '../../src/floes.js';
import { RULES, STEP, PLAYER, PLAYER_HEIGHT, IGLOO } from '../../src/config.js';
import { SINK, ENTER } from '../../src/player.js';

const fxOf = (g, kind) => g.particles.fx.filter((f) => f.kind === kind);

suite('Etapa 4 · animações, partículas, aurora e áudio', () => {
  // ---- Animações do personagem
  test('animação idle parado e corrida ao andar', () => {
    const g = makeGame();
    step(g, 0.1);
    expect(g.player.anim).toBe('idle');
    hold(g, 'right');
    step(g, 0.1);
    expect(g.player.anim).toBe('run');
    release(g, 'right');
    step(g, 0.1);
    expect(g.player.anim).toBe('idle');
  });

  test('animação de pulo durante o salto', () => {
    const g = makeGame();
    aimAtRow0(g);
    hold(g, 'down');
    step(g, 0.1);
    release(g, 'down');
    expect(g.player.anim).toBe('jump');
  });

  test('animações de queda na água, congelamento e entrada no iglu', () => {
    const a = makeGame();
    a.player.fall();
    expect(a.player.anim).toBe('drown');

    const b = makeGame();
    b.temp = 1;
    b.tempAcc = 0;
    step(b, 1.05);
    expect(b.player.anim).toBe('freeze');

    const c = makeGame();
    while (!c.igloo.complete) c.igloo.add();
    c.player.x = c.igloo.doorX;
    enterIgloo(c);
    expect(c.player.anim).toBe('enter');
  });

  test('animações de susto e fuga do urso', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.player.invuln = 0;
    g.bear.x = g.player.x + 60;
    stepUntil(g, () => g.player.state === 'flee', 1);
    expect(g.player.anim).toBe('scared');
    step(g, 0.5);
    expect(g.player.anim).toBe('flee');
  });

  test('todas as animações renderizam sem erro', () => {
    const g = makeGame({ level: 5 });
    const draw = () => g.renderer.draw(g);
    draw(); // idle
    hold(g, 'left');
    step(g, 0.1);
    draw(); // run
    release(g, 'left');
    aimAtRow0(g);
    hold(g, 'down');
    step(g, 0.15);
    release(g, 'down');
    draw(); // jump
    step(g, 0.5);
    draw(); // em pé na placa (balançando)
    g.player.fall();
    step(g, 0.4);
    draw(); // drown com bolhas
  });

  // ---- Afundar: sem fade, some por inteiro abaixo da linha d'água
  test('ao afundar não há transparência: o personagem afunda por completo', () => {
    const g = makeGame();
    g.player.fall();
    const sink = g.player.sinkLine;
    let prevY = g.player.y;
    let last = null;
    for (let i = 0; i < 3 / STEP && g.lives === 3; i++) {
      g.update(STEP);
      if (g.lives === 3) {
        expect(g.player.alpha, 'sem fade').toBe(1);
        expect(g.player.y, 'sempre descendo').toBeGreaterThanOrEqual(prevY);
        prevY = g.player.y;
        last = { y: g.player.y };
      }
    }
    expect(g.lives).toBe(2);
    // No último quadro antes de perder a vida, até as mãos erguidas estavam abaixo d'água
    expect(last.y - SINK.reach).toBeGreaterThan(sink);
  });

  test('ao sumir na água: "glub", bolhas e anel na superfície', () => {
    const g = makeGame();
    g.player.fall();
    stepUntil(g, () => g.player.submerged, 3);
    expect(g.player.submerged).toBe(true);
    expect(g.sfx.history).toContain('glub');
    expect(fxOf(g, 'bubble').length).toBeGreaterThanOrEqual(5);
    expect(g.particles.ripples.length).toBeGreaterThan(0);
  });

  test('afundar perde a vida dentro do tempo-limite (drownTime)', () => {
    const g = makeGame();
    g.player.fall();
    const t = stepUntil(g, () => g.lives === 2, 3);
    expect(t).toBeLessThanOrEqual(PLAYER.drownTime);
  });

  // ---- Entrar no iglu: porta na frente; com ↑ vira de costas e entra, sem fade
  const readyIgloo = (x) => {
    const g = makeGame();
    while (!g.igloo.complete) g.igloo.add();
    step(g, 0.6);
    g.player.x = x;
    return g;
  };

  test('a porta comporta o personagem entrando (de costas, se afastando)', () => {
    const g = makeGame();
    expect(g.igloo.doorHeight).toBeGreaterThanOrEqual(PLAYER_HEIGHT * (1 - ENTER.shrink));
    expect(g.igloo.doorWidth).toBeGreaterThan(36); // ombros/braços do personagem
    expect(g.igloo.doorX, 'porta na frente, no centro da cúpula').toBe(IGLOO.x);
  });

  test('em frente à porta, sem apertar ↑, o personagem não entra', () => {
    const g = readyIgloo(IGLOO.x);
    step(g, 2);
    expect(g.state).toBe('play');
    expect(g.player.state).toBe('stand');
    expect(g.atDoor).toBe(true);
  });

  test('↑ longe da porta não faz entrar', () => {
    const g = readyIgloo(IGLOO.x - IGLOO.doorZone - 30);
    hold(g, 'up');
    step(g, 0.5);
    release(g, 'up');
    expect(g.state).toBe('play');
    expect(g.atDoor).toBe(false);
  });

  test('↑ com o iglu incompleto não faz entrar', () => {
    const g = makeGame();
    g.igloo.add();
    g.player.x = IGLOO.x;
    hold(g, 'up');
    step(g, 0.5);
    release(g, 'up');
    expect(g.state).toBe('play');
  });

  test('dica "↑ entrar" só aparece em frente à porta do iglu completo', () => {
    const g = readyIgloo(IGLOO.x + 10);
    expect(g.atDoor).toBe(true);
    g.renderer.draw(g);
    g.player.x = 300;
    expect(g.atDoor).toBe(false);
    const inc = makeGame();
    inc.player.x = IGLOO.x;
    expect(inc.atDoor).toBe(false);
  });

  test('↑ na porta: vira de costas, centraliza, entra e a cortina fecha, sem fade', () => {
    const g = readyIgloo(IGLOO.x + 15);
    enterIgloo(g);
    expect(g.state).toBe('entering');
    const seen = new Set();
    let minScale = 1;
    while (g.state === 'entering') {
      g.update(STEP);
      if (g.player.state !== 'enter') break;
      expect(g.player.alpha, 'sem fade').toBe(1);
      seen.add(g.player.phase);
      if (g.player.phase !== 'turn') {
        expect(g.player.back, 'de costas').toBe(true);
        expect(g.player.x, 'centralizado na porta').toBeCloseTo(IGLOO.x, 0.01);
      }
      minScale = Math.min(minScale, g.player.scale);
    }
    expect([...seen]).toEqual(['turn', 'in', 'close']);
    expect(g.state).toBe('levelEnd');
    expect(g.igloo.curtain, 'cortina fechada').toBe(1);
    // só a perspectiva de se afastar (pequena), nunca "sumir encolhendo"
    expect(minScale).toBeGreaterThanOrEqual(1 - ENTER.shrink - 1e-9);
  });

  test('ao entrar, o personagem fica dentro da abertura (a moldura o cobre)', () => {
    const g = readyIgloo(IGLOO.x);
    enterIgloo(g);
    stepUntil(g, () => g.player.inDoorway, 1);
    expect(g.player.inDoorway).toBe(true);
    const halfW = 18 * g.player.scale;
    expect(g.player.x - halfW).toBeGreaterThanOrEqual(IGLOO.x - g.igloo.doorWidth / 2);
    expect(g.player.x + halfW).toBeLessThanOrEqual(IGLOO.x + g.igloo.doorWidth / 2);
  });

  test('entrar toca o som da porta e da cortina', () => {
    const g = readyIgloo(IGLOO.x);
    enterIgloo(g);
    stepUntil(g, () => g.state === 'levelEnd', 3);
    expect(g.sfx.history).toContain('door');
    expect(g.sfx.history).toContain('curtain');
  });

  test('depois de entrar, a luz acende e sai fumaça; tudo volta ao normal na fase nova', () => {
    const g = readyIgloo(IGLOO.x);
    enterIgloo(g);
    stepUntil(g, () => g.state === 'levelEnd', 4);
    expect(g.igloo.lit).toBe(true);
    step(g, 0.8);
    expect(fxOf(g, 'smoke').length).toBeGreaterThan(0);
    stepUntil(g, () => g.level === 2, 10);
    expect(g.igloo.lit, 'apaga na fase nova').toBe(false);
    expect(g.igloo.curtain, 'cortina aberta na fase nova').toBe(0);
    expect(g.player.back, 'de frente de novo').toBe(false);
  });

  test('cenas de entrar no iglu e afundar renderizam sem erro', () => {
    const g = readyIgloo(IGLOO.x);
    g.renderer.draw(g); // com a dica
    enterIgloo(g);
    for (let i = 0; i < 14; i++) {
      step(g, 0.1);
      g.renderer.draw(g);
    }
    const d = makeGame();
    d.player.fall();
    for (let i = 0; i < 10; i++) {
      step(d, 0.13);
      d.renderer.draw(d);
    }
  });

  // ---- Partículas
  test('pousar numa placa solta lascas de gelo; na costa, neve', () => {
    const g = makeGame();
    aimAtRow0(g);
    jump(g, 'down');
    expect(fxOf(g, 'chip').length).toBeGreaterThan(0);
    const puffs = g.particles.puffs.length;
    jump(g, 'up');
    expect(g.particles.puffs.length).toBeGreaterThan(puffs);
  });

  test('fileira que acende solta brilhos; fileira já azul não', () => {
    const g = makeGame();
    g.onLand(1);
    const n = fxOf(g, 'spark').length;
    expect(n).toBeGreaterThan(0);
    g.onLand(1);
    expect(fxOf(g, 'spark').length).toBe(n);
  });

  test('afundando na água saem bolhas, que estouram na superfície', () => {
    const g = makeGame();
    g.player.fall();
    step(g, 0.6);
    const bubbles = fxOf(g, 'bubble');
    expect(bubbles.length).toBeGreaterThan(0);
    for (const b of bubbles) expect(b.y).toBeGreaterThanOrEqual(g.player.sinkLine - 2);
    step(g, 3);
    expect(fxOf(g, 'bubble').length).toBe(0);
  });

  test('vapor da respiração só aparece no frio', () => {
    const warm = makeGame();
    step(warm, 3);
    expect(fxOf(warm, 'vapor').length).toBe(0);
    const cold = makeGame();
    cold.temp = RULES.breathBelow;
    step(cold, 0.2);
    expect(fxOf(cold, 'vapor').length).toBeGreaterThan(0);
  });

  test('partículas expiram (não acumulam)', () => {
    const g = makeGame();
    g.onLand(0);
    g.particles.chips(100, 300);
    g.particles.breath(100, 200, 1);
    step(g, 3);
    expect(g.particles.fx.length).toBe(0);
  });

  // ---- Placas
  test('placa afunda ao receber o jogador e volta ao balanço normal', () => {
    const g = makeGame();
    for (const r of g.rows) r.speed = 0;
    aimAtRow0(g);
    jump(g, 'down');
    const piece = g.player.support;
    expect(piece.dip).toBeGreaterThan(0.8);
    const t = g.time;
    const rest = (p) => Math.sin(t * 2.2 + p.bob) * 1.6;
    expect(floeOffset(piece, t)).toBeGreaterThan(rest(piece));
    step(g, 1);
    expect(piece.dip).toBe(0);
    expect(Math.abs(floeOffset(piece, g.time))).toBeLessThanOrEqual(1.6);
  });

  // ---- Aurora boreal
  test('aurora boreal só nas fases avançadas', () => {
    for (let l = 1; l < RULES.auroraFrom; l++) expect(auroraStrength(l, 0), `fase ${l}`).toBe(0);
    expect(auroraStrength(RULES.auroraFrom, 1)).toBeGreaterThan(0);
  });

  test('aurora fica mais forte com a fase e quando o céu escurece', () => {
    const L = RULES.auroraFrom;
    expect(auroraStrength(L + 2, 1)).toBeGreaterThan(auroraStrength(L, 1));
    expect(auroraStrength(L, 0)).toBeGreaterThan(auroraStrength(L, 1));
    expect(auroraStrength(L + 20, 0)).toBeLessThanOrEqual(1);
  });

  test('renderer desenha a aurora na fase avançada', () => {
    const g = makeGame({ level: RULES.auroraFrom + 1 });
    g.renderer.draw(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
    const early = makeGame({ level: 1 });
    early.renderer.draw(early);
    expect(early.renderer.aurora).toBe(0);
  });

  // ---- Áudio
  test('passos tocam enquanto anda e param quando para', () => {
    const g = makeGame();
    hold(g, 'right');
    step(g, 1);
    release(g, 'right');
    const steps = g.sfx.history.filter((n) => n === 'step').length;
    expect(steps).toBeGreaterThanOrEqual(3);
    step(g, 1);
    expect(g.sfx.history.filter((n) => n === 'step').length).toBe(steps);
  });

  test('screen shake decai suavemente até zero', () => {
    const g = makeGame();
    g.player.fall();
    const s0 = g.shake;
    step(g, STEP * 10);
    expect(g.shake).toBeLessThan(s0);
    expect(g.shake).toBeGreaterThan(0);
  });
});
