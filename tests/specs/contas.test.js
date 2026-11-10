// Contas: login, aprovação pelo administrador, recorde na conta e ranking no fim de jogo.
// Usa o MemoryBackend, que segue as mesmas regras do Firebase (firestore.rules).
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { stepUntil } from '../helpers.js';
import { Game } from '../../src/game.js';
import {
  MemoryBackend, nicknameProblem, withRanks, errorMessage, AccountError, NICK_MAX,
} from '../../src/backend.js';
import { typingIn } from '../../src/input.js';
import { loadHighScore, saveHighScore, removeItem } from '../../src/storage.js';

const canvas = () => (isNode ? fakeCanvas() : document.createElement('canvas'));

// Código do erro de uma promessa que deveria falhar (null se não falhou)
async function failure(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e.code || 'sem-codigo';
  }
}

// Jogo real (tela inicial) ligado a um backend em memória, já com a sessão aplicada
function accountGame(b) {
  const g = new Game(canvas(), { title: true, backend: b });
  b.onChange((s) => g.setAccount(s));
  return g;
}

function loseAll(g) {
  g.lives = 1;
  g.player.fall();
  stepUntil(g, () => g.state === 'gameOver', 3);
}

suite('Contas · login, aprovação e ranking', () => {
  // ---- Cadastro e login
  test('cadastro cria a conta como "aguardando aprovação"', async () => {
    const b = new MemoryBackend();
    await b.signUp({ email: 'Ana@Exemplo.com', nickname: 'Ana', password: 'gelo123' });
    const s = b.session();
    expect(s.status).toBe('pending');
    expect(s.nickname).toBe('Ana');
    expect(s.email, 'e-mail normalizado').toBe('ana@exemplo.com');
  });

  test('cadastro valida e-mail, apelido e senha', async () => {
    const b = new MemoryBackend();
    const ok = { email: 'a@b.com', nickname: 'Gelo', password: 'gelo123' };
    expect(await failure(b.signUp({ ...ok, email: 'sem-arroba' }))).toBe('auth/invalid-email');
    expect(await failure(b.signUp({ ...ok, nickname: 'ab' }))).toBe('nick/short');
    expect(await failure(b.signUp({ ...ok, nickname: 'x'.repeat(NICK_MAX + 1) }))).toBe('nick/long');
    expect(await failure(b.signUp({ ...ok, nickname: 'com espaço' }))).toBe('nick/chars');
    expect(await failure(b.signUp({ ...ok, password: '123' }))).toBe('auth/weak-password');
    expect(b.session(), 'nada foi criado').toBe(null);
  });

  test('apelidos com acento valem; caracteres estranhos não', () => {
    expect(nicknameProblem('João_2')).toBe(null);
    expect(nicknameProblem('Pin.guim-9')).toBe(null);
    expect(nicknameProblem('<script>')).toBe('nick/chars');
    expect(nicknameProblem('  ')).toBe('nick/short');
  });

  test('apelido é único, sem diferença entre maiúsculas e minúsculas', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Pinguim' });
    expect(await failure(b.signUp({ email: 'c@d.com', nickname: 'PINGUIM', password: 'gelo123' }))).toBe('nick/taken');
  });

  test('e-mail repetido não cria outra conta', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Pinguim' });
    expect(await failure(b.signUp({ email: 'a@b.com', nickname: 'Outro', password: 'gelo123' }))).toBe('auth/email-already-in-use');
  });

  test('login com senha errada falha; com a certa entra', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Pinguim', password: 'certa1' });
    expect(await failure(b.signIn('a@b.com', 'errada'))).toBe('auth/invalid-credential');
    expect(b.session()).toBe(null);
    await b.signIn('A@B.com', 'certa1');
    expect(b.session().nickname).toBe('Pinguim');
    await b.signOut();
    expect(b.session()).toBe(null);
  });

  test('esqueci a senha: aceita o e-mail sem revelar se a conta existe', async () => {
    const b = new MemoryBackend();
    expect(await failure(b.resetPassword('ninguem@exemplo.com'))).toBe(null);
    expect(await failure(b.resetPassword('invalido'))).toBe('auth/invalid-email');
    expect(b.resets).toEqual(['ninguem@exemplo.com']);
  });

  test('erros aparecem em português', () => {
    expect(errorMessage({ code: 'auth/invalid-credential' })).toBe('E-mail ou senha incorretos.');
    expect(errorMessage(new AccountError('nick/taken'))).toContain('apelido');
    expect(errorMessage(new Error('qualquer'))).toContain('Tente de novo');
  });

  // ---- Aprovação
  test('só o administrador aprova, recusa e zera pontuação', async () => {
    const b = new MemoryBackend();
    const ana = b.seed({ email: 'ana@b.com', nickname: 'Ana', status: 'pending' });
    b.seed({ email: 'bia@b.com', nickname: 'Bia', password: 'bia123' });
    await b.signIn('bia@b.com', 'bia123');
    expect(await failure(b.setStatus(ana, 'approved')), 'jogadora comum').toBe('admin/forbidden');
    expect(await failure(b.listUsers())).toBe('admin/forbidden');
    b.seed({ email: 'adm@b.com', nickname: 'Adm', password: 'adm123', admin: true });
    await b.signIn('adm@b.com', 'adm123');
    expect(await b.pendingCount()).toBe(1);
    await b.setStatus(ana, 'approved');
    expect(b.users.get(ana).status).toBe('approved');
    expect(await b.pendingCount()).toBe(0);
  });

  test('a aprovação chega em tempo real e libera o jogo', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'adm@b.com', nickname: 'Adm', password: 'adm123', admin: true });
    const g = accountGame(b);
    await b.signUp({ email: 'ana@b.com', nickname: 'Ana', password: 'gelo123' });
    expect(g.locked, 'pendente').toBe(true);
    const ana = b.uid;
    // O administrador aprova (em outra máquina): a sessão da Ana é atualizada
    b.admins.add(ana); // atalho: a própria sessão faz o papel do admin
    await b.setStatus(ana, 'approved');
    b.admins.delete(ana);
    expect(g.account.status).toBe('approved');
    expect(g.locked).toBe(false);
  });

  // ---- Bloqueio do jogo
  test('sem conta, Enter, Espaço e toque não começam a partida', () => {
    const g = accountGame(new MemoryBackend());
    expect(g.state).toBe('title');
    expect(g.locked).toBe(true);
    g.input.emit('start');
    g.input.emit('action');
    expect(g.state).toBe('title');
    g.renderer.draw(g);
  });

  test('conta aguardando aprovação ou recusada não joga', async () => {
    for (const status of ['pending', 'rejected']) {
      const b = new MemoryBackend();
      b.seed({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123', status });
      const g = accountGame(b);
      await b.signIn('a@b.com', 'gelo123');
      g.input.emit('start');
      expect(g.state, status).toBe('title');
    }
  });

  test('conta aprovada joga e a tela inicial mostra o apelido e o recorde da conta', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123', best: 2500 });
    const g = accountGame(b);
    await b.signIn('a@b.com', 'gelo123');
    expect(g.highScore).toBe(2500);
    g.renderer.draw(g);
    g.input.emit('start');
    expect(g.state).toBe('play');
  });

  test('sair da conta no meio da partida volta para a tela inicial bloqueada', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123' });
    const g = accountGame(b);
    await b.signIn('a@b.com', 'gelo123');
    g.input.emit('start');
    await b.signOut();
    expect(g.state).toBe('title');
    expect(g.locked).toBe(true);
    expect(g.highScore).toBe(0);
  });

  test('sem backend o jogo continua como antes (recorde no localStorage)', () => {
    removeItem('highscore');
    saveHighScore(777);
    const g = new Game(canvas(), { title: true });
    expect(g.locked).toBe(false);
    expect(g.highScore).toBe(777);
    removeItem('highscore');
  });

  // ---- Recorde na conta
  test('quem está aguardando aprovação não grava recorde', async () => {
    const b = new MemoryBackend();
    await b.signUp({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123' });
    expect(await failure(b.submitScore(500, 2))).toBe('score/not-approved');
  });

  test('o recorde da conta nunca diminui', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123' });
    await b.signIn('a@b.com', 'gelo123');
    expect(await b.submitScore(900, 3)).toBe(900);
    expect(await b.submitScore(400, 2)).toBe(900);
    expect(b.scores.get(b.uid).best).toBe(900);
  });

  test('fim de jogo grava o recorde na conta (e não no localStorage)', async () => {
    removeItem('highscore');
    const b = new MemoryBackend();
    b.seed({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123', best: 100 });
    const g = accountGame(b);
    await b.signIn('a@b.com', 'gelo123');
    g.input.emit('start');
    g.score = 1500;
    loseAll(g);
    await g.pendingSave;
    expect(b.scores.get(b.uid).best).toBe(1500);
    expect(g.newRecord).toBe(true);
    expect(loadHighScore(), 'localStorage intocado').toBe(0);
  });

  // ---- Ranking
  test('ranking em ordem decrescente; empates dividem a posição', () => {
    const r = withRanks([{ best: 900 }, { best: 500 }, { best: 500 }, { best: 100 }]);
    expect(r.map((e) => e.rank)).toEqual([1, 2, 2, 4]);
  });

  test('ranking mostra os 10 melhores e a posição de quem ficou de fora', async () => {
    const b = new MemoryBackend();
    for (let i = 1; i <= 12; i++) b.seed({ email: `j${i}@b.com`, nickname: `Jogador${i}`, best: i * 1000 });
    b.seed({ email: 'ana@b.com', nickname: 'Ana', password: 'gelo123', best: 50 });
    b.seed({ email: 'zero@b.com', nickname: 'Zerado', best: 0 });
    await b.signIn('ana@b.com', 'gelo123');
    const r = await b.ranking(10);
    expect(r.top.length).toBe(10);
    expect(r.top[0].nickname).toBe('Jogador12');
    expect(r.top[0].rank).toBe(1);
    expect(r.me.nickname).toBe('Ana');
    expect(r.me.rank, 'atrás dos 12').toBe(13);
    expect(r.top.some((e) => e.nickname === 'Zerado'), 'quem tem 0 não aparece').toBe(false);
    expect(JSON.stringify(r).includes('@'), 'ranking nunca expõe e-mails').toBe(false);
  });

  test('quem perde o acesso sai do ranking; zerar pontuação tira da lista', async () => {
    const b = new MemoryBackend();
    const ana = b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 900 });
    const bia = b.seed({ email: 'bia@b.com', nickname: 'Bia', best: 800 });
    b.seed({ email: 'adm@b.com', nickname: 'Adm', password: 'adm123', admin: true });
    await b.signIn('adm@b.com', 'adm123');
    await b.setStatus(ana, 'rejected');
    await b.resetScore(bia);
    const r = await b.ranking(10);
    expect(r.top.length).toBe(0);
  });

  test('só aprovados veem o ranking', async () => {
    const b = new MemoryBackend();
    await b.signUp({ email: 'a@b.com', nickname: 'Ana', password: 'gelo123' });
    expect(await failure(b.ranking())).toBe('score/not-approved');
  });

  test('fim de jogo carrega o ranking já com a nova pontuação e desenha a tela', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'p@b.com', nickname: 'Pinguim', best: 3000 });
    b.seed({ email: 'ana@b.com', nickname: 'Ana', password: 'gelo123' });
    const g = accountGame(b);
    await b.signIn('ana@b.com', 'gelo123');
    g.input.emit('start');
    g.score = 5000;
    loseAll(g);
    expect(g.ranking.loading, 'carregando').toBe(true);
    g.renderer.draw(g);
    stepUntil(g, () => false, 0.1);
    await g.loadRanking();
    expect(g.ranking.top.map((e) => e.nickname)).toEqual(['Ana', 'Pinguim']);
    expect(g.ranking.me.rank).toBe(1);
    g.renderer.draw(g);
    // Jogar de novo limpa o ranking
    g.input.emit('start');
    expect(g.ranking).toBe(null);
  });

  test('ranking indisponível (sem internet) mostra aviso em vez de travar', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', password: 'gelo123' });
    const g = accountGame(b);
    await b.signIn('ana@b.com', 'gelo123');
    b.ranking = async () => {
      throw new AccountError('unavailable');
    };
    const warn = console.warn;
    console.warn = () => {};
    try {
      await g.loadRanking();
    } finally {
      console.warn = warn;
    }
    expect(g.ranking.error).toBe(true);
    g.state = 'gameOver';
    g.renderer.draw(g);
  });

  // ---- Formulários
  test('teclas digitadas nos campos de conta não controlam o jogo', () => {
    const g = new Game(canvas());
    expect(typingIn({ tagName: 'INPUT' })).toBe(true);
    expect(typingIn({ tagName: 'CANVAS' })).toBe(false);
    const key = (code, tagName) => g.input.keyDown({ code, target: { tagName }, repeat: false, preventDefault() {} });
    key('KeyP', 'INPUT');
    key('Space', 'INPUT');
    expect(g.paused, 'P no campo de senha').toBe(false);
    key('KeyP', 'CANVAS');
    expect(g.paused, 'P fora do formulário').toBe(true);
  });

  test('painel de conta: login → jogo liberado; pendente → aguardando aprovação', async () => {
    if (isNode) return; // precisa de DOM: roda na suíte do navegador
    const { AuthUI } = await import('../../src/auth-ui.js');
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', password: 'gelo123' });
    b.seed({ email: 'bia@b.com', nickname: 'Bia', password: 'gelo123', status: 'pending' });
    const root = document.createElement('div');
    const g = new Game(canvas(), { title: true, backend: b });
    const ui = new AuthUI(g, b, root);
    expect(ui.overlay.hidden).toBe(false);
    expect(root.querySelector('input[type=email]') !== null, 'formulário de login').toBe(true);
    await b.signIn('ana@b.com', 'gelo123');
    expect(ui.overlay.hidden, 'aprovada: painel some').toBe(true);
    expect(g.locked).toBe(false);
    await b.signOut();
    await b.signIn('bia@b.com', 'gelo123');
    expect(ui.overlay.hidden).toBe(false);
    expect(root.textContent).toContain('Aguardando aprovação');
    expect(g.locked).toBe(true);
  });
});
