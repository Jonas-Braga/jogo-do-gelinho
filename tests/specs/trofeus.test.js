// Troféus das fases especiais: ganhos ao concluir cada fase especial pela primeira
// vez, com comemoração na tela; ficam na conta, aparecem ao lado do apelido no
// ranking e numa prateleira (coleção) na tela inicial.
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { makeGame, step, stepUntil, enterIgloo, press } from '../helpers.js';
import { Game } from '../../src/game.js';
import { SPECIALS, TROPHY_LEVELS, trophyFor, normTrophies } from '../../src/specials.js';
import {
  TROPHY_EMBLEMS, Celebration, CELEBRATION, drawTrophy, drawTrophyShelf, drawTrophyIcons, RANK_TROPHY,
} from '../../src/trophies.js';
import { MemoryBackend } from '../../src/backend.js';
import { SOUND_NAMES } from '../../src/audio.js';
import { loadTrophies, saveTrophies, removeItem } from '../../src/storage.js';
import { W, H } from '../../src/config.js';

const canvas = () => (isNode ? fakeCanvas() : document.createElement('canvas'));
const played = (g) => g.sfx.history;

// Completa a fase atual (iglu pronto, entra, bônus) e para quando a comemoração
// começa ou a próxima fase já começou
function finishLevel(g) {
  const lv = g.level;
  while (!g.igloo.complete) g.igloo.add();
  g.player.x = g.igloo.doorX;
  enterIgloo(g);
  stepUntil(g, () => g.state === 'trophy' || g.level !== lv, 40);
}

function accountGame(b) {
  const g = new Game(canvas(), { title: true, backend: b });
  b.onChange((s) => g.setAccount(s));
  return g;
}

function quiet(g) {
  g.critters.list = [];
  g.critters.timers = g.critters.timers.map(() => Infinity);
  g.bear.active = false;
}

async function failure(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.code || 'sem-codigo';
  }
}

// Contexto 2D que registra os textos escritos
function textCtx() {
  const texts = [];
  const gradient = { addColorStop() {} };
  const store = {
    measureText: (s) => ({ width: String(s).length * 7 }),
    fillText: (s) => texts.push(String(s)),
  };
  const ctx = new Proxy(store, {
    get(t, k) {
      return k in t ? t[k] : () => gradient;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx, texts };
}

suite('Troféus · fases especiais', () => {
  // ---- Registro
  test('toda fase especial tem um troféu com nome, cor da fita e emblema próprio', () => {
    expect(TROPHY_LEVELS).toEqual([5, 10, 15, 20]);
    const names = new Set();
    for (const [lv, sp] of Object.entries(SPECIALS)) {
      const tr = trophyFor(lv);
      expect(tr, `fase ${lv}`).toBeTruthy();
      expect(tr.name, `fase ${lv}`).toContain('Troféu');
      expect(/^#[0-9A-Fa-f]{6}$/.test(tr.ribbon), `fita da fase ${lv}`).toBe(true);
      expect(typeof TROPHY_EMBLEMS[sp.id], `emblema de ${sp.id}`).toBe('function');
      names.add(tr.name);
    }
    expect(names.size, 'nomes diferentes').toBe(TROPHY_LEVELS.length);
    expect(trophyFor(4)).toBe(null);
    expect(trophyFor(25), 'fase 25 ainda sem tema').toBe(null);
  });

  test('lista de troféus é limpa: sem repetição, só fases especiais, em ordem', () => {
    expect(normTrophies([10, 5, 5, '15', 7, 999], [5, 20])).toEqual([5, 10, 15, 20]);
    expect(normTrophies(null, undefined)).toEqual([]);
  });

  test('as regras do Firestore aceitam exatamente os troféus que existem', async () => {
    let rules;
    if (isNode) {
      const fs = await import('node:fs');
      rules = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
    } else {
      rules = await (await fetch('../firestore.rules', { cache: 'no-store' })).text();
    }
    const m = rules.match(/function validTrophies[\s\S]*?hasOnly\(\[([^\]]*)\]\)/);
    expect(m, 'validTrophies em firestore.rules').toBeTruthy();
    const allowed = m[1].split(',').map((x) => Number(x.trim())).sort((a, b) => a - b);
    expect(allowed).toEqual(TROPHY_LEVELS);
    expect(rules).toContain("'trophies'");
    expect(rules, 'a lista só cresce').toContain(".get('trophies', []).hasAll(resource.data.get('trophies', []))");
  });

  // ---- Ganhar o troféu (sem conta: localStorage)
  test('concluir a fase de Natal pela primeira vez dá o troféu e abre a comemoração', () => {
    removeItem('trophies');
    const g = makeGame({ level: 5 });
    expect(g.trophies).toEqual([]);
    finishLevel(g);
    expect(g.state).toBe('trophy');
    expect(g.level, 'ainda não passou de fase').toBe(5);
    expect(g.trophies).toEqual([5]);
    expect(g.celebration.level).toBe(5);
    expect(played(g)).toContain('trophy');
    expect(loadTrophies(), 'salvo').toEqual([5]);
    removeItem('trophies');
  });

  test('a comemoração vem depois da contagem do bônus (pontos do bônus já somados)', () => {
    removeItem('trophies');
    const g = makeGame({ level: 5 });
    const before = g.score;
    finishLevel(g);
    expect(g.temp).toBe(0);
    expect(g.score).toBeGreaterThan(before);
    expect(g.bonusDone).toBe(true);
    removeItem('trophies');
  });

  test('a comemoração espera a tecla e só aceita depois de um instante', () => {
    removeItem('trophies');
    const g = makeGame({ level: 5 });
    finishLevel(g);
    press(g, 'start');
    expect(g.state, 'cedo demais').toBe('trophy');
    step(g, 10);
    expect(g.state, 'não sai sozinha').toBe('trophy');
    expect(g.celebration.ready).toBe(true);
    press(g, 'start');
    expect(g.state).toBe('play');
    expect(g.level).toBe(6);
    expect(g.celebration).toBe(null);
    removeItem('trophies');
  });

  test('Espaço (ou o botão ⇄ do toque) também continua, e não inverte nada', () => {
    removeItem('trophies');
    const g = makeGame({ level: 10 });
    finishLevel(g);
    expect(g.trophies).toEqual([10]);
    step(g, CELEBRATION.minTime + 0.1);
    const lives = g.lives;
    press(g, 'action');
    expect(g.level).toBe(11);
    expect(g.state).toBe('play');
    expect(g.igloo.count).toBe(0);
    expect(g.lives).toBe(lives);
    removeItem('trophies');
  });

  test('o troféu é ganho uma vez só: na segunda vez a fase segue direto', () => {
    removeItem('trophies');
    saveTrophies([5]);
    const g = makeGame({ level: 5 });
    expect(g.trophies).toEqual([5]);
    finishLevel(g);
    expect(g.level).toBe(6);
    expect(g.state).toBe('play');
    expect(played(g).includes('trophy')).toBe(false);
    expect(g.trophies).toEqual([5]);
    removeItem('trophies');
  });

  test('partida nova no meio da comemoração não repete o troféu antigo depois', () => {
    removeItem('trophies');
    const g = makeGame({ level: 10 });
    finishLevel(g);
    expect(g.state).toBe('trophy');
    g.newGame();
    expect(g.celebration).toBe(null);
    g.level = 5;
    g.trophies = [5, 10];
    g.startLevel();
    quiet(g);
    finishLevel(g);
    expect(g.state, 'Natal já ganho: segue direto').toBe('play');
    expect(g.level).toBe(6);
    removeItem('trophies');
  });

  test('fases normais não dão troféu', () => {
    removeItem('trophies');
    for (const lv of [1, 4, 6, 25]) {
      const g = makeGame({ level: lv });
      finishLevel(g);
      expect(g.state, `fase ${lv}`).toBe('play');
      expect(g.level).toBe(lv + 1);
      expect(g.trophies).toEqual([]);
    }
    removeItem('trophies');
  });

  test('cada fase especial dá o seu próprio troféu, e a coleção vai crescendo', () => {
    removeItem('trophies');
    const g = makeGame({ level: 15 });
    finishLevel(g);
    step(g, CELEBRATION.minTime + 0.1);
    press(g, 'start');
    g.level = 20;
    g.startLevel();
    quiet(g);
    finishLevel(g);
    expect(g.celebration.level).toBe(20);
    expect(g.trophies).toEqual([15, 20]);
    removeItem('trophies');
  });

  test('a temperatura não cai e os bichos não se mexem durante a comemoração', () => {
    removeItem('trophies');
    const g = makeGame({ level: 5 });
    finishLevel(g);
    const temp = g.temp;
    const lives = g.lives;
    step(g, 3);
    expect(g.temp).toBe(temp);
    expect(g.lives).toBe(lives);
    expect(g.state).toBe('trophy');
    removeItem('trophies');
  });

  test('confete cai e é reposto; os fogos somem sozinhos', () => {
    const c = new Celebration(5);
    expect(c.trophy.name).toBe('Troféu do Natal');
    expect(c.confetti.length).toBe(CELEBRATION.confetti);
    expect(c.colors).toContain(trophyFor(5).ribbon);
    for (let i = 0; i < 600; i++) c.update(1 / 60);
    expect(c.confetti.length).toBe(CELEBRATION.confetti);
    expect(c.confetti.every((p) => p.y <= H + 21)).toBe(true);
    expect(c.bursts.length).toBeGreaterThan(0);
    expect(c.bursts.every((b) => b.t < 1.4)).toBe(true);
  });

  // ---- Conta (backend)
  test('troféu na conta: só aprovados, só fases especiais, sem repetir', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', status: 'pending' });
    await b.signIn('ana@b.com', 'senha123');
    expect(await failure(b.awardTrophy(5))).toBe('score/not-approved');
    b.users.get(b.uid).status = 'approved';
    expect(await failure(b.awardTrophy(7))).toBe('permission-denied');
    expect(await b.awardTrophy(10)).toEqual([10]);
    expect(await b.awardTrophy(5)).toEqual([5, 10]);
    expect(await b.awardTrophy(5)).toEqual([5, 10]);
    expect(b.session().trophies).toEqual([5, 10]);
  });

  test('recorde novo não apaga os troféus, e "zerar" do admin apaga só a pontuação', async () => {
    const b = new MemoryBackend();
    const ana = b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 900, trophies: [5] });
    b.seed({ email: 'adm@b.com', nickname: 'Adm', password: 'adm123', admin: true });
    await b.signIn('ana@b.com', 'senha123');
    await b.submitScore(5000, 9);
    expect(b.session().trophies).toEqual([5]);
    await b.signIn('adm@b.com', 'adm123');
    await b.resetScore(ana);
    const u = (await b.listUsers()).find((x) => x.uid === ana);
    expect(u.best).toBe(0);
    expect(u.trophies).toEqual([5]);
  });

  test('o ranking traz os troféus de cada jogador', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Ana', best: 900, trophies: [10, 5] });
    b.seed({ email: 'c@d.com', nickname: 'Beto', best: 500 });
    await b.signIn('a@b.com', 'senha123');
    const r = await b.ranking(10);
    expect(r.top[0].trophies).toEqual([5, 10]);
    expect(r.top[1].trophies).toEqual([]);
    expect(r.me.trophies).toEqual([5, 10]);
  });

  test('com conta: o troféu vai para a conta e aparece no ranking do fim de jogo', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana' });
    await b.signIn('ana@b.com', 'senha123');
    const g = accountGame(b);
    g.newGame();
    g.level = 5;
    g.startLevel();
    quiet(g);
    finishLevel(g);
    expect(g.state).toBe('trophy');
    await g.pendingSave;
    expect(b.session().trophies).toEqual([5]);
    step(g, CELEBRATION.minTime + 0.1);
    press(g, 'start');
    g.lives = 1;
    g.player.fall();
    stepUntil(g, () => g.state === 'gameOver', 3);
    await g.loadRanking();
    expect(g.ranking.me.trophies).toEqual([5]);
    expect(g.ranking.me.best).toBeGreaterThan(0);
  });

  test('com conta: troféus que a conta já tem não são comemorados de novo', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 100, trophies: [5] });
    await b.signIn('ana@b.com', 'senha123');
    const g = accountGame(b);
    expect(g.trophies).toEqual([5]);
    g.newGame();
    g.level = 5;
    g.startLevel();
    quiet(g);
    finishLevel(g);
    expect(g.level).toBe(6);
    expect(g.state).toBe('play');
  });

  test('trocar de conta troca a coleção; sair da conta esvazia', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 100, trophies: [5, 10] });
    b.seed({ email: 'beto@b.com', nickname: 'Beto', best: 100 });
    await b.signIn('ana@b.com', 'senha123');
    const g = accountGame(b);
    expect(g.trophies).toEqual([5, 10]);
    await b.signIn('beto@b.com', 'senha123');
    expect(g.trophies).toEqual([]);
    await b.signIn('ana@b.com', 'senha123');
    await b.signOut();
    expect(g.trophies).toEqual([]);
  });

  test('o localStorage não vale com conta (os troféus vêm só da conta)', async () => {
    saveTrophies([5, 10, 15, 20]);
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana' });
    await b.signIn('ana@b.com', 'senha123');
    const g = accountGame(b);
    expect(g.trophies).toEqual([]);
    removeItem('trophies');
  });

  // ---- Telas
  test('a prateleira da tela inicial mostra a coleção (ganhos e "?" para os que faltam)', () => {
    const { ctx, texts } = textCtx();
    drawTrophyShelf(ctx, [5, 20], 1);
    expect(texts).toContain(`COLEÇÃO DE TROFÉUS  2/${TROPHY_LEVELS.length}`);
    expect(texts.filter((s) => s === '?').length).toBe(TROPHY_LEVELS.length - 2);
  });

  test('a comemoração mostra o nome do troféu e a coleção', () => {
    removeItem('trophies');
    const g = makeGame({ level: 20 });
    finishLevel(g);
    const { ctx, texts } = textCtx();
    g.renderer.ctx = ctx;
    g.renderer.draw(g);
    expect(texts).toContain('NOVO TROFÉU!');
    expect(texts).toContain('Troféu da Praia');
    expect(texts.some((s) => s.includes(`coleção 1/${TROPHY_LEVELS.length}`))).toBe(true);
    removeItem('trophies');
  });

  test('com muitos troféus o ranking mostra um ícone e o contador', () => {
    const { ctx, texts } = textCtx();
    const many = Array.from({ length: RANK_TROPHY.max + 2 }, (_, i) => (i + 1) * 5);
    expect(drawTrophyIcons(ctx, many, 600, 300)).toBeGreaterThan(0);
    expect(texts).toContain(`×${many.length}`);
    expect(drawTrophyIcons(ctx, [], 600, 300)).toBe(0);
  });

  test('troféus, prateleira, comemoração e ranking com troféus desenham sem erro', async () => {
    removeItem('trophies');
    const c = isNode ? fakeCanvas() : document.createElement('canvas');
    const ctx = c.getContext('2d');
    for (const lv of TROPHY_LEVELS) {
      drawTrophy(ctx, lv, 100, 200, 120, { shine: 0.5, spin: -0.4 });
      drawTrophy(ctx, lv, 100, 200, 30, { locked: true });
    }
    drawTrophyShelf(ctx, [5, 15], 2);
    // Tela inicial com conta e troféus
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 3000, trophies: [5, 10, 15, 20] });
    b.seed({ email: 'x@b.com', nickname: 'ApelidoBemComprido', best: 2000, trophies: [5, 10] });
    await b.signIn('ana@b.com', 'senha123');
    const g = accountGame(b);
    g.renderer.draw(g);
    // Comemoração em vários momentos
    g.newGame();
    g.level = 5;
    g.startLevel();
    quiet(g);
    g.trophies = [];
    finishLevel(g);
    for (let i = 0; i < 5; i++) {
      g.renderer.draw(g);
      step(g, 0.4);
    }
    g.input.touchMode = true;
    g.renderer.draw(g);
    // Fim de jogo com ranking
    step(g, 1);
    press(g, 'start');
    g.lives = 1;
    g.player.fall();
    stepUntil(g, () => g.state === 'gameOver', 3);
    await g.loadRanking();
    g.renderer.draw(g);
    expect(g.ranking.top[0].trophies.length).toBe(4);
    expect(W).toBe(1280);
  });

  test('há um som próprio para o troféu novo', () => {
    expect(SOUND_NAMES).toContain('trophy');
  });
});
